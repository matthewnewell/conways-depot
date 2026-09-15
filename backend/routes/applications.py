import httpx
from flask import Blueprint, jsonify, request
from sqlalchemy import func

from db import db
from models import (
    APP_CATEGORIES,
    APP_SCOPES,
    TEAM_TYPES,
    Application,
    Capability,
    Project,
    ProjectAppLink,
)

bp = Blueprint("applications", __name__, url_prefix="/api/applications")
capabilities_bp = Blueprint("capabilities", __name__, url_prefix="/api/capabilities")


def _project_counts() -> dict[str, int]:
    """How many distinct projects have a link to each application — the registry's read on
    which catalog entries are actually load-bearing. A plain count of ProjectAppLink rows,
    deduped by project (one project linking an app at two phases still counts once)."""
    rows = (
        db.session.query(
            ProjectAppLink.application_id,
            func.count(func.distinct(ProjectAppLink.project_id)),
        )
        .group_by(ProjectAppLink.application_id)
        .all()
    )
    return {app_id: n for app_id, n in rows}


def _split_categories(raw) -> list[str]:
    """`category` may arrive as a single string, a comma-separated string, or a list (the
    frontend can send any of the three) — always split into individual aisle codes."""
    if raw is None:
        return []
    parts = raw if isinstance(raw, list) else str(raw).split(",")
    return [p.strip() for p in parts if p.strip()]


def _validate(body: dict) -> tuple[dict, int] | None:
    if body.get("team_type") is not None and body.get("team_type") not in (*TEAM_TYPES, None):
        return {"error": f"team_type must be one of {TEAM_TYPES} or null"}, 400
    if "scope" in body and body["scope"] not in APP_SCOPES:
        return {"error": f"scope must be one of {APP_SCOPES}"}, 400
    if body.get("category") is not None:
        bad = [c for c in _split_categories(body["category"]) if c not in APP_CATEGORIES]
        if bad:
            return {"error": f"category must be one or more of {APP_CATEGORIES} (got {bad})"}, 400
    return None


@bp.get("")
def list_applications():
    apps = Application.query.order_by(Application.name).all()
    counts = _project_counts()
    return jsonify([{**a.to_dict(), "project_count": counts.get(a.id, 0)} for a in apps])


@bp.post("")
def create_application():
    body = request.get_json(force=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    err = _validate(body)
    if err:
        return jsonify(err[0]), err[1]

    a = Application(
        name=name,
        description=body.get("description"),
        owning_team=body.get("owning_team"),
        team_type=body.get("team_type"),
        scope=body.get("scope", "project"),
        category=",".join(_split_categories(body.get("category"))) or None,
        capability_id=body.get("capability_id"),
        url=body.get("url"),
        api_url=body.get("api_url"),
    )
    db.session.add(a)
    db.session.commit()
    return jsonify(a.to_dict()), 201


@bp.get("/<application_id>")
def get_application(application_id):
    a = Application.query.get_or_404(application_id)
    # The app-side mirror of a project's app_links: which projects connect this app, with the
    # link id each connection needs to be removed by. The detail page filters this to the
    # active persona's projects for the "Connected projects" add/remove controls.
    rows = (
        db.session.query(ProjectAppLink, Project.name)
        .join(Project, Project.id == ProjectAppLink.project_id)
        .filter(ProjectAppLink.application_id == a.id)
        .order_by(Project.name)
        .all()
    )
    project_links = [
        {"link_id": link.id, "project_id": link.project_id, "project_name": name, "phase": link.phase}
        for link, name in rows
    ]
    return jsonify(
        {
            **a.to_dict(),
            "project_count": _project_counts().get(a.id, 0),
            "project_links": project_links,
        }
    )


@bp.get("/<application_id>/reachable")
def application_reachable(application_id):
    """Is this app's `url` responding right now? A 1-ish-second probe so the "Test drive" button
    can tell the truth instead of handing you a dead tab. No process management — you launch the
    app yourself; this just checks. Cheap enough to poll (the frontend caches it ~15s)."""
    a = Application.query.get_or_404(application_id)
    if not a.url:
        return jsonify({"url": None, "reachable": False})

    reachable = False
    for method in (httpx.head, httpx.get):
        try:
            r = method(a.url, timeout=1.2, follow_redirects=True)
            reachable = r.status_code < 500
            break
        except httpx.HTTPError:
            continue
    return jsonify({"url": a.url, "reachable": reachable})


_NO_SUMMARY = {"headline": None, "label": "No summary published", "status": None, "href": None}


def _translate_project_id(application_id: str, depot_project_id: str | None) -> str | None:
    """Translate the Depot's own project id into whatever pointer a sibling app actually knows
    about, via the same external_ref crosswalk ProjectAppLink already carries (e.g. a Value
    Stream map id, a WinMax pursuit id — see seed.py's VALUE_STREAM_DEMO_MAP_ID). A sibling app
    was never meant to recognize the Depot's ids directly; falls back to passing the Depot's id
    as-is if no link/ref exists yet, in case the app wants to key on it anyway. Shared by both
    /summary and /journal below — and by the project-level journal aggregator in routes/projects.py."""
    if not depot_project_id:
        return None
    link = ProjectAppLink.query.filter_by(
        project_id=depot_project_id, application_id=application_id
    ).first()
    return link.external_ref if link and link.external_ref else depot_project_id


@bp.get("/<application_id>/summary")
def application_summary(application_id):
    """The Launchpad's app-summary contract: this app's own backend (`api_url`), not the Depot,
    decides what its tile shows — a `{headline, label, status, href}` the Depot renders
    opaquely and never interprets. The Depot's job is only to call it server-to-server (same
    reason /reachable does, not the browser — no CORS setup needed on 10+ separate repos) and
    fall back to "no summary published" on anything that isn't a clean 200: no `api_url` wired
    up yet, the app not running, a slow/broken response. That fallback is a normal state, never
    an error the frontend has to handle specially."""
    a = Application.query.get_or_404(application_id)
    if not a.api_url:
        return jsonify({**_NO_SUMMARY, "href": a.url})

    params = {}
    if project_id := _translate_project_id(application_id, request.args.get("project_id")):
        params["project_id"] = project_id

    try:
        r = httpx.get(f"{a.api_url.rstrip('/')}/api/summary", params=params, timeout=1.5)
        if r.status_code != 200:
            return jsonify({**_NO_SUMMARY, "href": a.url})
        data = r.json()
        return jsonify({
            "headline": data.get("headline"),
            "label": data.get("label"),
            "status": data.get("status") if data.get("status") in ("ok", "warn", "critical") else None,
            "href": data.get("href") or a.url,
        })
    except (httpx.HTTPError, ValueError):
        return jsonify({**_NO_SUMMARY, "href": a.url})


@bp.get("/<application_id>/journal")
def application_journal(application_id):
    """The cross-app journal contract's proxy half — same shape and same reasoning as
    /summary above, just a list instead of one tile: `{entries: [{id, timestamp, author,
    summary, href}, ...]}`, called server-to-server, opaque to the Depot (it never parses a
    `summary` string back apart), empty list on anything that isn't a clean 200. Called both
    per-application (this route) and in bulk by the project-level aggregator in
    routes/projects.py, which is what the Launchpad's actual Journal section uses."""
    a = Application.query.get_or_404(application_id)
    if not a.api_url:
        return jsonify({"entries": []})

    params = {}
    if project_id := _translate_project_id(application_id, request.args.get("project_id")):
        params["project_id"] = project_id

    try:
        r = httpx.get(f"{a.api_url.rstrip('/')}/api/journal", params=params, timeout=1.5)
        if r.status_code != 200:
            return jsonify({"entries": []})
        data = r.json()
        entries = data.get("entries") if isinstance(data, dict) else None
        if not isinstance(entries, list):
            return jsonify({"entries": []})
        return jsonify({"entries": entries})
    except (httpx.HTTPError, ValueError):
        return jsonify({"entries": []})


@bp.put("/<application_id>")
def update_application(application_id):
    a = Application.query.get_or_404(application_id)
    body = request.get_json(force=True) or {}
    err = _validate(body)
    if err:
        return jsonify(err[0]), err[1]

    for field in (
        "name", "description", "owning_team", "team_type", "scope",
        "capability_id", "url", "api_url",
    ):
        if field in body:
            setattr(a, field, body[field])
    if "category" in body:
        a.category = ",".join(_split_categories(body["category"])) or None

    db.session.commit()
    return jsonify(a.to_dict())


@bp.delete("/<application_id>")
def delete_application(application_id):
    a = Application.query.get_or_404(application_id)
    db.session.delete(a)
    db.session.commit()
    return "", 204


@capabilities_bp.get("")
def list_capabilities():
    caps = Capability.query.order_by(Capability.name).all()
    return jsonify([c.to_dict() for c in caps])


@capabilities_bp.post("")
def create_capability():
    body = request.get_json(force=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    c = Capability(name=name, description=body.get("description"))
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201

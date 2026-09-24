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
    HiddenOrgApp,
    Person,
    Pin,
    PinOrder,
    Project,
    ProjectAppLink,
    ProjectMembership,
)

bp = Blueprint("applications", __name__, url_prefix="/api/applications")
capabilities_bp = Blueprint("capabilities", __name__, url_prefix="/api/capabilities")
my_charges_bp = Blueprint("my_charges", __name__, url_prefix="/api")


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


@bp.get("/<application_id>/project-link")
def application_project_link(application_id):
    """The reverse of _translate_project_id — given this app's own resource id (e.g. a Value
    Stream map id), what Depot project is it crosswalked to? Lets the embeddable Journal widget
    (routes/embed.py) work from *inside* a sibling app without that app ever learning a Depot
    project id itself: the app hands the widget its own external_ref, the widget calls back
    here (browser-side, hence CORS on this route too) to resolve it. No match (unlinked
    resource, or a stale ref) is a normal empty state — `{project_id: null}` — same as every
    other cross-app lookup's "nothing published yet" fallback."""
    external_ref = request.args.get("external_ref")
    if not external_ref:
        return jsonify({"error": "external_ref is required"}), 400
    link = ProjectAppLink.query.filter_by(
        application_id=application_id, external_ref=external_ref
    ).first()
    if not link:
        return jsonify({"project_id": None, "project_name": None})
    return jsonify({"project_id": link.project_id, "project_name": link.project.name})


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


@my_charges_bp.get("/my-charges")
def my_charges():
    """The Launchpad drawer's "what am I supposed to charge to" tile — proxied server-to-server
    to Labor Supply & Demand the same way an app's own summary tile is (see application_summary
    above): the Depot never computes a project labor-plan charge number itself, LSD does, this
    just calls it and passes the answer through. No app found or unreachable is the same quiet
    empty state as everywhere else, not an error the frontend has to special-case.

    Not everyone's chargeable time is a labor-plan position, though. Capture and proposal work
    isn't in LSD at all: it charges to each pursuit's own B&P number from S4 (the project's
    "S4 B&P" crosswalk entry), so someone on pursuits gets one line per pursuit. Failing that, a
    person's standing charge number (Person.standing_charge_number) is shown as a synthetic
    assignment. Both are placeholders in the same spirit as LSD's charge_numbers.py."""
    person_id = request.args.get("person_id")
    empty = {"person_name": None, "assignments": [], "actuals": []}
    if not person_id:
        return jsonify(empty)

    data = dict(empty)
    a = Application.query.filter_by(name="Labor Supply & Demand").first()
    if a and a.api_url:
        try:
            r = httpx.get(f"{a.api_url.rstrip('/')}/api/my-charges", params={"person_id": person_id}, timeout=2.0)
            if r.status_code == 200:
                data = r.json()
        except (httpx.HTTPError, ValueError):
            pass

    person = db.session.get(Person, person_id)
    if person and not data.get("assignments"):
        pursuits = []
        for m in ProjectMembership.query.filter_by(person_id=person.id).all():
            project = db.session.get(Project, m.project_id)
            bp = next((e.external_id for e in (project.external_ids if project else []) if e.system == "S4 B&P"), None)
            if bp and project.phase == "pursuit":
                pursuits.append({
                    "id": f"bp-{project.id}",
                    "project_name": project.name,
                    "position_label": m.role_label or person.title,
                    "start_date": None,
                    "end_date": None,
                    "charge_number": bp,
                })
        if pursuits:
            data = dict(data)
            data["person_name"] = data.get("person_name") or person.name
            data["assignments"] = sorted(pursuits, key=lambda a: a["project_name"])
    if person and person.standing_charge_number and not data.get("assignments"):
        data = dict(data)
        data["person_name"] = data.get("person_name") or person.name
        data["assignments"] = [{
            "id": f"standing-{person.id}",
            "project_name": "Business Development",
            "position_label": person.title,
            "start_date": None,
            "end_date": None,
            "charge_number": person.standing_charge_number,
        }]
    return jsonify(data)


def fetch_app_journal_entries(a: "Application", depot_project_id: str | None) -> list[dict]:
    """The actual proxy call, factored out so both the per-app route below and the project-wide
    aggregator (routes/projects.py's /journal) share one implementation instead of the
    aggregator looping back through HTTP to call its own process. Same fallback either way:
    empty list on no api_url, a non-200, or anything that isn't valid `{entries: [...]}` JSON —
    never an error the caller has to special-case."""
    if not a.api_url:
        return []

    params = {}
    if project_id := _translate_project_id(a.id, depot_project_id):
        params["project_id"] = project_id

    try:
        r = httpx.get(f"{a.api_url.rstrip('/')}/api/journal", params=params, timeout=1.5)
        if r.status_code != 200:
            return []
        data = r.json()
        entries = data.get("entries") if isinstance(data, dict) else None
        return entries if isinstance(entries, list) else []
    except (httpx.HTTPError, ValueError):
        return []


@bp.get("/<application_id>/journal")
def application_journal(application_id):
    """The cross-app journal contract's proxy half — same shape and same reasoning as
    /summary above, just a list instead of one tile: `{entries: [{id, timestamp, author,
    summary, href}, ...]}`, called server-to-server, opaque to the Depot (it never parses a
    `summary` string back apart), empty list on anything that isn't a clean 200. Called both
    per-application (this route) and in bulk by the project-level aggregator in
    routes/projects.py, which is what the Launchpad's actual Journal section uses."""
    a = Application.query.get_or_404(application_id)
    return jsonify({"entries": fetch_app_journal_entries(a, request.args.get("project_id"))})


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
    """Pin/HiddenOrgApp/PinOrder's own docstrings call a row left over after its app is deleted
    "harmless orphan data" — true in spirit, but this DB enforces foreign keys (see db.py), so
    SQLite refuses the delete outright while any such row still points at this id, rather than
    quietly leaving one behind. Clear those (plus ProjectAppLink — a connected project loses its
    pointer to an app that no longer exists) before the Application row itself goes, so the
    delete actually succeeds instead of 500ing on whichever table happens to hold a stray row."""
    a = Application.query.get_or_404(application_id)
    Pin.query.filter_by(application_id=application_id).delete()
    HiddenOrgApp.query.filter_by(application_id=application_id).delete()
    PinOrder.query.filter_by(application_id=application_id).delete()
    ProjectAppLink.query.filter_by(application_id=application_id).delete()
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

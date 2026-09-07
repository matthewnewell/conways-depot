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


def _validate(body: dict) -> tuple[dict, int] | None:
    if body.get("team_type") is not None and body.get("team_type") not in (*TEAM_TYPES, None):
        return {"error": f"team_type must be one of {TEAM_TYPES} or null"}, 400
    if "scope" in body and body["scope"] not in APP_SCOPES:
        return {"error": f"scope must be one of {APP_SCOPES}"}, 400
    if body.get("category") is not None and body.get("category") not in APP_CATEGORIES:
        return {"error": f"category must be one of {APP_CATEGORIES} or null"}, 400
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
        category=body.get("category"),
        capability_id=body.get("capability_id"),
        url=body.get("url"),
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


@bp.put("/<application_id>")
def update_application(application_id):
    a = Application.query.get_or_404(application_id)
    body = request.get_json(force=True) or {}
    err = _validate(body)
    if err:
        return jsonify(err[0]), err[1]

    for field in (
        "name", "description", "owning_team", "team_type", "scope",
        "category", "capability_id", "url",
    ):
        if field in body:
            setattr(a, field, body[field])

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

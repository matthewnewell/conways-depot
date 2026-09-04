from flask import Blueprint, jsonify, request
from sqlalchemy import func

from db import db
from models import APP_SCOPES, APP_STATUSES, PHASES, TEAM_TYPES, Application, Capability, ProjectAppLink

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
    if "status" in body and body["status"] not in APP_STATUSES:
        return {"error": f"status must be one of {APP_STATUSES}"}, 400
    if body.get("team_type") is not None and body.get("team_type") not in (*TEAM_TYPES, None):
        return {"error": f"team_type must be one of {TEAM_TYPES} or null"}, 400
    if "scope" in body and body["scope"] not in APP_SCOPES:
        return {"error": f"scope must be one of {APP_SCOPES}"}, 400
    if "phases" in body:
        phases = body["phases"]
        if phases is not None and (not isinstance(phases, list) or any(p not in PHASES for p in phases)):
            return {"error": f"phases must be a list drawn from {PHASES}, or null"}, 400
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
        status=body.get("status", "planned"),
        owning_team=body.get("owning_team"),
        team_type=body.get("team_type"),
        scope=body.get("scope", "project"),
        capability_id=body.get("capability_id"),
        url=body.get("url"),
    )
    a.phase_list = body.get("phases")
    db.session.add(a)
    db.session.commit()
    return jsonify(a.to_dict()), 201


@bp.get("/<application_id>")
def get_application(application_id):
    a = Application.query.get_or_404(application_id)
    return jsonify({**a.to_dict(), "project_count": _project_counts().get(a.id, 0)})


@bp.put("/<application_id>")
def update_application(application_id):
    a = Application.query.get_or_404(application_id)
    body = request.get_json(force=True) or {}
    err = _validate(body)
    if err:
        return jsonify(err[0]), err[1]

    for field in ("name", "description", "status", "owning_team", "team_type", "scope", "capability_id", "url"):
        if field in body:
            setattr(a, field, body[field])
    if "phases" in body:
        a.phase_list = body["phases"]

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

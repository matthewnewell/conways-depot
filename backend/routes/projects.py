from flask import Blueprint, jsonify, request

from db import db
from models import PHASES, ExternalId, Portfolio, Project, ProjectAppLink, ProjectPhaseEvent

bp = Blueprint("projects", __name__, url_prefix="/api/projects")
# Flat resources for mutating a single external-id/link row, matching Value Stream's
# routes/edges.py convention: creation is nested under the parent (POST /projects/<id>/links),
# but update/delete address the row directly, not through its parent.
external_ids_bp = Blueprint("external_ids", __name__, url_prefix="/api/external-ids")
links_bp = Blueprint("links", __name__, url_prefix="/api/links")
portfolios_bp = Blueprint("portfolios", __name__, url_prefix="/api/portfolios")


def _validate_phase(body: dict) -> tuple[dict, int] | None:
    if "phase" in body and body["phase"] not in PHASES:
        return {"error": f"phase must be one of {PHASES}"}, 400
    return None


@bp.get("")
def list_projects():
    projects = Project.query.order_by(Project.updated_at.desc()).all()
    return jsonify([p.to_dict(include_links=False) for p in projects])


@bp.post("")
def create_project():
    body = request.get_json(force=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    err = _validate_phase(body)
    if err:
        return jsonify(err[0]), err[1]

    p = Project(
        name=name,
        customer=body.get("customer"),
        phase=body.get("phase", "pursuit"),
        description=body.get("description"),
        portfolio_id=body.get("portfolio_id"),
    )
    db.session.add(p)
    db.session.flush()  # assign p.id before the phase event references it
    db.session.add(ProjectPhaseEvent(project_id=p.id, from_phase=None, to_phase=p.phase))
    db.session.commit()
    return jsonify(p.to_dict()), 201


@bp.get("/<project_id>")
def get_project(project_id):
    p = Project.query.get_or_404(project_id)
    return jsonify(p.to_dict())


@bp.put("/<project_id>")
def update_project(project_id):
    p = Project.query.get_or_404(project_id)
    body = request.get_json(force=True) or {}
    err = _validate_phase(body)
    if err:
        return jsonify(err[0]), err[1]

    if "name" in body:
        name = (body["name"] or "").strip()
        if not name:
            return jsonify({"error": "name cannot be empty"}), 400
        p.name = name
    if "customer" in body:
        p.customer = body["customer"]
    if "phase" in body and body["phase"] != p.phase:
        db.session.add(ProjectPhaseEvent(project_id=p.id, from_phase=p.phase, to_phase=body["phase"]))
        p.phase = body["phase"]
    if "description" in body:
        p.description = body["description"]
    if "portfolio_id" in body:
        p.portfolio_id = body["portfolio_id"]

    db.session.commit()
    return jsonify(p.to_dict())


@bp.delete("/<project_id>")
def delete_project(project_id):
    p = Project.query.get_or_404(project_id)
    db.session.delete(p)
    db.session.commit()
    return "", 204


@bp.post("/<project_id>/external-ids")
def add_external_id(project_id):
    p = Project.query.get_or_404(project_id)
    body = request.get_json(force=True) or {}
    system = (body.get("system") or "").strip()
    external_id = (body.get("external_id") or "").strip()
    if not system or not external_id:
        return jsonify({"error": "system and external_id are both required"}), 400

    e = ExternalId(project_id=p.id, system=system, external_id=external_id)
    db.session.add(e)
    db.session.commit()
    return jsonify(e.to_dict()), 201


@external_ids_bp.delete("/<external_id_row_id>")
def delete_external_id(external_id_row_id):
    e = ExternalId.query.get_or_404(external_id_row_id)
    db.session.delete(e)
    db.session.commit()
    return "", 204


@bp.post("/<project_id>/links")
def create_link(project_id):
    p = Project.query.get_or_404(project_id)
    body = request.get_json(force=True) or {}
    application_id = body.get("application_id")
    phase = body.get("phase")
    if not application_id:
        return jsonify({"error": "application_id is required"}), 400
    if phase not in PHASES:
        return jsonify({"error": f"phase must be one of {PHASES}"}), 400

    link = ProjectAppLink(
        project_id=p.id,
        application_id=application_id,
        phase=phase,
        external_ref=body.get("external_ref"),
        link_url=body.get("link_url"),
        notes=body.get("notes"),
    )
    db.session.add(link)
    db.session.commit()
    return jsonify(link.to_dict()), 201


@links_bp.put("/<link_id>")
def update_link(link_id):
    link = ProjectAppLink.query.get_or_404(link_id)
    body = request.get_json(force=True) or {}
    if "phase" in body:
        if body["phase"] not in PHASES:
            return jsonify({"error": f"phase must be one of {PHASES}"}), 400
        link.phase = body["phase"]
    if "external_ref" in body:
        link.external_ref = body["external_ref"]
    if "link_url" in body:
        link.link_url = body["link_url"]
    if "notes" in body:
        link.notes = body["notes"]

    db.session.commit()
    return jsonify(link.to_dict())


@links_bp.delete("/<link_id>")
def delete_link(link_id):
    link = ProjectAppLink.query.get_or_404(link_id)
    db.session.delete(link)
    db.session.commit()
    return "", 204


@portfolios_bp.get("")
def list_portfolios():
    portfolios = Portfolio.query.order_by(Portfolio.name).all()
    return jsonify([p.to_dict() for p in portfolios])


@portfolios_bp.post("")
def create_portfolio():
    body = request.get_json(force=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    p = Portfolio(name=name, description=body.get("description"))
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from db import db
from models import (
    PHASES,
    TEAM_TYPES,
    Application,
    ExternalId,
    JournalNote,
    Person,
    Portfolio,
    Project,
    ProjectAppLink,
    ProjectMembership,
    ProjectPhaseEvent,
)
from routes.applications import fetch_app_journal_entries

bp = Blueprint("projects", __name__, url_prefix="/api/projects")
# Flat resources for mutating a single external-id/link/membership row, matching Value Stream's
# routes/edges.py convention: creation is nested under the parent (POST /projects/<id>/links),
# but update/delete address the row directly, not through its parent.
external_ids_bp = Blueprint("external_ids", __name__, url_prefix="/api/external-ids")
links_bp = Blueprint("links", __name__, url_prefix="/api/links")
portfolios_bp = Blueprint("portfolios", __name__, url_prefix="/api/portfolios")
memberships_bp = Blueprint("memberships", __name__, url_prefix="/api/memberships")


def _validate_phase(body: dict) -> tuple[dict, int] | None:
    if "phase" in body and body["phase"] not in PHASES:
        return {"error": f"phase must be one of {PHASES}"}, 400
    return None


def _app_counts() -> dict[str, int]:
    """How many applications each project connects to — the project-side mirror of an app's
    `project_count`, and the list's read on which projects are actually wired up."""
    rows = (
        db.session.query(ProjectAppLink.project_id, func.count(ProjectAppLink.id))
        .group_by(ProjectAppLink.project_id)
        .all()
    )
    return {pid: n for pid, n in rows}


@bp.get("")
def list_projects():
    projects = Project.query.order_by(Project.updated_at.desc()).all()
    counts = _app_counts()
    return jsonify(
        [{**p.to_dict(include_links=False), "app_count": counts.get(p.id, 0)} for p in projects]
    )


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
        team_notes=body.get("team_notes") or None,
    )
    p.channel_list = body.get("channels") or None
    db.session.add(p)
    db.session.flush()  # assign p.id before the phase event references it
    db.session.add(ProjectPhaseEvent(project_id=p.id, from_phase=None, to_phase=p.phase))
    db.session.commit()
    return jsonify(p.to_dict()), 201


@bp.get("/<project_id>")
def get_project(project_id):
    p = Project.query.get_or_404(project_id)
    return jsonify(p.to_dict())


@bp.get("/<project_id>/journal")
def project_journal(project_id):
    """The merged feed the Launchpad's own Journal panel builds client-side (a fan-out over
    every connected app's /journal plus this project's own notes), done once here instead — the
    embeddable Journal widget (routes/embed.py) has no React/TanStack Query to do that fan-out
    itself, and this is also the RAG-context bundle any app's own AI feature can call the same
    way Task Master's /suggest already does (see depot_client.fetch_app_journal there).

    Each entry is tagged `source_type` ("note" or "app") plus `application_id`/`application_name`
    (null for notes) so a caller can filter to one app's contribution — e.g. a "this app only"
    view — without a second request; the raw data already carries everything either view needs."""
    p = Project.query.get_or_404(project_id)

    notes = (
        JournalNote.query.filter_by(project_id=project_id)
        .order_by(JournalNote.created_at.desc())
        .all()
    )
    entries = [
        {**n.to_entry_dict(), "source_type": "note", "application_id": None, "application_name": None}
        for n in notes
    ]

    app_ids = {l.application_id for l in p.app_links}
    apps = Application.query.filter(Application.id.in_(app_ids)).all() if app_ids else []
    for a in apps:
        for e in fetch_app_journal_entries(a, project_id):
            entries.append({**e, "source_type": "app", "application_id": a.id, "application_name": a.name})

    entries.sort(key=lambda e: e["timestamp"], reverse=True)
    return jsonify({"entries": entries})


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
    if "team_notes" in body:
        p.team_notes = body["team_notes"] or None
    if "channels" in body:
        p.channel_list = body["channels"] or None
    if "team_topology" in body:
        tt = body["team_topology"] or None
        if tt is not None and tt not in TEAM_TYPES:
            return jsonify({"error": f"team_topology must be one of {TEAM_TYPES} or null"}), 400
        p.team_topology = tt
    if "has_manufacturing" in body:
        p.has_manufacturing = body["has_manufacturing"]

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


@bp.post("/<project_id>/members")
def add_member(project_id):
    p = Project.query.get_or_404(project_id)
    body = request.get_json(force=True) or {}
    person_id = body.get("person_id")
    if not person_id:
        return jsonify({"error": "person_id is required"}), 400

    person = Person.query.get(person_id)
    if not person:
        return jsonify({"error": "person not found"}), 404
    if person.is_admin:
        # The admin persona is the "see everything" seat, not a real member of any one project
        # — see people.py's own comment on this. Adding a membership row for it would just be
        # confusing (a role_label / can_manage_members that never means anything).
        return jsonify({"error": "the admin persona is not a real project member"}), 400
    if ProjectMembership.query.filter_by(project_id=p.id, person_id=person_id).first():
        return jsonify({"error": "this person is already a member of this project"}), 409

    m = ProjectMembership(
        project_id=p.id,
        person_id=person_id,
        role_label=(body.get("role_label") or "").strip() or None,
        can_manage_members=bool(body.get("can_manage_members", False)),
    )
    db.session.add(m)
    db.session.commit()
    return jsonify(m.to_dict()), 201


@memberships_bp.put("/<membership_id>")
def update_membership(membership_id):
    m = ProjectMembership.query.get_or_404(membership_id)
    body = request.get_json(force=True) or {}
    if "role_label" in body:
        m.role_label = (body["role_label"] or "").strip() or None
    if "can_manage_members" in body:
        m.can_manage_members = bool(body["can_manage_members"])
    db.session.commit()
    return jsonify(m.to_dict())


@memberships_bp.delete("/<membership_id>")
def delete_membership(membership_id):
    m = ProjectMembership.query.get_or_404(membership_id)
    db.session.delete(m)
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

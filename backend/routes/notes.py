"""
The Depot's own manually-authored journal entries — see models.JournalNote. A person types a
note about a project directly here; it merges into that project's Journal section (and the
Launchpad's cross-project panel) exactly like a federated per-app entry, just with no app behind
it.
"""

from flask import Blueprint, jsonify, request

from db import db
from models import JournalNote, Project

bp = Blueprint("notes", __name__, url_prefix="/api/projects")


@bp.get("/<project_id>/notes")
def list_notes(project_id):
    Project.query.get_or_404(project_id)
    notes = (
        JournalNote.query.filter_by(project_id=project_id)
        .order_by(JournalNote.created_at.desc())
        .all()
    )
    return jsonify({"entries": [n.to_entry_dict() for n in notes]})


@bp.post("/<project_id>/notes")
def create_note(project_id):
    Project.query.get_or_404(project_id)
    body = request.get_json(force=True) or {}
    text = (body.get("body") or "").strip()
    if not text:
        return jsonify({"error": "body is required"}), 400

    note = JournalNote(project_id=project_id, person_id=body.get("person_id"), body=text)
    db.session.add(note)
    db.session.commit()
    return jsonify(note.to_entry_dict()), 201

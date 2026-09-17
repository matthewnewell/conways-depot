"""
The Depot's own manually-authored journal entries — see models.JournalNote. A person types a
note about a project directly here; it merges into that project's Journal section (and the
Launchpad's cross-project panel) exactly like a federated per-app entry, just with no app behind
it.

A second, parallel resource lives here too: a person's own project-less notes
(/api/people/<id>/notes). Same model, same to_entry_dict() shape — the only difference is
project_id is always None on these rows, and the list is filtered by person_id instead of
project_id. This is the embeddable Journal widget's "My day" feed (see routes/embed.py) — the
common-interface piece the project-scoped notes above were always missing: nowhere to log
something that isn't about any one project yet.
"""

from flask import Blueprint, jsonify, request

from db import db
from models import JournalNote, Person, Project

bp = Blueprint("notes", __name__, url_prefix="/api/projects")
people_notes_bp = Blueprint("people_notes", __name__, url_prefix="/api/people")


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


@people_notes_bp.get("/<person_id>/notes")
def list_personal_notes(person_id):
    """A person's own project-less notes — filtered to this person only. Not access control
    (nothing in this app is, see models.Person's docstring) — just the one place a personal
    note is ever queried, the same discipline Task Master's own per-person board relies on."""
    Person.query.get_or_404(person_id)
    notes = (
        JournalNote.query.filter_by(person_id=person_id, project_id=None)
        .order_by(JournalNote.created_at.desc())
        .all()
    )
    return jsonify({"entries": [n.to_entry_dict() for n in notes]})


@people_notes_bp.post("/<person_id>/notes")
def create_personal_note(person_id):
    Person.query.get_or_404(person_id)
    body = request.get_json(force=True) or {}
    text = (body.get("body") or "").strip()
    if not text:
        return jsonify({"error": "body is required"}), 400

    note = JournalNote(project_id=None, person_id=person_id, body=text)
    db.session.add(note)
    db.session.commit()
    return jsonify(note.to_entry_dict()), 201

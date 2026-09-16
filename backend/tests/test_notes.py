"""Route-level tests for JournalNote (routes/notes.py) — a real DB (in-memory SQLite) and Flask
test client, isolated from app.py's dev DB, same pattern as test_phase_events.py."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from flask import Flask

from db import db
from routes.notes import bp as notes_bp
from routes.people import bp as people_bp
from routes.projects import bp as projects_bp


@pytest.fixture
def client():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["TESTING"] = True
    db.init_app(app)
    app.register_blueprint(projects_bp)
    app.register_blueprint(people_bp)
    app.register_blueprint(notes_bp)
    with app.app_context():
        db.create_all()
    with app.test_client() as c:
        yield c


def _make_project(client):
    return client.post("/api/projects", json={"name": "Test Co", "phase": "pursuit"}).get_json()["id"]


def test_body_is_required(client):
    project_id = _make_project(client)
    res = client.post(f"/api/projects/{project_id}/notes", json={"body": "  "})
    assert res.status_code == 400


def test_create_and_list_a_note(client):
    project_id = _make_project(client)
    res = client.post(f"/api/projects/{project_id}/notes", json={"body": "Kickoff went well."})
    assert res.status_code == 201
    entry = res.get_json()
    assert entry["summary"] == "Kickoff went well."
    assert entry["author"] is None  # no person_id supplied
    assert entry["href"] == f"/projects/{project_id}"

    listed = client.get(f"/api/projects/{project_id}/notes").get_json()
    assert len(listed["entries"]) == 1
    assert listed["entries"][0]["summary"] == "Kickoff went well."


def test_note_carries_the_author_name_when_a_real_person_id_is_given(client):
    from models import Person

    with client.application.app_context():
        person = Person(name="Sam Ortiz")
        db.session.add(person)
        db.session.commit()
        person_id = person.id

    project_id = _make_project(client)
    res = client.post(
        f"/api/projects/{project_id}/notes",
        json={"body": "Called the supplier.", "person_id": person_id},
    )
    assert res.status_code == 201
    assert res.get_json()["author"] == "Sam Ortiz"


def test_notes_scoped_to_the_right_project(client):
    p1 = _make_project(client)
    p2 = _make_project(client)
    client.post(f"/api/projects/{p1}/notes", json={"body": "About project one."})

    assert len(client.get(f"/api/projects/{p1}/notes").get_json()["entries"]) == 1
    assert len(client.get(f"/api/projects/{p2}/notes").get_json()["entries"]) == 0

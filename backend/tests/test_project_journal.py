"""Route-level tests for the project-wide journal merge endpoint (routes/projects.py's
GET /<project_id>/journal) — same in-memory-SQLite + Flask-test-client pattern as test_notes.py.
No real sibling app is running in this test, so app-sourced entries always come back empty
(fetch_app_journal_entries hits a real network call and fails closed) — these tests only cover
the manual-notes half plus the tagging shape, not a live federated fetch (that's proven by hand
against the real dev server, not worth a mocked-httpx test here)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from flask import Flask

from db import db
from routes.applications import bp as applications_bp, capabilities_bp
from routes.notes import bp as notes_bp
from routes.projects import bp as projects_bp


@pytest.fixture
def client():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["TESTING"] = True
    db.init_app(app)
    app.register_blueprint(projects_bp)
    app.register_blueprint(applications_bp)
    app.register_blueprint(capabilities_bp)
    app.register_blueprint(notes_bp)
    with app.app_context():
        db.create_all()
    with app.test_client() as c:
        yield c


def _make_project(client):
    return client.post("/api/projects", json={"name": "Test Co", "phase": "pursuit"}).get_json()["id"]


def test_manual_notes_come_back_tagged_as_notes(client):
    project_id = _make_project(client)
    client.post(f"/api/projects/{project_id}/notes", json={"body": "Kickoff went well."})

    entries = client.get(f"/api/projects/{project_id}/journal").get_json()["entries"]
    assert len(entries) == 1
    assert entries[0]["source_type"] == "note"
    assert entries[0]["application_id"] is None
    assert entries[0]["summary"] == "Kickoff went well."


def test_journal_sorted_newest_first(client):
    project_id = _make_project(client)
    client.post(f"/api/projects/{project_id}/notes", json={"body": "First."})
    client.post(f"/api/projects/{project_id}/notes", json={"body": "Second."})

    entries = client.get(f"/api/projects/{project_id}/journal").get_json()["entries"]
    assert [e["summary"] for e in entries] == ["Second.", "First."]


def test_journal_scoped_to_the_right_project(client):
    p1 = _make_project(client)
    p2 = _make_project(client)
    client.post(f"/api/projects/{p1}/notes", json={"body": "About project one."})

    assert len(client.get(f"/api/projects/{p1}/journal").get_json()["entries"]) == 1
    assert len(client.get(f"/api/projects/{p2}/journal").get_json()["entries"]) == 0


def test_journal_404s_on_an_unknown_project(client):
    res = client.get("/api/projects/does-not-exist/journal")
    assert res.status_code == 404

"""Route-level tests for phase-transition logging (routes/projects.py) — a real DB (in-memory
SQLite) and Flask test client, isolated from app.py's dev DB and seed data, so these never
touch the real local database. This is the behavior that makes `Project.phase` a genuine
lifecycle state rather than a decorative label: every change is appended to phase_events,
never overwritten in place."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from flask import Flask

from db import db
from routes.projects import bp as projects_bp, external_ids_bp, links_bp


@pytest.fixture
def client():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["TESTING"] = True
    db.init_app(app)
    app.register_blueprint(projects_bp)
    app.register_blueprint(external_ids_bp)
    app.register_blueprint(links_bp)
    with app.app_context():
        db.create_all()
    with app.test_client() as c:
        yield c


def test_creating_a_project_logs_the_initial_phase_event(client):
    resp = client.post("/api/projects", json={"name": "Test Co", "phase": "pursuit"})
    assert resp.status_code == 201
    body = resp.get_json()
    assert len(body["phase_events"]) == 1
    assert body["phase_events"][0]["from_phase"] is None
    assert body["phase_events"][0]["to_phase"] == "pursuit"


def test_changing_phase_appends_a_transition_event(client):
    created = client.post("/api/projects", json={"name": "Test Co"}).get_json()
    pid = created["id"]

    resp = client.put(f"/api/projects/{pid}", json={"phase": "award"})
    assert resp.status_code == 200
    body = resp.get_json()
    assert len(body["phase_events"]) == 2
    assert body["phase_events"][1]["from_phase"] == "pursuit"
    assert body["phase_events"][1]["to_phase"] == "award"


def test_setting_phase_to_its_current_value_does_not_duplicate_an_event(client):
    created = client.post("/api/projects", json={"name": "Test Co", "phase": "execution"}).get_json()
    pid = created["id"]

    resp = client.put(f"/api/projects/{pid}", json={"phase": "execution"})
    assert resp.status_code == 200
    body = resp.get_json()
    assert len(body["phase_events"]) == 1  # no new event logged


def test_invalid_phase_is_rejected_and_does_not_partially_update(client):
    created = client.post("/api/projects", json={"name": "Test Co"}).get_json()
    pid = created["id"]

    resp = client.put(f"/api/projects/{pid}", json={"phase": "bogus"})
    assert resp.status_code == 400

    refetched = client.get(f"/api/projects/{pid}").get_json()
    assert refetched["phase"] == "pursuit"
    assert len(refetched["phase_events"]) == 1


def test_phase_events_are_ordered_oldest_first(client):
    created = client.post("/api/projects", json={"name": "Test Co"}).get_json()
    pid = created["id"]
    client.put(f"/api/projects/{pid}", json={"phase": "award"})
    client.put(f"/api/projects/{pid}", json={"phase": "execution"})

    body = client.get(f"/api/projects/{pid}").get_json()
    to_phases = [e["to_phase"] for e in body["phase_events"]]
    assert to_phases == ["pursuit", "award", "execution"]

"""Route-level tests for the one write action routes/ai.py's chat() can now take — triggering
Task Master's own /api/tasks/suggest. ai_client.chat_json and httpx.post are both mocked; the
point here is the routing/response logic, not a real AI call or a real Task Master."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
import pytest
from flask import Flask

import ai_client
from db import db
from routes.ai import bp as ai_bp


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(ai_client, "is_configured", lambda: True)
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["TESTING"] = True
    db.init_app(app)
    app.register_blueprint(ai_bp)
    with app.app_context():
        db.create_all()
    with app.test_client() as c:
        yield c


def test_no_action_leaves_task_master_untouched(client, monkeypatch):
    monkeypatch.setattr(
        ai_client, "chat_json",
        lambda messages, system, max_tokens=1024: {"reply": "Value Stream fits that.", "action": None},
    )
    called = []
    monkeypatch.setattr(httpx, "post", lambda *a, **k: called.append(1))

    res = client.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}], "person_id": "p1"})
    assert res.status_code == 200
    body = res.get_json()
    assert body["reply"] == "Value Stream fits that."
    assert body["action_taken"] is False
    assert called == []


def test_action_with_a_person_id_triggers_task_master_and_reports_the_real_count(client, monkeypatch):
    monkeypatch.setattr(
        ai_client, "chat_json",
        lambda messages, system, max_tokens=1024: {
            "reply": "On it — reviewing your projects.",
            "action": "suggest_task_master_backlog",
        },
    )

    def fake_post(url, json, timeout):
        assert "/api/tasks/suggest" in url
        assert json == {"person_id": "p1"}
        return httpx.Response(
            201,
            json=[{"id": "t1", "title": "Follow up on supplier"}, {"id": "t2", "title": "Review gate slip"}],
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx, "post", fake_post)

    res = client.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}], "person_id": "p1"})
    assert res.status_code == 200
    body = res.get_json()
    assert body["action_taken"] is True
    assert "On it" in body["reply"]
    assert "added 2 suggested card" in body["reply"]
    assert "Follow up on supplier" in body["reply"]


def test_action_with_no_person_id_does_not_call_task_master(client, monkeypatch):
    monkeypatch.setattr(
        ai_client, "chat_json",
        lambda messages, system, max_tokens=1024: {
            "reply": "On it.",
            "action": "suggest_task_master_backlog",
        },
    )
    called = []
    monkeypatch.setattr(httpx, "post", lambda *a, **k: called.append(1))

    res = client.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert res.status_code == 200
    body = res.get_json()
    assert body["action_taken"] is False
    assert "no persona is active" in body["reply"]
    assert called == []


def test_task_master_error_is_reported_plainly(client, monkeypatch):
    monkeypatch.setattr(
        ai_client, "chat_json",
        lambda messages, system, max_tokens=1024: {"reply": "On it.", "action": "suggest_task_master_backlog"},
    )

    def fake_post(url, json, timeout):
        return httpx.Response(200, json={"error": "AI is not configured for this instance."}, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)

    res = client.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}], "person_id": "p1"})
    body = res.get_json()
    assert body["action_taken"] is True
    assert "couldn't generate suggestions" in body["reply"]

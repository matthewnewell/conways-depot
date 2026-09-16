"""Route-level tests for the server-to-server AI proxy (routes/ai_proxy.py) — a real Flask test
client, no DB needed (the route touches no models). AI isn't configured in the test environment
either, same as production-without-a-key, so these exercise the "not configured" path — the one
every sibling app's own ai_client.py needs to see propagate cleanly through the proxy."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask

import ai_client
from routes.ai_proxy import bp as ai_proxy_bp


def _client():
    app = Flask(__name__)
    app.config["TESTING"] = True
    app.register_blueprint(ai_proxy_bp)
    return app.test_client()


def test_returns_not_configured_when_ai_is_off(monkeypatch):
    monkeypatch.setattr(ai_client, "AI_PROVIDER", "none")
    res = _client().post("/api/ai/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert res.status_code == 200
    body = res.get_json()
    assert body["error"] == ai_client.NOT_CONFIGURED_MESSAGE


def test_messages_is_required(monkeypatch):
    monkeypatch.setattr(ai_client, "AI_PROVIDER", "claude")
    res = _client().post("/api/ai/chat", json={})
    assert res.status_code == 400


def test_forwards_to_ai_client_chat_and_returns_its_reply(monkeypatch):
    monkeypatch.setattr(ai_client, "AI_PROVIDER", "claude")
    seen = {}

    def fake_chat(messages, system="", max_tokens=1024):
        seen["messages"] = messages
        seen["system"] = system
        seen["max_tokens"] = max_tokens
        return "a reply"

    monkeypatch.setattr(ai_client, "chat", fake_chat)
    res = _client().post(
        "/api/ai/chat",
        json={"messages": [{"role": "user", "content": "hi"}], "system": "be nice", "max_tokens": 500},
    )
    assert res.status_code == 200
    assert res.get_json() == {"reply": "a reply"}
    assert seen == {
        "messages": [{"role": "user", "content": "hi"}],
        "system": "be nice",
        "max_tokens": 500,
    }

"""
Server-to-server AI proxy for every sibling app. Any app's own ai_client.py can set
AI_PROVIDER=depot to route chat()/chat_json() through here instead of talking to Claude/Gemini/
Ollama directly — so only this Depot needs real credentials (AI_API_KEY etc.) configured in
production, instead of one API key per app. One raw primitive proxied (chat()) — every app's
chat_json() is already built on top of its own chat() (the JSON-instruction wrapping and
parsing happen in pure Python, nothing provider-specific), so it works for free once chat()
does; there's nothing to proxy twice.

Same reason every other cross-app call in this ecosystem is server-to-server: no CORS setup
needed across a dozen separate origins, and it's exactly the "narrow apps, no shared runtime
dependency" shape this whole registry already runs on — an app that never sets AI_PROVIDER=depot
is completely unaffected by this route existing.
"""

from flask import Blueprint, jsonify, request

import ai_client

bp = Blueprint("ai_proxy", __name__, url_prefix="/api/ai")


@bp.post("/chat")
def proxy_chat():
    """Same {reply} / {error} shape ai_client.chat() already returns in-process everywhere —
    a calling app's own chat() just forwards whatever comes back, so nothing on the caller's
    side needs to know this crossed a network boundary."""
    if not ai_client.is_configured():
        return jsonify({"error": ai_client.NOT_CONFIGURED_MESSAGE}), 200

    body = request.get_json(force=True) or {}
    messages = body.get("messages") or []
    if not messages:
        return jsonify({"error": "messages is required"}), 400

    system = body.get("system") or ""
    max_tokens = body.get("max_tokens") or 1024
    reply = ai_client.chat(messages, system=system, max_tokens=max_tokens)
    return jsonify({"reply": reply})

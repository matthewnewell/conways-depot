"""
Chat assist — same shape as Value Stream's: stateless (the frontend owns history, resending it
each call), context rebuilt fresh from the database every time so an edit mid-conversation shows
up in the next reply without restarting the chat.

The "insight" here is never AI-invented: every Conway/reverse-Conway/capability-gap signal below
is a plain, deterministic computation over the registry (a team owning N apps, a capability with
no built application). The AI's job is to explain and prioritize what the registry already
proves, not to guess at facts it wasn't given.
"""

from collections import defaultdict

from flask import Blueprint, jsonify, request

import ai_client
from models import PHASES, Application, Capability, Project

bp = Blueprint("ai", __name__, url_prefix="/api")

SYSTEM_PROMPT = """You are the assistant embedded in Conway's Depot, a registry (not a
platform) that tracks three things: Projects (each with a single persistent id — its "digital
thread" — carried from Pursuit through Closeout), Applications (a catalog of domain apps,
each either built, planned, or an external vendor product), and Capabilities (the stable
business need an application fulfills, independent of which application currently fulfills
it — the same split TOGAF's Business Capability Map makes).

Ground every answer in Conway's Law, the reverse Conway maneuver, and Team Topologies'
vocabulary (stream-aligned / platform / enabling / complicated-subsystem team types) where
relevant. Two structural signals below are the actual point of this tool — call them out when
they're present, don't invent others:
  - a Capability with no "built" Application against it (a real gap, not yet closed)
  - one team's name attached to an unusually large share of registered Applications (a
    possible Conway's-Law overload signal worth someone's attention)

Never invent data not present in the context below. If something isn't tracked yet, say so
plainly rather than guessing. Keep answers grounded, specific, and skeptical of over-claiming —
this tool exists to be a credible, minimal foundation, not a sales pitch."""


def _capability_gap_lines(capabilities: list[Capability], applications: list[Application]) -> list[str]:
    apps_by_cap: dict[str | None, list[Application]] = defaultdict(list)
    for a in applications:
        apps_by_cap[a.capability_id].append(a)

    lines = []
    for cap in capabilities:
        apps = apps_by_cap.get(cap.id, [])
        built = [a for a in apps if a.status == "built"]
        if built:
            lines.append(f"  - \"{cap.name}\": fulfilled by {', '.join(a.name for a in built)}.")
        else:
            others = ", ".join(f"{a.name} ({a.status})" for a in apps) or "nothing registered"
            lines.append(f"  - GAP — \"{cap.name}\": no built application yet ({others}).")
    return lines


def _team_load_lines(applications: list[Application]) -> list[str]:
    by_team: dict[str, list[Application]] = defaultdict(list)
    for a in applications:
        if a.owning_team:
            by_team[a.owning_team].append(a)

    lines = []
    for team, apps in by_team.items():
        if len(apps) >= 2:
            lines.append(
                f"  - Conway signal: \"{team}\" owns {len(apps)} registered applications "
                f"({', '.join(a.name for a in apps)})."
            )
    return lines or ["  - No team currently owns more than one registered application."]


def _build_portfolio_context() -> str:
    projects = Project.query.all()
    applications = Application.query.all()
    capabilities = Capability.query.all()

    lines = ["=== Portfolio-wide context (no specific project selected) ==="]
    lines.append(f"{len(projects)} project(s) registered:")
    for p in projects:
        lines.append(f"  - {p.name} ({p.customer or 'no customer'}) — phase: {p.phase}")

    lines.append("\nCapability coverage:")
    lines.extend(_capability_gap_lines(capabilities, applications))

    lines.append("\nTeam ownership load:")
    lines.extend(_team_load_lines(applications))

    return "\n".join(lines)


def _build_project_context(project: Project) -> str:
    lines = [
        "=== Project context ===",
        f"Name: {project.name}",
        f"Customer: {project.customer or 'none on file'}",
        f"Current phase: {project.phase}",
    ]
    if project.description:
        lines.append(f"Description: {project.description}")

    if project.external_ids:
        lines.append("External system IDs (crosswalk):")
        for e in project.external_ids:
            lines.append(f"  - {e.system}: {e.external_id}")
    else:
        lines.append("No external system IDs recorded yet.")

    if project.app_links:
        lines.append("Applications linked, by phase:")
        for phase in PHASES:
            phase_links = [l for l in project.app_links if l.phase == phase]
            if not phase_links:
                continue
            names = ", ".join(l.application.name for l in phase_links if l.application)
            lines.append(f"  - {phase}: {names}")
    else:
        lines.append("No applications linked to this project yet.")

    return "\n".join(lines)


@bp.post("/chat")
def chat():
    if not ai_client.is_configured():
        return jsonify({"reply": "", "error": ai_client.NOT_CONFIGURED_MESSAGE})

    body = request.get_json(force=True) or {}
    messages = body.get("messages") or []
    if not messages:
        return jsonify({"error": "messages is required"}), 400

    project_id = body.get("project_id")
    if project_id:
        project = Project.query.get(project_id)
        context = _build_project_context(project) if project else _build_portfolio_context()
    else:
        context = _build_portfolio_context()

    system = SYSTEM_PROMPT + "\n\n" + context
    reply = ai_client.chat(messages, system=system, max_tokens=1024)
    return jsonify({"reply": reply})

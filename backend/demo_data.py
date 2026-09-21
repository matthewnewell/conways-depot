"""
The demo story: six personas (one per role a real program touches), the projects they work, and
just enough history — journal notes, links, phase history — that every screen has something worth
showing. Everything has a FIXED id so sibling apps' own seeds (Task Master's cards, MARTI's
materials) can point at it and still line up on a fresh clone.

`apply_demo_data()` is idempotent: it upserts by id and, for the demo personas only, replaces
their memberships / pins / hidden apps with the sets below. Run automatically on an empty
database (seed.seed_people_if_empty) and by hand against a live one (backend/refresh_demo.py).
It never touches personas or projects outside this file (e.g. a project someone made by hand).
"""

from datetime import datetime, timedelta, timezone

from db import db
from models import (
    Application,
    ExternalId,
    HiddenOrgApp,
    JournalNote,
    Person,
    Pin,
    PinOrder,
    Portfolio,
    Project,
    ProjectAppLink,
    ProjectMembership,
    ProjectPhaseEvent,
)

# ── fixed ids ─────────────────────────────────────────────────────────────────────────────────
# People
ADMIN_ID = "a3bddc29-f614-467a-ac59-6ca66ddd60d2"
SAM_ID = "e4801aaa-c33c-45e1-aec1-77e8600b5186"  # Program Manager
ALEX_ID = "b97db3f6-5cef-43a0-8db0-80d87ec01b2a"  # Engineering Functional Manager
PRIYA_ID = "5b0e3f0a-6c1d-4a52-9d0e-7d2a1c8b4f11"  # Mission Assurance
MARCUS_ID = "8c2d7e14-3f5a-4b96-a1c7-92e5b6d0a3c2"  # Portfolio Manager
JESS_ID = "c96051dc-b435-476f-8600-2283a6039df4"  # Business Development

# Portfolios
INDUSTRIAL_PORTFOLIO_ID = "9b8d3480-2052-439d-9a24-3f90c824c31a"
DEFENSE_PORTFOLIO_ID = "3b6a9c02-7e15-4d84-a0f9-1c5e8b7d2a36"

# Projects
BRACKET_ID = "ff5bfe0b-7b18-4337-a464-6517c6f6c13b"
NACELLE_ID = "35fe3413-20e9-4762-8828-029ecade70c2"
RIVERSIDE_ID = "fee0a151-fc90-42d1-ac74-49525d7d9d8d"
RADAR_ID = "2a9c5e71-84d3-4f0b-b6a2-c13e7d9f5a08"
AVIONICS_ID = "6f1b8d23-0a4e-47c5-8e93-5b7c2a1d9e64"
COASTAL_ID = "d4e7a1b9-5c28-4360-9f1a-e83b0c6d72f5"


def _days_ago(n: float) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=n)


# ── people ────────────────────────────────────────────────────────────────────────────────────
# id -> (name, title, is_admin)
PEOPLE = {
    ADMIN_ID: ("Admin", "Administrator", True),
    SAM_ID: ("Sam Ortiz", "Program Manager", False),
    ALEX_ID: ("Alex Chen", "Engineering Functional Manager", False),
    PRIYA_ID: ("Priya Nair", "Mission Assurance Manager", False),
    MARCUS_ID: ("Marcus Webb", "Portfolio Manager", False),
    JESS_ID: ("Jess Kim", "Business Development Lead", False),
}

# person -> [(project id, role label, can_manage_members)]
MEMBERSHIPS = {
    SAM_ID: [
        (BRACKET_ID, "Program Manager", True),
        (NACELLE_ID, "Program Manager", True),
        (RADAR_ID, "Program Manager", True),
    ],
    ALEX_ID: [
        (BRACKET_ID, "Engineering Functional Manager", False),
        (NACELLE_ID, "Engineering Functional Manager", False),
        (RADAR_ID, "Engineering Functional Manager", False),
    ],
    PRIYA_ID: [
        (BRACKET_ID, "Mission Assurance", False),
        (NACELLE_ID, "Mission Assurance", False),
        (RADAR_ID, "Mission Assurance", False),
        (AVIONICS_ID, "Mission Assurance", False),
    ],
    MARCUS_ID: [
        (BRACKET_ID, "Portfolio Manager", True),
        (NACELLE_ID, "Portfolio Manager", True),
        (RADAR_ID, "Portfolio Manager", True),
        (AVIONICS_ID, "Portfolio Manager", True),
        (RIVERSIDE_ID, "Portfolio Manager", True),
        (COASTAL_ID, "Portfolio Manager", True),
    ],
    JESS_ID: [
        (RIVERSIDE_ID, "Capture Manager", True),
        (COASTAL_ID, "Capture Manager", True),
        (BRACKET_ID, "Capture Lead (handoff)", False),
    ],
}

# Organizational-scope apps are on for everyone by default; a role's launchpad is shaped by what
# it HIDES. Project-scope apps are shaped by what it PINS (in this order).
_ORG_APPS = [
    "Aaron's Meadow", "Contract & Legal Authoring", "Labor Supply & Demand", "Let's Have a Meeting",
    "Org Charts", "Portfolio Manager", "QMS", "Scan Me", "Task Master",
]
_VISIBLE_ORG = {
    ADMIN_ID: set(_ORG_APPS),
    SAM_ID: {"Task Master", "Let's Have a Meeting", "Labor Supply & Demand"},
    ALEX_ID: {"Labor Supply & Demand", "Org Charts", "Task Master", "Let's Have a Meeting", "Aaron's Meadow"},
    PRIYA_ID: {"QMS", "Scan Me", "Task Master", "Let's Have a Meeting"},
    MARCUS_ID: {"Portfolio Manager", "Labor Supply & Demand", "Org Charts", "Task Master", "Let's Have a Meeting"},
    JESS_ID: {"Contract & Legal Authoring", "Task Master", "Let's Have a Meeting", "Org Charts"},
}
PINS = {
    ADMIN_ID: ["Good Plan", "Value Stream", "WinMax"],
    SAM_ID: ["Good Plan", "Value Stream", "MARTI", "Scope Manager", "Reckon"],
    ALEX_ID: ["Good Plan", "Value Stream", "The Fixer"],
    PRIYA_ID: ["The Fixer", "MARTI", "Value Stream", "Scope Manager"],
    MARCUS_ID: ["Good Plan", "Value Stream", "MARTI", "WinMax", "Reckon"],
    JESS_ID: ["WinMax", "Scope Manager", "Good Plan", "Reckon"],
}

# ── portfolios & projects ─────────────────────────────────────────────────────────────────────
PORTFOLIOS = {
    INDUSTRIAL_PORTFOLIO_ID: dict(
        name="Industrial Programs",
        description="Manufacturing and industrial-facility work across customers.",
        channels=[
            {"label": "Industrial Programs Portal", "url": "https://contoso.sharepoint.com/sites/industrial-programs", "kind": "sharepoint"},
            {"label": "Leadership Team", "url": "https://teams.microsoft.com/l/team/industrial-programs-leadership", "kind": "teams"},
        ],
    ),
    DEFENSE_PORTFOLIO_ID: dict(
        name="Defense Systems",
        description="Defense production, sustainment and recompete work.",
        channels=[
            {"label": "Defense Systems Portal", "url": "https://contoso.sharepoint.com/sites/defense-systems", "kind": "sharepoint"},
            {"label": "Leadership Team", "url": "https://teams.microsoft.com/l/team/defense-systems-leadership", "kind": "teams"},
        ],
    ),
}

# Fields set only when the project is CREATED (an existing project keeps its own description etc.)
NEW_PROJECTS = {
    RADAR_ID: dict(
        name="Radar Housing Production",
        customer="Northgate Defense",
        phase="execution",
        portfolio_id=DEFENSE_PORTFOLIO_ID,
        team_topology="stream-aligned",
        has_manufacturing=True,
        description=(
            "Low-rate initial production of 48 machined radar housings with first-article "
            "inspection gates. Machining capacity and a slipped titanium forging drive the schedule."
        ),
        history=[(None, "pursuit", 150), ("pursuit", "award", 120), ("award", "execution", 95)],
    ),
    NACELLE_ID: dict(
        name="Nacelle Fairing Retrofit",
        customer="Skyline Aviation",
        phase="execution",
        portfolio_id=INDUSTRIAL_PORTFOLIO_ID,
        has_manufacturing=True,
        description=(
            "Retrofit of composite nacelle fairings across a regional fleet. Lay-up quality and "
            "technician capacity are the watch items."
        ),
        history=[(None, "pursuit", 110), ("pursuit", "award", 85), ("award", "execution", 60)],
    ),
    AVIONICS_ID: dict(
        name="Avionics Bay Closeout",
        customer="Meridian Air",
        phase="closeout",
        portfolio_id=DEFENSE_PORTFOLIO_ID,
        team_topology="enabling",
        has_manufacturing=True,
        description="Final deliveries accepted; lessons learned and contract closeout in progress.",
        history=[(None, "pursuit", 400), ("pursuit", "award", 370), ("award", "execution", 340), ("execution", "closeout", 35)],
    ),
    COASTAL_ID: dict(
        name="Prospect: Coastal Patrol Recompete",
        customer="Harborline Maritime Authority",
        phase="pursuit",
        portfolio_id=DEFENSE_PORTFOLIO_ID,
        description=(
            "Recompete of a maritime patrol sensor-integration contract. Bid/no-bid decision "
            "is due in three weeks."
        ),
        history=[(None, "pursuit", 14)],
    ),
}

# Applied to every demo project, new or existing: (portfolio, S4 id, jumpstation links)
PROJECT_FACTS = {
    BRACKET_ID: dict(
        contract_url="https://contoso.sharepoint.com/sites/contracts/Shared%20Documents/ACM-2026-0142.pdf",
        portfolio_id=INDUSTRIAL_PORTFOLIO_ID,
        s4="P-100234",
        channels=[
            {"label": "Program Team", "url": "https://teams.microsoft.com/l/channel/bracket-program-team", "kind": "teams"},
            {"label": "Program Library", "url": "https://contoso.sharepoint.com/sites/bracket-assembly", "kind": "sharepoint"},
            {"label": "Engineering Backlog", "url": "https://dev.azure.com/contoso/Bracket-Assembly/_boards", "kind": "azure-devops"},
        ],
    ),
    NACELLE_ID: dict(
        contract_url="https://contoso.sharepoint.com/sites/contracts/Shared%20Documents/SKY-2026-0087.pdf",
        portfolio_id=INDUSTRIAL_PORTFOLIO_ID,
        s4="P-100310",
        channels=[
            {"label": "Retrofit Team", "url": "https://teams.microsoft.com/l/channel/nacelle-retrofit", "kind": "teams"},
            {"label": "Retrofit Library", "url": "https://contoso.sharepoint.com/sites/nacelle-retrofit", "kind": "sharepoint"},
        ],
    ),
    RIVERSIDE_ID: dict(
        portfolio_id=INDUSTRIAL_PORTFOLIO_ID,
        channels=[
            {"label": "Capture Team", "url": "https://teams.microsoft.com/l/channel/riverside-capture", "kind": "teams"},
        ],
    ),
    RADAR_ID: dict(
        contract_url="https://contoso.sharepoint.com/sites/contracts/Shared%20Documents/NGD-2026-0311.pdf",
        s4="P-100455",
        channels=[
            {"label": "Production Team", "url": "https://teams.microsoft.com/l/channel/radar-housing", "kind": "teams"},
            {"label": "Production Library", "url": "https://contoso.sharepoint.com/sites/radar-housing", "kind": "sharepoint"},
            {"label": "Work Instructions", "url": "https://dev.azure.com/contoso/Radar-Housing/_wiki", "kind": "azure-devops"},
        ],
    ),
    AVIONICS_ID: dict(
        contract_url="https://contoso.sharepoint.com/sites/contracts/Shared%20Documents/MER-2025-0219.pdf",
        s4="P-099871",
        channels=[
            {"label": "Closeout Binder", "url": "https://contoso.sharepoint.com/sites/avionics-closeout", "kind": "sharepoint"},
        ],
    ),
    COASTAL_ID: dict(
        winmax="OPP-9377",
        channels=[
            {"label": "Recompete Capture Team", "url": "https://teams.microsoft.com/l/channel/coastal-recompete", "kind": "teams"},
            {"label": "Proposal Workspace", "url": "https://contoso.sharepoint.com/sites/coastal-proposal", "kind": "sharepoint"},
        ],
    ),
}

# (project id, application name, phase, note)  — created only if the pair isn't linked yet
APP_LINKS = [
    (BRACKET_ID, "Task Master", "execution", "Program task board."),
    (BRACKET_ID, "The Fixer", "execution", "Root cause and corrective action for the program."),
    (NACELLE_ID, "Task Master", "execution", "Program task board."),
    (NACELLE_ID, "MARTI", "execution", "Material, acquisition, routing and Tradeoffs for the retrofit kits."),
    (NACELLE_ID, "The Fixer", "execution", "Root cause on the fairing lay-up nonconformances."),
    (RADAR_ID, "Task Master", "execution", "Production task board."),
    (RADAR_ID, "MARTI", "execution", "Titanium forging, machining routings and the first-article gate."),
    (RADAR_ID, "Good Plan", "execution", "Machining labor plan across the build."),
    (RADAR_ID, "The Fixer", "execution", "Nonconformance and corrective action."),
    (AVIONICS_ID, "The Fixer", "closeout", "Closed corrective actions, kept for the record."),
    (BRACKET_ID, "Labor Supply & Demand", "execution", "Who is named to the labor this project asked for."),
    (NACELLE_ID, "Labor Supply & Demand", "execution", "Who is named to the labor this project asked for."),
    (RADAR_ID, "Labor Supply & Demand", "execution", "Who is named to the labor this project asked for."),
    (COASTAL_ID, "Labor Supply & Demand", "pursuit", "Pipeline demand — not staffed until the bid is won."),
    (COASTAL_ID, "WinMax", "pursuit", "Recompete capture — bid/no-bid pending."),
    (COASTAL_ID, "Scope Manager", "pursuit", "Statement-of-work scope for the proposal."),
]

# (project id, author, days ago, text)
NOTES = [
    (BRACKET_ID, SAM_ID, 12, "Kickoff with Acme complete. Baseline schedule agreed; the long-lead casting order is the critical path."),
    (BRACKET_ID, PRIYA_ID, 9, "First-article inspection plan approved by Acme QA. The bracket hole pattern is the key characteristic (KC-1)."),
    (BRACKET_ID, ALEX_ID, 6, "Design bottleneck traced to two open ECOs. Reallocating one stress engineer for two weeks."),
    (BRACKET_ID, MARCUS_ID, 3, "Portfolio review: Bracket is on track for the August milestone. Watching the casting supplier."),
    (BRACKET_ID, SAM_ID, 1, "Casting supplier now promising the week of the 14th — five days past need date. Raising it in tomorrow's status."),
    (NACELLE_ID, SAM_ID, 14, "Retrofit kit build started; first fairing is in machining."),
    (NACELLE_ID, PRIYA_ID, 8, "Two nonconformances on the fairing lay-up. Routed to The Fixer for root cause."),
    (NACELLE_ID, ALEX_ID, 5, "Composite technician capacity is tight next month. Asking Labor Supply & Demand for a loan."),
    (NACELLE_ID, MARCUS_ID, 2, "Nacelle is this quarter's schedule risk for the portfolio. Escalate if its Tradeoffs stay low priority."),
    (RADAR_ID, SAM_ID, 20, "LRIP kickoff held. The 48-unit build plan and gate schedule were accepted."),
    (RADAR_ID, PRIYA_ID, 15, "First-article inspection is scheduled after unit 2 machining. CMM programs are in review."),
    (RADAR_ID, ALEX_ID, 10, "Titanium forging slipped two weeks. Machining sequence re-planned to absorb it."),
    (RADAR_ID, SAM_ID, 4, "Customer asked about accelerating deliveries. I need a capacity view before we commit."),
    (RADAR_ID, MARCUS_ID, 2, "Radar Housing is priority one across the portfolio for Q3."),
    (AVIONICS_ID, SAM_ID, 30, "Final delivery accepted by Meridian Air."),
    (AVIONICS_ID, PRIYA_ID, 21, "Closeout audit was clean: no open corrective actions."),
    (AVIONICS_ID, MARCUS_ID, 14, "Lessons-learned session held. Three items feed the portfolio playbook."),
    (RIVERSIDE_ID, JESS_ID, 8, "Site walk complete. The customer wants a phased expansion option."),
    (RIVERSIDE_ID, MARCUS_ID, 5, "Margin looks thin at current labor rates. Needs a Good Plan run before we bid."),
    (RIVERSIDE_ID, JESS_ID, 2, "Go/No-Go is scheduled for the 30th."),
    (COASTAL_ID, JESS_ID, 6, "Recompete RFP released. The incumbent is favored on past performance."),
    (COASTAL_ID, MARCUS_ID, 4, "Strategic fit with the Defense Systems portfolio is strong."),
    (COASTAL_ID, JESS_ID, 1, "Capture plan drafted. Teaming talks are under way with two sensor vendors."),
]


def apply_demo_data() -> dict:
    """Upsert the whole demo story. Returns a small summary of what it did."""
    apps = {a.name: a for a in Application.query.all()}
    summary = {"people": 0, "projects_created": 0, "links_added": 0, "notes_added": 0}

    # portfolios
    for pid, spec in PORTFOLIOS.items():
        pf = db.session.get(Portfolio, pid)
        if pf is None:
            pf = Portfolio(id=pid, name=spec["name"], description=spec["description"])
            db.session.add(pf)
        pf.channel_list = spec["channels"]
    db.session.flush()

    # people
    for pid, (name, title, is_admin) in PEOPLE.items():
        person = db.session.get(Person, pid)
        if person is None:
            # a legacy row with the same name but a random id: adopt that name's slot only if it
            # has no fixed id yet — simplest is to create the fixed-id person alongside.
            person = Person(id=pid, name=name, title=title, is_admin=is_admin)
            db.session.add(person)
            summary["people"] += 1
        else:
            person.name, person.title, person.is_admin = name, title, is_admin
    db.session.flush()

    # new projects
    for pid, spec in NEW_PROJECTS.items():
        if db.session.get(Project, pid) is not None:
            continue
        history = spec["history"]
        fields = {k: v for k, v in spec.items() if k != "history"}
        db.session.add(Project(id=pid, **fields))
        db.session.flush()
        for frm, to, ago in history:
            db.session.add(ProjectPhaseEvent(project_id=pid, from_phase=frm, to_phase=to, occurred_at=_days_ago(ago)))
        summary["projects_created"] += 1
    db.session.flush()

    # facts on every demo project (portfolio, S4 id, WinMax id, jumpstation links)
    for pid, facts in PROJECT_FACTS.items():
        project = db.session.get(Project, pid)
        if project is None:
            continue
        if "portfolio_id" in facts:
            project.portfolio_id = facts["portfolio_id"]
        project.channel_list = facts["channels"]
        if "contract_url" in facts:
            project.contract_url = facts["contract_url"]
        for system, key in (("S4", "s4"), ("WinMax", "winmax")):
            if key not in facts:
                continue
            existing = ExternalId.query.filter_by(project_id=pid, system=system).first()
            if existing is None:
                db.session.add(ExternalId(project_id=pid, system=system, external_id=facts[key]))
            else:
                existing.external_id = facts[key]

    # app connections
    for pid, app_name, phase, note in APP_LINKS:
        app = apps.get(app_name)
        if app is None or db.session.get(Project, pid) is None:
            continue
        # The Fixer is Depot-unaware and knows a case's project only by NAME, so its crosswalk ref
        # is the project name (the Depot passes that to its /api/summary).
        ref = db.session.get(Project, pid).name if app_name == "The Fixer" else None
        link = ProjectAppLink.query.filter_by(project_id=pid, application_id=app.id).first()
        if link is None:
            db.session.add(ProjectAppLink(
                project_id=pid, application_id=app.id, phase=phase, notes=note,
                link_url=app.url or None, external_ref=ref,
            ))
            summary["links_added"] += 1
        elif ref and not link.external_ref:
            link.external_ref = ref
    db.session.flush()

    # memberships, pins and hidden org apps: REPLACED for the demo personas
    for pid in PEOPLE:
        ProjectMembership.query.filter_by(person_id=pid).delete()
        Pin.query.filter_by(person_id=pid).delete()
        PinOrder.query.filter_by(person_id=pid).delete()
        HiddenOrgApp.query.filter_by(person_id=pid).delete()
    db.session.flush()
    for pid, rows in MEMBERSHIPS.items():
        for project_id, role, manage in rows:
            if db.session.get(Project, project_id) is None:
                continue
            db.session.add(ProjectMembership(person_id=pid, project_id=project_id, role_label=role, can_manage_members=manage))
    for pid, names in PINS.items():
        for name in names:
            if name in apps:
                db.session.add(Pin(person_id=pid, application_id=apps[name].id))
    for pid, visible in _VISIBLE_ORG.items():
        for name in _ORG_APPS:
            if name not in visible and name in apps:
                db.session.add(HiddenOrgApp(person_id=pid, application_id=apps[name].id))

    # journal notes (skip any already present)
    for project_id, author, ago, body in NOTES:
        if db.session.get(Project, project_id) is None:
            continue
        if JournalNote.query.filter_by(project_id=project_id, person_id=author, body=body).first() is None:
            db.session.add(JournalNote(project_id=project_id, person_id=author, body=body, created_at=_days_ago(ago)))
            summary["notes_added"] += 1

    db.session.commit()
    return summary

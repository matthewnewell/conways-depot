"""
Registry seed — capabilities, applications, and two demo projects.

Value Stream is a real, currently-running sibling app (it has a `url`). WinMax and Contract &
Legal Authoring are real vendor products this Depot registers but never integrates with — no
`url`, and the crosswalk (ExternalId) is the only connection. Staffing & Capacity Engine and
People & Access Directory aren't built yet — the descriptions say so, and they're here to keep
the capability visible as a gap. (There's no `status` field distinguishing these — the prose
and the presence/absence of a `url` carry it.)

Personas (models.Person) and their project memberships are seeded separately by
seed_people_if_empty() — a demo "viewing as" switcher, not authentication.

There is no "Launchpad" app here (there used to be one, briefly). Starting a project and wiring
it up is the Depot's own job — done on the project detail page, which is the project's home
base — not a separate application a project "connects" to.

Two kinds of application scope (Application.scope, see models.py): "project" apps serve one
project's lifecycle. "organizational" apps are ISO/IEC/IEEE 15288's Organizational
Project-Enabling Processes — staffing, contract authoring — they serve every project at once.

Every app is filed under a browse Category (Application.category, see APP_CATEGORIES) — 15288's
process groups (agreement / enterprise / project / technical) plus a "general" bucket. That's
the registry's aisle; Application.capability stays the specific need within it. An app carries
no lifecycle phase of its own — that's a property of a project's link to it, not the app.

The one seeded project is prefixed "Demo:", same convention Value Stream uses for its own
seed map — and its Value Stream link points at that real, running demo map, so clicking it is
an actual live demonstration of the whole point: two independently-run apps, tied together by
one id, connected only by a stored URL.
"""

from datetime import datetime, timedelta, timezone

from db import db
from models import Application, Capability, ExternalId, Portfolio, Project, ProjectAppLink, ProjectPhaseEvent


def _days_ago(n: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=n)

# The real id of Value Stream's own seeded demo map (`Demo: Bracket Assembly...`), as of when
# this was written. If Value Stream's dev DB is ever reset, this link goes stale — an accepted
# limitation of a plain-URL pointer, and exactly the kind of drift a real crosswalk has to live
# with too.
VALUE_STREAM_DEMO_MAP_ID = "b21f6ed1-3403-4a0b-a0c0-44f93d646562"
VALUE_STREAM_BASE_URL = "http://localhost:5173"


def seed_if_empty():
    if Project.query.count() > 0 or Application.query.count() > 0:
        return

    # ── Capabilities (TOGAF-style: stable, independent of who currently fulfills them) ──
    cap_capture = Capability(
        name="Capture & Pursuit Management",
        description="Tracking an opportunity from identification through bid decision and submission.",
    )
    cap_vsm = Capability(
        name="Value Stream Mapping / Bottleneck Analysis",
        description="Modeling a workflow's steps and wait times to find and act on the constraint.",
    )
    cap_staffing = Capability(
        name="Labor Demand & Capacity Planning",
        description="Projecting labor demand across awarded work and pipeline, against available capacity.",
    )
    cap_contract_authoring = Capability(
        name="Contract & Legal Authoring",
        description="Shared templates, clause libraries, and legal review used to write any contract — distinct from tracking one project's specific SOWs.",
    )
    db.session.add_all([
        cap_capture, cap_vsm, cap_staffing, cap_contract_authoring,
    ])
    db.session.flush()

    # ── Applications ── each filed under a 15288-derived Category (see APP_CATEGORIES); the
    #    Capability is the specific need within it.
    app_value_stream = Application(
        name="Value Stream",
        description="Visual value-stream mapping — lead time, critical path, wait contributors.",
        owning_team="Matt (informal enabling team)",
        team_type="enabling",  # helps other teams adopt a VSM practice, not yet self-service platform-shaped
        category="project",  # 15288 Project Processes — Assessment / Measurement
        capability=cap_vsm,
        url=VALUE_STREAM_BASE_URL,
    )
    app_winmax = Application(
        name="WinMax",
        description="Deltek's capture management product — pursuit tracking, gate reviews, P(win).",
        owning_team="Business Development",
        team_type=None,  # a vendor product, not an internally-owned team
        category="agreement",  # 15288 Agreement Processes — Supply (pursuing work to supply)
        capability=cap_capture,
        url=None,  # real external SaaS product; no stable local URL to link to
    )
    # ── Organizational Enablers (ISO/IEC/IEEE 15288 Organizational Project-Enabling Processes) —
    #    scope="organizational": these serve every project at once. Value Stream's own template
    #    library left this 15288 category out because it didn't fit a per-project value stream;
    #    it fits *here*, at the portfolio level, on purpose. ──
    app_good_plan = Application(
        name="Good Plan",
        description=(
            "For projects: a project defines its own labor demand — role, FTE, and dates — "
            "before anyone commits a real person to it. The organizational counterpart is "
            "Big Plan."
        ),
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        scope="project",
        category="project",
        capability=cap_staffing,
        url="http://localhost:5178",
    )
    app_big_plan = Application(
        name="Big Plan",
        description=(
            "Not yet built — organizational labor supply and demand: where a functional/"
            "resource manager commits actual capacity, org-wide, against the labor demand "
            "every project declares in Good Plan. 15288 Organizational Project-Enabling: "
            "Human Resource Management (6.2.4)."
        ),
        owning_team=None,
        team_type=None,
        scope="organizational",
        category="enterprise",  # 15288 Organizational Project-Enabling — Resource Management
        capability=cap_staffing,
        url=None,
    )
    cap_qms = Capability(
        name="Quality Management",
        description="The organization's quality policy, objectives, and management system — distinct from a single project's own quality control activities.",
    )
    cap_portfolio_mgmt = Capability(
        name="Portfolio Management",
        description="Authorizing, monitoring, and controlling the organization's ongoing projects as a set — deciding what continues, what changes, and what stops.",
    )
    db.session.add_all([cap_qms, cap_portfolio_mgmt])
    db.session.flush()
    app_qms = Application(
        name="QMS",
        description="Not yet built — the organization's quality management system. 15288 Organizational Project-Enabling: Quality Management (6.2.5).",
        owning_team=None,
        team_type=None,
        scope="organizational",
        category="enterprise",
        capability=cap_qms,
        url=None,
    )
    app_lham = Application(
        name="Let's Have a Meeting",
        description="Not yet built — summons projects to report to the organization on a cadence. 15288 Organizational Project-Enabling: Portfolio Management (6.2.3).",
        owning_team=None,
        team_type=None,
        scope="organizational",
        category="enterprise",
        capability=cap_portfolio_mgmt,
        url=None,
    )
    app_portfolio_manager = Application(
        name="Portfolio Manager",
        description=(
            "Not yet built — the oversight view a business area lead uses to see every one "
            "of their projects at once. 15288 Organizational Project-Enabling: Portfolio "
            "Management (6.2.3)."
        ),
        owning_team=None,
        team_type=None,
        scope="organizational",
        category="enterprise",
        capability=cap_portfolio_mgmt,
        url=None,
    )
    app_contract_authoring = Application(
        name="Contract & Legal Authoring",
        description="Ron's Contract and Legal Authoring",
        owning_team="Legal / Contracts",
        team_type=None,
        scope="organizational",
        category="agreement",  # 15288 Agreement Processes — Supply (prime) / Acquisition (subs)
        capability=cap_contract_authoring,
        url=None,
    )
    cap_manufacturing_status = Capability(
        name="Manufacturing Status Visibility",
        description="Where a part actually is on the shop floor, how long it's been there, and a shared way to flag it for expedite.",
    )
    db.session.add(cap_manufacturing_status)
    db.session.flush()
    app_dwmp = Application(
        name="Dude, Where's My Part?",
        description="Shop-floor part status and expedite visibility, over an on-demand S4 extract — not a new system of record.",
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        category="technical",  # 15288 Technical Processes — Implementation (6.4.7) execution visibility
        capability=cap_manufacturing_status,
        url="http://localhost:5176",
    )
    cap_rca_capa = Capability(
        name="Root Cause Analysis / CAPA",
        description="Investigating why something failed and tracking the corrective and preventive action taken so it does not happen again.",
    )
    db.session.add(cap_rca_capa)
    db.session.flush()
    app_fixer = Application(
        name="The Fixer",
        description="Root cause analysis (5 Whys) and CAPA, guided as you work - with an AI-guided documented plan and journal evidence, not a paperwork exercise after the fact.",
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        category="technical",  # 15288 Technical Management — closest to Quality Assurance (6.3.8); no dedicated category exists
        capability=cap_rca_capa,
        url="http://localhost:5177",
    )
    db.session.add_all([
        app_value_stream, app_winmax,
        app_good_plan, app_big_plan, app_qms, app_lham, app_portfolio_manager,
        app_contract_authoring, app_dwmp, app_fixer,
    ])
    db.session.flush()

    # ── One demo project, spanning Pursuit -> Award -> Execution ──
    # A Portfolio groups Projects for an organizational reason (a business line, here), not a
    # lifecycle one — deliberately spans both demo projects even though they have different
    # customers, since that's the realistic case: a portfolio is usually an internal construct,
    # not a per-customer bucket.
    portfolio = Portfolio(
        name="Industrial Programs",
        description="Manufacturing and industrial-facility work across customers.",
    )
    db.session.add(portfolio)
    db.session.flush()

    project = Project(
        name="Demo: Bracket Assembly Program",
        customer="Acme Aerostructures",
        phase="execution",
        portfolio=portfolio,
        team_topology="stream-aligned",
        description=(
            "Illustrative project, mirroring Value Stream's own seeded demo map so the "
            "Execution-phase link below is a real, clickable connection between two "
            "independently-running apps — not a mockup."
        ),
    )
    db.session.add(project)
    db.session.flush()

    # Illustrative phase history — a real transition log, not just today's snapshot, so the
    # project detail page has something real to show for "how did this project get here."
    db.session.add_all([
        ProjectPhaseEvent(project_id=project.id, from_phase=None, to_phase="pursuit", occurred_at=_days_ago(90)),
        ProjectPhaseEvent(project_id=project.id, from_phase="pursuit", to_phase="award", occurred_at=_days_ago(60)),
        ProjectPhaseEvent(project_id=project.id, from_phase="award", to_phase="execution", occurred_at=_days_ago(45)),
    ])

    db.session.add(ExternalId(project_id=project.id, system="WinMax", external_id="OPP-8891"))

    db.session.add_all([
        ProjectAppLink(
            project_id=project.id, application_id=app_winmax.id, phase="pursuit",
            external_ref="OPP-8891",
            notes="Captured as a sole-source bracket redesign pursuit.",
        ),
        ProjectAppLink(
            project_id=project.id, application_id=app_value_stream.id, phase="execution",
            external_ref=VALUE_STREAM_DEMO_MAP_ID,
            link_url=f"{VALUE_STREAM_BASE_URL}/maps/{VALUE_STREAM_DEMO_MAP_ID}/bluf",
            notes="Design -> Procure -> Build -> Ship value stream for the bracket redesign.",
        ),
    ])

    # ── A second project, still early in its life, to show the registry covers the whole
    #    portfolio, not just late-stage work ──
    prospect = Project(
        name="Prospect: Riverside Facility Expansion",
        customer="Riverside Logistics",
        phase="pursuit",
        portfolio=portfolio,
        description="Illustrative early-stage pursuit — only a capture record exists yet.",
    )
    db.session.add(prospect)
    db.session.flush()
    db.session.add(ProjectPhaseEvent(project_id=prospect.id, from_phase=None, to_phase="pursuit", occurred_at=_days_ago(10)))
    db.session.add(ExternalId(project_id=prospect.id, system="WinMax", external_id="OPP-9214"))
    db.session.add(ProjectAppLink(
        project_id=prospect.id, application_id=app_winmax.id, phase="pursuit",
        external_ref="OPP-9214",
    ))

    db.session.commit()


# Persona name -> (title, is_admin, [project names they're on]). Matched to projects by name so
# this can also backfill an already-seeded dev DB (see seed_people_if_empty). A project name
# that isn't present is skipped, not an error — a fresh DB won't have the user-made ones.
_DEMO_PEOPLE: list[tuple[str, str, bool, list[tuple[str, str]]]] = [
    ("Admin", "Enterprise Architect", True, []),  # the "see everything" seat — the default persona
    ("Sam Ortiz", "Program Manager", False, [
        ("Demo: Bracket Assembly Program", "Program Manager"),
        ("Demo: Nacelle Fairing Retrofit", "Program Manager"),
    ]),
    ("Alex Chen", "Lead Engineer", False, [
        ("Demo: Bracket Assembly Program", "Lead Engineer"),
    ]),
    ("Jess Kim", "Capture Manager", False, [
        ("Prospect: Riverside Facility Expansion", "Capture Manager"),
    ]),
]


def seed_people_if_empty():
    """Demo personas for the nav's "viewing as" switcher — see models.Person: not auth, no
    enforcement. Guarded separately from seed_if_empty() so a dev DB seeded before personas
    existed picks them up on the next backend start."""
    from models import Person, ProjectMembership

    if Person.query.count() > 0:
        return

    projects_by_name = {p.name: p for p in Project.query.all()}
    for name, title, is_admin, memberships in _DEMO_PEOPLE:
        person = Person(name=name, title=title, is_admin=is_admin)
        db.session.add(person)
        db.session.flush()
        for project_name, role_label in memberships:
            project = projects_by_name.get(project_name)
            if project is None:
                continue
            db.session.add(ProjectMembership(
                person_id=person.id, project_id=project.id, role_label=role_label,
            ))
    db.session.commit()

"""
Registry seed — capabilities, applications, and two demo projects.

Value Stream and WinMax are real, currently-running sibling apps (each has a `url`, and now an
`api_url` for the Launchpad summary contract — see routes/applications.py's application_summary).
Contract & Legal Authoring is a real vendor product this Depot registers but never integrates
with — no `url`, and the crosswalk (ExternalId) is its only connection. (There's no `status`
field distinguishing built-vs-not — the prose and the presence/absence of a `url` carry it.)

WinMax used to coexist with a "WinMax (Deltek)" vendor-stub entry sharing its Capability — the
vendor product it was meant to replace. Removed 2026-09-15 once it was clear that stub would
never itself get built out (it was never more than a name + a crosswalk anyway): the Capability
survives under the real WinMax, and its two ProjectAppLink rows were migrated across (see the
demo project blocks below) rather than deleted, so the opportunity numbers aren't lost.

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

# The real id of Value Stream's own seeded sample map (`Bracket Assembly`, project field
# "Demo: Bracket Assembly Program" — `GET /api/maps/sample` there). If Value Stream's dev DB is
# ever reset, this link goes stale — an accepted limitation of a plain-URL pointer, and exactly
# the kind of drift a real crosswalk has to live with too. **This already happened once**
# (2026-09-15, while wiring Increment 2's summary contract): the id below was updated from a
# now-nonexistent map; verify with `curl {VALUE_STREAM_API_URL}/api/maps/sample` before trusting
# it again after any Value Stream reseed.
VALUE_STREAM_DEMO_MAP_ID = "772111e5-31f5-4a58-a294-fad9b39a9fb9"
VALUE_STREAM_BASE_URL = "http://localhost:5173"
# The backend's own base URL — never shown to a person, only called server-to-server by the
# Launchpad's app-summary proxy (see routes/applications.py's application_summary()).
VALUE_STREAM_API_URL = "http://localhost:8080"

# WinMax's own backend, same "server-to-server only" role as VALUE_STREAM_API_URL above. Unlike
# Value Stream, WinMax's demo pursuits (its own seed.py) were curated to make WinMax's own case
# on its own splash page, not to line up with either of *this* Depot's demo projects by name —
# so there is no WINMAX_DEMO_PURSUIT_ID constant here. Both demo projects' WinMax links below
# carry the old Deltek opportunity number in a note instead of a resolvable external_ref, and
# their Launchpad tile honestly reads "No pursuit linked yet" until a real capture record for
# either project exists in WinMax.
WINMAX_API_URL = "http://localhost:8099"


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
    cap_task_priority = Capability(
        name="Task & Priority Management",
        description="A person's own working list across every project they support, kept current from real signals instead of memory.",
    )
    cap_spec_authoring = Capability(
        name="Spec Authoring & Prototyping",
        description="Turning an idea into a specification and prototype-level design before anyone writes code — distinct from building the thing itself.",
    )
    cap_material_priority = Capability(
        name="Material, Acquisition, Routing & Priority Visibility",
        description="Manufacturing-side project visibility: mocked S4 material/acquisition/routing status, plus Tradeoffs (org priority) and Impact (computed risk from priority vs. due date).",
    )
    db.session.add_all([
        cap_capture, cap_vsm, cap_staffing, cap_contract_authoring, cap_task_priority,
        cap_spec_authoring, cap_material_priority,
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
        api_url=VALUE_STREAM_API_URL,
    )
    app_winmax = Application(
        name="WinMax",
        description=(
            "A P(Win)/P(Go)/Bid-No-Bid gated pursuit tracker: named scoring factors, "
            "threshold bands (<25% no-bid, 25-50% caution, 50-70% competitive, >70% strong), "
            "and a journal of why a score moved, same evidence-not-just-a-number-flip "
            "convention as Value Stream's and The Fixer's own journals. One AI chat "
            "assistant, not the six specialized agent roles (Capture Manager, Competitive "
            "Intel, Price-to-Win, Customer Intel, Proposal Strategist, Color Team Reviewer) an "
            "earlier teaser sketched. Replaced the \"WinMax (Deltek)\" vendor-stub entry that "
            "used to share this capability."
        ),
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        category="agreement",
        capability=cap_capture,
        url="http://localhost:5185",
        api_url=WINMAX_API_URL,
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
            "Labor Supply & Demand."
        ),
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        scope="project",
        category="project",
        capability=cap_staffing,
        url="http://localhost:5178",
    )
    app_labor_supply_demand = Application(
        name="Labor Supply & Demand",
        description=(
            "Where a functional/resource manager sees labor demand rolled up across every "
            "project (read live from Good Plan) and commits real people or headcount against "
            "it. Staffing only — not a general organizational dashboard. 15288 Organizational "
            "Project-Enabling: Human Resource Management (6.2.4)."
        ),
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        scope="organizational",
        category="enterprise",  # 15288 Organizational Project-Enabling — Resource Management
        capability=cap_staffing,
        url="http://localhost:5184",
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
        description="Summon projects for review",
        owning_team=None,
        team_type=None,
        scope="organizational",
        category="enterprise,project",  # 15288 Organizational Project-Enabling: Portfolio Management (6.2.3)
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
        category="project,enterprise",  # 15288 Project + Organizational Project-Enabling — filed under both
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
        category="project",  # 15288 Project Processes — closest to Quality Assurance (6.3.8); no dedicated category exists
        capability=cap_rca_capa,
        url="http://localhost:5177",
    )
    cap_scan = Capability(
        name="License & Supply-Chain Compliance",
        description="Checking that a repo's own license and the licenses/vulnerabilities of everything it depends on are clean enough to hand to an internal or external open-source review.",
    )
    db.session.add(cap_scan)
    db.session.flush()
    app_scan_me = Application(
        name="Scan Me",
        description=(
            "A pre-flight check before a repo goes into the company's own open-source / "
            "import review — its own license, every dependency's declared license, and any "
            "dependency with a known vulnerability. A signal for our side, not a substitute "
            "for their gate."
        ),
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        scope="organizational",
        category="technical",
        capability=cap_scan,
        url="http://localhost:5179",
    )
    cap_org_structure = Capability(
        name="Organizational Structure & Reporting",
        description="The company's real reporting chain — who reports to whom, from the CEO down to the shop floor — independent of any one project's own team roster.",
    )
    db.session.add(cap_org_structure)
    db.session.flush()
    app_org_charts = Application(
        name="Org Charts",
        description=(
            "A graphical, drill-down view of the company's entire reporting chain, from the "
            "CEO down to the shop floor. Simple and clean at rest, as deep as you actually "
            "click into."
        ),
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        scope="organizational",
        category="enterprise",
        capability=cap_org_structure,
        url="http://localhost:5181",
    )
    cap_procurement = Capability(
        name="Procurement Status Visibility",
        description="Where a purchase order actually is on the way in — material master, PR, PO, received, inspected, in inventory, assigned to demand — and a shared way to flag it for expedite. The procurement-side counterpart to Manufacturing Status Visibility.",
    )
    db.session.add(cap_procurement)
    db.session.flush()
    app_dwmo = Application(
        name="Dude, Where's My Order?",
        description=(
            "Every order line, from material master to assigned-to-demand, over an on-demand "
            "S4 procurement extract — not a new system of record. The procurement-side sibling "
            "of Dude, Where's My Part?"
        ),
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        scope="project",
        category="project,agreement",
        capability=cap_procurement,
        url="http://localhost:5182",
    )
    cap_scope = Capability(
        name="Scope Definition & Progress Tracking",
        description="A project's work breakdown — a plain WBS, nested as deep as it needs to be — and an honest, judgment-based record of how complete each piece actually is.",
    )
    db.session.add(cap_scope)
    db.session.flush()
    app_scope_manager = Application(
        name="Scope Manager",
        description=(
            "A minimal work breakdown structure, not Azure Boards or Jira. Percent complete "
            "is always a recorded judgment call — never computed from a GitHub or Azure "
            "Boards issue count."
        ),
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        scope="project",
        category="project",
        capability=cap_scope,
        url="http://localhost:5183",
    )
    cap_performance = Capability(
        name="Cost, Schedule, and Technical Performance Dashboard",
        description="Earned value against real actuals — BCWS, BCWP, and ACWP per charge number — read from Good Plan's budget, Scope Manager's progress, and an S4 actuals feed.",
    )
    db.session.add(cap_performance)
    db.session.flush()
    app_reckon = Application(
        name="Reckon",
        description=(
            "Not yet built — a cost, schedule, and technical performance dashboard, read-only "
            "across Good Plan, Scope Manager, and a mocked S4 actuals feed, computing real "
            "earned value per charge number. Scales from a single project's own view up to an "
            "organization-wide/portfolio rollup — the same underlying data, just aggregated "
            "differently."
        ),
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        scope="project",
        category="project,enterprise",
        capability=cap_performance,
        url=None,
    )
    app_task_master = Application(
        name="Task Master",
        description=(
            "A personal kanban — Backlog, To Do, Doing, Done — for one person across every "
            "project they support, not one board per project. \"Suggest backlog items\" reads "
            "real cross-app signals through this Depot's own summary/journal proxies and "
            "proposes grounded cards with a stated reason; nothing moves itself off the "
            "backlog. The one sibling app with a required live dependency on this Depot — its "
            "own persona switcher calls this API directly, rather than keeping its own copy "
            "of who exists."
        ),
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        scope="organizational",  # general category, not tied to one project — see above
        category="general",
        capability=cap_task_priority,
        url="http://localhost:5186",
        api_url="http://localhost:8100",
    )
    app_aarons_meadow = Application(
        name="Aaron's Meadow",
        description=(
            "A place, not a tool: a chatbot-driven interview that turns an idea into a "
            "specification and a prototype-level design, never working code. Pushes back on "
            "scope creep, asks once whether the thing needs to exist at all, and shows the "
            "spec assembling itself as you talk. Owns its own draft -> in_review -> published "
            "lifecycle end to end, and every stage stays right here — publishing marks a spec "
            "done, it does not register anything new in this catalog."
        ),
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        scope="organizational",  # general category, not tied to one project
        category="general",
        capability=cap_spec_authoring,
        url="http://localhost:5187",
        api_url="http://localhost:8101",
    )
    app_marti = Application(
        name="MARTI",
        description=(
            "Material, Acquisition, Routings, Tradeoffs, Impact — manufacturing-side project "
            "visibility over mocked S4 data, plus a priority (Tradeoffs) and computed risk "
            "(Impact) layer. Meant to eventually replace Dude, Where's My Part? and Dude, "
            "Where's My Order? once validated."
        ),
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        scope="project",
        category="technical",
        capability=cap_material_priority,
        url="http://localhost:5188",
        api_url="http://localhost:8102",
    )

    db.session.add_all([
        app_value_stream, app_winmax,
        app_good_plan, app_labor_supply_demand, app_qms, app_lham, app_portfolio_manager,
        app_contract_authoring, app_dwmp, app_fixer, app_scan_me, app_org_charts, app_dwmo,
        app_scope_manager, app_reckon, app_task_master, app_aarons_meadow, app_marti,
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
            notes=(
                "Captured as a sole-source bracket redesign pursuit (opportunity OPP-8891, "
                "originally tracked in WinMax (Deltek) before that vendor stub was retired). "
                "No matching WinMax capture record created yet."
            ),
        ),
        ProjectAppLink(
            project_id=project.id, application_id=app_value_stream.id, phase="execution",
            external_ref=VALUE_STREAM_DEMO_MAP_ID,
            link_url=f"{VALUE_STREAM_BASE_URL}/maps/{VALUE_STREAM_DEMO_MAP_ID}/timeline",
            notes="Design -> Procure -> Build -> Ship value stream for the bracket redesign.",
        ),
        ProjectAppLink(
            project_id=project.id, application_id=app_marti.id, phase="execution",
            link_url="http://localhost:5188/projects/" + project.id,
            notes="MARTI MVP — built this session.",
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
        notes=(
            "Opportunity OPP-9214, originally tracked in WinMax (Deltek) before that vendor "
            "stub was retired. No matching WinMax capture record created yet."
        ),
    ))

    db.session.commit()


# Persona name -> (title, is_admin, [(project name, role_label, can_manage_members)]). Matched
# to projects by name so this can also backfill an already-seeded dev DB (see
# seed_people_if_empty). A project name that isn't present is skipped, not an error — a fresh DB
# won't have the user-made ones. can_manage_members is the one real (if unenforced) flag on
# membership — see ProjectMembership's own docstring; the PM carries it here as the plausible
# real-world case, the two other roles don't, so the demo shows both states.
_DEMO_PEOPLE: list[tuple[str, str, bool, list[tuple[str, str, bool]]]] = [
    ("Admin", "Enterprise Architect", True, []),  # the "see everything" seat — the default persona
    ("Sam Ortiz", "Program Manager", False, [
        ("Demo: Bracket Assembly Program", "Program Manager", True),
        ("Demo: Nacelle Fairing Retrofit", "Program Manager", True),
    ]),
    ("Alex Chen", "Lead Engineer", False, [
        ("Demo: Bracket Assembly Program", "Lead Engineer", False),
    ]),
    ("Jess Kim", "Capture Manager", False, [
        ("Prospect: Riverside Facility Expansion", "Capture Manager", False),
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
        for project_name, role_label, can_manage_members in memberships:
            project = projects_by_name.get(project_name)
            if project is None:
                continue
            db.session.add(ProjectMembership(
                person_id=person.id, project_id=project.id, role_label=role_label,
                can_manage_members=can_manage_members,
            ))
    db.session.commit()


# Pinned by Admin — the default "see everything" persona, so the Launchpad isn't an empty
# Pinned Apps section on a fresh visit. Same three as the catalog's own Featured row, on
# purpose: one consistent "these are the apps to look at first" story across both pages.
_ADMIN_PINS = ["Good Plan", "Value Stream", "WinMax"]


def seed_pins_if_empty():
    """Guarded separately, same reasoning as seed_people_if_empty: pins shipped after the
    registry and personas did, so an already-seeded dev DB needs them backfilled too."""
    from models import Application, Person, Pin

    if Pin.query.count() > 0:
        return

    admin = Person.query.filter_by(is_admin=True).first()
    if admin is None:
        return

    for app_name in _ADMIN_PINS:
        app = Application.query.filter_by(name=app_name).first()
        if app is None:
            continue
        db.session.add(Pin(person_id=admin.id, application_id=app.id))
    db.session.commit()

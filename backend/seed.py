"""
Registry seed — capabilities, applications, and one demo project, all honestly labeled.

"Built" applications (Value Stream, BurnedValue) are real, currently-running sibling apps.
"External" applications (WinMax, Costpoint, and the two Organizational Enablers below) are real
vendor products this Depot registers but never integrates with — they're here to make the
crosswalk concept concrete, not to pretend an integration exists. "Planned" applications are
capability gaps the registry makes visible on purpose (SOW Tracker, CAPA, and the Staffing
engine are still out there) — nothing behind them exists yet, and the seed data never links a
project to a planned app, since that would be a dead link dressed up as a real one.

There is no "Launchpad" app here (there used to be one, briefly). Starting a project and wiring
it up is the Depot's own job — done on the project detail page, which is the project's home
base — not a separate application a project "connects" to.

Two kinds of application scope (Application.scope, see models.py): "project" apps serve one
project's lifecycle and carry phases accordingly (Application.phases, a list — Costpoint spans
Award through Closeout, not just one). "organizational" apps are ISO/IEC/IEEE 15288's
Organizational Project-Enabling Processes (6.2) — staffing, HR, contract authoring — and
deliberately carry no phases: they serve every project at once, not one project's lifecycle.

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
BURNEDVALUE_BASE_URL = "http://localhost:5000"


def seed_if_empty():
    if Project.query.count() > 0 or Application.query.count() > 0:
        return

    # ── Capabilities (TOGAF-style: stable, independent of who currently fulfills them) ──
    cap_capture = Capability(
        name="Capture & Pursuit Management",
        description="Tracking an opportunity from identification through bid decision and submission.",
    )
    cap_contract = Capability(
        name="Contract & Subcontract SOW Management",
        description="Managing the prime contract and any subcontractor statements of work under it.",
    )
    cap_vsm = Capability(
        name="Value Stream Mapping / Bottleneck Analysis",
        description="Modeling a workflow's steps and wait times to find and act on the constraint.",
    )
    cap_evm_erp = Capability(
        name="ERP / Financial System of Record",
        description="The book-of-record for contract value, actual costs, and invoicing.",
    )
    cap_evm_analysis = Capability(
        name="Cost / EVM Analysis",
        description="Earned value forecasting, scope-change tracking, and BLUF-style cost narratives on top of the financial system of record.",
    )
    cap_capa = Capability(
        name="Corrective & Preventive Action (CAPA)",
        description="Tracking a nonconformance or lesson-learned from root cause through closure.",
    )
    cap_staffing = Capability(
        name="Labor Demand & Capacity Planning",
        description="Projecting labor demand across awarded work and pipeline, against available capacity.",
    )
    cap_hr = Capability(
        name="HR & Talent Management",
        description="Employee records, roles, and org structure — the org-wide system of record every project draws staff from.",
    )
    cap_contract_authoring = Capability(
        name="Contract & Legal Authoring",
        description="Shared templates, clause libraries, and legal review used to write any contract — distinct from tracking one project's specific SOWs.",
    )
    db.session.add_all([
        cap_capture, cap_contract, cap_vsm,
        cap_evm_erp, cap_evm_analysis, cap_capa, cap_staffing,
        cap_hr, cap_contract_authoring,
    ])
    db.session.flush()

    # ── Applications ──
    # Phase assignments follow the very first brainstorm this whole app is built from: pursuit
    # of X (WinMax) -> winning X (Costpoint, SOW Tracker) -> executing X (Value Stream,
    # BurnedValue, CAPA App). Several carry more than one phase now that Application.phases is a
    # list, not a single value — Costpoint stays relevant well past the award it starts at.
    app_value_stream = Application(
        name="Value Stream",
        description="Visual value-stream mapping — lead time, critical path, wait contributors.",
        status="built",
        owning_team="Matt (informal enabling team)",
        team_type="enabling",  # helps other teams adopt a VSM practice, not yet self-service platform-shaped
        phase_list=["execution"],
        capability=cap_vsm,
        url=VALUE_STREAM_BASE_URL,
    )
    app_burnedvalue = Application(
        name="BurnedValue",
        description="EVM tracking, scope-change and forecast analysis for awarded contracts.",
        status="built",
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        phase_list=["execution", "closeout"],
        capability=cap_evm_analysis,
        url=BURNEDVALUE_BASE_URL,
    )
    app_winmax = Application(
        name="WinMax",
        description="Deltek's capture management product — pursuit tracking, gate reviews, P(win).",
        status="external",
        owning_team="Business Development",
        team_type=None,  # a vendor product, not an internally-owned team
        phase_list=["pursuit"],
        capability=cap_capture,
        url=None,  # real external SaaS product; no stable local URL to link to
    )
    app_costpoint = Application(
        name="Costpoint",
        description="Deltek's project ERP — the financial system of record once a contract is awarded.",
        status="external",
        owning_team="Finance / Contracts",
        team_type=None,
        phase_list=["award", "execution", "closeout"],
        capability=cap_evm_erp,
        url=None,
    )
    app_sow_tracker = Application(
        name="Subcontractor SOW Tracker",
        description="Not yet built — a placeholder for subcontract SOW authoring and tracking.",
        status="planned",
        owning_team=None,
        team_type=None,
        phase_list=["award", "execution"],
        capability=cap_contract,
        url=None,
    )
    app_capa = Application(
        name="CAPA App",
        description="Not yet built — a placeholder for corrective/preventive action tracking.",
        status="planned",
        owning_team=None,
        team_type=None,
        phase_list=["execution", "closeout"],
        capability=cap_capa,
        url=None,
    )
    # ── Organizational Enablers (ISO/IEC/IEEE 15288 Organizational Project-Enabling
    #    Processes, 6.2) — scope="organizational", no phases: these serve every project at
    #    once, they don't move through any one project's lifecycle. Value Stream's own
    #    template library explicitly left this 15288 category out because it didn't fit a
    #    per-project value stream; it fits *here*, at the portfolio level, on purpose. ──
    app_staffing = Application(
        name="Staffing & Capacity Engine",
        description=(
            "Not yet built — the labor demand/utilization/pipeline-modeling app. Deliberately "
            "a registry entry and nothing more for now: a real, hard problem worth a project of "
            "its own, not a bolt-on to something else."
        ),
        status="planned",
        owning_team=None,
        team_type=None,
        scope="organizational",
        capability=cap_staffing,
        url=None,
    )
    app_hr = Application(
        name="HR & Talent System",
        description="The org's system of record for employees, roles, and org structure — every project draws staff from it, none of them own it.",
        status="external",
        owning_team="Human Resources",
        team_type=None,
        scope="organizational",
        capability=cap_hr,
        url=None,
    )
    app_contract_authoring = Application(
        name="Contract & Legal Authoring",
        description="Shared contract templates and legal review, used to write any project's prime contract or subcontract — not the same as tracking one project's active SOWs.",
        status="external",
        owning_team="Legal / Contracts",
        team_type=None,
        scope="organizational",
        capability=cap_contract_authoring,
        url=None,
    )
    db.session.add_all([
        app_value_stream, app_burnedvalue, app_winmax, app_costpoint,
        app_sow_tracker, app_capa,
        app_staffing, app_hr, app_contract_authoring,
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

    db.session.add_all([
        ExternalId(project_id=project.id, system="WinMax", external_id="OPP-8891"),
        ExternalId(project_id=project.id, system="Costpoint", external_id="4402-01"),
    ])

    db.session.add_all([
        ProjectAppLink(
            project_id=project.id, application_id=app_winmax.id, phase="pursuit",
            external_ref="OPP-8891",
            notes="Captured as a sole-source bracket redesign pursuit.",
        ),
        ProjectAppLink(
            project_id=project.id, application_id=app_costpoint.id, phase="award",
            external_ref="4402-01",
            notes="Charge number assigned at award.",
        ),
        ProjectAppLink(
            project_id=project.id, application_id=app_value_stream.id, phase="execution",
            external_ref=VALUE_STREAM_DEMO_MAP_ID,
            link_url=f"{VALUE_STREAM_BASE_URL}/maps/{VALUE_STREAM_DEMO_MAP_ID}/bluf",
            notes="Design -> Procure -> Build -> Ship value stream for the bracket redesign.",
        ),
        # A planned application can still be linked — the pointer just has no external_ref or
        # link_url yet, because nothing exists to point at. That's the honest state of a
        # capability gap made visible at the project level, not just the portfolio level.
        ProjectAppLink(
            project_id=project.id, application_id=app_capa.id, phase="closeout",
            notes="Root-cause on the QA hold delay, once CAPA App exists to record it in.",
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

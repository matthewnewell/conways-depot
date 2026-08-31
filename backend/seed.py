"""
Registry seed — capabilities, applications, and one demo project, all honestly labeled.

"Built" applications (Value Stream, BurnedValue) are real, currently-running sibling apps.
"External" applications (WinMax, Costpoint) are real Deltek products this Depot registers but
never integrates with — they're here to make the crosswalk concept concrete, not to pretend an
integration exists. "Planned" applications are capability gaps the registry makes visible on
purpose (Project Launchpad is next; the others are further out) — nothing behind them exists
yet, and the seed data never links a project to a planned app, since that would be a dead link
dressed up as a real one.

The one seeded project is prefixed "Demo:", same convention Value Stream uses for its own
seed map — and its Value Stream link points at that real, running demo map, so clicking it is
an actual live demonstration of the whole point: two independently-run apps, tied together by
one id, connected only by a stored URL.
"""

from datetime import datetime, timedelta, timezone

from db import db
from models import Application, Capability, ExternalId, Project, ProjectAppLink, ProjectPhaseEvent


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
    cap_home_base = Capability(
        name="Project Home Base",
        description="A single landing page for a project's team, comms channels, and contract basics.",
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
    db.session.add_all([
        cap_capture, cap_contract, cap_home_base, cap_vsm,
        cap_evm_erp, cap_evm_analysis, cap_capa, cap_staffing,
    ])
    db.session.flush()

    # ── Applications ──
    app_value_stream = Application(
        name="Value Stream",
        description="Visual value-stream mapping — lead time, critical path, wait contributors.",
        status="built",
        owning_team="Matt (informal enabling team)",
        team_type="enabling",  # helps other teams adopt a VSM practice, not yet self-service platform-shaped
        capability=cap_vsm,
        url=VALUE_STREAM_BASE_URL,
    )
    app_burnedvalue = Application(
        name="BurnedValue",
        description="EVM tracking, scope-change and forecast analysis for awarded contracts.",
        status="built",
        owning_team="Matt (informal enabling team)",
        team_type="enabling",
        capability=cap_evm_analysis,
        url=BURNEDVALUE_BASE_URL,
    )
    app_winmax = Application(
        name="WinMax",
        description="Deltek's capture management product — pursuit tracking, gate reviews, P(win).",
        status="external",
        owning_team="Business Development",
        team_type=None,  # a vendor product, not an internally-owned team
        capability=cap_capture,
        url=None,  # real external SaaS product; no stable local URL to link to
    )
    app_costpoint = Application(
        name="Costpoint",
        description="Deltek's project ERP — the financial system of record once a contract is awarded.",
        status="external",
        owning_team="Finance / Contracts",
        team_type=None,
        capability=cap_evm_erp,
        url=None,
    )
    app_launchpad = Application(
        name="Project Launchpad",
        description="Per-project home base: team roster, comm channels, contract basics, links out to every other app registered for that project.",
        status="planned",
        owning_team="Matt (informal enabling team)",
        team_type="platform",  # self-service — every project gets one, no bespoke setup
        capability=cap_home_base,
        url=None,  # doesn't exist yet
    )
    app_sow_tracker = Application(
        name="Subcontractor SOW Tracker",
        description="Not yet built — a placeholder for subcontract SOW authoring and tracking.",
        status="planned",
        owning_team=None,
        team_type=None,
        capability=cap_contract,
        url=None,
    )
    app_capa = Application(
        name="CAPA App",
        description="Not yet built — a placeholder for corrective/preventive action tracking.",
        status="planned",
        owning_team=None,
        team_type=None,
        capability=cap_capa,
        url=None,
    )
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
        capability=cap_staffing,
        url=None,
    )
    db.session.add_all([
        app_value_stream, app_burnedvalue, app_winmax, app_costpoint,
        app_launchpad, app_sow_tracker, app_capa, app_staffing,
    ])
    db.session.flush()

    # ── One demo project, spanning Pursuit -> Award -> Execution ──
    project = Project(
        name="Demo: Bracket Assembly Program",
        customer="Acme Aerostructures",
        phase="execution",
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

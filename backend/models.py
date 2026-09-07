"""
SQLAlchemy models for Conway's Depot.

The Depot is a registry, not a platform: it never runs a workflow, calls another app's API, or
holds another app's data. It holds three things —

  * Project        the digital thread: one id, issued as early as Pursuit, that every
                    downstream system and app eventually references (see ExternalId — it
                    accumulates crosswalk entries, it never gets replaced).
  * Application     the catalog of domain apps: built, planned, or external (a real vendor
                    product like WinMax or Costpoint, registered but never integrated with).
  * Capability      the stable thing a project actually needs (TOGAF's Business Capability),
                    separate from whichever Application currently fulfills it — so a project's
                    history survives swapping BurnedValue for its eventual replacement.

ProjectAppLink is the only "integration" the Depot performs: a project, at a phase, has a
record in an application — a plain pointer (an id and/or a URL), never a live API call.

See the frontend's Theory of Operation page for the Conway's Law / Reverse Conway / Team
Topologies / Digital Thread grounding behind this shape.
"""

import json
from datetime import datetime, timezone

from db import _uuid, db

PHASES = ("pursuit", "award", "execution", "closeout")
TEAM_TYPES = ("stream-aligned", "platform", "enabling", "complicated-subsystem")
# "project" apps serve one project's lifecycle (WinMax, Value Stream). "organizational" apps are
# ISO/IEC/IEEE 15288's Organizational Project-Enabling Processes — staffing, HR, contract
# authoring — things the org maintains for every project at once. Orthogonal to team_type: an
# enabling *team* can build either kind of app; scope is about who the app serves, not who
# builds it.
APP_SCOPES = ("project", "organizational")

# The registry's browse taxonomy — an app-store "aisle". Stolen from ISO/IEC/IEEE 15288's
# process groups (the convention the org already runs on), plus a "general" bucket for tools
# that aren't tied to one lifecycle process:
#   agreement   — Agreement Processes: Acquisition, Supply (capture/pursuit, prime contracts,
#                 subcontract SOWs)
#   enterprise  — Organizational Project-Enabling / Enterprise Processes: portfolio, life-cycle
#                 model, infrastructure, resource/HR, quality, knowledge (staffing, identity,
#                 lessons-learned)
#   project     — Project (Management) Processes: planning, assessment, control, decision, risk,
#                 configuration, measurement, QA (plans, schedule, cost/EVM, VSM)
#   technical   — Technical Processes: stakeholder needs through disposal (requirements, design,
#                 implementation, integration, V&V, operation)
#   general     — not a 15288 group: serves every process (briefing decks, white-paper writers,
#                 the project wiki)
# Coarser than Application.capability, which stays the specific need an app fills *within* its
# category — the two-tier scheme.
APP_CATEGORIES = ("agreement", "enterprise", "project", "technical", "general")


def _now():
    return datetime.now(timezone.utc)


class Capability(db.Model):
    __tablename__ = "capability"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    name = db.Column(db.String(200), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)

    applications = db.relationship("Application", back_populates="capability")

    def to_dict(self) -> dict:
        return {"id": self.id, "name": self.name, "description": self.description}


class Application(db.Model):
    __tablename__ = "application"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    owning_team = db.Column(db.String(200), nullable=True)
    team_type = db.Column(db.String(30), nullable=True)  # see TEAM_TYPES
    # NB: an app is NOT tagged with a lifecycle phase. When a project reaches for an app is a
    # property of that project's link (ProjectAppLink.phase), not of the app — the registry
    # browses by category (below), the way an app store has aisles, not phases.
    # "project" (default) or "organizational" — see APP_SCOPES above.
    scope = db.Column(db.String(20), nullable=False, default="project")
    # The 15288-derived browse aisle — see APP_CATEGORIES. Nullable: an app can be uncategorized
    # (shows under "General" in the UI) until someone files it.
    category = db.Column(db.String(20), nullable=True)
    capability_id = db.Column(db.String(36), db.ForeignKey("capability.id"), nullable=True)
    # Base URL if this app is actually reachable somewhere (a real dev/prod URL) — a "test
    # drive" link into the running app, not tied to any project. Null for vendor products we
    # don't host and for anything not built yet.
    url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    capability = db.relationship("Capability", back_populates="applications")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "owning_team": self.owning_team,
            "team_type": self.team_type,
            "scope": self.scope,
            "category": self.category,
            "capability_id": self.capability_id,
            "capability_name": self.capability.name if self.capability else None,
            "url": self.url,
            "created_at": self.created_at.isoformat(),
        }


class Portfolio(db.Model):
    """A grouping of Projects — an internal organizational construct (a business line, a
    customer segment), not a lifecycle concept like phase. One Portfolio has many Projects;
    a Project's portfolio is optional, since not every project needs to be sorted into one
    right away. Mirrors BurnedValue's own Portfolio/Project relationship for the same reason
    Application Capabilities mirror TOGAF — reuse an established shape rather than invent one."""
    __tablename__ = "portfolio"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    projects = db.relationship("Project", back_populates="portfolio")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
        }


class Project(db.Model):
    __tablename__ = "project"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    name = db.Column(db.String(200), nullable=False)
    customer = db.Column(db.String(200), nullable=True)
    phase = db.Column(db.String(20), nullable=False, default="pursuit")  # see PHASES
    description = db.Column(db.Text, nullable=True)
    portfolio_id = db.Column(db.String(36), db.ForeignKey("portfolio.id"), nullable=True, index=True)
    # Project home base — the PM's working context for THIS project: a free-text team/notes
    # field and a list of comm-channel links ({"label", "url"}). "JSON in a Text column" for the
    # channel list — same convention BurnedValue uses for its own short lists — rather than a
    # child table for a short editable list. This is the project's own metadata, not another
    # application's data — the project detail page is the home base, so it lives here (this was
    # Launchpad's Workspace before Launchpad was folded in).
    team_notes = db.Column(db.Text, nullable=True)
    channels = db.Column(db.Text, nullable=True)
    # The delivery team's Team Topologies shape — one of TEAM_TYPES, or null if not set. A stub
    # for now (just the type); interaction modes and a real roster would be a future org-design
    # app's job. This is where reverse-Conway analysis lives — shape the team to get the
    # architecture — so it's a property of the project, not of any app.
    team_topology = db.Column(db.String(30), nullable=True)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now, nullable=False)

    portfolio = db.relationship("Portfolio", back_populates="projects")

    @property
    def channel_list(self) -> list[dict]:
        return json.loads(self.channels) if self.channels else []

    @channel_list.setter
    def channel_list(self, value: list[dict] | None) -> None:
        self.channels = json.dumps(list(value)) if value else None
    external_ids = db.relationship(
        "ExternalId", back_populates="project", cascade="all, delete-orphan", lazy="selectin"
    )
    app_links = db.relationship(
        "ProjectAppLink", back_populates="project", cascade="all, delete-orphan", lazy="selectin"
    )
    # Ordered oldest-first so the frontend can render it as a plain top-to-bottom timeline
    # without re-sorting. See ProjectPhaseEvent below for why this exists.
    phase_events = db.relationship(
        "ProjectPhaseEvent", back_populates="project", cascade="all, delete-orphan",
        lazy="selectin", order_by="ProjectPhaseEvent.occurred_at",
    )

    def to_dict(self, include_links: bool = True) -> dict:
        d = {
            "id": self.id,
            "name": self.name,
            "customer": self.customer,
            "phase": self.phase,
            "description": self.description,
            "portfolio_id": self.portfolio_id,
            "portfolio_name": self.portfolio.name if self.portfolio else None,
            "team_notes": self.team_notes,
            "channels": self.channel_list,
            "team_topology": self.team_topology,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "external_ids": [e.to_dict() for e in self.external_ids],
            "phase_events": [e.to_dict() for e in self.phase_events],
        }
        if include_links:
            d["app_links"] = [l.to_dict() for l in self.app_links]
        return d


class ExternalId(db.Model):
    """One crosswalk entry — "this project is Opportunity #8891 in WinMax". Accumulates over
    the project's life; never replaces the Depot's own id, which stays the stable spine."""
    __tablename__ = "external_id"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    project_id = db.Column(db.String(36), db.ForeignKey("project.id"), nullable=False, index=True)
    system = db.Column(db.String(100), nullable=False)  # e.g. "WinMax", "Costpoint"
    external_id = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    project = db.relationship("Project", back_populates="external_ids")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "system": self.system,
            "external_id": self.external_id,
            "created_at": self.created_at.isoformat(),
        }


class ProjectPhaseEvent(db.Model):
    """One phase transition, logged automatically whenever a Project's phase actually changes
    (see routes/projects.py's create_project/update_project — never written directly). This is
    what makes `phase` real lifecycle STATE rather than a decorative label: a bare current-value
    column can tell you where a project is right now, but never how long Pursuit actually took
    or when it was awarded — the exact questions "managing a lifecycle" implies answering.
    from_phase is null for the very first event (a project's initial phase at creation)."""
    __tablename__ = "project_phase_event"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    project_id = db.Column(db.String(36), db.ForeignKey("project.id"), nullable=False, index=True)
    from_phase = db.Column(db.String(20), nullable=True)
    to_phase = db.Column(db.String(20), nullable=False)
    occurred_at = db.Column(db.DateTime, default=_now, nullable=False)

    project = db.relationship("Project", back_populates="phase_events")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "from_phase": self.from_phase,
            "to_phase": self.to_phase,
            "occurred_at": self.occurred_at.isoformat(),
        }


class Person(db.Model):
    """A demo persona — NOT a user account. There is no password, session, or permission check
    anywhere behind this model: it exists only to illustrate the "in production a user is on a
    few projects, not all of them" shape. The nav's persona switcher picks one; list views then
    default to that person's projects, with an "All" toggle that hides nothing. `is_admin` just
    means "the everything view" (the Enterprise Architect seat) — it unlocks the ⚙ Admin nav
    link as signposting, not access control. Real identity/access is registered as a `planned`
    Capability ("Identity & Project Membership"), because it isn't built."""
    __tablename__ = "person"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    name = db.Column(db.String(200), nullable=False)
    title = db.Column(db.String(200), nullable=True)
    is_admin = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    memberships = db.relationship(
        "ProjectMembership", back_populates="person", cascade="all, delete-orphan",
        lazy="selectin",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "title": self.title,
            "is_admin": self.is_admin,
        }


class ProjectMembership(db.Model):
    """Persona ↔ project. `role_label` is a caption ("Program Manager", "Capture Manager"),
    never checked against anything — see Person's note on why none of this is enforcement."""
    __tablename__ = "project_membership"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    person_id = db.Column(db.String(36), db.ForeignKey("person.id"), nullable=False, index=True)
    project_id = db.Column(db.String(36), db.ForeignKey("project.id"), nullable=False, index=True)
    role_label = db.Column(db.String(100), nullable=True)

    person = db.relationship("Person", back_populates="memberships")
    project = db.relationship("Project")


class ProjectAppLink(db.Model):
    """The golden thread made visible: this project, at this phase, has a record in this
    application. external_ref and link_url are both optional, plain pointers — never a live
    API call. That's the entire "integration" the Depot performs."""
    __tablename__ = "project_app_link"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    project_id = db.Column(db.String(36), db.ForeignKey("project.id"), nullable=False, index=True)
    application_id = db.Column(
        db.String(36), db.ForeignKey("application.id"), nullable=False, index=True
    )
    phase = db.Column(db.String(20), nullable=False)  # see PHASES
    external_ref = db.Column(db.String(200), nullable=True)  # e.g. "map-4f2a", "OPP-8891"
    link_url = db.Column(db.String(500), nullable=True)  # full clickable deep link, if one exists
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    project = db.relationship("Project", back_populates="app_links")
    application = db.relationship("Application")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "application_id": self.application_id,
            "application_name": self.application.name if self.application else None,
            "phase": self.phase,
            "external_ref": self.external_ref,
            "link_url": self.link_url,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
        }

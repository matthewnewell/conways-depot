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
APP_STATUSES = ("built", "planned", "external")
TEAM_TYPES = ("stream-aligned", "platform", "enabling", "complicated-subsystem")
# "project" apps serve one project's lifecycle (WinMax, Value Stream, Launchpad — see
# Application.phases). "organizational" apps are ISO/IEC/IEEE 15288's Organizational
# Project-Enabling Processes (6.2) — staffing, HR, contract authoring — capabilities the org
# maintains for every project at once, not scoped to any single project's phase. Orthogonal to
# team_type: an enabling *team* can build either kind of app; scope is about who the app
# serves, not who builds it.
APP_SCOPES = ("project", "organizational")


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
    status = db.Column(db.String(20), nullable=False, default="planned")  # see APP_STATUSES
    owning_team = db.Column(db.String(200), nullable=True)
    team_type = db.Column(db.String(30), nullable=True)  # see TEAM_TYPES
    # The lifecycle phase(s) this application is reached for — WinMax at Pursuit only,
    # Launchpad across Award/Execution/Closeout, and so on. A JSON array of PHASES values,
    # same "JSON in a Text column" convention BurnedValue already uses for its own
    # deliverables/milestones fields, rather than a junction table for what's a small fixed
    # enum. Distinct from ProjectAppLink.phase (which phase a *specific project's* record in
    # this app belongs to): this is a property of the application itself. Empty/null for an
    # "organizational" scope app (see APP_SCOPES) — it isn't tied to any project's phase at all.
    phases = db.Column(db.Text, nullable=True)
    # "project" (default) or "organizational" — see APP_SCOPES above.
    scope = db.Column(db.String(20), nullable=False, default="project")
    capability_id = db.Column(db.String(36), db.ForeignKey("capability.id"), nullable=True)
    # Base URL if this app is actually reachable somewhere (a real dev/prod URL) — how the
    # Depot deep-links out to it. Null for external vendor products we don't host and for
    # planned apps that don't exist yet.
    url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    capability = db.relationship("Capability", back_populates="applications")

    @property
    def phase_list(self) -> list[str]:
        return json.loads(self.phases) if self.phases else []

    @phase_list.setter
    def phase_list(self, value: list[str] | None) -> None:
        self.phases = json.dumps(list(value)) if value else None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status,
            "owning_team": self.owning_team,
            "team_type": self.team_type,
            "phases": self.phase_list,
            "scope": self.scope,
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
    created_at = db.Column(db.DateTime, default=_now, nullable=False)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now, nullable=False)

    portfolio = db.relationship("Portfolio", back_populates="projects")
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
            "application_status": self.application.status if self.application else None,
            "phase": self.phase,
            "external_ref": self.external_ref,
            "link_url": self.link_url,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
        }

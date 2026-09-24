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
    # The 15288-derived browse aisle(s) — see APP_CATEGORIES. Stored as a comma-separated list
    # (e.g. "project,technical") so one app can be filed under more than one aisle — most apps
    # have exactly one. Nullable: an app can be uncategorized (shows under "General") until
    # someone files it. Use `category_list` / `to_dict()`'s `categories` to read it as a list.
    category = db.Column(db.String(60), nullable=True)
    capability_id = db.Column(db.String(36), db.ForeignKey("capability.id"), nullable=True)
    # Base URL if this app is actually reachable somewhere (a real dev/prod URL) — a "test
    # drive" link into the running app, not tied to any project. Null for vendor products we
    # don't host and for anything not built yet.
    url = db.Column(db.String(500), nullable=True)
    # The app's own BACKEND base URL — separate from `url` (its frontend) on purpose: the
    # Launchpad's summary contract (GET {api_url}/api/summary?project_id=) is a server-to-server
    # call the Depot's own backend makes, same as the existing /reachable probe, never something
    # the browser calls directly (would need CORS on every sibling app's Flask server for no
    # reason). Null means "no summary contract wired up yet" — a normal state, not an error; see
    # routes/applications.py's summary proxy route.
    api_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    capability = db.relationship("Capability", back_populates="applications")

    @property
    def category_list(self) -> list[str]:
        """`category` parsed into its component aisles — usually just one."""
        if not self.category:
            return []
        return [c.strip() for c in self.category.split(",") if c.strip()]

    def to_dict(self) -> dict:
        cats = self.category_list
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "owning_team": self.owning_team,
            "team_type": self.team_type,
            "scope": self.scope,
            # `category` stays the first aisle for older call sites; `categories` is the full
            # list an app can be filed under.
            "category": cats[0] if cats else None,
            "categories": cats,
            "capability_id": self.capability_id,
            "capability_name": self.capability.name if self.capability else None,
            "url": self.url,
            "api_url": self.api_url,
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
    # Shared jumpstation links (a portfolio-wide Teams team, SharePoint site, …) — the same
    # `[{label, url, kind?}]` JSON shape as Project.channels. Every project in the portfolio shows
    # these beneath its own links, so an owner doesn't re-enter them per project.
    channels = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    projects = db.relationship("Project", back_populates="portfolio")

    @property
    def channel_list(self) -> list[dict]:
        return json.loads(self.channels) if self.channels else []

    @channel_list.setter
    def channel_list(self, value: list[dict] | None) -> None:
        self.channels = json.dumps(list(value)) if value else None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "channels": self.channel_list,
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
    # Whether this project has a manufacturing component — another stub-for-a-future-app field,
    # same reasoning as team_topology above: it's a plain fact about the project, not any one
    # app's private data, even though MARTI is the first (and so far only) reader of it. It
    # stands in for a decision the not-yet-built "Project Planning" app will eventually own
    # authoritatively (planning a project that manufactures something should require a
    # manufacturing plan) — nullable because "unknown" is the honest default until someone,
    # or that future app, actually says yes or no.
    has_manufacturing = db.Column(db.Boolean, nullable=True)
    # A link to the contract itself (a SharePoint / contract-repository URL). A pointer, never a
    # copy — the Depot doesn't hold the document.
    contract_url = db.Column(db.String(500), nullable=True)
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
    memberships = db.relationship(
        "ProjectMembership", back_populates="project", cascade="all, delete-orphan", lazy="selectin"
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
            "portfolio_links": self.portfolio.channel_list if self.portfolio else [],
            "team_topology": self.team_topology,
            "has_manufacturing": self.has_manufacturing,
            "contract_url": self.contract_url,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "external_ids": [e.to_dict() for e in self.external_ids],
            "phase_events": [e.to_dict() for e in self.phase_events],
            "members": [m.to_dict() for m in self.memberships],
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


class JournalNote(db.Model):
    """A Depot-native journal entry — a person's own typed note, not read from any connected
    app. The "other" journal the original Launchpad brief asked for (a manually-authored note
    stream), sitting alongside the federated per-app aggregation every connected app's own
    journal already feeds into a project's Journal section (see routes/applications.py's
    /journal proxy). `to_entry_dict()` matches that exact {id, timestamp, author, summary, href}
    shape on purpose — a manual note and a federated entry merge into one feed with zero
    special-casing on the frontend.

    `project_id` is nullable: a note with a project is shared (visible to anyone looking at that
    project, same as a federated entry — the Depot has never gated content by membership). A
    note with `project_id IS NULL` is personal — "plan my day" material with no project yet —
    and is only ever queried back filtered to its own `person_id` (see routes/notes.py's
    /api/people/<id>/notes), the one place in this codebase real per-person filtering happens.
    Not access control in the auth sense (nothing here is, see Person's docstring) — just the
    same "personal notes aren't queried any other way" discipline Task Master's own per-person
    task board already relies on."""
    __tablename__ = "journal_note"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    project_id = db.Column(db.String(36), db.ForeignKey("project.id"), nullable=True, index=True)
    person_id = db.Column(db.String(36), db.ForeignKey("person.id"), nullable=True, index=True)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    person = db.relationship("Person")

    def to_entry_dict(self) -> dict:
        return {
            "id": self.id,
            "timestamp": self.created_at.isoformat(),
            "author": self.person.name if self.person else None,
            "summary": self.body,
            "href": f"/projects/{self.project_id}" if self.project_id else None,
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
    # A real S4 charge number for someone whose time isn't a project labor-plan position at all
    # (Business Development's proposal/capture time, for instance) — not tied to any one
    # project, since work like that charges to a standing indirect/overhead pool (e.g. Bid &
    # Proposal) rather than a project WBS. Nullable: most personas charge through an actual
    # LSD-modeled position instead (see routes/applications.py's /api/my-charges, which prefers
    # that and only falls back to this).
    standing_charge_number = db.Column(db.String(64), nullable=True)
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
    never checked against anything — see Person's note on why none of this is enforcement.

    `can_manage_members` is the one deliberate exception, per the Launchpad brief: "a table +
    one boolean, not named roles." It's still not real access control (nothing here is — see
    Person's docstring), but the frontend does read it to decide who sees the add/remove-member
    controls on a project, the same soft "signposting, not enforcement" the admin persona's
    ⚙ Admin link already gets. No named roles, no permission matrix — just this one flag."""
    __tablename__ = "project_membership"

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    person_id = db.Column(db.String(36), db.ForeignKey("person.id"), nullable=False, index=True)
    project_id = db.Column(db.String(36), db.ForeignKey("project.id"), nullable=False, index=True)
    role_label = db.Column(db.String(100), nullable=True)
    can_manage_members = db.Column(db.Boolean, nullable=False, default=False)

    person = db.relationship("Person", back_populates="memberships")
    project = db.relationship("Project", back_populates="memberships")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "person_id": self.person_id,
            "person_name": self.person.name if self.person else None,
            "project_id": self.project_id,
            "role_label": self.role_label,
            "can_manage_members": self.can_manage_members,
        }


class Pin(db.Model):
    """Person ↔ Application, for the Launchpad's Pinned Apps section. "My apps" means *this* —
    what a person chose to keep in front of them — not "apps I built" and not the flat union of
    apps reachable through project membership (that's `application_ids` on the /people
    response). Deliberately dumb: no note, no ordering field, just that the pin exists. Unique
    on (person_id, application_id) — pinning twice is a no-op, not a second row."""

    __tablename__ = "pin"
    __table_args__ = (db.UniqueConstraint("person_id", "application_id", name="uq_pin_person_app"),)

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    person_id = db.Column(db.String(36), db.ForeignKey("person.id"), nullable=False, index=True)
    application_id = db.Column(db.String(36), db.ForeignKey("application.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "person_id": self.person_id,
            "application_id": self.application_id,
            "created_at": self.created_at.isoformat(),
        }


class HiddenOrgApp(db.Model):
    """The other half of the Launchpad's Pinned Apps section: organizational-scope apps are
    pinned by *default* for everyone (they sit above any one project, so there's nothing to
    "choose" the way a project-scope app's Pin is a choice) — this table records the exception,
    a person who explicitly removed one from their own view. Computed, not stored: a brand new
    organizational app is automatically on for everyone the moment it's registered, no backfill
    row needed anywhere (see routes/people.py's pinned_application_ids). Only ever meaningful
    for an organizational-scope Application; a project-scope app's "off" state is already just
    the absence of a Pin row, so nothing here applies to those. Same shape as Pin on purpose —
    routes/pins.py's POST/DELETE branch on the app's scope and operate on whichever of the two
    tables actually applies, so the frontend's pin/unpin call never needs to know which one."""

    __tablename__ = "hidden_org_app"
    __table_args__ = (db.UniqueConstraint("person_id", "application_id", name="uq_hidden_person_app"),)

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    person_id = db.Column(db.String(36), db.ForeignKey("person.id"), nullable=False, index=True)
    application_id = db.Column(db.String(36), db.ForeignKey("application.id"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=_now, nullable=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "person_id": self.person_id,
            "application_id": self.application_id,
            "created_at": self.created_at.isoformat(),
        }


class PinOrder(db.Model):
    """One person's own drag-reordering of their Pinned Apps section — separate from Pin/
    HiddenOrgApp on purpose, since "is this app pinned" and "where does it sit in the list" are
    different questions: an organizational app is pinned without ever getting a Pin row, but it
    still needs somewhere to record a position once someone drags it. `position` is a plain
    integer, reassigned in full every time (routes/pins.py's reorder route deletes and
    recreates every row for a person in one call, matching the exact order it's handed) — never
    an ordering someone edits row by row, so there's nothing to keep in sync incrementally. An
    app with no row here just sorts after everything that has one, by name — see
    routes/people.py's pinned_application_ids for where that fallback is applied. A row left
    over after an app is unpinned or a preset removes it is harmless orphan data, same tolerance
    HiddenOrgApp already has for an app that's later deleted."""

    __tablename__ = "pin_order"
    __table_args__ = (db.UniqueConstraint("person_id", "application_id", name="uq_pinorder_person_app"),)

    id = db.Column(db.String(36), primary_key=True, default=_uuid)
    person_id = db.Column(db.String(36), db.ForeignKey("person.id"), nullable=False, index=True)
    application_id = db.Column(db.String(36), db.ForeignKey("application.id"), nullable=False, index=True)
    position = db.Column(db.Integer, nullable=False)


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

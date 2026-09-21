export type Phase = 'pursuit' | 'award' | 'execution' | 'closeout'
export const PHASES: Phase[] = ['pursuit', 'award', 'execution', 'closeout']

export type TeamType = 'stream-aligned' | 'platform' | 'enabling' | 'complicated-subsystem' | null

/** The delivery team's shape, from Team Topologies (Skelton & Pais). A stub on the project —
 * just the type for now. */
export type TeamTopology = 'stream-aligned' | 'platform' | 'enabling' | 'complicated-subsystem'
export const TEAM_TOPOLOGIES: TeamTopology[] = [
  'stream-aligned',
  'platform',
  'enabling',
  'complicated-subsystem',
]
export const TEAM_TOPOLOGY_INFO: Record<TeamTopology, { label: string; blurb: string }> = {
  'stream-aligned': {
    label: 'Stream-aligned',
    blurb: 'Owns one flow of work end to end for a product or business line. The default — most teams should be this.',
  },
  platform: {
    label: 'Platform',
    blurb: 'Provides internal services the stream-aligned teams build on, so they carry less to think about.',
  },
  enabling: {
    label: 'Enabling',
    blurb: 'Helps other teams pick up a new skill or practice, then steps away. Bridges capability gaps.',
  },
  'complicated-subsystem': {
    label: 'Complicated-subsystem',
    blurb: 'Owns a part that needs deep specialist knowledge — a heavy algorithm, a regulated component.',
  },
}

/** "project": serves one project's lifecycle. "organizational": ISO/IEC/IEEE 15288's
 * Organizational Project-Enabling Processes — staffing, HR, contract authoring — things the
 * org maintains for every project at once. Orthogonal to team_type. */
export type AppScope = 'project' | 'organizational'

/** The registry's browse aisle — ISO/IEC/IEEE 15288 process groups the org already runs on,
 * plus "general" for tools not tied to one lifecycle process (briefing decks, the wiki).
 * Coarser than `capability`, which is the specific need an app fills within its category. */
export type AppCategory = 'agreement' | 'enterprise' | 'project' | 'technical' | 'general'
export const APP_CATEGORIES: AppCategory[] = [
  'agreement',
  'project',
  'technical',
  'enterprise',
  'general',
]
export const CATEGORY_LABEL: Record<AppCategory, string> = {
  agreement: 'Agreements',
  enterprise: 'Organizational',
  project: 'Projects',
  technical: 'Technical',
  general: 'General',
}

/** What each category maps to in ISO/IEC/IEEE 15288, and the kind of tool that lives there —
 * drives the "?" legend on the registry filter. */
export const CATEGORY_INFO: Record<AppCategory, { group: string; covers: string }> = {
  agreement: {
    group: 'Agreement Processes — Acquisition, Supply',
    covers: 'Capture & pursuit, prime contracts, subcontract SOWs',
  },
  enterprise: {
    group: 'Organizational Project-Enabling Processes',
    covers: 'Staffing, identity & access, portfolio, lessons-learned',
  },
  project: {
    group: 'Project (Management) Processes',
    covers: 'Plans, schedule, cost / EVM, risk, configuration, measurement',
  },
  technical: {
    group: 'Technical Processes',
    covers: 'Requirements, design, implementation, integration, V&V, operation',
  },
  general: {
    group: 'Not a 15288 group',
    covers: 'Serves every process — briefing decks, white-paper writers, the wiki',
  },
}

export interface Capability {
  id: string
  name: string
  description: string | null
}

/** One external link on a project's jumpstation (Teams channel, SharePoint, Azure DevOps, …).
 * `kind` is optional — older entries predate it, and the UI falls back to detecting it from the
 * URL (see lib/links.ts). Stored in the project's `channels` JSON column, so no migration. */
export interface ChannelLink {
  label: string
  url: string
  kind?: 'teams' | 'sharepoint' | 'azure-devops' | 'document' | 'other'
}

export interface Application {
  id: string
  name: string
  description: string | null
  owning_team: string | null
  team_type: TeamType
  scope: AppScope
  /** The registry's browse aisle (15288 process group) — `categories[0]` for older call sites.
   *  Null = not filed yet → "General". */
  category: AppCategory | null
  /** Every aisle this app is filed under — most apps have exactly one, but an app can straddle
   *  more than one (e.g. a project-scoped tool that's also a Technical-process execution view). */
  categories: AppCategory[]
  /** The specific need this app fills within its category — the two-tier scheme. */
  capability_id: string | null
  capability_name: string | null
  url: string | null
  /** This app's own backend base URL — separate from `url` (its frontend). Only used
   * server-side, to call its /api/summary contract; null means no summary wired up yet. */
  api_url: string | null
  created_at: string
  /** How many distinct projects have a link to this application. Present on the list and
   * detail endpoints; a read on which catalog entries are actually load-bearing. */
  project_count: number
  /** Which projects connect this app, with the link id needed to remove each. Detail endpoint
   * only; the detail page filters it to the active persona's projects. */
  project_links?: AppProjectLink[]
}

/** One project↔app connection, seen from the app's side. */
export interface AppProjectLink {
  link_id: string
  project_id: string
  project_name: string
  phase: Phase
}

export interface ExternalId {
  id: string
  project_id: string
  system: string
  external_id: string
  created_at: string
}

/** One phase transition — from_phase is null for the very first event (the project's initial
 * phase at creation). Logged automatically server-side whenever phase actually changes; never
 * created or edited directly. This is what makes `phase` real lifecycle state instead of a
 * label: it's the record of when a project moved, not just where it is right now. */
export interface PhaseEvent {
  id: string
  project_id: string
  from_phase: Phase | null
  to_phase: Phase
  occurred_at: string
}

export interface ProjectAppLink {
  id: string
  project_id: string
  application_id: string
  application_name: string | null
  phase: Phase
  external_ref: string | null
  link_url: string | null
  notes: string | null
  created_at: string
}

export interface Portfolio {
  id: string
  name: string
  description: string | null
  /** Shared jumpstation links every project in the portfolio shows beneath its own. */
  channels: ChannelLink[]
  created_at: string
}

export interface ProjectSummary {
  id: string
  name: string
  customer: string | null
  phase: Phase
  description: string | null
  portfolio_id: string | null
  portfolio_name: string | null
  /** Project home base — the PM's working context for this project (was Launchpad's
   * Workspace before Launchpad was folded into the project detail page). */
  team_notes: string | null
  channels: ChannelLink[]
  /** The project's portfolio's shared links (read-only here; edited on the Admin page). */
  portfolio_links: ChannelLink[]
  /** The delivery team's Team Topologies shape — a stub, edited on the project detail page. */
  team_topology: TeamTopology | null
  /** Whether this project has a manufacturing component — another stub, provisional until a
   * future Project Planning app owns this decision authoritatively. Null = unknown/unset. */
  has_manufacturing: boolean | null
  /** Link to the contract itself (a pointer to a SharePoint / repository document). */
  contract_url: string | null
  created_at: string
  updated_at: string
  external_ids: ExternalId[]
  phase_events: PhaseEvent[]
  members: ProjectMembership[]
  /** How many applications this project connects to — present on the list endpoint only (the
   * detail endpoint carries the full `app_links` instead). Mirror of Application.project_count. */
  app_count?: number
}

export interface ProjectDetail extends ProjectSummary {
  app_links: ProjectAppLink[]
}

/** A real (if still unenforced — see Person's own note below) person on a project. */
export interface ProjectMembership {
  id: string
  person_id: string
  person_name: string | null
  project_id: string
  /** Free-text caption ("Program Manager"), never checked against anything. */
  role_label: string | null
  /** The one deliberate exception to "nothing here is enforcement" — see backend
   * ProjectMembership's own docstring. Still just a flag the frontend reads to decide who sees
   * the add/remove-member controls, not real access control; no named roles beyond this. */
  can_manage_members: boolean
}

/** A demo persona for the nav's "viewing as" switcher — NOT a user account. There is no
 * password, session, or permission check behind it: it only drives a default "my projects /
 * my apps" view with an "all" toggle that hides nothing. `is_admin` means "the everything
 * seat" (Enterprise Architect) and just surfaces the ⚙ Admin link. See backend models.Person. */
/** One of a persona's projects, with the apps that project connects to — drives the grouped
 * "My Project Apps" view on the registry. */
export interface PersonProject {
  id: string
  name: string
  phase: Phase
  application_ids: string[]
  /** The Launchpad's membership tag — real free text on file ("Program Manager"), not a role
   * enum. Null for the admin persona (not a real member of anything) and for a project reached
   * only by pin, once pins cover projects too — the frontend labels those cases itself. */
  role_label: string | null
  /** False for the admin persona's synthetic entries here — OR this with `Person.is_admin`
   * wherever gating who sees the member-management controls, same as every other admin-only
   * affordance in this app. */
  can_manage_members: boolean
}

export interface Person {
  id: string
  name: string
  title: string | null
  is_admin: boolean
  /** Projects this persona is on (all of them, for the admin persona). */
  projects: PersonProject[]
  /** Flat list of the project ids above. */
  project_ids: string[]
  /** Flat union of every app id any of this persona's projects connects to. */
  application_ids: string[]
  /** Apps this persona pinned to their own Launchpad — "my apps" means this, not "apps I
   * built" and not the flat union above. */
  pinned_application_ids: string[]
}

/** The Launchpad's app-summary contract — an app's own backend decides what its tile shows;
 * the Depot renders this opaquely and never interprets `headline`/`label`. `status` drives the
 * tile's accent color only. `null` fields (or the whole thing being the "no summary published"
 * shape) are a normal, expected state, not an error. */
export interface AppSummary {
  headline: string | null
  label: string | null
  status: 'ok' | 'warn' | 'critical' | null
  href: string | null
}

/** The Launchpad's cross-app journal contract — one entry from one sibling app's own journal.
 * `summary` is pre-rendered by that app; the Depot never parses it back apart, same as it
 * never interprets an AppSummary's headline/label. An empty `entries` list is a normal state
 * (no api_url wired up, nothing logged yet, the app not running), not an error. */
export interface JournalEntry {
  id: string
  timestamp: string
  author: string | null
  summary: string
  href: string | null
}

export interface Pin {
  id: string
  person_id: string
  application_id: string
  created_at: string
}

/** A curated "starting set of pins for my role" — see backend presets.py. Applying one
 * replaces the whole pinned set outright, not a merge; "default" is exactly the organizational
 * apps and nothing else, so it doubles as the Launchpad's reset-my-pins action. Not a role
 * system — nothing here is stored on a person, it's a one-time action. */
export interface PinPreset {
  key: string
  label: string
  description: string
  application_ids: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResult {
  reply: string
  error?: string
  /** True when the assistant actually triggered its one real action (currently: Task Master's
   * own "Suggest backlog items") rather than just talking about it — see routes/ai.py. */
  action_taken?: boolean
}

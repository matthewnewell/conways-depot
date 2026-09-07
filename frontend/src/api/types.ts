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
  'enterprise',
  'project',
  'technical',
  'general',
]
export const CATEGORY_LABEL: Record<AppCategory, string> = {
  agreement: 'Agreement',
  enterprise: 'Enterprise',
  project: 'Project',
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

/** One comm-channel link on a project's home base. */
export interface ChannelLink {
  label: string
  url: string
}

export interface Application {
  id: string
  name: string
  description: string | null
  owning_team: string | null
  team_type: TeamType
  scope: AppScope
  /** The registry's browse aisle (15288 process group). Null = not filed yet → "General". */
  category: AppCategory | null
  /** The specific need this app fills within its category — the two-tier scheme. */
  capability_id: string | null
  capability_name: string | null
  url: string | null
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
  /** The delivery team's Team Topologies shape — a stub, edited on the project detail page. */
  team_topology: TeamTopology | null
  created_at: string
  updated_at: string
  external_ids: ExternalId[]
  phase_events: PhaseEvent[]
  /** How many applications this project connects to — present on the list endpoint only (the
   * detail endpoint carries the full `app_links` instead). Mirror of Application.project_count. */
  app_count?: number
}

export interface ProjectDetail extends ProjectSummary {
  app_links: ProjectAppLink[]
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
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResult {
  reply: string
  error?: string
}

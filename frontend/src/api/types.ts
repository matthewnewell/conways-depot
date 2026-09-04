export type Phase = 'pursuit' | 'award' | 'execution' | 'closeout'
export const PHASES: Phase[] = ['pursuit', 'award', 'execution', 'closeout']

export type AppStatus = 'built' | 'planned' | 'external'
export type TeamType = 'stream-aligned' | 'platform' | 'enabling' | 'complicated-subsystem' | null

/** "project": serves one project's lifecycle (see Application.phases). "organizational":
 * ISO/IEC/IEEE 15288's Organizational Project-Enabling Processes (6.2) — staffing, HR,
 * contract authoring — capabilities the org maintains for every project at once, not scoped
 * to any single project's phase. Orthogonal to team_type. */
export type AppScope = 'project' | 'organizational'

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
  status: AppStatus
  owning_team: string | null
  team_type: TeamType
  scope: AppScope
  /** The lifecycle phase(s) this application is reached for — a property of the application
   * itself, distinct from ProjectAppLink.phase (which phase a specific project's record in it
   * belongs to). Empty for an "organizational"-scope application: it isn't tied to any
   * project's phase at all. */
  phases: Phase[]
  capability_id: string | null
  capability_name: string | null
  url: string | null
  created_at: string
  /** How many distinct projects have a link to this application. Present on the list and
   * detail endpoints; a read on which catalog entries are actually load-bearing. */
  project_count: number
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
  application_status: AppStatus | null
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
  created_at: string
  updated_at: string
  external_ids: ExternalId[]
  phase_events: PhaseEvent[]
}

export interface ProjectDetail extends ProjectSummary {
  app_links: ProjectAppLink[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResult {
  reply: string
  error?: string
}

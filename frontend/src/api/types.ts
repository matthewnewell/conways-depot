export type Phase = 'pursuit' | 'award' | 'execution' | 'closeout'
export const PHASES: Phase[] = ['pursuit', 'award', 'execution', 'closeout']

export type AppStatus = 'built' | 'planned' | 'external'
export type TeamType = 'stream-aligned' | 'platform' | 'enabling' | 'complicated-subsystem' | null

export interface Capability {
  id: string
  name: string
  description: string | null
}

export interface Application {
  id: string
  name: string
  description: string | null
  status: AppStatus
  owning_team: string | null
  team_type: TeamType
  /** The lifecycle phase this application is primarily reached for — a property of the
   * application itself, distinct from ProjectAppLink.phase (which phase a specific project's
   * record in it belongs to). Nullable: not every application maps to a single phase. */
  phase: Phase | null
  capability_id: string | null
  capability_name: string | null
  url: string | null
  created_at: string
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

export interface ProjectSummary {
  id: string
  name: string
  customer: string | null
  phase: Phase
  description: string | null
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

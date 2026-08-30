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

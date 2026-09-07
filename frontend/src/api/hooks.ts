import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type {
  Application,
  Capability,
  ChatMessage,
  ChatResult,
  ExternalId,
  Person,
  Phase,
  Portfolio,
  ProjectAppLink,
  ProjectDetail,
  ProjectSummary,
} from './types'

// ── Projects ─────────────────────────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<ProjectSummary[]>('/projects'),
  })
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<ProjectDetail>(`/projects/${id}`),
    enabled: !!id,
  })
}

function useInvalidateProject(id: string | undefined) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['projects', id] })
    qc.invalidateQueries({ queryKey: ['projects'] })
  }
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      customer?: string
      phase?: Phase
      description?: string
      portfolio_id?: string
    }) => api.post<ProjectDetail>('/projects', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject(id: string) {
  const invalidate = useInvalidateProject(id)
  return useMutation({
    mutationFn: (
      data: Partial<
        Pick<
          ProjectSummary,
          | 'name'
          | 'customer'
          | 'phase'
          | 'description'
          | 'portfolio_id'
          | 'team_notes'
          | 'channels'
          | 'team_topology'
        >
      >,
    ) => api.put<ProjectDetail>(`/projects/${id}`, data),
    onSuccess: invalidate,
  })
}

export function usePortfolios() {
  return useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api.get<Portfolio[]>('/portfolios'),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useAddExternalId(projectId: string) {
  const invalidate = useInvalidateProject(projectId)
  return useMutation({
    mutationFn: (data: { system: string; external_id: string }) =>
      api.post<ExternalId>(`/projects/${projectId}/external-ids`, data),
    onSuccess: invalidate,
  })
}

export function useDeleteExternalId(projectId: string) {
  const invalidate = useInvalidateProject(projectId)
  return useMutation({
    mutationFn: (externalIdRowId: string) => api.del<void>(`/external-ids/${externalIdRowId}`),
    onSuccess: invalidate,
  })
}

export function useCreateLink(projectId: string) {
  const invalidate = useInvalidateProject(projectId)
  return useMutation({
    mutationFn: (data: {
      application_id: string
      phase: Phase
      external_ref?: string
      link_url?: string
      notes?: string
    }) => api.post<ProjectAppLink>(`/projects/${projectId}/links`, data),
    onSuccess: invalidate,
  })
}

export function useDeleteLink(projectId: string) {
  const invalidate = useInvalidateProject(projectId)
  return useMutation({
    mutationFn: (linkId: string) => api.del<void>(`/links/${linkId}`),
    onSuccess: invalidate,
  })
}

// ── Applications & Capabilities ─────────────────────────────────────────────

export function useApplications() {
  return useQuery({
    queryKey: ['applications'],
    queryFn: () => api.get<Application[]>('/applications'),
  })
}

export function useApplication(id: string | undefined) {
  return useQuery({
    queryKey: ['applications', id],
    queryFn: () => api.get<Application>(`/applications/${id}`),
    enabled: !!id,
  })
}

/** Is this app's URL responding right now — so "Test drive" doesn't hand you a dead tab. */
export function useAppReachable(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['applications', id, 'reachable'],
    queryFn: () => api.get<{ url: string | null; reachable: boolean }>(`/applications/${id}/reachable`),
    enabled,
    staleTime: 15_000,
    retry: false,
  })
}

/** Everything the "Connected projects" controls on the app detail page touch: the app itself
 * (project_links / project_count), the whole app list, every project's app set, and the
 * persona breakdown. */
function useInvalidateAppConnections(applicationId: string) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['applications', applicationId] })
    qc.invalidateQueries({ queryKey: ['applications'] })
    qc.invalidateQueries({ queryKey: ['projects'] })
    qc.invalidateQueries({ queryKey: ['people'] })
  }
}

/** Connect this app to one of the persona's projects — a "quick add": phase defaults to the
 * project's current phase, nothing else asked. */
export function useConnectAppToProject(applicationId: string) {
  const invalidate = useInvalidateAppConnections(applicationId)
  return useMutation({
    mutationFn: ({ projectId, phase }: { projectId: string; phase: Phase }) =>
      api.post<ProjectAppLink>(`/projects/${projectId}/links`, {
        application_id: applicationId,
        phase,
      }),
    onSuccess: invalidate,
  })
}

export function useDisconnectAppFromProject(applicationId: string) {
  const invalidate = useInvalidateAppConnections(applicationId)
  return useMutation({
    mutationFn: (linkId: string) => api.del<void>(`/links/${linkId}`),
    onSuccess: invalidate,
  })
}

export function useCapabilities() {
  return useQuery({
    queryKey: ['capabilities'],
    queryFn: () => api.get<Capability[]>('/capabilities'),
  })
}

// ── People (demo personas) ───────────────────────────────────────────────────

export function usePeople() {
  return useQuery({
    queryKey: ['people'],
    queryFn: () => api.get<Person[]>('/people'),
    staleTime: 5 * 60_000,
  })
}

// ── Health ───────────────────────────────────────────────────────────────────

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<{ status: string; ai_configured: boolean }>('/health'),
    staleTime: 60_000,
  })
}

// ── AI chat ──────────────────────────────────────────────────────────────────

/** Stateless, same as Value Stream's: the caller resends the full message list each call.
 * `projectId` scopes the context server-side — omit it for the portfolio-wide view. */
export function useDepotChat() {
  return useMutation({
    mutationFn: ({ messages, projectId }: { messages: ChatMessage[]; projectId?: string }) =>
      api.post<ChatResult>('/chat', { messages, project_id: projectId }),
  })
}

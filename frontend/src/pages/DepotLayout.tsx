import { DrawerLayout } from '@conways/drawer'
import { Outlet, useParams } from 'react-router-dom'
import { useHealth, useProject } from '../api/hooks'
import DepotNav from '../components/DepotNav'
import { usePersona } from '../lib/persona'
import { ProjectAdminPanel, ProjectInfoPanel, ProjectTeamPanel } from './ProjectDetailPage'
import './DepotLayout.css'

/** Shared parent for every operational route (Launchpad, project list/detail, catalog). The
 * Agent | Journal side panel is the ecosystem-wide shared drawer (@conways/drawer) — the same
 * one Value Stream and MARTI use. On a project page it's scoped to that project; everywhere
 * else (the Launchpad above all) it's person-scoped: the Journal opens on the active persona's
 * personal "My day" feed with a picker for any of their projects, and the Agent works across
 * the portfolio. The splash page sits outside this layout on purpose (a one-time explainer
 * doesn't need a persistent drawer). */
export default function DepotLayout() {
  const { projectId } = useParams<{ projectId?: string }>()
  const { data: health } = useHealth()
  const { persona } = usePersona()
  const { data: project } = useProject(projectId)

  // On a project page the drawer gains three tabs at the top of its rail — the project's own
  // Info / Team / Admin — alongside the usual Agent and Journal at the bottom.
  const tabs = project
    ? [
        { id: 'info', icon: 'ℹ️', label: 'Project info', content: <ProjectInfoPanel project={project} /> },
        { id: 'team', icon: '👥', label: 'Team', content: <ProjectTeamPanel project={project} /> },
        { id: 'admin', icon: '⚙️', label: 'Admin', wide: true, content: <ProjectAdminPanel project={project} /> },
      ]
    : []

  return (
    <div className="depot-layout">
      <DepotNav />
      <DrawerLayout
        storageKey="conways-depot:drawer"
        scrollMain={false}
        tabs={tabs}
        agent={{
          chatUrl: '/api/chat',
          aiConfigured: health?.ai_configured ?? false,
          chatExtra: { project_id: projectId, person_id: persona?.id },
          // Fresh conversation on a real context switch (portfolio <-> a specific project).
          resetKey: projectId ?? 'portfolio',
          intro: projectId
            ? 'Ask about this project — its apps, phase, team, and where the gaps are.'
            : 'Ask about your projects and the app catalog — which app fits a need, where the gaps are, who owns what.',
        }}
        journal={{
          projectId,
          personId: persona?.id,
          projects: (persona?.projects ?? []).map((p) => ({ id: p.id, name: p.name })),
        }}
      >
        <Outlet />
      </DrawerLayout>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { useApplications, useProjects, useUnpinApp } from '../api/hooks'
import type { Application, Phase, PersonProject } from '../api/types'
import { usePersona } from '../lib/persona'
import AppSummaryTile from '../components/AppSummaryTile'
import './depot-shared.css'
import './LaunchpadPage.css'

const PHASE_LABEL: Record<Phase, string> = {
  pursuit: 'Pursuit',
  award: 'Award',
  execution: 'Execution',
  closeout: 'Closeout',
}

/** The Depot's landing page — a shell now, not just the catalog. Three sections, in an order
 * that encodes real hierarchy: Organizational things genuinely sit above projects (they aren't
 * owned by any one of them), so they render first; Pinned is a person's own personalization on
 * top of that; My projects is the actual work. The catalog itself moved to /catalog — this page
 * is what you land on, browsing by category is a deliberate second step now, same as Featured
 * did for the catalog. */
export default function LaunchpadPage() {
  const navigate = useNavigate()
  const { persona } = usePersona()
  const { data: applications, isLoading: appsLoading } = useApplications()
  const { data: allProjects } = useProjects()
  const unpinApp = useUnpinApp()

  const orgApps = (applications ?? []).filter((a) => a.scope === 'organizational')
  const pinnedApps = (applications ?? [])
    .filter((a) => persona?.pinned_application_ids.includes(a.id))
    // Keep pin order stable and independent of the app list's own order.
    .sort((a, b) => (persona?.pinned_application_ids.indexOf(a.id) ?? 0) - (persona?.pinned_application_ids.indexOf(b.id) ?? 0))

  const myProjects = persona?.projects ?? []
  const reachCount = persona?.project_ids.length ?? 0
  const totalProjects = allProjects?.length ?? reachCount

  function AppCard({ app }: { app: Application }) {
    const pinned = !!persona?.pinned_application_ids.includes(app.id)
    return (
      <div className="lp-app-card">
        <button className="lp-app-card__main" onClick={() => navigate(`/catalog/${app.id}`)}>
          <span className="lp-app-card__name">{app.name}</span>
          {app.capability_name && <span className="lp-app-card__cap">{app.capability_name}</span>}
          <AppSummaryTile applicationId={app.id} />
        </button>
        {persona && pinned && (
          <button
            className="lp-app-card__unpin"
            title={`Unpin ${app.name}`}
            onClick={() => unpinApp.mutate({ personId: persona.id, applicationId: app.id })}
          >
            ✕
          </button>
        )}
      </div>
    )
  }

  function ProjectCard({ proj }: { proj: PersonProject }) {
    const tag = persona?.is_admin ? 'Admin' : proj.role_label ?? '—'
    const chipApps = proj.application_ids.slice(0, 4)
    return (
      <button className="lp-project-card" onClick={() => navigate(`/projects/${proj.id}`)}>
        <div className="lp-project-card__top">
          <span className="lp-project-card__name">{proj.name}</span>
          <span className="lp-project-card__tag">{tag}</span>
        </div>
        <div className="lp-project-card__phase">{PHASE_LABEL[proj.phase]}</div>
        {chipApps.length > 0 && (
          <div className="lp-project-card__chips">
            {chipApps.map((appId) => (
              <div className="lp-chip" key={appId}>
                <AppSummaryTile applicationId={appId} projectId={proj.id} />
              </div>
            ))}
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="launchpad-page">
      <div className="launchpad-page__content">
        <header className="launchpad-page__header">
          <h1 className="launchpad-page__title">
            {persona ? `Welcome, ${persona.name}.` : 'Launchpad'}
          </h1>
        </header>

        <section className="lp-section">
          <div className="lp-section__head">
            <span className="lp-section__title">Organizational</span>
            <span className="lp-section__hint">above any project</span>
          </div>
          {appsLoading ? (
            <p className="launchpad-page__loading">Loading…</p>
          ) : orgApps.length === 0 ? (
            <p className="lp-section__empty">No organizational apps registered yet.</p>
          ) : (
            <div className="lp-app-grid">
              {orgApps.map((a) => <AppCard app={a} key={a.id} />)}
            </div>
          )}
        </section>

        <section className="lp-section">
          <div className="lp-section__head">
            <span className="lp-section__title">Pinned apps</span>
            <button className="lp-section__link" onClick={() => navigate('/catalog')}>Browse catalog →</button>
          </div>
          {appsLoading ? (
            <p className="launchpad-page__loading">Loading…</p>
          ) : pinnedApps.length === 0 ? (
            <p className="lp-section__empty">Nothing pinned yet — pin an app from the catalog to keep it here.</p>
          ) : (
            <div className="lp-app-grid">
              {pinnedApps.map((a) => <AppCard app={a} key={a.id} />)}
            </div>
          )}
        </section>

        <section className="lp-section">
          <div className="lp-section__head">
            <span className="lp-section__title">My projects</span>
            <span className="lp-section__hint">{reachCount} of {totalProjects} in reach</span>
            <button className="lp-section__link" onClick={() => navigate('/projects')}>All projects →</button>
          </div>
          {myProjects.length === 0 ? (
            <p className="lp-section__empty">
              {persona ? `${persona.name} isn't on any projects yet.` : 'Loading…'}
            </p>
          ) : (
            <div className="lp-project-grid">
              {myProjects.map((p) => <ProjectCard proj={p} key={p.id} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

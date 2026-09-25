import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useAppReachable,
  useApplications,
  useProjects,
  useReorderPins,
} from '../api/hooks'
import type { Application, Phase, PersonProject } from '../api/types'
import { builtByOther } from '../lib/apps'
import { usePersona } from '../lib/persona'
import AppSummaryTile from '../components/AppSummaryTile'
import PinToggle from '../components/PinToggle'
import { withDepotOrigin } from '../lib/launch'
import './depot-shared.css'
import './LaunchpadPage.css'

const PHASE_LABEL: Record<Phase, string> = {
  pursuit: 'Pursuit',
  award: 'Award',
  execution: 'Execution',
  closeout: 'Closeout',
}

/** The Depot's landing page — a shell now, not just the catalog. Three sections: Pinned apps,
 * My projects, then Recent activity. Pinned used to sit below a separate always-shown
 * "Organizational" section — merged the two (see backend models.HiddenOrgApp): an
 * organizational app is pinned by *default* for everyone, since it sits above any one project
 * and there's nothing to "choose" the way a project-scope app's pin is a choice. Showing it
 * unconditionally in its own section and then asking people to separately pin things was the
 * same list, twice. Anyone who doesn't want a given org app on their own Launchpad can remove
 * it — via the ✕ here, or Reset it back from the Catalog — same PinToggle control as everywhere
 * else. Pinned Apps is drag-reorderable (see models.PinOrder). Recent activity used to be a
 * third section here — moved to DepotLayout's own collapsible 📝 Journal panel (available on
 * every page now, not just found by scrolling this one), see JournalPanel.tsx. The catalog
 * itself moved to /catalog — this page is what you land on, browsing by category is a
 * deliberate second step now, same as Featured did for the catalog. */
export default function LaunchpadPage() {
  const navigate = useNavigate()
  const { persona } = usePersona()
  const { data: applications, isLoading: appsLoading } = useApplications()
  const { data: allProjects } = useProjects()
  const reorderPins = useReorderPins()

  const serverPinnedApps = (applications ?? [])
    .filter((a) => persona?.pinned_application_ids.includes(a.id))
    // Keep pin order stable and independent of the app list's own order.
    .sort((a, b) => (persona?.pinned_application_ids.indexOf(a.id) ?? 0) - (persona?.pinned_application_ids.indexOf(b.id) ?? 0))

  // A local override during/just after a drag — the server round-trip (invalidate + refetch)
  // takes a beat, and re-sorting by the stale server order for that beat would visibly snap the
  // card back before snapping forward again. Cleared whenever the underlying *set* of pinned
  // ids changes (a pin/unpin, a preset applied) so it never goes stale; a pure reorder of the
  // same set (this component's own doing) leaves the set unchanged, so the override survives
  // exactly as long as it needs to.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null)
  const serverIdSet = [...(persona?.pinned_application_ids ?? [])].sort().join(',')
  useEffect(() => {
    setLocalOrder(null)
  }, [serverIdSet])

  const pinnedApps = localOrder
    ? (localOrder
        .map((id) => serverPinnedApps.find((a) => a.id === id))
        .filter((a): a is Application => !!a))
    : serverPinnedApps

  const [dragId, setDragId] = useState<string | null>(null)

  function handleDrop(targetId: string) {
    if (!persona || !dragId || dragId === targetId) {
      setDragId(null)
      return
    }
    const ids = pinnedApps.map((a) => a.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    setDragId(null)
    if (from === -1 || to === -1) return
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, dragId)
    setLocalOrder(next)
    reorderPins.mutate({ person_id: persona.id, application_ids: next })
  }

  const myProjects = persona?.projects ?? []
  const reachCount = persona?.project_ids.length ?? 0
  const totalProjects = allProjects?.length ?? reachCount

  function AppCard({ app }: { app: Application }) {
    // A pinned app on the Launchpad is one you've already adopted — selecting it should open
    // the app itself, straight to whatever it considers home (Task Master's own board, Value
    // Stream's map list, ...), not "Test drive"'s /about splash (that's the catalog's
    // try-it-out door, a different action) and not this Depot's own read-only detail page.
    // person_id rides along the same way Test drive's link already does — most apps ignore it,
    // an identity-sharing app like Task Master picks it up instead of asking you to re-pick who
    // you are a second time. Falls back to the detail page when there's nothing to launch yet
    // (no url — not built/vendor) or the app isn't actually up right now.
    const { data: reachData } = useAppReachable(app.id, !!app.url)
    const canLaunch = !!app.url && (reachData?.reachable ?? false)
    const launchUrl = app.url ? withDepotOrigin(app.url, '/', persona?.id) : app.url

    const cardBody = (
      <>
        <span className="lp-app-card__name">{app.name}</span>
        {app.capability_name && <span className="lp-app-card__cap">{app.capability_name}</span>}
        {builtByOther(app) && <span className="built-by">Built by {builtByOther(app)}</span>}
        {/* A pinned app's tile is about you: apps that keep per-person data (Task Master) count
            only yours. Project chips below stay project-wide. */}
        <AppSummaryTile applicationId={app.id} personId={persona?.id} />
      </>
    )

    return (
      <div
        className={`lp-app-card ${dragId === app.id ? 'lp-app-card--dragging' : ''}`}
        draggable
        onDragStart={() => setDragId(app.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          handleDrop(app.id)
        }}
        onDragEnd={() => setDragId(null)}
        title="Drag to reorder"
      >
        {canLaunch && launchUrl ? (
          <a className="lp-app-card__main" href={launchUrl} target="_self">
            {cardBody}
          </a>
        ) : (
          <button className="lp-app-card__main" onClick={() => navigate(`/catalog/${app.id}`)}>
            {cardBody}
          </button>
        )}
        <div className="lp-app-card__unpin">
          <PinToggle app={app} />
        </div>
      </div>
    )
  }

  function ProjectCard({ proj }: { proj: PersonProject }) {
    const chipApps = proj.application_ids.slice(0, 4)
    return (
      <button className="lp-project-card" onClick={() => navigate(`/projects/${proj.id}`)}>
        <div className="lp-project-card__top">
          <span className="lp-project-card__name">{proj.name}</span>
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
        <section className="lp-section">
          <div className="lp-section__head">
            <span className="lp-section__title">Pinned apps</span>
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

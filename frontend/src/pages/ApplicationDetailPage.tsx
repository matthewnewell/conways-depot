import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useAppReachable,
  useApplication,
  useConnectAppToProject,
  useDisconnectAppFromProject,
} from '../api/hooks'
import type { Application, Phase } from '../api/types'
import { CATEGORY_LABEL } from '../api/types'
import { OUTBOUND_TARGET } from '../lib/embed'
import { usePersona } from '../lib/persona'
import './depot-shared.css'
import './ApplicationDetailPage.css'

/** The "show page" for one Application — an app-store product page: name + description on the
 * left, a right-hand rail with the Test Drive / Projects actions, how many projects use it, and
 * a compact Registry tile underneath. */
export default function ApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>()
  const { data: app, isLoading } = useApplication(applicationId)

  if (!applicationId) return null
  if (isLoading || !app) return <div className="app-detail-page__loading">Loading…</div>

  const categories = app.categories?.length ? app.categories : [app.category ?? 'general']

  return (
    <div className="app-detail-page">
      <div className="app-detail-page__content">
        <header className="app-detail-page__header">
          <div className="app-detail-page__headline">
            <h1 className="app-detail-page__title">{app.name}</h1>
            <p className="app-detail-page__lede">
              {app.description || 'No description recorded.'}
            </p>
          </div>

          <aside className="app-detail-page__side">
            <div className="app-detail-page__actions-row">
              {app.url ? (
                <TestDrive appId={app.id} url={app.url} />
              ) : (
                <span className="app-detail-page__testdrive-off">No demo yet</span>
              )}
              <ProjectLinksControl app={app} />
            </div>
            <p className="app-detail-page__using-count">
              {app.project_count === 0
                ? 'Not used by any project yet'
                : `Used by ${app.project_count} project${app.project_count === 1 ? '' : 's'}`}
            </p>

            <div className="app-detail-page__registry-tile">
              <h2 className="app-detail-page__registry-heading">Registry</h2>
              <RegistryRow label="Category" value={categories.map((c) => CATEGORY_LABEL[c]).join(', ')} />
              <RegistryRow label="Capability" value={app.capability_name ?? '—'} />
              <RegistryRow label="Owning team" value={app.owning_team ?? '—'} />
            </div>
          </aside>
        </header>
      </div>
    </div>
  )
}

function RegistryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-detail-page__registry-row">
      <span className="app-detail-page__registry-label">{label}</span>
      <span className="app-detail-page__registry-value">{value}</span>
    </div>
  )
}

/** "Test drive" — a clean button into the running app (demo mode, no project), plus a live
 * "running / not running" probe so you don't get handed a dead tab. No launching — you start
 * the app yourself; this just checks whether it's up. */
function TestDrive({ appId, url }: { appId: string; url: string }) {
  const { data, isLoading, refetch, isFetching } = useAppReachable(appId, true)
  const reachable = data?.reachable ?? false

  return (
    <div className="app-detail-page__testdrive">
      {reachable ? (
        <a
          className="depot-btn depot-btn--primary"
          href={url}
          target={OUTBOUND_TARGET}
          rel="noreferrer"
        >
          Test drive →
        </a>
      ) : (
        <span className="app-detail-page__testdrive-off">Test drive →</span>
      )}
      <div className="app-detail-page__testdrive-meta">
        <span className="app-detail-page__testdrive-state">
          {isLoading ? 'checking…' : reachable ? 'running' : 'not running'}
        </span>
        {!isLoading && !reachable && (
          <button
            className="app-detail-page__testdrive-recheck"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? 'checking…' : 'check again'}
          </button>
        )}
      </div>
    </div>
  )
}

/** "Projects" — a single checklist dropdown that replaces both the old Add-to-project select
 * and the standalone "Connected projects" card: check a project to connect this app to it,
 * uncheck to remove the connection. Closes on outside-click or Escape (same recipe as
 * InfoPopover). Renders nothing once the persona has no projects to offer at all. */
function ProjectLinksControl({ app }: { app: Application }) {
  const { persona } = usePersona()
  const connect = useConnectAppToProject(app.id)
  const disconnect = useDisconnectAppFromProject(app.id)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!persona || persona.projects.length === 0) return null

  const linkByProject = new Map((app.project_links ?? []).map((pl) => [pl.project_id, pl]))
  const connectedCount = persona.projects.filter((p) => linkByProject.has(p.id)).length

  function toggle(projectId: string, phase: Phase) {
    const link = linkByProject.get(projectId)
    if (link) {
      disconnect.mutate(link.link_id)
    } else {
      connect.mutate({ projectId, phase })
    }
  }

  return (
    <div className="app-detail-page__projects" ref={ref}>
      <button
        type="button"
        className="depot-btn depot-btn--ghost"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Projects{connectedCount > 0 ? ` (${connectedCount})` : ''} ▾
      </button>
      {open && (
        <div className="app-detail-page__projects-panel" role="dialog" aria-label="Connect to a project">
          <p className="app-detail-page__projects-heading">
            {persona.is_admin ? 'All projects' : 'Your projects'}
          </p>
          <div className="app-detail-page__projects-list">
            {persona.projects.map((p) => (
              <label key={p.id} className="app-detail-page__projects-item">
                <input
                  type="checkbox"
                  checked={linkByProject.has(p.id)}
                  onChange={() => toggle(p.id, p.phase)}
                  disabled={connect.isPending || disconnect.isPending}
                />
                {p.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

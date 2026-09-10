import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useAppReachable,
  useApplication,
  useConnectAppToProject,
  useDisconnectAppFromProject,
} from '../api/hooks'
import type { AppProjectLink, Application } from '../api/types'
import { CATEGORY_LABEL } from '../api/types'
import { OUTBOUND_TARGET } from '../lib/embed'
import { usePersona } from '../lib/persona'
import './depot-shared.css'
import './ApplicationDetailPage.css'

/** The "show page" for one Application — everything the registry list doesn't have room for
 * (which of your projects it's connected to, full description, the registry entry, the deep
 * link). */
export default function ApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>()
  const { data: app, isLoading } = useApplication(applicationId)

  if (!applicationId) return null
  if (isLoading || !app) return <div className="app-detail-page__loading">Loading…</div>

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
          <div className="app-detail-page__header-action">
            {app.url ? (
              <TestDrive appId={app.id} url={app.url} />
            ) : (
              <span className="app-detail-page__testdrive-off">No demo yet</span>
            )}
          </div>
        </header>

        <ConnectedProjects app={app} />

        <section className="depot-section">
          <h2 className="depot-section__title">Registry entry</h2>
          <div className="app-detail-page__facts">
            <div className="app-detail-page__fact">
              <span className="app-detail-page__fact-label">Category</span>
              <span className="app-detail-page__fact-value">
                {CATEGORY_LABEL[app.category ?? 'general']}
              </span>
            </div>
            <div className="app-detail-page__fact">
              <span className="app-detail-page__fact-label">Capability</span>
              <span className="app-detail-page__fact-value">{app.capability_name ?? '—'}</span>
            </div>
            <div className="app-detail-page__fact">
              <span className="app-detail-page__fact-label">Owning team</span>
              <span className="app-detail-page__fact-value">{app.owning_team ?? '—'}</span>
            </div>
            <div className="app-detail-page__fact">
              <span className="app-detail-page__fact-label">Projects using it</span>
              <span className="app-detail-page__fact-value">
                {app.project_count === 0
                  ? 'None yet'
                  : `${app.project_count} project${app.project_count === 1 ? '' : 's'}`}
              </span>
            </div>
          </div>
        </section>
      </div>
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

/** "Connected projects" — the App-Store-style strip up top: which of the active persona's
 * projects connect this app, with quick add / remove. Admin sees every project. */
function ConnectedProjects({ app }: { app: Application }) {
  const { persona } = usePersona()
  const navigate = useNavigate()
  const connect = useConnectAppToProject(app.id)
  const disconnect = useDisconnectAppFromProject(app.id)
  const [addProjectId, setAddProjectId] = useState('')

  if (!persona) return null

  const myProjectIds = new Set(persona.projects.map((p) => p.id))
  const connectedHere = (app.project_links ?? []).filter((pl) => myProjectIds.has(pl.project_id))
  const connectedIds = new Set(connectedHere.map((pl) => pl.project_id))
  const addable = persona.projects.filter((p) => !connectedIds.has(p.id))

  function handleAdd() {
    const proj = addable.find((p) => p.id === addProjectId)
    if (!proj) return
    connect.mutate(
      { projectId: proj.id, phase: proj.phase },
      { onSuccess: () => setAddProjectId('') },
    )
  }

  function handleRemove(pl: AppProjectLink) {
    if (!confirm(`Remove ${app.name} from ${pl.project_name}? It stays in the registry.`)) return
    disconnect.mutate(pl.link_id)
  }

  return (
    <section className="depot-section">
      <h2 className="depot-section__title">
        {persona.is_admin ? 'Connected projects' : 'Connected to your projects'}
      </h2>

      {persona.projects.length === 0 ? (
        <p className="depot-section__body">You're not on any projects.</p>
      ) : (
        <>
          {connectedHere.length > 0 ? (
            <div className="app-detail-page__conns">
              {connectedHere.map((pl) => (
                <div key={pl.link_id} className="app-detail-page__conn">
                  <button
                    className="app-detail-page__conn-name"
                    onClick={() => navigate(`/projects/${pl.project_id}`)}
                  >
                    {pl.project_name}
                  </button>
                  <button
                    className="app-detail-page__conn-remove"
                    onClick={() => handleRemove(pl)}
                    disabled={disconnect.isPending}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="depot-section__body">Not connected to any of your projects yet.</p>
          )}

          {addable.length > 0 && (
            <div className="app-detail-page__add">
              <select
                value={addProjectId}
                onChange={(e) => setAddProjectId(e.target.value)}
              >
                <option value="">Add to a project…</option>
                {addable.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                className="app-detail-page__add-btn"
                onClick={handleAdd}
                disabled={!addProjectId || connect.isPending}
              >
                {connect.isPending ? 'Adding…' : 'Add'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

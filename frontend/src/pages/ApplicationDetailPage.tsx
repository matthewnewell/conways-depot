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

/** The "show page" for one Application — an app-store product page: name, category, a Test
 * Drive / Add-to-project action pair up top, a compact one-line Registry strip under that, and
 * the connected-projects list below. */
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
          <div className="app-detail-page__header-actions">
            <AddToProjectControl app={app} />
            {app.url ? (
              <TestDrive appId={app.id} url={app.url} />
            ) : (
              <span className="app-detail-page__testdrive-off">No demo yet</span>
            )}
          </div>
        </header>

        <div className="app-detail-page__registry">
          <span className="app-detail-page__registry-eyebrow">Registry</span>
          <RegistryFact label="Category" value={categories.map((c) => CATEGORY_LABEL[c]).join(', ')} />
          <RegistryFact label="Capability" value={app.capability_name ?? '—'} />
          <RegistryFact label="Owning team" value={app.owning_team ?? '—'} />
          <RegistryFact
            label="Projects using it"
            value={
              app.project_count === 0
                ? 'None yet'
                : `${app.project_count} project${app.project_count === 1 ? '' : 's'}`
            }
          />
        </div>

        <ConnectedProjects app={app} />
      </div>
    </div>
  )
}

function RegistryFact({ label, value }: { label: string; value: string }) {
  return (
    <span className="app-detail-page__registry-item">
      <span className="app-detail-page__registry-label">{label}</span>
      <span className="app-detail-page__registry-value">{value}</span>
    </span>
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

/** The header's other action — "Add to project", a compact select + button pair living next to
 * Test Drive instead of buried in its own full-width card. Renders nothing once there's nothing
 * left to add (no persona yet, persona is on no projects, or every one of them is connected). */
function AddToProjectControl({ app }: { app: Application }) {
  const { persona } = usePersona()
  const connect = useConnectAppToProject(app.id)
  const [addProjectId, setAddProjectId] = useState('')

  if (!persona || persona.projects.length === 0) return null

  const connectedIds = new Set(
    (app.project_links ?? [])
      .filter((pl) => persona.projects.some((p) => p.id === pl.project_id))
      .map((pl) => pl.project_id),
  )
  const addable = persona.projects.filter((p) => !connectedIds.has(p.id))
  if (addable.length === 0) return null

  function handleAdd() {
    const proj = addable.find((p) => p.id === addProjectId)
    if (!proj) return
    connect.mutate(
      { projectId: proj.id, phase: proj.phase },
      { onSuccess: () => setAddProjectId('') },
    )
  }

  return (
    <div className="app-detail-page__add">
      <select value={addProjectId} onChange={(e) => setAddProjectId(e.target.value)}>
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
  )
}

/** "Connected projects" — which of the active persona's projects connect this app, as chips
 * with a quick remove. The add control lives in the header now (see AddToProjectControl); this
 * section is read/remove only. Admin sees every project. */
function ConnectedProjects({ app }: { app: Application }) {
  const { persona } = usePersona()
  const navigate = useNavigate()
  const disconnect = useDisconnectAppFromProject(app.id)

  if (!persona) return null

  const myProjectIds = new Set(persona.projects.map((p) => p.id))
  const connectedHere = (app.project_links ?? []).filter((pl) => myProjectIds.has(pl.project_id))

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
      ) : connectedHere.length > 0 ? (
        <div className="app-detail-page__conns">
          {connectedHere.map((pl) => (
            <div key={pl.link_id} className="app-detail-page__conn-chip">
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
                title={`Remove from ${pl.project_name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="depot-section__body">Not connected to any of your projects yet.</p>
      )}
    </section>
  )
}

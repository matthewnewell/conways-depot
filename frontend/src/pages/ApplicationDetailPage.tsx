import { useParams } from 'react-router-dom'
import { useApplication } from '../api/hooks'
import type { AppStatus, Phase } from '../api/types'
import './depot-shared.css'
import './ApplicationDetailPage.css'

const STATUS_LABEL: Record<AppStatus, string> = {
  built: 'Built',
  planned: 'Planned',
  external: 'External',
}

const PHASE_LABEL: Record<Phase, string> = {
  pursuit: 'Pursuit',
  award: 'Award',
  execution: 'Execution',
  closeout: 'Closeout',
}

/** The "show page" for one Application — everything the registry list doesn't have room for
 * (full description, ownership, capability, the deep link). Read-only for now; editing an
 * application's registry entry isn't a need yet. */
export default function ApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>()
  const { data: app, isLoading } = useApplication(applicationId)

  if (!applicationId) return null
  if (isLoading || !app) return <div className="app-detail-page__loading">Loading…</div>

  return (
    <div className="app-detail-page">
      <div className="app-detail-page__toolbar">
        <h1 className="app-detail-page__title">{app.name}</h1>
        {app.scope === 'organizational' ? (
          <span className="app-detail-page__phase app-detail-page__phase--organizational">
            Organization
          </span>
        ) : (
          app.phases.map((p) => (
            <span key={p} className={`app-detail-page__phase app-detail-page__phase--${p}`}>
              {PHASE_LABEL[p]}
            </span>
          ))
        )}
        <span className={`app-detail-page__status app-detail-page__status--${app.status}`}>
          {STATUS_LABEL[app.status]}
        </span>
      </div>

      <div className="app-detail-page__content">
        <section className="depot-section">
          <h2 className="depot-section__title">Description</h2>
          <p className="depot-section__body">
            {app.description || 'No description recorded.'}
          </p>
        </section>

        <section className="depot-section">
          <h2 className="depot-section__title">Ownership</h2>
          <div className="app-detail-page__facts">
            <div className="app-detail-page__fact">
              <span className="app-detail-page__fact-label">Scope</span>
              <span className="app-detail-page__fact-value">
                {app.scope === 'organizational'
                  ? 'Organization — serves every project, not one lifecycle'
                  : 'Project — scoped to a project’s own lifecycle'}
              </span>
            </div>
            <div className="app-detail-page__fact">
              <span className="app-detail-page__fact-label">Owning team</span>
              <span className="app-detail-page__fact-value">{app.owning_team ?? '—'}</span>
            </div>
            <div className="app-detail-page__fact">
              <span className="app-detail-page__fact-label">Team type</span>
              <span className="app-detail-page__fact-value">
                {app.team_type ?? '— (external product, or unowned)'}
              </span>
            </div>
            <div className="app-detail-page__fact">
              <span className="app-detail-page__fact-label">Capability</span>
              <span className="app-detail-page__fact-value">{app.capability_name ?? '—'}</span>
            </div>
          </div>
        </section>

        <section className="depot-section">
          <h2 className="depot-section__title">Where it lives</h2>
          {app.url ? (
            <a className="app-detail-page__link" href={app.url} target="_blank" rel="noreferrer">
              {app.url} →
            </a>
          ) : (
            <p className="depot-section__body">
              No reachable URL on file — {app.status === 'external'
                ? 'a real external product with no stable local address to link to.'
                : 'nothing to link to yet.'}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

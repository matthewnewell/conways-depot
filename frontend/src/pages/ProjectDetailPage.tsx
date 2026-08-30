import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useAddExternalId,
  useApplications,
  useCreateLink,
  useDeleteExternalId,
  useDeleteLink,
  useProject,
  useUpdateProject,
} from '../api/hooks'
import type { Phase } from '../api/types'
import { PHASES } from '../api/types'
import './ProjectDetailPage.css'

const PHASE_LABEL: Record<Phase, string> = {
  pursuit: 'Pursuit',
  award: 'Award',
  execution: 'Execution',
  closeout: 'Closeout',
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { data: project, isLoading } = useProject(projectId)
  const { data: applications } = useApplications()
  const updateProject = useUpdateProject(projectId ?? '')
  const addExternalId = useAddExternalId(projectId ?? '')
  const deleteExternalId = useDeleteExternalId(projectId ?? '')
  const createLink = useCreateLink(projectId ?? '')
  const deleteLink = useDeleteLink(projectId ?? '')

  const [showAddExternalId, setShowAddExternalId] = useState(false)
  const [extSystem, setExtSystem] = useState('')
  const [extId, setExtId] = useState('')

  const [showAddLink, setShowAddLink] = useState<Phase | null>(null)
  const [linkAppId, setLinkAppId] = useState('')
  const [linkRef, setLinkRef] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkNotes, setLinkNotes] = useState('')

  if (!projectId) return null
  if (isLoading || !project) return <div className="project-detail-page__loading">Loading…</div>

  function resetLinkForm() {
    setShowAddLink(null)
    setLinkAppId('')
    setLinkRef('')
    setLinkUrl('')
    setLinkNotes('')
  }

  function handleAddLink(phase: Phase) {
    if (!linkAppId) return
    createLink.mutate(
      {
        application_id: linkAppId,
        phase,
        external_ref: linkRef.trim() || undefined,
        link_url: linkUrl.trim() || undefined,
        notes: linkNotes.trim() || undefined,
      },
      { onSuccess: resetLinkForm },
    )
  }

  return (
    <div className="project-detail-page">
      <div className="project-detail-page__toolbar">
        <button className="project-detail-page__back" onClick={() => navigate('/')}>
          ← Projects
        </button>
        <input
          className="project-detail-page__title"
          value={project.name}
          onChange={(e) => updateProject.mutate({ name: e.target.value })}
        />
        <select
          className="project-detail-page__phase-select"
          value={project.phase}
          onChange={(e) => updateProject.mutate({ phase: e.target.value as Phase })}
        >
          {PHASES.map((ph) => (
            <option key={ph} value={ph}>
              {PHASE_LABEL[ph]}
            </option>
          ))}
        </select>
      </div>

      <div className="project-detail-page__content">
        <section className="depot-section">
          <div className="depot-section__header-row">
            <h2 className="depot-section__title">External System IDs</h2>
            <button onClick={() => setShowAddExternalId((v) => !v)}>+ Add</button>
          </div>
          {project.external_ids.length === 0 && (
            <p className="depot-section__body">
              No crosswalk entries yet — the Depot's own id is the only thread so far.
            </p>
          )}
          <div className="external-id-list">
            {project.external_ids.map((e) => (
              <div key={e.id} className="external-id-chip">
                <span className="external-id-chip__system">{e.system}</span>
                <span className="external-id-chip__value">{e.external_id}</span>
                <button
                  className="external-id-chip__remove"
                  onClick={() => deleteExternalId.mutate(e.id)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {showAddExternalId && (
            <div className="depot-inline-form">
              <input
                placeholder="System (e.g. WinMax)"
                value={extSystem}
                onChange={(e) => setExtSystem(e.target.value)}
              />
              <input
                placeholder="External ID (e.g. OPP-8891)"
                value={extId}
                onChange={(e) => setExtId(e.target.value)}
              />
              <button
                disabled={!extSystem.trim() || !extId.trim()}
                onClick={() => {
                  addExternalId.mutate(
                    { system: extSystem.trim(), external_id: extId.trim() },
                    {
                      onSuccess: () => {
                        setExtSystem('')
                        setExtId('')
                        setShowAddExternalId(false)
                      },
                    },
                  )
                }}
              >
                Save
              </button>
            </div>
          )}
        </section>

        <section className="depot-section">
          <h2 className="depot-section__title">Registered Applications, by Phase</h2>
          <p className="depot-section__subtitle">
            The golden thread made visible — every application with a record for this project,
            grouped by the phase it belongs to. Each link is a plain pointer, not a live
            connection.
          </p>

          <div className="phase-board">
            {PHASES.map((phase) => {
              const links = project.app_links.filter((l) => l.phase === phase)
              return (
                <div key={phase} className="phase-column">
                  <div className={`phase-column__header phase-column__header--${phase}`}>
                    {PHASE_LABEL[phase]}
                  </div>
                  <div className="phase-column__body">
                    {links.length === 0 && (
                      <div className="phase-column__empty">Nothing linked yet</div>
                    )}
                    {links.map((l) => (
                      <div key={l.id} className="app-link-card">
                        <div className="app-link-card__top">
                          <span className="app-link-card__name">{l.application_name}</span>
                          {l.application_status && (
                            <span
                              className={`app-link-card__status app-link-card__status--${l.application_status}`}
                            >
                              {l.application_status}
                            </span>
                          )}
                        </div>
                        {l.external_ref && (
                          <div className="app-link-card__ref">{l.external_ref}</div>
                        )}
                        {l.notes && <div className="app-link-card__notes">{l.notes}</div>}
                        <div className="app-link-card__actions">
                          {l.link_url && (
                            <a
                              className="app-link-card__open"
                              href={l.link_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open →
                            </a>
                          )}
                          <button
                            className="app-link-card__remove"
                            onClick={() => deleteLink.mutate(l.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}

                    {showAddLink === phase ? (
                      <div className="depot-inline-form depot-inline-form--stacked">
                        <select value={linkAppId} onChange={(e) => setLinkAppId(e.target.value)}>
                          <option value="">Select application…</option>
                          {applications?.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.status})
                            </option>
                          ))}
                        </select>
                        <input
                          placeholder="External ref (optional)"
                          value={linkRef}
                          onChange={(e) => setLinkRef(e.target.value)}
                        />
                        <input
                          placeholder="Link URL (optional)"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                        />
                        <input
                          placeholder="Notes (optional)"
                          value={linkNotes}
                          onChange={(e) => setLinkNotes(e.target.value)}
                        />
                        <div className="depot-inline-form__actions">
                          <button disabled={!linkAppId} onClick={() => handleAddLink(phase)}>
                            Save
                          </button>
                          <button onClick={resetLinkForm}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="phase-column__add-link"
                        onClick={() => setShowAddLink(phase)}
                      >
                        + Link an app
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

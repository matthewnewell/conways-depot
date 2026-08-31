import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateProject, useDeleteProject, useProjects } from '../api/hooks'
import type { Phase, ProjectSummary } from '../api/types'
import { PHASES } from '../api/types'
import './ProjectListPage.css'

const PHASE_LABEL: Record<Phase, string> = {
  pursuit: 'Pursuit',
  award: 'Award',
  execution: 'Execution',
  closeout: 'Closeout',
}

export default function ProjectListPage() {
  const { data: projects, isLoading } = useProjects()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()
  const navigate = useNavigate()
  const [newName, setNewName] = useState('')

  function handleCreate() {
    const name = newName.trim() || 'Untitled project'
    createProject.mutate({ name }, { onSuccess: (p) => navigate(`/projects/${p.id}`) })
    setNewName('')
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    deleteProject.mutate(id)
  }

  const byPhase = new Map<Phase, ProjectSummary[]>()
  for (const p of projects ?? []) {
    byPhase.set(p.phase, [...(byPhase.get(p.phase) ?? []), p])
  }

  return (
    <div className="project-list-page">
      <header className="project-list-page__header">
        <p>
          A registry of projects and the applications tied to them, grouped by lifecycle phase
          — not a platform.
        </p>
      </header>

      <div className="project-list-page__create">
        <input
          placeholder="New project name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button onClick={handleCreate} disabled={createProject.isPending}>
          + New project
        </button>
      </div>

      {isLoading && <div className="project-list-page__loading">Loading projects…</div>}

      {!isLoading && projects?.length === 0 && (
        <div className="project-list-page__empty">No projects registered yet — create one above.</div>
      )}

      {!isLoading && (projects?.length ?? 0) > 0 && (
        <div className="project-phase-board">
          {PHASES.map((phase) => {
            const inPhase = byPhase.get(phase) ?? []
            return (
              <section key={phase} className="project-phase-column">
                <div className={`project-phase-column__header project-phase-column__header--${phase}`}>
                  {PHASE_LABEL[phase]}
                  <span className="project-phase-column__count">{inPhase.length}</span>
                </div>
                <div className="project-phase-column__body">
                  {inPhase.length === 0 && (
                    <div className="project-phase-column__empty">No projects here</div>
                  )}
                  {inPhase.map((p) => (
                    <div
                      key={p.id}
                      className="project-card"
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      <div className="project-card__name">{p.name}</div>
                      {p.customer && <div className="project-card__customer">{p.customer}</div>}
                      {p.external_ids.length > 0 && (
                        <div className="project-card__external-ids">
                          {p.external_ids.map((e) => (
                            <span key={e.id} className="project-card__external-id-badge">
                              {e.system}: {e.external_id}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="project-card__actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="project-card__delete"
                          onClick={() => handleDelete(p.id, p.name)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

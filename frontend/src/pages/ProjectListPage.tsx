import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateProject, useDeleteProject, useProjects } from '../api/hooks'
import './ProjectListPage.css'

const PHASE_LABEL: Record<string, string> = {
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

  return (
    <div className="project-list-page">
      <header className="project-list-page__header">
        <div>
          <h1>Conway's Depot</h1>
          <p>A registry of projects and the applications tied to them — not a platform.</p>
        </div>
        <div className="project-list-page__header-links">
          <button className="project-list-page__nav-link" onClick={() => navigate('/applications')}>
            🗂 Application Registry
          </button>
          <button className="project-list-page__nav-link" onClick={() => navigate('/guide')}>
            📘 Theory of Operation
          </button>
        </div>
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

      <div className="project-list-page__grid">
        {projects?.map((p) => (
          <div key={p.id} className="project-card" onClick={() => navigate(`/projects/${p.id}`)}>
            <div className="project-card__top">
              <span className={`project-card__phase project-card__phase--${p.phase}`}>
                {PHASE_LABEL[p.phase]}
              </span>
            </div>
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
              <button className="project-card__delete" onClick={() => handleDelete(p.id, p.name)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {projects?.length === 0 && !isLoading && (
        <div className="project-list-page__empty">No projects registered yet — create one above.</div>
      )}
    </div>
  )
}

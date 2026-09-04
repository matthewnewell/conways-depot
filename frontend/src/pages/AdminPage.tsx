import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateProject, useDeleteProject, useProjects } from '../api/hooks'
import type { Phase } from '../api/types'
import './depot-shared.css'
import './AdminPage.css'

const PHASE_LABEL: Record<Phase, string> = {
  pursuit: 'Pursuit',
  award: 'Award',
  execution: 'Execution',
  closeout: 'Closeout',
}

/** Management, not browsing — creating, updating, and deleting live here instead of on the
 * Project Registry, which is a read-first list for finding a project, not administering one.
 * No permissions behind this yet: it's a separate view, not an access-controlled one — the
 * link is just as reachable as any other nav item on purpose, for now. */
export default function AdminPage() {
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
    <div className="admin-page">
      <div className="admin-page__toolbar">
        <h1 className="admin-page__title">Admin</h1>
      </div>

      <div className="admin-page__content">
        <p className="admin-page__intro">
          No permissions enforced here — this is a separate management view for now, not an
          access-controlled one.
        </p>

        <section className="depot-section">
          <h2 className="depot-section__title">Projects</h2>

          <div className="admin-page__create">
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

          {isLoading && <div className="admin-page__loading">Loading projects…</div>}

          {!isLoading && projects?.length === 0 && (
            <div className="admin-page__loading">No projects registered yet — create one above.</div>
          )}

          {!isLoading && (projects?.length ?? 0) > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phase</th>
                  <th>Portfolio</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects?.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        className="admin-table__name-link"
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        {p.name}
                      </button>
                    </td>
                    <td>
                      <span className={`admin-table__phase admin-table__phase--${p.phase}`}>
                        {PHASE_LABEL[p.phase]}
                      </span>
                    </td>
                    <td className="admin-table__portfolio">
                      {p.portfolio_name ?? <span className="admin-table__muted">—</span>}
                    </td>
                    <td className="admin-table__actions">
                      <button
                        className="admin-table__update"
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        Update
                      </button>
                      <button
                        className="admin-table__delete"
                        onClick={() => handleDelete(p.id, p.name)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  )
}

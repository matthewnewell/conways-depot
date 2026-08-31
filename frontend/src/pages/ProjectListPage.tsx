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

const PHASE_ORDER: Record<Phase, number> = Object.fromEntries(
  PHASES.map((p, i) => [p, i]),
) as Record<Phase, number>

type SortKey = 'portfolio' | 'phase' | 'name'

export default function ProjectListPage() {
  const { data: projects, isLoading } = useProjects()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()
  const navigate = useNavigate()
  const [newName, setNewName] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('portfolio')
  const [sortDesc, setSortDesc] = useState(false)

  function handleCreate() {
    const name = newName.trim() || 'Untitled project'
    createProject.mutate({ name }, { onSuccess: (p) => navigate(`/projects/${p.id}`) })
    setNewName('')
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    deleteProject.mutate(id)
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((d) => !d)
    } else {
      setSortKey(key)
      setSortDesc(false)
    }
  }

  function compare(a: ProjectSummary, b: ProjectSummary): number {
    switch (sortKey) {
      case 'portfolio':
        return (
          (a.portfolio_name ?? '').localeCompare(b.portfolio_name ?? '') ||
          a.name.localeCompare(b.name)
        )
      case 'phase':
        return PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || a.name.localeCompare(b.name)
      case 'name':
        return a.name.localeCompare(b.name)
    }
  }

  const sorted = [...(projects ?? [])].sort((a, b) => {
    const cmp = compare(a, b)
    return sortDesc ? -cmp : cmp
  })

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return null
    return <span className="proj-table__sort-arrow">{sortDesc ? '↓' : '↑'}</span>
  }

  return (
    <div className="project-list-page">
      <div className="project-list-page__toolbar">
        <h1 className="project-list-page__title">Projects Registry</h1>
      </div>

      <div className="project-list-page__content">
        <p className="project-list-page__intro">
          Every project the Depot tracks — each with its own digital-thread id, grouped by
          portfolio and lifecycle phase. Click a row for the full record.
        </p>

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
          <table className="proj-table">
            <thead>
              <tr>
                <th className="proj-table__sortable" onClick={() => toggleSort('portfolio')}>
                  Portfolio{sortIndicator('portfolio')}
                </th>
                <th className="proj-table__sortable" onClick={() => toggleSort('phase')}>
                  Phase{sortIndicator('phase')}
                </th>
                <th className="proj-table__sortable" onClick={() => toggleSort('name')}>
                  Project name{sortIndicator('name')}
                </th>
                <th className="proj-table__desc-col">Description</th>
                <th className="proj-table__actions-col"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)}>
                  <td className="proj-table__portfolio">
                    {p.portfolio_name ?? <span className="proj-table__muted">—</span>}
                  </td>
                  <td>
                    <span className={`proj-table__phase proj-table__phase--${p.phase}`}>
                      {PHASE_LABEL[p.phase]}
                    </span>
                  </td>
                  <td className="proj-table__name">{p.name}</td>
                  <td className="proj-table__desc-col proj-table__desc">
                    {p.description ?? <span className="proj-table__muted">—</span>}
                  </td>
                  <td className="proj-table__actions-col" onClick={(e) => e.stopPropagation()}>
                    <button className="proj-table__delete" onClick={() => handleDelete(p.id, p.name)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

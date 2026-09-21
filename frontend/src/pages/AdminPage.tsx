import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateProject, useDeleteProject, usePortfolios, useProjects, useUpdatePortfolio } from '../api/hooks'
import { LinksEditor } from '../components/Links'
import type { Phase, Portfolio } from '../api/types'
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
  const { data: portfolios } = usePortfolios()
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

        <section className="depot-section">
          <h2 className="depot-section__title">Portfolios</h2>
          <p className="depot-section__subtitle">
            Links set here (a shared Teams team, SharePoint site, Azure DevOps project…) appear on
            every project in the portfolio, beneath the project's own links.
          </p>
          {(portfolios ?? []).length === 0 && <p className="depot-section__body">No portfolios yet.</p>}
          <div className="admin-portfolios">
            {(portfolios ?? []).map((pf) => (
              <PortfolioLinks
                key={`${pf.id}:${JSON.stringify(pf.channels)}`}
                portfolio={pf}
                projectCount={(projects ?? []).filter((p) => p.portfolio_id === pf.id).length}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function PortfolioLinks({ portfolio, projectCount }: { portfolio: Portfolio; projectCount: number }) {
  const update = useUpdatePortfolio(portfolio.id)
  return (
    <div className="admin-portfolio">
      <div className="admin-portfolio__head">
        <span className="admin-portfolio__name">{portfolio.name}</span>
        <span className="admin-portfolio__count">
          {projectCount} project{projectCount === 1 ? '' : 's'}
        </span>
      </div>
      <LinksEditor
        initial={portfolio.channels ?? []}
        pending={update.isPending}
        onSave={(links, done) => update.mutate({ channels: links }, { onSuccess: done })}
      />
    </div>
  )
}

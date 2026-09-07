import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolios, useProjects } from '../api/hooks'
import type { Phase, ProjectSummary } from '../api/types'
import { PHASES } from '../api/types'
import { usePersona } from '../lib/persona'
import './depot-shared.css'
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

// A project with no portfolio still needs a checkbox to filter on.
const NO_PORTFOLIO = 'none' as const
type PortfolioFilterValue = string | typeof NO_PORTFOLIO

type SortKey = 'phase' | 'name' | 'apps'

export default function ProjectListPage() {
  const { data: projects, isLoading } = useProjects()
  const { data: portfolios } = usePortfolios()
  const { persona } = usePersona()
  const navigate = useNavigate()
  // Default: most wired-up projects first — sort by how many apps each connects to.
  const [sortKey, setSortKey] = useState<SortKey>('apps')
  const [sortDesc, setSortDesc] = useState(true)
  // The persona lens: a limited persona defaults to "just my projects", with an "All" toggle
  // that filters nothing out of reach — see lib/persona.tsx. The admin persona has no toggle;
  // it always sees the whole registry.
  const limitedPersona = persona && !persona.is_admin ? persona : null
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const mineOnly = !!limitedPersona && scope === 'mine'
  // Portfolio is a filter, not a table column — same pattern as Phase on the Application
  // Registry. Undefined until the portfolio list loads, at which point everything defaults
  // to checked (see the effect below).
  const [portfolioFilter, setPortfolioFilter] = useState<Set<PortfolioFilterValue> | null>(null)

  // Seed the filter to "everything checked" once portfolios have loaded, and again whenever a
  // new portfolio shows up (it should default to visible, not silently hidden).
  useEffect(() => {
    if (!portfolios) return
    setPortfolioFilter((prev) => {
      const allIds = new Set<PortfolioFilterValue>([...portfolios.map((p) => p.id), NO_PORTFOLIO])
      if (prev === null) return allIds
      // Preserve existing unchecks; default any newly-seen portfolio to checked.
      const next = new Set(prev)
      for (const id of allIds) {
        if (!prev.has(id)) next.add(id)
      }
      return next
    })
  }, [portfolios])

  function togglePortfolioFilter(value: PortfolioFilterValue) {
    setPortfolioFilter((prev) => {
      const next = new Set(prev ?? [])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
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
      case 'phase':
        return PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || a.name.localeCompare(b.name)
      case 'name':
        return a.name.localeCompare(b.name)
      case 'apps':
        return (a.app_count ?? 0) - (b.app_count ?? 0) || a.name.localeCompare(b.name)
    }
  }

  const filtered = (projects ?? [])
    .filter((p) =>
      portfolioFilter === null ? true : portfolioFilter.has(p.portfolio_id ?? NO_PORTFOLIO),
    )
    .filter((p) => (mineOnly ? limitedPersona!.project_ids.includes(p.id) : true))
  const sorted = [...filtered].sort((a, b) => {
    const cmp = compare(a, b)
    return sortDesc ? -cmp : cmp
  })

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return null
    return <span className="proj-table__sort-arrow">{sortDesc ? '↓' : '↑'}</span>
  }

  return (
    <div className="project-list-page">
      <div className="project-list-page__content">
        {limitedPersona && (
          <div className="depot-scope-toggle" role="group" aria-label="Which projects to show">
            <button
              className={`depot-scope-toggle__option ${scope === 'mine' ? 'depot-scope-toggle__option--active' : ''}`}
              onClick={() => setScope('mine')}
            >
              {limitedPersona.name}'s projects
            </button>
            <button
              className={`depot-scope-toggle__option ${scope === 'all' ? 'depot-scope-toggle__option--active' : ''}`}
              onClick={() => setScope('all')}
            >
              All projects
            </button>
          </div>
        )}

        {(portfolios?.length ?? 0) > 0 && (
          <div className="depot-checkbox-filter">
            <span className="depot-checkbox-filter__label">Portfolio</span>
            {portfolios!.map((pf) => (
              <label key={pf.id} className="depot-checkbox-filter__option">
                <input
                  type="checkbox"
                  checked={portfolioFilter?.has(pf.id) ?? true}
                  onChange={() => togglePortfolioFilter(pf.id)}
                />
                {pf.name}
              </label>
            ))}
            <label className="depot-checkbox-filter__option">
              <input
                type="checkbox"
                checked={portfolioFilter?.has(NO_PORTFOLIO) ?? true}
                onChange={() => togglePortfolioFilter(NO_PORTFOLIO)}
              />
              No portfolio
            </label>
          </div>
        )}

        {isLoading && <div className="project-list-page__loading">Loading projects…</div>}

        {!isLoading && projects?.length === 0 && (
          <div className="project-list-page__empty">
            No projects registered yet — create one from ⚙ Admin.
          </div>
        )}

        {!isLoading && (projects?.length ?? 0) > 0 && filtered.length === 0 && (
          <div className="project-list-page__empty">
            {mineOnly && limitedPersona!.project_ids.length === 0
              ? `${limitedPersona!.name} isn't on any projects yet — switch to "All projects" to see the registry.`
              : 'No projects match the current filters.'}
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <table className="proj-table">
            <thead>
              <tr>
                <th className="proj-table__sortable" onClick={() => toggleSort('phase')}>
                  Phase{sortIndicator('phase')}
                </th>
                <th className="proj-table__sortable" onClick={() => toggleSort('name')}>
                  Project name{sortIndicator('name')}
                </th>
                <th
                  className="proj-table__sortable proj-table__num-col"
                  onClick={() => toggleSort('apps')}
                  title="How many applications this project connects to"
                >
                  Apps{sortIndicator('apps')}
                </th>
                <th className="proj-table__desc-col">Description</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)}>
                  <td>
                    <span className={`proj-table__phase proj-table__phase--${p.phase}`}>
                      {PHASE_LABEL[p.phase]}
                    </span>
                  </td>
                  <td className="proj-table__name">{p.name}</td>
                  <td className="proj-table__num-col proj-table__count">
                    {(p.app_count ?? 0) > 0 ? (
                      p.app_count
                    ) : (
                      <span className="proj-table__muted">0</span>
                    )}
                  </td>
                  <td className="proj-table__desc-col proj-table__desc">
                    {p.description ?? <span className="proj-table__muted">—</span>}
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

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolios, useProjects } from '../api/hooks'
import type { Phase, ProjectSummary } from '../api/types'
import { PHASES } from '../api/types'
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

type SortKey = 'phase' | 'name'

export default function ProjectListPage() {
  const { data: projects, isLoading } = useProjects()
  const { data: portfolios } = usePortfolios()
  const navigate = useNavigate()
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDesc, setSortDesc] = useState(false)
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
    }
  }

  const filtered = (projects ?? []).filter((p) =>
    portfolioFilter === null ? true : portfolioFilter.has(p.portfolio_id ?? NO_PORTFOLIO),
  )
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
      <div className="project-list-page__toolbar">
        <h1 className="project-list-page__title">Projects Registry</h1>
      </div>

      <div className="project-list-page__content">
        <p className="project-list-page__intro">
          Every project the Depot tracks — each with its own digital-thread id. Click a row for
          the full record.
        </p>

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
          <div className="project-list-page__empty">No projects match the selected portfolio(s).</div>
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

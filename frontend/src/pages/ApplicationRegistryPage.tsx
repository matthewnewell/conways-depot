import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApplications } from '../api/hooks'
import type { Application, AppStatus, Phase } from '../api/types'
import { PHASES } from '../api/types'
import './ApplicationRegistryPage.css'

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

// Organizational-scope applications carry no phases at all — they need their own filter
// checkbox alongside the four real phases, not a "no phase" catch-all.
const ORGANIZATIONAL = 'organizational' as const
type PhaseFilterValue = Phase | typeof ORGANIZATIONAL
const PHASE_FILTER_VALUES: PhaseFilterValue[] = [...PHASES, ORGANIZATIONAL]

// Ordered by lifecycle intent, not alphabetically — Built first (the real answer), then
// Planned (a named gap), then External (out of our hands) — so sorting by status reads as a
// meaningful ordering, not an arbitrary one.
const STATUS_ORDER: Record<AppStatus, number> = { built: 0, planned: 1, external: 2 }

type SortKey = 'name' | 'status' | 'capability'

export default function ApplicationRegistryPage() {
  const navigate = useNavigate()
  const { data: applications, isLoading } = useApplications()
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDesc, setSortDesc] = useState(false)
  // Phase is a filter, not a sort — a project's-worth of applications is small enough that
  // "show me only Execution-phase apps" is more useful than "sort by phase" would be.
  const [phaseFilter, setPhaseFilter] = useState<Set<PhaseFilterValue>>(
    new Set(PHASE_FILTER_VALUES),
  )

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((d) => !d)
    } else {
      setSortKey(key)
      setSortDesc(false)
    }
  }

  function togglePhaseFilter(value: PhaseFilterValue) {
    setPhaseFilter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  function compare(a: Application, b: Application): number {
    switch (sortKey) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'status':
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name)
      case 'capability':
        return (a.capability_name ?? '').localeCompare(b.capability_name ?? '') || a.name.localeCompare(b.name)
    }
  }

  // An organizational-scope app matches on its own checkbox; a project-scope app matches if
  // any one of its (possibly several) phases is checked.
  const filtered = (applications ?? []).filter((a) =>
    a.scope === 'organizational'
      ? phaseFilter.has(ORGANIZATIONAL)
      : a.phases.some((p) => phaseFilter.has(p)),
  )
  const sorted = [...filtered].sort((a, b) => {
    const cmp = compare(a, b)
    return sortDesc ? -cmp : cmp
  })

  // Client-side Conway signal: a team's name attached to more than one registered app. Cheap,
  // deterministic, same computation the chat assistant's context is built from server-side —
  // shown here too so it's visible without asking. Computed off the full set, not the filtered
  // one — a filter shouldn't make a real structural signal disappear.
  const teamCounts = new Map<string, number>()
  for (const a of applications ?? []) {
    if (a.owning_team) teamCounts.set(a.owning_team, (teamCounts.get(a.owning_team) ?? 0) + 1)
  }
  const overloadedTeams = [...teamCounts.entries()].filter(([, n]) => n >= 2)

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return null
    return <span className="app-table__sort-arrow">{sortDesc ? '↓' : '↑'}</span>
  }

  return (
    <div className="app-registry-page">
      <div className="app-registry-page__toolbar">
        <h1 className="app-registry-page__title">Application Registry</h1>
      </div>

      <div className="app-registry-page__content">
        <p className="app-registry-page__intro">
          Every application the Depot knows about — built, planned, or an external vendor
          product. Registering an app here never wires up a real integration; it's a claim
          about what exists and who owns it. Click a row for the full record.
        </p>

        {overloadedTeams.length > 0 && (
          <div className="app-registry-page__signal">
            <strong>Conway signal:</strong>{' '}
            {overloadedTeams.map(([team, n], i) => (
              <span key={team}>
                {i > 0 && ', '}
                "{team}" owns {n} registered applications
              </span>
            ))}
            {' '}— worth checking whether that's one team stretched across too much surface area.
          </div>
        )}

        <div className="app-registry-page__phase-filter">
          <span className="app-registry-page__phase-filter-label">Phase</span>
          {PHASE_FILTER_VALUES.map((v) => (
            <label key={v} className="app-registry-page__phase-checkbox">
              <input
                type="checkbox"
                checked={phaseFilter.has(v)}
                onChange={() => togglePhaseFilter(v)}
              />
              {v === ORGANIZATIONAL ? 'Organizational' : PHASE_LABEL[v]}
            </label>
          ))}
        </div>

        {isLoading && <div className="app-registry-page__loading">Loading registry…</div>}

        {!isLoading && filtered.length === 0 && (applications?.length ?? 0) > 0 && (
          <div className="app-registry-page__loading">
            No applications match the selected phase(s).
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <table className="app-table">
            <thead>
              <tr>
                <th className="app-table__sortable" onClick={() => toggleSort('name')}>
                  Name{sortIndicator('name')}
                </th>
                <th>Phase</th>
                <th className="app-table__sortable" onClick={() => toggleSort('status')}>
                  Status{sortIndicator('status')}
                </th>
                <th
                  className="app-table__sortable app-table__desc-col"
                  onClick={() => toggleSort('capability')}
                >
                  Capability{sortIndicator('capability')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a: Application) => (
                <tr key={a.id} onClick={() => navigate(`/applications/${a.id}`)}>
                  <td className="app-table__name">{a.name}</td>
                  <td>
                    {a.scope === 'organizational' ? (
                      <span className="app-table__phase app-table__phase--organizational">
                        Organizational
                      </span>
                    ) : a.phases.length > 0 ? (
                      <div className="app-table__phase-list">
                        {a.phases.map((p) => (
                          <span key={p} className={`app-table__phase app-table__phase--${p}`}>
                            {PHASE_LABEL[p]}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="app-table__muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`app-table__status app-table__status--${a.status}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </td>
                  <td className="app-table__desc-col app-table__capability">
                    {a.capability_name ?? <span className="app-table__muted">—</span>}
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

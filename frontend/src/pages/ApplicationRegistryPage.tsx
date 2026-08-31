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

// Ordered by lifecycle intent, not alphabetically — Built first (the real answer), then
// Planned (a named gap), then External (out of our hands) — so sorting by status reads as a
// meaningful ordering, not an arbitrary one.
const STATUS_ORDER: Record<AppStatus, number> = { built: 0, planned: 1, external: 2 }
const PHASE_ORDER: Record<Phase, number> = Object.fromEntries(
  PHASES.map((p, i) => [p, i]),
) as Record<Phase, number>

type SortKey = 'name' | 'phase' | 'status' | 'capability'

export default function ApplicationRegistryPage() {
  const navigate = useNavigate()
  const { data: applications, isLoading } = useApplications()
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDesc, setSortDesc] = useState(false)

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDesc((d) => !d)
    } else {
      setSortKey(key)
      setSortDesc(false)
    }
  }

  function compare(a: Application, b: Application): number {
    switch (sortKey) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'status':
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name)
      case 'phase': {
        const av = a.phase ? PHASE_ORDER[a.phase] : PHASES.length
        const bv = b.phase ? PHASE_ORDER[b.phase] : PHASES.length
        return av - bv || a.name.localeCompare(b.name)
      }
      case 'capability':
        return (a.capability_name ?? '').localeCompare(b.capability_name ?? '') || a.name.localeCompare(b.name)
    }
  }

  const sorted = [...(applications ?? [])].sort((a, b) => {
    const cmp = compare(a, b)
    return sortDesc ? -cmp : cmp
  })

  // Client-side Conway signal: a team's name attached to more than one registered app. Cheap,
  // deterministic, same computation the chat assistant's context is built from server-side —
  // shown here too so it's visible without asking.
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

        {isLoading && <div className="app-registry-page__loading">Loading registry…</div>}

        {!isLoading && (applications?.length ?? 0) > 0 && (
          <table className="app-table">
            <thead>
              <tr>
                <th className="app-table__sortable" onClick={() => toggleSort('name')}>
                  Name{sortIndicator('name')}
                </th>
                <th className="app-table__sortable" onClick={() => toggleSort('phase')}>
                  Phase{sortIndicator('phase')}
                </th>
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
                    {a.phase ? (
                      <span className={`app-table__phase app-table__phase--${a.phase}`}>
                        {PHASE_LABEL[a.phase]}
                      </span>
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

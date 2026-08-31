import { useState } from 'react'
import { useApplications } from '../api/hooks'
import type { Application } from '../api/types'
import './ApplicationRegistryPage.css'

const STATUS_LABEL: Record<string, string> = {
  built: 'Built',
  planned: 'Planned',
  external: 'External',
}

type GroupBy = 'capability' | 'status' | 'team' | 'team_type'

const GROUP_LABEL: Record<GroupBy, string> = {
  capability: 'Capability',
  status: 'Status',
  team: 'Owning team',
  team_type: 'Team type',
}

function groupKey(a: Application, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'capability':
      return a.capability_name ?? 'Uncategorized'
    case 'status':
      return STATUS_LABEL[a.status]
    case 'team':
      return a.owning_team ?? 'Unowned'
    case 'team_type':
      return a.team_type ?? 'No team type (external product, or unowned)'
  }
}

export default function ApplicationRegistryPage() {
  const { data: applications, isLoading } = useApplications()
  const [groupBy, setGroupBy] = useState<GroupBy>('capability')

  const groups = new Map<string, Application[]>()
  for (const a of applications ?? []) {
    const key = groupKey(a, groupBy)
    groups.set(key, [...(groups.get(key) ?? []), a])
  }

  // Client-side Conway signal: a team's name attached to more than one registered app. Cheap,
  // deterministic, same computation the chat assistant's context is built from server-side —
  // shown here too so it's visible without asking.
  const teamCounts = new Map<string, number>()
  for (const a of applications ?? []) {
    if (a.owning_team) teamCounts.set(a.owning_team, (teamCounts.get(a.owning_team) ?? 0) + 1)
  }
  const overloadedTeams = [...teamCounts.entries()].filter(([, n]) => n >= 2)

  return (
    <div className="app-registry-page">
      <div className="app-registry-page__toolbar">
        <h1 className="app-registry-page__title">Application Registry</h1>
        <div className="app-registry-page__group-toggle">
          <span className="app-registry-page__group-label">Group by</span>
          {(Object.keys(GROUP_LABEL) as GroupBy[]).map((g) => (
            <button
              key={g}
              className={`app-registry-page__group-btn ${groupBy === g ? 'app-registry-page__group-btn--active' : ''}`}
              onClick={() => setGroupBy(g)}
            >
              {GROUP_LABEL[g]}
            </button>
          ))}
        </div>
      </div>

      <div className="app-registry-page__content">
        <p className="app-registry-page__intro">
          Every application the Depot knows about — built, planned, or an external vendor
          product. Registering an app here never wires up a real integration; it's a claim
          about what exists and who owns it.
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

        {[...groups.entries()].map(([groupName, apps]) => (
          <section key={groupName} className="app-group">
            <h2 className="app-group__title">{groupName}</h2>
            <div className="app-grid">
              {apps.map((a) => (
                <div key={a.id} className="app-card">
                  <div className="app-card__top">
                    <span className="app-card__name">{a.name}</span>
                    <span className={`app-card__status app-card__status--${a.status}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </div>
                  {a.description && <div className="app-card__desc">{a.description}</div>}
                  <div className="app-card__meta">
                    {a.team_type && <span className="app-card__team-type">{a.team_type}</span>}
                    {a.owning_team && <span className="app-card__owner">{a.owning_team}</span>}
                  </div>
                  {a.url && (
                    <a className="app-card__link" href={a.url} target="_blank" rel="noreferrer">
                      {a.url} →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

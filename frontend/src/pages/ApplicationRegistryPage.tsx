import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApplications } from '../api/hooks'
import type { AppCategory, Application, Phase } from '../api/types'
import { APP_CATEGORIES, CATEGORY_INFO, CATEGORY_LABEL } from '../api/types'
import InfoPopover from '../components/InfoPopover'
import { usePersona } from '../lib/persona'
import './depot-shared.css'
import './ApplicationRegistryPage.css'

const PHASE_LABEL: Record<Phase, string> = {
  pursuit: 'Pursuit',
  award: 'Award',
  execution: 'Execution',
  closeout: 'Closeout',
}

type SortKey = 'name' | 'capability' | 'projects'

/** The "?" beside the Category filter — a legend mapping each aisle to its 15288 process group
 * and the kind of tool that lives there. */
function CategoryHelp() {
  return (
    <InfoPopover label="What the categories mean">
      <p className="info-pop__intro">
        Apps are grouped by the IEEE 15288 systems-engineering processes, plus a catch-all.
      </p>
      <div className="cat-help__scroll">
        <table className="cat-help__table">
          <thead>
            <tr>
              <th>Category</th>
              <th>15288</th>
              <th>Covers</th>
            </tr>
          </thead>
          <tbody>
            {APP_CATEGORIES.map((c) => (
              <tr key={c}>
                <td className="cat-help__name">{CATEGORY_LABEL[c]}</td>
                <td>{CATEGORY_INFO[c].group}</td>
                <td>{CATEGORY_INFO[c].covers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </InfoPopover>
  )
}

export default function ApplicationRegistryPage() {
  const navigate = useNavigate()
  const { data: applications, isLoading } = useApplications()
  const { persona } = usePersona()
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDesc, setSortDesc] = useState(false)
  // The catalog defaults to the whole org-wide list. A limited persona can flip to a per-
  // project view — their projects, each collapsible to the apps it connects to. See
  // lib/persona.tsx.
  const limitedPersona = persona && !persona.is_admin ? persona : null
  const [scope, setScope] = useState<'all' | 'mine'>('all')
  const grouped = !!limitedPersona && scope === 'mine'

  // Category is the browse axis — the app store's aisle, a fixed 15288-derived taxonomy. Shown
  // whole (even empty aisles) so a gap reads as "we have no tool for that process group yet".
  const [hiddenCategories, setHiddenCategories] = useState<Set<AppCategory>>(new Set())
  const catVisible = (a: Application) => !hiddenCategories.has(a.category ?? 'general')

  function toggleCategory(c: AppCategory) {
    setHiddenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  // Which project groups are collapsed — everything is expanded by default.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  function toggleProject(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
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

  function compare(a: Application, b: Application): number {
    switch (sortKey) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'capability':
        return (
          (a.capability_name ?? '').localeCompare(b.capability_name ?? '') ||
          a.name.localeCompare(b.name)
        )
      case 'projects':
        return a.project_count - b.project_count || a.name.localeCompare(b.name)
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return null
    return <span className="app-table__sort-arrow">{sortDesc ? '↓' : '↑'}</span>
  }

  const appsById = new Map((applications ?? []).map((a) => [a.id, a]))
  const allSorted = (applications ?? []).filter(catVisible).sort((a, b) => {
    const cmp = compare(a, b)
    return sortDesc ? -cmp : cmp
  })

  return (
    <div className="app-registry-page">
      <div className="app-registry-page__content">
        {limitedPersona && (
          <div className="depot-scope-toggle" role="group" aria-label="Which applications to show">
            <button
              className={`depot-scope-toggle__option ${scope === 'all' ? 'depot-scope-toggle__option--active' : ''}`}
              onClick={() => setScope('all')}
            >
              All Apps
            </button>
            <button
              className={`depot-scope-toggle__option ${scope === 'mine' ? 'depot-scope-toggle__option--active' : ''}`}
              onClick={() => setScope('mine')}
            >
              My Project Apps
            </button>
          </div>
        )}

        <div className="depot-checkbox-filter">
          <span className="depot-checkbox-filter__label">
            Category
            <CategoryHelp />
          </span>
          {APP_CATEGORIES.map((c) => (
            <label key={c} className="depot-checkbox-filter__option">
              <input
                type="checkbox"
                checked={!hiddenCategories.has(c)}
                onChange={() => toggleCategory(c)}
              />
              {CATEGORY_LABEL[c]}
            </label>
          ))}
        </div>

        {isLoading && <div className="app-registry-page__loading">Loading registry…</div>}

        {/* ── My Project Apps: the persona's projects, each collapsible ────────────── */}
        {!isLoading && grouped && (
          <div className="app-groups">
            {limitedPersona!.projects.length === 0 && (
              <div className="app-registry-page__loading">
                {limitedPersona!.name} isn't on any projects yet — switch to “All Apps”.
              </div>
            )}
            {limitedPersona!.projects.map((proj) => {
              const open = !collapsed.has(proj.id)
              const apps = proj.application_ids
                .map((id) => appsById.get(id))
                .filter((a): a is Application => !!a && catVisible(a))
                .sort((a, b) => a.name.localeCompare(b.name))
              return (
                <section className="app-group" key={proj.id}>
                  <div className="app-group__header">
                    <button
                      className="app-group__toggle"
                      onClick={() => toggleProject(proj.id)}
                      aria-expanded={open}
                    >
                      <span className="app-group__chev" aria-hidden="true">
                        {open ? '▾' : '▸'}
                      </span>
                      <span className="app-group__name">{proj.name}</span>
                      <span className={`app-group__phase app-group__phase--${proj.phase}`}>
                        {PHASE_LABEL[proj.phase]}
                      </span>
                      <span className="app-group__count">
                        {apps.length} app{apps.length === 1 ? '' : 's'}
                      </span>
                    </button>
                    <button
                      className="app-group__open"
                      onClick={() => navigate(`/projects/${proj.id}`)}
                      title="Open this project's home base"
                    >
                      Open →
                    </button>
                  </div>
                  {open && (
                    <div className="app-group__body">
                      {apps.length === 0 ? (
                        <p className="app-group__empty">
                          {proj.application_ids.length === 0
                            ? 'No apps connected yet.'
                            : 'No connected apps in the selected categories.'}
                        </p>
                      ) : (
                        apps.map((a) => (
                          <button
                            key={a.id}
                            className="app-group__row"
                            onClick={() => navigate(`/applications/${a.id}`)}
                          >
                            <span className="app-group__row-name">{a.name}</span>
                            <span className="app-group__row-cap">{a.capability_name ?? '—'}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}

        {/* ── All Apps: the flat, sortable catalog ────────────────────────────────── */}
        {!isLoading && !grouped && allSorted.length === 0 && (
          <div className="app-registry-page__loading">
            No applications match the selected categories.
          </div>
        )}

        {!isLoading && !grouped && allSorted.length > 0 && (
          <table className="app-table">
            <thead>
              <tr>
                <th className="app-table__sortable" onClick={() => toggleSort('name')}>
                  Name{sortIndicator('name')}
                </th>
                <th
                  className="app-table__sortable app-table__desc-col"
                  onClick={() => toggleSort('capability')}
                >
                  Capability{sortIndicator('capability')}
                </th>
                <th
                  className="app-table__sortable app-table__num-col"
                  onClick={() => toggleSort('projects')}
                  title="How many projects connect to this app — a rough read on which catalog entries are load-bearing"
                >
                  Projects using{sortIndicator('projects')}
                </th>
              </tr>
            </thead>
            <tbody>
              {allSorted.map((a: Application) => (
                <tr key={a.id} onClick={() => navigate(`/applications/${a.id}`)}>
                  <td className="app-table__name">{a.name}</td>
                  <td className="app-table__desc-col app-table__capability">
                    {a.capability_name ?? <span className="app-table__muted">—</span>}
                  </td>
                  <td className="app-table__num-col app-table__projects">
                    {a.project_count > 0 ? (
                      a.project_count
                    ) : (
                      <span className="app-table__muted">0</span>
                    )}
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

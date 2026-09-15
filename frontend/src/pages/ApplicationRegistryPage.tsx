import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApplications, usePinApp, useUnpinApp } from '../api/hooks'
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

// A small, hand-picked front row — not derived from any "featured" flag in the data (there
// isn't one), just the handful worth putting in front of someone before they've picked a
// category. Shown by name so it survives an app being renamed underneath it without silent
// breakage (a missing name just quietly drops that card).
const FEATURED_APP_NAMES = ['Good Plan', 'Value Stream', 'WinMax']

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
  const pinApp = usePinApp()
  const unpinApp = useUnpinApp()
  const [sortMode, setSortMode] = useState<'alpha' | 'popular'>('alpha')
  // The catalog defaults to the whole org-wide list. A limited persona can flip to a per-
  // project view — their projects, each collapsible to the apps it connects to. See
  // lib/persona.tsx.
  const limitedPersona = persona && !persona.is_admin ? persona : null
  const [scope, setScope] = useState<'all' | 'mine'>('all')
  const grouped = !!limitedPersona && scope === 'mine'

  // Category is the browse axis — the app store's aisle(s), a fixed 15288-derived taxonomy. Most
  // apps have one; a few straddle two. Shown whole (even empty aisles) so a gap reads as "we
  // have no tool for that process group yet". Every category starts hidden — the catalog opens
  // on the Featured row alone, not a full unfiltered dump; picking a category is what actually
  // browses the aisles.
  const [hiddenCategories, setHiddenCategories] = useState<Set<AppCategory>>(new Set(APP_CATEGORIES))
  const appCats = (a: Application): AppCategory[] =>
    a.categories?.length ? a.categories : [a.category ?? 'general']
  // Visible if it's filed under at least one category that isn't hidden.
  const catVisible = (a: Application) => appCats(a).some((c) => !hiddenCategories.has(c))

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

  const appsById = new Map((applications ?? []).map((a) => [a.id, a]))
  const featured = FEATURED_APP_NAMES
    .map((name) => (applications ?? []).find((a) => a.name === name))
    .filter((a): a is Application => !!a)

  // Results are grouped by aisle, not one flat list — a multi-category app (e.g. Reckon, filed
  // under both Projects and Organizational) shows up once per checked category it belongs to,
  // same as a real store shelving one product under more than one section. "Category" stopped
  // being a sort axis once category *is* the grouping; within a group, the only real choices
  // are alphabetical (browsing) or most-popular (project_count desc — "which entries are
  // actually load-bearing," the same signal the old sortable table's "Projects using" column
  // gave, just as a toggle instead of a clickable header now that this isn't a table).
  function sortApps(apps: Application[]): Application[] {
    return [...apps].sort((a, b) =>
      sortMode === 'popular'
        ? b.project_count - a.project_count || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name)
    )
  }

  const visibleCategories = APP_CATEGORIES.filter((c) => !hiddenCategories.has(c))
  const matchCount = (applications ?? []).filter(catVisible).length
  const groups = visibleCategories.map((c) => ({
    category: c,
    apps: sortApps((applications ?? []).filter((a) => appCats(a).includes(c))),
  }))

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
              onClick={() => {
                setScope('mine')
                // "My Apps" is already a small, curated list — starting every category
                // hidden (right for the big flat catalog, where Featured fills the gap) would
                // just show an empty group with no explanation. Reveal all categories the first
                // time someone switches here, same as this view's behavior before Featured
                // existed; leave it alone once they've touched the filter themselves.
                if (hiddenCategories.size === APP_CATEGORIES.length) setHiddenCategories(new Set())
              }}
            >
              My Apps
            </button>
          </div>
        )}

        {!isLoading && featured.length > 0 && (
          <section className="app-featured" aria-label="Featured applications">
            <span className="app-featured__label">Featured</span>
            <div className="app-featured__row">
              {featured.map((a) => (
                <button key={a.id} className="app-featured__card" onClick={() => navigate(`/catalog/${a.id}`)}>
                  <span className="app-featured__name">{a.name}</span>
                  {a.capability_name && <span className="app-featured__cap">{a.capability_name}</span>}
                  {a.description && <span className="app-featured__desc">{a.description}</span>}
                </button>
              ))}
            </div>
          </section>
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
          {!grouped && visibleCategories.length > 0 && (
            <span className="depot-checkbox-filter__summary">
              {matchCount} app{matchCount === 1 ? '' : 's'}
              <span className="depot-sort-toggle" role="group" aria-label="Sort results">
                <button
                  className={`depot-sort-toggle__option ${sortMode === 'popular' ? 'depot-sort-toggle__option--active' : ''}`}
                  onClick={() => setSortMode('popular')}
                >
                  Most popular
                </button>
                <span className="depot-sort-toggle__sep">·</span>
                <button
                  className={`depot-sort-toggle__option ${sortMode === 'alpha' ? 'depot-sort-toggle__option--active' : ''}`}
                  onClick={() => setSortMode('alpha')}
                >
                  Alphabetical
                </button>
              </span>
            </span>
          )}
        </div>

        {isLoading && <div className="app-registry-page__loading">Loading registry…</div>}

        {/* ── My Apps: the persona's projects, each collapsible ────────────── */}
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
                            onClick={() => navigate(`/catalog/${a.id}`)}
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

        {/* ── All Apps: browsed by aisle, cards not rows ──────────────────────────── */}
        {!isLoading && !grouped && (
          <div className="app-results">
            {visibleCategories.length === 0 ? (
              <div className="app-registry-page__loading">
                Pick a category above to browse the full catalog.
              </div>
            ) : (
              groups.map(({ category, apps }) => (
                <section className="app-result-group" key={category}>
                  <h2 className="app-result-group__title">
                    {CATEGORY_LABEL[category]}
                    <span className="app-result-group__count">
                      {apps.length} app{apps.length === 1 ? '' : 's'}
                    </span>
                  </h2>
                  {apps.length === 0 ? (
                    <p className="app-result-group__empty">No apps in this aisle yet.</p>
                  ) : (
                    <div className="app-result-cards">
                      {apps.map((a) => {
                        const pinned = !!persona?.pinned_application_ids.includes(a.id)
                        return (
                          <div key={a.id} className="app-result-card">
                            {persona && (
                              <button
                                className={`app-result-card__pin ${pinned ? 'app-result-card__pin--active' : ''}`}
                                title={pinned ? `Unpin ${a.name}` : `Pin ${a.name} to your Launchpad`}
                                onClick={() => {
                                  if (pinned) unpinApp.mutate({ personId: persona.id, applicationId: a.id })
                                  else pinApp.mutate({ person_id: persona.id, application_id: a.id })
                                }}
                              >
                                {pinned ? '★' : '☆'}
                              </button>
                            )}
                            <button className="app-result-card__button" onClick={() => navigate(`/catalog/${a.id}`)}>
                              <div className="app-result-card__main">
                                <span className="app-result-card__name">{a.name}</span>
                                {a.capability_name && <span className="app-result-card__cap">{a.capability_name}</span>}
                                {a.description && <p className="app-result-card__desc">{a.description}</p>}
                              </div>
                              <div className="app-result-card__meta">
                                {appCats(a).length > 1 && (
                                  <span className="app-result-card__pills">
                                    {appCats(a).map((cc) => (
                                      <span key={cc} className="app-result-card__pill">{CATEGORY_LABEL[cc]}</span>
                                    ))}
                                  </span>
                                )}
                                <span className="app-result-card__projects">
                                  {a.project_count > 0 ? (
                                    `${a.project_count} project${a.project_count === 1 ? '' : 's'}`
                                  ) : (
                                    <span className="app-table__muted">0 projects</span>
                                  )}
                                </span>
                              </div>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { useApplications, useApplyPinPreset, usePinPresets, useProjects } from '../api/hooks'
import type { Application, Phase, PersonProject } from '../api/types'
import { usePersona } from '../lib/persona'
import AppSummaryTile from '../components/AppSummaryTile'
import PinToggle from '../components/PinToggle'
import './depot-shared.css'
import './LaunchpadPage.css'

const PHASE_LABEL: Record<Phase, string> = {
  pursuit: 'Pursuit',
  award: 'Award',
  execution: 'Execution',
  closeout: 'Closeout',
}

/** The Depot's landing page — a shell now, not just the catalog. Two sections: Pinned apps,
 * then My projects. Pinned used to sit below a separate always-shown "Organizational" section —
 * merged the two (see backend models.HiddenOrgApp): an organizational app is pinned by
 * *default* for everyone, since it sits above any one project and there's nothing to "choose"
 * the way a project-scope app's pin is a choice. Showing it unconditionally in its own section
 * and then asking people to separately pin things was the same list, twice. Anyone who doesn't
 * want a given org app on their own Launchpad can remove it — via the ✕ here, or Reset it back
 * from the Catalog — same PinToggle control as everywhere else. The catalog itself moved to
 * /catalog — this page is what you land on, browsing by category is a deliberate second step
 * now, same as Featured did for the catalog. */
export default function LaunchpadPage() {
  const navigate = useNavigate()
  const { persona } = usePersona()
  const { data: applications, isLoading: appsLoading } = useApplications()
  const { data: allProjects } = useProjects()

  const pinnedApps = (applications ?? [])
    .filter((a) => persona?.pinned_application_ids.includes(a.id))
    // Keep pin order stable and independent of the app list's own order.
    .sort((a, b) => (persona?.pinned_application_ids.indexOf(a.id) ?? 0) - (persona?.pinned_application_ids.indexOf(b.id) ?? 0))

  const myProjects = persona?.projects ?? []
  const reachCount = persona?.project_ids.length ?? 0
  const totalProjects = allProjects?.length ?? reachCount

  function AppCard({ app }: { app: Application }) {
    return (
      <div className="lp-app-card">
        <button className="lp-app-card__main" onClick={() => navigate(`/catalog/${app.id}`)}>
          <span className="lp-app-card__name">{app.name}</span>
          {app.capability_name && <span className="lp-app-card__cap">{app.capability_name}</span>}
          <AppSummaryTile applicationId={app.id} />
        </button>
        <div className="lp-app-card__unpin">
          <PinToggle app={app} />
        </div>
      </div>
    )
  }

  function ProjectCard({ proj }: { proj: PersonProject }) {
    const tag = persona?.is_admin ? 'Admin' : proj.role_label ?? '—'
    const chipApps = proj.application_ids.slice(0, 4)
    return (
      <button className="lp-project-card" onClick={() => navigate(`/projects/${proj.id}`)}>
        <div className="lp-project-card__top">
          <span className="lp-project-card__name">{proj.name}</span>
          <span className="lp-project-card__tag">{tag}</span>
        </div>
        <div className="lp-project-card__phase">{PHASE_LABEL[proj.phase]}</div>
        {chipApps.length > 0 && (
          <div className="lp-project-card__chips">
            {chipApps.map((appId) => (
              <div className="lp-chip" key={appId}>
                <AppSummaryTile applicationId={appId} projectId={proj.id} />
              </div>
            ))}
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="launchpad-page">
      <div className="launchpad-page__content">
        <header className="launchpad-page__header">
          <h1 className="launchpad-page__title">
            {persona ? `Welcome, ${persona.name}.` : 'Launchpad'}
          </h1>
        </header>

        <section className="lp-section">
          <div className="lp-section__head">
            <span className="lp-section__title">Pinned apps</span>
            <span className="lp-section__hint">organizational apps, plus anything you've pinned</span>
            <PresetDropdown personId={persona?.id} />
            <button className="lp-section__link" onClick={() => navigate('/catalog')}>Browse catalog →</button>
          </div>
          {appsLoading ? (
            <p className="launchpad-page__loading">Loading…</p>
          ) : pinnedApps.length === 0 ? (
            <p className="lp-section__empty">Nothing pinned yet — pin an app from the catalog to keep it here.</p>
          ) : (
            <div className="lp-app-grid">
              {pinnedApps.map((a) => <AppCard app={a} key={a.id} />)}
            </div>
          )}
        </section>

        <section className="lp-section">
          <div className="lp-section__head">
            <span className="lp-section__title">My projects</span>
            <span className="lp-section__hint">{reachCount} of {totalProjects} in reach</span>
            <button className="lp-section__link" onClick={() => navigate('/projects')}>All projects →</button>
          </div>
          {myProjects.length === 0 ? (
            <p className="lp-section__empty">
              {persona ? `${persona.name} isn't on any projects yet.` : 'Loading…'}
            </p>
          ) : (
            <div className="lp-project-grid">
              {myProjects.map((p) => <ProjectCard proj={p} key={p.id} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/** "Apply a preset" — a curated starting set of pins for a role (see backend presets.py). Not
 * a persistent choice: picking one replaces the whole pinned set right away and the select
 * resets to its placeholder — same one-time-action shape as clicking a button, just packaged
 * as a dropdown because there are five of them. "Default" is the reset case (all organizational
 * apps, nothing else), not a separate control. */
function PresetDropdown({ personId }: { personId: string | undefined }) {
  const { data: presets } = usePinPresets()
  const applyPreset = useApplyPinPreset()

  if (!personId || !presets || presets.length === 0) return null

  return (
    <select
      className="lp-preset-select"
      value=""
      disabled={applyPreset.isPending}
      onChange={(e) => {
        const preset = e.target.value
        if (preset) applyPreset.mutate({ person_id: personId, preset })
      }}
    >
      <option value="" disabled>
        Apply preset…
      </option>
      {presets.map((p) => (
        <option key={p.key} value={p.key} title={p.description}>
          {p.label}
        </option>
      ))}
    </select>
  )
}

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useAddExternalId,
  useApplications,
  useCreateLink,
  useDeleteExternalId,
  useDeleteLink,
  useDeleteProject,
  usePortfolios,
  useProject,
  useUpdateProject,
} from '../api/hooks'
import type { ChannelLink, Phase, ProjectDetail } from '../api/types'
import { PHASES } from '../api/types'
import { OUTBOUND_TARGET } from '../lib/embed'
import './depot-shared.css'
import './ProjectDetailPage.css'

const PHASE_LABEL: Record<Phase, string> = {
  pursuit: 'Pursuit',
  award: 'Award',
  execution: 'Execution',
  closeout: 'Closeout',
}

const PHASE_ORDER: Record<Phase, number> = Object.fromEntries(
  PHASES.map((p, i) => [p, i]),
) as Record<Phase, number>

/** A project's detail page IS its home base — everything a PM needs for one project: the
 * digital thread, the tools wired up to it, the crosswalk to external systems, the phase
 * history, and the team / channels. (This absorbed the standalone "Launchpad" app; the Depot's
 * project list + Application Registry remain the portfolio-level view above it.) */
export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { data: project, isLoading } = useProject(projectId)
  const updateProject = useUpdateProject(projectId ?? '')
  const deleteProject = useDeleteProject()

  if (!projectId) return null
  if (isLoading || !project) return <div className="project-detail-page__loading">Loading…</div>

  function handleDelete() {
    if (!confirm(`Delete "${project!.name}"? This cannot be undone.`)) return
    deleteProject.mutate(project!.id)
    navigate('/')
  }

  return (
    <div className="project-detail-page">
      <div className="project-detail-page__toolbar">
        <input
          className="project-detail-page__title"
          value={project.name}
          onChange={(e) => updateProject.mutate({ name: e.target.value })}
        />
        <select
          className="project-detail-page__portfolio-select"
          value={project.portfolio_id ?? ''}
          onChange={(e) => updateProject.mutate({ portfolio_id: e.target.value || null })}
        >
          <option value="">No portfolio</option>
          <Portfolios />
        </select>
        <select
          className="project-detail-page__phase-select"
          value={project.phase}
          onChange={(e) => updateProject.mutate({ phase: e.target.value as Phase })}
        >
          {PHASES.map((ph) => (
            <option key={ph} value={ph}>
              {PHASE_LABEL[ph]}
            </option>
          ))}
        </select>
        <button className="project-detail-page__delete" onClick={handleDelete}>
          Delete
        </button>
      </div>

      <div className="project-detail-page__content">
        <ThreadBlock project={project} onCustomer={(v) => updateProject.mutate({ customer: v })} />

        <ConnectedApps project={project} />

        <ExternalIds project={project} />

        <section className="depot-section">
          <h2 className="depot-section__title">Phase History</h2>
          <p className="depot-section__subtitle">
            When this project actually moved, not just where it is now.
          </p>
          <div className="phase-history">
            {project.phase_events.map((e) => (
              <div key={e.id} className="phase-history__event">
                <span className="phase-history__transition">
                  {e.from_phase ? PHASE_LABEL[e.from_phase] : 'Created'}
                  <span className="phase-history__arrow">→</span>
                  {PHASE_LABEL[e.to_phase]}
                </span>
                <span className="phase-history__date">
                  {new Date(e.occurred_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>

        <HomeBase key={project.updated_at} project={project} />
      </div>
    </div>
  )
}

function Portfolios() {
  const { data: portfolios } = usePortfolios()
  return (
    <>
      {portfolios?.map((pf) => (
        <option key={pf.id} value={pf.id}>
          {pf.name}
        </option>
      ))}
    </>
  )
}

function ThreadBlock({
  project,
  onCustomer,
}: {
  project: ProjectDetail
  onCustomer: (v: string) => void
}) {
  const [copied, setCopied] = useState(false)

  function copyId() {
    navigator.clipboard?.writeText(project.id).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      },
      () => {},
    )
  }

  return (
    <section className="thread-block">
      <div className="thread-block__row">
        <span className="thread-block__label">Digital thread</span>
        <button className="thread-block__id" onClick={copyId} title="Copy id">
          <code>{project.id}</code>
          <span className="thread-block__copy">{copied ? 'copied' : 'copy'}</span>
        </button>
      </div>
      <div className="thread-block__row">
        <span className="thread-block__label">Customer</span>
        <input
          className="thread-block__customer"
          value={project.customer ?? ''}
          placeholder="—"
          onChange={(e) => onCustomer(e.target.value)}
        />
      </div>
      {project.portfolio_name && (
        <div className="thread-block__row">
          <span className="thread-block__label">Portfolio</span>
          <span>{project.portfolio_name}</span>
        </div>
      )}
      {project.description && <p className="thread-block__desc">{project.description}</p>}
    </section>
  )
}

function ConnectedApps({ project }: { project: ProjectDetail }) {
  const { data: applications } = useApplications()
  const createLink = useCreateLink(project.id)
  const deleteLink = useDeleteLink(project.id)

  const [adding, setAdding] = useState(false)
  const [appId, setAppId] = useState('')
  const [phase, setPhase] = useState<Phase>(project.phase)
  const [ref, setRef] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')

  const links = [...project.app_links].sort(
    (a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || (a.application_name ?? '').localeCompare(b.application_name ?? ''),
  )
  const linkedIds = new Set(project.app_links.map((l) => l.application_id))
  const connectable = (applications ?? []).filter((a) => !linkedIds.has(a.id))

  function reset() {
    setAdding(false)
    setAppId('')
    setPhase(project.phase)
    setRef('')
    setUrl('')
    setNotes('')
  }

  function save() {
    if (!appId) return
    const picked = applications?.find((a) => a.id === appId)
    createLink.mutate(
      {
        application_id: appId,
        phase,
        external_ref: ref.trim() || undefined,
        link_url: url.trim() || picked?.url || undefined,
        notes: notes.trim() || undefined,
      },
      { onSuccess: reset },
    )
  }

  return (
    <section className="depot-section">
      <div className="depot-section__header-row">
        <h2 className="depot-section__title">Connected applications</h2>
        {!adding && connectable.length > 0 && (
          <button onClick={() => setAdding(true)}>+ Connect an application</button>
        )}
      </div>
      <p className="depot-section__subtitle">
        The tools this project has a record in. Each is a stored pointer — click through to open
        the app, it's never a live connection.
      </p>

      {links.length === 0 && !adding && (
        <p className="depot-section__body">Nothing connected yet.</p>
      )}

      <div className="connected-apps">
        {links.map((l) => (
          <div key={l.id} className="app-link-card">
            <div className="app-link-card__top">
              <span className="app-link-card__name">{l.application_name}</span>
              <span className="app-link-card__tags">
                {l.application_status && (
                  <span className={`app-link-card__status app-link-card__status--${l.application_status}`}>
                    {l.application_status}
                  </span>
                )}
                <span className="app-link-card__phase">{PHASE_LABEL[l.phase]}</span>
              </span>
            </div>
            {l.external_ref && <div className="app-link-card__ref">{l.external_ref}</div>}
            {l.notes && <div className="app-link-card__notes">{l.notes}</div>}
            <div className="app-link-card__actions">
              {l.link_url ? (
                <a
                  className="app-link-card__open"
                  href={l.link_url}
                  target={OUTBOUND_TARGET}
                  rel="noreferrer"
                >
                  Open {l.application_name} →
                </a>
              ) : (
                <span className="app-link-card__nolink">no reachable URL</span>
              )}
              <button className="app-link-card__remove" onClick={() => deleteLink.mutate(l.id)}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {adding && (
        <div className="depot-inline-form depot-inline-form--stacked">
          <select value={appId} onChange={(e) => setAppId(e.target.value)}>
            <option value="">Select application…</option>
            {connectable.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.status})
              </option>
            ))}
          </select>
          <select value={phase} onChange={(e) => setPhase(e.target.value as Phase)}>
            {PHASES.map((ph) => (
              <option key={ph} value={ph}>
                Attached at {PHASE_LABEL[ph]}
              </option>
            ))}
          </select>
          <input placeholder="External ref (optional)" value={ref} onChange={(e) => setRef(e.target.value)} />
          <input placeholder="Link URL (optional — defaults to the app's own URL)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="depot-inline-form__actions">
            <button disabled={!appId} onClick={save}>
              Connect
            </button>
            <button onClick={reset}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  )
}

function ExternalIds({ project }: { project: ProjectDetail }) {
  const addExternalId = useAddExternalId(project.id)
  const deleteExternalId = useDeleteExternalId(project.id)
  const [show, setShow] = useState(false)
  const [system, setSystem] = useState('')
  const [value, setValue] = useState('')

  return (
    <section className="depot-section">
      <div className="depot-section__header-row">
        <h2 className="depot-section__title">External System IDs</h2>
        <button onClick={() => setShow((v) => !v)}>+ Add</button>
      </div>
      {project.external_ids.length === 0 && (
        <p className="depot-section__body">
          No crosswalk entries yet — the Depot's own id is the only thread so far.
        </p>
      )}
      <div className="external-id-list">
        {project.external_ids.map((e) => (
          <div key={e.id} className="external-id-chip">
            <span className="external-id-chip__system">{e.system}</span>
            <span className="external-id-chip__value">{e.external_id}</span>
            <button
              className="external-id-chip__remove"
              onClick={() => deleteExternalId.mutate(e.id)}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {show && (
        <div className="depot-inline-form">
          <input placeholder="System (e.g. WinMax)" value={system} onChange={(e) => setSystem(e.target.value)} />
          <input placeholder="External ID (e.g. OPP-8891)" value={value} onChange={(e) => setValue(e.target.value)} />
          <button
            disabled={!system.trim() || !value.trim()}
            onClick={() =>
              addExternalId.mutate(
                { system: system.trim(), external_id: value.trim() },
                {
                  onSuccess: () => {
                    setSystem('')
                    setValue('')
                    setShow(false)
                  },
                },
              )
            }
          >
            Save
          </button>
        </div>
      )}
    </section>
  )
}

function HomeBase({ project }: { project: ProjectDetail }) {
  const updateProject = useUpdateProject(project.id)
  const [notes, setNotes] = useState(project.team_notes ?? '')
  const [channels, setChannels] = useState<ChannelLink[]>(project.channels ?? [])
  const [dirty, setDirty] = useState(false)

  function save() {
    updateProject.mutate(
      { team_notes: notes || null, channels },
      { onSuccess: () => setDirty(false) },
    )
  }

  function updateChannel(i: number, patch: Partial<ChannelLink>) {
    setChannels((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
    setDirty(true)
  }

  return (
    <section className="depot-section">
      <div className="depot-section__header-row">
        <h2 className="depot-section__title">Team &amp; channels</h2>
        {dirty && (
          <button onClick={save} disabled={updateProject.isPending}>
            {updateProject.isPending ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
      <p className="depot-section__subtitle">
        The working context for this project's team — who's on it, where they talk.
      </p>

      <label className="home-base__field">
        <span>Team / notes</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
            setDirty(true)
          }}
          placeholder="PM, leads, key contacts, standing meetings — anything the team needs on hand."
        />
      </label>

      <div className="home-base__field">
        <span>Channels</span>
        {channels.map((c, i) => (
          <div key={i} className="home-base__channel">
            <input
              value={c.label}
              onChange={(e) => updateChannel(i, { label: e.target.value })}
              placeholder="Label (e.g. Slack)"
            />
            <input
              value={c.url}
              onChange={(e) => updateChannel(i, { url: e.target.value })}
              placeholder="https://…"
            />
            <button
              className="home-base__channel-remove"
              onClick={() => {
                setChannels((cs) => cs.filter((_, idx) => idx !== i))
                setDirty(true)
              }}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          className="home-base__channel-add"
          onClick={() => {
            setChannels((cs) => [...cs, { label: '', url: '' }])
            setDirty(true)
          }}
        >
          + Add channel
        </button>
      </div>
    </section>
  )
}

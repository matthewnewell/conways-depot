import { useQueries } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  fetchApplicationJournal,
  journalQueryKey,
  useAddExternalId,
  useAddMember,
  useApplications,
  useCreateLink,
  useDeleteExternalId,
  useDeleteLink,
  useDeleteMembership,
  useDeleteProject,
  usePeople,
  usePortfolios,
  useProject,
  useProjectNotes,
  useUpdateMembership,
  useUpdateProject,
} from '../api/hooks'
import type { ChannelLink, Phase, ProjectDetail, TeamTopology } from '../api/types'
import { PHASES, TEAM_TOPOLOGIES, TEAM_TOPOLOGY_INFO } from '../api/types'
import InfoPopover from '../components/InfoPopover'
import JournalFeed, { type TaggedJournalEntry } from '../components/JournalFeed'
import { OUTBOUND_TARGET } from '../lib/embed'
import { usePersona } from '../lib/persona'
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
      <div className="project-detail-page__content">
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

        <Members project={project} />

        <HomeBase key={project.updated_at} project={project} />

        <Journal project={project} />
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
              <span className="app-link-card__phase">{PHASE_LABEL[l.phase]}</span>
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
                {a.name}
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

/** Real people on this project — not free-text like "Team & channels" below it. Add/remove and
 * the "can manage members" toggle are only shown to the active persona if they're allowed to
 * use them: admin, or already `can_manage_members` on *this* project. That's a soft,
 * "signposting, not enforcement" gate — same as every other admin-only affordance in this app
 * (there's no real auth anywhere) — not a permission system. See ProjectMembership's backend
 * docstring for why this one flag exists at all when nothing else here is checked. */
function Members({ project }: { project: ProjectDetail }) {
  const { persona } = usePersona()
  const { data: people } = usePeople()
  const addMember = useAddMember(project.id)
  const updateMembership = useUpdateMembership(project.id)
  const deleteMembership = useDeleteMembership(project.id)

  const [adding, setAdding] = useState(false)
  const [personId, setPersonId] = useState('')
  const [roleLabel, setRoleLabel] = useState('')
  const [canManage, setCanManage] = useState(false)

  const activeMembership = persona ? project.members.find((m) => m.person_id === persona.id) : undefined
  const canEdit = !!persona?.is_admin || !!activeMembership?.can_manage_members

  const memberIds = new Set(project.members.map((m) => m.person_id))
  const addable = (people ?? []).filter((p) => !p.is_admin && !memberIds.has(p.id))

  function reset() {
    setAdding(false)
    setPersonId('')
    setRoleLabel('')
    setCanManage(false)
  }

  function save() {
    if (!personId) return
    addMember.mutate(
      { person_id: personId, role_label: roleLabel.trim() || undefined, can_manage_members: canManage },
      { onSuccess: reset },
    )
  }

  return (
    <section className="depot-section">
      <div className="depot-section__header-row">
        <h2 className="depot-section__title">Members</h2>
        {canEdit && !adding && addable.length > 0 && (
          <button onClick={() => setAdding(true)}>+ Add member</button>
        )}
      </div>
      <p className="depot-section__subtitle">
        Who's actually on this project — a real persona, not a caption.
      </p>

      {project.members.length === 0 && !adding && (
        <p className="depot-section__body">No members yet.</p>
      )}

      <div className="member-list">
        {project.members.map((m) => (
          <div key={m.id} className="member-card">
            <div className="member-card__main">
              <span className="member-card__name">{m.person_name}</span>
              {m.role_label && <span className="member-card__role">{m.role_label}</span>}
              {m.can_manage_members && (
                <span className="member-card__badge" title="Can add and remove members on this project">
                  Can manage members
                </span>
              )}
            </div>
            {canEdit && (
              <div className="member-card__actions">
                <button
                  className="member-card__toggle"
                  onClick={() => updateMembership.mutate({ membershipId: m.id, can_manage_members: !m.can_manage_members })}
                >
                  {m.can_manage_members ? 'Revoke manage' : 'Grant manage'}
                </button>
                <button className="member-card__remove" onClick={() => deleteMembership.mutate(m.id)}>
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {canEdit && adding && (
        <div className="depot-inline-form depot-inline-form--stacked">
          <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
            <option value="">Select person…</option>
            {addable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.title ? ` — ${p.title}` : ''}
              </option>
            ))}
          </select>
          <input
            placeholder="Role label (optional — e.g. Program Manager)"
            value={roleLabel}
            onChange={(e) => setRoleLabel(e.target.value)}
          />
          <label className="member-form__checkbox">
            <input type="checkbox" checked={canManage} onChange={(e) => setCanManage(e.target.checked)} />
            Can manage members on this project
          </label>
          <div className="depot-inline-form__actions">
            <button disabled={!personId} onClick={save}>
              Add
            </button>
            <button onClick={reset}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  )
}

function HomeBase({ project }: { project: ProjectDetail }) {
  const updateProject = useUpdateProject(project.id)
  const [notes, setNotes] = useState(project.team_notes ?? '')
  const [channels, setChannels] = useState<ChannelLink[]>(project.channels ?? [])
  const [topology, setTopology] = useState<TeamTopology | ''>(project.team_topology ?? '')
  const [hasManufacturing, setHasManufacturing] = useState<'' | 'yes' | 'no'>(
    project.has_manufacturing === true ? 'yes' : project.has_manufacturing === false ? 'no' : '',
  )
  const [dirty, setDirty] = useState(false)

  function save() {
    updateProject.mutate(
      {
        team_notes: notes || null,
        channels,
        team_topology: topology || null,
        has_manufacturing: hasManufacturing === '' ? null : hasManufacturing === 'yes',
      },
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

      <div className="home-base__field">
        <span className="home-base__field-label">
          Team topology
          <InfoPopover label="Team Topologies team types">
            <p className="info-pop__intro">
              The four team shapes from <em>Team Topologies</em> (Skelton &amp; Pais) — pick the
              one that best fits this project's delivery team.
            </p>
            <ul className="info-pop__list">
              {TEAM_TOPOLOGIES.map((t) => (
                <li key={t}>
                  <strong>{TEAM_TOPOLOGY_INFO[t].label}</strong> — {TEAM_TOPOLOGY_INFO[t].blurb}
                </li>
              ))}
            </ul>
          </InfoPopover>
        </span>
        <select
          className="home-base__topology"
          value={topology}
          onChange={(e) => {
            setTopology(e.target.value as TeamTopology | '')
            setDirty(true)
          }}
        >
          <option value="">— not set —</option>
          {TEAM_TOPOLOGIES.map((t) => (
            <option key={t} value={t}>
              {TEAM_TOPOLOGY_INFO[t].label}
            </option>
          ))}
        </select>
      </div>

      <div className="home-base__field">
        <span className="home-base__field-label">
          Manufacturing project
          <InfoPopover label="What this means">
            <p className="info-pop__intro">
              Provisional — stands in for a decision a future "Project Planning" app would
              eventually own (a manufacturing project would require a manufacturing plan there).
              Apps like MARTI read this directly; leave unset if unknown.
            </p>
          </InfoPopover>
        </span>
        <select
          className="home-base__topology"
          value={hasManufacturing}
          onChange={(e) => {
            setHasManufacturing(e.target.value as '' | 'yes' | 'no')
            setDirty(true)
          }}
        >
          <option value="">— unknown —</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>

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

/** The cross-app journal, federated — not one shared table, one merged *view*. Every connected
 * app keeps its own journal exactly as it always has; this fetches each one's `/journal`
 * (via the Depot's own per-app proxy, same server-to-server pattern as AppSummaryTile), plus
 * this project's own manually-authored notes (models.JournalNote — same entry shape, written
 * from the Launchpad's JournalPanel composer, not here; see that component for why), and merges
 * everything into one reverse-chronological feed, tagged by source. `useQueries` (not a loop of
 * `useQuery`) because the number of connected apps is dynamic — React's hook rules don't allow a
 * variable number of `useQuery` calls. One slow or unreachable app's query just sits
 * loading/failed on its own; it never blocks the others' entries from rendering. This is the
 * real point of the whole thing: a merged record an agent (or a person) can read straight
 * through to understand how a project actually got here, without opening five separate apps. */
function Journal({ project }: { project: ProjectDetail }) {
  const results = useQueries({
    queries: project.app_links.map((link) => ({
      queryKey: journalQueryKey(link.application_id, project.id),
      queryFn: () => fetchApplicationJournal(link.application_id, project.id),
      staleTime: 30_000,
      retry: false,
    })),
  })
  const { data: notes, isLoading: notesLoading } = useProjectNotes(project.id)

  const appRows: TaggedJournalEntry[] = project.app_links.flatMap((link, i) => {
    const entries = results[i]?.data?.entries ?? []
    return entries.map((e) => ({ ...e, source_label: link.application_name }))
  })
  const noteRows: TaggedJournalEntry[] = (notes?.entries ?? []).map((e) => ({
    ...e,
    source_label: e.author ? `${e.author}'s note` : 'A note',
  }))
  const rows = [...appRows, ...noteRows]
  rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const anyLoading = results.some((r) => r.isLoading) || notesLoading

  return (
    <section className="depot-section">
      <h2 className="depot-section__title">Journal</h2>
      <p className="depot-section__subtitle">
        Merged from every connected app's own journal, plus notes logged here directly (from the
        📝 Journal panel) — how this project actually got here, not just where it is now.
      </p>

      {rows.length === 0 && (
        <p className="depot-section__body">
          {anyLoading
            ? 'Loading…'
            : project.app_links.length === 0
              ? 'Connect an application, or log a note from the 📝 Journal panel, to start seeing entries here.'
              : 'No journal entries from connected apps yet.'}
        </p>
      )}

      <JournalFeed entries={rows} />
    </section>
  )
}

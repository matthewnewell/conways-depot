import { useQueries } from '@tanstack/react-query'
import { useState } from 'react'
import { useDrawer } from '@conways/drawer'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  fetchApplicationJournal,
  journalQueryKey,
  useAddExternalId,
  useAddMember,
  useApplicationSummary,
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
import type { Phase, ProjectDetail, TeamTopology } from '../api/types'
import { PHASES, TEAM_TOPOLOGIES, TEAM_TOPOLOGY_INFO } from '../api/types'
import AppSummaryTile from '../components/AppSummaryTile'
import { LinkList, LinksEditor } from '../components/Links'
import InfoPopover from '../components/InfoPopover'
import JournalFeed, { type TaggedJournalEntry } from '../components/JournalFeed'
import { withDepotOrigin } from '../lib/launch'
import { S4_SYSTEM, s4ExternalId } from '../lib/s4'
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

/** A project's detail page IS its home base: the operating surface for everyone — connected apps to
 * launch, the merged journal, the project's links — in a wide two-column layout. Everything about
 * the project *itself* lives in the shared drawer's top tabs (see DepotLayout): **Project info**
 * (what it is), **Team** (who's on it, and adding/removing them) and **Admin** (what an owner
 * changes, plus Delete). Like every admin affordance in this app, Admin is signposting, not
 * enforcement — there is no auth or role check yet. */
export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: project, isLoading } = useProject(projectId)
  const { openTab } = useDrawer()

  if (!projectId) return null
  if (isLoading || !project) return <div className="project-detail-page__loading">Loading…</div>

  return (
    <div className="project-detail-page">
      <div className="project-detail-page__content">
        <header className="project-head">
          <div className="project-head__main">
            <h1 className="project-head__title">{project.name}</h1>
            {project.description && <p className="project-head__desc">{project.description}</p>}
          </div>
        </header>

        <div className="project-overview">
          <div className="project-overview__main">
            <ConnectedApps project={project} />
            <Journal project={project} />
          </div>
          <aside className="project-overview__side">
            <JumpStation project={project} onSetUp={() => openTab('admin')} />
          </aside>
        </div>
      </div>
    </div>
  )
}

/** Drawer tab: what this project is — the labeled facts, then how it got to its current phase. */
export function ProjectInfoPanel({ project }: { project: ProjectDetail }) {
  const { openTab } = useDrawer()
  return (
    <div className="info-panel">
      <dl className="project-facts__list">
        <div className="project-facts__row">
          <dt>Phase</dt>
          <dd>
            <span className="project-head__phase">{PHASE_LABEL[project.phase]}</span>
          </dd>
        </div>
        <div className="project-facts__row">
          <dt>Portfolio</dt>
          <dd>{project.portfolio_name ?? <span className="project-facts__none">—</span>}</dd>
        </div>
        <div className="project-facts__row">
          <dt>Customer</dt>
          <dd>{project.customer ?? <span className="project-facts__none">—</span>}</dd>
        </div>
        <div className="project-facts__row">
          <dt>S4 project</dt>
          <dd>
            <S4Headline project={project} onSetUp={() => openTab('admin')} />
          </dd>
        </div>
        <div className="project-facts__row">
          <dt>Contract</dt>
          <dd>
            {project.contract_url ? (
              <a className="contract-link" href={project.contract_url} target="_blank" rel="noopener noreferrer">
                Open contract ↗
              </a>
            ) : (
              <button className="contract-link contract-link--empty" onClick={() => openTab('admin')}>
                Not linked — add it in Admin
              </button>
            )}
          </dd>
        </div>
      </dl>
      <PhaseHistory project={project} />
    </div>
  )
}

/** Drawer tab: the people on this project — add, remove, grant the manage flag. */
export function ProjectTeamPanel({ project }: { project: ProjectDetail }) {
  return <Members project={project} />
}

/** Drawer tab: everything an owner changes, with Delete at the bottom behind a typed confirmation. */
export function ProjectAdminPanel({ project }: { project: ProjectDetail }) {
  const navigate = useNavigate()
  const deleteProject = useDeleteProject()
  return (
    <div className="project-admin project-admin--stack">
      <Details project={project} />
      <ConnectedApps project={project} manage />
      <ProjectLinks key={project.updated_at} project={project} />
      <HomeBase key={project.updated_at} project={project} />
      <DangerZone
        project={project}
        onDelete={() => {
          deleteProject.mutate(project.id)
          navigate('/')
        }}
      />
    </div>
  )
}

/** The S4 project id as the project's headline identifier — the thing people search and quote. If
 * it isn't recorded yet, a quiet prompt points at Admin instead of leaving a blank. */
function S4Headline({ project, onSetUp }: { project: ProjectDetail; onSetUp: () => void }) {
  const [copied, setCopied] = useState(false)
  const s4 = s4ExternalId(project)

  if (!s4) {
    return (
      <button className="s4-headline s4-headline--empty" onClick={onSetUp}>
        S4 project ID not set — add it in Admin
      </button>
    )
  }

  function copy() {
    navigator.clipboard?.writeText(s4!.external_id).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      },
      () => {},
    )
  }

  return (
    <button className="s4-headline" onClick={copy} title="Copy S4 project id">
      <span className="s4-headline__label">S4 project</span>
      <code className="s4-headline__id">{s4.external_id}</code>
      <span className="s4-headline__copy">{copied ? 'copied' : 'copy'}</span>
    </button>
  )
}

/** Admin field for the S4 project id. Stored as a normal crosswalk entry (system "S4") so every
 * other reader of external IDs keeps working; this just gives it a dedicated, obvious input
 * instead of leaving it as one chip among many. */
function S4Field({ project }: { project: ProjectDetail }) {
  const addExternalId = useAddExternalId(project.id)
  const deleteExternalId = useDeleteExternalId(project.id)
  const current = s4ExternalId(project)
  const [value, setValue] = useState(current?.external_id ?? '')
  const [saving, setSaving] = useState(false)
  const trimmed = value.trim()
  const dirty = trimmed !== (current?.external_id ?? '')

  async function save() {
    setSaving(true)
    try {
      if (current) await deleteExternalId.mutateAsync(current.id)
      if (trimmed) await addExternalId.mutateAsync({ system: S4_SYSTEM, external_id: trimmed })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-field">
      <span>S4 project ID</span>
      <div className="admin-field__row">
        <input
          value={value}
          placeholder="e.g. P-100234"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && dirty && save()}
        />
        {dirty && (
          <button className="admin-field__save" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
      <small className="admin-field__hint">
        The system of record for this project's charges and WBS. Shown as the project's headline ID.
      </small>
    </div>
  )
}

function PhaseHistory({ project }: { project: ProjectDetail }) {
  return (
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
  )
}

/** Owner-facing facts: name, customer, portfolio, phase, and the Depot's own thread id. The
 * Depot id stays here as an internal handle — the S4 project id is meant to become the headline
 * identifier (see the External System IDs crosswalk). */
function Details({ project }: { project: ProjectDetail }) {
  const updateProject = useUpdateProject(project.id)
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
    <section className="depot-section">
      <h2 className="depot-section__title">Details</h2>
      <div className="admin-fields">
        <S4Field key={s4ExternalId(project)?.id ?? 'none'} project={project} />
        <label className="admin-field">
          <span>Name</span>
          <input value={project.name} onChange={(e) => updateProject.mutate({ name: e.target.value })} />
        </label>
        <label className="admin-field">
          <span>Customer</span>
          <input
            value={project.customer ?? ''}
            placeholder="—"
            onChange={(e) => updateProject.mutate({ customer: e.target.value })}
          />
        </label>
        <label className="admin-field">
          <span>Contract link</span>
          <input
            key={project.contract_url ?? ''}
            defaultValue={project.contract_url ?? ''}
            placeholder="https://… (SharePoint or contract repository)"
            onBlur={(e) => {
              const raw = e.target.value.trim()
              const next = raw && !/^[a-z][a-z0-9+.-]*:/i.test(raw) ? `https://${raw}` : raw
              if (next !== (project.contract_url ?? '')) updateProject.mutate({ contract_url: next || null })
            }}
          />
        </label>
        <label className="admin-field">
          <span>Portfolio</span>
          <select
            value={project.portfolio_id ?? ''}
            onChange={(e) => updateProject.mutate({ portfolio_id: e.target.value || null })}
          >
            <option value="">No portfolio</option>
            <Portfolios />
          </select>
        </label>
        <label className="admin-field">
          <span>Phase</span>
          <select value={project.phase} onChange={(e) => updateProject.mutate({ phase: e.target.value as Phase })}>
            {PHASES.map((ph) => (
              <option key={ph} value={ph}>
                {PHASE_LABEL[ph]}
              </option>
            ))}
          </select>
        </label>
        <div className="admin-field">
          <span>Depot ID (internal)</span>
          <button className="thread-block__id" onClick={copyId} title="Copy id">
            <code>{project.id}</code>
            <span className="thread-block__copy">{copied ? 'copied' : 'copy'}</span>
          </button>
        </div>
      </div>
    </section>
  )
}

/** Delete lives at the bottom of Admin behind a typed confirmation, not beside the title. */
function DangerZone({ project, onDelete }: { project: ProjectDetail; onDelete: () => void }) {
  const [typed, setTyped] = useState('')
  const matches = typed.trim() === project.name.trim()
  return (
    <section className="depot-section project-danger">
      <h2 className="depot-section__title">Delete this project</h2>
      <p className="depot-section__subtitle">
        Removes the project and its links, members and history from the Depot. It can't be undone.
        Type the project name to confirm.
      </p>
      <div className="project-danger__row">
        <input
          className="project-danger__input"
          placeholder={project.name}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button className="project-detail-page__delete" disabled={!matches} onClick={onDelete}>
          Delete project
        </button>
      </div>
    </section>
  )
}

/** The project's external jumpstation — Teams channel, SharePoint, Azure DevOps, documents. Just
 * links (stored pointers, never a live integration): the Depot doesn't mirror what's behind them.
 * The project's own links come first, then its portfolio's shared links (read-only here, edited
 * once on the Admin page) — a link the project also lists itself isn't repeated. */
function JumpStation({ project, onSetUp }: { project: ProjectDetail; onSetUp: () => void }) {
  const own = (project.channels ?? []).filter((c) => c.url)
  const ownUrls = new Set(own.map((c) => c.url))
  const shared = (project.portfolio_links ?? []).filter((c) => c.url && !ownUrls.has(c.url))
  return (
    <section className="depot-section">
      <h2 className="depot-section__title">Project links</h2>
      {own.length === 0 && shared.length === 0 ? (
        <p className="depot-section__body">
          No links yet.{' '}
          <button className="jump-empty" onClick={onSetUp}>
            Add the Teams channel, SharePoint or Azure DevOps in Admin
          </button>
        </p>
      ) : (
        <>
          {own.length > 0 && <LinkList links={own} />}
          {shared.length > 0 && (
            <>
              <h3 className="jump-group">From {project.portfolio_name ?? 'portfolio'}</h3>
              <LinkList links={shared} />
            </>
          )}
        </>
      )}
    </section>
  )
}

/** Admin editor for the project's own links. Portfolio-shared links are listed as a note with a
 * pointer to where they're managed, so nobody re-enters them here. */
function ProjectLinks({ project }: { project: ProjectDetail }) {
  const updateProject = useUpdateProject(project.id)
  const sharedCount = (project.portfolio_links ?? []).filter((c) => c.url).length
  return (
    <section className="depot-section">
      <h2 className="depot-section__title">Project links</h2>
      <p className="depot-section__subtitle">
        The jumpstation on the Overview — the project's Teams channel, SharePoint, Azure DevOps and
        key documents. Paste a link and its type is detected.
      </p>
      {sharedCount > 0 && (
        <p className="link-shared-note">
          {sharedCount} shared link{sharedCount === 1 ? '' : 's'} from {project.portfolio_name}{' '}
          {sharedCount === 1 ? 'also appears' : 'also appear'} on the Overview — manage them under <Link to="/admin">Admin → Portfolios</Link>.
        </p>
      )}
      <LinksEditor
        initial={project.channels ?? []}
        pending={updateProject.isPending}
        onSave={(links, done) => updateProject.mutate({ channels: links }, { onSuccess: done })}
      />
    </section>
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

function ConnectedApps({ project, manage = false }: { project: ProjectDetail; manage?: boolean }) {
  const { persona } = usePersona()
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
        <h2 className="depot-section__title title-with-info">
          Applications
          <InfoPopover label="About connected applications">
            <p className="info-pop__intro">
              {manage
                ? 'Connect or remove the tools this project has a record in.'
                : "The tools this project has a record in. Each is a stored pointer — click through to open the app, it's never a live connection."}
            </p>
          </InfoPopover>
        </h2>
        {manage && !adding && connectable.length > 0 && (
          <button onClick={() => setAdding(true)}>+ Connect an application</button>
        )}
      </div>

      {links.length === 0 && !adding && (
        <p className="depot-section__body">Nothing connected yet.</p>
      )}

      <div className="connected-apps">
        {links.map((l) => (
          <AppLinkCard
            key={l.id}
            link={l}
            projectId={project.id}
            manage={manage}
            personId={persona?.id}
            onRemove={() => deleteLink.mutate(l.id)}
          />
        ))}
      </div>

      {manage && adding && (
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

/** One connected app on the project page. Outside Admin the whole tile is the link (no separate
 * "Open" text) and carries the app's live status for *this project* — the same summary contract
 * the personal Launchpad renders: the app decides headline, label and status, the Depot never
 * interprets them. An app that publishes nothing just shows its stored ref/notes. In Admin it's
 * a plain manage card with Remove. */
const STATUS_TEXT: Record<string, string> = {
  ok: '✓ On track',
  warn: '▲ Needs attention',
  critical: '● Critical',
}

function AppLinkCard({
  link: l,
  projectId,
  manage,
  personId,
  onRemove,
}: {
  link: ProjectDetail['app_links'][number]
  projectId: string
  manage: boolean
  personId: string | undefined
  onRemove: () => void
}) {
  const { data: summary } = useApplicationSummary(l.application_id, projectId, !manage)
  const live = !manage && !!summary?.headline
  const status = live ? summary?.status ?? 'neutral' : null
  // Once an app reports for this project, its own link (a specific plan, board or case list) beats
  // the generic address stored when it was connected — a project should land on ITS plan, not the app's home.
  const href = live && summary?.href ? summary.href : (l.link_url ?? summary?.href ?? null)
  const clickable = !manage && !!href
  const className = `app-link-card${status ? ` app-link-card--${status}` : ''}${clickable ? ' app-link-card--link' : ''}`

  const body = (
    <>
      <div className="app-link-card__top">
        <span className="app-link-card__name">{l.application_name}</span>
        <span className="app-link-card__badges">
          {status && status !== 'neutral' && (
            <span className={`app-link-card__status app-link-card__status--${status}`}>{STATUS_TEXT[status]}</span>
          )}
          {manage && <span className="app-link-card__phase">{PHASE_LABEL[l.phase]}</span>}
        </span>
      </div>
      {!manage && <AppSummaryTile applicationId={l.application_id} projectId={projectId} />}
      {l.external_ref && <div className="app-link-card__ref">{l.external_ref}</div>}
      {l.notes && <div className="app-link-card__notes">{l.notes}</div>}
      {!manage && !href && <span className="app-link-card__nolink">no reachable URL</span>}
      {manage && (
        <div className="app-link-card__actions">
          <span />
          <button className="app-link-card__remove" onClick={onRemove}>
            Remove
          </button>
        </div>
      )}
    </>
  )

  return clickable ? (
    <a className={className} href={withDepotOrigin(href!, `/projects/${projectId}`, personId)} target="_self">
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  )
}

/** Real people on this project — not free-text like "Team & channels" below it. Add/remove and
 * the "can manage members" toggle are only shown to the active persona if they're allowed to
 * use them: admin, or already `can_manage_members` on *this* project. That's a soft,
 * "signposting, not enforcement" gate — same as every other admin-only affordance in this app
 * (there's no real auth anywhere) — not a permission system. See ProjectMembership's backend
 * docstring for why this one flag exists at all when nothing else here is checked. */
function Members({ project, readOnly = false }: { project: ProjectDetail; readOnly?: boolean }) {
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
  const canEdit = !readOnly && (!!persona?.is_admin || !!activeMembership?.can_manage_members)

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
    <section className="depot-section" id="members">
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
  const [topology, setTopology] = useState<TeamTopology | ''>(project.team_topology ?? '')
  const [hasManufacturing, setHasManufacturing] = useState<'' | 'yes' | 'no'>(
    project.has_manufacturing === true ? 'yes' : project.has_manufacturing === false ? 'no' : '',
  )
  const [dirty, setDirty] = useState(false)

  function save() {
    updateProject.mutate(
      {
        team_topology: topology || null,
        has_manufacturing: hasManufacturing === '' ? null : hasManufacturing === 'yes',
      },
      { onSuccess: () => setDirty(false) },
    )
  }

  return (
    <section className="depot-section">
      <div className="depot-section__header-row">
        <h2 className="depot-section__title">Project attributes</h2>
        {dirty && (
          <button onClick={save} disabled={updateProject.isPending}>
            {updateProject.isPending ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>
      <p className="depot-section__subtitle">
        How this project is shaped — other apps read these (MARTI uses the manufacturing flag).
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
    source_label: null, // a manual note needs no label — the author shows on the right
  }))
  const rows = [...appRows, ...noteRows]
  rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const anyLoading = results.some((r) => r.isLoading) || notesLoading

  return (
    <section className="depot-section">
      <h2 className="depot-section__title title-with-info">
        Journal
        <InfoPopover label="What the Journal is">
          <p className="info-pop__intro">
            Merged from every connected app's own journal, plus notes logged here directly (from the
            📝 Journal panel) — how this project actually got here, not just where it is now.
          </p>
        </InfoPopover>
      </h2>

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

import { useQueries } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  fetchApplicationJournal,
  fetchProjectNotes,
  journalQueryKey,
  notesQueryKey,
  useAddProjectNote,
} from '../api/hooks'
import { usePersona } from '../lib/persona'
import JournalFeed, { type TaggedJournalEntry } from './JournalFeed'
import '../pages/depot-shared.css'
import './JournalPanel.css'

interface JournalPanelProps {
  onCollapse: () => void
  /** The project the current route is scoped to, if any (DepotLayout reads this the same way
   * it already does for Chat) — the composer defaults to writing about *this* project instead
   * of making someone pick it out of a list every time they're already looking at it. */
  projectId?: string
}

/** The Launchpad's old "Recent Activity" section, promoted to the same collapsible-side-panel
 * chrome as DepotChatPanel — and, since then, the second half of the original Launchpad brief's
 * deferred "Journal drawer" idea: a Depot-native, manually-authored note (models.JournalNote),
 * typed here and merged into the exact same federated feed as every connected app's own journal
 * entries. Same shape either way ({id, timestamp, author, summary, href}) so JournalFeed never
 * needs to know which kind of entry it's rendering.
 *
 * Two data sources, fetched in parallel per project: each connected app's own /journal (as
 * before) and this project's own /notes. `useQueries` for both, same reason the per-project
 * Journal section on ProjectDetailPage uses it — the pair/project count is dynamic. */
export default function JournalPanel({ onCollapse, projectId }: JournalPanelProps) {
  const { persona } = usePersona()
  const projects = persona?.projects ?? []

  const pairs = projects.flatMap((p) =>
    p.application_ids.map((applicationId) => ({ projectId: p.id, projectName: p.name, applicationId })),
  )

  const appResults = useQueries({
    queries: pairs.map((pair) => ({
      queryKey: journalQueryKey(pair.applicationId, pair.projectId),
      queryFn: () => fetchApplicationJournal(pair.applicationId, pair.projectId),
      staleTime: 30_000,
      retry: false,
    })),
  })

  const noteResults = useQueries({
    queries: projects.map((p) => ({
      queryKey: notesQueryKey(p.id),
      queryFn: () => fetchProjectNotes(p.id),
      staleTime: 10_000,
      retry: false,
    })),
  })

  const appRows: TaggedJournalEntry[] = pairs.flatMap((pair, i) => {
    const entries = appResults[i]?.data?.entries ?? []
    return entries.map((e) => ({ ...e, source_label: pair.projectName }))
  })
  const noteRows: TaggedJournalEntry[] = projects.flatMap((p, i) => {
    const entries = noteResults[i]?.data?.entries ?? []
    return entries.map((e) => ({ ...e, source_label: p.name }))
  })
  const rows = [...appRows, ...noteRows]
  rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const recent = rows.slice(0, 20)
  const anyLoading = appResults.some((r) => r.isLoading) || noteResults.some((r) => r.isLoading)

  return (
    <aside className="journal-panel">
      <div className="journal-panel__header">
        <h3 className="journal-panel__title">📝 Journal</h3>
        <button className="journal-panel__collapse" onClick={onCollapse} title="Collapse journal">
          »
        </button>
      </div>

      <NoteComposer projects={projects} routeProjectId={projectId} />

      <div className="journal-panel__body">
        {pairs.length === 0 && projects.length === 0 ? (
          <p className="journal-panel__empty">
            {persona ? "You're not on any projects yet." : 'Loading…'}
          </p>
        ) : recent.length === 0 ? (
          <p className="journal-panel__empty">{anyLoading ? 'Loading…' : 'Nothing here yet.'}</p>
        ) : (
          <JournalFeed entries={recent} />
        )}
      </div>
    </aside>
  )
}

/** The manual-entry half — write a note about one of your own projects. Defaults to whichever
 * project the current page is already scoped to (if any); otherwise a plain picker, since the
 * panel itself isn't tied to one project. */
function NoteComposer({
  projects,
  routeProjectId,
}: {
  projects: { id: string; name: string }[]
  routeProjectId: string | undefined
}) {
  const { persona } = usePersona()
  const [selectedId, setSelectedId] = useState(routeProjectId ?? '')
  const [text, setText] = useState('')
  const addNote = useAddProjectNote()

  // The route's own project (if any) wins whenever it's the reason the panel is open in the
  // first place — e.g. navigating from the Launchpad into a specific project while the panel
  // stays open. A manual pick elsewhere in the dropdown isn't overridden mid-typing since this
  // only fires when routeProjectId itself changes.
  useEffect(() => {
    if (routeProjectId) setSelectedId(routeProjectId)
  }, [routeProjectId])

  if (projects.length === 0) return null

  function submit() {
    const body = text.trim()
    if (!body || !selectedId) return
    addNote.mutate(
      { projectId: selectedId, person_id: persona?.id, body },
      { onSuccess: () => setText('') },
    )
  }

  return (
    <div className="journal-panel__composer">
      <select
        className="journal-panel__composer-project"
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
      >
        <option value="" disabled>
          About which project?
        </option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <textarea
        className="journal-panel__composer-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder="Log a note — a decision, a call, why something changed…"
        rows={2}
      />
      <button
        className="depot-btn depot-btn--primary journal-panel__composer-submit"
        onClick={submit}
        disabled={!text.trim() || !selectedId || addNote.isPending}
      >
        Add entry
      </button>
    </div>
  )
}

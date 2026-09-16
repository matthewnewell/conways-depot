import { useQueries } from '@tanstack/react-query'
import { fetchApplicationJournal, journalQueryKey } from '../api/hooks'
import { usePersona } from '../lib/persona'
import JournalFeed, { type TaggedJournalEntry } from './JournalFeed'
import './JournalPanel.css'

interface JournalPanelProps {
  onCollapse: () => void
}

/** The Launchpad's old "Recent Activity" section, promoted to the same collapsible-side-panel
 * chrome as DepotChatPanel — same federated read-aggregation (see JournalFeed's own doc
 * comment), just no longer a static block at the bottom of one page. User's own framing, having
 * seen it buried under a full Pinned Apps grid: "wasnt there suppoed to be a journal? where did
 * that go? ... i was thinking it would collapse/expand like ai chat." Unlike Chat, this one
 * isn't scoped by projectId — it's always "every app on every project this persona is on,"
 * the same shape everywhere, so it lives in DepotLayout (every page) rather than needing a
 * `key` remount on navigation. A project's own single-project Journal section stays exactly
 * where it was — this is the cross-project counterpart, not a replacement for it. */
export default function JournalPanel({ onCollapse }: JournalPanelProps) {
  const { persona } = usePersona()
  const projects = persona?.projects ?? []

  const pairs = projects.flatMap((p) =>
    p.application_ids.map((applicationId) => ({ projectId: p.id, projectName: p.name, applicationId })),
  )

  const results = useQueries({
    queries: pairs.map((pair) => ({
      queryKey: journalQueryKey(pair.applicationId, pair.projectId),
      queryFn: () => fetchApplicationJournal(pair.applicationId, pair.projectId),
      staleTime: 30_000,
      retry: false,
    })),
  })

  const rows: TaggedJournalEntry[] = pairs.flatMap((pair, i) => {
    const entries = results[i]?.data?.entries ?? []
    return entries.map((e) => ({ ...e, source_label: pair.projectName }))
  })
  rows.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const recent = rows.slice(0, 20)
  const anyLoading = results.some((r) => r.isLoading)

  return (
    <aside className="journal-panel">
      <div className="journal-panel__header">
        <h3 className="journal-panel__title">📝 Recent activity</h3>
        <button className="journal-panel__collapse" onClick={onCollapse} title="Collapse journal">
          «
        </button>
      </div>
      <p className="journal-panel__hint">across every app on your projects</p>

      <div className="journal-panel__body">
        {pairs.length === 0 ? (
          <p className="journal-panel__empty">
            {persona ? "You're not connected to any apps on any project yet." : 'Loading…'}
          </p>
        ) : recent.length === 0 ? (
          <p className="journal-panel__empty">
            {anyLoading ? 'Loading…' : 'Nothing logged yet from any connected app.'}
          </p>
        ) : (
          <JournalFeed entries={recent} />
        )}
      </div>
    </aside>
  )
}

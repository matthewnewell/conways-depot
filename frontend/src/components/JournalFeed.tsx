import type { JournalEntry } from '../api/types'
import { OUTBOUND_TARGET } from '../lib/embed'
import './JournalFeed.css'

/** One merged, federated journal entry with a caller-supplied label for where it came from —
 * a project name (the Launchpad's cross-project feed) or an app name (a project's own feed,
 * which already knows the project, so it labels by app instead). Shared rendering, different
 * source of truth for what "source" means at each call site. */
export interface TaggedJournalEntry extends JournalEntry {
  source_label: string | null
}

/** Renders a merged, read-only feed from the Launchpad's cross-app journal contract — see
 * backend routes/applications.py's journal proxy and each sibling app's own /api/journal.
 * Every `summary` line is pre-rendered by the app it came from; this never parses one back
 * apart, just displays it. Used both on a project's own Journal section (tagged by app) and
 * the Launchpad's Recent Activity (tagged by project). */
export default function JournalFeed({ entries }: { entries: TaggedJournalEntry[] }) {
  return (
    <div className="journal-feed">
      {entries.map((e) => (
        <div key={`${e.source_label}-${e.id}`} className="journal-entry">
          <div className="journal-entry__meta">
            {e.source_label && <span className="journal-entry__source">{e.source_label}</span>}
            <span className="journal-entry__time">
              {new Date(e.timestamp).toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
            {e.author && <span className="journal-entry__author">{e.author}</span>}
          </div>
          {e.href ? (
            <a className="journal-entry__summary" href={e.href} target={OUTBOUND_TARGET} rel="noreferrer">
              {e.summary}
            </a>
          ) : (
            <p className="journal-entry__summary">{e.summary}</p>
          )}
        </div>
      ))}
    </div>
  )
}

import { useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { useHealth } from '../api/hooks'
import DepotChatPanel from '../components/DepotChatPanel'
import DepotNav from '../components/DepotNav'
import JournalPanel from '../components/JournalPanel'
import './DepotLayout.css'

const CHAT_OPEN_STORAGE_KEY = 'conways-depot:chat-open'
const JOURNAL_OPEN_STORAGE_KEY = 'conways-depot:journal-open'

// Plain useState wouldn't survive a trip through the splash page — it lives outside this
// layout (no persistent chat there by design, see below), so navigating there and back
// unmounts DepotLayout entirely and would silently reset the toggle. localStorage survives
// that, plus a full page reload, which "remembers where it is" really implies.
function readStored(key: string): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(key) === 'true'
}

/** Shared parent for every operational route (project list, project detail, application
 * registry) — keeps the chat panel mounted across navigation, same pattern as Value Stream's
 * MapLayout. The splash page (what this is and why) deliberately sits OUTSIDE the chat-enabled
 * part of this layout (same as Value Stream's Guide page — a one-time explainer doesn't need a
 * persistent chat pane), but it renders the same DepotNav directly, so navigation is
 * consistent everywhere.
 *
 * Journal sits on the opposite edge from Chat, same tab-then-panel shape, both independently
 * collapsible — used to be a static "Recent Activity" section at the bottom of the Launchpad
 * only, easy to miss under a full Pinned Apps grid; promoted here so it's reachable from every
 * page, not just found by scrolling one of them. */
export default function DepotLayout() {
  const { projectId } = useParams<{ projectId?: string }>()
  const { data: health } = useHealth()
  // Collapsed by default — an operator opts into the assistant, it doesn't default to taking
  // a third of the screen.
  const [chatOpen, setChatOpen] = useState(() => readStored(CHAT_OPEN_STORAGE_KEY))
  const [journalOpen, setJournalOpen] = useState(() => readStored(JOURNAL_OPEN_STORAGE_KEY))

  function updateChatOpen(open: boolean) {
    setChatOpen(open)
    window.localStorage.setItem(CHAT_OPEN_STORAGE_KEY, String(open))
  }

  function updateJournalOpen(open: boolean) {
    setJournalOpen(open)
    window.localStorage.setItem(JOURNAL_OPEN_STORAGE_KEY, String(open))
  }

  return (
    <div className="depot-layout">
      <DepotNav />
      <div className="depot-layout__row">
        {journalOpen ? (
          <JournalPanel onCollapse={() => updateJournalOpen(false)} />
        ) : (
          <button
            className="depot-layout__journal-tab"
            onClick={() => updateJournalOpen(true)}
            title="Open journal"
          >
            📓 Journal
          </button>
        )}

        <div className="depot-layout__main">
          <Outlet />
        </div>

        {chatOpen ? (
          <DepotChatPanel
            // Remount (fresh conversation) on a real context switch — moving between the
            // portfolio view and a specific project's view, not just re-rendering.
            key={projectId ?? 'portfolio'}
            projectId={projectId}
            aiConfigured={health?.ai_configured ?? false}
            onCollapse={() => updateChatOpen(false)}
          />
        ) : (
          <button
            className="depot-layout__chat-tab"
            onClick={() => updateChatOpen(true)}
            title="Open chat"
          >
            ✨ Chat
          </button>
        )}
      </div>
    </div>
  )
}

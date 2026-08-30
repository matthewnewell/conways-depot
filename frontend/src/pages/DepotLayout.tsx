import { useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { useHealth } from '../api/hooks'
import DepotChatPanel from '../components/DepotChatPanel'
import './DepotLayout.css'

/** Shared parent for every operational route (project list, project detail, application
 * registry) — keeps the chat panel mounted across navigation, same pattern as Value Stream's
 * MapLayout. The Theory of Operation page deliberately sits OUTSIDE this layout, same as
 * Value Stream's Guide page: a one-time explainer doesn't need a persistent chat pane. */
export default function DepotLayout() {
  const { projectId } = useParams<{ projectId?: string }>()
  const { data: health } = useHealth()
  const [chatOpen, setChatOpen] = useState(true)

  return (
    <div className="depot-layout">
      <div className="depot-layout__row">
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
            onCollapse={() => setChatOpen(false)}
          />
        ) : (
          <button
            className="depot-layout__chat-tab"
            onClick={() => setChatOpen(true)}
            title="Open chat"
          >
            ✨ Chat
          </button>
        )}
      </div>
    </div>
  )
}

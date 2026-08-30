import { useRef, useState } from 'react'
import { useDepotChat } from '../api/hooks'
import type { ChatMessage } from '../api/types'
import './DepotChatPanel.css'

interface DepotChatPanelProps {
  /** Scopes the assistant's context server-side. Undefined = portfolio-wide (all projects,
   * capability gaps, team-load signals); a project id = that project's own registry entries. */
  projectId?: string
  aiConfigured: boolean
  onCollapse: () => void
}

const PORTFOLIO_PROMPTS = [
  'Which capabilities have no built application yet?',
  'Is any team carrying too much of the registry?',
  'What should get built next?',
]

const PROJECT_PROMPTS = [
  "What's missing from this project's registered apps?",
  'What phase is this project in, and what should be linked by now?',
]

/** Ported from Value Stream's MapChatPanel — same shape (stateless backend, plain React-state
 * history, collapsible pane) so the pattern is recognizable across sibling apps. Conversation
 * resets whenever `projectId` changes (moving between the portfolio view and a project's own
 * view is a real context switch, not a continuation of the same thread). */
export default function DepotChatPanel({ projectId, aiConfigured, onCollapse }: DepotChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const chat = useDepotChat()
  const listRef = useRef<HTMLDivElement>(null)
  const starters = projectId ? PROJECT_PROMPTS : PORTFOLIO_PROMPTS

  function scrollToBottom() {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || chat.isPending) return

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(nextMessages)
    setInput('')
    setError(null)
    scrollToBottom()

    chat.mutate(
      { messages: nextMessages, projectId },
      {
        onSuccess: (result) => {
          if (result.error) {
            setError(result.error)
            return
          }
          setMessages((m) => [...m, { role: 'assistant', content: result.reply }])
          scrollToBottom()
        },
        onError: (err) => setError(err instanceof Error ? err.message : 'Something went wrong'),
      },
    )
  }

  const title = projectId ? '✨ Ask about this project' : '✨ Ask about the registry'

  if (!aiConfigured) {
    return (
      <aside className="chat-panel chat-panel--empty">
        <div className="chat-panel__header">
          <h3 className="chat-panel__title">{title}</h3>
          <button className="chat-panel__collapse" onClick={onCollapse} title="Collapse chat">
            »
          </button>
        </div>
        <div className="chat-panel__not-configured">
          AI is not configured for this instance. Set <code>AI_PROVIDER</code> to{' '}
          <code>claude</code>, <code>gemini</code>, or <code>ollama</code> to talk through
          capability gaps and Conway signals. Everything else — the registry itself — works
          fully without it.
        </div>
      </aside>
    )
  }

  return (
    <aside className="chat-panel">
      <div className="chat-panel__header">
        <h3 className="chat-panel__title">{title}</h3>
        <button className="chat-panel__collapse" onClick={onCollapse} title="Collapse chat">
          »
        </button>
      </div>

      <div className="chat-panel__messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="chat-panel__intro">
            <p>
              Ask about capability coverage, which team owns too much surface area, or what
              this {projectId ? 'project' : 'portfolio'} is missing.
            </p>
            <div className="chat-panel__starters">
              {starters.map((p) => (
                <button key={p} className="chat-panel__starter" onClick={() => send(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`chat-panel__msg chat-panel__msg--${m.role}`}>
            {m.content}
          </div>
        ))}

        {chat.isPending && (
          <div className="chat-panel__msg chat-panel__msg--assistant chat-panel__msg--pending">
            thinking…
          </div>
        )}

        {error && <div className="chat-panel__error">{error}</div>}
      </div>

      <form
        className="chat-panel__input-row"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <textarea
          className="chat-panel__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
          placeholder="Ask a question…"
          rows={2}
        />
        <button
          type="submit"
          className="chat-panel__send"
          disabled={!input.trim() || chat.isPending}
        >
          Send
        </button>
      </form>
    </aside>
  )
}

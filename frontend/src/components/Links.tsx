import { useState } from 'react'
import type { ChannelLink } from '../api/types'
import { LINK_KINDS, LINK_KIND_INFO, detectKind, linkKind, normalizeUrl } from '../lib/links'
import './Links.css'

/** Read view of a list of jumpstation links — icon, label, kind, opens in a new tab. */
export function LinkList({ links }: { links: ChannelLink[] }) {
  return (
    <div className="jump-list">
      {links.map((l, i) => {
        const info = LINK_KIND_INFO[linkKind(l)]
        return (
          <a key={i} className="jump-link" href={l.url} target="_blank" rel="noopener noreferrer">
            <span className="jump-link__icon" aria-hidden="true">
              {info.icon}
            </span>
            <span className="jump-link__text">
              <span className="jump-link__label">{l.label || info.label}</span>
              {l.label && <span className="jump-link__kind">{info.label}</span>}
            </span>
            <span className="jump-link__arrow" aria-hidden="true">
              ↗
            </span>
          </a>
        )
      })}
    </div>
  )
}

/** Editor for a list of links, shared by a project's Admin tab and the portfolio editor. Paste a
 * URL and its kind is detected (override with the dropdown); reorder with the arrows. Saving
 * writes the whole list; callers key this component on something that changes after a save so
 * the local draft resets. */
export function LinksEditor({
  initial,
  pending,
  onSave,
}: {
  initial: ChannelLink[]
  pending: boolean
  onSave: (links: ChannelLink[], done: () => void) => void
}) {
  const [rows, setRows] = useState<ChannelLink[]>(initial)
  const [dirty, setDirty] = useState(false)

  function change(next: ChannelLink[]) {
    setRows(next)
    setDirty(true)
  }
  function patch(i: number, p: Partial<ChannelLink>) {
    change(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)))
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[i], next[j]] = [next[j], next[i]]
    change(next)
  }
  function save() {
    const cleaned = rows
      .filter((r) => r.url.trim())
      .map((r) => {
        const url = normalizeUrl(r.url)
        return { label: r.label.trim(), url, kind: r.kind ?? detectKind(url) } as ChannelLink
      })
    onSave(cleaned, () => setDirty(false))
  }

  return (
    <div className="link-editor">
      {rows.map((r, i) => {
        const kind = r.kind ?? detectKind(r.url)
        return (
          <div key={i} className="link-editor__row">
            <span className="link-editor__icon" aria-hidden="true">
              {LINK_KIND_INFO[kind].icon}
            </span>
            <input
              className="link-editor__url"
              value={r.url}
              onChange={(e) => patch(i, { url: e.target.value })}
              placeholder="Paste a URL (https://…)"
            />
            <input
              className="link-editor__label"
              value={r.label}
              onChange={(e) => patch(i, { label: e.target.value })}
              placeholder={LINK_KIND_INFO[kind].label}
            />
            <select value={kind} onChange={(e) => patch(i, { kind: e.target.value as ChannelLink['kind'] })}>
              {LINK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {LINK_KIND_INFO[k].label}
                </option>
              ))}
            </select>
            <span className="link-editor__actions">
              <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" aria-label="Move up">
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
                title="Move down"
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                className="link-editor__remove"
                onClick={() => change(rows.filter((_, idx) => idx !== i))}
                title="Remove"
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          </div>
        )
      })}
      <button className="link-editor__add" onClick={() => change([...rows, { label: '', url: '' }])}>
        + Add link
      </button>
      {dirty && (
        <div className="link-editor__savebar">
          <button className="link-editor__save" onClick={save} disabled={pending}>
            {pending ? 'Saving…' : 'Save links'}
          </button>
        </div>
      )}
    </div>
  )
}

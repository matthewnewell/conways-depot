import { useEffect, useRef, useState, type ReactNode } from 'react'
import './InfoPopover.css'

/** A small "?" button that pops a panel of explanatory content — closes on outside-click or
 * Escape. Used for the Category legend and the Team Topologies key. */
export default function InfoPopover({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span className="info-pop" ref={ref}>
      <button
        type="button"
        className="info-pop__btn"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <div className="info-pop__panel" role="dialog" aria-label={label}>
          {children}
        </div>
      )}
    </span>
  )
}

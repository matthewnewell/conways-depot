import { useState } from 'react'
import { useMyCharges } from '../api/hooks'
import { usePersona } from '../lib/persona'
import './LaunchpadChargesPanel.css'

function shortDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="lp-charges__copy"
      title="Copy charge number"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* clipboard unavailable — the number is still on screen to copy by hand */
        }
      }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

/** Drawer tab on the Launchpad: what YOU are supposed to charge to, and what you actually
 * charged — a person's own answer, not a manager's (that's Staffing, in Labor Supply & Demand).
 * Real data, proxied through LSD (see backend routes/applications.py) — empty for most of the
 * six demo personas, since they're managers with no Assignment of their own; that's expected,
 * not broken, and the panel says so plainly instead of looking stuck. */
export default function LaunchpadChargesPanel() {
  const { persona } = usePersona()
  const { data, isLoading } = useMyCharges(persona?.id)

  if (!persona) return <p className="lp-charges__hint">Loading…</p>
  if (isLoading) return <p className="lp-charges__hint">Loading…</p>

  const assignments = data?.assignments ?? []
  const actuals = data?.actuals ?? []

  if (assignments.length === 0 && actuals.length === 0) {
    return (
      <p className="lp-charges__hint">
        {data?.person_name
          ? `${data.person_name} isn't named to a project position — nothing to charge to yet.`
          : "Couldn't find you on a project's labor plan yet."}
      </p>
    )
  }

  return (
    <div className="lp-charges">
      <section className="lp-charges__section">
        <h3 className="lp-charges__title">What to charge to</h3>
        {assignments.length === 0 ? (
          <p className="lp-charges__hint">Not named to a position right now.</p>
        ) : (
          <ul className="lp-charges__list">
            {assignments.map((a) => (
              <li className="lp-charges__row" key={a.id}>
                <div className="lp-charges__row-main">
                  <span className="lp-charges__project">{a.project_name}</span>
                  <span className="lp-charges__position">{a.position_label}</span>
                  {(a.start_date || a.end_date) && (
                    <span className="lp-charges__dates">
                      {shortDate(a.start_date)}
                      {a.start_date || a.end_date ? ' – ' : ''}
                      {shortDate(a.end_date)}
                    </span>
                  )}
                </div>
                {a.charge_number ? (
                  <div className="lp-charges__charge">
                    <code>{a.charge_number}</code>
                    <CopyButton text={a.charge_number} />
                  </div>
                ) : (
                  <span className="lp-charges__no-charge">Not chargeable yet — pursuit, not awarded</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {actuals.length > 0 && (
        <section className="lp-charges__section">
          <h3 className="lp-charges__title">What you've actually charged</h3>
          <p className="lp-charges__hint">Most recent weeks, from the (mocked) S4 feed.</p>
          <ul className="lp-charges__list lp-charges__list--flat">
            {actuals.map((row) => (
              <li className="lp-charges__actual" key={row.id}>
                <span>{shortDate(row.period_start)}</span>
                <span>{row.project}</span>
                <code>{row.charge_number ?? '—'}</code>
                <strong>{row.hours}h</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApplications, useApplyPinPreset, usePinPresets, useUnpinApp } from '../api/hooks'
import { usePersona } from '../lib/persona'
import './LaunchpadCustomizePanel.css'

/** Drawer tab on the Launchpad: the once-in-a-while things that shape it. The pinned apps
 * themselves stay on the page (they are the Launchpad); this is where you start from a role's
 * preset, prune what's pinned, or go find more in the catalog.
 *
 * A preset replaces the whole pinned set (see useApplyPinPreset) — it is not a merge — so each
 * one asks first, with what it contains, instead of applying the moment it is picked. */
export default function LaunchpadCustomizePanel() {
  const { persona } = usePersona()
  const { data: presets } = usePinPresets()
  const { data: applications } = useApplications()
  const applyPreset = useApplyPinPreset()
  const unpin = useUnpinApp()
  // Which preset is awaiting confirmation, and which one was just applied.
  const [confirming, setConfirming] = useState<string | null>(null)
  const [applied, setApplied] = useState<string | null>(null)

  if (!persona) return <p className="lp-customize__hint">Loading…</p>

  const nameOf = (id: string) => applications?.find((a) => a.id === id)?.name ?? '…'
  const pinned = persona.pinned_application_ids

  function apply(key: string) {
    applyPreset.mutate(
      { person_id: persona!.id, preset: key },
      {
        onSuccess: () => {
          setConfirming(null)
          setApplied(key)
        },
      },
    )
  }

  return (
    <div className="lp-customize">
      <section className="lp-customize__section">
        <h3 className="lp-customize__title">Start from a role</h3>
        <p className="lp-customize__hint">
          Replaces your pinned apps with a starting set. You can still pin and unpin afterwards.
        </p>
        <ul className="lp-customize__list">
          {(presets ?? []).map((p) => (
            <li className="lp-customize__preset" key={p.key}>
              <div className="lp-customize__preset-head">
                <span className="lp-customize__preset-name">{p.label}</span>
                {confirming === p.key ? null : (
                  <button
                    type="button"
                    className="lp-customize__btn"
                    disabled={applyPreset.isPending}
                    onClick={() => {
                      setApplied(null)
                      setConfirming(p.key)
                    }}
                  >
                    {applied === p.key ? '✓ Applied' : 'Apply'}
                  </button>
                )}
              </div>
              <p className="lp-customize__preset-desc">{p.description}</p>
              {p.application_ids.length > 0 && (
                <p className="lp-customize__preset-apps">{p.application_ids.map(nameOf).join(' · ')}</p>
              )}
              {confirming === p.key && (
                <div className="lp-customize__confirm">
                  <span>
                    Replace your {pinned.length} pinned {pinned.length === 1 ? 'app' : 'apps'}?
                  </span>
                  <button
                    type="button"
                    className="lp-customize__btn lp-customize__btn--primary"
                    disabled={applyPreset.isPending}
                    onClick={() => apply(p.key)}
                  >
                    Replace
                  </button>
                  <button type="button" className="lp-customize__btn" onClick={() => setConfirming(null)}>
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="lp-customize__section">
        <h3 className="lp-customize__title">Pinned apps ({pinned.length})</h3>
        <p className="lp-customize__hint">Drag the cards on the Launchpad to reorder them.</p>
        {pinned.length === 0 ? (
          <p className="lp-customize__hint">Nothing pinned yet.</p>
        ) : (
          <ul className="lp-customize__list lp-customize__list--flat">
            {pinned.map((id) => (
              <li className="lp-customize__pinned" key={id}>
                <span>{nameOf(id)}</span>
                <button
                  type="button"
                  className="lp-customize__btn"
                  title={`Unpin ${nameOf(id)}`}
                  disabled={unpin.isPending}
                  onClick={() => unpin.mutate({ personId: persona.id, applicationId: id })}
                >
                  Unpin
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link className="lp-customize__catalog" to="/catalog">
        Browse the catalog →
      </Link>
    </div>
  )
}

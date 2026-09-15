import type { Application } from '../api/types'
import { usePinApp, useUnpinApp } from '../api/hooks'
import { usePersona } from '../lib/persona'
import './PinToggle.css'

/** The one pin control, reused on the Catalog's app cards, the app's own show page, and (read
 * via `persona.pinned_application_ids` directly, no button) the Launchpad. Three states, not
 * two — organizational apps are pinned by *default* (see backend models.HiddenOrgApp), so
 * there's a real difference between "not pinned, click to pin" (a project-scope app, nothing
 * chosen yet) and "not pinned, click to reset" (an organizational app someone explicitly
 * removed — clicking puts it back, it was never really "unpinned" in the choice sense).
 *
 *   pinned                              -> ★ "Unpin"
 *   not pinned, scope=project           -> ☆ "Pin"
 *   not pinned, scope=organizational    -> ↺ "Reset" (back to its default-on state)
 *
 * Same POST/DELETE /api/pins call either way — the backend decides which table it actually
 * touches based on the app's scope; this component never needs to know. */
export default function PinToggle({
  app,
  variant = 'icon',
}: {
  app: Pick<Application, 'id' | 'name' | 'scope'>
  variant?: 'icon' | 'button'
}) {
  const { persona } = usePersona()
  const pinApp = usePinApp()
  const unpinApp = useUnpinApp()

  if (!persona) return null

  const pinned = persona.pinned_application_ids.includes(app.id)
  const isReset = !pinned && app.scope === 'organizational'

  const glyph = pinned ? '★' : isReset ? '↺' : '☆'
  const label = pinned ? 'Unpin' : isReset ? 'Reset' : 'Pin'
  const title = pinned
    ? `Unpin ${app.name}`
    : isReset
      ? `Reset ${app.name} — add it back to your Launchpad`
      : `Pin ${app.name} to your Launchpad`

  const pending = pinApp.isPending || unpinApp.isPending

  function toggle() {
    if (pinned) unpinApp.mutate({ personId: persona!.id, applicationId: app.id })
    else pinApp.mutate({ person_id: persona!.id, application_id: app.id })
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        className={`pin-toggle pin-toggle--button ${pinned ? 'pin-toggle--active' : ''} ${isReset ? 'pin-toggle--reset' : ''}`}
        title={title}
        onClick={toggle}
        disabled={pending}
      >
        <span className="pin-toggle__glyph">{glyph}</span>
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`pin-toggle pin-toggle--icon ${pinned ? 'pin-toggle--active' : ''} ${isReset ? 'pin-toggle--reset' : ''}`}
      title={title}
      onClick={toggle}
      disabled={pending}
    >
      {glyph}
    </button>
  )
}

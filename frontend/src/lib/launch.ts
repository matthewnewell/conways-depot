/**
 * Every way into a sibling app from the Depot (Launchpad tile, Catalog card, a project's "Open"
 * link) goes through this so they behave identically: same tab, `person_id` handed over (an
 * identity-sharing app like Task Master picks it up instead of asking who you are again), plus
 * `from` (where in the Depot you launched from) and `depot` (the Depot's own origin) so the
 * shared "← Conway's Depot" back bar (@conways/drawer's DepotBackBar) can return you to
 * exactly where you came from. Apps that ignore these params are unaffected.
 */
export function withDepotOrigin(url: string, from: string, personId?: string): string {
  try {
    const u = new URL(url)
    if (personId && !u.searchParams.has('person_id')) u.searchParams.set('person_id', personId)
    u.searchParams.set('from', from)
    u.searchParams.set('depot', window.location.origin)
    return u.toString()
  } catch {
    return url
  }
}

/** Same tab, on purpose — the back bar is what gets you home, not a second browser tab. */
export function launchApp(url: string, from: string, personId?: string): void {
  window.location.assign(withDepotOrigin(url, from, personId))
}

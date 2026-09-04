/**
 * Whether the Depot is running inside the demo shell (an <iframe>) rather than standalone.
 * A plain same-vs-top window comparison — it never reads a cross-origin property.
 *
 * When embedded, the shell's black bar is the Depot's navigation, so the in-app <DepotNav>
 * hides itself and outbound "Open →" links stay in the frame (a new tab would escape the bar).
 * Standalone, <DepotNav> shows and outbound links open a new tab.
 */
export const IS_EMBEDDED: boolean = window.self !== window.top

export const OUTBOUND_TARGET: '_self' | '_blank' = IS_EMBEDDED ? '_self' : '_blank'

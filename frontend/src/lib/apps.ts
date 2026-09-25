import type { Application } from '../api/types'

/** The team that builds and runs the ecosystem's own apps. */
const CORE_TEAM = 'Matt (informal enabling team)'

/** The department that built an app, when it isn't the core team: the ecosystem takes in other
 * departments' apps too (Legal / Contracts' Contract & Legal Authoring, say), and the catalog says so. */
export function builtByOther(app: Pick<Application, 'owning_team'>): string | null {
  return app.owning_team && app.owning_team !== CORE_TEAM ? app.owning_team : null
}

/** Roles whose own apps aren't built yet. Their Launchpads are stubs: what already exists, plus
 * whatever other departments contribute. */
export const STUB_ROLE_TITLES = new Set(['Contracts Manager', 'Solutions Architect'])

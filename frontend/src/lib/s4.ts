import type { ExternalId } from '../api/types'

/** The system name the crosswalk uses for SAP S/4HANA. S4 is the system of record for a project's
 * id, labor charges and WBS elements, so its project id is treated as the project's headline
 * identifier; the Depot's own UUID is just an internal handle. Matched loosely so "S4", "SAP S4"
 * and "S/4HANA" (however someone typed it) all count. */
export const S4_SYSTEM = 'S4'

const S4_PATTERN = /^(sap\s*)?s\/?4(\s*hana)?$/i

export function isS4System(system: string): boolean {
  return S4_PATTERN.test(system.trim())
}

export function s4ExternalId(project: { external_ids: ExternalId[] }): ExternalId | undefined {
  return project.external_ids.find((e) => isS4System(e.system))
}

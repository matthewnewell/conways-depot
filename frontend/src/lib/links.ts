import type { ChannelLink } from '../api/types'

export type LinkKind = NonNullable<ChannelLink['kind']>

export const LINK_KINDS: LinkKind[] = ['teams', 'sharepoint', 'azure-devops', 'document', 'other']

export const LINK_KIND_INFO: Record<LinkKind, { label: string; icon: string }> = {
  teams: { label: 'Teams channel', icon: '💬' },
  sharepoint: { label: 'SharePoint', icon: '📁' },
  'azure-devops': { label: 'Azure DevOps', icon: '🛠️' },
  document: { label: 'Document', icon: '📄' },
  other: { label: 'Link', icon: '🔗' },
}

/** Best-guess kind from a URL's host, so an admin can just paste a link. Anything unrecognised is
 * "other" (and the admin can override the kind by hand). */
export function detectKind(url: string): LinkKind {
  let host = ''
  try {
    host = new URL(url.includes('://') ? url : `https://${url}`).hostname.toLowerCase()
  } catch {
    return 'other'
  }
  if (host === 'teams.microsoft.com' || host === 'teams.live.com') return 'teams'
  if (host === 'sharepoint.com' || host.endsWith('.sharepoint.com')) return 'sharepoint'
  if (host === 'dev.azure.com' || host.endsWith('.visualstudio.com')) return 'azure-devops'
  return 'other'
}

/** The link's kind: what was set explicitly, else detected from its URL (so links saved before
 * kinds existed still get the right icon). */
export function linkKind(link: ChannelLink): LinkKind {
  return link.kind ?? detectKind(link.url)
}

/** Add https:// to a bare pasted host so the link is clickable. */
export function normalizeUrl(url: string): string {
  const u = url.trim()
  return u && !/^[a-z][a-z0-9+.-]*:/i.test(u) ? `https://${u}` : u
}

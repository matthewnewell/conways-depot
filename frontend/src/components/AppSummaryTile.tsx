import { useApplicationSummary } from '../api/hooks'
import type { AppSummary } from '../api/types'
import './AppSummaryTile.css'

/** The Launchpad's app-summary contract, rendered — the Depot never interprets `headline`/
 * `label`, it just displays them and colors the tile by `status`. No headline (still loading,
 * no api_url wired up, the sibling app has nothing to say — "No summary published"/"No map
 * linked yet"/"No pursuit linked yet" are all equally uninformative) renders nothing at all,
 * not a muted placeholder line — a card with real data earns its second line, one without just
 * stays quiet rather than cluttering every tile with "nothing to see here" text. See backend
 * routes/applications.py's summary proxy for why an empty state is always the fallback, never
 * an error. */
export default function AppSummaryTile({
  applicationId,
  projectId,
  personId,
}: {
  applicationId: string
  projectId?: string
  /** Who's viewing, for apps whose summary is per person. Apps that don't care ignore it. */
  personId?: string
}) {
  const { data } = useApplicationSummary(applicationId, projectId, true, personId)
  const summary: AppSummary = data ?? { headline: null, label: null, status: null, href: null }

  if (!summary.headline) {
    return null
  }

  return (
    <p className={`app-summary-tile app-summary-tile--${summary.status ?? 'neutral'}`}>
      <span className="app-summary-tile__headline">{summary.headline}</span>
      <span className="app-summary-tile__label">{summary.label}</span>
    </p>
  )
}

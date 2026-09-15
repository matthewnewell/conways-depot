import { useApplicationSummary } from '../api/hooks'
import type { AppSummary } from '../api/types'
import './AppSummaryTile.css'

/** The Launchpad's app-summary contract, rendered — the Depot never interprets `headline`/
 * `label`, it just displays them and colors the tile by `status`. Renders "No summary
 * published" (a normal state) while loading and on any failure/absence, never an error message
 * — see backend routes/applications.py's summary proxy for why that's always the fallback. */
export default function AppSummaryTile({ applicationId, projectId }: { applicationId: string; projectId?: string }) {
  const { data, isLoading } = useApplicationSummary(applicationId, projectId)
  const summary: AppSummary = data ?? { headline: null, label: isLoading ? null : 'No summary published', status: null, href: null }

  if (!summary.headline && !summary.label) {
    return <p className="app-summary-tile app-summary-tile--empty">…</p>
  }

  if (!summary.headline) {
    return <p className="app-summary-tile app-summary-tile--empty">{summary.label}</p>
  }

  return (
    <p className={`app-summary-tile app-summary-tile--${summary.status ?? 'neutral'}`}>
      <span className="app-summary-tile__headline">{summary.headline}</span>
      <span className="app-summary-tile__label">{summary.label}</span>
    </p>
  )
}

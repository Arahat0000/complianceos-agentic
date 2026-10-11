import { useEffect, useState } from "react"
import { StatCard } from "@/components/stat-card"
import { useAuth } from "@/contexts/AuthContext"
import { fetchDashboardSummary } from "@/lib/dashboard"
import { buildDemoDashboardCounts } from "@/demo/complianceScenario"

/** Same badge colors as KnowledgeBase.tsx statusClass */
const statusClass = {
  verified: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  review: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  draft: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
}

// The four cards mirror the pipeline's first four hops (Regulations ->
// Obligations -> Controls -> Gaps); Remediation isn't a separate stat here —
// generating a plan is a quick action inside a gap's own detail view.
// Counts are derived from the shared demo scenario so they can't drift
// from what the Regulations/Obligations/Controls/Gaps pages themselves show.
const MOCK_COUNTS = buildDemoDashboardCounts()

export function SectionCards() {
  const { isDemo } = useAuth()
  const [counts, setCounts] = useState(isDemo ? MOCK_COUNTS : null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemo) return
    let cancelled = false
    fetchDashboardSummary()
      .then((summary) => {
        if (cancelled) return
        setCounts(summary)
        setLoadError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : "Failed to load dashboard stats.")
      })
    return () => {
      cancelled = true
    }
  }, [isDemo])

  if (!isDemo && loadError) {
    return (
      <div className="px-4 lg:px-6">
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 p-4 text-sm font-medium">
          Failed to load dashboard stats: {loadError}
        </div>
      </div>
    )
  }

  const c = counts

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <StatCard
        title="Regulations"
        value={c ? c.regulations : "—"}
        trendLabel={isDemo ? "Circulars in scope" : undefined}
        description="Regulatory source-of-truth documents"
        badgeClassName={statusClass.verified}
      />
      <StatCard
        title="Obligations"
        value={c ? c.obligations : "—"}
        trend={isDemo ? "up" : undefined}
        trendValue={c ? `${c.obligationsVerifiedPct}% verified` : undefined}
        trendLabel={isDemo ? "Extracted from circulars" : undefined}
        description="Atomic, citable requirements"
        badgeClassName={statusClass.verified}
      />
      <StatCard
        title="Controls"
        value={c ? c.controls : "—"}
        trendLabel={isDemo ? "Mapped to obligations" : undefined}
        description="Internal controls in scope"
        badgeClassName={statusClass.verified}
      />
      <StatCard
        title="Gaps"
        value={c ? c.openGaps : "—"}
        trend={isDemo ? "down" : undefined}
        trendValue={isDemo ? "-2 vs last sprint" : undefined}
        trendLabel={isDemo ? "Open or in remediation" : undefined}
        description="Feeding the Remediation queue"
        badgeClassName={statusClass.review}
      />
    </div>
  )
}

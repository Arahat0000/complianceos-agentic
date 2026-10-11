import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  trend?: "up" | "down"
  trendValue?: string | number
  trendLabel?: string
  description?: string
  className?: string
  icon?: React.ReactNode
  /** Match status badge colors (e.g. emerald, amber, slate, red). When set, overrides trend-based badge color. */
  badgeClassName?: string
}

/** Match KnowledgeBase statusClass: verified (emerald), review (amber), draft (slate) */
const defaultBadgeClass = (trend: "up" | "down" | undefined) =>
  trend === "up"
    ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
    : trend === "down"
      ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
      : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20"

export function StatCard({
  title,
  value,
  trend,
  trendValue,
  trendLabel,
  description,
  className,
  icon,
  badgeClassName,
}: StatCardProps) {
  return (
    <Card className={cn("@container/card", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
            <CardDescription>{title}</CardDescription>
            {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        {trendValue != null && trendValue !== "" && (
          <CardAction>
            <Badge variant="outline" className={cn("tabular-nums capitalize shrink-0", badgeClassName ?? defaultBadgeClass(trend))}>
              {trendValue}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      {(trendLabel || description) && (
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {trendLabel && (
            <div className="line-clamp-1 font-medium">
              {trendLabel}
            </div>
          )}
          {description && (
            <div className="text-muted-foreground">
              {description}
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  )
}

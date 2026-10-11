import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const getColors = (val?: number | null) => {
    if (val === null || val === undefined) return { track: "bg-primary/20", indicator: "bg-primary" };
    if (val >= 100) return { track: "bg-emerald-100 dark:bg-emerald-500/20", indicator: "bg-emerald-500 dark:bg-emerald-400" };
    if (val >= 70) return { track: "bg-blue-100 dark:bg-blue-500/20", indicator: "bg-blue-500 dark:bg-blue-400" };
    if (val >= 30) return { track: "bg-amber-100 dark:bg-amber-500/20", indicator: "bg-amber-500 dark:bg-amber-400" };
    return { track: "bg-rose-100 dark:bg-rose-500/20", indicator: "bg-rose-500 dark:bg-rose-400" };
  };

  const { track, indicator } = getColors(value);

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full",
        track,
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("h-full w-full flex-1 transition-all duration-500", indicator)}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }

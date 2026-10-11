import * as React from "react"
import { useNavigate } from "react-router-dom"
import type { AppColumnDef } from "@/lib/table-features"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Database,
  Eye,
  Table as TableIcon,
} from "lucide-react"
import {
  IconShieldFilled,
  IconSparkles,
  IconCircleFilled,
} from "@tabler/icons-react"

import { GenericDataTable } from "@/components/generic-data-table"

export interface ControlData {
  id: string
  title: string
  source: string
  relevance: string
  category: string
  description: string
  circularId?: string
  framework?: string
  status?: string
  questionText?: string
}

function ControlDetailDialog({ 
  item, 
  children 
}: { 
  item: ControlData; 
  children: React.ReactNode 
}) {
  const navigate = useNavigate()
  const isGap = item.status === "Compliance Gap" || item.id === "Q-RBI-09" || item.id === "Q-RBI-19" || item.id === "Q-RBI-29" || item.id === "ITG-Q-05"

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px] p-0 gap-0 overflow-hidden rounded-2xl border border-border/60 shadow-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", isGap ? "bg-amber-500/10 text-amber-600" : "bg-blue-500/10 text-blue-600")}>
                <IconShieldFilled className="h-4 w-4" />
              </div>
              <Badge variant="outline" className="font-mono text-[10px] bg-muted/50 border-muted-foreground/20">
                {item.id}
              </Badge>
              <Badge variant="outline" className="font-mono text-[10px] bg-primary/5 text-primary border-primary/20">
                {item.framework ?? "Regulatory Framework"}
              </Badge>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "h-5.5 px-2 text-[10px] font-medium border gap-1.5",
                isGap
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", isGap ? "bg-amber-500" : "bg-emerald-500")} />
              {isGap ? "Compliance Gap" : "Active Control"}
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">{item.title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Framework specifications and compliance monitoring from the active regulatory registry.
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          {item.questionText && item.questionText !== item.description && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Assessment Requirement</p>
              <div className="text-xs text-foreground/90 leading-relaxed bg-muted/30 p-3.5 rounded-xl border border-border/40 italic">
                "{item.questionText}"
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Type</p>
              <Badge
                variant="outline"
                className={cn(
                  "h-6 px-2.5 text-[11px] font-medium border bg-background/50 gap-1.5",
                  item.source.toLowerCase() === "ai"
                    ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                    : "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                )}
              >
                {item.source.toLowerCase() === "ai" ? (
                  <IconSparkles className="h-3 w-3" />
                ) : (
                  <IconShieldFilled className="h-3 w-3" />
                )}
                {item.source.toLowerCase() === "ai" ? "AI Indexed" : "Manual Record"}
              </Badge>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Priority</p>
              <Badge
                variant="outline"
                className={cn(
                  "h-6 px-2.5 text-[11px] font-medium border bg-background/50 gap-1.5",
                  item.relevance === "High"
                    ? "bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                    : "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                )}
              >
                <IconCircleFilled
                  className={cn(
                    "h-2 w-2",
                    item.relevance === "High" ? "text-red-500" : "text-blue-500"
                  )}
                />
                {item.relevance} Priority
              </Badge>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Category</p>
            <div className="flex items-center gap-2.5 text-sm font-medium text-foreground">
              <Database className="h-4 w-4 text-muted-foreground" />
              {item.category}
            </div>
          </div>

          <Separator className="bg-border/40" />

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Control Specifications</p>
            <p className="text-sm text-foreground/90 leading-relaxed bg-muted/20 p-4 rounded-xl border border-border/40">
              {item.description}
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <TableIcon className="h-3.5 w-3.5 text-blue-600" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Evidence & Audit Readiness</p>
            </div>
            {isGap ? (
              <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Compliance Gap: Evidence Missing</p>
                  <p className="opacity-90">No internal policy document or verified Q&A response is attached to satisfy this regulatory control requirement.</p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Evidence Linked & Verified</p>
                  <p className="opacity-90">Control backed by active policy documentation and periodic internal audit validation.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20 flex flex-row items-center justify-between gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="rounded-xl h-10 px-5 font-medium border-border/60 hover:bg-background cursor-pointer">
              Dismiss
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button 
              className="rounded-xl h-10 px-5 font-semibold shadow-sm gap-2 cursor-pointer"
              onClick={() => navigate(`/controls?parentId=${item.circularId || "211"}&subId=${item.id}`)}
            >
              <span>View in Control Library</span>
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ActionButtons({ item }: { item: ControlData }) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center justify-end gap-1">
      <ControlDetailDialog item={item}>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer" title="Inspect specifications">
          <Eye className="h-3.5 w-3.5" />
        </Button>
      </ControlDetailDialog>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-primary cursor-pointer"
        title="Open in Control Library"
        onClick={(e) => {
          e.stopPropagation()
          navigate(`/controls?parentId=${item.circularId || "211"}&subId=${item.id}`)
        }}
      >
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

const columns: AppColumnDef<ControlData>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => (
      <span className="font-mono text-xs font-semibold text-foreground/80">
        {row.original.id}
      </span>
    ),
  },
  {
    accessorKey: "title",
    header: "Control Title",
    cell: ({ row }) => {
      const isGap = row.original.status === "Compliance Gap" || row.original.id === "Q-RBI-09" || row.original.id === "Q-RBI-19" || row.original.id === "Q-RBI-29" || row.original.id === "ITG-Q-05"
      return (
        <div className="flex flex-col min-w-[14rem] max-w-[24rem] py-1">
          <ControlDetailDialog item={row.original}>
            <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors cursor-pointer flex items-center gap-2">
              <span>{row.original.title}</span>
              {isGap && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20 shrink-0">
                  Gap
                </span>
              )}
            </p>
          </ControlDetailDialog>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
            {row.original.description}
          </p>
        </div>
      )
    },
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => (
      <Badge variant="outline" className="text-[11px] font-medium bg-muted/30">
        {row.original.category}
      </Badge>
    ),
  },
  {
    accessorKey: "framework",
    header: "Framework",
    cell: ({ row }) => (
      <span className="font-mono text-[11px] text-muted-foreground">
        {row.original.framework ?? "Regulatory"}
      </span>
    ),
  },
  {
    accessorKey: "relevance",
    header: "Priority",
    cell: ({ row }) => {
      const isHigh = row.original.relevance === "High"
      return (
        <Badge
          variant="outline"
          className={cn(
            "h-5.5 px-2.5 text-[11px] font-medium border shrink-0 bg-background/50 gap-1.5",
            isHigh
              ? "bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
              : "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
          )}
        >
          <IconCircleFilled
            className={cn(
              "h-1.5 w-1.5",
              isHigh ? "text-red-500" : "text-blue-500"
            )}
          />
          {row.original.relevance}
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const isGap = row.original.status === "Compliance Gap" || row.original.id === "Q-RBI-09" || row.original.id === "Q-RBI-19" || row.original.id === "Q-RBI-29" || row.original.id === "ITG-Q-05"
      return (
        <Badge
          variant="outline"
          className={cn(
            "h-5.5 px-2 text-[11px] font-medium border shrink-0 gap-1.5",
            isGap
              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30"
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", isGap ? "bg-amber-500" : "bg-emerald-500")} />
          {isGap ? "Compliance Gap" : "Active"}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    header: () => <span className="text-right block w-full">Actions</span>,
    cell: ({ row }) => (
      <ActionButtons item={row.original} />
    ),
  },
]

export function DataTable({
  data,
}: {
  data: ControlData[]
}) {
  const [selectedTab, setSelectedTab] = React.useState<string>("all")

  const counts = React.useMemo(() => ({
    all: data.length,
    rbiNbfc: data.filter(d => (d.framework ?? "").includes("nbfc") || d.circularId === "211").length,
    rbiCb: data.filter(d => (d.framework ?? "").includes("/cb/") || d.circularId === "12562").length,
    sebi: data.filter(d => (d.framework ?? "").includes("SEBI") || (d.circularId ?? "").startsWith("sebi")).length,
    iso: data.filter(d => (d.framework ?? "").includes("ISO") || (d.circularId ?? "").includes("iso")).length,
    gaps: data.filter(d => d.status === "Compliance Gap" || d.id === "Q-RBI-09" || d.id === "Q-RBI-19" || d.id === "Q-RBI-29" || d.id === "ITG-Q-05").length,
  }), [data])

  const filteredData = React.useMemo(() => {
    switch (selectedTab) {
      case "rbiNbfc":
        return data.filter(d => (d.framework ?? "").includes("nbfc") || d.circularId === "211")
      case "rbiCb":
        return data.filter(d => (d.framework ?? "").includes("/cb/") || d.circularId === "12562")
      case "sebi":
        return data.filter(d => (d.framework ?? "").includes("SEBI") || (d.circularId ?? "").startsWith("sebi"))
      case "iso":
        return data.filter(d => (d.framework ?? "").includes("ISO") || (d.circularId ?? "").includes("iso"))
      case "gaps":
        return data.filter(d => d.status === "Compliance Gap" || d.id === "Q-RBI-09" || d.id === "Q-RBI-19" || d.id === "Q-RBI-29" || d.id === "ITG-Q-05")
      default:
        return data
    }
  }, [data, selectedTab])

  const tabs = [
    { value: "all", label: "All Controls", badge: counts.all, badgeClassName: "bg-blue-500/10 text-blue-600 font-semibold" },
    { value: "rbiNbfc", label: "RBI MD (NBFC)", badge: counts.rbiNbfc },
    { value: "rbiCb", label: "RBI MD (Banking)", badge: counts.rbiCb },
    { value: "sebi", label: "SEBI Master Circulars", badge: counts.sebi },
    { value: "iso", label: "ISO Standards", badge: counts.iso },
    { value: "gaps", label: "Compliance Gaps", badge: counts.gaps, badgeClassName: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold" },
  ]

  return (
    <div className="w-full px-4 lg:px-6">
      <div>
        <GenericDataTable<ControlData>
          columns={columns}
          data={filteredData}
          searchKey="title"
          searchPlaceholder="Search all controls by ID, title, category, description…"
          tabs={tabs}
          defaultTab="all"
          onTabChange={setSelectedTab}
        />
      </div>
    </div>
  )
}

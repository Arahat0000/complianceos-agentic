import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  MoreHorizontal,
  Calendar,
  Download,
  ExternalLink,
  Sparkles,
  ScrollText,
  Filter,
} from "lucide-react";
import { IconLoader, IconCircleCheck, IconClock } from "@tabler/icons-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { pageContainer, pageItem } from "@/lib/animations";
import { GenericDataTable } from "@/components/generic-data-table";
import { type RowSelectionState } from "@tanstack/react-table";
import type { AppColumnDef } from "@/lib/table-features";
import { useNavigate } from "react-router-dom";
import { DEMO_REGULATIONS_LIBRARY, type LibraryItem } from "@/data/regulationsLibrary";
import { AGENT_STAGES, type AgentScanStage } from "@/data/regulatoryDiscovery";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCirculars, type BackendCircular } from "@/lib/circulars";
import { fetchControls } from "@/lib/controls";
import { startDiscoveryRun, fetchDiscoveryRuns, fetchDiscoveryRun, adoptCircular } from "@/lib/discovery";

const allItems: LibraryItem[] = DEMO_REGULATIONS_LIBRARY;

const BODY_LABELS: Record<BackendCircular["regulator"], LibraryItem["body"]> = {
  RBI: "RBI",
  SEBI: "SEBI",
  CERT_IN: "Other",
  DPDP: "Other",
  OTHER: "Other",
};
const CATEGORY_LABELS: Record<BackendCircular["category"], LibraryItem["category"]> = {
  CYBERSECURITY: "Cybersecurity",
  COMPLIANCE: "Compliance",
  AUDIT: "Audit",
  REPORTING: "Reporting",
  OPERATIONS: "Operations",
};
const STATUS_LABELS: Record<BackendCircular["status"], LibraryItem["status"]> = {
  ACTIVE: "Active",
  SUPERSEDED: "Superseded",
  DRAFT: "Draft",
  PENDING_REVIEW: "Draft",
};

// Backend Circular.regulator/category/status are uppercase enums — map them
// to the UI's display labels, with the same fallbacks as before for any
// value the UI doesn't know.
function mapBackendCircular(c: BackendCircular): LibraryItem {
  const body = BODY_LABELS[c.regulator] ?? "Other";
  const category = CATEGORY_LABELS[c.category] ?? "Compliance";
  const status = STATUS_LABELS[c.status] ?? "Draft";
  return {
    id: c.id,
    circularId: c.circularId,
    name: c.name,
    body,
    category,
    dateOfIssue: c.dateOfIssue ?? "",
    status,
    tags: c.tags ?? [],
    link: c.link ?? undefined,
    // Patched to true once /controls confirms this circular has controls
    // extracted from it — real orgs have no static "indexed" flag.
    aiIndexComplete: false,
  };
}

const bodyColors: Record<LibraryItem["body"], string> = {
  RBI: "bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  SEBI: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  Other: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
};

const statusColors = {
  Active: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  Superseded: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  Draft: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
};

const Regulations = () => {
  const { isDemo } = useAuth();
  // Demo sessions keep the full curated mock library (RBI/SEBI reference
  // data); real sessions load only what's actually in the org's own
  // Circular table via GET /circulars.
  const [items, setItems] = useState<LibraryItem[]>(isDemo ? allItems : []);
  const [isLoading, setIsLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [filterIndexed, setFilterIndexed] = useState<string>("all");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stageIndex, setStageIndex] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<string>(isDemo ? "Today, 09:00 AM" : "Never");

  const [pendingReviewIds, setPendingReviewIds] = useState<Set<string>>(new Set());
  const [runStages, setRunStages] = useState<Partial<AgentScanStage>[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };
  useEffect(() => stopPolling, []);

  const stageList: AgentScanStage[] = AGENT_STAGES.map((d, i) => ({ ...d, ...(isDemo ? {} : runStages[i]) }));

  const fetchLibrary = useCallback(async () => {
    const [circulars, controls] = await Promise.all([fetchCirculars(), fetchControls().catch(() => [])]);
    const indexedCircularIds = new Set(controls.map((c) => c.circularId));
    return {
      pendingIds: new Set(circulars.filter((c) => c.status === "PENDING_REVIEW").map((c) => c.id)),
      rows: circulars.map((c) => ({ ...mapBackendCircular(c), aiIndexComplete: indexedCircularIds.has(c.id) })),
    };
  }, []);

  const applyLibrary = useCallback((lib: Awaited<ReturnType<typeof fetchLibrary>>) => {
    setPendingReviewIds(lib.pendingIds);
    setItems(lib.rows);
  }, []);

  const loadLibrary = useCallback(async () => {
    applyLibrary(await fetchLibrary());
  }, [fetchLibrary, applyLibrary]);

  const [lastFound, setLastFound] = useState<number | null>(null);

  const formatTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "Never");

  const handleScanNow = () => {
    if (isScanning) return;
    setIsScanning(true);
    setStageIndex(0);
    if (!isDemo) {
      setRunStages([]);
      startDiscoveryRun()
        .then((run) => {
          const poll = async () => {
            try {
              const r = await fetchDiscoveryRun(run.id);
              const st = (Array.isArray(r.stages) ? r.stages : []) as Partial<AgentScanStage>[];
              setRunStages(st);
              setStageIndex(Math.max(0, Math.min(st.length, AGENT_STAGES.length) - 1));
              if (r.status === "RUNNING") return;
              stopPolling();
              setIsScanning(false);
              setStageIndex(0);
              if (r.status === "COMPLETED") {
                setLastScanTime(formatTime(r.finishedAt ?? r.startedAt));
                setLastFound(r.circularsFound ?? 0);
                await loadLibrary().catch(() => undefined);
                toast({
                  title: "Regulatory Scan Complete",
                  description: `${r.circularsFound} new circular${r.circularsFound === 1 ? "" : "s"} found.`,
                });
              } else {
                toast({ title: "Regulatory scan failed", description: "The discovery run did not complete.", variant: "destructive" });
              }
            } catch {
              /* transient poll error: retry on next tick */
            }
          };
          pollRef.current = setInterval(poll, 1500);
        })
        .catch((err) => {
          setIsScanning(false);
          toast({
            title: "Could not start scan",
            description: err instanceof Error ? err.message : "Request failed",
            variant: "destructive",
          });
        });
      return;
    }
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < AGENT_STAGES.length) {
        setStageIndex(step);
      } else {
        clearInterval(interval);
        setIsScanning(false);
        setStageIndex(0);
        setLastScanTime("Just now");
        toast({
          title: "Autonomous Regulatory Scan Complete",
          description: `Scanned RBI & SEBI gazettes. ${scanIndexed} indexed regulations verified.`,
        });
      }
    }, 900);
  };

  const handleAdopt = async (id: string) => {
    try {
      await adoptCircular(id);
      await loadLibrary();
      toast({ title: "Circular adopted", description: "The circular is now active." });
    } catch (err) {
      toast({ title: "Adopt failed", description: err instanceof Error ? err.message : "Request failed", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (isDemo) return;
    fetchDiscoveryRuns()
      .then((runs) => {
        if (runs[0]) setLastScanTime(formatTime(runs[0].finishedAt ?? runs[0].startedAt));
      })
      .catch(() => undefined);
  }, [isDemo]);

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    fetchLibrary()
      .then(applyLibrary)
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load compliance library");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo, fetchLibrary, applyLibrary]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((i) => {
      const matchesSearch = !q || (
        i.name.toLowerCase().includes(q) ||
        i.circularId.toLowerCase().includes(q) ||
        i.body.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q)) ||
        (i.dateOfIssue && i.dateOfIssue.toLowerCase().includes(q))
      );

      if (!matchesSearch) return false;

      const matchesIndexed =
        filterIndexed === "all" ||
        (filterIndexed === "indexed" && i.aiIndexComplete) ||
        (filterIndexed === "pending" && !i.aiIndexComplete);

      if (!matchesIndexed) return false;

      if (activeTab === "all") return true;
      if (activeTab === "rbi" && i.body === "RBI") return true;
      if (activeTab === "sebi" && i.body === "SEBI") return true;

      return false;
    });
  }, [items, search, activeTab, filterIndexed]);

  const columns = useMemo<AppColumnDef<LibraryItem>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "index",
      header: "#",
      cell: ({ row }) => <span className="text-center font-mono text-[10px] text-muted-foreground/60">{row.index + 1}</span>,
    },
    {
      accessorKey: "circularId",
      header: "ID / Code",
      cell: ({ row }) => <span className="text-xs font-mono font-medium">{row.original.circularId}</span>,
    },
    {
      accessorKey: "name",
      header: "Title",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors max-w-[700px] line-clamp-2 whitespace-normal break-words leading-snug">
              {item.name}
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {item.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 bg-muted/50 text-muted-foreground border-none font-medium hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearch(tag);
                  }}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.category}</span>,
    },
    {
      accessorKey: "aiIndexComplete",
      header: "AI Indexed",
      cell: ({ row }) =>
        row.original.aiIndexComplete ? (
          <Badge
            variant="outline"
            className="gap-1 text-[11px] px-2 py-0.5 border font-medium bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
            title="Click to view extracted obligations"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/regulations/${row.original.id}?tab=obligations`);
            }}
          >
            <Sparkles className="h-3 w-3" />
            Complete
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-[11px] px-2 py-0.5 border font-medium bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
            <IconClock className="h-3 w-3" />
            Pending
          </Badge>
        ),
    },
    {
      accessorKey: "dateOfIssue",
      header: "Date of Issue",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {row.original.dateOfIssue || "—"}
        </div>
      ),
    },
    {
      accessorKey: "body",
      header: "Type",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={cn(
            "capitalize text-[11px] px-2 py-0.5 border font-medium",
            bodyColors[row.original.body],
          )}
        >
          {row.original.body}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={cn(
            "capitalize text-[11px] px-2 py-0.5 border font-medium",
            statusColors[row.original.status],
          )}
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl">
              <DropdownMenuItem onClick={() => navigate(`/regulations/${row.original.id}?tab=obligations`)}>
                <ScrollText className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                View Obligations
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => row.original.link && window.open(row.original.link, "_blank")} disabled={!row.original.link}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Original
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
              {!isDemo && pendingReviewIds.has(row.original.id) && (
                <DropdownMenuItem onClick={() => handleAdopt(row.original.id)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Adopt
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>Mark as Read</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate, isDemo, pendingReviewIds]);

  const totalItems = items.length;
  const scanIndexed = items.filter((i) => i.aiIndexComplete).length;
  const scanPending = isDemo ? 0 : pendingReviewIds.size;
  const foundText = !isDemo && lastFound != null ? ` · ${lastFound} new circular${lastFound === 1 ? "" : "s"} found` : "";
  const scanTitle =
    scanPending === 0
      ? `Scan Complete — All ${isDemo ? scanIndexed : totalItems} indexed regulations up to date${foundText}`
      : `Scan Complete — ${totalItems} indexed · ${scanPending} pending review${foundText}`;
  const indexedCount = items.filter((i) => i.aiIndexComplete).length;
  const pendingCount = items.filter((i) => !i.aiIndexComplete).length;
  const rbiCount = items.filter((i) => i.body === "RBI").length;
  const sebiCount = items.filter((i) => i.body === "SEBI").length;

  return (
    <motion.div
      variants={pageContainer}
      initial="hidden"
      animate="show"
      className="flex-1 overflow-auto p-4 md:p-6 space-y-6"
    >
      <motion.div variants={pageItem} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Regulations and Obligations</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Regulatory circulars, directions, and extracted compliance obligations from RBI and SEBI.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            size="default"
            className="h-10 px-5 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all active:scale-[0.98] w-full sm:w-auto"
            onClick={() => navigate("/regulations/upload")}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </motion.div>

      {loadError && (
        <motion.div
          variants={pageItem}
          className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Failed to load the compliance library: {loadError}
        </motion.div>
      )}

      {isLoading ? (
        <motion.div variants={pageItem} className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          Loading compliance library…
        </motion.div>
      ) : (
        <>
          <motion.div
            variants={pageItem}
            className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border bg-blue-50/70 text-blue-900 border-blue-200/80 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex items-center justify-center p-2.5 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                {isScanning ? (
                  <IconLoader className="h-5 w-5 animate-spin" />
                ) : (
                  <IconCircleCheck className="h-5 w-5" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-100/90 dark:bg-blue-500/25 text-blue-800 dark:text-blue-200 border border-blue-300/70 dark:border-blue-500/40">
                    {isScanning ? `tool: ${stageList[stageIndex].tool}` : (isDemo ? "schedule: every 24h" : "manual scan")}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground hidden sm:inline">
                    {isScanning ? stageList[stageIndex].args : `last checked: ${lastScanTime}`}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {isScanning ? `(${stageList[stageIndex].target})` : (isDemo ? "(rbi.org.in & sebi.gov.in)" : "")}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-blue-950 dark:text-blue-200">
                  {isScanning
                    ? stageList[stageIndex].title
                    : scanTitle}
                </h3>
                <p className="text-xs text-blue-800/80 dark:text-blue-300/80">
                  {isScanning
                    ? stageList[stageIndex].detail
                    : (isDemo ? "Crawled official gazettes across RBI and SEBI repositories. Next autonomous scan scheduled to run in 24 hours." : `Last scan: ${lastScanTime}. Run a scan to check for new circulars.`)}
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  {stageList.map((s, idx) => (
                    <button
                      key={s.tool}
                      type="button"
                      onClick={() => setStageIndex(idx)}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300 focus:outline-none",
                        idx === stageIndex
                          ? "w-6 bg-blue-600 dark:bg-blue-400"
                          : idx < stageIndex
                          ? "w-2.5 bg-blue-300 dark:bg-blue-600 hover:bg-blue-400"
                          : "w-2 bg-blue-200/70 dark:bg-blue-900/60 hover:bg-blue-300"
                      )}
                      title={`Stage ${idx + 1}: ${s.tool}`}
                    />
                  ))}
                  <span className="text-[10px] font-mono font-medium text-blue-700/80 dark:text-blue-300/80 ml-1.5">
                    {isScanning ? `Stage ${stageIndex + 1}/${stageList.length}` : (isDemo ? "4/4 Stages Verified · 24h Cadence" : `${totalItems} circulars loaded`)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
              <Badge
                variant="outline"
                className="w-fit shrink-0 bg-blue-100/70 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30 font-medium gap-1.5 py-1 px-2.5 text-xs"
              >
                {isScanning ? (
                  <>
                    <IconLoader className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                    Scanning Feeds…
                  </>
                ) : (
                  <>
                    <IconClock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    {isDemo ? "Checked Every 24h" : "On-demand scan"}
                  </>
                )}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleScanNow}
                disabled={isScanning}
                className="h-8 text-xs font-medium border-blue-200/80 hover:bg-blue-100/60 dark:border-blue-500/30 dark:hover:bg-blue-500/20 shadow-none"
              >
                <IconLoader className={cn("h-3.5 w-3.5 mr-1.5 animate-spin", !isScanning && "hidden")} />
                {isScanning ? "Running…" : "Force Check"}
              </Button>
            </div>
          </motion.div>

          <motion.div variants={pageItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total"
              value={totalItems}
              description="All items"
              badgeClassName="bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
            />
            <StatCard
              title="AI Indexed"
              value={indexedCount}
              description={`${pendingCount} pending analysis`}
              badgeClassName="bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
            />
            <StatCard
              title="RBI"
              value={rbiCount}
              description="Reserve Bank of India"
              badgeClassName="bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
            />
            <StatCard
              title="SEBI"
              value={sebiCount}
              description="Securities and Exchange Board of India"
              badgeClassName="bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
            />
          </motion.div>

          <motion.div variants={pageItem} className="w-full space-y-4">
            <GenericDataTable
              columns={columns}
              data={filtered}
              searchKey="name"
              searchPlaceholder="Search by title, ID, tag, or date (e.g. March 2017)..."
              searchValue={search}
              onSearchChange={setSearch}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              onRowClick={(row) => navigate(`/regulations/${row.id}`)}
              onTabChange={setActiveTab}
              tabs={[
                { value: "all", label: "All" },
                { value: "rbi", label: "RBI", badge: items.filter((i) => i.body === "RBI").length, badgeClassName: "bg-red-500/10 text-red-600 dark:text-red-400" },
                { value: "sebi", label: "SEBI", badge: items.filter((i) => i.body === "SEBI").length, badgeClassName: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
              ]}
              defaultTab={activeTab}
              actions={
                <div className="flex gap-2">
                  <Select value={filterIndexed} onValueChange={setFilterIndexed}>
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      <SelectValue placeholder="AI Indexed" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Circulars</SelectItem>
                      <SelectItem value="indexed">Indexed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              }
            />
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default Regulations;

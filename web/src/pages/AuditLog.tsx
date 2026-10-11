import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAuditLog, type BackendAuditLogEntry } from "@/lib/auditLog";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Download,
  FileText,
  Clock,
  Edit,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  Search,
  Upload,
  PlusCircle,
  Activity,
  Filter,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { pageContainer, pageItem } from "@/lib/animations";

import { MOCK_AUDIT_TRAIL, PREV_MONTH_AUDIT as prevMonthAudit, type AuditEntry } from "@/data/auditLog";

function dateBucket(d: Date): string {
  const now = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, now)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// AuditLogEntryRow.type only ever emits a subset of AuditEntry's union
// (create/edit/system/ai/approval/status/upload — never comment/export,
// since nothing in the schema backs those two yet) — typeConfig already
// falls back to `system` for anything not in the map, so no cast is needed
// beyond satisfying TypeScript.
function mapBackendEntry(e: BackendAuditLogEntry): AuditEntry {
  const createdAt = new Date(e.createdAt);
  return {
    id: e.id,
    user: e.actorName,
    initials: e.actorName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?",
    action: e.action,
    detail: e.detail ?? undefined,
    time: createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    date: dateBucket(createdAt),
    type: e.type.toLowerCase() as AuditEntry["type"],
    assessment: e.context ?? undefined,
    ip: e.ip ?? undefined,
  };
}

const typeConfig = {
  approval: { icon: CheckCircle2, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20", dot: "bg-emerald-500", label: "Approval" },
  edit: { icon: Edit, color: "text-violet-700 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-500/10 border-violet-100 dark:border-violet-500/20", dot: "bg-violet-500", label: "Edit" },
  ai: { icon: Sparkles, color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20", dot: "bg-blue-500", label: "AI" },
  comment: { icon: MessageSquare, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20", dot: "bg-amber-500", label: "Comment" },
  upload: { icon: Upload, color: "text-sky-700 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-500/10 border-sky-100 dark:border-sky-500/20", dot: "bg-sky-500", label: "Upload" },
  status: { icon: AlertTriangle, color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20", dot: "bg-orange-500", label: "Status" },
  system: { icon: RefreshCw, color: "text-slate-700 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-500/10 border-slate-100 dark:border-slate-500/20", dot: "bg-slate-500", label: "System" },
  create: { icon: PlusCircle, color: "text-teal-700 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-500/10 border-teal-100 dark:border-teal-500/20", dot: "bg-teal-500", label: "Create" },
  export: { icon: Download, color: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20", dot: "bg-indigo-500", label: "Export" },
};

const allTypes = ["all", ...Object.keys(typeConfig)] as const;

const statusClassAudit = {
  total: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
  approval: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  ai: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  edit: "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20",
};

const AuditLog = () => {
  const { isDemo } = useAuth();
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>(isDemo ? MOCK_AUDIT_TRAIL : []);
  const [isLoading, setIsLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  useEffect(() => {
    if (isDemo) return;
    fetchAuditLog()
      .then((data) => {
        setLoadError(null);
        setAuditTrail(data.map(mapBackendEntry));
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load audit log"))
      .finally(() => setIsLoading(false));
  }, [isDemo]);

  const filtered = auditTrail.filter(e => {
    const matchesSearch =
      e.user.toLowerCase().includes(search.toLowerCase()) ||
      e.action.toLowerCase().includes(search.toLowerCase()) ||
      (e.detail ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (e.assessment ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === "all" || e.type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const grouped = filtered.reduce<Record<string, AuditEntry[]>>((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, {});

  return (
    <motion.div
      variants={pageContainer}
      initial="hidden"
      animate="show"
      className="flex-1 overflow-auto p-6 space-y-6"
    >
      {/* Header */}
      <motion.div variants={pageItem} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Immutable, chronological record of all platform activities and user actions
          </p>
        </div>
        <Button variant="outline" size="default" className="h-10 px-5 rounded-lg font-medium shrink-0">
          <Download className="h-4 w-4 mr-2" />
          Export Log
        </Button>
      </motion.div>

      {loadError && (
        <motion.div
          variants={pageItem}
          className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Failed to load audit log: {loadError}
        </motion.div>
      )}

      {isLoading ? (
        <motion.div variants={pageItem} className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          Loading audit log…
        </motion.div>
      ) : (
      <>
      {/* Stats */}
      <motion.div variants={pageItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Events"
          value={auditTrail.length}
          trend={isDemo ? (auditTrail.length >= prevMonthAudit.total ? "up" : "down") : undefined}
          trendValue={isDemo ? (prevMonthAudit.total ? `${auditTrail.length > prevMonthAudit.total ? "+" : ""}${Math.round(((auditTrail.length - prevMonthAudit.total) / prevMonthAudit.total) * 100)}% vs last month` : auditTrail.length) : undefined}
          trendLabel={isDemo ? "All activities" : undefined}
          description="Immutable log entries this period"
          badgeClassName={statusClassAudit.total}
        />
        <StatCard
          title="Approvals"
          value={auditTrail.filter(e => e.type === "approval").length}
          trend="up"
          trendValue={auditTrail.length ? `${Math.round((auditTrail.filter(e => e.type === "approval").length / auditTrail.length) * 100)}% of total` : "0%"}
          trendLabel="Approved answers"
          description="Review and sign-off actions"
          badgeClassName={statusClassAudit.approval}
        />
        <StatCard
          title="AI Actions"
          value={auditTrail.filter(e => e.type === "ai").length}
          trend="up"
          trendValue={auditTrail.length ? `${Math.round((auditTrail.filter(e => e.type === "ai").length / auditTrail.length) * 100)}% of total` : "0%"}
          trendLabel="AI-generated"
          description="Drafts and suggestions from AI"
          badgeClassName={statusClassAudit.ai}
        />
        <StatCard
          title="Edits"
          value={auditTrail.filter(e => e.type === "edit").length}
          trend="up"
          trendValue={auditTrail.length ? `${Math.round((auditTrail.filter(e => e.type === "edit").length / auditTrail.length) * 100)}% of total` : "0%"}
          trendLabel="Manual edits"
          description="User-edited responses"
          badgeClassName={statusClassAudit.edit}
        />
      </motion.div>

      {/* Search & Filters */}
      <motion.div variants={pageItem} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by user, action, assessment ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {allTypes.map((type) => {
            const cfg = type !== "all" ? typeConfig[type as keyof typeof typeConfig] : null;
            const isActive = activeFilter === type;
            return (
              <Badge
                key={type}
                variant="outline"
                onClick={() => setActiveFilter(type)}
                className={cn(
                  "cursor-pointer select-none capitalize transition-all",
                  isActive
                    ? cfg
                      ? cn(cfg.bg, cfg.color)
                      : "bg-foreground/10 text-foreground border-foreground/30"
                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {type === "all" ? "All" : cfg?.label ?? type}
              </Badge>
            );
          })}
        </div>
      </motion.div>

      {/* Timeline */}
      {Object.keys(grouped).length === 0 ? (
        <motion.div variants={pageItem} className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-2">
          <Activity className="h-10 w-10 opacity-20" />
          <p className="text-sm font-medium">No matching events found</p>
          <p className="text-xs">Try adjusting your filters or search query</p>
        </motion.div>
      ) : (
        <motion.div variants={pageContainer} className="space-y-8">
          {Object.entries(grouped).map(([date, entries]) => (
            <motion.div variants={pageItem} key={date}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{date}</span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground">{entries.length} event{entries.length !== 1 ? "s" : ""}</span>
              </div>

              <Card className="border divide-y divide-border/60 overflow-hidden shadow-none">
                {entries.map((entry) => {
                  const cfg = typeConfig[entry.type] || typeConfig.system;
                  const isAI = entry.type === "ai";

                  return (
                    <div key={entry.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors group">
                      <div className={cn(
                        "h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold border",
                        isAI ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20" : "bg-muted text-muted-foreground border-border"
                      )}>
                        {isAI ? <Sparkles className="h-4 w-4 text-blue-600" /> : entry.initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm text-foreground leading-snug">
                              <span className={cn("font-semibold", isAI && "text-blue-700")}>{entry.user}</span>
                              {" "}
                              <span className="text-muted-foreground">{entry.action}</span>
                            </p>
                            {entry.detail && (
                              <p className="text-xs font-medium text-foreground/80 mt-0.5">{entry.detail}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {entry.time}
                              </span>
                              {entry.assessment && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {entry.assessment}
                                </span>
                              )}
                            </div>
                          </div>

                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 capitalize",
                              cfg.bg, cfg.color
                            )}
                          >
                            {cfg.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
      </>
      )}
    </motion.div>
  );
};

export default AuditLog;

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle2,
  Calendar,
  Building2,
  Download,
  MoreHorizontal,
  HelpCircle,
  MessageSquareText,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { pageContainer, pageItem } from "@/lib/animations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GenericDataTable } from "@/components/generic-data-table";
import { type RowSelectionState } from "@tanstack/react-table";
import type { AppColumnDef } from "@/lib/table-features";
import { useAuth } from "@/contexts/AuthContext";
import { fetchKnowledgeBaseEntries, type BackendKnowledgeBaseEntry } from "@/lib/knowledgeBase";
import { DEMO_KNOWLEDGE_BASE } from "@/demo/complianceScenario";

interface QuestionAnswerItem {
  id: string;
  question: string;
  answer: string;
  sourceType: "internal" | "external";
  sourceAssessment: string;
  tags: string[];
  // Lowercased KBStatus (verified | review | draft) for real entries.
  status: string;
  dateAdded: string;
}

const MOCK_QA: QuestionAnswerItem[] = DEMO_KNOWLEDGE_BASE;

const statusClass: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  review: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  draft: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
};

/** Mock previous month counts for comparison */
const prevMonth = { total: 4, verified: 2, review: 1, draft: 1 };

// Shared KBStatus is VERIFIED | REVIEW | DRAFT — lowercase for the UI keys.
const mapKnowledgeBaseStatus = (status: BackendKnowledgeBaseEntry["status"]): string =>
  status.toLowerCase();

const mapBackendEntry = (e: BackendKnowledgeBaseEntry): QuestionAnswerItem => ({
  id: e.id,
  question: e.question,
  answer: e.answer,
  sourceType: e.sourceType === "EXTERNAL" ? "external" : "internal",
  sourceAssessment: e.sourceAssessment ?? "",
  tags: e.tags ?? [],
  status: mapKnowledgeBaseStatus(e.status),
  dateAdded: new Date(e.updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }),
});

export default function AssessmentKnowledgeBase() {
  const { isDemo } = useAuth();
  const [items, setItems] = useState<QuestionAnswerItem[]>(isDemo ? MOCK_QA : []);
  const [isLoading, setIsLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    fetchKnowledgeBaseEntries()
      .then((entries) => {
        if (cancelled) return;
        setItems(entries.map(mapBackendEntry));
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load knowledge base.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (activeTab === "all") return true;
      if (activeTab === "verified" && i.status === "verified") return true;
      if (activeTab === "review" && i.status === "review") return true;
      if (activeTab === "draft" && i.status === "draft") return true;
      return false;
    });
  }, [items, activeTab]);

  const columns = useMemo<AppColumnDef<QuestionAnswerItem>[]>(() => [
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
      accessorKey: "question",
      header: "Question & Answer",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-col gap-2 py-1">
            <div className="flex gap-2">
              <HelpCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="font-bold text-sm text-foreground leading-snug">{item.question}</p>
            </div>
            <div className="flex gap-2">
              <MessageSquareText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{item.answer}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "sourceAssessment",
      header: "Source",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors shrink-0">
            <Building2 className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium text-foreground">{row.original.sourceAssessment}</span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className={cn("capitalize shrink-0", statusClass[row.original.status])}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "dateAdded",
      header: "Date Added",
      cell: ({ row }) => (
        <div className="flex items-center text-[11px] text-muted-foreground font-medium whitespace-nowrap">
          <Calendar className="mr-1.5 h-3 w-3" />
          {row.original.dateAdded}
        </div>
      ),
    },
    {
      id: "actions",
      cell: () => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-xl">
              <DropdownMenuItem>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Verified
              </DropdownMenuItem>
              <DropdownMenuItem>View Details</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], []);

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <motion.div
      variants={pageContainer}
      initial="hidden"
      animate="show"
      className="flex-1 overflow-auto p-4 md:p-6 space-y-6"
    >
      <motion.div variants={pageItem}>
        <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Knowledge Base</h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">Historical record of past completed questions and answers.</p>
      </motion.div>

      {/* Stats */}
      <motion.div variants={pageItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Q&A Pairs"
          value={items.length}
          trend={isDemo ? (items.length >= prevMonth.total ? "up" : "down") : undefined}
          trendValue={isDemo ? (prevMonth.total ? `${items.length > prevMonth.total ? "+" : ""}${Math.round(((items.length - prevMonth.total) / prevMonth.total) * 100)}% vs last month` : `${items.length}`) : undefined}
          trendLabel={isDemo ? "All questions and answers" : undefined}
          description="From past completed assessments"
          badgeClassName={items.length >= prevMonth.total ? statusClass.verified : statusClass.review}
        />
        <StatCard
          title="Verified Answers"
          value={items.filter(i => i.status === "verified").length}
          trend="up"
          trendValue={items.length ? `${Math.round((items.filter(i => i.status === "verified").length / items.length) * 100)}% of total` : "0%"}
          trendLabel="Audit-ready"
          description="Reviewed and approved for use"
          badgeClassName={statusClass.verified}
        />
        <StatCard
          title="Needs Review"
          value={items.filter(i => i.status === "review").length}
          trend={items.filter(i => i.status === "review").length > 0 ? "down" : undefined}
          trendValue={items.length ? `${Math.round((items.filter(i => i.status === "review").length / items.length) * 100)}% of total` : "0%"}
          trendLabel={items.filter(i => i.status === "review").length > 0 ? "Pending verification" : undefined}
          description="Answers awaiting reviewer sign-off"
          badgeClassName={statusClass.review}
        />
        <StatCard
          title="Draft"
          value={items.filter(i => i.status === "draft").length}
          trend={isDemo ? (items.filter(i => i.status === "draft").length <= prevMonth.draft ? "down" : "up") : undefined}
          trendValue={isDemo ? (prevMonth.draft ? `${items.filter(i => i.status === "draft").length > prevMonth.draft ? "+" : ""}${items.filter(i => i.status === "draft").length - prevMonth.draft} vs last month` : `${items.filter(i => i.status === "draft").length}`) : undefined}
          trendLabel={isDemo ? "In progress" : undefined}
          description="Answers not yet submitted for review"
          badgeClassName={statusClass.draft}
        />
      </motion.div>

      {!isDemo && isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading knowledge base...
        </div>
      )}

      {!isDemo && loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 p-4 text-sm font-medium">
          Failed to load knowledge base: {loadError}
        </div>
      )}

      {/* Batch Actions Toolbar */}
      {selectedCount > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground">{selectedCount}</Badge>
            <span className="text-sm font-medium text-foreground">Questions Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 bg-background border-border hover:bg-accent text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Mark Verified
            </Button>
            <Button variant="outline" size="sm" className="h-8 bg-background border-border hover:bg-accent text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export Selected
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => setRowSelection({})}>
                <X className="h-4 w-4 mr-1.5" /> Cancel
            </Button>
          </div>
        </motion.div>
      )}

      {/* Data Table */}
      <motion.div variants={pageItem} className="w-full">
        <GenericDataTable
          columns={columns}
          data={filtered}
          searchKey="question"
          searchPlaceholder="Search questions or answers..."
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          onTabChange={setActiveTab}
          tabs={[
            { value: "all", label: "All Questions", badge: items.length },
            { value: "verified", label: "Verified", badge: items.filter(i => i.status === "verified").length, badgeClassName: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
            { value: "review", label: "Needs Review", badge: items.filter(i => i.status === "review").length, badgeClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
            { value: "draft", label: "Draft", badge: items.filter(i => i.status === "draft").length, badgeClassName: "bg-slate-500/10 text-slate-600 dark:text-slate-400" },
          ]}
          defaultTab={activeTab}
        />
      </motion.div>
    </motion.div>
  );
}

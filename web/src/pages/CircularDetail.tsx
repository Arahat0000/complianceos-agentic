import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { GenericDataTable } from "@/components/generic-data-table";
import type { RowSelectionState } from "@tanstack/react-table";
import type { AppColumnDef } from "@/lib/table-features";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Tag,
  Shield,
  Download,
  ExternalLink,
  Sparkles,
  ScrollText,
  ArrowRightLeft,
  Plus,
  MessageSquare,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Check,
  ShieldCheck,
  Scale,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { pageContainer } from "@/lib/animations";
import { toast } from "sonner";
import { ContradictionSuggestions } from "@/components/ContradictionSuggestions";
import { getRbiCircularById } from "@/data/rbiMasterDirectionsIndexed";
import { getSebiCircularById } from "@/data/sebiMasterCirculars";
import { getPendingCircularById } from "@/data/pendingCirculars";
import { ChangeAnalysisPanel } from "@/components/ChangeAnalysisPanel";
import { REGULATORY_CONTRADICTIONS, type RegulatoryContradiction } from "@/data/traceabilityData";

interface ObligationContradictionResult {
  hasConflict: boolean;
  contradiction: RegulatoryContradiction | null;
  badgeLabel: string;
  shortType: string;
  involvedCount: number;
  regulators: string[];
  shortConflict: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | null;
}

function getObligationContradiction(rec: { id: string; title: string; description: string; category?: string }): ObligationContradictionResult {
  const text = `${rec.id} ${rec.title} ${rec.description} ${rec.category || ""}`.toLowerCase();

  // 1. Incident Escalation & Notification Timelines Clash (SEBI 15m vs RBI 2h vs CERT-In 6h)
  if (
    text.includes("incident") ||
    text.includes("csite") ||
    text.includes("cert-in") ||
    text.includes("notification") ||
    rec.id === "ITG-REC-17" ||
    rec.id === "REC-RBI-01" ||
    rec.id === "CTRL-ITG-INC"
  ) {
    const c = REGULATORY_CONTRADICTIONS[0];
    return {
      hasConflict: true,
      contradiction: c,
      badgeLabel: "Timeline Conflict",
      shortType: "Timeline",
      involvedCount: 3,
      regulators: ["SEBI", "RBI", "CERT-In"],
      shortConflict: "SEBI (15m) vs RBI (2h) vs CERT-In (6h)",
      severity: c.severity,
    };
  }

  // 2. Log & Audit Trail Retention Mismatch (CERT-In 180d vs SEBI 5y vs RBI 8y)
  if (
    text.includes("log") ||
    text.includes("audit trail") ||
    text.includes("retention") ||
    text.includes("archive") ||
    text.includes("asset management") ||
    rec.id === "ITG-REC-07" ||
    rec.id === "REC-RBI-05"
  ) {
    const c = REGULATORY_CONTRADICTIONS[1];
    return {
      hasConflict: true,
      contradiction: c,
      badgeLabel: "Retention Conflict",
      shortType: "Retention",
      involvedCount: 3,
      regulators: ["CERT-In", "SEBI", "RBI"],
      shortConflict: "CERT-In (180d) vs SEBI (5y) vs RBI (8y)",
      severity: c.severity,
    };
  }

  // 3. Right to Erasure (DPDP) vs Statutory Record Keeping (RBI/PMLA)
  if (
    text.includes("privacy") ||
    text.includes("erasure") ||
    text.includes("sovereignty") ||
    text.includes("pii") ||
    text.includes("teleworking") ||
    rec.id === "ITG-REC-12" ||
    rec.id === "REC-RBI-10"
  ) {
    const c = REGULATORY_CONTRADICTIONS[2];
    return {
      hasConflict: true,
      contradiction: c,
      badgeLabel: "Privacy vs Audit",
      shortType: "Privacy",
      involvedCount: 2,
      regulators: ["DPDP", "RBI"],
      shortConflict: "DPDP Right to Erasure vs RBI Ledger",
      severity: c.severity,
    };
  }

  return {
    hasConflict: false,
    contradiction: null,
    badgeLabel: "4 Regulators Aligned",
    shortType: "Aligned",
    involvedCount: 4,
    regulators: ["RBI", "SEBI", "CERT-In", "DPDP"],
    shortConflict: "Harmonized across RBI, SEBI, CERT-In & DPDP",
    severity: null,
  };
}

// Resolve by ID: Pending → RBI → SEBI → fallback
function getCircularData(id: string) {
  const pending = getPendingCircularById(id);
  if (pending) return pending;
  if (id.startsWith("sebi")) {
    const sebi = getSebiCircularById(id);
    if (sebi) return sebi;
  }
  const rbi = getRbiCircularById(id);
  if (rbi) return rbi;
  const sebi = getSebiCircularById(id);
  if (sebi) return sebi;
  return getRbiCircularById("1")!;
}

const bodyColors: Record<string, string> = {
  RBI: "bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  SEBI: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  Other: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
};

const statusColors = {
  Active: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  Superseded: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  Draft: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
};

const CircularDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const circular = getCircularData(id || "1");
  const [viewMode, setViewMode] = useState<"overview" | "obligations" | "questions">(() => {
    if (tabParam === "obligations" || tabParam === "ai-index" || tabParam === "controls") return "obligations";
    if (tabParam === "questions") return "questions";
    return "overview";
  });

  const [prevTabParam, setPrevTabParam] = useState(tabParam);
  if (prevTabParam !== tabParam) {
    setPrevTabParam(tabParam);
    if (tabParam === "obligations" || tabParam === "ai-index" || tabParam === "controls") {
      setViewMode("obligations");
    } else if (tabParam === "questions") {
      setViewMode("questions");
    }
  }

  const handleTabChange = (mode: "overview" | "obligations" | "questions") => {
    setViewMode(mode);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (mode === "overview") {
          next.delete("tab");
        } else {
          next.set("tab", mode);
        }
        return next;
      },
      { replace: true }
    );
  };
  const [showAddControl, setShowAddControl] = useState(false);
  const [newControlId, setNewControlId] = useState("");
  const [newControlName, setNewControlName] = useState("");
  const [newControlFramework, setNewControlFramework] = useState("");
  const [newControlNotes, setNewControlNotes] = useState("");
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQuestionTitle, setNewQuestionTitle] = useState("");
  const [newQuestionDescription, setNewQuestionDescription] = useState("");
  const [addControlLinkedQuestionIds, setAddControlLinkedQuestionIds] = useState<string[]>([]);
  const [addQuestionLinkedControlIds, setAddQuestionLinkedControlIds] = useState<string[]>([]);
  const [manualQuestions, setManualQuestions] = useState<{ id: string; title: string; description?: string }[]>([]);
  const [manualControls, setManualControls] = useState<
    { id: string; title: string; description: string; relevance: string; category: string }[]
  >([]);
  /** User-editable linkage: questionId -> control ids. Merged with data controlId for display. */
  const [linkOverrides, setLinkOverrides] = useState<Record<string, string[]>>({});
  const [indexControlsSearch, setIndexControlsSearch] = useState("");
  const [questionsSearch, setQuestionsSearch] = useState("");
  const [obligationSelection, setObligationSelection] = useState<RowSelectionState>({});
  const [questionSelection, setQuestionSelection] = useState<RowSelectionState>({});
  const [harmonizedObligations, setHarmonizedObligations] = useState<Record<string, boolean>>({});
  const [selectedContradictionObligation, setSelectedContradictionObligation] = useState<ControlRow | null>(null);

  const handleHarmonizeObligation = (recId: string, ruleTitle: string) => {
    setHarmonizedObligations((prev) => ({ ...prev, [recId]: true }));
    toast.success(
      `Harmonized: Strictest Common Denominator applied for ${ruleTitle}.`
    );
  };

  const getControlIdsForQuestion = useCallback(
    (q: { id: string; controlId?: string }) => linkOverrides[q.id] ?? (q.controlId ? [q.controlId] : []),
    [linkOverrides],
  );

  const allControlsList = useMemo(() => {
    const ai = circular.aiRecommendations.map((rec) => ({ ...rec, source: "ai" as const }));
    const manual = manualControls.map((c) => ({ ...c, source: "manual" as const }));
    return [...ai, ...manual];
  }, [circular.aiRecommendations, manualControls]);

  const activeConflictCount = useMemo(() => {
    return allControlsList.filter((rec) => {
      const contra = getObligationContradiction(rec);
      return contra.hasConflict && !harmonizedObligations[rec.id];
    }).length;
  }, [allControlsList, harmonizedObligations]);

  const filteredIndexControls = useMemo(() => {
    const q = indexControlsSearch.toLowerCase().trim();
    if (!q) return allControlsList;
    const sourceText = (s: string) => (s === "ai" ? "ai" : "manual");
    return allControlsList.filter((rec) => {
      const contra = getObligationContradiction(rec);
      const isHarmonized = !!harmonizedObligations[rec.id];
      const contraTerms = contra.hasConflict
        ? `${contra.badgeLabel} ${contra.shortConflict} conflict contradiction ${isHarmonized ? "harmonized" : "open"}`
        : "aligned harmonized";

      return (
        rec.id.toLowerCase().includes(q) ||
        rec.title.toLowerCase().includes(q) ||
        rec.description.toLowerCase().includes(q) ||
        rec.category.toLowerCase().includes(q) ||
        rec.relevance.toLowerCase().includes(q) ||
        sourceText(rec.source).includes(q) ||
        contraTerms.toLowerCase().includes(q)
      );
    });
  }, [allControlsList, indexControlsSearch, harmonizedObligations]);

  const allQuestionsList = useMemo(() => {
    const dataQuestions = circular.questions?.length
      ? circular.questions.map((q, i) => ({
        ...q,
        controlId: circular.aiRecommendations[i]?.id ?? (q as { controlId?: string }).controlId,
      }))
      : circular.aiRecommendations.map((rec) => ({
        id: rec.id,
        title: `Has the control "${rec.title}" been implemented and documented?`,
        description: rec.description,
        source: "ai" as const,
        controlId: rec.id,
      }));
    const defaultGov = {
      id: "default-gov",
      title: "Has management reviewed and signed off on manual controls mapped to this circular (e.g. policy attestations, board approvals)?",
      description: "Manual / governance control",
      source: "manual" as const,
    };
    return [...dataQuestions, ...manualQuestions.map((q) => ({ ...q, source: "manual" as const })), defaultGov];
  }, [circular.questions, circular.aiRecommendations, manualQuestions]);

  const filteredQuestions = useMemo(() => {
    const q = questionsSearch.toLowerCase().trim();
    if (!q) return allQuestionsList;
    const sourceLabel = (item: (typeof allQuestionsList)[number]) =>
      item.id === "default-gov" ? "governance" : item.source === "manual" ? "manual" : "ai";
    return allQuestionsList.filter((item) => {
      const linkedTitles = getControlIdsForQuestion(item as { id: string; controlId?: string })
        .map((cid) => allControlsList.find((x) => x.id === cid)?.title?.toLowerCase() ?? cid.toLowerCase())
        .join(" ");
      return (
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        sourceLabel(item).includes(q) ||
        linkedTitles.includes(q)
      );
    });
  }, [allQuestionsList, questionsSearch, allControlsList, getControlIdsForQuestion]);

  type ControlRow = (typeof allControlsList)[number];
  type QuestionRow = (typeof allQuestionsList)[number];

  const [viewControl, setViewControl] = useState<ControlRow | null>(null);
  const [viewQuestion, setViewQuestion] = useState<QuestionRow | null>(null);
  const [editControl, setEditControl] = useState<ControlRow | null>(null);
  const [editControlDraft, setEditControlDraft] = useState<ControlRow | null>(null);
  const [editControlLinkedQuestionIds, setEditControlLinkedQuestionIds] = useState<string[]>([]);
  const [editControlStep, setEditControlStep] = useState<1 | 2>(1);
  const [editQuestion, setEditQuestion] = useState<QuestionRow | null>(null);
  const [editQuestionDraft, setEditQuestionDraft] = useState<QuestionRow | null>(null);
  const [editQuestionLinkedControlIds, setEditQuestionLinkedControlIds] = useState<string[]>([]);

  const [prevEditControlDeps, setPrevEditControlDeps] = useState<{ id: string | undefined; list: unknown; getter: unknown }>({ id: undefined, list: undefined, getter: undefined });
  if (prevEditControlDeps.id !== editControl?.id || prevEditControlDeps.list !== allQuestionsList || prevEditControlDeps.getter !== getControlIdsForQuestion) {
    setPrevEditControlDeps({ id: editControl?.id, list: allQuestionsList, getter: getControlIdsForQuestion });
    if (editControl) {
      setEditControlLinkedQuestionIds(
        allQuestionsList.filter((q) => getControlIdsForQuestion(q as { id: string; controlId?: string }).includes(editControl.id)).map((q) => q.id)
      );
    }
  }

  const [prevEditQuestionDeps, setPrevEditQuestionDeps] = useState<{ id: string | undefined; getter: unknown }>({ id: undefined, getter: undefined });
  if (prevEditQuestionDeps.id !== editQuestion?.id || prevEditQuestionDeps.getter !== getControlIdsForQuestion) {
    setPrevEditQuestionDeps({ id: editQuestion?.id, getter: getControlIdsForQuestion });
    if (editQuestion) {
      setEditQuestionLinkedControlIds(getControlIdsForQuestion(editQuestion as { id: string; controlId?: string }));
    }
  }

  const controlColumns = useMemo<AppColumnDef<ControlRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
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
        cell: ({ row }) => (
          <span className="text-center font-mono text-[10px] text-muted-foreground/60">
            {row.index + 1}
          </span>
        ),
      },
      { accessorKey: "id", header: "ID", cell: ({ row }) => <span className="text-xs font-mono text-muted-foreground">{row.original.id}</span> },
      { accessorKey: "title", header: "Obligation / Requirement", cell: ({ row }) => <span className="font-medium text-foreground">{row.original.title}</span> },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-2 py-0.5 border",
              row.original.source === "ai"
                ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                : "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
            )}
          >
            {row.original.source === "ai" ? "AI" : "Manual"}
          </Badge>
        ),
      },
      {
        accessorKey: "relevance",
        header: "Relevance",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-2 py-0.5 border",
              row.original.relevance === "High"
                ? "bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                : "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
            )}
          >
            {row.original.relevance}
          </Badge>
        ),
      },
      { accessorKey: "category", header: "Category", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.category}</span> },
      {
        id: "crossReg",
        header: "Cross-Reg Intelligence",
        cell: ({ row }) => {
          const info = getObligationContradiction(row.original);
          const isHarmonized = !!harmonizedObligations[row.original.id];

          if (info.hasConflict) {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedContradictionObligation(row.original);
                }}
                className={cn(
                  "group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all text-left cursor-pointer shadow-2xs hover:shadow-xs",
                  isHarmonized
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50"
                    : info.severity === "CRITICAL"
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/50"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/50"
                )}
                title={
                  isHarmonized
                    ? "Harmonized under Strictest Common Denominator policy. Click to view legal defense & controls."
                    : `${info.shortConflict}. Click to view comparative analysis & harmonize.`
                }
              >
                {isHarmonized ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-semibold text-emerald-800 dark:text-emerald-200">Harmonized</span>
                    <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 font-mono font-bold">Strictest</span>
                    <ChevronRight className="h-3 w-3 text-emerald-600/60 transition-transform group-hover:translate-x-0.5 shrink-0 ml-0.5" />
                  </>
                ) : (
                  <>
                    <AlertTriangle className={cn(
                      "h-3 w-3 shrink-0",
                      info.severity === "CRITICAL" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                    )} />
                    <span className="font-semibold">{info.badgeLabel}</span>
                    <span className="text-muted-foreground/70 font-mono text-[10px]">({info.involvedCount})</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 shrink-0 ml-0.5" />
                  </>
                )}
              </button>
            );
          }

          return (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground/80 font-normal">
              <Check className="h-3 w-3 text-emerald-600/70 dark:text-emerald-400/70" />
              <span>Aligned</span>
            </div>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const d = row.original.description;
          return (
            <span className="text-xs text-muted-foreground" title={d}>
              {d.length > 100 ? `${d.slice(0, 100).trim()}…` : d}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="text-right w-full block">Actions</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-0.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              aria-label="View control"
              onClick={(e) => {
                e.stopPropagation();
                setViewQuestion(null);
                setViewControl(row.original);
              }}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              aria-label="Edit control"
              onClick={(e) => {
                e.stopPropagation();
                setEditQuestion(null);
                setEditQuestionDraft(null);
                setEditControl(row.original);
                setEditControlDraft({ ...row.original });
                setEditControlStep(1);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
              aria-label="Delete control"
              onClick={(e) => {
                e.stopPropagation();
                if (row.original.source === "manual") setManualControls((prev) => prev.filter((c) => c.id !== row.original.id));
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [harmonizedObligations],
  );

  const questionColumns = useMemo<AppColumnDef<QuestionRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
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
        cell: ({ row }) => (
          <span className="text-center font-mono text-[10px] text-muted-foreground/60">
            {row.index + 1}
          </span>
        ),
      },
      { accessorKey: "id", header: "ID", cell: ({ row }) => <span className="text-xs font-mono text-muted-foreground">{row.original.id}</span> },
      { accessorKey: "title", header: "Title", cell: ({ row }) => <span className="font-medium text-foreground">{row.original.title}</span> },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => {
          const isManual = row.original.source === "manual";
          const isDefaultGov = row.original.id === "default-gov";
          const sourceLabel = isDefaultGov ? "Governance" : isManual ? "Manual" : "AI";
          return (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-2 py-0.5 border",
                isDefaultGov && "bg-muted/50 border-border",
                isManual && !isDefaultGov && "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
                !isManual && "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
              )}
            >
              {sourceLabel}
            </Badge>
          );
        },
      },
      {
        id: "control",
        header: "Linked obligation(s)",
        cell: ({ row }) => {
          const cids = getControlIdsForQuestion(row.original as { id: string; controlId?: string });
          if (cids.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <div className="flex flex-col gap-0.5">
              {cids.map((cid) => {
                const c = allControlsList.find((x) => x.id === cid);
                return (
                  <span key={cid} className="text-xs text-muted-foreground" title={c?.description}>
                    {c ? c.title : cid}
                  </span>
                );
              })}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="text-right w-full block">Actions</span>,
        cell: ({ row }) => {
          const isManual = row.original.source === "manual";
          const isDefaultGov = row.original.id === "default-gov";
          const isDeletableManual = isManual && !isDefaultGov && manualQuestions.some((mq) => mq.id === row.original.id);
          return (
            <div className="flex items-center justify-end gap-0.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                aria-label="View question"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewControl(null);
                  setViewQuestion(row.original);
                }}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                aria-label="Edit question"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditControl(null);
                  setEditControlDraft(null);
                  setEditQuestion(row.original);
                  setEditQuestionDraft({ ...row.original });
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                aria-label="Delete question"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDeletableManual) setManualQuestions((prev) => prev.filter((mq) => mq.id !== row.original.id));
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [manualQuestions, allControlsList, getControlIdsForQuestion],
  );

  return (
    <motion.div
      variants={pageContainer}
      initial="hidden"
      animate="show"
      className="flex-1 overflow-auto bg-background antialiased p-6 space-y-6"
    >
      {/* Breadcrumbs & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/regulations")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Regulations
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="default"
            className="h-10 px-5 rounded-lg font-medium"
            onClick={() => navigate(`/regulations/${id}/edit`)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="default"
            className="h-10 px-5 rounded-lg font-medium"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            variant="outline"
            size="default"
            className="h-10 px-5 rounded-lg font-medium"
            onClick={() => window.open(circular.link, "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Original
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Main Content */}
        <div className="space-y-6">
          <Card className="border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-card border-b border-border/40 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center">
                    <FileText className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono font-bold tracking-tight bg-muted/30"
                      >
                        {circular.circularId}
                      </Badge>
                      <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        {circular.name}
                      </h1>
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize text-[11px] px-2 py-0.5 border font-medium",
                          bodyColors[circular.body] ?? bodyColors.Other,
                        )}
                      >
                        {circular.body}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> Issued{" "}
                        {circular.dateOfIssue}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5" /> v{circular.version}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize text-[11px] px-2 py-0.5 border font-medium",
                          statusColors[circular.status as keyof typeof statusColors],
                        )}
                      >
                        {circular.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            {/* Left-Aligned Linear / GitHub Style Underline Navigation Tabs (Option 1) */}
            <div className="flex border-b border-border/40 px-6 bg-card">
              <nav className="flex items-center gap-6" aria-label="Tabs">
                <button
                  type="button"
                  onClick={() => handleTabChange("overview")}
                  className={cn(
                    "relative flex items-center gap-2 py-3.5 text-sm font-medium transition-colors cursor-pointer",
                    viewMode === "overview"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="h-4 w-4" />
                  <span>Overview</span>
                  {viewMode === "overview" && (
                    <motion.div
                      layoutId="circularDetailActiveTab"
                      className="absolute -bottom-px left-0 right-0 h-[2px] bg-foreground"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("obligations")}
                  className={cn(
                    "relative flex items-center gap-2 py-3.5 text-sm font-medium transition-colors cursor-pointer",
                    viewMode === "obligations"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ScrollText className="h-4 w-4" />
                  <span>Obligations</span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-mono font-medium transition-colors",
                      viewMode === "obligations"
                        ? "bg-foreground/10 text-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {allControlsList.length}
                  </span>
                  {viewMode === "obligations" && (
                    <motion.div
                      layoutId="circularDetailActiveTab"
                      className="absolute -bottom-px left-0 right-0 h-[2px] bg-foreground"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("questions")}
                  className={cn(
                    "relative flex items-center gap-2 py-3.5 text-sm font-medium transition-colors cursor-pointer",
                    viewMode === "questions"
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Assessment Questions</span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-mono font-medium transition-colors",
                      viewMode === "questions"
                        ? "bg-foreground/10 text-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {allQuestionsList.length}
                  </span>
                  {viewMode === "questions" && (
                    <motion.div
                      layoutId="circularDetailActiveTab"
                      className="absolute -bottom-px left-0 right-0 h-[2px] bg-foreground"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  )}
                </button>
              </nav>
            </div>

            <CardContent className="p-6 space-y-8 bg-card/50">
              {viewMode === "overview" && (
                <div className="space-y-8 animate-in fade-in duration-300" role="region" aria-label="Overview">
                  {/* Key details: only what's not already in the header (category, AI, control count) */}
                  <section aria-labelledby="overview-key-details">
                    <h2 id="overview-key-details" className="sr-only">Key details</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="gap-1.5 bg-muted/40 border-border/60 text-xs font-medium">
                        <Shield className="h-3 w-3" />
                        {circular.category}
                      </Badge>
                      <Badge variant="outline" className="gap-1.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30 text-xs font-medium">
                        <Sparkles className="h-3 w-3" />
                        AI indexed
                      </Badge>
                      <Badge variant="outline" className="gap-1.5 bg-muted/40 border-border/60 text-xs font-medium">
                        <Sparkles className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        {circular.aiRecommendations.length + manualControls.length} obligations
                      </Badge>
                      <Badge variant="outline" className="gap-1.5 bg-muted/40 border-border/60 text-xs font-medium">
                        <MessageSquare className="h-3 w-3" />
                        {allQuestionsList.length} questions
                      </Badge>
                    </div>
                  </section>

                  {/* Main read: about this circular */}
                  <section aria-labelledby="overview-about">
                    <h2 id="overview-about" className="text-base font-semibold text-foreground mb-2">
                      About this circular
                    </h2>
                    <p className="text-sm text-foreground/90 leading-relaxed max-w-3xl">
                      {circular.description}
                    </p>
                  </section>

                  {/* Tags */}
                  {circular.tags.length > 0 && (
                    <section aria-labelledby="overview-tags">
                      <h2 id="overview-tags" className="text-sm font-medium text-muted-foreground mb-2">
                        Topics
                      </h2>
                      <div className="flex flex-wrap gap-1.5">
                        {circular.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-[11px] font-normal bg-muted/60 text-muted-foreground border-0"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* AI Knowledge Insights */}
                  {allControlsList.length > 0 && (
                    <section aria-labelledby="overview-ai-insights">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-6 w-6 rounded-md bg-blue-50 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                          <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 id="overview-ai-insights" className="text-sm font-bold uppercase tracking-widest text-foreground">
                          Key Regulatory Obligations
                        </h2>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {allControlsList.slice(0, 6).map((rec) => (
                          <div
                            key={rec.id}
                            className="p-4 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 flex flex-col gap-2"
                          >
                            <p className="text-xs font-medium leading-snug opacity-95">{rec.title}</p>
                            <p className="text-xs leading-snug opacity-90 line-clamp-2">{rec.description}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
              {viewMode === "obligations" && (
                <div className="flex flex-col h-full min-h-0 animate-in slide-in-from-right-2 duration-300">
                  <div className="flex items-center justify-between shrink-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">
                          Extracted Obligations
                        </h3>
                        {activeConflictCount > 0 ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 gap-1 px-2 py-0.5"
                          >
                            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            {activeConflictCount} Cross-Reg Conflicts Detected
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30 gap-1 px-2 py-0.5"
                          >
                            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            All Cross-Reg Directives Harmonized
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Mandatory compliance obligations and cross-regulatory harmonization directives across RBI, SEBI, CERT-In & DPDP.
                      </p>
                      <ContradictionSuggestions />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-3 rounded-lg border-border"
                        onClick={() => setShowAddControl(true)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-2" />
                        Add Obligation
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-3 rounded-lg border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300"
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-2 text-blue-600 dark:text-blue-400" />
                        Re-index Circular
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex-1 min-h-0 flex flex-col w-full">
                    <GenericDataTable<ControlRow>
                      columns={controlColumns}
                      data={filteredIndexControls}
                      searchKey="title"
                      searchPlaceholder="Search by ID, title, type, relevance, category, description…"
                      searchValue={indexControlsSearch}
                      onSearchChange={setIndexControlsSearch}
                      rowSelection={obligationSelection}
                      onRowSelectionChange={setObligationSelection}
                    />
                  </div>
                </div>
              )}
              {viewMode === "questions" && (
                <div className="flex flex-col h-full min-h-0 animate-in slide-in-from-right-2 duration-300">
                  <div className="flex items-center justify-between shrink-0">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Control assessment questions
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Audit and self-assessment questions derived from indexed and manual controls.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-3 rounded-lg border-border"
                        onClick={() => setShowAddQuestion(true)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-2" />
                        Add Question
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-3 rounded-lg border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300"
                        onClick={() => setShowAddQuestion(true)}
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-2 text-blue-600 dark:text-blue-400" />
                        Generate with AI
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex-1 min-h-0 flex flex-col w-full">
                    <GenericDataTable<QuestionRow>
                      columns={questionColumns}
                      data={filteredQuestions}
                      searchKey="title"
                      searchPlaceholder="Search by ID, title, source, description…"
                      searchValue={questionsSearch}
                      onSearchChange={setQuestionsSearch}
                      rowSelection={questionSelection}
                      onRowSelectionChange={setQuestionSelection}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Custom Obligation Modal */}
      <Dialog open={showAddControl} onOpenChange={setShowAddControl}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Custom Obligation</DialogTitle>
            <DialogDescription>
              Capture a bespoke obligation that should be mapped to this circular.
              You can refine and connect it to compliance frameworks later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
                  Obligation ID
                </p>
                <Input
                  placeholder="e.g. OBL-CUST-01"
                  value={newControlId}
                  onChange={(e) => setNewControlId(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
                  Framework / Category
                </p>
                <Input
                  placeholder="e.g. Governance, Security, Reporting"
                  value={newControlFramework}
                  onChange={(e) => setNewControlFramework(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
                Obligation Title
              </p>
              <Input
                placeholder="Short title / requirement of the obligation"
                value={newControlName}
                onChange={(e) => setNewControlName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
                Notes / Requirement Description
              </p>
              <Textarea
                placeholder="Describe the mandate, scope, and key requirements of this obligation…"
                className="min-h-[120px] text-sm"
                value={newControlNotes}
                onChange={(e) => setNewControlNotes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">Linked questions</p>
              <p className="text-xs text-muted-foreground">Optionally link this obligation to assessment questions.</p>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border/60 p-2 space-y-1.5">
                {allQuestionsList
                  .filter((q) => q.id !== "default-gov")
                  .map((q) => (
                    <label key={q.id} className="flex items-start gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted/50">
                      <Checkbox
                        checked={addControlLinkedQuestionIds.includes(q.id)}
                        onCheckedChange={(checked) => {
                          setAddControlLinkedQuestionIds((prev) =>
                            checked ? [...prev, q.id] : prev.filter((id) => id !== q.id)
                          );
                        }}
                      />
                      <span className="text-sm text-foreground/90 line-clamp-2">{q.title}</span>
                    </label>
                  ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              type="button"
              className="text-muted-foreground"
              onClick={() => { setShowAddControl(false); setAddControlLinkedQuestionIds([]); }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!newControlName.trim()}
              onClick={() => {
                const newId = newControlId.trim() || `OBL-MAN-${Date.now()}`;
                setManualControls((prev) => [
                  ...prev,
                  {
                    id: newId,
                    title: newControlName.trim(),
                    description: newControlNotes.trim() || "No description.",
                    relevance: "Medium",
                    category: newControlFramework.trim() || "Custom",
                  },
                ]);
                if (addControlLinkedQuestionIds.length > 0) {
                  setLinkOverrides((prev) => {
                    const next = { ...prev };
                    addControlLinkedQuestionIds.forEach((qId) => {
                      const q = allQuestionsList.find((x) => x.id === qId);
                      if (!q) return;
                      const current = getControlIdsForQuestion(q as { id: string; controlId?: string });
                      next[qId] = [...new Set([...current, newId])];
                    });
                    return next;
                  });
                }
                setShowAddControl(false);
                setNewControlId("");
                setNewControlName("");
                setNewControlFramework("");
                setNewControlNotes("");
                setAddControlLinkedQuestionIds([]);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Save Obligation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Control / Question modal */}
      <Dialog
        open={viewControl !== null || viewQuestion !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewControl(null);
            setViewQuestion(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {viewControl && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-muted-foreground" />
                  Obligation details
                </DialogTitle>
                <DialogDescription>Full details of the selected regulatory obligation.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-1">ID</p>
                  <p className="text-sm font-mono text-foreground">{viewControl.id}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-1">Title</p>
                  <p className="text-sm font-medium text-foreground">{viewControl.title}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-2 py-0.5 border",
                      viewControl.source === "ai"
                        ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
                    )}
                  >
                    {viewControl.source === "ai" ? "AI" : "Manual"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-2 py-0.5 border",
                      viewControl.relevance === "High"
                        ? "bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                        : "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
                    )}
                  >
                    {viewControl.relevance} relevance
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 border bg-muted/50">
                    {viewControl.category}
                  </Badge>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-1">Description</p>
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{viewControl.description}</p>
                </div>

                {/* Cross-Regulation Intelligence & Contradiction Details */}
                {(() => {
                  const contra = getObligationContradiction(viewControl);
                  const isHarmonized = !!harmonizedObligations[viewControl.id];
                  return (
                    <div className="pt-2 border-t border-border/40 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
                          Cross-Regulation Intelligence
                        </p>
                        {contra.hasConflict ? (
                          isHarmonized ? (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-medium">
                              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                              Harmonized (Strictest)
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-semibold",
                                contra.severity === "CRITICAL"
                                  ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                              )}
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {contra.badgeLabel} ({contra.involvedCount} Regs)
                            </Badge>
                          )
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] border border-border/50 bg-muted/20 text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                            <span>4/4 Regulators Aligned</span>
                          </div>
                        )}
                      </div>

                      {contra.hasConflict && contra.contradiction && (
                        <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-2.5 text-xs">
                          <div>
                            <p className="font-semibold text-foreground">{contra.contradiction.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{contra.contradiction.description}</p>
                          </div>

                          <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                            <span className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                              Strictest Common Denominator Policy:
                            </span>
                            <p className="font-medium text-emerald-950 dark:text-emerald-100 text-xs">
                              {contra.contradiction.harmonizedRecommendation.strictestCommonDenominator}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] gap-1.5 px-2.5"
                              onClick={() => {
                                setViewControl(null);
                                setSelectedContradictionObligation(viewControl);
                              }}
                            >
                              <Scale className="h-3 w-3 text-primary" />
                              View Intelligence Matrix
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                            {!isHarmonized && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-7 text-[11px] px-3 shadow-xs cursor-pointer"
                                onClick={() => handleHarmonizeObligation(viewControl.id, viewControl.title)}
                              >
                                <ShieldCheck className="h-3 w-3" />
                                Apply Strictest Rule
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {allQuestionsList.some((q) => getControlIdsForQuestion(q).includes(viewControl.id)) && (
                  <div className="pt-2 border-t border-border/40">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-2">Related question(s)</p>
                    <ul className="space-y-1.5">
                      {allQuestionsList
                        .filter((q) => getControlIdsForQuestion(q).includes(viewControl.id))
                        .map((q) => (
                          <li key={q.id} className="text-sm text-foreground/90 flex items-start gap-2">
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            <span>{q.title}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
          {viewQuestion && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-muted-foreground" />
                  Question details
                </DialogTitle>
                <DialogDescription>Full details of the selected assessment question.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-1">ID / Type</p>
                  <p className="text-sm font-mono text-foreground">{viewQuestion.id}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-1">Title</p>
                  <p className="text-sm font-medium text-foreground">{viewQuestion.title}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-1">Source</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-2 py-0.5 border",
                      viewQuestion.id === "default-gov" && "bg-muted/50 border-border",
                      viewQuestion.source === "manual" && viewQuestion.id !== "default-gov" && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
                      viewQuestion.source === "ai" && "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
                    )}
                  >
                    {viewQuestion.id === "default-gov" ? "Governance" : viewQuestion.source === "manual" ? "Manual" : "AI"}
                  </Badge>
                </div>
                {viewQuestion.description && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-1">Description</p>
                    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{viewQuestion.description}</p>
                  </div>
                )}
                {getControlIdsForQuestion(viewQuestion).length > 0 && (
                  <div className="pt-2 border-t border-border/40">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em] mb-2">Related obligation(s)</p>
                    <ul className="space-y-1.5">
                      {getControlIdsForQuestion(viewQuestion).map((cid) => {
                        const c = allControlsList.find((x) => x.id === cid);
                        return c ? (
                          <li key={cid} className="text-sm text-foreground/90 flex items-start gap-2">
                            <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            <span className="font-medium">{c.title}</span>
                            <span className="text-xs text-muted-foreground font-mono">({c.id})</span>
                          </li>
                        ) : null;
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Control modal */}
      <Dialog
        open={editControl !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditControl(null);
            setEditControlDraft(null);
          }
        }}
      >
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div
                className={cn(
                  "flex items-center justify-center text-[10px] font-bold rounded-full h-5 w-5 transition-colors",
                  editControlStep === 1
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                1
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  editControlStep === 1 ? "text-foreground font-semibold" : "text-muted-foreground"
                )}
              >
                Obligation Details
              </span>
              <div className="h-px w-4 bg-border" />
              <div
                className={cn(
                  "flex items-center justify-center text-[10px] font-bold rounded-full h-5 w-5 transition-colors",
                  editControlStep === 2
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                2
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  editControlStep === 2 ? "text-foreground font-semibold" : "text-muted-foreground"
                )}
              >
                Linked Questions
              </span>
            </div>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil className="h-4 w-4 text-muted-foreground" />
              {editControlStep === 1 ? "Edit Obligation Details" : "Link Assessment Questions"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editControlStep === 1
                ? editControl?.source === "manual"
                  ? "Update obligation details below. Changes are saved to manual obligations."
                  : "AI-extracted obligations are verified. Add a manual obligation to create an editable copy."
                : "Select assessment questions that correlate to this obligation requirement."}
            </DialogDescription>
          </DialogHeader>

          {editControlDraft && (
            <>
              {editControlStep === 1 ? (
                /* Step 1: Obligation Details */
                <div className="space-y-3.5 py-1">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">ID</Label>
                    <Input
                      value={editControlDraft.id}
                      onChange={(e) => setEditControlDraft((d) => (d ? { ...d, id: e.target.value } : null))}
                      disabled={editControl?.source === "ai"}
                      className="font-mono text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Title</Label>
                    <Input
                      value={editControlDraft.title}
                      onChange={(e) => setEditControlDraft((d) => (d ? { ...d, title: e.target.value } : null))}
                      disabled={editControl?.source === "ai"}
                      className="h-9 text-sm"
                      placeholder="e.g. IT Governance Oversight"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Relevance</Label>
                      <Select
                        value={editControlDraft.relevance}
                        onValueChange={(v) => setEditControlDraft((d) => (d ? { ...d, relevance: v } : null))}
                        disabled={editControl?.source === "ai"}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Category</Label>
                      <Input
                        value={editControlDraft.category}
                        onChange={(e) => setEditControlDraft((d) => (d ? { ...d, category: e.target.value } : null))}
                        disabled={editControl?.source === "ai"}
                        className="h-9 text-sm"
                        placeholder="e.g. Compliance"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Description</Label>
                    <Textarea
                      value={editControlDraft.description}
                      onChange={(e) => setEditControlDraft((d) => (d ? { ...d, description: e.target.value } : null))}
                      disabled={editControl?.source === "ai"}
                      className="min-h-[85px] max-h-[140px] text-xs leading-relaxed"
                      placeholder="Describe the control policy and requirements..."
                    />
                  </div>
                </div>
              ) : (
                /* Step 2: Linked Assessment Questions */
                <div className="space-y-3 py-1">
                  <div className="p-2.5 rounded-lg border bg-muted/40 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-foreground text-xs">{editControlDraft.id}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                        {editControlDraft.category || "Control"}
                      </Badge>
                    </div>
                    <p className="font-medium text-foreground text-xs line-clamp-1">{editControlDraft.title}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Linked Questions ({editControlLinkedQuestionIds.length})
                    </Label>
                    {editControlLinkedQuestionIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEditControlLinkedQuestionIds([])}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear selection
                      </button>
                    )}
                  </div>

                  <div className="max-h-56 overflow-y-auto rounded-md border border-border/60 p-1.5 space-y-1 divide-y divide-border/30">
                    {allQuestionsList
                      .filter((q) => q.id !== "default-gov")
                      .map((q) => (
                        <label key={q.id} className="flex items-start gap-2.5 cursor-pointer rounded p-2 hover:bg-muted/50 transition-colors pt-2">
                          <Checkbox
                            checked={editControlLinkedQuestionIds.includes(q.id)}
                            onCheckedChange={(checked) => {
                              setEditControlLinkedQuestionIds((prev) =>
                                checked ? [...prev, q.id] : prev.filter((id) => id !== q.id)
                              );
                            }}
                            className="mt-0.5"
                          />
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <span className="text-[10px] font-mono text-muted-foreground">{q.id}</span>
                            <p className="text-xs text-foreground/90 leading-snug line-clamp-2">{q.title}</p>
                          </div>
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}

          <DialogFooter className="flex flex-row items-center justify-between gap-2 pt-2 sm:justify-between">
            {editControlStep === 1 ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditControl(null);
                    setEditControlDraft(null);
                    setEditControlStep(1);
                  }}
                >
                  Cancel
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
                    disabled={editControl?.source === "manual" && !editControlDraft?.title.trim()}
                    onClick={() => setEditControlStep(2)}
                  >
                    Next: Linked Questions
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditControlStep(1)}
                  className="gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditControl(null);
                      setEditControlDraft(null);
                      setEditControlStep(1);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={editControl?.source === "manual" && !editControlDraft?.title.trim()}
                    onClick={() => {
                      if (editControlDraft && editControl) {
                        if (editControl.source === "manual") {
                          setManualControls((prev) =>
                            prev.map((c) =>
                              c.id === editControlDraft.id
                                ? {
                                  id: editControlDraft.id,
                                  title: editControlDraft.title,
                                  description: editControlDraft.description,
                                  relevance: editControlDraft.relevance,
                                  category: editControlDraft.category,
                                }
                                : c
                            )
                          );
                        }
                        setLinkOverrides((prev) => {
                          const next = { ...prev };
                          allQuestionsList.forEach((q) => {
                            if (q.id === "default-gov") return;
                            const current = getControlIdsForQuestion(q as { id: string; controlId?: string });
                            const linked = editControlLinkedQuestionIds.includes(q.id);
                            const newIds = linked
                              ? [...new Set([...current, editControl.id])]
                              : current.filter((cid) => cid !== editControl.id);
                            if (newIds.length > 0) next[q.id] = newIds;
                            else delete next[q.id];
                          });
                          return next;
                        });
                        setEditControl(null);
                        setEditControlDraft(null);
                        setEditControlStep(1);
                      }
                    }}
                  >
                    Save changes
                  </Button>
                </div>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Question modal */}
      <Dialog
        open={editQuestion !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditQuestion(null);
            setEditQuestionDraft(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-muted-foreground" />
              Edit question
            </DialogTitle>
            <DialogDescription>
              {editQuestion?.source === "manual" && editQuestion?.id !== "default-gov"
                ? "Update the question below. Changes are saved to manual questions."
                : "Only manually added questions can be edited. Governance and AI-derived questions are read-only."}
            </DialogDescription>
          </DialogHeader>
          {editQuestionDraft && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">ID / Type</Label>
                <Input value={editQuestionDraft.id} disabled className="font-mono text-sm bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Title</Label>
                <Input
                  value={editQuestionDraft.title}
                  onChange={(e) => setEditQuestionDraft((d) => (d ? { ...d, title: e.target.value } : null))}
                  disabled={editQuestion?.source === "ai" || editQuestion?.id === "default-gov"}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Description (optional)</Label>
                <Textarea
                  value={editQuestionDraft.description ?? ""}
                  onChange={(e) => setEditQuestionDraft((d) => (d ? { ...d, description: e.target.value || undefined } : null))}
                  disabled={editQuestion?.source === "ai" || editQuestion?.id === "default-gov"}
                  className="min-h-[80px] text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Linked controls</Label>
                <p className="text-xs text-muted-foreground">Select controls that link to this question.</p>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border/60 p-2 space-y-1.5">
                  {allControlsList.map((c) => (
                    <label key={c.id} className="flex items-start gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted/50">
                      <Checkbox
                        checked={editQuestionLinkedControlIds.includes(c.id)}
                        onCheckedChange={(checked) => {
                          setEditQuestionLinkedControlIds((prev) =>
                            checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                          );
                        }}
                      />
                      <span className="text-sm text-foreground/90 line-clamp-2">{c.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => { setEditQuestion(null); setEditQuestionDraft(null); }}>
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={editQuestion?.id === "default-gov" || (editQuestion?.source === "manual" && !editQuestionDraft?.title.trim())}
              onClick={() => {
                if (editQuestionDraft && editQuestion) {
                  if (editQuestion.source === "manual" && editQuestion.id !== "default-gov") {
                    setManualQuestions((prev) =>
                      prev.map((q) =>
                        q.id === editQuestionDraft.id
                          ? {
                            id: editQuestionDraft.id,
                            title: editQuestionDraft.title,
                            description: editQuestionDraft.description,
                          }
                          : q
                      )
                    );
                  }
                  setLinkOverrides((prev) => {
                    const next = { ...prev };
                    if (editQuestionLinkedControlIds.length > 0) next[editQuestion.id] = editQuestionLinkedControlIds;
                    else delete next[editQuestion.id];
                    return next;
                  });
                  setEditQuestion(null);
                  setEditQuestionDraft(null);
                }
              }}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate with AI modal */}
      <Dialog open={showAddQuestion} onOpenChange={setShowAddQuestion}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate with AI</DialogTitle>
            <DialogDescription>
              Generate a custom audit or self-assessment question for this circular using AI. It will appear under Control Questions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
                Question
              </p>
              <Input
                placeholder="e.g. Has the board approved the updated policy?"
                value={newQuestionTitle}
                onChange={(e) => setNewQuestionTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
                Description (optional)
              </p>
              <Textarea
                placeholder="Additional context or scope for this question…"
                className="min-h-[80px] text-sm"
                value={newQuestionDescription}
                onChange={(e) => setNewQuestionDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">Linked controls</p>
              <p className="text-xs text-muted-foreground">Optionally link this question to controls.</p>
              <div className="max-h-40 overflow-y-auto rounded-md border border-border/60 p-2 space-y-1.5">
                {allControlsList.map((c) => (
                  <label key={c.id} className="flex items-start gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted/50">
                    <Checkbox
                      checked={addQuestionLinkedControlIds.includes(c.id)}
                      onCheckedChange={(checked) => {
                        setAddQuestionLinkedControlIds((prev) =>
                          checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                        );
                      }}
                    />
                    <span className="text-sm text-foreground/90 line-clamp-2">{c.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              type="button"
              className="text-muted-foreground"
              onClick={() => { setShowAddQuestion(false); setAddQuestionLinkedControlIds([]); }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!newQuestionTitle.trim()}
              onClick={() => {
                const newId = `manual-Q-${Date.now()}`;
                setManualQuestions((prev) => [
                  ...prev,
                  { id: newId, title: newQuestionTitle.trim(), description: newQuestionDescription.trim() || undefined },
                ]);
                if (addQuestionLinkedControlIds.length > 0) {
                  setLinkOverrides((prev) => ({ ...prev, [newId]: addQuestionLinkedControlIds }));
                }
                setShowAddQuestion(false);
                setNewQuestionTitle("");
                setNewQuestionDescription("");
                setAddQuestionLinkedControlIds([]);
              }}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewMode === "overview" && id && <ChangeAnalysisPanel circularId={id} />}

      {/* Enterprise Cross-Regulation Contradiction & Harmonization Modal */}
      <Dialog
        open={selectedContradictionObligation !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedContradictionObligation(null);
        }}
      >
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden rounded-xl border shadow-lg bg-background">
          {selectedContradictionObligation && (() => {
            const contra = getObligationContradiction(selectedContradictionObligation);
            const c = contra.contradiction;
            const isHarmonized = !!harmonizedObligations[selectedContradictionObligation.id];

            return (
              <div className="flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold text-rose-600 border-rose-200 bg-rose-50 rounded-sm">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {contra.severity || "HIGH"} Conflict
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">{selectedContradictionObligation.id}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {c ? c.title : selectedContradictionObligation.title}
                  </h2>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                  {c && (
                    <div className="rounded-md border overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 text-muted-foreground">
                          <tr>
                            <th className="font-medium px-4 py-2 border-b">Regulator</th>
                            <th className="font-medium px-4 py-2 border-b">Requirement</th>
                            <th className="font-medium px-4 py-2 border-b">Statutory SLA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {c.regulatorsInConflict.map((r) => (
                            <tr key={r.regulator} className="bg-background">
                              <td className="px-4 py-3 align-top w-1/4">
                                <span className="font-semibold">{r.regulator}</span>
                                <div className="text-[10px] text-muted-foreground mt-0.5">{r.clause}</div>
                              </td>
                              <td className="px-4 py-3 align-top text-muted-foreground w-1/2">
                                {r.requirement}
                              </td>
                              <td className="px-4 py-3 align-top w-1/4">
                                <span className="font-mono text-xs font-semibold">{r.timelineOrCondition}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Harmonization summary */}
                  {c && (
                    <div className="bg-muted/30 p-4 rounded-md border text-sm flex items-start gap-3">
                      <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-foreground mb-1">Harmonization Recommendation</p>
                        <p className="text-muted-foreground leading-relaxed">
                          Applying the strictest standard <span className="font-semibold text-foreground">({c.harmonizedRecommendation.strictestCommonDenominator})</span> will satisfy all conflicting jurisdictions. {c.harmonizedRecommendation.operationalRule}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-between">
                  {isHarmonized ? (
                    <span className="text-emerald-600 text-sm font-semibold flex items-center gap-1.5">
                      <Check className="h-4 w-4" />
                      Harmonized rule applied successfully
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Review requirements before applying.
                    </span>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedContradictionObligation(null)} className="cursor-pointer">
                      Cancel
                    </Button>
                    {!isHarmonized && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                        onClick={() => handleHarmonizeObligation(selectedContradictionObligation.id, selectedContradictionObligation.title)}
                      >
                        Apply Strictest Rule
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default CircularDetail;

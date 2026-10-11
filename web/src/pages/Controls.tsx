import type { AgentSchedule, ControlAnswerRun } from "@complianceos/shared";
import { SuggestionBar } from "@/components/SuggestionReview";
import { fetchControlAnswerAutomation, updateControlAnswerAutomation, runControlAnswerAutomation, fetchControlAnswerRun, type UpdateAutomationInput } from "@/lib/automation";
import { useState, useRef, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { pageContainer, pageItem } from "@/lib/animations";
import { DEMO_KNOWLEDGE_BASE, DEMO_OBLIGATIONS_PRELOADED, DEMO_GAPS } from "@/demo/complianceScenario";
import { RiskLevel, GapStatus } from "@/types/enums";
import { NBFC_IT_FRAMEWORK_10999_QUESTIONS } from "@/data/nbfcItFramework10999";
import { RBI_IT_GOV_12562_QUESTIONS } from "@/data/rbiItGovFramework12562";
import {
  SEBI_STOCK_BROKERS_QUESTIONS,
  SEBI_MUTUAL_FUNDS_QUESTIONS,
  SEBI_MII_GOVERNANCE_QUESTIONS,
} from "@/data/circularControlsAndQuestions";
import { ISO_27001_QUESTIONS } from "@/data/iso27001";
import { ISO_9001_QUESTIONS } from "@/data/iso9001";
import { 
  ArrowLeft, CheckCircle2, FileText, Search, BookOpen, ExternalLink, Activity, 
  ChevronRight, ChevronLeft, ListChecks, Loader2, Play, GitBranch,
  ArrowUpRight, Copy, Check, ShieldCheck, Sparkles, Download, Eye, X, AlertCircle, Plus
} from "lucide-react";
import { toast } from "sonner";
import type { Evidence } from "@complianceos/shared";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCirculars, type BackendCircular } from "@/lib/circulars";
import {
  fetchControls, updateControl, fetchControlObligations, fetchControlEvidence,
  addControlEvidence, setKnowledgeEntryControls, generateControlAnswer, generateAnswersForCircular, type BackendControl, type LinkedObligation,
} from "@/lib/controls";
import { fetchComplianceGaps, updateComplianceGap, createComplianceGap, type BackendComplianceGap } from "@/lib/complianceGaps";
import { fetchDocuments, fetchDocumentDownloadUrl } from "@/lib/documents";
import { downloadTextFile, slugify } from "@/lib/download";
import { fetchKnowledgeBaseEntries } from "@/lib/knowledgeBase";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { GenericDataTable } from "@/components/generic-data-table";
import { StatCard } from "@/components/stat-card";
import { type RowSelectionState } from "@tanstack/react-table";
import type { AppColumnDef } from "@/lib/table-features";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Specific controls where answer is not found and evidence is blank (Compliance Gaps)
const GAP_CONTROL_IDS = new Set(["Q-RBI-09", "Q-RBI-19", "Q-RBI-29"]);

export interface EvidenceDoc {
  id: string;
  title: string;
  section: string;
  type: string;
  size: string;
  lastUpdated: string;
  excerpt: string;
  documentId?: string | null;
}

const AVAILABLE_REPO_DOCS: EvidenceDoc[] = [
  {
    id: "doc-1",
    title: "Information Security Policy v4.1",
    section: "Section 18.2 — Incident Escalation & Response",
    type: "PDF",
    size: "2.4 MB",
    lastUpdated: "Aug 14, 2024",
    excerpt: "All high and critical severity incidents must be triaged within 15 minutes of detection and escalated to the Chief Information Security Officer (CISO) and the Board IT Strategy Committee within 2 hours. Mandatory automated logging is maintained on immutable WORM storage."
  },
  {
    id: "doc-2",
    title: "Board Resolution #BR-2024-IT",
    section: "Resolution Item 4 — Annual IT Risk Governance",
    type: "PDF",
    size: "1.1 MB",
    lastUpdated: "Mar 12, 2024",
    excerpt: "Resolved that the revised NBFC IT Framework gap remediation plan submitted by the CIO is hereby approved without modification, and quarterly closure audits shall be submitted directly to the Audit Committee of the Board."
  },
  {
    id: "doc-3",
    title: "IT Risk Management & Cyber Security Policy 2025",
    section: "Chapter III, Section 2 — Risk Assessment & Treatment",
    type: "PDF",
    size: "3.1 MB",
    lastUpdated: "Feb 08, 2025",
    excerpt: "The Risk Management Committee shall periodically assess cyber risks, vendor dependencies, and enforce automated patch management protocols across all production systems."
  },
  {
    id: "doc-4",
    title: "Business Continuity & Disaster Recovery Plan v3.2",
    section: "Chapter VI — BCP/DR Testing & Failover Drills",
    type: "PDF",
    size: "1.8 MB",
    lastUpdated: "Nov 20, 2024",
    excerpt: "Annual simulated DR drill conducted with zero data loss (RPO < 15 mins, RTO < 2 hours) verified by external IS auditor."
  },
  {
    id: "doc-5",
    title: "Outsourcing Due Diligence & SLA Framework 2024",
    section: "Chapter V — Third-Party Vendor Risk",
    type: "PDF",
    size: "1.2 MB",
    lastUpdated: "Dec 04, 2024",
    excerpt: "All third-party cloud service providers and critical IT vendors must maintain ISO/IEC 27001 or SOC 2 Type II certifications and comply with RBI audit rights."
  },
  {
    id: "doc-6",
    title: "User Access Management & PKI Architecture Guide",
    section: "Chapter II, Section 9 — Multi-Factor Authentication & Cryptography",
    type: "PDF",
    size: "950 KB",
    lastUpdated: "Jan 28, 2025",
    excerpt: "Hardware token MFA enforced on all administrative access; PKI-backed digital signatures mandatory for all high-value transaction workflows."
  }
];

const AVAILABLE_KB_ENTRIES = [
  ...DEMO_KNOWLEDGE_BASE,
  {
    id: "KB-RBI-AUDIT",
    question: "How are internal and external IS audit recommendations tracked to closure?",
    answer: "IS Audit findings are logged in the Governance GRC registry and reviewed bi-weekly by the IT Strategy Committee. High-severity audit observations require documented remediation within 30 days.",
    sourceType: "internal" as const,
    sourceAssessment: "FY2025 Semi-Annual IS Audit Review",
    tags: ["Assurance", "RBI/MD/nbfc/211"],
    status: "verified",
    dateAdded: "Feb 10, 2025"
  },
  {
    id: "KB-RBI-PATCH",
    question: "What is the vulnerability patching SLA for critical and zero-day threats?",
    answer: "Critical zero-day vulnerabilities in Internet-facing perimeter assets require hotfix deployment within 24 hours of vendor patch release, backed by sandbox regression testing.",
    sourceType: "internal" as const,
    sourceAssessment: "Cyber Resilience Framework Audit",
    tags: ["Security", "RBI/MD/nbfc/211"],
    status: "verified",
    dateAdded: "Jan 22, 2025"
  }
];

interface SubControl { id: string; title: string; code?: string | null }
interface ParentControl {
  id: string;
  name: string;
  circularId: string;
  description: string;
  category: string;
  questions: SubControl[];
}
interface KbOption {
  id: string;
  question: string;
  answer: string;
  sourceAssessment: string;
  dateAdded: string;
  controlIds?: string[];
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—";
}
function evidenceToDoc(e: Evidence): EvidenceDoc {
  return {
    id: e.id,
    title: e.name,
    section: e.section ?? "",
    type: e.documentType ?? "FILE",
    size: formatSize(e.size),
    lastUpdated: formatDate(e.updatedAt),
    excerpt: e.excerpt ?? "",
    documentId: e.documentId ?? null,
  };
}

// Parent controls (Master Directions & Regulatory Frameworks)
const PARENT_CONTROLS: ParentControl[] = [
  {
    id: "211",
    name: "Master Direction - Information Technology Framework for the NBFC Sector",
    circularId: "RBI/MD/nbfc/211",
    description: "Core IT framework for NBFCs mandating governance, security, and operations controls.",
    category: "Non-Banking / IT Framework",
    questions: NBFC_IT_FRAMEWORK_10999_QUESTIONS,
  },
  {
    id: "12562",
    name: "Master Direction on Information Technology Governance, Risk, Controls and Assurance Practices",
    circularId: "RBI/MD/cb/12562",
    description: "Comprehensive IT governance, cybersecurity resilience, and assurance standards for Commercial Banks.",
    category: "Commercial Banking / IT Governance",
    questions: RBI_IT_GOV_12562_QUESTIONS,
  },
  {
    id: "sebi-1",
    name: "SEBI Master Circular for Stock Brokers",
    circularId: "SEBI/MC/MRD/2024/01",
    description: "Mandated operational risk controls, client collateral segregation, and CSCRF cyber resilience for stock brokers.",
    category: "Securities / Stock Brokers",
    questions: SEBI_STOCK_BROKERS_QUESTIONS,
  },
  {
    id: "sebi-2",
    name: "SEBI Master Circular for Mutual Funds",
    circularId: "SEBI/MC/IMD/2024/02",
    description: "Valuation governance, dealing room surveillance, and liquidity stress testing protocols for Asset Management Companies.",
    category: "Asset Management / Mutual Funds",
    questions: SEBI_MUTUAL_FUNDS_QUESTIONS,
  },
  {
    id: "sebi-3",
    name: "SEBI Master Circular for Market Infrastructure Institutions (MIIs)",
    circularId: "SEBI/MC/MRD/2024/03",
    description: "Governance, settlement guarantee fund stress testing, and disaster recovery site live switchovers for MIIs.",
    category: "Market Infrastructure / MIIs",
    questions: SEBI_MII_GOVERNANCE_QUESTIONS,
  },
  {
    id: "fw-iso27001",
    name: "ISO/IEC 27001:2022 Information Security Management System",
    circularId: "ISO/IEC 27001:2022",
    description: "International standard for information security risk management, access control, and incident handling.",
    category: "Global Standards / InfoSec",
    questions: ISO_27001_QUESTIONS,
  },
  {
    id: "fw-iso9001",
    name: "ISO 9001:2015 Quality Management Systems",
    circularId: "ISO 9001:2015",
    description: "Quality management principles covering leadership, continuous improvement, and operational control.",
    category: "Global Standards / Quality",
    questions: ISO_9001_QUESTIONS,
  },
];

const INTERVAL_OPTIONS: { label: string; hours: number }[] = [
  { label: "Every 1h", hours: 1 },
  { label: "Every 6h", hours: 6 },
  { label: "Every 12h", hours: 12 },
  { label: "Every 24h", hours: 24 },
  { label: "Weekly", hours: 168 },
];
const DEMO_STAGES: { key: string; title: string }[] = [
  { key: "collect", title: "Collect controls" },
  { key: "evidence", title: "Gather evidence & KB" },
  { key: "draft", title: "Draft answers" },
  { key: "verify", title: "Verify citations" },
];

function fmtAbs(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Never";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  return d.toLocaleString();
}
function fmtNext(iso: string | null | undefined): string {
  if (!iso) return "Not scheduled";
  const ms = new Date(iso).getTime() - Date.now();
  if (isNaN(ms)) return "Not scheduled";
  if (ms <= 0) return "due now";
  const m = Math.ceil(ms / 60000);
  return `in ${Math.floor(m / 60)}h ${m % 60}m`;
}

interface AgentPanelProps {
  isDemo: boolean;
  demoQuestions: { id: string; title: string }[];
  demoAnswers: Record<string, string>;
  onDemoFill: (answers: Record<string, string>) => void;
  onReloadControls: () => Promise<void>;
}

function AutonomousAnswerPanel({ isDemo, demoQuestions, demoAnswers, onDemoFill, onReloadControls }: AgentPanelProps) {
  const [schedule, setSchedule] = useState<AgentSchedule | null>(null);
  const [run, setRun] = useState<ControlAnswerRun | null>(null);
  const [, setTick] = useState(0);
  // demo local state
  const [dEnabled, setDEnabled] = useState(true);
  const [dInterval, setDInterval] = useState(24);
  const [dOnlyEmpty, setDOnlyEmpty] = useState(true);
  const [dLast, setDLast] = useState<string | null>(null);
  const [dRunning, setDRunning] = useState(false);
  const [dStageIdx, setDStageIdx] = useState(-1);
  const [dResult, setDResult] = useState<{ generated: number; skipped: number; failed: number } | null>(null);
  const runIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reloadRef = useRef(onReloadControls);
  useEffect(() => { reloadRef.current = onReloadControls; });
  const prevRunningRef = useRef(false);
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const loadState = (): Promise<void> =>
    fetchControlAnswerAutomation()
      .then((s) => {
        setSchedule(s.schedule);
        setRun(s.latestRun);
        const running = s.latestRun?.status === "RUNNING";
        if (prevRunningRef.current && !running) void reloadRef.current();
        prevRunningRef.current = running;
      })
      .catch(() => { /* keep previous state */ });

  useEffect(() => {
    if (isDemo) return;
    void loadState();
    const t = setInterval(() => { if (!pollRef.current) void loadState(); }, 30000);
    return () => { clearInterval(t); stopPoll(); };
  }, [isDemo]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => { clearInterval(t); if (demoTimer.current) clearInterval(demoTimer.current); };
  }, []);

  const handleErr = (err: unknown, fallback: string) => {
    const msg = err instanceof Error ? err.message : fallback;
    if (msg.includes("403")) toast.error("You do not have permission to change automation (Admin/Editor only).");
    else if (msg.includes("409")) toast.info("A run is already in progress.");
    else toast.error(fallback);
  };

  const save = async (body: UpdateAutomationInput) => {
    try { setSchedule(await updateControlAnswerAutomation(body)); }
    catch (err) { handleErr(err, "Failed to update automation."); }
  };

  const running = isDemo ? dRunning : run?.status === "RUNNING";
  const enabled = isDemo ? dEnabled : schedule?.enabled ?? false;
  const intervalHours = isDemo ? dInterval : schedule?.intervalHours ?? 24;
  const onlyEmpty = isDemo ? dOnlyEmpty : schedule?.config?.onlyEmpty ?? true;
  const lastRunAt = isDemo ? dLast : schedule?.lastRunAt ?? run?.finishedAt ?? null;
  const nextRunAt = isDemo
    ? (dEnabled && dLast ? new Date(new Date(dLast).getTime() + dInterval * 3600000).toISOString() : null)
    : enabled ? schedule?.nextRunAt ?? null : null;

  const pollRun = (id: string) => {
    stopPoll();
    runIdRef.current = id;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetchControlAnswerRun(id);
        setRun(r);
        if (r.status !== "RUNNING") {
          stopPoll();
          prevRunningRef.current = false;
          await loadState();
          await reloadRef.current();
          if (r.status === "COMPLETED") toast.success(`Run complete: ${r.generated} answered, ${r.skipped} skipped, ${r.failed} failed.`);
          else toast.error(`Run failed${r.error ? `: ${r.error}` : "."}`);
        }
      } catch { /* retry next tick */ }
    }, 1500);
  };

  const runNow = async () => {
    if (running) return;
    if (!isDemo) {
      try {
        const r = await runControlAnswerAutomation();
        setRun(r);
        prevRunningRef.current = true;
        pollRun(r.id);
      } catch (err) { handleErr(err, "Failed to start run."); }
      return;
    }
    setDRunning(true);
    setDResult(null);
    setDStageIdx(0);
    let idx = 0;
    demoTimer.current = setInterval(() => {
      idx += 1;
      if (idx < DEMO_STAGES.length) { setDStageIdx(idx); return; }
      if (demoTimer.current) clearInterval(demoTimer.current);
      const targets = demoQuestions.filter((q) => dOnlyEmpty ? !demoAnswers[q.id] : true);
      const filled: Record<string, string> = {};
      for (const q of targets) {
        filled[q.id] = GAP_CONTROL_IDS.has(q.id)
          ? `[COMPLIANCE GAP IDENTIFIED]\n\nNo documented internal control procedures or active operational evidence were detected in the policy repository for "${q.title}". Flagged for manual policy drafting and Board remediation.`
          : `The organization has formally instituted verified internal controls for "${q.title}". Mapped directly to Master Direction standards with active technical safeguards and audit log retention.`;
      }
      onDemoFill(filled);
      const generated = targets.length;
      setDResult({ generated, skipped: demoQuestions.length - generated, failed: 0 });
      setDLast(new Date().toISOString());
      setDStageIdx(DEMO_STAGES.length);
      setDRunning(false);
      toast.success(`Run complete: ${generated} answered.`);
    }, 1400);
  };

  const stages: { key: string; title: string; status: string; detail?: string }[] = isDemo
    ? DEMO_STAGES.map((s, i) => ({ ...s, status: dStageIdx < 0 ? "pending" : i < dStageIdx ? "done" : i === dStageIdx ? "running" : "pending" }))
    : (run?.stages as { key: string; title: string; status: string; detail?: string }[] | undefined) ?? [];
  const done = stages.filter((s) => s.status === "done").length;
  const activeStage = stages.find((s) => s.status === "running");

  let title = "No runs yet";
  let desc = "Enable the schedule or run the agent to answer control questions automatically.";
  if (running) {
    title = "Running…";
    desc = activeStage ? `${activeStage.title}${activeStage.detail ? ` — ${activeStage.detail}` : ""}` : "Answering controls…";
  } else if (isDemo && dResult) {
    title = `Run complete — ${dResult.generated} answered, ${dResult.skipped} skipped, ${dResult.failed} failed`;
    desc = `Next run: ${fmtNext(nextRunAt)}.`;
  } else if (!isDemo && run) {
    if (run.status === "FAILED") { title = `Last run failed: ${run.error ?? "unknown error"}`; desc = `Started ${fmtAbs(run.startedAt)}.`; }
    else { title = `Run complete — ${run.generated} answered, ${run.skipped} skipped, ${run.failed} failed`; desc = `${run.trigger === "SCHEDULED" ? "Scheduled" : "Manual"} run of ${run.controlsTotal} controls. Next run: ${fmtNext(nextRunAt)}.`; }
  }

  const selectCls = "h-7 rounded-md border border-blue-200/80 bg-transparent px-2 text-xs dark:border-blue-500/30 disabled:opacity-50";

  return (
    <motion.div
      variants={pageItem}
      className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border bg-blue-50/70 text-blue-900 border-blue-200/80 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25"
    >
      <div className="flex items-start gap-3.5">
        <div className="flex items-center justify-center p-2.5 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
          {running ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
        </div>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-100/90 dark:bg-blue-500/25 text-blue-800 dark:text-blue-200 border border-blue-300/70 dark:border-blue-500/40">
              Autonomous Answering Agent
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">Last run: {fmtAbs(lastRunAt)}</span>
            <span className="font-mono text-[11px] text-muted-foreground">Next run: {fmtNext(nextRunAt)}</span>
          </div>
          <h3 className="text-sm font-bold text-blue-950 dark:text-blue-200">{title}</h3>
          <p className="text-xs text-blue-800/80 dark:text-blue-300/80">{desc}</p>
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={enabled} disabled={running}
                onChange={(e) => isDemo ? setDEnabled(e.target.checked) : void save({ enabled: e.target.checked })} />
              Enabled
            </label>
            <select className={selectCls} value={intervalHours} disabled={running}
              onChange={(e) => { const h = Number(e.target.value); if (isDemo) setDInterval(h); else void save({ intervalHours: h }); }}>
              {INTERVAL_OPTIONS.map((o) => <option key={o.hours} value={o.hours}>{o.label}</option>)}
            </select>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!onlyEmpty} disabled={running}
                onChange={(e) => isDemo ? setDOnlyEmpty(!e.target.checked) : void save({ config: { ...(schedule?.config ?? {}), onlyEmpty: !e.target.checked } })} />
              Also refresh existing answers
            </label>
            <span className="text-muted-foreground">
              Scope: {onlyEmpty ? "All controls without an answer" : "All controls (including existing answers)"}
            </span>
          </div>
          {stages.length > 0 && (
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
              {stages.map((s) => (
                <li key={s.key} className="flex items-center gap-1 text-[11px] font-mono">
                  {s.status === "done" ? <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    : s.status === "running" ? <Loader2 className="h-3 w-3 animate-spin" />
                    : s.status === "failed" ? <AlertCircle className="h-3 w-3 text-destructive" />
                    : <span className="h-2 w-2 rounded-full bg-blue-300/70" />}
                  {s.title}
                </li>
              ))}
            </ul>
          )}
          <div className="text-[10px] font-mono font-medium text-blue-700/80 dark:text-blue-300/80">
            {done}/{stages.length || DEMO_STAGES.length} stages verified · {enabled ? `${intervalHours}h cadence` : "schedule off"}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
        <Button variant="outline" size="sm" onClick={runNow} disabled={running}
          className="h-8 text-xs font-medium border-blue-200/80 hover:bg-blue-100/60 dark:border-blue-500/30 dark:hover:bg-blue-500/20 shadow-none">
          {running ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
          {running ? "Running…" : "Run now"}
        </Button>
      </div>
    </motion.div>
  );
}

export default function Controls() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isDemo } = useAuth();
  const parentIdParam = searchParams.get("parentId");
  const subControlIdParam = searchParams.get("subId");
  
  const [selectedParentId, setSelectedParentId] = useState<string | null>(parentIdParam || null);
  const [selectedSubControlId, setSelectedSubControlId] = useState<string | null>(subControlIdParam || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<"ALL" | "COMPLETED" | "GAP" | "NOT_STARTED">("ALL");
  const [userGapIds, setUserGapIds] = useState<Set<string>>(new Set());
  const [isMarkingGap, setIsMarkingGap] = useState(false);
  const [openRowSelection, setOpenRowSelection] = useState<RowSelectionState>({});
  const [controlAnswers, setControlAnswers] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("controls");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedOblId, setCopiedOblId] = useState<string | null>(null);
  const [generatedControls, setGeneratedControls] = useState<Set<string>>(new Set());
  const [resolvedGaps, setResolvedGaps] = useState<Set<string>>(new Set());
  const [customDocsByControl, setCustomDocsByControl] = useState<Record<string, EvidenceDoc[]>>({});
  const [customKbByControl, setCustomKbByControl] = useState<Record<string, { answer: string; sourceAssessment: string }>>({});
  const [previewDoc, setPreviewDoc] = useState<{ title: string; section: string; type: string; size: string; excerpt: string; lastUpdated: string; documentId?: string | null } | null>(null);
  const [isGeneratingAnswers, setIsGeneratingAnswers] = useState(false);
  const [copiedKbIdx, setCopiedKbIdx] = useState<number | null>(null);

  // Add Evidence Modal State
  const [isAddEvidenceOpen, setIsAddEvidenceOpen] = useState(false);
  const [addEvidenceType, setAddEvidenceType] = useState<"document" | "knowledge_base">("document");
  const [selectedDocId, setSelectedDocId] = useState<string>("doc-1");
  const [selectedKbId, setSelectedKbId] = useState<string>(AVAILABLE_KB_ENTRIES[0]?.id || "REC-05");
  const [evidenceSearchQuery, setEvidenceSearchQuery] = useState("");
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Real-mode backend data
  const [circulars, setCirculars] = useState<BackendCircular[]>([]);
  const [controls, setControls] = useState<BackendControl[]>([]);
  const [gaps, setGaps] = useState<BackendComplianceGap[]>([]);
  const [realDocs, setRealDocs] = useState<EvidenceDoc[]>([]);
  const [realKb, setRealKb] = useState<KbOption[]>([]);
  const [obligationsByControl, setObligationsByControl] = useState<Record<string, LinkedObligation[]>>({});
  const [isLoading, setIsLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    Promise.all([
      fetchCirculars(),
      fetchControls(),
      fetchComplianceGaps().catch(() => [] as BackendComplianceGap[]),
      fetchDocuments().catch(() => []),
      fetchKnowledgeBaseEntries().catch(() => []),
    ])
      .then(([circ, ctl, gp, docs, kb]) => {
        if (cancelled) return;
        setCirculars(circ);
        setControls(ctl);
        setGaps(gp);
        setRealDocs(docs.map((d) => ({
          id: d.id,
          title: d.name,
          section: d.description ?? "",
          type: d.type ?? "DOC",
          size: formatSize(d.size),
          lastUpdated: formatDate(d.updatedAt),
          excerpt: d.description ?? "",
        })));
        setRealKb(kb.map((k) => ({
          id: k.id,
          question: k.question,
          answer: k.answer,
          sourceAssessment: k.sourceAssessment ?? "Knowledge Base",
          dateAdded: formatDate(k.createdAt),
          controlIds: k.controlIds,
        })));
        setControlAnswers(Object.fromEntries(ctl.filter((c) => c.answer).map((c) => [c.id, c.answer as string])));
        setLoadError(null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load controls");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [isDemo]);

  // Load obligations + evidence for the selected control
  useEffect(() => {
    if (isDemo || !selectedSubControlId) return;
    let cancelled = false;
    const id = selectedSubControlId;
    fetchControlObligations(id)
      .then((rows) => { if (!cancelled) setObligationsByControl((p) => ({ ...p, [id]: rows })); })
      .catch(() => { if (!cancelled) setObligationsByControl((p) => ({ ...p, [id]: [] })); });
    fetchControlEvidence(id)
      .then((rows) => { if (!cancelled) setCustomDocsByControl((p) => ({ ...p, [id]: rows.map(evidenceToDoc) })); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isDemo, selectedSubControlId]);

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    };
  }, []);
  
  const parents: ParentControl[] = isDemo
    ? PARENT_CONTROLS
    : circulars
        .map((c) => ({
          id: c.id,
          name: c.name,
          circularId: c.circularId,
          description: c.description ?? "",
          category: c.category,
          questions: controls
            .filter((k) => k.circularId === c.id)
            .map((k) => ({ id: k.id, title: k.title, code: k.code })),
        }))
        .filter((p) => p.questions.length > 0);

  // Controls flagged as gaps: demo constants + user marked, or open backend gaps / COMPLIANCE_GAP controls
  const gapIds: Set<string> = useMemo(() => {
    return isDemo
      ? new Set([...GAP_CONTROL_IDS, ...userGapIds])
      : new Set([
          ...gaps.filter((g) => g.controlId && g.status !== "RESOLVED").map((g) => g.controlId as string),
          ...controls.filter((k) => k.status === "COMPLIANCE_GAP").map((k) => k.id),
          ...userGapIds,
        ]);
  }, [isDemo, gaps, controls, userGapIds]);

  const activeParent = parents.find((p) => p.id === selectedParentId);
  const activeSubControl = activeParent?.questions.find((q) => q.id === selectedSubControlId);

  const activeSubControlId = activeSubControl?.id;

  const isCurrentControlGap = activeSubControl ? (gapIds.has(activeSubControl.id) && !resolvedGaps.has(activeSubControl.id)) : false;
  const isCurrentGap = isCurrentControlGap;
  const isCurrentGenerated = activeSubControl ? (generatedControls.has(activeSubControl.id) || (controlAnswers[activeSubControl.id] !== undefined && controlAnswers[activeSubControl.id].trim().length > 0)) : false;

  type SubControlStage = "COMPLETED" | "GAP" | "NOT_STARTED";

  const getSubControlStage = (qId: string): SubControlStage => {
    const isExplicitUserGap = userGapIds.has(qId);
    const isPredefinedGap = gapIds.has(qId) && !resolvedGaps.has(qId);
    const hasActiveGap = isExplicitUserGap || (isPredefinedGap && (isDemo ? (generatedControls.size > 0 || Object.keys(controlAnswers).length > 0) : true));
    const isActivelyTyping = isGenerating && activeSubControlId === qId;
    const hasAnswer = (controlAnswers[qId] !== undefined && controlAnswers[qId].trim().length > 0) || generatedControls.has(qId);
    const hasDocs = Boolean(customDocsByControl[qId] && customDocsByControl[qId].length > 0);
    const hasKb = customKbByControl[qId] !== undefined;

    // Check backend control if in real mode
    const backendCtrl = !isDemo ? controls.find((c) => c.id === qId) : null;
    const backendHasAnswer = Boolean(backendCtrl?.answer && backendCtrl.answer.trim().length > 0);
    const isBackendImplemented = backendCtrl?.implementationStatus === "IMPLEMENTED";
    const isBackendGap = backendCtrl?.status === "COMPLIANCE_GAP";

    if (hasActiveGap || isBackendGap) {
      return "GAP";
    }

    if (hasAnswer || backendHasAnswer || isBackendImplemented) {
      return "COMPLETED";
    }

    if (isActivelyTyping) {
      return "GAP";
    }

    if (hasDocs || hasKb) {
      return "COMPLETED";
    }

    return "NOT_STARTED";
  };

  const stageCounts = (() => {
    if (!activeParent) return { completed: 0, gap: 0, notStarted: 0, total: 0 };
    let completed = 0;
    let gap = 0;
    let notStarted = 0;

    for (const q of activeParent.questions) {
      const stage = getSubControlStage(q.id);
      if (stage === "COMPLETED") completed++;
      else if (stage === "GAP") gap++;
      else notStarted++;
    }

    return {
      completed,
      gap,
      notStarted,
      total: activeParent.questions.length,
    };
  })();

  const totalCount = stageCounts.total;
  const progressPercent = totalCount > 0 ? Math.round((stageCounts.completed / totalCount) * 100) : 0;
  const completedPercent = totalCount > 0 ? (stageCounts.completed / totalCount) * 100 : 0;
  const gapPercent = totalCount > 0 ? (stageCounts.gap / totalCount) * 100 : 0;
  const notStartedPercent = totalCount > 0 ? (stageCounts.notStarted / totalCount) * 100 : 0;

  const filteredQuestions = (() => {
    if (!activeParent) return [];
    return activeParent.questions.filter((q) => {
      const matchesSearch =
        q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.id.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (stageFilter === "ALL") return true;
      return getSubControlStage(q.id) === stageFilter;
    });
  })();

  const handleMarkAsGap = async () => {
    if (!activeSubControl || isMarkingGap) return;
    const controlId = activeSubControl.id;

    if (isCurrentControlGap) {
      navigate("/gaps");
      return;
    }

    setIsMarkingGap(true);
    try {
      if (isDemo) {
        setUserGapIds((prev) => new Set([...prev, controlId]));
        setResolvedGaps((prev) => {
          const next = new Set(prev);
          next.delete(controlId);
          return next;
        });

        // Add to DEMO_GAPS so it is immediately visible in /gaps
        const newGapId = `GAP-${String(DEMO_GAPS.length + 1).padStart(3, "0")}`;
        const existingIdx = DEMO_GAPS.findIndex((g) => (g as (typeof DEMO_GAPS)[number] & { controlId?: string }).controlId === controlId);
        if (existingIdx === -1) {
          DEMO_GAPS.unshift({
            id: newGapId,
            title: `${activeSubControl.title} (${activeSubControl.code ?? activeSubControl.id})`,
            question: activeSubControl.title,
            assessment: activeParent?.name || "Regulatory Assessment",
            section: activeParent?.category || "Compliance Controls",
            riskLevel: RiskLevel.HIGH,
            status: GapStatus.OPEN,
            assignee: { id: "u1", name: "Asha Rao", role: "Auditor", email: "asha@example.com" },
            assigneeInitials: "AR",
            openedDaysAgo: 0,
            evidenceNeeded: `Documented operational evidence and policy enforcement for ${activeSubControl.code ?? activeSubControl.id}.`,
            organizationId: "org1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        if (!controlAnswers[controlId] || controlAnswers[controlId].trim().length === 0) {
          setControlAnswers((prev) => ({
            ...prev,
            [controlId]: `[COMPLIANCE GAP IDENTIFIED]\n\nNo documented internal control procedures or active operational evidence were identified in the organization's policy repository for "${activeSubControl.title}".\n\n• Finding: Critical safeguard is uncorroborated under statutory compliance standards.\n• Risk Impact: Elevated vulnerability due to lack of formal baseline governance.\n• Recommendation: Formulate technical policy, obtain IT Strategy Committee sign-off, and establish audit logging.`,
          }));
        }

        toast.success(`Control ${activeSubControl.code ?? activeSubControl.id} marked as Gap and added to Gaps`, {
          action: {
            label: "View in Gaps",
            onClick: () => navigate("/gaps"),
          },
        });
      } else {
        const createdGap = await createComplianceGap({
          title: `${activeSubControl.title} (${activeSubControl.code ?? activeSubControl.id})`,
          description: controlAnswers[controlId] || `Compliance deficiency detected for ${activeSubControl.title}`,
          riskLevel: "HIGH",
          controlId,
          section: activeParent?.category || "IT Controls",
          engagementName: activeParent?.name || "Regulatory Assessment",
          evidenceNeeded: `Documented operational evidence for ${activeSubControl.code ?? activeSubControl.id}`,
        });

        setUserGapIds((prev) => new Set([...prev, controlId]));
        setGaps((prev) => [createdGap, ...prev]);

        try {
          const updated = await updateControl(controlId, { status: "COMPLIANCE_GAP" });
          setControls((prev) => prev.map((c) => (c.id === controlId ? updated : c)));
        } catch {
          // Best-effort status sync; the gap itself was already created.
        }

        toast.success(`Control ${activeSubControl.code ?? activeSubControl.id} marked as Gap and added to Gaps`, {
          action: {
            label: "View in Gaps",
            onClick: () => navigate("/gaps"),
          },
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark control as gap.");
    } finally {
      setIsMarkingGap(false);
    }
  };

  const availableDocs: EvidenceDoc[] = isDemo ? AVAILABLE_REPO_DOCS : realDocs;
  const availableKb: KbOption[] = isDemo ? AVAILABLE_KB_ENTRIES : realKb;

  const handleSelectParent = (id: string) => {
    setSelectedParentId(id);
    setStageFilter("ALL");
    const parent = parents.find(p => p.id === id);
    if (parent && parent.questions.length > 0) {
      setSelectedSubControlId(parent.questions[0].id);
      setSearchParams({ parentId: id, subId: parent.questions[0].id });
    } else {
      setSelectedSubControlId(null);
      setSearchParams({ parentId: id });
    }
    setSearchQuery("");
  };

  const handleSelectSubControl = (id: string) => {
    setSelectedSubControlId(id);
    if (selectedParentId) {
      setSearchParams({ parentId: selectedParentId, subId: id });
    }
  };

  const handleBack = () => {
    setSelectedParentId(null);
    setSelectedSubControlId(null);
    setStageFilter("ALL");
    setSearchParams({});
    setSearchQuery("");
  };
  
  if (!isDemo && (isLoading || loadError)) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-sm text-muted-foreground">
        {isLoading ? (
          <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading controls...</span>
        ) : (
          <span className="text-destructive">Failed to load controls: {loadError}</span>
        )}
      </div>
    );
  }

  if (!selectedParentId) {
    // Level 1: Main Page
    
    const columns: AppColumnDef<ParentControl>[] = [
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
        header: "Framework ID",
        cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.circularId}</span>,
      },
      {
        accessorKey: "name",
        header: "Framework Name",
        cell: ({ row }) => (
          <div className="flex items-start gap-2.5">
            <div>
              <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">
                {row.original.name}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{row.original.description}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <Badge variant="outline" className="bg-background">
            {row.original.category}
          </Badge>
        ),
      },
      {
        id: "questionsCount",
        header: () => <div className="text-right pr-4">Questions</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2 pr-4">
            <span className="text-xs font-medium">
              {row.original.questions.length}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>
        ),
      },
    ];
    
    return (
      <motion.div
        variants={pageContainer}
        initial="hidden"
        animate="show"
        className="flex-1 overflow-auto p-4 md:p-6 space-y-6 min-w-0"
      >
        <motion.div variants={pageItem} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Controls Framework</h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
              Select a Master Direction to view its internal controls and assessment questions.
            </p>
          </div>
        </motion.div>

        <AutonomousAnswerPanel
          isDemo={isDemo}
          demoQuestions={parents.flatMap((p) => p.questions.map((q) => ({ id: q.id, title: q.title })))}
          demoAnswers={controlAnswers}
          onDemoFill={(a) => {
            setControlAnswers((prev) => ({ ...prev, ...a }));
            setGeneratedControls((prev) => new Set([...prev, ...Object.keys(a)]));
          }}
          onReloadControls={async () => {
            const ctl = await fetchControls();
            setControls(ctl);
            setControlAnswers(Object.fromEntries(ctl.filter((c) => c.answer).map((c) => [c.id, c.answer as string])));
          }}
        />
        
        <motion.div variants={pageItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
              title="Total Frameworks"
              value={parents.length}
              trend="up"
              trendValue="100%"
              trendLabel="Active Frameworks"
              description="Frameworks in tracking"
              badgeClassName="bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
          />
          <StatCard
              title="Total Controls"
              value={parents.reduce((acc, p) => acc + p.questions.length, 0)}
              trend="up"
              trendValue="Active"
              trendLabel="Questions mapped"
              description="Assessment questions across frameworks"
              badgeClassName="bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
          />
          <StatCard
              title="Fully Implemented"
              value={isDemo ? 0 : controls.filter((k) => k.implementationStatus === "IMPLEMENTED").length}
              trend="down"
              trendValue="Needs Review"
              trendLabel="In progress"
              description="Controls successfully implemented"
              badgeClassName="bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
          />
          <StatCard
              title="Critical Gaps"
              value={isDemo ? 0 : gapIds.size}
              trend="down"
              trendValue="Monitoring"
              trendLabel="All clear"
              description="Critical control gaps"
              badgeClassName="bg-green-50 text-green-700 border-green-100 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20"
          />
        </motion.div>

        <motion.div variants={pageItem}>
          <Tabs defaultValue="frameworks" className="space-y-4">
            <TabsList className="h-auto w-full sm:w-fit justify-start overflow-x-auto rounded-lg bg-muted p-1 flex flex-nowrap [&::-webkit-scrollbar]:hidden border border-border/50">
              <TabsTrigger value="frameworks" className="flex-1 sm:flex-none min-w-max sm:min-w-0 rounded-md gap-2 text-[11px] sm:text-xs font-semibold py-2 px-3 sm:px-4">
                <ListChecks className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">Frameworks</span>
                <span className="ml-1 flex h-5 min-w-5 px-2 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
                    {parents.length}
                </span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="frameworks" className="mt-0">
              <GenericDataTable
                  columns={columns}
                  data={parents}
                  searchKey="name"
                  searchPlaceholder="Search frameworks..."
                  onRowClick={(data) => handleSelectParent(data.id)}
                  rowSelection={openRowSelection}
                  onRowSelectionChange={setOpenRowSelection}
              />
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    );
  }

  // Level 2: Detailed View (Master-Detail)
  const currentIndex = activeParent ? activeParent.questions.findIndex(q => q.id === selectedSubControlId) : -1;
  const prevControl = currentIndex > 0 && activeParent ? activeParent.questions[currentIndex - 1] : null;
  const nextControl = activeParent && currentIndex >= 0 && currentIndex < activeParent.questions.length - 1 ? activeParent.questions[currentIndex + 1] : null;

  const handleNext = () => {
    if (nextControl) handleSelectSubControl(nextControl.id);
  };

  const handlePrev = () => {
    if (prevControl) handleSelectSubControl(prevControl.id);
  };

  const handleCopyObligation = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOblId(id);
    toast.success("Regulatory obligation copied to clipboard.");
    setTimeout(() => setCopiedOblId(null), 2000);
  };

  const handleCopyKbAnswer = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKbIdx(idx);
    toast.success("Evidence answer copied to clipboard.");
    setTimeout(() => setCopiedKbIdx(null), 2000);
  };

  const handleGenerate = () => {
    if (!activeParent || !activeSubControl || isGenerating) return;
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    
    setIsGenerating(true);
    const subId = activeSubControl.id;
    const allQuestions = activeParent.questions;
    const totalQ = allQuestions.length;
    
    // Construct rich, realistic compliance assessment answer for active control (or gap answer)
    const isCurrentGap = GAP_CONTROL_IDS.has(subId);
    const targetText = isCurrentGap
      ? `[COMPLIANCE GAP IDENTIFIED]\n\nNo documented internal control procedures or operational evidence were identified in the organization's policy repository for "${activeSubControl.title}".\n\n• Finding: Critical safeguard is uncorroborated under RBI Master Direction requirements.\n• Risk Impact: Elevated vulnerability due to lack of formal baseline governance.\n• Recommendation: Formulate technical policy, obtain IT Strategy Committee sign-off, and establish audit logging.`
      : `The organization has formally instituted internal control procedures for "${activeSubControl.title}".\n\n• Governance & Oversight: Approved by the IT Strategy Committee and reviewed by the Board annually.\n• Operational Execution: Workflows enforce role-based access, maker-checker segregation, and continuous audit trails.\n• Assurance: Evidence is fully documented and corroborated with RBI Master Direction specifications. Last audit review confirmed zero high-severity exceptions.`;
    
    // Reset active answer to start typing
    setControlAnswers(prev => ({ ...prev, [subId]: "" }));

    let charIdx = 0;
    let completedCount = 0;
    const chunkSize = 4;
    const speed = 35;

    typingIntervalRef.current = setInterval(() => {
      charIdx += chunkSize;
      const currentActiveSlice = targetText.slice(0, charIdx);
      
      // Gradually advance completed controls proportional to typing progress
      const progressFraction = Math.min(1, charIdx / targetText.length);
      const targetCompleted = Math.min(totalQ, Math.floor(progressFraction * totalQ) + 1);

      if (targetCompleted > completedCount) {
        const newAnswers: Record<string, string> = {};
        const newIds: string[] = [];

        for (let i = completedCount; i < targetCompleted; i++) {
          const q = allQuestions[i];
          if (q) {
            newIds.push(q.id);
            if (q.id === subId) {
              newAnswers[q.id] = currentActiveSlice;
            } else if (GAP_CONTROL_IDS.has(q.id)) {
              newAnswers[q.id] = `[COMPLIANCE GAP IDENTIFIED]\n\nNo documented internal control procedures or active operational evidence were detected in the policy repository for "${q.title}". Flagged for manual policy drafting and Board remediation.`;
            } else {
              newAnswers[q.id] = `The organization has formally instituted verified internal controls for "${q.title}". Mapped directly to Master Direction standards with active technical safeguards and audit log retention.`;
            }
          }
        }

        completedCount = targetCompleted;

        setGeneratedControls(prev => {
          const next = new Set(prev);
          newIds.forEach(id => next.add(id));
          return next;
        });

        setControlAnswers(prev => ({
          ...prev,
          ...newAnswers,
          [subId]: currentActiveSlice
        }));
      } else {
        setControlAnswers(prev => ({
          ...prev,
          [subId]: currentActiveSlice
        }));
      }

      // When complete
      if (charIdx >= targetText.length && completedCount >= totalQ) {
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        setControlAnswers(prev => ({ ...prev, [subId]: targetText }));
        setGeneratedControls(new Set(allQuestions.map(q => q.id)));
        setIsGenerating(false);
        toast.success(`Generated answers for all ${totalQ} controls (3 compliance gaps identified).`);
      }
    }, speed);
  };
  
  // Find related KB evidence
  const realKbForControl = activeSubControl ? realKb.filter((k) => k.controlIds?.includes(activeSubControl.id)) : [];
  const relatedKbEntries = !isDemo ? [] : activeSubControl ? DEMO_KNOWLEDGE_BASE.filter(kb => kb.question.includes(activeSubControl.title) || kb.question.includes(activeSubControl.id.replace('Q-RBI-', 'REC-'))) : [];
  // For demo, if none found, fallback to first two
  const displayKb = !isDemo ? realKbForControl : relatedKbEntries.length > 0 ? relatedKbEntries : DEMO_KNOWLEDGE_BASE.slice(0, 2);

  // Find related obligations
  const displayObligations = isDemo
    ? DEMO_OBLIGATIONS_PRELOADED.slice(0, 2) // Mock mapping
    : (activeSubControl ? obligationsByControl[activeSubControl.id] ?? [] : []);

  const handleExportEvidence = () => {
    if (!isDemo) {
      if (!activeParent) return;
      const body = activeParent.questions.map((q) => controlMarkdown(q.id)).join("\n---\n\n");
      downloadTextFile(
        `dossier-${slugify(activeParent.circularId || activeParent.name)}.md`,
        `# Evidence Dossier: ${activeParent.name}\n\n_Exported ${new Date().toISOString().slice(0, 10)}. Evidence and obligations appear only for controls opened this session._\n\n${body}`,
      );
      toast.success("Dossier exported as Markdown.");
      return;
    }
    toast.success("Evidence packet exported successfully as audit PDF.");
  };

  const controlMarkdown = (id: string): string => {
    const k = controls.find((c) => c.id === id);
    if (!k) return "";
    const obls = obligationsByControl[id];
    const docs = customDocsByControl[id];
    const kbs = realKb.filter((e) => e.controlIds?.includes(id));
    const isGap = gapIds.has(id) && !resolvedGaps.has(id);
    const gap = gaps.filter((g) => g.controlId === id);
    const L: string[] = [`## ${k.code ? `${k.code} - ` : ""}${k.title}`, ""];
    L.push(`- Status: ${k.status}`, `- Implementation: ${k.implementationStatus ?? "n/a"}`);
    if (k.category) L.push(`- Category: ${k.category}`);
    if (k.framework) L.push(`- Framework: ${k.framework}`);
    L.push(`- Gap status: ${isGap ? "Open gap" : "No open gap"}`, "");
    if (k.description) L.push(k.description, "");
    L.push("### Mapped obligations");
    L.push(...(obls === undefined ? ["_Not loaded (open the control to load)._"] : obls.length ? obls.map((o) => `- ${o.requirementText}`) : ["_None_"]), "");
    L.push("### Answer", controlAnswers[id]?.trim() || "_Unassessed_", "");
    L.push("### Evidence");
    L.push(...(docs === undefined ? ["_Not loaded (open the control to load)._"] : docs.length ? docs.map((d) => `- ${d.title}${d.section ? ` (${d.section})` : ""}${d.excerpt ? `: ${d.excerpt}` : ""}`) : ["_None_"]), "");
    L.push("### Knowledge base finding");
    L.push(...(kbs.length ? kbs.map((e) => `- **${e.question}**: ${e.answer}`) : ["_None_"]), "");
    if (gap.length) L.push("### Gaps", ...gap.map((g) => `- ${g.title} (${g.status})`), "");
    return L.join("\n");
  };

  const handleExportControl = () => {
    if (!activeSubControl) return;
    if (isDemo) {
      toast.success(`Exported control brief for ${activeSubControl.id} as PDF.`);
      return;
    }
    const md = `# Control Brief\n\n_Exported ${new Date().toISOString().slice(0, 10)}_\n\n${controlMarkdown(activeSubControl.id)}`;
    downloadTextFile(`control-${slugify(activeSubControl.code || activeSubControl.title)}.md`, md);
    toast.success("Control exported as Markdown.");
  };

  const handleGenerateAnswersReal = async () => {
    if (!activeParent || isGeneratingAnswers) return;
    setIsGeneratingAnswers(true);
    try {
      const res = await generateAnswersForCircular(activeParent.id);
      const byId = new Map(res.controls.map((c) => [c.id, c]));
      setControls((p) => p.map((k) => byId.get(k.id) ?? k));
      setControlAnswers((p) => ({ ...p, ...Object.fromEntries(res.controls.filter((c) => c.answer).map((c) => [c.id, c.answer as string])) }));
      toast.success(`Generated ${res.generated} answers (${res.skipped} skipped, ${res.failed} failed).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate answers.");
    } finally {
      setIsGeneratingAnswers(false);
    }
  };

  const handleGenerateOneReal = async () => {
    if (!activeSubControl || isGeneratingAnswers) return;
    const id = activeSubControl.id;
    setIsGeneratingAnswers(true);
    try {
      const { persisted, ...updated } = await generateControlAnswer(id);
      setControlAnswers((p) => ({ ...p, [id]: updated.answer ?? "" }));
      if (persisted) setControls((p) => p.map((k) => (k.id === id ? updated : k)));
      else toast.info("Shared control: answer shown but not saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate answer.");
    } finally {
      setIsGeneratingAnswers(false);
    }
  };

  const handleOpenDocument = async () => {
    if (!previewDoc) return;
    if (isDemo || !previewDoc.documentId) {
      toast.success(`Opening artifact: ${previewDoc.title}`);
      setPreviewDoc(null);
      return;
    }
    try {
      const { url } = await fetchDocumentDownloadUrl(previewDoc.documentId);
      window.open(url, "_blank", "noopener,noreferrer");
      setPreviewDoc(null);
    } catch {
      toast.error("Could not open document.");
    }
  };

  // Active documents for activeSubControl:
  const activeDocs: EvidenceDoc[] = activeSubControl
    ? (customDocsByControl[activeSubControl.id] ?? (isDemo && !isCurrentGap && isCurrentGenerated ? AVAILABLE_REPO_DOCS.slice(0, 2) : []))
    : [];

  // Active KB note for activeSubControl:
  const activeKbFinding = activeSubControl
    ? (isDemo ? customKbByControl[activeSubControl.id] : undefined) ?? (isCurrentGap ? null : (isDemo ? isCurrentGenerated : true) ? displayKb[0] ?? null : null)
    : null;

  // Evidence Search & Modal actions
  const allDocs = availableDocs;
  const filteredDocs = allDocs.filter(doc => 
    doc.title.toLowerCase().includes(evidenceSearchQuery.toLowerCase()) || 
    doc.section.toLowerCase().includes(evidenceSearchQuery.toLowerCase()) ||
    doc.excerpt.toLowerCase().includes(evidenceSearchQuery.toLowerCase())
  );

  const filteredKb = availableKb.filter(kb =>
    kb.question.toLowerCase().includes(evidenceSearchQuery.toLowerCase()) ||
    kb.answer.toLowerCase().includes(evidenceSearchQuery.toLowerCase()) ||
    kb.sourceAssessment.toLowerCase().includes(evidenceSearchQuery.toLowerCase())
  );

  const activeSelectedDoc = allDocs.find(d => d.id === selectedDocId) || allDocs[0];
  const activeSelectedKb = availableKb.find(k => k.id === selectedKbId) || availableKb[0];

  const handleAddEvidenceConfirm = () => {
    if (!activeSubControl) return;

    if (!isDemo) {
      const controlId = activeSubControl.id;
      const doc = addEvidenceType === "document" ? activeSelectedDoc : undefined;
      const kb = addEvidenceType === "knowledge_base" ? activeSelectedKb : undefined;
      if (!doc && !kb) { toast.error("Nothing selected."); return; }
      (async () => {
        try {
          if (doc) {
            const ev = await addControlEvidence(controlId, {
              documentId: doc.id,
              name: doc.title,
              documentType: doc.type,
              section: doc.section || undefined,
              excerpt: doc.excerpt || undefined,
              status: "VERIFIED",
            });
            setCustomDocsByControl((p) => ({ ...p, [controlId]: [evidenceToDoc(ev), ...(p[controlId] ?? [])] }));
          } else if (kb) {
            const ids = Array.from(new Set([...(kb.controlIds ?? []), controlId]));
            await setKnowledgeEntryControls(kb.id, ids);
            setRealKb((p) => p.map((k) => (k.id === kb.id ? { ...k, controlIds: ids } : k)));
          }
          // Evidence attached: resolve any open gap on this control
          const openGaps = gaps.filter((g) => g.controlId === controlId && g.status !== "RESOLVED");
          await Promise.all(openGaps.map((g) => updateComplianceGap(g.id, { status: "RESOLVED" })));
          if (openGaps.length > 0) {
            setGaps((p) => p.map((g) => (openGaps.some((o) => o.id === g.id) ? { ...g, status: "RESOLVED" } : g)));
          }
          if (controls.find((k) => k.id === controlId)?.status === "COMPLIANCE_GAP") {
            const updated = await updateControl(controlId, { status: "ACTIVE" });
            setControls((p) => p.map((k) => (k.id === controlId ? updated : k)));
          }
          toast.success(`Added evidence to ${activeSubControl.title}.`);
        } catch {
          toast.error("Failed to add evidence.");
        }
      })();
      setIsAddEvidenceOpen(false);
      setEvidenceSearchQuery("");
      return;
    }

    if (addEvidenceType === "document") {
      const docToAdd = allDocs.find(d => d.id === selectedDocId) || AVAILABLE_REPO_DOCS[0];
      setCustomDocsByControl(prev => {
        const currentList = prev[activeSubControl.id] ?? (isCurrentGap ? [] : isCurrentGenerated ? AVAILABLE_REPO_DOCS.slice(0, 2) : []);
        if (currentList.some(d => d.id === docToAdd.id || d.title === docToAdd.title)) {
          return prev;
        }
        return {
          ...prev,
          [activeSubControl.id]: [docToAdd, ...currentList]
        };
      });

      if (!controlAnswers[activeSubControl.id] || isCurrentGap) {
        setControlAnswers(prev => ({
          ...prev,
          [activeSubControl.id]: `Verified compliance substantiated via ${docToAdd.title} (${docToAdd.section}): "${docToAdd.excerpt}"`
        }));
      }

      setResolvedGaps(prev => new Set(prev).add(activeSubControl.id));
      setGeneratedControls(prev => new Set(prev).add(activeSubControl.id));
      toast.success(`Attached "${docToAdd.title}" as evidence to ${activeSubControl.id}.`);
    } else {
      const kbToAdd = AVAILABLE_KB_ENTRIES.find(k => k.id === selectedKbId) || AVAILABLE_KB_ENTRIES[0];
      setCustomKbByControl(prev => ({
        ...prev,
        [activeSubControl.id]: {
          answer: kbToAdd.answer,
          sourceAssessment: kbToAdd.sourceAssessment
        }
      }));

      if (!controlAnswers[activeSubControl.id] || isCurrentGap) {
        setControlAnswers(prev => ({
          ...prev,
          [activeSubControl.id]: kbToAdd.answer
        }));
      }

      setResolvedGaps(prev => new Set(prev).add(activeSubControl.id));
      setGeneratedControls(prev => new Set(prev).add(activeSubControl.id));
      toast.success(`Linked knowledge base answer to ${activeSubControl.id}.`);
    }

    setIsAddEvidenceOpen(false);
    setEvidenceSearchQuery("");
  };

  return (
    <motion.div
      variants={pageContainer}
      initial="hidden"
      animate="show"
      className="flex-1 flex flex-col min-h-0 min-w-0 bg-background"
    >
      <div className="flex-1 min-h-0 p-4 md:p-6 space-y-5 overflow-auto flex flex-col">
        {/* Top Navigation & Context Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBack}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer -ml-1"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Controls
            </Button>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/5 text-primary text-[10px] font-semibold tracking-wider font-mono">
                {activeParent?.circularId}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-medium tracking-wide">
                {activeParent?.category || "Information Technology"}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                {activeParent?.questions.length} Controls
              </span>
            </div>
          </div>
        </div>

        {/* Title and Description */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            {activeParent?.name}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 max-w-4xl leading-relaxed">
            {activeParent?.description}
          </p>
          {activeParent && (
            <div className="mt-3 flex justify-start">
              <SuggestionBar circularId={activeParent.id} isDemo={isDemo} onDone={() => {}} />
            </div>
          )}
        </div>

        {/* Controls & Evidence Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-[600px]">
          <TabsList className="w-fit mb-3">
            <TabsTrigger value="controls" className="text-xs px-4">Controls</TabsTrigger>
            <TabsTrigger value="evidence" className="text-xs px-4">Evidence</TabsTrigger>
          </TabsList>
          <div className="flex-1 space-y-0 mt-0 border rounded-xl overflow-hidden bg-card shadow-sm flex flex-col md:flex-row min-h-[600px]">
            {/* Left Sidebar - Library */}
            <div className="w-full md:w-[320px] border-b md:border-b-0 md:border-r bg-muted/10 flex flex-col shrink-0">
              <div className="px-4 py-3 border-b bg-muted/30 font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Control Library</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/60 border border-border/40 text-muted-foreground font-normal">
                  {stageFilter !== "ALL"
                    ? `${filteredQuestions.length} / ${totalCount}`
                    : (activeParent?.questions.filter(q => q.title.toLowerCase().includes(searchQuery.toLowerCase()) || q.id.toLowerCase().includes(searchQuery.toLowerCase())).length || 0)}
                </span>
              </div>
              
              <div className="p-2 pb-1 bg-background/30">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
                  <Input
                    placeholder="Search controls..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs bg-muted/20 border-border/40 focus:bg-background"
                  />
                </div>
              </div>

              {/* Assessment Progress with Stage Breakdown */}
              <div className="px-3.5 pb-2.5 pt-2 border-b bg-background/30 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-foreground tracking-tight flex items-center gap-1.5">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full transition-colors",
                      stageCounts.gap > 0 ? "bg-rose-500 animate-pulse" : stageCounts.completed > 0 ? "bg-emerald-500" : "bg-muted-foreground/40"
                    )} />
                    Overall Progress
                  </span>
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {progressPercent}%
                  </span>
                </div>

                {/* Multi-Stage Segmented Progress Bar */}
                <div 
                  className="h-1.5 w-full bg-muted/60 dark:bg-muted/40 rounded-full overflow-hidden flex transition-all duration-500 ease-out"
                  title={`Completed: ${stageCounts.completed} (${Math.round(completedPercent)}%) · Gap: ${stageCounts.gap} (${Math.round(gapPercent)}%) · Not Started: ${stageCounts.notStarted} (${Math.round(notStartedPercent)}%)`}
                >
                  {completedPercent > 0 && (
                    <div 
                      className={cn(
                        "h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-500 ease-out",
                        gapPercent > 0 && "border-r border-background/40"
                      )}
                      style={{ width: `${completedPercent}%` }}
                    />
                  )}
                  {gapPercent > 0 && (
                    <div 
                      className="h-full bg-rose-500 dark:bg-rose-500 transition-all duration-500 ease-out"
                      style={{ width: `${gapPercent}%` }}
                    />
                  )}
                </div>

                {/* Stage Indicators */}
                <div className="flex items-center justify-between text-[10px] sm:text-[10.5px] pt-0.5 select-none gap-1">
                  <button
                    type="button"
                    onClick={() => setStageFilter(p => p === "COMPLETED" ? "ALL" : "COMPLETED")}
                    className={cn(
                      "flex items-center gap-1.5 transition-all px-1.5 py-0.5 rounded cursor-pointer group text-left",
                      stageFilter === "COMPLETED" 
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-medium ring-1 ring-emerald-500/30" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                    title="Click to filter Completed controls"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="whitespace-nowrap">
                      Completed: <strong className="font-semibold text-foreground group-hover:text-foreground">{stageCounts.completed}</strong>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStageFilter(p => p === "GAP" ? "ALL" : "GAP")}
                    className={cn(
                      "flex items-center gap-1.5 transition-all px-1.5 py-0.5 rounded cursor-pointer group text-left",
                      stageFilter === "GAP" 
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 font-medium ring-1 ring-rose-500/30" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                    title="Click to filter Gap controls"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span className="whitespace-nowrap">
                      Gap: <strong className="font-semibold text-rose-600 dark:text-rose-400 group-hover:text-rose-700">{stageCounts.gap}</strong>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStageFilter(p => p === "NOT_STARTED" ? "ALL" : "NOT_STARTED")}
                    className={cn(
                      "flex items-center gap-1.5 transition-all px-1.5 py-0.5 rounded cursor-pointer group text-left",
                      stageFilter === "NOT_STARTED" 
                        ? "bg-muted text-foreground font-medium ring-1 ring-border" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                    title="Click to filter Not Started controls"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                    <span className="whitespace-nowrap">
                      Not Started: <strong className="font-semibold text-foreground group-hover:text-foreground">{stageCounts.notStarted}</strong>
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {stageFilter !== "ALL" && (
                  <div className="flex items-center justify-between px-2.5 py-1 mb-1 rounded bg-muted/50 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        stageFilter === "COMPLETED" && "bg-emerald-500",
                        stageFilter === "GAP" && "bg-rose-500",
                        stageFilter === "NOT_STARTED" && "bg-muted-foreground/40",
                      )} />
                      <span>
                        Showing <strong className="text-foreground capitalize">{stageFilter.replace("_", " ")}</strong> ({filteredQuestions.length})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setStageFilter("ALL")}
                      className="text-[10px] text-primary hover:underline font-medium cursor-pointer"
                    >
                      Show all
                    </button>
                  </div>
                )}
                {filteredQuestions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground space-y-2">
                    <p>No controls found in this view.</p>
                    {stageFilter !== "ALL" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStageFilter("ALL")}
                        className="h-7 text-xs text-primary"
                      >
                        Reset filter
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredQuestions.map((q) => {
                    const isSelected = selectedSubControlId === q.id;
                    const stage = getSubControlStage(q.id);
                    return (
                      <button
                        key={q.id}
                        onClick={() => handleSelectSubControl(q.id)}
                        className={cn(
                          "w-full text-left px-3 py-3 rounded-lg text-sm transition-colors cursor-pointer",
                          isSelected ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 font-mono truncate">
                            {q.code ?? q.id}
                          </span>
                          {stage === "COMPLETED" && (
                            <span 
                              className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" 
                              title="Completed: Answer & Evidence Generated" 
                            />
                          )}
                          {stage === "GAP" && (
                            <span 
                              className="w-1.5 h-1.5 rounded-full shrink-0 bg-rose-500 animate-pulse" 
                              title="Compliance Gap (No Evidence / Flagged)" 
                            />
                          )}
                          {stage === "NOT_STARTED" && (
                            <span 
                              className="w-1.5 h-1.5 rounded-full shrink-0 border border-muted-foreground/30" 
                              title="Not Started" 
                            />
                          )}
                        </div>
                        <div className="line-clamp-2 leading-snug">{q.title}</div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Main - Details (Switches between Controls and Evidence tabs) */}
            <div className="flex-1 flex flex-col bg-background min-w-0 overflow-hidden">
              <TabsContent value="controls" className="flex-1 m-0 p-0 border-0 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              
              {activeSubControl ? (
                <>
                  {/* Top Header with Stepper, Status and Generate with AI */}
                  <div className="px-6 py-3 border-b flex items-center justify-between gap-4 bg-muted/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Control Configuration</span>
                      <span className="text-muted-foreground/40">/</span>
                      <span className="font-mono text-xs font-semibold text-foreground truncate">{activeSubControl.code ?? activeSubControl.id}</span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 cursor-pointer shadow-sm hover:shadow-md transition-shadow bg-background"
                          disabled={!prevControl}
                          onClick={handlePrev}
                          title="Previous Control"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-[11px] font-mono text-muted-foreground px-1">
                          {currentIndex + 1} / {activeParent?.questions.length || 0}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 cursor-pointer shadow-sm hover:shadow-md transition-shadow bg-background"
                          disabled={!nextControl}
                          onClick={handleNext}
                          title="Next Control"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleExportControl} 
                        className="h-8 px-3 text-xs gap-1.5 border-border/70 shadow-2xs hover:border-primary/40 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Export Control</span>
                      </Button>

                      {/* Mark as Gap / View in Gaps button */}
                      {isCurrentControlGap ? (
                        <div className="flex items-center gap-1.5">
                          <Badge 
                            variant="outline" 
                            className="h-8 px-2.5 gap-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 text-xs font-medium shadow-2xs"
                          >
                            <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                            <span>Marked as Gap</span>
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("/gaps")}
                            className="h-8 px-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700 cursor-pointer"
                            title="Open in Gaps register"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View in Gaps
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleMarkAsGap}
                          disabled={isMarkingGap}
                          className="h-8 px-3 text-xs gap-1.5 border-border/70 shadow-2xs hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 cursor-pointer transition-all"
                          title="Flag this control as a Compliance Gap and add to Gaps register"
                        >
                          {isMarkingGap ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-500" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                          )}
                          <span>Mark as Gap</span>
                        </Button>
                      )}

                      {!isDemo && (
                        <Button variant="outline" size="sm" onClick={handleGenerateOneReal} disabled={isGeneratingAnswers} className="h-8 px-3 text-xs gap-1.5 cursor-pointer">
                          Generate
                        </Button>
                      )}
                      {!isDemo && <Button
                        onClick={handleGenerateAnswersReal}
                        disabled={isGeneratingAnswers}
                        size="sm"
                        className="h-8 px-3.5 cursor-pointer shadow-xs gap-1.5 text-xs"
                      >
                        {isGeneratingAnswers ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                        ) : (
                          <>Generate Answers <Play className="h-3 w-3 fill-current" /></>
                        )}
                      </Button>}
                      {isDemo && <Button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        size="sm"
                        className="h-8 px-3.5 cursor-pointer shadow-xs gap-1.5 text-xs"
                      >
                        {isGenerating ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                        ) : (
                          <>Generate Answers <Play className="h-3 w-3 fill-current" /></>
                        )}
                      </Button>}
                    </div>
                  </div>

                  <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                    {/* Control Name */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Control Name</label>
                      <div className="text-sm font-medium text-foreground p-3 bg-muted/20 border rounded-lg">
                        {activeSubControl.title}
                      </div>
                    </div>

                    {/* Assessment Answer (Editable) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Assessment Answer (Editable)</label>
                        <div className="flex items-center gap-2">
                          {isGenerating && (
                            <span className="text-[10px] font-mono text-primary flex items-center gap-1 animate-pulse font-medium">
                              <Sparkles className="h-3 w-3" />
                              AI Typing...
                            </span>
                          )}
                          {!isGenerating && controlAnswers[activeSubControl.id] && (
                            isCurrentControlGap ? (
                              <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-medium flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Gap Identified (No Evidence)
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                                Generated & Verified
                              </span>
                            )
                          )}
                        </div>
                      </div>
                      <Textarea
                        value={controlAnswers[activeSubControl.id] || ""}
                        onChange={(e) => setControlAnswers(prev => ({ ...prev, [activeSubControl.id]: e.target.value }))}
                        disabled={isGenerating}
                        onBlur={() => {
                          if (isDemo) return;
                          const id = activeSubControl.id;
                          const value = controlAnswers[id] ?? "";
                          const saved = controls.find((k) => k.id === id)?.answer ?? "";
                          if (value === saved) return;
                          updateControl(id, { answer: value })
                            .then((u) => setControls((p) => p.map((k) => (k.id === id ? u : k))))
                            .catch(() => toast.error("Failed to save answer."));
                        }}
                        className={cn(
                          "min-h-[200px] text-sm resize-none leading-relaxed p-4 bg-background border-border/60 focus:border-primary/50 shadow-xs rounded-lg transition-all",
                          isGenerating && "border-primary/60 ring-2 ring-primary/20 bg-primary/[0.02]"
                        )}
                        placeholder={isDemo ? "Answer is currently unassessed. Click 'Generate Answers' above to populate..." : "Answer is currently unassessed. Type an answer; it saves when you leave the field."}
                      />
                    </div>

                    {/* Linked Regulatory Obligations Section */}
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <ExternalLink className="h-3.5 w-3.5 text-amber-500" />
                            <span>Linked Regulatory Obligations</span>
                          </label>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-medium">
                            {displayObligations.length} {displayObligations.length === 1 ? "Mandate" : "Mandates"}
                          </span>
                        </div>
                        <button
                          onClick={() => navigate("/traceability")}
                          className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 cursor-pointer font-medium group"
                        >
                          <span>Full Matrix</span>
                          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        {displayObligations.map(obl => (
                          <div 
                            key={obl.id} 
                            className="relative rounded-xl border border-border/70 border-l-[3.5px] border-l-amber-500 bg-card/60 p-4 shadow-2xs space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 px-2 py-0.5">
                                  {obl.identifier}
                                </Badge>
                                <span className="text-[11px] font-mono text-muted-foreground/80">
                                  Circular {obl.circularId}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                                  onClick={() => handleCopyObligation(obl.id, obl.requirementText)}
                                  title="Copy Requirement Text"
                                >
                                  {copiedOblId === obl.id ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground hover:border-primary/50 cursor-pointer shadow-2xs bg-background"
                                  onClick={() => navigate(`/traceability?search=${encodeURIComponent(obl.identifier || "")}`)}
                                  title="Trace Lineage in Matrix"
                                >
                                  <GitBranch className="h-3 w-3 text-primary" />
                                  <span>Trace</span>
                                  <ArrowUpRight className="h-3 w-3 opacity-60" />
                                </Button>
                              </div>
                            </div>

                            <p className="text-xs md:text-[13px] text-foreground/90 leading-relaxed font-normal">
                              {obl.requirementText}
                            </p>

                            <div className="flex items-center gap-2 pt-1 border-t border-border/30 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3 text-amber-500/80" />
                                Mandatory Compliance
                              </span>
                              <span className="text-muted-foreground/40">•</span>
                              <span>RBI Master Direction</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-6 max-w-sm mx-auto text-center animate-in fade-in z-10">
                  <div className="p-4 bg-muted/20 rounded-full">
                    <Activity className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-foreground mb-1">Select a Control</p>
                    <p className="text-sm leading-relaxed">Choose an assessment question from the sidebar to view mapped obligations.</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="evidence" className="flex-1 m-0 p-0 border-0 flex flex-col overflow-hidden data-[state=inactive]:hidden">
              {activeSubControl ? (
                <>
                  {/* Top Header with Stepper, Status and Actions identical to Controls header */}
                  <div className="px-6 py-3 border-b flex items-center justify-between gap-4 bg-muted/5 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Evidence Dossier</span>
                      <span className="text-muted-foreground/40">/</span>
                      <span className="font-mono text-xs font-semibold text-foreground truncate">{activeSubControl.code ?? activeSubControl.id}</span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7 cursor-pointer shadow-sm hover:shadow-md transition-shadow bg-background"
                          disabled={!prevControl}
                          onClick={handlePrev}
                          title="Previous Control"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-[11px] font-mono text-muted-foreground px-1">
                          {currentIndex + 1} / {activeParent?.questions.length || 0}
                        </span>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7 cursor-pointer shadow-sm hover:shadow-md transition-shadow bg-background"
                          disabled={!nextControl}
                          onClick={handleNext}
                          title="Next Control"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleExportEvidence} 
                        className="h-8 px-3 text-xs gap-1.5 border-border/70 shadow-2xs hover:border-primary/40 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Export Dossier</span>
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => setIsAddEvidenceOpen(true)} 
                        className="h-8 px-3 text-xs gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Evidence</span>
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                    {/* Control Name */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Control Name</label>
                      <div className="text-sm font-medium text-foreground p-3 bg-muted/20 border rounded-lg">
                        {activeSubControl.title}
                      </div>
                    </div>

                    {/* Attached Evidence & Documents */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Attached Artifacts</span>
                          <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1.5">
                            {activeDocs.length}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {activeDocs.length > 0 ? `${activeDocs.length} verified policy document${activeDocs.length > 1 ? "s" : ""}` : isCurrentGap ? "No documents found" : "Pending assessment"}
                        </span>
                      </div>

                      {activeDocs.length === 0 && !isCurrentGap ? (
                        /* Initial unpopulated state */
                        <div className="p-8 rounded-xl border border-dashed border-border/70 bg-muted/10 text-center space-y-2.5">
                          <div className="p-2.5 bg-muted/40 rounded-full w-fit mx-auto text-muted-foreground/60">
                            <FileText className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground">Evidence Dossier Unpopulated</p>
                            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto mt-0.5 leading-relaxed">
                              Assessment has not been generated yet. Click "Generate Answers" in the Controls tab to auto-discover and corroborate evidence, or add evidence manually.
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setIsAddEvidenceOpen(true)} 
                            className="h-7 px-3 text-xs gap-1.5 mt-2 cursor-pointer bg-background"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Evidence</span>
                          </Button>
                        </div>
                      ) : activeDocs.length === 0 && isCurrentGap ? (
                        /* Compliance gap with 0 evidence */
                        <div className="p-8 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 text-center space-y-2.5">
                          <div className="p-2.5 bg-amber-500/10 rounded-full w-fit mx-auto text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">No Evidence Artifacts Found</p>
                            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto mt-0.5 leading-relaxed">
                              Automated repository indexing located zero policy documents or audit certificates satisfying this requirement.
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setIsAddEvidenceOpen(true)} 
                            className="h-7 px-3 text-xs gap-1.5 mt-2 cursor-pointer border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 bg-background"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Evidence</span>
                          </Button>
                        </div>
                      ) : (
                        /* Populated artifacts list */
                        <div className="divide-y divide-border/40 rounded-xl border border-border/70 bg-card overflow-hidden">
                          {activeDocs.map((doc, idx) => (
                            <div 
                              key={doc.id || idx}
                              onClick={() => setPreviewDoc(doc)}
                              className="p-3.5 flex items-center justify-between gap-4 hover:bg-muted/25 transition-colors cursor-pointer group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                                  {idx === 0 ? <FileText className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                                    {doc.title}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                    {doc.section}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right hidden sm:block">
                                  <span className="text-[10px] font-mono text-muted-foreground block">{doc.size}</span>
                                  <span className="text-[10px] text-muted-foreground/70 block">{doc.lastUpdated}</span>
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 px-2.5 text-[11px] gap-1.5 cursor-pointer shadow-2xs bg-background"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewDoc(doc);
                                  }}
                                >
                                  <Eye className="h-3 w-3 text-muted-foreground" />
                                  <span>View</span>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Corroborated Evidence Note */}
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Corroborated Evidence Finding</span>
                        <span className="text-[11px] text-muted-foreground">Knowledge Base Citation</span>
                      </div>

                      {activeKbFinding ? (
                        <div className="p-4 rounded-xl border border-border/70 bg-card space-y-3 shadow-2xs relative">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5">
                                Verified Evidence
                              </Badge>
                              <span className="text-[11px] text-muted-foreground font-mono">
                                Source: {activeKbFinding.sourceAssessment}
                              </span>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer shadow-2xs bg-background shrink-0"
                              onClick={() => handleCopyKbAnswer(0, activeKbFinding.answer)}
                              title="Copy Evidence Text"
                            >
                              {copiedKbIdx === 0 ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-500" />
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </Button>
                          </div>

                          <p className="text-xs md:text-[13px] text-foreground/90 leading-relaxed font-normal">
                            {activeKbFinding.answer}
                          </p>

                          <div className="flex items-center gap-2 pt-1 border-t border-border/30 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              Corroborated with Master Direction Requirements
                            </span>
                          </div>
                        </div>
                      ) : isCurrentGap ? (
                        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-300 dark:border-amber-500/30 px-2 py-0.5 font-medium">
                              Uncorroborated • Compliance Gap
                            </Badge>
                            <span className="text-[10px] font-mono text-muted-foreground">Status: No Match</span>
                          </div>
                          <p className="text-xs md:text-[13px] text-foreground/90 leading-relaxed font-normal">
                            Knowledge base query returned zero matching internal records. An exception has been flagged for audit review. Manual policy drafting and board resolution required.
                          </p>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setIsAddEvidenceOpen(true)} 
                            className="h-7 px-3 text-xs gap-1.5 mt-2 cursor-pointer border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 bg-background"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Evidence</span>
                          </Button>
                        </div>
                      ) : (
                        <div className="p-5 rounded-xl border border-border/60 bg-muted/5 text-center text-xs text-muted-foreground space-y-1">
                          <p className="font-medium text-foreground/80">Pending Knowledge Base Analysis</p>
                          <p className="text-[11px] text-muted-foreground">Corroborated citations from the policy repository will appear once assessment generation is triggered.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-6 max-w-sm mx-auto text-center animate-in fade-in z-10 p-8">
                  <div className="p-4 bg-muted/20 rounded-full">
                    <FileText className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-foreground mb-1">Select a Control</p>
                    <p className="text-sm leading-relaxed">Choose an assessment question from the sidebar to inspect its evidence dossier.</p>
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </div>
      </Tabs>

        {/* Document Preview Modal */}
        {previewDoc && (
          <div 
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setPreviewDoc(null)}
          >
            <div 
              className="bg-card border border-border/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground tracking-tight">{previewDoc.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{previewDoc.section}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full cursor-pointer hover:bg-muted" onClick={() => setPreviewDoc(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant="outline" className="bg-muted/50 font-mono text-[10px]">{previewDoc.type}</Badge>
                  <span>Size: {previewDoc.size}</span>
                  <span>•</span>
                  <span>Last Updated: {previewDoc.lastUpdated}</span>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verified Excerpt</span>
                  <div className="p-4 bg-muted/20 border border-border/50 rounded-xl text-sm leading-relaxed text-foreground/90 font-serif">
                    "{previewDoc.excerpt}"
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/30 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Immutable WORM Storage Verified
                  </span>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 text-xs cursor-pointer" 
                    onClick={handleOpenDocument}
                  >
                    Open Document
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Evidence Modal */}
        {isAddEvidenceOpen && activeSubControl && (
          <div 
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setIsAddEvidenceOpen(false)}
          >
            <div 
              className="bg-card border border-border/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground tracking-tight">Add Evidence</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Select a repository document or link verified knowledge base answers to <span className="font-mono font-medium text-foreground">{activeSubControl.id}</span>
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-full cursor-pointer hover:bg-muted" 
                  onClick={() => setIsAddEvidenceOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Segmented Switcher */}
              <div className="flex border-b border-border/60 gap-4 shrink-0">
                <button
                  type="button"
                  onClick={() => { setAddEvidenceType("document"); setEvidenceSearchQuery(""); }}
                  className={cn(
                    "pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer",
                    addEvidenceType === "document" 
                      ? "border-primary text-primary" 
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Policy Documents</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                    {availableDocs.length}
                  </Badge>
                </button>
                <button
                  type="button"
                  onClick={() => { setAddEvidenceType("knowledge_base"); setEvidenceSearchQuery(""); }}
                  className={cn(
                    "pb-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer",
                    addEvidenceType === "knowledge_base" 
                      ? "border-primary text-primary" 
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Knowledge Base Answers</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                    {availableKb.length}
                  </Badge>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative shrink-0">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={evidenceSearchQuery}
                  onChange={(e) => setEvidenceSearchQuery(e.target.value)}
                  placeholder={addEvidenceType === "document" ? "Search documents by title, section, or keyword..." : "Search knowledge base questions and verified answers..."}
                  className="pl-8 h-9 text-xs bg-muted/20 border-border/60"
                />
              </div>

              {/* Tab Content List (Scrollable) */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[220px] max-h-[380px]">
                {addEvidenceType === "document" ? (
                  <>
                    {/* Document Cards */}
                    {filteredDocs.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted-foreground">
                        No matching policy documents found.
                      </div>
                    ) : (
                      filteredDocs.map((doc) => {
                        const isSelected = selectedDocId === doc.id;
                        return (
                          <div
                            key={doc.id}
                            onClick={() => setSelectedDocId(doc.id)}
                            className={cn(
                              "p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 text-left",
                              isSelected 
                                ? "border-primary bg-primary/[0.04] ring-1 ring-primary/40 shadow-xs" 
                                : "border-border/60 hover:border-border hover:bg-muted/15"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={cn(
                                  "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                                  isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                                )}>
                                  {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                                </div>
                                <span className="text-xs font-medium text-foreground truncate">{doc.title}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
                                <Badge variant="outline" className="font-mono text-[9px] h-4 px-1">{doc.type}</Badge>
                                <span>{doc.size}</span>
                              </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground pl-6 truncate">{doc.section}</p>
                            <p className="text-[11px] text-foreground/85 line-clamp-2 pl-6 bg-muted/20 p-2 rounded-md font-serif italic">
                              "{doc.excerpt}"
                            </p>
                          </div>
                        );
                      })
                    )}
                  </>
                ) : (
                  <>
                    {/* Knowledge Base Cards */}
                    {filteredKb.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted-foreground">
                        No matching knowledge base answers found.
                      </div>
                    ) : (
                      filteredKb.map((kb) => {
                        const isSelected = selectedKbId === kb.id;
                        return (
                          <div
                            key={kb.id}
                            onClick={() => setSelectedKbId(kb.id)}
                            className={cn(
                              "p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 text-left",
                              isSelected 
                                ? "border-primary bg-primary/[0.04] ring-1 ring-primary/40 shadow-xs" 
                                : "border-border/60 hover:border-border hover:bg-muted/15"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={cn(
                                  "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                                  isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                                )}>
                                  {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                                </div>
                                <span className="text-xs font-medium text-foreground truncate">{kb.question}</span>
                              </div>
                              <Badge variant="secondary" className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 px-1.5 h-4 shrink-0">
                                Verified
                              </Badge>
                            </div>
                            <p className="text-[11px] text-foreground/90 pl-6 leading-relaxed line-clamp-2">
                              {kb.answer}
                            </p>
                            <div className="pl-6 flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="font-mono">Source: {kb.sourceAssessment}</span>
                              <span>•</span>
                              <span>{kb.dateAdded}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border/40 shrink-0">
                <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                  {addEvidenceType === "document" ? (
                    <span>Selected: <strong className="text-foreground font-medium">{activeSelectedDoc?.title ?? "—"}</strong></span>
                  ) : (
                    <span>Selected: <strong className="text-foreground font-medium">{activeSelectedKb ? `${activeSelectedKb.question.slice(0, 32)}...` : "—"}</strong></span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs cursor-pointer"
                    onClick={() => setIsAddEvidenceOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    className="h-8 text-xs gap-1.5 cursor-pointer shadow-xs"
                    onClick={handleAddEvidenceConfirm}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Evidence</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

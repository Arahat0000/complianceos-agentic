import { useParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TRACEABILITY_DATA } from "@/data/traceabilityData";
import { useAuth } from "@/contexts/AuthContext";
import { fetchTraceability, fetchTraceabilityChain, mapChain, parseChainKey, signoffTraceability, fetchTraceabilityVerification, type TraceabilityVerification, type MappedTraceabilityNode } from "@/lib/traceability";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Pause, 
  Play, 
  ShieldCheck 
} from "lucide-react";
import { DotPattern } from "@/components/dot-pattern";

interface StepDetail {
  label: string;
  value: string;
}

interface LineageStep {
  step: string;
  label: string;
  shortLabel: string;
  stage: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeClass?: string;
  secondaryBadge?: string;
  text: string;
  details: StepDetail[];
  items?: { title: string; meta: string; badge: string; badgeClass: string }[];
}

const OK_CLASS = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
const WARN_CLASS = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
const BAD_CLASS = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";

const STEP_DURATION = 4500;

export default function TraceabilityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const { isDemo } = useAuth();
  const [realNode, setRealNode] = useState<MappedTraceabilityNode | null>(null);
  const [realList, setRealList] = useState<{ id: string }[]>([]);
  const [isLoading, setIsLoading] = useState(!isDemo && !!(id && parseChainKey(id)));
  const [isSigning, setIsSigning] = useState(false);
  const [demoSigned, setDemoSigned] = useState(false);
  const [verification, setVerification] = useState<TraceabilityVerification | null>(null);

  // Reset per-lineage state when the route id changes (compare previous value during render).
  const [prevId, setPrevId] = useState(id);
  if (prevId !== id) {
    setPrevId(id);
    setActiveStep(0);
    setIsPlaying(false);
    if (!isDemo) {
      setIsLoading(!!(id && parseChainKey(id)));
      setRealNode(null);
    }
  }

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    const key = id ? parseChainKey(id) : null;
    if (!key) return;
    fetchTraceabilityChain(key.obligationId, key.controlId)
      .then((c) => { if (!cancelled) setRealNode(mapChain(c)); })
      .catch(() => { if (!cancelled) setRealNode(null); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    fetchTraceability()
      .then((rows) => { if (!cancelled) setRealList(rows.map(mapChain)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isDemo, id]);

  const verifyKey = id ? parseChainKey(id) : null;
  const signedAtKey = realNode?.signoff?.signedAt ?? "";
  useEffect(() => {
    if (isDemo || !verifyKey) return;
    let cancelled = false;
    fetchTraceabilityVerification(verifyKey.obligationId, verifyKey.controlId)
      .then((v) => { if (!cancelled) setVerification(v); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, id, signedAtKey]);

  const integrity = (() => {
    if (isDemo) {
      return demoSigned
        ? { label: "Signed off", cls: "text-emerald-500", detail: null as string | null }
        : { label: "Not signed off", cls: "text-muted-foreground", detail: null };
    }
    if (!verification) return { label: "Checking…", cls: "text-muted-foreground", detail: null };
    if (!verification.signed) return { label: "Not signed off", cls: "text-muted-foreground", detail: null };
    return verification.verified
      ? { label: "Hash verified", cls: "text-emerald-500", detail: verification.currentHash.slice(0, 10) }
      : { label: "Changed since sign-off", cls: "text-rose-500", detail: verification.currentHash.slice(0, 10) };
  })();

  const list: { id: string }[] = isDemo ? TRACEABILITY_DATA : realList;

  const activeNode = useMemo(() => {
    if (!isDemo) return realNode;
    return TRACEABILITY_DATA.find((n) => n.id === id) || null;
  }, [isDemo, realNode, id]);

  const currentIndex = useMemo(() => list.findIndex((n) => n.id === id), [list, id]);

  const prevNode = currentIndex > 0 ? list[currentIndex - 1] : null;
  const nextNode = currentIndex >= 0 && currentIndex < list.length - 1 ? list[currentIndex + 1] : null;
  const goTo = (nid: string) => navigate(`/traceability/${encodeURIComponent(nid)}`);

  const signoff = !isDemo && realNode ? realNode.signoff : null;
  const handleSignoff = async () => {
    if (isDemo) {
      setDemoSigned(true);
      toast.success("CCO sign-off recorded");
      return;
    }
    const key = id ? parseChainKey(id) : null;
    if (!key) return;
    setIsSigning(true);
    try {
      const r = await signoffTraceability(key.obligationId, key.controlId, "CCO");
      setRealNode((n) => n && { ...n, signoff: { signedAt: r.signedAt, contentHash: r.contentHash, signedRole: r.signedRole } });
      toast.success("CCO sign-off recorded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-off failed");
    } finally {
      setIsSigning(false);
    }
  };

  const steps = useMemo<LineageStep[]>(() => {
    if (!activeNode) return [];
    const multi: Partial<MappedTraceabilityNode> = activeNode;
    const evItems = multi.evidenceItems ?? [];
    const testItems = multi.testItems ?? [];
    const kpiItems = multi.kpiItems ?? [];
    const evCls = (st: string) => (st === "VERIFIED" ? OK_CLASS : st === "PENDING" ? WARN_CLASS : BAD_CLASS);
    const testCls = (r: string) => (r === "PASSED" ? OK_CLASS : r === "DEFICIENT" ? WARN_CLASS : BAD_CLASS);
    const kpiCls = (h: string) => (h === "HEALTHY" ? OK_CLASS : h === "WARNING" ? WARN_CLASS : BAD_CLASS);

    return [
      {
        step: "01",
        label: "Regulation",
        shortLabel: "Reg",
        stage: "Stage 01 · Regulatory Ingestion",
        title: activeNode.regulation.title,
        subtitle: `${activeNode.regulation.regulator} · ${activeNode.regulation.sourceSection}`,
        badge: activeNode.regulation.reference,
        badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
        secondaryBadge: activeNode.regulation.date,
        text: `"${activeNode.regulation.sourceQuote || activeNode.regulation.title}"`,
        details: [
          { label: "Regulator", value: activeNode.regulation.regulator },
          { label: "Reference", value: activeNode.regulation.reference },
          { label: "Section", value: activeNode.regulation.sourceSection },
          { label: "Promulgated", value: activeNode.regulation.date },
        ],
      },
      {
        step: "02",
        label: "Obligation",
        shortLabel: "Obligation",
        stage: "Stage 02 · Obligation Extraction",
        title: `Mandate: ${activeNode.obligation.id}`,
        subtitle: `${activeNode.obligation.type} Mandate · ${(activeNode.obligation.confidence * 100).toFixed(0)}% Parser Confidence`,
        badge: activeNode.obligation.type,
        badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
        secondaryBadge: activeNode.obligation.deadline ? `SLA: ${activeNode.obligation.deadline}` : "Continuous",
        text: `"${activeNode.obligation.text}"`,
        details: [
          { label: "Obligation ID", value: activeNode.obligation.id },
          { label: "Mandate Type", value: activeNode.obligation.type },
          { label: "SLA / Deadline", value: activeNode.obligation.deadline || "Continuous" },
          { label: "Penalty Risk", value: activeNode.obligation.penalty || "Statutory Sanctions" },
        ],
      },
      {
        step: "03",
        label: "Applicability",
        shortLabel: "Scope",
        stage: "Stage 03 · Entity Scope & Thresholds",
        title: `Scope: ${activeNode.applicability.status}`,
        subtitle: `Applicable to: ${activeNode.applicability.entities.join(", ")}`,
        badge: activeNode.applicability.status,
        badgeClass: activeNode.applicability.status === "APPLICABLE" 
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
        secondaryBadge: `${activeNode.applicability.entities.length} Entity Groups`,
        text: `Criteria: ${activeNode.applicability.criteria}`,
        details: [
          { label: "Status", value: activeNode.applicability.status },
          { label: "Entity Scope", value: activeNode.applicability.entities.slice(0, 2).join(", ") },
          { label: "Total Classes", value: `${activeNode.applicability.entities.length} Classified` },
          { label: "Enforceability", value: "Mandatory" },
        ],
      },
      {
        step: "04",
        label: "Control",
        shortLabel: "Control",
        stage: "Stage 04 · Internal Control Mapping",
        title: activeNode.control.name,
        subtitle: `${activeNode.control.framework} · Owner: ${activeNode.control.owner}`,
        badge: activeNode.control.id,
        badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
        secondaryBadge: activeNode.control.implementationStatus,
        text: `“Internal safeguard ${activeNode.control.id} mapped to enforce statutory mandates under ${activeNode.regulation.regulator} guidelines with continuous verification.”`,
        details: [
          { label: "Control ID", value: activeNode.control.id },
          { label: "Framework", value: activeNode.control.framework },
          { label: "Owner", value: activeNode.control.owner },
          { label: "Implementation", value: activeNode.control.implementationStatus },
        ],
      },
      {
        step: "05",
        label: "Evidence",
        shortLabel: "Evidence",
        stage: "Stage 05 · Audit Evidence",
        title: activeNode.evidence.name,
        subtitle: `${activeNode.evidence.documentType} · Last audited ${activeNode.evidence.lastAuditDate}`,
        badge: activeNode.evidence.status,
        badgeClass: activeNode.evidence.status === "VERIFIED"
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
        secondaryBadge: activeNode.evidence.id,
        text: `“Evidence artifact ${activeNode.evidence.id} is recorded with status ${activeNode.evidence.status}.”`,
        details: [
          { label: "Evidence ID", value: activeNode.evidence.id },
          { label: "Doc Type", value: activeNode.evidence.documentType },
          { label: "Audit State", value: activeNode.evidence.status },
          { label: "Last Audited", value: activeNode.evidence.lastAuditDate },
        ],
        items: evItems.length > 1 || (evItems.length === 1 && !!multi.evidenceItems)
          ? evItems.map((e) => ({ title: e.name, meta: `${e.documentType} · Last audited ${e.lastAuditDate}`, badge: e.status, badgeClass: evCls(e.status) }))
          : undefined,
      },
      {
        step: "06",
        label: "Testing",
        shortLabel: "Testing",
        stage: "Stage 06 · Control Testing",
        title: `Control Test: ${activeNode.testing.testType.replace(/_/g, " ")}`,
        subtitle: `Cadence: ${activeNode.testing.frequency} · Evaluated: ${activeNode.testing.lastTested}`,
        badge: activeNode.testing.result,
        badgeClass: activeNode.testing.result === "PASSED"
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
          : activeNode.testing.result === "DEFICIENT"
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
        secondaryBadge: activeNode.testing.id,
        text: `“Last ${activeNode.testing.testType.replace(/_/g, " ").toLowerCase()} recorded as ${activeNode.testing.result} on ${activeNode.testing.lastTested}.”`,
        details: [
          { label: "Test ID", value: activeNode.testing.id },
          { label: "Method", value: activeNode.testing.testType },
          { label: "Cadence", value: activeNode.testing.frequency },
          { label: "Last Evaluated", value: activeNode.testing.lastTested },
        ],
        items: testItems.length > 0
          ? testItems.map((t) => ({ title: t.testType.replace(/_/g, " "), meta: `${t.frequency} · Last tested ${t.lastTested}`, badge: t.result, badgeClass: testCls(t.result) }))
          : undefined,
      },
      {
        step: "07",
        label: "Gap",
        shortLabel: "Gap",
        stage: "Stage 07 · Gap & Risk Analysis",
        title: activeNode.gap.id ? activeNode.gap.title ?? activeNode.gap.id : "Zero Compliance Gaps Identified",
        subtitle: activeNode.gap.id ? `${activeNode.gap.riskLevel} Risk Deficiency${activeNode.gap.openedDaysAgo !== undefined ? ` · Opened ${activeNode.gap.openedDaysAgo} days ago` : ""}` : "Control fully conforms with statutory SLA requirements",
        badge: activeNode.gap.id ? `${activeNode.gap.riskLevel} RISK` : "CONFORMANT",
        badgeClass: activeNode.gap.id
          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
        secondaryBadge: activeNode.gap.id ? (activeNode.gap.status || "OPEN") : "Compliant",
        text: activeNode.gap.id 
          ? `“Deficiency ${activeNode.gap.id}: ${activeNode.gap.title}. Risk tier evaluated as ${activeNode.gap.riskLevel} under supervisory governance review.”`
          : "“No non-compliance conditions or latency SLA breaches detected for this control pathway.”",
        details: [
          { label: "Gap ID", value: activeNode.gap.id || "None" },
          { label: "Risk Level", value: activeNode.gap.riskLevel || "Low" },
          { label: "Workflow State", value: activeNode.gap.status || "Resolved / Nil" },
          { label: "Open Aging", value: activeNode.gap.openedDaysAgo !== undefined ? `${activeNode.gap.openedDaysAgo} days` : "0 days" },
        ],
      },
      {
        step: "08",
        label: "Remediation",
        shortLabel: "Fix",
        stage: "Stage 08 · Remediation & Work Order",
        title: activeNode.remediation.actionSummary || "No Remediation Required",
        subtitle: activeNode.remediation.workOrderId ? `Work Order: ${activeNode.remediation.workOrderId}${activeNode.remediation.leadTeam ? ` · Lead: ${activeNode.remediation.leadTeam}` : ""}` : "Operational safeguards healthy and aligned",
        badge: activeNode.remediation.status || "NONE",
        badgeClass: activeNode.remediation.status === "VERIFIED" 
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
          : activeNode.remediation.workOrderId
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
          : "bg-muted text-muted-foreground border border-border/40",
        secondaryBadge: activeNode.remediation.slaDays ? `SLA: ${activeNode.remediation.slaDays}d` : "Nominal",
        text: activeNode.remediation.actionSummary 
          ? `“Action plan: ${activeNode.remediation.actionSummary}. Assigned Team: ${activeNode.remediation.leadTeam || "Unassigned"} with SLA target of ${activeNode.remediation.slaDays || "N/A"} days.”`
          : "“All control objectives satisfied. No active mitigation tickets or engineering PRs required.”",
        details: [
          { label: "Work Order", value: activeNode.remediation.workOrderId || "None" },
          { label: "Assigned Team", value: activeNode.remediation.leadTeam || "Security Ops" },
          { label: "SLA Target", value: activeNode.remediation.slaDays ? `${activeNode.remediation.slaDays} days` : "N/A" },
          { label: "State", value: activeNode.remediation.status || "Healthy" },
        ],
      },
      {
        step: "09",
        label: "Monitoring",
        shortLabel: "Telemetry",
        stage: "Stage 09 · Monitoring & KPIs",
        title: `Metric: ${activeNode.monitoring.kpi}`,
        subtitle: `Source: ${activeNode.monitoring.telemetrySource} · Threshold: ${activeNode.monitoring.threshold}`,
        badge: activeNode.monitoring.health,
        badgeClass: activeNode.monitoring.health === "HEALTHY"
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
          : activeNode.monitoring.health === "WARNING"
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
        secondaryBadge: activeNode.monitoring.currentValue,
        text: `“Current reading: ${activeNode.monitoring.currentValue} against statutory tolerance limit of ${activeNode.monitoring.threshold}. Source: ${activeNode.monitoring.telemetrySource}.”`,
        details: [
          { label: "Metric KPI", value: activeNode.monitoring.kpi },
          { label: "Current Value", value: activeNode.monitoring.currentValue },
          { label: "Threshold", value: activeNode.monitoring.threshold },
          { label: "Telemetry Source", value: activeNode.monitoring.telemetrySource },
        ],
        items: kpiItems.length > 0
          ? kpiItems.map((k) => ({ title: k.kpi, meta: `${k.currentValue} vs ${k.threshold} · ${k.telemetrySource}`, badge: k.health, badgeClass: kpiCls(k.health) }))
          : undefined,
      },
    ];
  }, [activeNode]);

  useEffect(() => {
    if (!isPlaying || steps.length === 0) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, STEP_DURATION);
    return () => clearInterval(interval);
  }, [isPlaying, steps.length]);

  if (isLoading && !activeNode) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-sm text-muted-foreground">
        Loading lineage...
      </div>
    );
  }

  if (!activeNode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold mb-2">Lineage Not Found</h2>
        <p className="text-muted-foreground mb-4">The requested traceability lineage could not be found.</p>
        <Button onClick={() => navigate("/traceability")}>Back to Matrix</Button>
      </div>
    );
  }

  const current = steps[activeStep] || steps[0];

  return (
    <div className="relative flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto bg-background">
      {/* Background Dot Pattern */}
      <DotPattern
        position="absolute"
        className="absolute inset-0 opacity-40 pointer-events-none"
        dotSize={1.5}
        gap={26}
        baseColor="#8a8f98"
        glowColor="#71717a"
        proximity={90}
        waveSpeed={0.15}
      />

      <div className="relative z-10 flex flex-col w-full p-4 md:p-6 space-y-6">
        {/* Top Navigation & Context Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/traceability")}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer -ml-1"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Traceability Matrix
            </Button>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/5 text-primary text-[10px] font-semibold tracking-wider font-mono">
                {activeNode.id}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-medium tracking-wide">
                {activeNode.regulation.regulator}
              </Badge>
            </div>
          </div>

          {/* Quick Lineage Selector / Pagination */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="ghost"
              size="sm"
              disabled={!prevNode}
              onClick={() => prevNode && goTo(prevNode.id)}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
              title={prevNode ? `Previous: ${prevNode.id}` : "No previous lineage"}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Prev Lineage
            </Button>
            <span className="text-xs font-mono text-muted-foreground/60 px-1">
              {currentIndex + 1} / {list.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={!nextNode}
              onClick={() => nextNode && goTo(nextNode.id)}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
              title={nextNode ? `Next: ${nextNode.id}` : "No next lineage"}
            >
              Next Lineage
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>

        {/* Title & Metadata Strip */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-1">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{activeNode.regulation.reference}</span>
              <span>·</span>
              <span className="font-medium text-foreground/80">{activeNode.control.framework}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              {activeNode.control.name}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-normal">
              9-hop lineage from statutory circular through control, evidence, testing, gap and remediation to monitoring.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSignoff} disabled={isSigning || (isDemo && demoSigned)} className="h-9 text-xs cursor-pointer">
              {signoff || demoSigned ? (isDemo ? "Signed" : "Re-sign") : "Sign-off"}
            </Button>
            {signoff && (
              <div className="rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 text-left">
                <p className="text-[10px] font-mono text-muted-foreground uppercase leading-none">
                  Signed {signoff.signedRole ?? ""}
                </p>
                <p className="text-xs font-semibold mt-0.5 leading-none">
                  {new Date(signoff.signedAt).toLocaleString()}
                  {signoff.contentHash ? ` · ${signoff.contentHash.slice(0, 10)}` : ""}
                </p>
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/60 px-3 py-1.5 backdrop-blur-sm shadow-xs">
              <ShieldCheck className={`h-4 w-4 ${integrity.cls}`} />
              <div className="text-left">
                <p className="text-[10px] font-mono text-muted-foreground uppercase leading-none">Lineage Integrity</p>
                <p className={`text-xs font-semibold mt-0.5 leading-none ${integrity.cls}`}>
                  {integrity.label}
                  {integrity.detail ? ` · ${integrity.detail}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── ENTERPRISE COMPLIANCE SHOWCASE CARD (Matching auth-showcase-panel) ──── */}
        <div
          className="w-full rounded-2xl bg-card p-6 sm:p-8 text-left border border-border/50 shadow-sm relative backdrop-blur-xs"
          onMouseEnter={() => setIsPlaying(false)}
          onMouseLeave={() => setIsPlaying(true)}
        >
          {/* Stepper Segmented Control — Spacious Borderless Pill Navigation */}
          <div className="flex items-center gap-1 rounded-xl bg-muted/50 p-1.5 overflow-x-auto no-scrollbar">
            {steps.map((s, idx) => {
              const isActive = idx === activeStep;
              return (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => {
                    setActiveStep(idx);
                    setIsPlaying(false);
                  }}
                  className={`relative flex-1 min-w-[70px] sm:min-w-0 py-2 px-1.5 text-center rounded-lg transition-colors cursor-pointer text-xs font-mono shrink-0 sm:shrink ${
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="traceabilityActiveStepPill"
                      className="absolute inset-0 rounded-lg bg-background shadow-xs"
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 block truncate">
                    <span className="opacity-50 mr-1">{s.step}</span>
                    <span className="hidden md:inline">{s.label}</span>
                    <span className="inline md:hidden">{s.shortLabel}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Stage Content — Generous Height, Stable and Elegant */}
          <div className="relative mt-6 min-h-[240px] flex flex-col justify-between overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.step}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col justify-between h-full space-y-4"
              >
                {/* Header: Stage name + Badges */}
                <div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      {current.stage}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {current.secondaryBadge && (
                        <span className="hidden sm:inline-block rounded bg-muted/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {current.secondaryBadge}
                        </span>
                      )}
                      <span
                        className={`rounded px-2.5 py-0.5 font-mono text-[10px] font-medium transition-colors ${
                          current.badgeClass || "bg-muted text-foreground/80"
                        }`}
                      >
                        {current.badge}
                      </span>
                    </div>
                  </div>
                  <h3 className="mt-2 text-base sm:text-xl font-semibold text-foreground tracking-tight">
                    {current.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {current.subtitle}
                  </p>
                </div>

                {/* Callout Quote Surface — Soft Neutral Background */}
                <div className="rounded-xl bg-muted/40 p-4 border border-border/30">
                  <p className="text-xs sm:text-sm leading-relaxed text-foreground/85">
                    {current.text}
                  </p>
                </div>

                {current.items && current.items.length > 0 && (
                  <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
                    {current.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 border border-border/20">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground/90 truncate">{it.title}</p>
                          <p className="font-mono text-[10px] text-muted-foreground truncate">{it.meta}</p>
                        </div>
                        <span className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px] ${it.badgeClass}`}>{it.badge}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Structured Metadata Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {current.details.map((d, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-muted/30 px-3 py-2 flex flex-col justify-center border border-border/20"
                    >
                      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                        {d.label}
                      </span>
                      <span className="font-mono text-[11px] font-medium text-foreground/90 truncate mt-0.5">
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom Progress & Playback Controls */}
          <div className="mt-6 pt-4 flex items-center justify-between border-t border-border/20">
            {/* Step Progress Segments */}
            <div className="flex items-center gap-1.5 flex-1 max-w-[340px]">
              {steps.map((_, idx) => {
                const isActive = idx === activeStep;
                const isPassed = idx < activeStep;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActiveStep(idx);
                      setIsPlaying(false);
                    }}
                    className="relative h-1.5 flex-1 rounded-full bg-muted overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                    title={`Jump to step ${idx + 1}`}
                  >
                    {isActive && isPlaying ? (
                      <motion.div
                        key={`prog-${activeStep}`}
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{
                          duration: STEP_DURATION / 1000,
                          ease: "linear",
                        }}
                        className="h-full bg-foreground/70"
                      />
                    ) : (
                      <div
                        className={`h-full ${
                          isPassed || (isActive && !isPlaying)
                            ? "bg-foreground/70 w-full"
                            : "w-0"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer text-xs font-medium"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-3 w-3" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" /> Play
                  </>
                )}
              </button>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveStep((prev) => (prev - 1 + steps.length) % steps.length);
                    setIsPlaying(false);
                  }}
                  className="p-1 hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Previous step"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-mono text-xs px-1.5 text-muted-foreground">
                  {activeStep + 1} of {steps.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveStep((prev) => (prev + 1) % steps.length);
                    setIsPlaying(false);
                  }}
                  className="p-1 hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Next step"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

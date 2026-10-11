import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { DotPattern } from "@/components/dot-pattern";

interface StepDetail {
  label: string;
  value: string;
}

interface StepData {
  step: string;
  label: string;
  stage: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeClass?: string;
  secondaryBadge?: string;
  text: string;
  details: StepDetail[];
}

const steps: StepData[] = [
  {
    step: "01",
    label: "Regulations",
    stage: "Stage 01 · Regulatory Ingestion",
    title: "RBI Master Direction on IT Governance",
    subtitle: "Automated ingestion of central bank regulatory framework",
    badge: "RBI/2023-24/105",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
    secondaryBadge: "Banking Regulation",
    text: "“Central bank circular parsed into structured chapters, sections, and enforceable mandates with full parent-child hierarchy and provenance tracing.”",
    details: [
      { label: "Scope", value: "Commercial Banks & NBFCs" },
      { label: "Parsed", value: "48 Clauses" },
      { label: "Provenance", value: "100% Verifiable" },
    ],
  },
  {
    step: "02",
    label: "Obligations",
    stage: "Stage 02 · Obligation Extraction",
    title: "Mandate 4.2(a) Extracted",
    subtitle: "Natural language obligation mapping with strict enforcement criteria",
    badge: "Clause 4.2(a)",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
    secondaryBadge: "Payment STP",
    text: "“Regulated entities shall ensure that all manual overrides in Straight-Through Processing pipelines require dual supervisory approval prior to settlement.”",
    details: [
      { label: "Target", value: "Payment Gateway STP" },
      { label: "Requirement", value: "Dual Supervisory Approval" },
      { label: "Severity", value: "High Criticality" },
    ],
  },
  {
    step: "03",
    label: "Controls",
    stage: "Stage 03 · Control Mapping",
    title: "Internal Safeguards Cross-Referenced",
    subtitle: "Automated cross-mapping against internal controls & frameworks",
    badge: "ISO 27001 · SOC 2",
    badgeClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
    secondaryBadge: "Annex A.9",
    text: "“Verified against internal security catalog. 15 controls active; 1 missing control identified in payment override worker authorization service.”",
    details: [
      { label: "Coverage", value: "15 / 16 Safeguards" },
      { label: "Frameworks", value: "SOC 2 CC6.1 · ISO 27001" },
      { label: "Gap Found", value: "1 Deficiency" },
    ],
  },
  {
    step: "04",
    label: "Gaps",
    stage: "Stage 04 · Gap Detection",
    title: "Compliance Gap: GAP-RBI-STP-01",
    subtitle: "Audit failure detected in manual override authorization pipeline",
    badge: "High Severity",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
    secondaryBadge: "Audit Finding",
    text: "“Payment gateway worker allows single-operator manual overrides, violating RBI 4.2(a) and SOC 2 dual-authorization requirements.”",
    details: [
      { label: "Component", value: "Payment Worker Service" },
      { label: "Root Cause", value: "Single-Operator Override" },
      { label: "Status", value: "Audit Finding" },
    ],
  },
  {
    step: "05",
    label: "Remediation",
    stage: "Stage 05 · Remediation & Evidence",
    title: "Automated Policy Patch & Audit Trail",
    subtitle: "Code amendment and cryptographic verification package ready for review",
    badge: "PR #148 Ready",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
    secondaryBadge: "Zero Drift",
    text: "“Dual-Control Authorization Amendment drafted with direct regulatory citations, automated test coverage, and immutable cryptographic evidence hash.”",
    details: [
      { label: "Pull Request", value: "PR #148 (Dual Authorization)" },
      { label: "Evidence Hash", value: "0x8f4c...3e2a" },
      { label: "Audit State", value: "Audit Ready" },
    ],
  },
];

const STEP_DURATION = 4500;

export function AuthShowcasePanel() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, STEP_DURATION);
    return () => clearInterval(interval);
  }, [isPlaying, activeStep]);

  const current = steps[activeStep];

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col items-center justify-center overflow-y-auto bg-muted/20 border-l border-border/40 p-6 md:p-10 xl:p-14">
      {/* Dot Pattern Background */}
      <DotPattern
        position="absolute"
        className="absolute inset-0 opacity-45"
        dotSize={1.5}
        gap={26}
        baseColor="#8a8f98"
        glowColor="#71717a"
        proximity={90}
        waveSpeed={0.15}
      />

      <div className="relative z-10 flex w-full max-w-xl xl:max-w-2xl flex-col items-center text-center my-auto py-4">
        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          Banking & Financial Regulatory Compliance
        </h2>

        {/* Subtitle */}
        <p className="mt-1.5 max-w-md text-xs sm:text-sm text-muted-foreground leading-normal">
          Regulation to remediation, traced end to end.
        </p>

        {/* ── ENTERPRISE COMPLIANCE SHOWCASE CARD ──── */}
        <div
          className="mt-8 w-full rounded-2xl bg-card p-6 sm:p-7 text-left border border-border/50 shadow-sm"
          onMouseEnter={() => setIsPlaying(false)}
          onMouseLeave={() => setIsPlaying(true)}
        >
          {/* Stepper Segmented Control — Spacious Borderless Pill Navigation */}
          <div className="flex items-center justify-between gap-1 rounded-xl bg-muted/50 p-1.5">
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
                  className={`relative flex-1 py-2 px-1.5 text-center rounded-lg transition-colors cursor-pointer text-xs font-mono ${
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeStepPill"
                      className="absolute inset-0 rounded-lg bg-background shadow-xs"
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 block truncate">
                    <span className="opacity-50 mr-1">{s.step}</span>
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Stage Content — Generous Fixed Height, Stable and Elegant */}
          <div className="relative mt-6 h-[225px] flex flex-col justify-between overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.step}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col justify-between h-full"
              >
                {/* Header: Stage name + Badges */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      {current.stage}
                    </span>
                    <div className="flex items-center gap-1.5">
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
                  <h3 className="mt-1.5 text-base sm:text-lg font-semibold text-foreground">
                    {current.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {current.subtitle}
                  </p>
                </div>

                {/* Callout Quote Surface — Soft Neutral Background */}
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-xs sm:text-sm leading-relaxed text-foreground/85 line-clamp-2">
                    {current.text}
                  </p>
                </div>

                {/* Structured Metadata Row */}
                <div className="grid grid-cols-3 gap-2">
                  {current.details.map((d, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-muted/30 px-3 py-1.5 flex flex-col justify-center"
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
            <div className="flex items-center gap-2 flex-1 max-w-[260px]">
              {steps.map((_, idx) => {
                const isActive = idx === activeStep;
                const isPassed = idx < activeStep;

                return (
                  <div
                    key={idx}
                    className="relative h-1 flex-1 rounded-full bg-muted overflow-hidden"
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
                  </div>
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




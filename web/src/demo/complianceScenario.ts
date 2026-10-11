import type { BackendCircular } from "@/lib/circulars";
import type { BackendObligation, ObligationSummary } from "@/lib/obligations";
import type { BackendControl } from "@/lib/controls";
import { RiskLevel, GapStatus } from "@/types/enums";
import { getAllRbiCircularsForList, getRbiCircularById } from "@/data/rbiMasterDirectionsIndexed";
import { getAllSebiCircularsForList } from "@/data/sebiMasterCirculars";
import { NBFC_IT_FRAMEWORK_10999_QUESTIONS, NBFC_IT_FRAMEWORK_10999_RECOMMENDATIONS } from "@/data/nbfcItFramework10999";
import { RBI_IT_GOV_12562_QUESTIONS, RBI_IT_GOV_12562_RECOMMENDATIONS } from "@/data/rbiItGovFramework12562";
import {
  SEBI_STOCK_BROKERS_QUESTIONS,
  SEBI_STOCK_BROKERS_RECOMMENDATIONS,
  SEBI_MUTUAL_FUNDS_QUESTIONS,
  SEBI_MUTUAL_FUNDS_RECOMMENDATIONS,
  SEBI_MII_GOVERNANCE_QUESTIONS,
  SEBI_MII_GOVERNANCE_RECOMMENDATIONS,
} from "@/data/circularControlsAndQuestions";
import { ISO_27001_QUESTIONS, ISO_27001_RECOMMENDATIONS } from "@/data/iso27001";
import { ISO_9001_QUESTIONS, ISO_9001_RECOMMENDATIONS } from "@/data/iso9001";

// Single source of truth for the demo-mode walkthrough of the pipeline
// (Regulations -> Obligations -> Controls -> Gaps & Remediation). Every
// page's isDemo branch should read from here instead of keeping its own
// local mock constants, so the story stays internally consistent — an
// obligation's circular actually exists, a control's framework actually
// matches the circular it was mapped from, and dashboard/sidebar counts
// are derived from these same rows instead of separately hand-maintained
// numbers that can silently drift apart.
//
// Anchor: circular id "211" in rbiMasterDirections.ts — the RBI Master
// Direction on the "Information Technology Framework for the NBFC Sector"
// (rbi.org.in id=10999). It's the same circular /regulations/211 shows,
// and it already has a full curated set of 65 AI recommendations + 66
// assessment questions in nbfcItFramework10999.ts, so every obligation,
// control and gap below is a real excerpt of that same document instead
// of an invented, disconnected circular.

const ANCHOR_CIRCULAR = getRbiCircularById("211")!;

// ── Circulars ────────────────────────────────────────────────────────────

export const DEMO_CIRCULARS: Record<string, Pick<BackendCircular, "id" | "name" | "circularId">> = {
  "211": {
    id: "211",
    name: ANCHOR_CIRCULAR.name,
    circularId: ANCHOR_CIRCULAR.circularId,
  },
};

export const DEMO_CIRCULAR_LIST = Object.values(DEMO_CIRCULARS);

function findRec(id: string) {
  const rec = ANCHOR_CIRCULAR.aiRecommendations.find((r) => r.id === id);
  if (!rec) throw new Error(`nbfcItFramework10999: recommendation ${id} not found`);
  return rec;
}

// ── Obligations ──────────────────────────────────────────────────────────
// Each one is a real recommendation from the circular's own indexed
// content (see nbfcItFramework10999.ts), rephrased as the regulatory
// requirement an extraction agent would have pulled it from.

const SECTION_BY_CATEGORY: Record<string, string> = {
  Governance: "Chapter I — IT Governance",
  Security: "Chapter II — Information & Cyber Security",
  Compliance: "Chapter II — Cyber Security (Incident Reporting)",
  "Business Continuity": "Chapter VI — Business Continuity Planning",
  Outsourcing: "Chapter V — IT Services Outsourcing",
  Operations: "Chapter III — IT Operations",
  Assurance: "Chapter IV — IS Audit",
};

export const DEMO_OBLIGATIONS_PRELOADED: BackendObligation[] = [
  {
    id: "demo-obl-1",
    identifier: "OBL-00001",
    organizationId: "org1",
    circularId: "211",
    requirementText: findRec("REC-01").description,
    obligationType: "GOVERNANCE",
    deadline: "Ongoing — tracked to closure",
    applicabilityConditions: ["All NBFCs regulated under this Master Direction"],
    penalty: "Supervisory action for non-compliance with Board oversight requirements",
    sourceQuote: "The regulated entity shall place this Master Direction, together with a formal IT/IS gap analysis and a time-bound action plan, before its Board, and shall track the plan to closure within the timelines specified by the Bank.",
    sourceSection: SECTION_BY_CATEGORY.Governance,
    sourceFileId: "demo-file-1",
    sourcePage: 1,
    sourceRegion: { x: 0.0625, y: 0.118, w: 0.875, h: 0.064 },
    citationVerified: true,
    confidence: 0.92,
    status: "CONFIRMED",
    extractionModel: "claude-sonnet-5",
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "demo-obl-2",
    identifier: "OBL-00002",
    organizationId: "org1",
    circularId: "211",
    requirementText: findRec("REC-10").description,
    obligationType: "GOVERNANCE",
    deadline: null,
    applicabilityConditions: [],
    penalty: null,
    sourceQuote: "The regulated entity shall maintain a Board-approved Information Security Policy addressing the confidentiality, integrity, availability and authenticity of its information assets.",
    sourceSection: SECTION_BY_CATEGORY.Security,
    sourceFileId: null,
    sourcePage: null,
    sourceRegion: null,
    citationVerified: true,
    confidence: 0.9,
    status: "EXTRACTED",
    extractionModel: "claude-sonnet-5",
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "demo-obl-3",
    identifier: "OBL-00003",
    organizationId: "org1",
    circularId: "211",
    requirementText: findRec("REC-20").description,
    obligationType: "GOVERNANCE",
    deadline: null,
    applicabilityConditions: [],
    penalty: "Escalation to RBI supervisory review",
    sourceQuote: "The regulated entity shall implement a Board-approved Cyber Security Policy distinct from its Information Security Policy, defining its cyber risk strategy and escalation mechanisms.",
    sourceSection: SECTION_BY_CATEGORY.Security,
    sourceFileId: null,
    sourcePage: null,
    sourceRegion: null,
    citationVerified: false,
    confidence: 0.64,
    status: "EXTRACTED",
    extractionModel: "claude-sonnet-5",
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

// What re-running extraction finds in addition — same circular, deeper pass.
const DEMO_OBLIGATIONS_ADDITIONAL: BackendObligation[] = [
  {
    id: "demo-obl-4",
    identifier: "OBL-00004",
    organizationId: "org1",
    circularId: "211",
    requirementText: findRec("REC-24").description,
    obligationType: "REPORTING",
    deadline: "Per Annex I timelines",
    applicabilityConditions: [],
    penalty: "Directions under the RBI Act for delayed or missed reporting",
    sourceQuote: "The regulated entity shall report unusual cyber security incidents, whether successful or attempted, to DNBS Central Office using the Annex I template within the timelines prescribed.",
    sourceSection: SECTION_BY_CATEGORY.Compliance,
    sourceFileId: null,
    sourcePage: null,
    sourceRegion: null,
    citationVerified: true,
    confidence: 0.87,
    status: "EXTRACTED",
    extractionModel: "claude-sonnet-5",
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "demo-obl-5",
    identifier: "OBL-00005",
    organizationId: "org1",
    circularId: "211",
    requirementText: findRec("REC-46").description,
    obligationType: "OPERATIONAL",
    deadline: "Annual Board review",
    applicabilityConditions: ["Entities with critical or customer-facing systems"],
    penalty: null,
    sourceQuote: "The regulated entity shall maintain a Board-approved Business Continuity Plan and report on its performance and issues to the Board periodically.",
    sourceSection: SECTION_BY_CATEGORY["Business Continuity"],
    sourceFileId: null,
    sourcePage: null,
    sourceRegion: null,
    citationVerified: true,
    confidence: 0.89,
    status: "EXTRACTED",
    extractionModel: "claude-sonnet-5",
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "demo-obl-6",
    identifier: "OBL-00006",
    organizationId: "org1",
    circularId: "211",
    requirementText: findRec("REC-52").description,
    obligationType: "GOVERNANCE",
    deadline: null,
    applicabilityConditions: ["Entities outsourcing IT services to third parties"],
    penalty: null,
    sourceQuote: "The regulated entity shall adopt a Board-approved policy for IT outsourcing aligned to its strategy, covering risk assessment, due diligence and ongoing oversight of service providers.",
    sourceSection: SECTION_BY_CATEGORY.Outsourcing,
    sourceFileId: null,
    sourcePage: null,
    sourceRegion: null,
    citationVerified: true,
    confidence: 0.83,
    status: "EXTRACTED",
    extractionModel: "claude-sonnet-5",
    reviewedById: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Pre-extraction state: what the circular's obligations page shows before
// "Re-run Extraction" is clicked (3 obligations already on file).
export const DEMO_OBLIGATIONS_BY_CIRCULAR: Record<string, BackendObligation[]> = {
  "211": DEMO_OBLIGATIONS_PRELOADED,
};

// What running extraction produces — a deeper pass over the same circular
// surfaces the other 3 obligations too.
export const DEMO_EXTRACTION_RESULT_BY_CIRCULAR: Record<string, BackendObligation[]> = {
  "211": [...DEMO_OBLIGATIONS_PRELOADED, ...DEMO_OBLIGATIONS_ADDITIONAL],
};

// Landing-grid summaries for /obligations — derived from the obligations
// above instead of hand-maintained, so totals/verified counts can't drift.
export function buildDemoObligationSummaries(): ObligationSummary[] {
  return Object.entries(DEMO_OBLIGATIONS_BY_CIRCULAR)
    .filter(([, obligations]) => obligations.length > 0)
    .map(([circularId, obligations]) => {
      const circular = DEMO_CIRCULARS[circularId];
      return {
        circularId,
        circularName: circular.name,
        circularCode: circular.circularId,
        category: "RBI",
        total: obligations.length,
        verified: obligations.filter((o) => o.citationVerified).length,
        confirmed: obligations.filter((o) => o.status === "CONFIRMED").length,
        dismissed: obligations.filter((o) => o.status === "DISMISSED").length,
        lastExtractedAt: obligations.reduce((latest, o) => (o.createdAt > latest ? o.createdAt : latest), obligations[0].createdAt),
      } satisfies ObligationSummary;
    });
}

// ── Controls across All Master Directions & Frameworks ────────────────────
const DEMO_GAP_CONTROL_IDS = new Set<string>(["Q-RBI-09", "Q-RBI-19", "Q-RBI-29", "ITG-Q-05"]);

// Demo rows are authored with the UI's display strings; convert them to the
// shared Control shape (uppercase enums) — Dashboard maps them back for display.
type DemoControlRow = {
  id: string;
  organizationId: string;
  source: "ai" | "manual";
  circularId: string;
  title: string;
  description: string;
  relevance: string;
  category: string;
  framework: string;
  status: "Active" | "Compliance Gap";
  createdAt: string;
  updatedAt: string;
};

function toBackendControl(r: DemoControlRow): BackendControl {
  return {
    ...r,
    code: null,
    source: r.source === "manual" ? "MANUAL" : "AI",
    relevance: r.relevance.toUpperCase() as BackendControl["relevance"],
    status: r.status === "Compliance Gap" ? "COMPLIANCE_GAP" : "ACTIVE",
    implementationStatus: null,
    ownerName: null,
    answer: null,
    notes: null,
  };
}

// 1. NBFC Master Direction (RBI/MD/nbfc/211)
const nbfcControls: DemoControlRow[] = NBFC_IT_FRAMEWORK_10999_QUESTIONS.map((q, idx) => {
  const recId = q.id.replace("Q-RBI-", "REC-");
  const rec = NBFC_IT_FRAMEWORK_10999_RECOMMENDATIONS.find((r) => r.id === recId);
  const isGap = DEMO_GAP_CONTROL_IDS.has(q.id);
  const createdDaysAgo = 7 - (idx % 7);
  const created = new Date(Date.now() - 86400000 * createdDaysAgo).toISOString();

  return {
    id: q.id,
    organizationId: "org1",
    source: q.source ?? "ai",
    circularId: "211",
    title: rec ? rec.title : q.title,
    description: rec ? rec.description : (q.answer ?? ""),
    relevance: rec?.relevance ?? (isGap ? "High" : "Medium"),
    category: rec?.category ?? "Governance",
    framework: "RBI/MD/nbfc/211",
    status: isGap ? "Compliance Gap" : "Active",
    createdAt: created,
    updatedAt: created,
  };
});

// 2. Commercial Banking Master Direction (RBI/MD/cb/12562)
const cbControls: DemoControlRow[] = RBI_IT_GOV_12562_QUESTIONS.map((q, idx) => {
  const recId = q.id.replace("ITG-Q-", "ITG-REC-");
  const rec = RBI_IT_GOV_12562_RECOMMENDATIONS.find((r) => r.id === recId);
  const isGap = DEMO_GAP_CONTROL_IDS.has(q.id);
  const createdDaysAgo = 6 - (idx % 6);
  const created = new Date(Date.now() - 86400000 * createdDaysAgo).toISOString();

  return {
    id: q.id,
    organizationId: "org1",
    source: q.source ?? "ai",
    circularId: "12562",
    title: rec ? rec.title : q.title,
    description: rec ? rec.description : (q.answer ?? ""),
    relevance: rec?.relevance ?? (isGap ? "High" : "Medium"),
    category: rec?.category ?? "Governance",
    framework: "RBI/MD/cb/12562",
    status: isGap ? "Compliance Gap" : "Active",
    createdAt: created,
    updatedAt: created,
  };
});

// 3. SEBI Stock Brokers Master Circular
const sebiSbControls: DemoControlRow[] = SEBI_STOCK_BROKERS_QUESTIONS.map((q, idx) => {
  const recId = q.id.replace("Q-SEBI-SB-", "REC-SEBI-SB-");
  const rec = SEBI_STOCK_BROKERS_RECOMMENDATIONS.find((r) => r.id === recId);
  const created = new Date(Date.now() - 86400000 * (4 - idx)).toISOString();
  return {
    id: q.id,
    organizationId: "org1",
    source: q.source ?? "ai",
    circularId: "sebi-1",
    title: rec ? rec.title : q.title,
    description: rec ? rec.description : (q.answer ?? ""),
    relevance: rec?.relevance ?? "High",
    category: rec?.category ?? "Operations",
    framework: "SEBI/MC/MRD/2024/01",
    status: "Active",
    createdAt: created,
    updatedAt: created,
  };
});

// 4. SEBI Mutual Funds Master Circular
const sebiMfControls: DemoControlRow[] = SEBI_MUTUAL_FUNDS_QUESTIONS.map((q, idx) => {
  const recId = q.id.replace("Q-SEBI-MF-", "REC-SEBI-MF-");
  const rec = SEBI_MUTUAL_FUNDS_RECOMMENDATIONS.find((r) => r.id === recId);
  const created = new Date(Date.now() - 86400000 * (4 - idx)).toISOString();
  return {
    id: q.id,
    organizationId: "org1",
    source: q.source ?? "ai",
    circularId: "sebi-2",
    title: rec ? rec.title : q.title,
    description: rec ? rec.description : (q.answer ?? ""),
    relevance: rec?.relevance ?? "High",
    category: rec?.category ?? "Compliance",
    framework: "SEBI/MC/IMD/2024/02",
    status: "Active",
    createdAt: created,
    updatedAt: created,
  };
});

// 5. SEBI MII Governance Master Circular
const sebiMiiControls: DemoControlRow[] = SEBI_MII_GOVERNANCE_QUESTIONS.map((q, idx) => {
  const recId = q.id.replace("Q-SEBI-MII-", "REC-SEBI-MII-");
  const rec = SEBI_MII_GOVERNANCE_RECOMMENDATIONS.find((r) => r.id === recId);
  const created = new Date(Date.now() - 86400000 * (3 - idx)).toISOString();
  return {
    id: q.id,
    organizationId: "org1",
    source: q.source ?? "ai",
    circularId: "sebi-3",
    title: rec ? rec.title : q.title,
    description: rec ? rec.description : (q.answer ?? ""),
    relevance: rec?.relevance ?? "High",
    category: rec?.category ?? "Governance",
    framework: "SEBI/MC/MRD/2024/03",
    status: "Active",
    createdAt: created,
    updatedAt: created,
  };
});

// 6. ISO/IEC 27001 Standard
const iso27Controls: DemoControlRow[] = ISO_27001_QUESTIONS.map((q, idx) => {
  const recId = q.id.replace("Q-ISO27-", "ISO27-REC-");
  const rec = ISO_27001_RECOMMENDATIONS.find((r) => r.id === recId);
  const created = new Date(Date.now() - 86400000 * (5 - (idx % 5))).toISOString();
  return {
    id: q.id,
    organizationId: "org1",
    source: q.source ?? "ai",
    circularId: "fw-iso27001",
    title: rec ? rec.title : q.title,
    description: rec ? rec.description : (q.answer ?? ""),
    relevance: rec?.relevance ?? "High",
    category: rec?.category ?? "Security",
    framework: "ISO/IEC 27001:2022",
    status: "Active",
    createdAt: created,
    updatedAt: created,
  };
});

// 7. ISO 9001 Standard
const iso90Controls: DemoControlRow[] = ISO_9001_QUESTIONS.map((q, idx) => {
  const recId = q.id.replace("Q-ISO90-", "ISO90-REC-");
  const rec = ISO_9001_RECOMMENDATIONS.find((r) => r.id === recId);
  const created = new Date(Date.now() - 86400000 * (5 - (idx % 5))).toISOString();
  return {
    id: q.id,
    organizationId: "org1",
    source: q.source ?? "ai",
    circularId: "fw-iso9001",
    title: rec ? rec.title : q.title,
    description: rec ? rec.description : (q.answer ?? ""),
    relevance: rec?.relevance ?? "Medium",
    category: rec?.category ?? "Operations",
    framework: "ISO 9001:2015",
    status: "Active",
    createdAt: created,
    updatedAt: created,
  };
});

export const DEMO_CONTROLS: BackendControl[] = [
  ...nbfcControls,
  ...cbControls,
  ...sebiSbControls,
  ...sebiMfControls,
  ...sebiMiiControls,
  ...iso27Controls,
  ...iso90Controls,
].map(toBackendControl);

// ── Gaps & Remediation ───────────────────────────────────────────────────
// Each gap is an audit finding against one of this circular's own
// assessment questions (nbfcItFramework10999.ts) — shaped like Gaps.tsx's
// local `Issue` type (ComplianceGap plus UI-only display fields). Kept
// untyped here to avoid a circular import; Gaps.tsx asserts it as
// `Issue[]` on import, which typechecks structurally.

// Shared audit engagement name — also used by AuditLog.tsx and
// KnowledgeBase.tsx so a gap's "assessment" label, a past audit trail
// entry, and a historical Q&A source all point at the same engagement
// instead of three different invented names.
export const DEMO_AUDIT_NAME = "NBFC IT Framework Master Direction Audit";

export const DEMO_GAPS = [
  {
    id: "GAP-001",
    title: "Board hasn't yet reviewed a formal IT/IS gap analysis or time-bound action plan for this Master Direction (Q-RBI-01).",
    question: "Board hasn't yet reviewed a formal IT/IS gap analysis or time-bound action plan for this Master Direction (Q-RBI-01).",
    assessment: DEMO_AUDIT_NAME,
    section: "IT Governance",
    riskLevel: RiskLevel.CRITICAL,
    status: GapStatus.OPEN,
    assignee: { id: "u1", name: "Asha Rao", role: "Auditor", email: "asha@example.com" },
    assigneeInitials: "AR",
    openedDaysAgo: 14,
    evidenceNeeded: "Board meeting minutes where the Master Direction and IT/IS gap analysis were tabled, plus the time-bound action plan tracker.",
    organizationId: "org1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "GAP-002",
    title: "Vulnerability scans aren't yet running on the cadence the vulnerability management programme commits to (Q-RBI-21).",
    question: "Vulnerability scans aren't yet running on the cadence the vulnerability management programme commits to (Q-RBI-21).",
    assessment: DEMO_AUDIT_NAME,
    section: "Vulnerability Management",
    riskLevel: RiskLevel.HIGH,
    status: GapStatus.REMEDIATING,
    assignee: { id: "u2", name: "Rahul Mehta", role: "DevSecOps", email: "rahul@example.com" },
    assigneeInitials: "RM",
    openedDaysAgo: 9,
    evidenceNeeded: "Latest vulnerability scan report, remediation tracker, and evidence of risk-based prioritisation for open findings.",
    organizationId: "org1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "GAP-003",
    title: "Cyber incident reporting to RBI (Annex I) is still a manual, ad hoc process instead of system-driven (Q-RBI-24).",
    question: "Cyber incident reporting to RBI (Annex I) is still a manual, ad hoc process instead of system-driven (Q-RBI-24).",
    assessment: DEMO_AUDIT_NAME,
    section: "Cyber Incident Reporting",
    riskLevel: RiskLevel.HIGH,
    status: GapStatus.OPEN,
    assignee: { id: "u3", name: "Priya Iyer", role: "Privacy Lead", email: "priya@example.com" },
    assigneeInitials: "PI",
    openedDaysAgo: 21,
    evidenceNeeded: "Incident reporting SOP, a sample Annex I filing to DNBS Central Office, and system logs showing the detection-to-reporting timeline.",
    organizationId: "org1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "GAP-004",
    title: "No annual BCP/DR test against worst-case scenarios has been run or reported to the Board this year (Q-RBI-52).",
    question: "No annual BCP/DR test against worst-case scenarios has been run or reported to the Board this year (Q-RBI-52).",
    assessment: DEMO_AUDIT_NAME,
    section: "Business Continuity & DR",
    riskLevel: RiskLevel.HIGH,
    status: GapStatus.OPEN,
    assignee: { id: "u4", name: "Karan Singh", role: "SRE", email: "karan@example.com" },
    assigneeInitials: "KS",
    openedDaysAgo: 7,
    evidenceNeeded: "Signed BCP/DR plan, the most recent DR drill report, and Board minutes showing the gap analysis was reviewed.",
    organizationId: "org1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "GAP-005",
    title: "Outsourcing contracts with cloud/IT vendors don't yet include RBI's right-to-audit and data-access clauses (Q-RBI-54).",
    question: "Outsourcing contracts with cloud/IT vendors don't yet include RBI's right-to-audit and data-access clauses (Q-RBI-54).",
    assessment: "Vendor & Outsourcing Risk Review",
    section: "IT Outsourcing",
    riskLevel: RiskLevel.MEDIUM,
    status: GapStatus.REMEDIATING,
    assignee: { id: "u5", name: "Neha Sharma", role: "Procurement", email: "neha@example.com" },
    assigneeInitials: "NS",
    openedDaysAgo: 5,
    evidenceNeeded: "Updated vendor contract template with audit/data-access clauses, and a register of vendors still on the old template.",
    organizationId: "org1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "GAP-006",
    title: "Background checks for privileged users hired before 2022 weren't as rigorous as the current policy requires (Q-RBI-14).",
    question: "Background checks for privileged users hired before 2022 weren't as rigorous as the current policy requires (Q-RBI-14).",
    assessment: "Personnel Security Review",
    section: "Personnel Security",
    riskLevel: RiskLevel.MEDIUM,
    status: GapStatus.RISK_ACCEPTED,
    assignee: { id: "u6", name: "Vikram Patel", role: "HR Manager", email: "vikram@example.com" },
    assigneeInitials: "VP",
    openedDaysAgo: 3,
    evidenceNeeded: "Background verification vendor SLA, the current onboarding checklist, and the signed risk-acceptance memo for legacy staff.",
    organizationId: "org1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "GAP-007",
    title: "Minor and emergency changes to core banking configuration aren't consistently logged in the change register (Q-RBI-34).",
    question: "Minor and emergency changes to core banking configuration aren't consistently logged in the change register (Q-RBI-34).",
    assessment: DEMO_AUDIT_NAME,
    section: "Change Management",
    riskLevel: RiskLevel.LOW,
    status: GapStatus.OPEN,
    assignee: { id: "u5", name: "Neha Sharma", role: "Procurement", email: "neha@example.com" },
    assigneeInitials: "NS",
    openedDaysAgo: 2,
    evidenceNeeded: "Change log export for the last 2 quarters and sample change tickets covering emergency changes.",
    organizationId: "org1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ── Knowledge Base (historical Q&A) ─────────────────────────────────────
// Answers already on file from the same audit engagement, for questions
// this circular's own indexed content asks (nbfcItFramework10999.ts) —
// deliberately different REC/Q ids than the ones used as obligations,
// controls or open gaps above, so Knowledge Base reads as "what we already
// answered" rather than repeating the same handful of items everywhere.
// Shaped like KnowledgeBase.tsx's local `QuestionAnswerItem` type; kept
// untyped here to avoid a circular import, same as DEMO_GAPS above.

function toKnowledgeBaseEntry(
  recId: string,
  qId: string,
  answer: string,
  opts: { status?: string; daysAgo: number },
) {
  const rec = findRec(recId);
  const question = ANCHOR_CIRCULAR.questions?.find((q) => q.id === qId);
  return {
    id: recId,
    question: question?.title ?? `Has "${rec.title}" been implemented and documented?`,
    answer,
    sourceType: "internal" as const,
    sourceAssessment: DEMO_AUDIT_NAME,
    tags: [rec.category, "RBI/MD/nbfc/211"],
    status: opts.status ?? "verified",
    dateAdded: new Date(Date.now() - 86400000 * opts.daysAgo).toLocaleDateString(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }),
  };
}

export const DEMO_KNOWLEDGE_BASE = [
  toKnowledgeBaseEntry(
    "REC-05",
    "Q-RBI-05",
    "Yes — the Board-approved IT Policy was last reviewed in Q4 2025 and covers IT organisation structure, the CIO's mandate, training requirements and technology standards.",
    { daysAgo: 6 },
  ),
  toKnowledgeBaseEntry(
    "REC-09",
    "Q-RBI-09",
    "Core banking and payment-facing systems completed IPv6 migration in 2025; remaining internal-only systems are on a tracked plan through Q2 2026.",
    { daysAgo: 18 },
  ),
  toKnowledgeBaseEntry(
    "REC-19",
    "Q-RBI-19",
    "PKI is used for digitally signing high-value fund transfer instructions and critical documents, providing non-repudiation and integrity checks before execution.",
    { daysAgo: 30 },
  ),
  toKnowledgeBaseEntry(
    "REC-26",
    "Q-RBI-26",
    "Digital signature usage is governed under the Information Security Policy; only designated signatories can execute board resolutions and high-value transfers digitally.",
    { status: "review", daysAgo: 3 },
  ),
  toKnowledgeBaseEntry(
    "REC-39",
    "Q-RBI-39",
    "Regulatory returns are generated directly from core systems and filed through COSMOS; RBI inspectors have standing read-only access for on-site examinations.",
    { daysAgo: 45 },
  ),
];

export const DEMO_REMEDIATION_PLAN =
  "1. Assign the fix to the owning team and confirm a kickoff date within 2 weeks.\n2. Collect and attach the evidence listed above as interim proof of progress.\n3. Schedule a recurring review cadence so this doesn't lapse again.\n4. Share the remediation plan and target date with the bank's audit contact.";

// Statuses that mean a gap no longer needs attention — shared by the
// dashboard cards and the sidebar badge count so they can't disagree.
export const CLOSED_GAP_STATUSES = new Set<string>([GapStatus.RESOLVED, GapStatus.RISK_ACCEPTED]);

export const DEMO_OPEN_GAPS_COUNT = DEMO_GAPS.filter((g) => !CLOSED_GAP_STATUSES.has(g.status)).length;

// ── Dashboard aggregates ─────────────────────────────────────────────────
// Regulations count is the real curated RBI + SEBI reference library
// length, not a hand-typed number that goes stale as that data grows.

const DEMO_REGULATIONS_COUNT = getAllRbiCircularsForList().length + getAllSebiCircularsForList().length;

export function buildDemoDashboardCounts() {
  const summaries = buildDemoObligationSummaries();
  const obligationsTotal = summaries.reduce((sum, s) => sum + s.total, 0);
  const obligationsVerified = summaries.reduce((sum, s) => sum + s.verified, 0);
  return {
    regulations: DEMO_REGULATIONS_COUNT,
    obligations: obligationsTotal,
    obligationsVerifiedPct: obligationsTotal > 0 ? Math.round((obligationsVerified / obligationsTotal) * 100) : 0,
    controls: DEMO_CONTROLS.length,
    openGaps: DEMO_OPEN_GAPS_COUNT,
  };
}

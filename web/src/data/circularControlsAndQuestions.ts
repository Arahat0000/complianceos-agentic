/**
 * Linkage: recommendations, controls, and questions per item.
 * Each circular/framework/pen-test can have its own set via item id or RBI linkRef (and RBI/SEBI fall back to body/category).
 * Use getXFor(body, categoryKey?, itemId?) – itemId/linkRef wins when defined in *_BY_ITEM_ID.
 */

import { NBFC_IT_FRAMEWORK_10999_RECOMMENDATIONS, NBFC_IT_FRAMEWORK_10999_CONTROLS, NBFC_IT_FRAMEWORK_10999_QUESTIONS } from "@/data/nbfcItFramework10999";
import { ISO_27001_RECOMMENDATIONS, ISO_27001_CONTROLS, ISO_27001_QUESTIONS } from "@/data/iso27001";
import { ISO_9001_RECOMMENDATIONS, ISO_9001_CONTROLS, ISO_9001_QUESTIONS } from "@/data/iso9001";
import { RBI_IT_GOV_12562_RECOMMENDATIONS, RBI_IT_GOV_12562_CONTROLS, RBI_IT_GOV_12562_QUESTIONS } from "@/data/rbiItGovFramework12562";

export type AiRecommendation = {
  id: string;
  title: string;
  description: string;
  relevance: string;
  category: string;
};

export type ExistingControl = {
  id: string;
  name: string;
  framework: string;
  status: string;
};

export type AssessmentQuestion = {
  id: string;
  title: string;
  description?: string;
  source: "ai" | "manual";
  /** Links this question to a control (AiRecommendation.id). Used for "Related control" / "Related question" in UI. */
  controlId?: string;
  answer?: string;
};

// ─── SEBI Curated Master Circular Data ───────────────────────────────────────
export const SEBI_STOCK_BROKERS_RECOMMENDATIONS: AiRecommendation[] = [
  { id: "REC-SEBI-SB-01", title: "Client Collateral Segregation & CC Reporting", description: "Enforce strict segregation of client collateral from proprietary funds with daily CC and depository reconciliation.", relevance: "High", category: "Operations" },
  { id: "REC-SEBI-SB-02", title: "Algorithmic Risk Management & Kill Switch", description: "Implement automated pre-trade risk controls (order quantity, price band, max turnover) and one-click kill switch.", relevance: "High", category: "Compliance" },
  { id: "REC-SEBI-SB-03", title: "Cybersecurity & Cyber Resilience Framework", description: "Comply with SEBI CSCRF guidelines including network segmentation, 2FA on trading terminals, and 6-hour incident disclosure.", relevance: "High", category: "Cybersecurity" },
  { id: "REC-SEBI-SB-04", title: "Digital KYC & Periodic Re-KYC Verification", description: "Mandate Aadhaar e-KYC with biometric/liveness verification and periodic risk-based re-KYC audits.", relevance: "Medium", category: "Compliance" },
];

const SEBI_STOCK_BROKERS_CONTROLS: ExistingControl[] = [
  { id: "CTRL-SEBI-SB-01", name: "Pre-Trade Risk Engine & Kill Switch", framework: "SEBI Stock Brokers", status: "mapped" },
  { id: "CTRL-SEBI-SB-02", name: "Client Collateral Segregation Ledger", framework: "SEBI Stock Brokers", status: "mapped" },
  { id: "CTRL-SEBI-SB-03", name: "24x7 Security Operations Center (SOC)", framework: "SEBI CSCRF", status: "mapped" },
  { id: "CTRL-SEBI-SB-04", name: "Central KYC (CKYC) Automated Sync", framework: "PMLA / SEBI", status: "mapped" },
];

export const SEBI_STOCK_BROKERS_QUESTIONS: AssessmentQuestion[] = [
  { id: "Q-SEBI-SB-01", title: "Are client funds and collateral strictly segregated with daily reconciliation against Clearing Corporation accounts?", source: "ai" },
  { id: "Q-SEBI-SB-02", title: "Does the trading system support an emergency kill switch to immediately halt all algorithmic orders?", source: "ai" },
  { id: "Q-SEBI-SB-03", title: "Has the entity implemented multi-factor authentication (MFA) across all client and dealer trading terminals?", source: "ai" },
  { id: "Q-SEBI-SB-04", title: "Are cyber incidents reported to SEBI and CERT-In within the mandated 6-hour window?", source: "ai" },
];

export const SEBI_MUTUAL_FUNDS_RECOMMENDATIONS: AiRecommendation[] = [
  { id: "REC-SEBI-MF-01", title: "Inter-Scheme Transfer & Valuation Verification", description: "Validate that all inter-scheme transfers comply with independent market valuation and have documented justification.", relevance: "High", category: "Compliance" },
  { id: "REC-SEBI-MF-02", title: "Liquidity Risk Management & Stress Testing", description: "Execute monthly liquidity stress tests across all debt schemes and maintain mandated liquid asset buffers.", relevance: "High", category: "Operations" },
  { id: "REC-SEBI-MF-03", title: "Dealing Room Surveillance & Anti-Front Running", description: "Enforce continuous CCTV recording, biometric access, and recorded telephone lines for all dealer desks.", relevance: "High", category: "Compliance" },
  { id: "REC-SEBI-MF-04", title: "ESG & Scheme Portfolio Periodic Disclosure", description: "Publish monthly portfolio disclosures and ESG scheme stewardship disclosures within statutory deadlines.", relevance: "Medium", category: "Reporting" },
];

const SEBI_MUTUAL_FUNDS_CONTROLS: ExistingControl[] = [
  { id: "CTRL-SEBI-MF-01", name: "Dealing Room Biometric & Voice Recording", framework: "SEBI Mutual Funds", status: "mapped" },
  { id: "CTRL-SEBI-MF-02", name: "Liquidity Stress Testing Engine", framework: "SEBI Mutual Funds", status: "mapped" },
  { id: "CTRL-SEBI-MF-03", name: "Valuation Committee Review Protocol", framework: "SEBI Mutual Funds", status: "mapped" },
  { id: "CTRL-SEBI-MF-04", name: "Automated Portfolio Disclosure Pipeline", framework: "SEBI Reporting", status: "mapped" },
];

export const SEBI_MUTUAL_FUNDS_QUESTIONS: AssessmentQuestion[] = [
  { id: "Q-SEBI-MF-01", title: "Are all dealer telephone lines and terminals continuously recorded with access logs archived for at least 8 years?", source: "ai" },
  { id: "Q-SEBI-MF-02", title: "Is liquidity stress testing performed monthly and submitted to the Risk Management Committee?", source: "ai" },
  { id: "Q-SEBI-MF-03", title: "Are inter-scheme transfers executed only at prevailing market prices and approved by the Compliance Officer?", source: "ai" },
  { id: "Q-SEBI-MF-04", title: "Are scheme portfolio disclosures published on the AMC website within the 10th of every month?", source: "ai" },
];

export const SEBI_MII_GOVERNANCE_RECOMMENDATIONS: AiRecommendation[] = [
  { id: "REC-SEBI-MII-01", title: "Board Independence & PID Governance", description: "Maintain at least 50% Public Interest Directors and ensure independent statutory audit committee oversight.", relevance: "High", category: "Governance" },
  { id: "REC-SEBI-MII-02", title: "Core Settlement Guarantee Fund (SGF) Stress Testing", description: "Conduct daily stress testing of the Core SGF to withstand default of the two largest clearing members.", relevance: "High", category: "Operations" },
  { id: "REC-SEBI-MII-03", title: "Disaster Recovery Site (DRS) Live Switchover", description: "Conduct live trading sessions from Disaster Recovery Site with RTO under 45 minutes and zero data loss.", relevance: "High", category: "Cybersecurity" },
];

const SEBI_MII_GOVERNANCE_CONTROLS: ExistingControl[] = [
  { id: "CTRL-SEBI-MII-01", name: "Core SGF Automated Sizing Engine", framework: "SEBI MII Governance", status: "mapped" },
  { id: "CTRL-SEBI-MII-02", name: "DRS Live Switchover & Real-Time Sync", framework: "SEBI MII Governance", status: "mapped" },
  { id: "CTRL-SEBI-MII-03", name: "Public Interest Director Committee", framework: "SEBI Governance", status: "mapped" },
];

export const SEBI_MII_GOVERNANCE_QUESTIONS: AssessmentQuestion[] = [
  { id: "Q-SEBI-MII-01", title: "Does the Disaster Recovery Site achieve a Recovery Time Objective (RTO) of 45 minutes during live switchovers?", source: "ai" },
  { id: "Q-SEBI-MII-02", title: "Is the Core Settlement Guarantee Fund evaluated daily against simultaneous double-member default scenarios?", source: "ai" },
  { id: "Q-SEBI-MII-03", title: "Does the Governing Board comprise at least 50% Public Interest Directors?", source: "ai" },
];

// ─── Per-item overrides (item id → recommendations / controls / questions) ───
// When an itemId is passed, these are used if present; otherwise body/category defaults apply.

const RECOMMENDATIONS_BY_ITEM_ID: Record<string, AiRecommendation[]> = {
  // Pen-Test: each type has its own
  "pt-ept": [
    { id: "REC-EPT-01", title: "External scope definition", description: "Define and document scope of external systems and networks in scope.", relevance: "High", category: "Compliance" },
    { id: "REC-EPT-02", title: "Remediation of external findings", description: "Track and verify remediation of external penetration test findings.", relevance: "High", category: "Operations" },
  ],
  "pt-iva": [
    { id: "REC-IVA-01", title: "Internal scope and methodology", description: "Define scope and methodology for internal vulnerability assessment.", relevance: "High", category: "Compliance" },
    { id: "REC-IVA-02", title: "Vulnerability prioritisation", description: "Establish process to prioritise and remediate internal vulnerabilities.", relevance: "High", category: "Operations" },
  ],
  "pt-asv": [
    { id: "REC-ASV-01", title: "ASV scan scope", description: "Define scope for PCI DSS ASV scans and ensure ASV eligibility.", relevance: "High", category: "Compliance" },
    { id: "REC-ASV-02", title: "Quarterly scan and attestation", description: "Conduct quarterly ASV scans and maintain attestation of compliance.", relevance: "High", category: "Operations" },
  ],
  "pt-apt": [
    { id: "REC-APT-01", title: "Application scope", description: "Define scope (web/mobile apps, APIs) for application penetration testing.", relevance: "High", category: "Compliance" },
    { id: "REC-APT-02", title: "SDL and remediation", description: "Integrate findings into SDL and track remediation.", relevance: "High", category: "Operations" },
  ],
  "pt-ipt": [
    { id: "REC-IPT-01", title: "Infrastructure scope", description: "Define scope for network, server, and cloud infrastructure testing.", relevance: "High", category: "Compliance" },
    { id: "REC-IPT-02", title: "Infrastructure hardening", description: "Track infrastructure findings and hardening actions.", relevance: "High", category: "Operations" },
  ],
  // Frameworks: each has its own
  "fw-pci-dss": [
    { id: "REC-PCI-01", title: "Cardholder data scope", description: "Maintain accurate cardholder data environment (CDE) scope and segmentation.", relevance: "High", category: "Compliance" },
    { id: "REC-PCI-02", title: "Control mapping to PCI DSS", description: "Map internal controls to PCI DSS requirements and document evidence.", relevance: "High", category: "Compliance" },
  ],
  "fw-scr": [
    { id: "REC-SCR-01", title: "Supervisory control framework", description: "Document supervisory review and control framework alignment.", relevance: "High", category: "Compliance" },
    { id: "REC-SCR-02", title: "Governance and reporting", description: "Establish governance and reporting for SCR compliance.", relevance: "Medium", category: "Governance" },
  ],
  "fw-iso27001": ISO_27001_RECOMMENDATIONS,
  "fw-iso9001": ISO_9001_RECOMMENDATIONS,
  "fw-cmmi": [
    { id: "REC-CMMI-01", title: "Process area coverage", description: "Map practices to CMMI process areas and maturity level.", relevance: "High", category: "Compliance" },
    { id: "REC-CMMI-02", title: "Appraisal readiness", description: "Maintain evidence and readiness for CMMI appraisal.", relevance: "Medium", category: "Operations" },
  ],
  "fw-cicra": [
    { id: "REC-CICRA-01", title: "Credit information controls", description: "Implement and document controls for credit information company regulation.", relevance: "High", category: "Compliance" },
    { id: "REC-CICRA-02", title: "Reporting compliance", description: "Ensure reporting and disclosure compliance under CICRA.", relevance: "High", category: "Compliance" },
  ],
  "fw-bsu": [
    { id: "REC-BSU-01", title: "BCP scope and risk assessment", description: "Define BCP scope and conduct BIA/risk assessment.", relevance: "High", category: "Compliance" },
    { id: "REC-BSU-02", title: "Testing and review", description: "Document BCP testing and periodic review.", relevance: "High", category: "Operations" },
  ],
  // Master Direction - IT Framework for NBFC Sector (rbi.org.in id=10999)
  "10999": NBFC_IT_FRAMEWORK_10999_RECOMMENDATIONS,
  // Master Direction - IT Governance, Risk, Controls and Assurance Practices (rbi.org.in id=12562)
  "12562": RBI_IT_GOV_12562_RECOMMENDATIONS,
  // SEBI Stock Brokers (sebi-1, alias sebi-33)
  "sebi-1": SEBI_STOCK_BROKERS_RECOMMENDATIONS,
  "sebi-33": SEBI_STOCK_BROKERS_RECOMMENDATIONS,
  // SEBI Mutual Funds (sebi-2, alias sebi-26)
  "sebi-2": SEBI_MUTUAL_FUNDS_RECOMMENDATIONS,
  "sebi-26": SEBI_MUTUAL_FUNDS_RECOMMENDATIONS,
  // SEBI MII Governance (sebi-3, alias sebi-7)
  "sebi-3": SEBI_MII_GOVERNANCE_RECOMMENDATIONS,
  "sebi-7": SEBI_MII_GOVERNANCE_RECOMMENDATIONS,
};

const CONTROLS_BY_ITEM_ID: Record<string, ExistingControl[]> = {
  "pt-ept": [{ id: "CTRL-EPT-01", name: "External PT scope and schedule", framework: "Internal", status: "mapped" }],
  "pt-iva": [{ id: "CTRL-IVA-01", name: "Internal VA scope and schedule", framework: "Internal", status: "mapped" }],
  "pt-asv": [{ id: "CTRL-ASV-01", name: "ASV scan and attestation", framework: "PCI DSS", status: "mapped" }],
  "pt-apt": [{ id: "CTRL-APT-01", name: "Application security testing", framework: "Internal", status: "mapped" }],
  "pt-ipt": [{ id: "CTRL-IPT-01", name: "Infrastructure security testing", framework: "Internal", status: "mapped" }],
  "fw-pci-dss": [{ id: "CTRL-PCI-01", name: "CDE controls and segmentation", framework: "PCI DSS", status: "mapped" }],
  "fw-scr": [{ id: "CTRL-SCR-01", name: "Supervisory control", framework: "Internal", status: "mapped" }],
  "fw-iso27001": ISO_27001_CONTROLS,
  "fw-iso9001": ISO_9001_CONTROLS,
  "fw-cmmi": [{ id: "CTRL-CMMI-01", name: "Process and maturity controls", framework: "CMMI", status: "mapped" }],
  "fw-cicra": [{ id: "CTRL-CICRA-01", name: "Credit information controls", framework: "Internal", status: "mapped" }],
  "fw-bsu": [{ id: "CTRL-BSU-01", name: "BCP and resilience controls", framework: "Internal", status: "mapped" }],
  "10999": NBFC_IT_FRAMEWORK_10999_CONTROLS,
  "12562": RBI_IT_GOV_12562_CONTROLS,
  "sebi-1": SEBI_STOCK_BROKERS_CONTROLS,
  "sebi-33": SEBI_STOCK_BROKERS_CONTROLS,
  "sebi-2": SEBI_MUTUAL_FUNDS_CONTROLS,
  "sebi-26": SEBI_MUTUAL_FUNDS_CONTROLS,
  "sebi-3": SEBI_MII_GOVERNANCE_CONTROLS,
  "sebi-7": SEBI_MII_GOVERNANCE_CONTROLS,
};

const QUESTIONS_BY_ITEM_ID: Record<string, AssessmentQuestion[]> = {
  "pt-ept": [
    { id: "Q-EPT-01", title: "Is the scope of external systems and networks in scope documented and approved?", source: "ai" },
    { id: "Q-EPT-02", title: "Are external penetration test findings tracked and remediated?", source: "ai" },
  ],
  "pt-iva": [
    { id: "Q-IVA-01", title: "Is the scope and methodology for internal vulnerability assessment documented?", source: "ai" },
    { id: "Q-IVA-02", title: "Are internal vulnerabilities prioritised and remediated?", source: "ai" },
  ],
  "pt-asv": [
    { id: "Q-ASV-01", title: "Are quarterly ASV scans performed and attestation of compliance maintained?", source: "ai" },
    { id: "Q-ASV-02", title: "Is ASV scope and eligibility documented?", source: "ai" },
  ],
  "pt-apt": [
    { id: "Q-APT-01", title: "Is application penetration testing scope (web/mobile/API) defined and tested?", source: "ai" },
    { id: "Q-APT-02", title: "Are application security findings integrated into SDL and remediated?", source: "ai" },
  ],
  "pt-ipt": [
    { id: "Q-IPT-01", title: "Is infrastructure (network, server, cloud) penetration testing scope defined?", source: "ai" },
    { id: "Q-IPT-02", title: "Are infrastructure findings tracked and hardening actions documented?", source: "ai" },
  ],
  "fw-pci-dss": [
    { id: "Q-PCI-01", title: "Is the cardholder data environment (CDE) scope and segmentation documented?", source: "ai" },
    { id: "Q-PCI-02", title: "Are controls mapped to PCI DSS requirements with evidence?", source: "ai" },
  ],
  "fw-scr": [
    { id: "Q-SCR-01", title: "Is the supervisory review and control framework documented and reviewed?", source: "ai" },
  ],
  "fw-iso27001": ISO_27001_QUESTIONS,
  "fw-iso9001": ISO_9001_QUESTIONS,
  "fw-cmmi": [
    { id: "Q-CMMI-01", title: "Are practices mapped to CMMI process areas and appraisal readiness maintained?", source: "ai" },
  ],
  "fw-cicra": [
    { id: "Q-CICRA-01", title: "Are credit information controls and reporting compliant with CICRA?", source: "ai" },
  ],
  "fw-bsu": [
    { id: "Q-BSU-01", title: "Is BCP scope, BIA, and testing documented and periodically reviewed?", source: "ai" },
  ],
  "10999": NBFC_IT_FRAMEWORK_10999_QUESTIONS,
  "12562": RBI_IT_GOV_12562_QUESTIONS,
  "sebi-1": SEBI_STOCK_BROKERS_QUESTIONS,
  "sebi-33": SEBI_STOCK_BROKERS_QUESTIONS,
  "sebi-2": SEBI_MUTUAL_FUNDS_QUESTIONS,
  "sebi-26": SEBI_MUTUAL_FUNDS_QUESTIONS,
  "sebi-3": SEBI_MII_GOVERNANCE_QUESTIONS,
  "sebi-7": SEBI_MII_GOVERNANCE_QUESTIONS,
};

// ─── RBI (by categoryCode: cb, sfb, nbc, fema, pss, etc.) – fallback when no item id override ───
const RBI_RECOMMENDATIONS: Record<string, AiRecommendation[]> = {
  default: [
    { id: "REC-01", title: "Board Oversight Documentation", description: "Implement a process for quarterly board reporting on risk and governance metrics.", relevance: "High", category: "Governance" },
    { id: "REC-02", title: "Control Mapping", description: "Map internal controls to this Master Direction and document evidence.", relevance: "High", category: "Compliance" },
    { id: "REC-03", title: "Periodic Review", description: "Establish annual review of policies aligned to this direction.", relevance: "Medium", category: "Operations" },
  ],
  cb: [
    { id: "REC-CB-01", title: "Board Oversight Documentation", description: "Implement quarterly board reporting on risk and governance for commercial banks.", relevance: "High", category: "Governance" },
    { id: "REC-CB-02", title: "Control Mapping", description: "Map internal controls to Master Direction and document evidence.", relevance: "High", category: "Compliance" },
    { id: "REC-CB-03", title: "Periodic Review", description: "Establish annual review of policies aligned to this direction.", relevance: "Medium", category: "Operations" },
  ],
  nbc: [
    { id: "REC-NBC-01", title: "Gap Assessment", description: "Conduct gap assessment against NBFC Master Direction requirements.", relevance: "High", category: "Compliance" },
    { id: "REC-NBC-02", title: "Control Mapping", description: "Map internal controls to this Master Direction and document evidence.", relevance: "High", category: "Compliance" },
    { id: "REC-NBC-03", title: "Periodic Review", description: "Establish annual review of policies aligned to this direction.", relevance: "Medium", category: "Operations" },
  ],
  pss: [
    { id: "REC-PSS-01", title: "Payment Security Controls", description: "Implement and document payment and settlement security controls.", relevance: "High", category: "Compliance" },
    { id: "REC-PSS-02", title: "Control Mapping", description: "Map internal controls to PSS directions and document evidence.", relevance: "High", category: "Compliance" },
    { id: "REC-PSS-03", title: "Periodic Review", description: "Establish annual review of PSS-related policies.", relevance: "Medium", category: "Operations" },
  ],
  fema: [
    { id: "REC-FEMA-01", title: "FEMA Compliance Documentation", description: "Maintain documentation for FEMA compliance and reporting.", relevance: "High", category: "Compliance" },
    { id: "REC-FEMA-02", title: "Control Mapping", description: "Map internal controls to FEMA directions and document evidence.", relevance: "High", category: "Compliance" },
    { id: "REC-FEMA-03", title: "Periodic Review", description: "Establish annual review of FEMA-related policies.", relevance: "Medium", category: "Operations" },
  ],
};

const RBI_CONTROLS: Record<string, ExistingControl[]> = {
  default: [{ id: "CTRL-IS-01", name: "Internal Policy / Control", framework: "Internal", status: "mapped" }],
  cb: [{ id: "CTRL-CB-01", name: "Commercial Bank Internal Control", framework: "Internal", status: "mapped" }],
  nbc: [{ id: "CTRL-NBC-01", name: "NBFC Internal Control", framework: "Internal", status: "mapped" }],
  pss: [{ id: "CTRL-PSS-01", name: "Payment System Control", framework: "Internal", status: "mapped" }],
  fema: [{ id: "CTRL-FEMA-01", name: "FEMA Compliance Control", framework: "Internal", status: "mapped" }],
};

const RBI_QUESTIONS: Record<string, AssessmentQuestion[]> = {
  default: [
    { id: "Q-RBI-01", title: "Has the board reviewed and approved policies aligned to this Master Direction?", source: "ai" },
    { id: "Q-RBI-02", title: "Are internal controls mapped to this direction and evidence documented?", source: "ai" },
    { id: "Q-RBI-03", title: "Has an annual review of policies aligned to this direction been conducted?", source: "ai" },
  ],
  cb: [
    { id: "Q-CB-01", title: "Has the board reviewed commercial bank policies aligned to this Master Direction?", source: "ai" },
    { id: "Q-CB-02", title: "Are internal controls for commercial banking mapped and documented?", source: "ai" },
  ],
  nbc: [
    { id: "Q-NBC-01", title: "Has a gap assessment against NBFC Master Direction been completed?", source: "ai" },
    { id: "Q-NBC-02", title: "Are NBFC internal controls mapped to this direction?", source: "ai" },
  ],
  pss: [
    { id: "Q-PSS-01", title: "Are payment and settlement security controls documented and reviewed?", source: "ai" },
  ],
  fema: [
    { id: "Q-FEMA-01", title: "Is FEMA compliance documentation maintained and up to date?", source: "ai" },
  ],
};

// ─── SEBI – fallback when no item id override ─────────────────────────────────
const SEBI_RECOMMENDATIONS: AiRecommendation[] = [
  { id: "REC-SEBI-01", title: "Control Mapping", description: "Map controls to SEBI framework.", relevance: "High", category: "Compliance" },
  { id: "REC-SEBI-02", title: "Periodic Review", description: "Establish annual review of policies aligned to this circular.", relevance: "Medium", category: "Operations" },
];

const SEBI_CONTROLS: ExistingControl[] = [
  { id: "CTRL-SEBI-01", name: "Internal Control", framework: "Internal", status: "mapped" },
];

const SEBI_QUESTIONS: AssessmentQuestion[] = [
  { id: "Q-SEBI-01", title: "Are internal controls mapped to this SEBI circular and evidence documented?", source: "ai" },
  { id: "Q-SEBI-02", title: "Has an annual review of policies aligned to this circular been conducted?", source: "ai" },
];

// ─── Pen-Test / Framework fallbacks (when item id not in *_BY_ITEM_ID) ─────────
const PEN_TEST_RECOMMENDATIONS: AiRecommendation[] = [
  { id: "REC-PT-01", title: "Scope & Methodology", description: "Define scope and methodology for the penetration test.", relevance: "High", category: "Compliance" },
  { id: "REC-PT-02", title: "Remediation Tracking", description: "Track and verify remediation of findings.", relevance: "High", category: "Operations" },
];

const PEN_TEST_CONTROLS: ExistingControl[] = [
  { id: "CTRL-PT-01", name: "Internal Policy / Control", framework: "Internal", status: "mapped" },
];

const PEN_TEST_QUESTIONS: AssessmentQuestion[] = [
  { id: "Q-PT-01", title: "Has the scope and methodology for this test been documented and approved?", source: "ai" },
  { id: "Q-PT-02", title: "Are findings tracked and remediation verified?", source: "ai" },
];

const FRAMEWORK_RECOMMENDATIONS: AiRecommendation[] = [
  { id: "REC-FW-01", title: "Gap Assessment", description: "Conduct gap assessment against the framework requirements.", relevance: "High", category: "Compliance" },
  { id: "REC-FW-02", title: "Control Mapping", description: "Map internal controls to framework objectives.", relevance: "High", category: "Compliance" },
];

const FRAMEWORK_CONTROLS: ExistingControl[] = [
  { id: "CTRL-FW-01", name: "Internal Policy / Control", framework: "Internal", status: "mapped" },
];

const FRAMEWORK_QUESTIONS: AssessmentQuestion[] = [
  { id: "Q-FW-01", title: "Has a gap assessment against this framework been completed?", source: "ai" },
  { id: "Q-FW-02", title: "Are internal controls mapped to framework objectives?", source: "ai" },
];

// A circular only counts as "AI indexed" (fully analyzed, not just a
// generic placeholder) when it has hand-curated recommendations/controls/
// questions keyed by its own item id/linkRef — e.g. "10999" (NBFC IT
// Framework) and "12562" (IT Governance) — rather than falling back to
// the generic category-default templates every other circular gets.
const CURATED_ITEM_IDS = new Set(Object.keys(RECOMMENDATIONS_BY_ITEM_ID));

export function isIndexComplete(itemId?: string): boolean {
  return !!itemId && CURATED_ITEM_IDS.has(itemId);
}

// ─── Public getters: itemId wins; then body + categoryKey for RBI; then body default ───

export function getAiRecommendationsFor(body: string, categoryKey?: string, itemId?: string): AiRecommendation[] {
  if (itemId && RECOMMENDATIONS_BY_ITEM_ID[itemId]) return [...RECOMMENDATIONS_BY_ITEM_ID[itemId]];
  if (body === "RBI") {
    const key = categoryKey && RBI_RECOMMENDATIONS[categoryKey] ? categoryKey : "default";
    return [...(RBI_RECOMMENDATIONS[key] ?? RBI_RECOMMENDATIONS.default)];
  }
  if (body === "SEBI") return [...SEBI_RECOMMENDATIONS];
  if (body === "Pen-Test") return [...PEN_TEST_RECOMMENDATIONS];
  if (body === "Framework") return [...FRAMEWORK_RECOMMENDATIONS];
  return [...RBI_RECOMMENDATIONS.default];
}

export function getExistingControlsFor(body: string, categoryKey?: string, itemId?: string): ExistingControl[] {
  if (itemId && CONTROLS_BY_ITEM_ID[itemId]) return [...CONTROLS_BY_ITEM_ID[itemId]];
  if (body === "RBI") {
    const key = categoryKey && RBI_CONTROLS[categoryKey] ? categoryKey : "default";
    return [...(RBI_CONTROLS[key] ?? RBI_CONTROLS.default)];
  }
  if (body === "SEBI") return [...SEBI_CONTROLS];
  if (body === "Pen-Test") return [...PEN_TEST_CONTROLS];
  if (body === "Framework") return [...FRAMEWORK_CONTROLS];
  return [...RBI_CONTROLS.default];
}

function getQuestionsFor(body: string, categoryKey?: string, itemId?: string): AssessmentQuestion[] {
  if (itemId && QUESTIONS_BY_ITEM_ID[itemId]) return [...QUESTIONS_BY_ITEM_ID[itemId]];
  if (body === "RBI") {
    const key = categoryKey && RBI_QUESTIONS[categoryKey] ? categoryKey : "default";
    return [...(RBI_QUESTIONS[key] ?? RBI_QUESTIONS.default)];
  }
  if (body === "SEBI") return [...SEBI_QUESTIONS];
  if (body === "Pen-Test") return [...PEN_TEST_QUESTIONS];
  if (body === "Framework") return [...FRAMEWORK_QUESTIONS];
  return [...RBI_QUESTIONS.default];
}

/** Returns questions with controlId set by matching recommendations (same index). Use when building circular detail to show control↔question linkage. */
export function getQuestionsWithControlLinks(
  body: string,
  categoryKey?: string,
  itemId?: string
): AssessmentQuestion[] {
  const questions = getQuestionsFor(body, categoryKey, itemId);
  const recommendations = getAiRecommendationsFor(body, categoryKey, itemId);
  return questions.map((q, i) => ({
    ...q,
    controlId: recommendations[i]?.id ?? q.controlId,
  }));
}

// Mirrors the Postgres enum types in sql/postgres/full_schema.sql — keep in sync.
//
// Each enum is a readonly array (usable with z.enum(...)) plus a same-named
// union type. `enumObject` turns an array into an `{ VALUE: "VALUE" }` object
// for call sites that prefer `RiskLevelEnum.HIGH` style member access.

export function enumObject<const T extends readonly string[]>(values: T): { [K in T[number]]: K } {
  return Object.fromEntries(values.map((v) => [v, v])) as { [K in T[number]]: K };
}

// --- Auth & org ---------------------------------------------------------

export const Role = ["ADMIN", "EDITOR", "VIEWER"] as const;
export type Role = (typeof Role)[number];

export const UserStatus = ["ACTIVE", "INVITED", "SUSPENDED"] as const;
export type UserStatus = (typeof UserStatus)[number];

export const SSOProvider = ["AZURE_AD", "OKTA", "GOOGLE", "AUTH0", "CUSTOM_SAML"] as const;
export type SSOProvider = (typeof SSOProvider)[number];

export const AIProvider = ["OPENAI", "ANTHROPIC", "VERTEXAI", "BEDROCK", "OLLAMA", "SARVAMAI"] as const;
export type AIProvider = (typeof AIProvider)[number];

export const EmbeddingProvider = ["OPENAI", "VERTEXAI", "BEDROCK", "OLLAMA"] as const;
export type EmbeddingProvider = (typeof EmbeddingProvider)[number];

export const OtpPurpose = ["SIGNUP", "PASSWORD_RESET"] as const;
export type OtpPurpose = (typeof OtpPurpose)[number];

// --- Regulations --------------------------------------------------------

export const Regulator = ["RBI", "SEBI", "CERT_IN", "DPDP", "OTHER"] as const;
export type Regulator = (typeof Regulator)[number];

// FRAMEWORK = a standard such as ISO 27001 shown alongside circulars.
export const CircularKind = ["CIRCULAR", "FRAMEWORK"] as const;
export type CircularKind = (typeof CircularKind)[number];

export const CircularCategory = ["CYBERSECURITY", "COMPLIANCE", "AUDIT", "REPORTING", "OPERATIONS"] as const;
export type CircularCategory = (typeof CircularCategory)[number];

// PENDING_REVIEW = discovered by the discovery agent, not yet adopted.
export const CircularStatus = ["ACTIVE", "SUPERSEDED", "DRAFT", "PENDING_REVIEW"] as const;
export type CircularStatus = (typeof CircularStatus)[number];

export const RunStatus = ["RUNNING", "COMPLETED", "FAILED"] as const;
export type RunStatus = (typeof RunStatus)[number];

// Agents that can run on a per-org schedule (AgentSchedule).
export const AutomationAgent = ["CONTROL_ANSWERS", "DISCOVERY"] as const;
export type AutomationAgent = (typeof AutomationAgent)[number];

export const RunTrigger = ["SCHEDULED", "MANUAL"] as const;
export type RunTrigger = (typeof RunTrigger)[number];

// --- Obligations & controls --------------------------------------------

export const ObligationType = [
  "REPORTING",
  "GOVERNANCE",
  "CONTROL",
  "DISCLOSURE",
  "RECORD_KEEPING",
  "OPERATIONAL",
  "AUDIT",
  "OTHER",
] as const;
export type ObligationType = (typeof ObligationType)[number];

export const ObligationStatus = ["EXTRACTED", "CONFIRMED", "DISMISSED"] as const;
export type ObligationStatus = (typeof ObligationStatus)[number];

export const Relevance = ["HIGH", "MEDIUM", "LOW"] as const;
export type Relevance = (typeof Relevance)[number];

// Who created a control / question / mapping.
export const OriginSource = ["AI", "MANUAL"] as const;
export type OriginSource = (typeof OriginSource)[number];

export const ControlStatus = ["ACTIVE", "COMPLIANCE_GAP"] as const;
export type ControlStatus = (typeof ControlStatus)[number];

export const ImplementationStatus = ["IMPLEMENTED", "PARTIAL", "NOT_IMPLEMENTED"] as const;
export type ImplementationStatus = (typeof ImplementationStatus)[number];

export const ApplicabilityStatus = ["APPLICABLE", "EXEMPT", "CONDITIONAL"] as const;
export type ApplicabilityStatus = (typeof ApplicabilityStatus)[number];

// --- Evidence, testing, monitoring -------------------------------------

export const EvidenceStatus = ["VERIFIED", "PENDING", "EXPIRED", "MISSING"] as const;
export type EvidenceStatus = (typeof EvidenceStatus)[number];

export const TestType = ["AUTOMATED_API", "MANUAL_INSPECTION", "EXTERNAL_AUDIT", "VAPT"] as const;
export type TestType = (typeof TestType)[number];

export const TestResult = ["PASSED", "FAILED", "DEFICIENT"] as const;
export type TestResult = (typeof TestResult)[number];

export const MonitoringHealth = ["HEALTHY", "WARNING", "BREACHED"] as const;
export type MonitoringHealth = (typeof MonitoringHealth)[number];

// --- Gaps & remediation -------------------------------------------------

export const RiskLevel = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type RiskLevel = (typeof RiskLevel)[number];

export const GapStatus = ["OPEN", "REMEDIATING", "RISK_ACCEPTED", "RESOLVED"] as const;
export type GapStatus = (typeof GapStatus)[number];

export const RemediationStatus = ["PENDING_APPROVAL", "EXECUTING", "VERIFIED"] as const;
export type RemediationStatus = (typeof RemediationStatus)[number];

export const ActionStatus = ["TODO", "IN_PROGRESS", "DONE"] as const;
export type ActionStatus = (typeof ActionStatus)[number];

// --- Contradictions & simulation ---------------------------------------

export const ConflictNature = [
  "TIMELINE_CLASH",
  "RETENTION_MISMATCH",
  "DATA_PRIVACY_VS_AUDIT",
  "REPORTING_THRESHOLD",
] as const;
export type ConflictNature = (typeof ConflictNature)[number];

export const SimulationCategory = [
  "REGULATORY_AMENDMENT",
  "GEOPOLITICAL_SANCTION",
  "INFRASTRUCTURE_FAILURE",
  "MERGER_ACQUISITION",
] as const;
export type SimulationCategory = (typeof SimulationCategory)[number];

// --- Knowledge base, documents, audit ----------------------------------

export const KBStatus = ["VERIFIED", "REVIEW", "DRAFT"] as const;
export type KBStatus = (typeof KBStatus)[number];

export const SourceType = ["INTERNAL", "EXTERNAL"] as const;
export type SourceType = (typeof SourceType)[number];

export const DocumentType = ["POLICY", "PROCEDURE", "FRAMEWORK", "QUESTIONNAIRE", "EVIDENCE"] as const;
export type DocumentType = (typeof DocumentType)[number];

export const DocumentStatus = ["ACTIVE", "DRAFT", "UNDER_REVIEW", "ARCHIVED"] as const;
export type DocumentStatus = (typeof DocumentStatus)[number];

export const DocumentClassification = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"] as const;
export type DocumentClassification = (typeof DocumentClassification)[number];

export const IngestionStatus = ["PENDING", "PROCESSING", "PROCESSED", "FAILED"] as const;
export type IngestionStatus = (typeof IngestionStatus)[number];

export const AuditActorType = ["USER", "AI", "SYSTEM"] as const;
export type AuditActorType = (typeof AuditActorType)[number];

export const AuditEventType = [
  "APPROVAL",
  "EDIT",
  "AI",
  "COMMENT",
  "UPLOAD",
  "STATUS",
  "SYSTEM",
  "CREATE",
  "EXPORT",
] as const;
export type AuditEventType = (typeof AuditEventType)[number];

// --- Multimodal ingestion & AI suggestions -------------------------------

export const SourceModality = ["SCANNED_PDF", "TEXT_PDF", "IMAGE", "SPREADSHEET", "WORD", "SCREENSHOT"] as const;
export type SourceModality = (typeof SourceModality)[number];

export const ExtractedItemKind = ["TEXT_BLOCK", "CLAUSE", "TABLE", "DIAGRAM", "FIGURE", "ROW", "FACT"] as const;
export type ExtractedItemKind = (typeof ExtractedItemKind)[number];

// AGREED: both independent passes match. DISPUTED / NEEDS_REVIEW: a human decides.
export const ItemReviewStatus = ["AGREED", "DISPUTED", "NEEDS_REVIEW", "ACCEPTED", "CORRECTED", "REJECTED"] as const;
export type ItemReviewStatus = (typeof ItemReviewStatus)[number];

// AI proposals (mappings, applicability, contradictions, changes) awaiting a human.
export const SuggestionStatus = ["SUGGESTED", "CONFIRMED", "REJECTED"] as const;
export type SuggestionStatus = (typeof SuggestionStatus)[number];

export const SimulationMethod = ["HEURISTIC", "AI_GRAPH"] as const;
export type SimulationMethod = (typeof SimulationMethod)[number];

export const ContradictionSource = ["CURATED", "AI"] as const;
export type ContradictionSource = (typeof ContradictionSource)[number];

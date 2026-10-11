// API response shapes — one per table in sql/postgres/full_schema.sql, as they
// appear over JSON (timestamps/dates are ISO strings, NULL columns are `null`).
// Server row types (server/src/db/types.ts) use Date objects because `pg`
// parses timestamps; web's lib/*.ts should import these instead of redeclaring.

import type {
  SuggestionStatus,
  SourceModality,
  SimulationMethod,
  ItemReviewStatus,
  ExtractedItemKind,
  ContradictionSource,
  ActionStatus,
  ApplicabilityStatus,
  AuditActorType,
  AuditEventType,
  AutomationAgent,
  CircularCategory,
  CircularKind,
  CircularStatus,
  ConflictNature,
  ControlStatus,
  DocumentClassification,
  DocumentStatus,
  DocumentType,
  EvidenceStatus,
  GapStatus,
  ImplementationStatus,
  IngestionStatus,
  KBStatus,
  MonitoringHealth,
  ObligationStatus,
  ObligationType,
  OriginSource,
  Regulator,
  Relevance,
  RemediationStatus,
  RiskLevel,
  Role,
  RunStatus,
  RunTrigger,
  SimulationCategory,
  SourceType,
  SSOProvider,
  TestResult,
  TestType,
  UserStatus,
} from "./enums.js";

export type ISODateTime = string;
export type ISODate = string; // YYYY-MM-DD

// --- Auth & org ---------------------------------------------------------

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerifiedAt: ISODateTime | null;
  hasPassword: boolean;
  isGoogleUser: boolean;
  role?: Role;
  organizationId?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Member {
  id: string;
  userId: string;
  role: Role;
  status: UserStatus;
  lastLogin: ISODateTime | null;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Invite {
  id: string;
  email: string;
  role: Role;
  expiresAt: ISODateTime;
  createdAt: ISODateTime;
}

export interface OrganizationSecuritySettings {
  ssoEnabled: boolean;
  ssoProvider: SSOProvider | null;
  mfaRequired: boolean;
  sessionTimeout: number;
  updatedAt: ISODateTime;
}

export interface IpWhitelistEntry {
  id: string;
  cidr: string;
  label: string | null;
  createdAt: ISODateTime;
}

// --- Regulations --------------------------------------------------------

export interface Circular {
  id: string;
  organizationId: string | null;
  circularId: string;
  reference: string | null;
  name: string;
  regulator: Regulator;
  kind: CircularKind;
  category: CircularCategory;
  categoryCode: string | null;
  description: string | null;
  tags: string[] | null;
  dateOfIssue: ISODate | null;
  lastUpdated: ISODate | null;
  status: CircularStatus;
  version: string | null;
  link: string | null;
  linkRef: string | null;
  applicableTo: string | null;
  filePath: string | null;
  supersededById: string | null;
  discoveryRunId: string | null;
  discoveredAt: ISODateTime | null;
  indexedAt: ISODateTime | null;
  // Derived: indexedAt !== null. Shown as "AI Indexed" on Regulations.
  aiIndexComplete: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface DiscoveryRun {
  id: string;
  organizationId: string;
  status: RunStatus;
  circularsFound: number;
  stages: unknown[] | null;
  startedAt: ISODateTime;
  finishedAt: ISODateTime | null;
}

// --- Obligations & controls --------------------------------------------

export interface Obligation {
  id: string;
  identifier: string | null;
  organizationId: string;
  circularId: string;
  requirementText: string;
  obligationType: ObligationType;
  deadline: string | null;
  applicabilityConditions: string[] | null;
  penalty: string | null;
  sourceQuote: string;
  sourceSection: string | null;
  // Grounding when the obligation came from a scanned/multimodal source.
  sourceFileId: string | null;
  sourcePage: number | null;
  sourceRegion: Region | null;
  citationVerified: boolean;
  confidence: number | null;
  status: ObligationStatus;
  extractionModel: string | null;
  reviewedById: string | null;
  reviewedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// One row per circular with at least one obligation (the /obligations grid).
export interface ObligationSummary {
  circularId: string;
  circularName: string;
  circularCode: string;
  category: string | null;
  total: number;
  verified: number;
  confirmed: number;
  dismissed: number;
  lastExtractedAt: ISODateTime;
}

export interface ObligationApplicability {
  obligationId: string;
  entities: string[] | null;
  criteria: string | null;
  status: ApplicabilityStatus;
  rationale: string | null;
  source: OriginSource;
  confidence: number | null;
  reviewStatus: SuggestionStatus;
}

export interface Control {
  id: string;
  organizationId: string | null;
  circularId: string;
  code: string | null;
  source: OriginSource;
  title: string;
  description: string | null;
  relevance: Relevance | null;
  category: string | null;
  framework: string | null;
  status: ControlStatus;
  implementationStatus: ImplementationStatus | null;
  ownerName: string | null;
  answer: string | null;
  notes: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ObligationControl {
  obligationId: string;
  controlId: string;
  mappingSource: OriginSource;
  confidence: number | null;
  rationale: string | null;
  reviewStatus: SuggestionStatus;
  createdAt: ISODateTime;
}

export interface Question {
  id: string;
  organizationId: string | null;
  circularId: string;
  code: string | null;
  title: string;
  description: string | null;
  source: OriginSource;
  answer: string | null;
  controlIds?: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Evidence {
  id: string;
  organizationId: string;
  controlId: string;
  documentId: string | null;
  name: string;
  documentType: string | null;
  section: string | null;
  excerpt: string | null;
  size: number | null;
  fileUrl: string | null;
  sourceFileId: string | null;
  facts: { key: string; value: string; confidence?: number }[] | null;
  status: EvidenceStatus;
  lastAuditDate: ISODate | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ControlTest {
  id: string;
  controlId: string;
  testType: TestType;
  frequency: string | null;
  lastTestedAt: ISODateTime | null;
  lastResult: TestResult | null;
  createdAt: ISODateTime;
}

export interface ControlTestRun {
  id: string;
  testId: string;
  testedAt: ISODateTime;
  result: TestResult;
  notes: string | null;
  testedByName: string | null;
}

export interface MonitoringKpi {
  id: string;
  controlId: string;
  kpi: string;
  threshold: string | null;
  currentValue: string | null;
  health: MonitoringHealth;
  telemetrySource: string | null;
  updatedAt: ISODateTime;
}

// --- Knowledge base & documents ----------------------------------------

export interface KnowledgeBaseEntry {
  id: string;
  organizationId: string;
  question: string;
  answer: string;
  sourceType: SourceType;
  sourceAssessment: string | null;
  tags: string[] | null;
  status: KBStatus;
  controlIds?: string[];
  createdById: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Document {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  path: string | null;
  size: number | null;
  pageCount: number | null;
  type: DocumentType | null;
  status: DocumentStatus;
  ingestionStatus: IngestionStatus;
  classification: DocumentClassification | null;
  department: string | null;
  owner: string | null;
  version: string | null;
  tags: string[] | null;
  effectiveDate: ISODate | null;
  expiryDate: ISODate | null;
  lastRenewalDate: ISODate | null;
  isAiRecommended: boolean;
  aiInsights: string[] | null;
  uploadedById: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: string;
  change: string;
  userId: string | null;
  userName: string;
  createdAt: ISODateTime;
}

// --- Gaps & remediation -------------------------------------------------

export interface ComplianceGap {
  id: string;
  identifier: string | null;
  organizationId: string;
  obligationId: string | null;
  controlId: string | null;
  questionId: string | null;
  title: string;
  description: string | null;
  riskLevel: RiskLevel;
  status: GapStatus;
  assigneeId: string | null;
  assigneeName: string | null; // joined from User
  engagementName: string | null;
  section: string | null;
  evidenceNeeded: string | null;
  dueDate: ISODate | null;
  openedAt: ISODateTime;
  resolvedAt: ISODateTime | null;
  riskAcceptedReason: string | null;
  riskAcceptedById: string | null;
  riskAcceptedAt: ISODateTime | null;
  riskAcceptanceExpiresAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface RemediationAction {
  id: string;
  planId: string;
  position: number;
  title: string;
  ownerId: string | null;
  ownerName: string | null;
  dueDate: ISODate | null;
  status: ActionStatus;
  completedAt: ISODateTime | null;
}

export interface RemediationPlan {
  id: string;
  gapId: string;
  planText: string;
  generatedBy: OriginSource;
  model: string | null;
  workOrderId: string | null;
  leadTeam: string | null;
  slaDays: number | null;
  actionSummary: string | null;
  status: RemediationStatus;
  approvedById: string | null;
  approvedAt: ISODateTime | null;
  actions: RemediationAction[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// --- Traceability, contradictions, simulation --------------------------

// One row of the TraceabilityLink view (obligation -> control chain).
export interface TraceabilityLink {
  obligationId: string;
  controlId: string;
  organizationId: string;
  obligationIdentifier: string | null;
  requirementText: string;
  obligationType: ObligationType;
  deadline: string | null;
  penalty: string | null;
  confidence: number | null;
  sourceSection: string | null;
  sourceQuote: string;
  circularRowId: string;
  circularCode: string;
  circularName: string;
  regulator: Regulator;
  dateOfIssue: ISODate | null;
  applicabilityStatus: ApplicabilityStatus | null;
  applicableEntities: string[] | null;
  applicabilityCriteria: string | null;
  controlTitle: string;
  framework: string | null;
  controlOwner: string | null;
  implementationStatus: ImplementationStatus | null;
  gapId: string | null;
  gapIdentifier: string | null;
  gapRiskLevel: RiskLevel | null;
  gapStatus: GapStatus | null;
  gapTitle: string | null;
  gapOpenedAt: ISODateTime | null;
  gapDueDate: ISODate | null;
  remediationStatus: RemediationStatus | null;
  workOrderId: string | null;
  remediationLeadTeam: string | null;
  remediationSlaDays: number | null;
  remediationActionSummary: string | null;
  isCompliant: boolean;
}

export interface TraceabilitySignoff {
  id: string;
  organizationId: string;
  obligationId: string;
  controlId: string;
  signedById: string | null;
  signedRole: string | null;
  contentHash: string | null;
  signedAt: ISODateTime;
}

export interface ContradictionParty {
  id: string;
  contradictionId: string;
  circularId: string | null;
  regulator: Regulator;
  circularTitle: string | null;
  clause: string | null;
  requirement: string | null;
  timelineOrCondition: string | null;
  obligationId: string | null;
  sourceQuote: string | null;
}

export interface RegulatoryContradiction {
  id: string;
  organizationId: string | null;
  domain: string | null;
  severity: RiskLevel;
  title: string;
  description: string | null;
  conflictNature: ConflictNature;
  strictestCommonDenominator: string | null;
  operationalRule: string | null;
  automatedControlId: string | null;
  auditDefenseRationale: string | null;
  source: ContradictionSource;
  reviewStatus: SuggestionStatus;
  confidence: number | null;
  parties: ContradictionParty[];
  obligationIds: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface SimulationBreachedControl {
  id: string;
  runId: string;
  controlId: string | null;
  controlName: string;
  reason: string | null;
  remediationCostAmount: number | null;
  remediationCostCurrency: string;
  remediationCostNote: string | null;
  remediationDays: number | null;
}

export interface SimulationRun {
  id: string;
  scenarioId: string;
  organizationId: string;
  initialCriticalGaps: number;
  initialHighGaps: number;
  initialComplianceScore: number | null;
  simulatedCriticalGaps: number;
  simulatedHighGaps: number;
  simulatedComplianceScore: number | null;
  blastRadiusScore: number | null;
  unaffectedControlsCount: number | null;
  suggestedPlaybook: string | null;
  method: SimulationMethod;
  // AI_GRAPH runs: the graph slice given to the model and its per-control reasoning.
  reasoning: SimulationReasoning | null;
  breachedControls: SimulationBreachedControl[];
  ranById: string | null;
  ranAt: ISODateTime;
}

export interface SimulationScenario {
  id: string;
  organizationId: string | null;
  name: string;
  category: SimulationCategory;
  targetCircularId: string | null;
  targetRegulator: string | null;
  hypothesisText: string;
  latestRun?: SimulationRun | null;
  createdById: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// --- Audit & dashboard --------------------------------------------------

export interface AuditLogEntry {
  id: string;
  actorType: AuditActorType;
  actorUserId: string | null;
  actorName: string;
  type: AuditEventType;
  action: string;
  detail: string | null;
  objectType: string | null;
  objectId: string | null;
  context: string | null;
  ip: string | null;
  createdAt: ISODateTime;
}

export interface DailyPipelineSnapshot {
  snapshotDate: ISODate;
  obligationsExtracted: number;
  gapsResolved: number;
  openGaps: number | null;
  complianceScore: number | null;
}

// GET /dashboard/summary — everything the dashboard cards derive.
export interface DashboardSummary {
  regulations: number;
  obligations: number;
  obligationsVerifiedPct: number;
  controls: number;
  openGaps: number;
  gapsByRisk: Record<RiskLevel, number>;
  gapsByStatus: Record<GapStatus, number>;
  complianceScore: number | null;
}

// --- Autonomous agents --------------------------------------------------

export interface AgentSchedule {
  agent: AutomationAgent;
  enabled: boolean;
  intervalHours: number;
  config: { onlyEmpty?: boolean; maxPerRun?: number } | null;
  lastRunAt: ISODateTime | null;
  nextRunAt: ISODateTime | null;
  updatedAt: ISODateTime | null;
}

export interface AgentStage {
  key: string;
  title: string;
  status: "pending" | "running" | "done" | "failed";
  detail?: string;
}

export interface ControlAnswerRun {
  id: string;
  organizationId: string;
  trigger: RunTrigger;
  status: RunStatus;
  controlsTotal: number;
  generated: number;
  skipped: number;
  failed: number;
  stages: AgentStage[] | null;
  error: string | null;
  startedById: string | null;
  startedAt: ISODateTime;
  finishedAt: ISODateTime | null;
}

// GET /automation/control-answers
export interface ControlAnswerAutomation {
  schedule: AgentSchedule;
  latestRun: ControlAnswerRun | null;
}

// --- Multimodal ingestion ----------------------------------------------

// Normalized (0..1) box on a page image; origin top-left.
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface IngestionMetrics {
  itemsTotal: number;
  agreed: number;
  disputed: number;
  needsReview: number;
  agreementRate: number; // 0..1 share of items both passes agree on
  quoteMatchRate: number | null; // 0..1 share of clauses whose text is found in the other pass's page text
  meanConfidence: number | null;
}

export interface IngestedFile {
  id: string;
  organizationId: string;
  circularId: string | null;
  controlId: string | null;
  fileName: string;
  mimeType: string;
  modality: SourceModality;
  size: number | null;
  pageCount: number | null;
  status: IngestionStatus;
  stages: AgentStage[] | null;
  passAModel: string | null;
  passBModel: string | null;
  metrics: IngestionMetrics | null;
  error: string | null;
  uploadedById: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  finishedAt: ISODateTime | null;
}

export interface IngestedPage {
  id: string;
  fileId: string;
  pageNumber: number;
  hasImage: boolean; // GET /ingestion/files/:id/pages/:n/image
  width: number | null;
  height: number | null;
  agreement: number | null;
  textA?: string | null;
  textB?: string | null;
}

export interface ExtractedItem {
  id: string;
  fileId: string;
  pageId: string | null;
  pageNumber: number | null;
  position: number;
  kind: ExtractedItemKind;
  label: string | null;
  content: string;
  structured: unknown | null; // TABLE {columns,rows} | DIAGRAM {steps} | ROW {...} | FACT {key,value}
  region: Region | null;
  confidence: number | null;
  agreement: number | null;
  quoteVerified: boolean | null;
  passA: unknown | null;
  passB: unknown | null;
  reviewStatus: ItemReviewStatus;
  correctedContent: string | null;
  reviewedById: string | null;
  reviewedAt: ISODateTime | null;
  promotedObligationId: string | null;
  promotedControlId: string | null;
  promotedEvidenceId: string | null;
}

export interface IngestedFileDetail extends IngestedFile {
  pages: IngestedPage[];
  items: ExtractedItem[];
}

// --- Intelligence agents -------------------------------------------------

export interface OrganizationProfile {
  organizationId: string;
  entityType: string | null;
  regulators: string[] | null;
  assetSizeCrore: number | null;
  licenses: string[] | null;
  jurisdictions: string[] | null;
  products: string[] | null;
  notes: string | null;
  updatedAt: ISODateTime | null;
}

export interface CircularChange {
  id: string;
  organizationId: string;
  newCircularId: string;
  previousCircularId: string | null;
  summary: string | null;
  added: { requirementText: string; sourceQuote?: string }[] | null;
  removed: { requirementText: string; sourceQuote?: string }[] | null;
  modified: { before: string; after: string; change: string }[] | null;
  impactedControlIds: string[] | null;
  reviewStatus: SuggestionStatus;
  createdById: string | null;
  createdAt: ISODateTime;
}

export interface SimulationReasoning {
  method: "AI_GRAPH";
  model: string | null;
  graph: { obligations: number; controls: number; openGaps: number };
  controls: { controlId: string; breached: boolean; reason: string; obligationIds: string[] }[];
  notes?: string;
}

// POST /mapping/suggest and /applicability/assess and /contradictions/detect responses.
export interface SuggestionSummary {
  proposed: number;
  skipped: number;
  failed: number;
  model: string | null;
}

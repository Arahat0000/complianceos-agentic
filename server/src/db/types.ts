// Hand-written row types mirroring sql/postgres/full_schema.sql (one interface
// per table). `pg` parses timestamps/dates into Date objects; the JSON shapes
// sent to clients live in @complianceos/shared (types/entities.ts).
// Keep field names and nullability in sync with the SQL, not the other way round.

import type {
  SuggestionStatus,
  SourceModality,
  SimulationMethod,
  ItemReviewStatus,
  ExtractedItemKind,
  ContradictionSource,
  ActionStatus,
  AIProvider,
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
  EmbeddingProvider,
  EvidenceStatus,
  GapStatus,
  ImplementationStatus,
  IngestionStatus,
  KBStatus,
  MonitoringHealth,
  ObligationStatus,
  ObligationType,
  OriginSource,
  OtpPurpose,
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
} from "@complianceos/shared";

// --- Auth, org, settings ------------------------------------------------

export interface UserRow {
  id: string;
  email: string;
  passwordHash: string | null;
  googleId: string | null;
  name: string;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailOtpRow {
  id: string;
  email: string;
  purpose: OtpPurpose;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipRow {
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
  status: UserStatus;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipWithUserRow extends MembershipRow {
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface InviteRow {
  id: string;
  email: string;
  role: Role;
  token: string;
  organizationId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface OrganizationSettingsRow {
  organizationId: string;
  ssoEnabled: boolean;
  ssoProvider: SSOProvider | null;
  ssoConfig: unknown | null;
  mfaRequired: boolean;
  sessionTimeout: number;
  updatedAt: Date;
}

export interface OrganizationIPWhitelistRow {
  id: string;
  organizationId: string;
  cidr: string;
  label: string | null;
  createdAt: Date;
}

export interface OrganizationAIConfigRow {
  organizationId: string;
  useCustomAi: boolean;
  aiProvider: AIProvider | null;
  aiModel: string | null;
  aiApiKeyEncrypted: string | null;
  useCustomEmbedding: boolean;
  embeddingProvider: EmbeddingProvider | null;
  embeddingModel: string | null;
  embeddingApiKeyEncrypted: string | null;
  embeddingNamespace: string | null;
  updatedAt: Date;
}

// --- Regulations --------------------------------------------------------

export interface DiscoveryRunRow {
  id: string;
  organizationId: string;
  status: RunStatus;
  circularsFound: number;
  stages: unknown[] | null;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface CircularRow {
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
  body: string | null;
  tags: string[] | null;
  dateOfIssue: Date | null;
  lastUpdated: Date | null;
  status: CircularStatus;
  version: string | null;
  link: string | null;
  linkRef: string | null;
  applicableTo: string | null;
  filePath: string | null;
  supersededById: string | null;
  discoveryRunId: string | null;
  discoveredAt: Date | null;
  indexedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- Obligations & controls --------------------------------------------

export interface ObligationRow {
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
  sourceFileId: string | null;
  sourcePage: number | null;
  sourceRegion: unknown | null;
  citationVerified: boolean;
  confidence: number | null;
  status: ObligationStatus;
  extractionModel: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Result row of the /obligations/summary aggregation (not a table).
export interface ObligationSummaryRow {
  circularId: string;
  circularName: string;
  circularCode: string;
  category: string | null;
  total: number;
  verified: number;
  confirmed: number;
  dismissed: number;
  lastExtractedAt: Date;
}

export interface ObligationApplicabilityRow {
  obligationId: string;
  entities: string[] | null;
  criteria: string | null;
  status: ApplicabilityStatus;
  rationale: string | null;
  source: OriginSource;
  confidence: number | null;
  reviewStatus: SuggestionStatus;
}

export interface ControlRow {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface ObligationControlRow {
  obligationId: string;
  controlId: string;
  mappingSource: OriginSource;
  confidence: number | null;
  rationale: string | null;
  reviewStatus: SuggestionStatus;
  createdAt: Date;
}

export interface QuestionRow {
  id: string;
  organizationId: string | null;
  circularId: string;
  code: string | null;
  title: string;
  description: string | null;
  source: OriginSource;
  answer: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- Documents, evidence, testing, monitoring --------------------------

export interface DocumentRow {
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
  effectiveDate: Date | null;
  expiryDate: Date | null;
  lastRenewalDate: Date | null;
  isAiRecommended: boolean;
  aiInsights: string[] | null;
  uploadedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentVersionRow {
  id: string;
  documentId: string;
  version: string;
  change: string;
  userId: string | null;
  userName: string;
  path: string | null;
  size: number | null;
  createdAt: Date;
}

export interface EvidenceRow {
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
  lastAuditDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ControlTestRow {
  id: string;
  controlId: string;
  testType: TestType;
  frequency: string | null;
  createdAt: Date;
}

export interface ControlTestRunRow {
  id: string;
  testId: string;
  testedAt: Date;
  result: TestResult;
  notes: string | null;
  testedByName: string | null;
}

export interface MonitoringKpiRow {
  id: string;
  controlId: string;
  kpi: string;
  threshold: string | null;
  currentValue: string | null;
  health: MonitoringHealth;
  telemetrySource: string | null;
  updatedAt: Date;
}

// --- Knowledge base -----------------------------------------------------

export interface KnowledgeBaseEntryRow {
  id: string;
  organizationId: string;
  question: string;
  answer: string;
  sourceType: SourceType;
  sourceAssessment: string | null;
  tags: string[] | null;
  status: KBStatus;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// --- Gaps & remediation -------------------------------------------------

export interface ComplianceGapRow {
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
  engagementName: string | null;
  section: string | null;
  evidenceNeeded: string | null;
  dueDate: Date | null;
  openedAt: Date;
  resolvedAt: Date | null;
  riskAcceptedReason: string | null;
  riskAcceptedById: string | null;
  riskAcceptedAt: Date | null;
  riskAcceptanceExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ComplianceGap plus the joined display name of its assignee.
export interface ComplianceGapWithRelations extends ComplianceGapRow {
  assigneeName: string | null;
}

export interface RemediationPlanRow {
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
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RemediationActionRow {
  id: string;
  planId: string;
  position: number;
  title: string;
  ownerId: string | null;
  ownerName: string | null;
  dueDate: Date | null;
  status: ActionStatus;
  completedAt: Date | null;
}

// --- Traceability, contradictions, simulation --------------------------

export interface TraceabilitySignoffRow {
  id: string;
  organizationId: string;
  obligationId: string;
  controlId: string;
  signedById: string | null;
  signedRole: string | null;
  contentHash: string | null;
  signedAt: Date;
}

export interface RegulatoryContradictionRow {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface ContradictionPartyRow {
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

export interface ObligationContradictionRow {
  obligationId: string;
  contradictionId: string;
  harmonized: boolean;
  harmonizedById: string | null;
  harmonizedAt: Date | null;
}

export interface SimulationScenarioRow {
  id: string;
  organizationId: string | null;
  name: string;
  category: SimulationCategory;
  targetCircularId: string | null;
  targetRegulator: string | null;
  hypothesisText: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SimulationRunRow {
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
  reasoning: unknown | null;
  ranById: string | null;
  ranAt: Date;
}

export interface SimulationBreachedControlRow {
  id: string;
  runId: string;
  controlId: string | null;
  controlName: string;
  reason: string | null;
  // NUMERIC comes back from `pg` as a string.
  remediationCostAmount: string | null;
  remediationCostCurrency: string;
  remediationCostNote: string | null;
  remediationDays: number | null;
}

// --- Audit & dashboard --------------------------------------------------

export interface AuditLogRow {
  id: string;
  organizationId: string;
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
  createdAt: Date;
}

// --- Autonomous agents --------------------------------------------------

export interface AgentScheduleRow {
  organizationId: string;
  agent: AutomationAgent;
  enabled: boolean;
  intervalHours: number;
  config: { onlyEmpty?: boolean; maxPerRun?: number } | null;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  updatedAt: Date | null;
}

export interface ControlAnswerRunRow {
  id: string;
  organizationId: string;
  trigger: RunTrigger;
  status: RunStatus;
  controlsTotal: number;
  generated: number;
  skipped: number;
  failed: number;
  stages: { key: string; title: string; status: string; detail?: string }[] | null;
  error: string | null;
  startedById: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}

// --- Multimodal ingestion, profile, change intelligence -------------------

export interface IngestedFileRow {
  id: string;
  organizationId: string;
  circularId: string | null;
  controlId: string | null;
  fileName: string;
  mimeType: string;
  modality: SourceModality;
  path: string;
  size: number | null;
  pageCount: number | null;
  status: IngestionStatus;
  stages: { key: string; title: string; status: string; detail?: string }[] | null;
  passAModel: string | null;
  passBModel: string | null;
  metrics: {
    itemsTotal: number;
    agreed: number;
    disputed: number;
    needsReview: number;
    agreementRate: number;
    quoteMatchRate: number | null;
    meanConfidence: number | null;
  } | null;
  error: string | null;
  uploadedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  finishedAt: Date | null;
}

export interface IngestedPageRow {
  id: string;
  fileId: string;
  pageNumber: number;
  imagePath: string | null;
  width: number | null;
  height: number | null;
  textA: string | null;
  textB: string | null;
  agreement: number | null;
}

export interface ExtractedItemRow {
  id: string;
  fileId: string;
  pageId: string | null;
  position: number;
  kind: ExtractedItemKind;
  label: string | null;
  content: string;
  structured: unknown | null;
  region: { x: number; y: number; w: number; h: number } | null;
  confidence: number | null;
  agreement: number | null;
  quoteVerified: boolean | null;
  passA: unknown | null;
  passB: unknown | null;
  reviewStatus: ItemReviewStatus;
  correctedContent: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  promotedObligationId: string | null;
  promotedControlId: string | null;
  promotedEvidenceId: string | null;
  createdAt: Date;
}

export interface OrganizationProfileRow {
  organizationId: string;
  entityType: string | null;
  regulators: string[] | null;
  // NUMERIC comes back from `pg` as a string.
  assetSizeCrore: string | null;
  licenses: string[] | null;
  jurisdictions: string[] | null;
  products: string[] | null;
  notes: string | null;
  updatedAt: Date | null;
}

export interface CircularChangeRow {
  id: string;
  organizationId: string;
  newCircularId: string;
  previousCircularId: string | null;
  summary: string | null;
  added: unknown | null;
  removed: unknown | null;
  modified: unknown | null;
  impactedControlIds: string[] | null;
  reviewStatus: SuggestionStatus;
  createdById: string | null;
  createdAt: Date;
}

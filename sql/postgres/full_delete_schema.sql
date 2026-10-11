-- ComplianceOS full teardown (schema v2, also cleans schema v1 leftovers)
-- Drops every view, table, sequence and enum type created by full_schema.sql
-- AND by the older full_schema.sql / earlier v2 drafts (Assessments, Trust
-- Center, Integrations, Billing, KBDocument*, ...). Destroys ALL data.
-- Safe on a partially built or empty database (IF EXISTS everywhere).
-- Does not touch the Supabase storage bucket.
--
-- After this, re-create with full_schema.sql.

BEGIN;

-- Views
DROP VIEW IF EXISTS "TraceabilityLink";

-- Tables (CASCADE also removes their indexes and constraints)
DROP TABLE IF EXISTS "CircularChange" CASCADE;
DROP TABLE IF EXISTS "ExtractedItem" CASCADE;
DROP TABLE IF EXISTS "IngestedPage" CASCADE;
DROP TABLE IF EXISTS "IngestedFile" CASCADE;
DROP TABLE IF EXISTS "OrganizationProfile" CASCADE;
DROP TABLE IF EXISTS "ControlAnswerRun" CASCADE;
DROP TABLE IF EXISTS "AgentSchedule" CASCADE;
DROP TABLE IF EXISTS "KBDocument" CASCADE;
DROP TABLE IF EXISTS "KBDocumentHistory" CASCADE;
DROP TABLE IF EXISTS "KBDocumentControl" CASCADE;
DROP TABLE IF EXISTS "QuestionTemplate" CASCADE;
DROP TABLE IF EXISTS "QuestionTemplateControl" CASCADE;
DROP TABLE IF EXISTS "EvidenceSource" CASCADE;
DROP TABLE IF EXISTS "Assessment" CASCADE;
DROP TABLE IF EXISTS "AssessmentCircular" CASCADE;
DROP TABLE IF EXISTS "AssessmentQuestion" CASCADE;
DROP TABLE IF EXISTS "AssessmentComment" CASCADE;
DROP TABLE IF EXISTS "AssessmentHistory" CASCADE;
DROP TABLE IF EXISTS "AssessmentQuestionHistory" CASCADE;
DROP TABLE IF EXISTS "AssessmentKBDocument" CASCADE;
DROP TABLE IF EXISTS "Integration" CASCADE;
DROP TABLE IF EXISTS "IntegrationSyncLog" CASCADE;
DROP TABLE IF EXISTS "IntegrationResource" CASCADE;
DROP TABLE IF EXISTS "BillingPlan" CASCADE;
DROP TABLE IF EXISTS "Subscription" CASCADE;
DROP TABLE IF EXISTS "CircularFile" CASCADE;
DROP TABLE IF EXISTS "TrustCenterProfile" CASCADE;
DROP TABLE IF EXISTS "TrustCenterClient" CASCADE;
DROP TABLE IF EXISTS "TrustCenterCompliance" CASCADE;
DROP TABLE IF EXISTS "TrustCenterResource" CASCADE;
DROP TABLE IF EXISTS "TrustCenterSubprocessor" CASCADE;
DROP TABLE IF EXISTS "TrustCenterFAQ" CASCADE;
DROP TABLE IF EXISTS "TrustAccessRequest" CASCADE;
DROP TABLE IF EXISTS "TrustSubscriber" CASCADE;
DROP TABLE IF EXISTS "TrustCenterAIThread" CASCADE;
DROP TABLE IF EXISTS "TrustCenterAIMessage" CASCADE;
DROP TABLE IF EXISTS "TrustCenterAIAttachment" CASCADE;
DROP TABLE IF EXISTS "TrustAccount" CASCADE;
DROP TABLE IF EXISTS "DailyPipelineSnapshot" CASCADE;
DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "SimulationBreachedControl" CASCADE;
DROP TABLE IF EXISTS "SimulationRun" CASCADE;
DROP TABLE IF EXISTS "SimulationScenario" CASCADE;
DROP TABLE IF EXISTS "ObligationContradiction" CASCADE;
DROP TABLE IF EXISTS "ContradictionParty" CASCADE;
DROP TABLE IF EXISTS "RegulatoryContradiction" CASCADE;
DROP TABLE IF EXISTS "TraceabilitySignoff" CASCADE;
DROP TABLE IF EXISTS "RemediationAction" CASCADE;
DROP TABLE IF EXISTS "RemediationPlan" CASCADE;
DROP TABLE IF EXISTS "ComplianceGap" CASCADE;
DROP TABLE IF EXISTS "ControlKnowledgeEntry" CASCADE;
DROP TABLE IF EXISTS "KnowledgeBaseEntry" CASCADE;
DROP TABLE IF EXISTS "MonitoringKpi" CASCADE;
DROP TABLE IF EXISTS "ControlTestRun" CASCADE;
DROP TABLE IF EXISTS "ControlTest" CASCADE;
DROP TABLE IF EXISTS "Evidence" CASCADE;
DROP TABLE IF EXISTS "DocumentVersion" CASCADE;
DROP TABLE IF EXISTS "Document" CASCADE;
DROP TABLE IF EXISTS "ControlQuestion" CASCADE;
DROP TABLE IF EXISTS "Question" CASCADE;
DROP TABLE IF EXISTS "ObligationControl" CASCADE;
DROP TABLE IF EXISTS "Control" CASCADE;
DROP TABLE IF EXISTS "ObligationApplicability" CASCADE;
DROP TABLE IF EXISTS "Obligation" CASCADE;
DROP TABLE IF EXISTS "Circular" CASCADE;
DROP TABLE IF EXISTS "DiscoveryRun" CASCADE;
DROP TABLE IF EXISTS "OrganizationAIConfig" CASCADE;
DROP TABLE IF EXISTS "OrganizationIPWhitelist" CASCADE;
DROP TABLE IF EXISTS "OrganizationSettings" CASCADE;
DROP TABLE IF EXISTS "Invite" CASCADE;
DROP TABLE IF EXISTS "Membership" CASCADE;
DROP TABLE IF EXISTS "Organization" CASCADE;
DROP TABLE IF EXISTS "EmailOtp" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- Sequences
DROP SEQUENCE IF EXISTS "obligation_identifier_seq";
DROP SEQUENCE IF EXISTS "compliance_gap_identifier_seq";

-- Enum types
DROP TYPE IF EXISTS "RunTrigger";
DROP TYPE IF EXISTS "ContradictionSource";
DROP TYPE IF EXISTS "SimulationMethod";
DROP TYPE IF EXISTS "SuggestionStatus";
DROP TYPE IF EXISTS "ItemReviewStatus";
DROP TYPE IF EXISTS "ExtractedItemKind";
DROP TYPE IF EXISTS "SourceModality";
DROP TYPE IF EXISTS "AutomationAgent";
DROP TYPE IF EXISTS "SubscriptionStatus";
DROP TYPE IF EXISTS "AssessmentStatus";
DROP TYPE IF EXISTS "AssessmentPriority";
DROP TYPE IF EXISTS "IntegrationStatus";
DROP TYPE IF EXISTS "EvidenceType";
DROP TYPE IF EXISTS "QuestionStatus";
DROP TYPE IF EXISTS "TrustRequestStatus";
DROP TYPE IF EXISTS "AuditEventType";
DROP TYPE IF EXISTS "AuditActorType";
DROP TYPE IF EXISTS "IngestionStatus";
DROP TYPE IF EXISTS "DocumentClassification";
DROP TYPE IF EXISTS "DocumentStatus";
DROP TYPE IF EXISTS "DocumentType";
DROP TYPE IF EXISTS "SourceType";
DROP TYPE IF EXISTS "KBStatus";
DROP TYPE IF EXISTS "SimulationCategory";
DROP TYPE IF EXISTS "ConflictNature";
DROP TYPE IF EXISTS "ActionStatus";
DROP TYPE IF EXISTS "RemediationStatus";
DROP TYPE IF EXISTS "GapStatus";
DROP TYPE IF EXISTS "RiskLevel";
DROP TYPE IF EXISTS "MonitoringHealth";
DROP TYPE IF EXISTS "TestResult";
DROP TYPE IF EXISTS "TestType";
DROP TYPE IF EXISTS "EvidenceStatus";
DROP TYPE IF EXISTS "ApplicabilityStatus";
DROP TYPE IF EXISTS "ImplementationStatus";
DROP TYPE IF EXISTS "ControlStatus";
DROP TYPE IF EXISTS "OriginSource";
DROP TYPE IF EXISTS "Relevance";
DROP TYPE IF EXISTS "ObligationStatus";
DROP TYPE IF EXISTS "ObligationType";
DROP TYPE IF EXISTS "RunStatus";
DROP TYPE IF EXISTS "CircularStatus";
DROP TYPE IF EXISTS "CircularCategory";
DROP TYPE IF EXISTS "CircularKind";
DROP TYPE IF EXISTS "Regulator";
DROP TYPE IF EXISTS "OtpPurpose";
DROP TYPE IF EXISTS "EmbeddingProvider";
DROP TYPE IF EXISTS "AIProvider";
DROP TYPE IF EXISTS "SSOProvider";
DROP TYPE IF EXISTS "UserStatus";
DROP TYPE IF EXISTS "Role";

COMMIT;

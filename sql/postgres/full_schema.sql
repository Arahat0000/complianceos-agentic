-- ComplianceOS Master Setup Schema (v2)
-- Compatible with PostgreSQL
--
-- Designed from the frontend pages and their demo data (web/src), not from
-- the old assessment-era server. The product is a regulatory pipeline:
--
--   Regulations (Circular) -> Obligations -> Controls -> Gaps -> Remediation
--
-- plus Traceability, Contradictions, Simulation, Knowledge Base, Document
-- Library, Audit Log, Dashboard and Settings. Sections below say which page
-- each table serves. Tear down with full_delete_schema.sql.
--
-- Notes
--   * Ids are VARCHAR(255) (app-generated). Demo ids such as '211' or
--     'Q-RBI-09' fit as-is.
--   * "Derived on read, not stored": obligations verified %, gap aging,
--     gap counts by risk/status, control progress %, compliance score,
--     "aiIndexComplete" (= Circular.indexedAt IS NOT NULL), active conflict
--     count, traceability "Compliant / Gap Found".
--   * Assessments were removed as a feature; the Assessment tables are gone.
--     Gaps keep a free-text "engagementName" (the audit engagement label the
--     UI shows) and Knowledge Base entries live in their own table.

-- ============================================================================
-- Enums
-- ============================================================================

-- Auth & org
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');
CREATE TYPE "SSOProvider" AS ENUM ('AZURE_AD', 'OKTA', 'GOOGLE', 'AUTH0', 'CUSTOM_SAML');
CREATE TYPE "AIProvider" AS ENUM ('OPENAI', 'ANTHROPIC', 'VERTEXAI', 'BEDROCK', 'OLLAMA', 'SARVAMAI');
CREATE TYPE "EmbeddingProvider" AS ENUM ('OPENAI', 'VERTEXAI', 'BEDROCK', 'OLLAMA');
CREATE TYPE "OtpPurpose" AS ENUM ('SIGNUP', 'PASSWORD_RESET');

-- Regulations
CREATE TYPE "Regulator" AS ENUM ('RBI', 'SEBI', 'CERT_IN', 'DPDP', 'OTHER');
CREATE TYPE "CircularKind" AS ENUM ('CIRCULAR', 'FRAMEWORK');   -- FRAMEWORK = ISO 27001 etc. shown on Controls
CREATE TYPE "CircularCategory" AS ENUM ('CYBERSECURITY', 'COMPLIANCE', 'AUDIT', 'REPORTING', 'OPERATIONS');
CREATE TYPE "CircularStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'DRAFT', 'PENDING_REVIEW');  -- PENDING_REVIEW = discovered, not yet adopted
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
-- Multimodal ingestion (scanned circulars, tables, diagrams, office files, screenshots)
CREATE TYPE "SourceModality" AS ENUM ('SCANNED_PDF', 'TEXT_PDF', 'IMAGE', 'SPREADSHEET', 'WORD', 'SCREENSHOT');
CREATE TYPE "ExtractedItemKind" AS ENUM ('TEXT_BLOCK', 'CLAUSE', 'TABLE', 'DIAGRAM', 'FIGURE', 'ROW', 'FACT');
-- AGREED: both independent passes match. DISPUTED/NEEDS_REVIEW: a human must decide.
CREATE TYPE "ItemReviewStatus" AS ENUM ('AGREED', 'DISPUTED', 'NEEDS_REVIEW', 'ACCEPTED', 'CORRECTED', 'REJECTED');
CREATE TYPE "SuggestionStatus" AS ENUM ('SUGGESTED', 'CONFIRMED', 'REJECTED');   -- AI proposals awaiting a human
CREATE TYPE "SimulationMethod" AS ENUM ('HEURISTIC', 'AI_GRAPH');
CREATE TYPE "ContradictionSource" AS ENUM ('CURATED', 'AI');
CREATE TYPE "AutomationAgent" AS ENUM ('CONTROL_ANSWERS', 'DISCOVERY');   -- agents that can run on a schedule
CREATE TYPE "RunTrigger" AS ENUM ('SCHEDULED', 'MANUAL');

-- Obligations & controls
CREATE TYPE "ObligationType" AS ENUM ('REPORTING', 'GOVERNANCE', 'CONTROL', 'DISCLOSURE', 'RECORD_KEEPING', 'OPERATIONAL', 'AUDIT', 'OTHER');
CREATE TYPE "ObligationStatus" AS ENUM ('EXTRACTED', 'CONFIRMED', 'DISMISSED');
CREATE TYPE "Relevance" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "OriginSource" AS ENUM ('AI', 'MANUAL');            -- who created a control/question/mapping
CREATE TYPE "ControlStatus" AS ENUM ('ACTIVE', 'COMPLIANCE_GAP');
CREATE TYPE "ImplementationStatus" AS ENUM ('IMPLEMENTED', 'PARTIAL', 'NOT_IMPLEMENTED');
CREATE TYPE "ApplicabilityStatus" AS ENUM ('APPLICABLE', 'EXEMPT', 'CONDITIONAL');

-- Evidence, testing, monitoring (traceability)
CREATE TYPE "EvidenceStatus" AS ENUM ('VERIFIED', 'PENDING', 'EXPIRED', 'MISSING');
CREATE TYPE "TestType" AS ENUM ('AUTOMATED_API', 'MANUAL_INSPECTION', 'EXTERNAL_AUDIT', 'VAPT');
CREATE TYPE "TestResult" AS ENUM ('PASSED', 'FAILED', 'DEFICIENT');
CREATE TYPE "MonitoringHealth" AS ENUM ('HEALTHY', 'WARNING', 'BREACHED');

-- Gaps & remediation
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "GapStatus" AS ENUM ('OPEN', 'REMEDIATING', 'RISK_ACCEPTED', 'RESOLVED');
CREATE TYPE "RemediationStatus" AS ENUM ('PENDING_APPROVAL', 'EXECUTING', 'VERIFIED');
CREATE TYPE "ActionStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- Contradictions & simulation
CREATE TYPE "ConflictNature" AS ENUM ('TIMELINE_CLASH', 'RETENTION_MISMATCH', 'DATA_PRIVACY_VS_AUDIT', 'REPORTING_THRESHOLD');
CREATE TYPE "SimulationCategory" AS ENUM ('REGULATORY_AMENDMENT', 'GEOPOLITICAL_SANCTION', 'INFRASTRUCTURE_FAILURE', 'MERGER_ACQUISITION');

-- Knowledge base, documents, audit
CREATE TYPE "KBStatus" AS ENUM ('VERIFIED', 'REVIEW', 'DRAFT');
CREATE TYPE "SourceType" AS ENUM ('INTERNAL', 'EXTERNAL');
CREATE TYPE "DocumentType" AS ENUM ('POLICY', 'PROCEDURE', 'FRAMEWORK', 'QUESTIONNAIRE', 'EVIDENCE');
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'DRAFT', 'UNDER_REVIEW', 'ARCHIVED');
CREATE TYPE "DocumentClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'AI', 'SYSTEM');
CREATE TYPE "AuditEventType" AS ENUM ('APPROVAL', 'EDIT', 'AI', 'COMMENT', 'UPLOAD', 'STATUS', 'SYSTEM', 'CREATE', 'EXPORT');

-- ============================================================================
-- Auth, org and settings  (Login, SignUp, ForgotPassword, Settings)
-- ============================================================================

CREATE TABLE "User" (
    "id" VARCHAR(255) PRIMARY KEY,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "passwordHash" VARCHAR(255),
    "googleId" VARCHAR(255) UNIQUE,
    "name" VARCHAR(255) NOT NULL,
    "avatarUrl" TEXT,
    "emailVerifiedAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Signup verification and forgot-password OTPs (/auth/verify-otp, /auth/reset-password).
CREATE TABLE "EmailOtp" (
    "id" VARCHAR(255) PRIMARY KEY,
    "email" VARCHAR(255) NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" VARCHAR(255) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "consumedAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Organization" (
    "id" VARCHAR(255) PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) UNIQUE NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Membership" (
    "id" VARCHAR(255) PRIMARY KEY,
    "userId" VARCHAR(255) NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "role" "Role" DEFAULT 'VIEWER',
    "status" "UserStatus" DEFAULT 'INVITED',
    "lastLogin" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("userId", "organizationId")
);

CREATE TABLE "Invite" (
    "id" VARCHAR(255) PRIMARY KEY,
    "email" VARCHAR(255) NOT NULL,
    "role" "Role" DEFAULT 'VIEWER',
    "token" VARCHAR(255) UNIQUE NOT NULL,
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Settings > Security tab (SSO, MFA, session timeout).
CREATE TABLE "OrganizationSettings" (
    "organizationId" VARCHAR(255) PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
    "ssoEnabled" BOOLEAN DEFAULT FALSE,
    "ssoProvider" "SSOProvider",
    "ssoConfig" JSONB,
    "mfaRequired" BOOLEAN DEFAULT FALSE,
    "sessionTimeout" INTEGER DEFAULT 30,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Settings > Security tab (IP allowlist); also enforced by server middleware.
CREATE TABLE "OrganizationIPWhitelist" (
    "id" VARCHAR(255) PRIMARY KEY,
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "cidr" CIDR NOT NULL,
    "label" VARCHAR(255),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Settings > AI tab.
CREATE TABLE "OrganizationAIConfig" (
    "organizationId" VARCHAR(255) PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
    "useCustomAi" BOOLEAN DEFAULT FALSE,
    "aiProvider" "AIProvider",
    "aiModel" VARCHAR(255),
    "aiApiKeyEncrypted" TEXT,
    "useCustomEmbedding" BOOLEAN DEFAULT FALSE,
    "embeddingProvider" "EmbeddingProvider",
    "embeddingModel" VARCHAR(255),
    "embeddingApiKeyEncrypted" TEXT,
    "embeddingNamespace" VARCHAR(255),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Regulations  (Regulations, CircularDetail, UploadCircular, EditCircular)
-- ============================================================================

-- One run of the regulatory discovery agent ("Scan Now": scan website ->
-- diff gazettes -> extract obligations -> map controls).
CREATE TABLE "DiscoveryRun" (
    "id" VARCHAR(255) PRIMARY KEY,
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "circularsFound" INTEGER NOT NULL DEFAULT 0,
    "stages" JSONB,                       -- [{tool,args,target,title,detail}, ...]
    "startedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP WITH TIME ZONE
);

-- A regulator circular / master direction, or a framework such as ISO 27001.
-- organizationId NULL = global library entry shared by every org.
CREATE TABLE "Circular" (
    "id" VARCHAR(255) PRIMARY KEY,                       -- e.g. '211', 'sebi-1'
    "organizationId" VARCHAR(255) REFERENCES "Organization"("id") ON DELETE SET NULL,
    "circularId" VARCHAR(255) NOT NULL,                  -- code, e.g. RBI/MD/nbfc/211
    "reference" VARCHAR(255),                            -- e.g. RBI/2023-24/108
    "name" VARCHAR(500) NOT NULL,
    "regulator" "Regulator" NOT NULL DEFAULT 'OTHER',
    "kind" "CircularKind" NOT NULL DEFAULT 'CIRCULAR',
    "category" "CircularCategory" NOT NULL DEFAULT 'COMPLIANCE',
    "categoryCode" VARCHAR(50),                          -- regulator's own code: cb, nbfc, pss, ...
    "description" TEXT,
    "body" TEXT,                                         -- full circular text used for extraction
    "tags" TEXT[],
    "dateOfIssue" DATE,
    "lastUpdated" DATE,
    "status" "CircularStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" VARCHAR(100),
    "link" TEXT,
    "linkRef" VARCHAR(255),                              -- regulator's own id (rbi.org.in ?id=10999)
    "applicableTo" TEXT,
    "filePath" TEXT,                                     -- uploaded PDF, if any
    "supersededById" VARCHAR(255) REFERENCES "Circular"("id") ON DELETE SET NULL,
    "discoveryRunId" VARCHAR(255) REFERENCES "DiscoveryRun"("id") ON DELETE SET NULL,
    "discoveredAt" TIMESTAMP WITH TIME ZONE,
    "indexedAt" TIMESTAMP WITH TIME ZONE,                -- NULL = AI indexing pending; set = "aiIndexComplete"
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Obligations  (Obligations, ObligationDetail, CircularDetail, UploadCircular)
-- ============================================================================

-- Obligation.identifier is globally UNIQUE; backed by a real sequence.
CREATE SEQUENCE IF NOT EXISTS "obligation_identifier_seq";

-- Atomic obligations extracted from a circular by the Obligation Extraction
-- Agent. Always org-scoped: two orgs extracting from the same shared circular
-- get independent obligation sets. "sourceQuote" is the verbatim span the
-- agent grounded the obligation in; "citationVerified" says whether that
-- quote was confirmed to be an actual substring of the circular.
CREATE TABLE "Obligation" (
    "id" VARCHAR(255) PRIMARY KEY,
    "identifier" VARCHAR(50) UNIQUE,                     -- OBL-00001
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "circularId" VARCHAR(255) NOT NULL REFERENCES "Circular"("id") ON DELETE CASCADE,
    "requirementText" TEXT NOT NULL,
    "obligationType" "ObligationType" NOT NULL DEFAULT 'OTHER',
    "deadline" TEXT,                                     -- free text: "Within 2 hours", "Ongoing"
    "applicabilityConditions" TEXT[],
    "penalty" TEXT,
    "sourceQuote" TEXT NOT NULL,
    "sourceSection" VARCHAR(255),
    "citationVerified" BOOLEAN NOT NULL DEFAULT FALSE,
    "confidence" DOUBLE PRECISION,                       -- 0..1
    "status" "ObligationStatus" NOT NULL DEFAULT 'EXTRACTED',
    "extractionModel" VARCHAR(255),
    -- Grounding when the obligation came from a scanned/multimodal source:
    "sourceFileId" VARCHAR(255),                         -- FK added below (IngestedFile is created later)
    "sourcePage" INTEGER,
    "sourceRegion" JSONB,                                -- {x,y,w,h} normalized 0..1 on that page
    "reviewedById" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "reviewedAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,   -- also "obligations extracted" on the dashboard chart
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Traceability step "Applicability": who the obligation applies to.
CREATE TABLE "ObligationApplicability" (
    "obligationId" VARCHAR(255) PRIMARY KEY REFERENCES "Obligation"("id") ON DELETE CASCADE,
    "entities" TEXT[],
    "criteria" TEXT,
    "status" "ApplicabilityStatus" NOT NULL DEFAULT 'APPLICABLE',
    "rationale" TEXT,                                    -- why (from the applicability agent or a reviewer)
    "source" "OriginSource" NOT NULL DEFAULT 'MANUAL',
    "confidence" DOUBLE PRECISION,
    "reviewStatus" "SuggestionStatus" NOT NULL DEFAULT 'CONFIRMED'
);

-- What the bank is: drives applicability (which obligations bind it).
CREATE TABLE "OrganizationProfile" (
    "organizationId" VARCHAR(255) PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
    "entityType" VARCHAR(255),                           -- e.g. Scheduled Commercial Bank, NBFC-UL, Payments Bank
    "regulators" TEXT[],                                 -- RBI, SEBI, ...
    "assetSizeCrore" NUMERIC(16,2),
    "licenses" TEXT[],
    "jurisdictions" TEXT[],
    "products" TEXT[],                                   -- retail lending, payments, custody, ...
    "notes" TEXT,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Controls  (Controls, CircularDetail "Indexed Controls" / "Questions", Dashboard)
-- ============================================================================

-- An internal control mapped to a circular. The demo keys controls by the
-- framework question id (Q-RBI-09) and also has external codes (CTRL-SEC-INC-02).
CREATE TABLE "Control" (
    "id" VARCHAR(255) PRIMARY KEY,
    "organizationId" VARCHAR(255) REFERENCES "Organization"("id") ON DELETE SET NULL,
    "circularId" VARCHAR(255) NOT NULL REFERENCES "Circular"("id") ON DELETE CASCADE,
    "code" VARCHAR(100),                                 -- external / display code
    "source" "OriginSource" NOT NULL DEFAULT 'AI',       -- AI-suggested vs manual
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "relevance" "Relevance",
    "category" VARCHAR(100),                             -- Governance, Security, Business Continuity, ...
    "framework" VARCHAR(255),                            -- RBI/MD/nbfc/211, ISO/IEC 27001:2022, Internal Policy
    "status" "ControlStatus" NOT NULL DEFAULT 'ACTIVE',
    "implementationStatus" "ImplementationStatus",
    "ownerName" VARCHAR(255),                            -- owning team/person shown in traceability
    "answer" TEXT,                                       -- AI-generated or human answer on the Controls page
    "notes" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Obligation <-> Control is many-to-many (Controls page shows the obligations a
-- control satisfies; Traceability shows the control chosen per obligation).
CREATE TABLE "ObligationControl" (
    "obligationId" VARCHAR(255) NOT NULL REFERENCES "Obligation"("id") ON DELETE CASCADE,
    "controlId" VARCHAR(255) NOT NULL REFERENCES "Control"("id") ON DELETE CASCADE,
    "mappingSource" "OriginSource" NOT NULL DEFAULT 'AI',
    "confidence" DOUBLE PRECISION,
    "rationale" TEXT,                                    -- why the mapping agent proposed it
    "reviewStatus" "SuggestionStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("obligationId", "controlId")
);

-- Assessment question shown per circular ("Q-RBI-05"); replaces the old
-- AssessmentQuestion for this purpose. Many-to-many with controls.
CREATE TABLE "Question" (
    "id" VARCHAR(255) PRIMARY KEY,
    "organizationId" VARCHAR(255) REFERENCES "Organization"("id") ON DELETE SET NULL,
    "circularId" VARCHAR(255) NOT NULL REFERENCES "Circular"("id") ON DELETE CASCADE,
    "code" VARCHAR(100),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" "OriginSource" NOT NULL DEFAULT 'AI',
    "answer" TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ControlQuestion" (
    "controlId" VARCHAR(255) NOT NULL REFERENCES "Control"("id") ON DELETE CASCADE,
    "questionId" VARCHAR(255) NOT NULL REFERENCES "Question"("id") ON DELETE CASCADE,
    PRIMARY KEY ("controlId", "questionId")
);

-- ============================================================================
-- Document Library  (DocumentLibrary, DocumentDetail, EditDocument, UploadDocument)
-- ============================================================================

CREATE TABLE "Document" (
    "id" VARCHAR(255) PRIMARY KEY,
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "path" TEXT,
    "size" BIGINT,                                       -- bytes
    "pageCount" INTEGER,
    "type" "DocumentType",
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',            -- lifecycle shown as a badge
    "ingestionStatus" "IngestionStatus" NOT NULL DEFAULT 'PENDING', -- parse/embed pipeline
    "classification" "DocumentClassification",
    "department" VARCHAR(100),
    "owner" VARCHAR(255),
    "version" VARCHAR(50) DEFAULT '1.0',
    "tags" TEXT[],
    "effectiveDate" DATE,
    "expiryDate" DATE,
    "lastRenewalDate" DATE,
    "isAiRecommended" BOOLEAN DEFAULT FALSE,
    "aiInsights" JSONB,                                  -- string[] shown on DocumentDetail
    "uploadedById" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "DocumentVersion" (
    "id" VARCHAR(255) PRIMARY KEY,
    "documentId" VARCHAR(255) NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
    "version" VARCHAR(50) NOT NULL,
    "change" TEXT NOT NULL,
    "userId" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "userName" VARCHAR(255) NOT NULL,
    "path" TEXT,
    "size" BIGINT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Evidence for a control (Controls page "evidence docs", Traceability step
-- "Evidence", EditDocument linked controls). May point at a library Document
-- or stand alone (external file / excerpt).
CREATE TABLE "Evidence" (
    "id" VARCHAR(255) PRIMARY KEY,
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "controlId" VARCHAR(255) NOT NULL REFERENCES "Control"("id") ON DELETE CASCADE,
    "documentId" VARCHAR(255) REFERENCES "Document"("id") ON DELETE SET NULL,
    "name" VARCHAR(255) NOT NULL,
    "documentType" VARCHAR(100),
    "section" VARCHAR(255),
    "excerpt" TEXT,
    "size" BIGINT,
    "fileUrl" TEXT,
    "sourceFileId" VARCHAR(255),                         -- FK added below (IngestedFile is created later)
    "facts" JSONB,                                       -- facts read from a screenshot: [{key,value,confidence}]
    "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING',
    "lastAuditDate" DATE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Testing & monitoring  (Traceability steps "Testing" and "Monitoring")
-- ============================================================================

CREATE TABLE "ControlTest" (
    "id" VARCHAR(255) PRIMARY KEY,
    "controlId" VARCHAR(255) NOT NULL REFERENCES "Control"("id") ON DELETE CASCADE,
    "testType" "TestType" NOT NULL,
    "frequency" VARCHAR(100),                            -- e.g. Quarterly, Continuous
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- "lastTested" and "result" on the page = the latest run.
CREATE TABLE "ControlTestRun" (
    "id" VARCHAR(255) PRIMARY KEY,
    "testId" VARCHAR(255) NOT NULL REFERENCES "ControlTest"("id") ON DELETE CASCADE,
    "testedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "result" "TestResult" NOT NULL,
    "notes" TEXT,
    "testedByName" VARCHAR(255)
);

CREATE TABLE "MonitoringKpi" (
    "id" VARCHAR(255) PRIMARY KEY,
    "controlId" VARCHAR(255) NOT NULL REFERENCES "Control"("id") ON DELETE CASCADE,
    "kpi" VARCHAR(255) NOT NULL,
    "threshold" VARCHAR(255),
    "currentValue" VARCHAR(255),
    "health" "MonitoringHealth" NOT NULL DEFAULT 'HEALTHY',
    "telemetrySource" VARCHAR(255),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Knowledge Base  (KnowledgeBase page, Controls page KB answers)
-- ============================================================================

CREATE TABLE "KnowledgeBaseEntry" (
    "id" VARCHAR(255) PRIMARY KEY,
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL DEFAULT 'INTERNAL',
    "sourceAssessment" VARCHAR(255),                     -- audit engagement the answer came from
    "tags" TEXT[],
    "status" "KBStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ControlKnowledgeEntry" (
    "controlId" VARCHAR(255) NOT NULL REFERENCES "Control"("id") ON DELETE CASCADE,
    "entryId" VARCHAR(255) NOT NULL REFERENCES "KnowledgeBaseEntry"("id") ON DELETE CASCADE,
    PRIMARY KEY ("controlId", "entryId")
);

-- ============================================================================
-- Gaps & Remediation  (Gaps, Traceability steps "Gap" and "Remediation")
-- ============================================================================

-- ComplianceGap.identifier is globally UNIQUE; backed by a real sequence
-- instead of a race-prone count-based number.
CREATE SEQUENCE IF NOT EXISTS "compliance_gap_identifier_seq";

CREATE TABLE "ComplianceGap" (
    "id" VARCHAR(255) PRIMARY KEY,
    "identifier" VARCHAR(50) UNIQUE,                     -- GAP-00001
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "obligationId" VARCHAR(255) REFERENCES "Obligation"("id") ON DELETE SET NULL,
    "controlId" VARCHAR(255) REFERENCES "Control"("id") ON DELETE SET NULL,
    "questionId" VARCHAR(255) REFERENCES "Question"("id") ON DELETE SET NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "status" "GapStatus" NOT NULL DEFAULT 'OPEN',
    "assigneeId" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "engagementName" VARCHAR(255),                       -- audit engagement label ("Assessment" column)
    "section" VARCHAR(255),
    "evidenceNeeded" TEXT,
    "dueDate" DATE,
    "openedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,    -- gap age = now - openedAt
    "resolvedAt" TIMESTAMP WITH TIME ZONE,               -- "gaps resolved" on the dashboard chart
    "riskAcceptedReason" TEXT,
    "riskAcceptedById" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "riskAcceptedAt" TIMESTAMP WITH TIME ZONE,
    "riskAcceptanceExpiresAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- The remediation plan generated for a gap (was ephemeral) and its work order.
CREATE TABLE "RemediationPlan" (
    "id" VARCHAR(255) PRIMARY KEY,
    "gapId" VARCHAR(255) NOT NULL UNIQUE REFERENCES "ComplianceGap"("id") ON DELETE CASCADE,
    "planText" TEXT NOT NULL,
    "generatedBy" "OriginSource" NOT NULL DEFAULT 'AI',
    "model" VARCHAR(255),
    "workOrderId" VARCHAR(100),                          -- REM-WO-8821
    "leadTeam" VARCHAR(255),
    "slaDays" INTEGER,
    "actionSummary" TEXT,
    "status" "RemediationStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvedById" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "approvedAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "RemediationAction" (
    "id" VARCHAR(255) PRIMARY KEY,
    "planId" VARCHAR(255) NOT NULL REFERENCES "RemediationPlan"("id") ON DELETE CASCADE,
    "position" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "ownerId" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "ownerName" VARCHAR(255),
    "dueDate" DATE,
    "status" "ActionStatus" NOT NULL DEFAULT 'TODO',
    "completedAt" TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- Traceability sign-off  (TraceabilityMatrix / TraceabilityDetail "CCO sign-off")
-- ============================================================================

-- A traceability row is one obligation -> control lineage chain (see the
-- "TraceabilityLink" view). Signing it off is recorded here.
CREATE TABLE "TraceabilitySignoff" (
    "id" VARCHAR(255) PRIMARY KEY,
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "obligationId" VARCHAR(255) NOT NULL REFERENCES "Obligation"("id") ON DELETE CASCADE,
    "controlId" VARCHAR(255) NOT NULL REFERENCES "Control"("id") ON DELETE CASCADE,
    "signedById" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "signedRole" VARCHAR(100),                           -- e.g. CCO
    "contentHash" VARCHAR(128),                          -- hash of the chain at sign-off time
    "signedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Contradictions  (CircularDetail conflict badges, "Harmonize")
-- ============================================================================

CREATE TABLE "RegulatoryContradiction" (
    "id" VARCHAR(255) PRIMARY KEY,
    "organizationId" VARCHAR(255) REFERENCES "Organization"("id") ON DELETE CASCADE,   -- NULL = global
    "domain" VARCHAR(255),
    "severity" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "conflictNature" "ConflictNature" NOT NULL,
    -- harmonized recommendation
    "strictestCommonDenominator" TEXT,
    "operationalRule" TEXT,
    "automatedControlId" VARCHAR(255) REFERENCES "Control"("id") ON DELETE SET NULL,
    "auditDefenseRationale" TEXT,
    "source" "ContradictionSource" NOT NULL DEFAULT 'CURATED',
    "reviewStatus" "SuggestionStatus" NOT NULL DEFAULT 'CONFIRMED',   -- AI-detected ones start as SUGGESTED
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- The regulators/clauses that are in conflict.
CREATE TABLE "ContradictionParty" (
    "id" VARCHAR(255) PRIMARY KEY,
    "contradictionId" VARCHAR(255) NOT NULL REFERENCES "RegulatoryContradiction"("id") ON DELETE CASCADE,
    "circularId" VARCHAR(255) REFERENCES "Circular"("id") ON DELETE SET NULL,
    "regulator" "Regulator" NOT NULL,
    "circularTitle" VARCHAR(500),
    "clause" VARCHAR(255),
    "requirement" TEXT,
    "timelineOrCondition" TEXT,
    "obligationId" VARCHAR(255) REFERENCES "Obligation"("id") ON DELETE SET NULL,
    "sourceQuote" TEXT                                   -- verbatim clause the conflict is grounded in
);

-- Obligation <-> contradiction, with the per-org "harmonized" flag.
CREATE TABLE "ObligationContradiction" (
    "obligationId" VARCHAR(255) NOT NULL REFERENCES "Obligation"("id") ON DELETE CASCADE,
    "contradictionId" VARCHAR(255) NOT NULL REFERENCES "RegulatoryContradiction"("id") ON DELETE CASCADE,
    "harmonized" BOOLEAN NOT NULL DEFAULT FALSE,
    "harmonizedById" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "harmonizedAt" TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY ("obligationId", "contradictionId")
);

-- ============================================================================
-- Simulation  (SimulationEngine)
-- ============================================================================

CREATE TABLE "SimulationScenario" (
    "id" VARCHAR(255) PRIMARY KEY,
    "organizationId" VARCHAR(255) REFERENCES "Organization"("id") ON DELETE CASCADE,   -- NULL = built-in preset
    "name" VARCHAR(255) NOT NULL,
    "category" "SimulationCategory" NOT NULL DEFAULT 'REGULATORY_AMENDMENT',
    "targetCircularId" VARCHAR(255) REFERENCES "Circular"("id") ON DELETE SET NULL,
    "targetRegulator" VARCHAR(255),                      -- name as typed/selected in the UI
    "hypothesisText" TEXT NOT NULL,
    "createdById" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SimulationRun" (
    "id" VARCHAR(255) PRIMARY KEY,
    "scenarioId" VARCHAR(255) NOT NULL REFERENCES "SimulationScenario"("id") ON DELETE CASCADE,
    -- The org that ran it (a built-in preset scenario is shared, its runs are not).
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "initialCriticalGaps" INTEGER NOT NULL DEFAULT 0,
    "initialHighGaps" INTEGER NOT NULL DEFAULT 0,
    "initialComplianceScore" DOUBLE PRECISION,
    "simulatedCriticalGaps" INTEGER NOT NULL DEFAULT 0,
    "simulatedHighGaps" INTEGER NOT NULL DEFAULT 0,
    "simulatedComplianceScore" DOUBLE PRECISION,
    "blastRadiusScore" DOUBLE PRECISION,
    "unaffectedControlsCount" INTEGER,
    "suggestedPlaybook" TEXT,
    "method" "SimulationMethod" NOT NULL DEFAULT 'HEURISTIC',
    "reasoning" JSONB,                                   -- AI_GRAPH: per-control reasoning + the graph slice it was given
    "ranById" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "ranAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SimulationBreachedControl" (
    "id" VARCHAR(255) PRIMARY KEY,
    "runId" VARCHAR(255) NOT NULL REFERENCES "SimulationRun"("id") ON DELETE CASCADE,
    "controlId" VARCHAR(255) REFERENCES "Control"("id") ON DELETE SET NULL,
    "controlName" VARCHAR(500) NOT NULL,
    "reason" TEXT,
    "remediationCostAmount" NUMERIC(16,2),               -- numeric so it can be summed
    "remediationCostCurrency" VARCHAR(3) DEFAULT 'INR',
    "remediationCostNote" VARCHAR(255),                  -- e.g. "Legal renegotiation", "/ yr"
    "remediationDays" INTEGER
);

-- ============================================================================
-- Audit Log & dashboard history  (AuditLog, Dashboard)
-- ============================================================================

-- Pipeline-wide event log. Actors can be a user, the AI assistant or the system.
CREATE TABLE "AuditLog" (
    "id" VARCHAR(255) PRIMARY KEY,
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'USER',
    "actorUserId" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "actorName" VARCHAR(255) NOT NULL,                   -- snapshot: 'Sarah Jenkins', 'AI Assistant', 'System'
    "type" "AuditEventType" NOT NULL,
    "action" VARCHAR(255) NOT NULL,
    "detail" TEXT,
    "objectType" VARCHAR(50),                            -- CIRCULAR, OBLIGATION, CONTROL, GAP, DOCUMENT, KB_ENTRY, SETTINGS, ...
    "objectId" VARCHAR(255),
    "context" VARCHAR(255),                              -- circular code / engagement label shown on the row
    "ip" INET,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard "Pipeline Activity" chart (obligations extracted vs gaps
-- resolved per day). Can be rebuilt from Obligation.createdAt and
-- ComplianceGap.resolvedAt; keep a snapshot table if history must survive deletes.
CREATE TABLE "DailyPipelineSnapshot" (
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "snapshotDate" DATE NOT NULL,
    "obligationsExtracted" INTEGER NOT NULL DEFAULT 0,
    "gapsResolved" INTEGER NOT NULL DEFAULT 0,
    "openGaps" INTEGER,
    "complianceScore" DOUBLE PRECISION,
    PRIMARY KEY ("organizationId", "snapshotDate")
);

-- ============================================================================
-- Multimodal ingestion  (Ingestion Studio)
-- ============================================================================

-- One uploaded source: a scanned circular, a photo, a spreadsheet/Word control
-- register, or an evidence screenshot. Two independent extraction passes read it;
-- their agreement drives the review queue.
CREATE TABLE "IngestedFile" (
    "id" VARCHAR(255) PRIMARY KEY,
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "circularId" VARCHAR(255) REFERENCES "Circular"("id") ON DELETE SET NULL,   -- regulatory source
    "controlId" VARCHAR(255) REFERENCES "Control"("id") ON DELETE SET NULL,     -- evidence screenshot target
    "fileName" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(255) NOT NULL,
    "modality" "SourceModality" NOT NULL,
    "path" TEXT NOT NULL,                                -- storage key of the original
    "size" BIGINT,
    "pageCount" INTEGER,
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "stages" JSONB,                                      -- [{key,title,status,detail}]
    "passAModel" VARCHAR(255),
    "passBModel" VARCHAR(255),
    "metrics" JSONB,                                     -- {itemsTotal, agreed, disputed, needsReview, agreementRate, quoteMatchRate, meanConfidence}
    "error" TEXT,
    "uploadedById" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP WITH TIME ZONE
);

ALTER TABLE "Obligation"
    ADD CONSTRAINT "fk_obligation_sourcefile" FOREIGN KEY ("sourceFileId") REFERENCES "IngestedFile"("id") ON DELETE SET NULL;
ALTER TABLE "Evidence"
    ADD CONSTRAINT "fk_evidence_sourcefile" FOREIGN KEY ("sourceFileId") REFERENCES "IngestedFile"("id") ON DELETE SET NULL;

-- A rasterised page (or sheet) of an IngestedFile with what each pass read from it.
CREATE TABLE "IngestedPage" (
    "id" VARCHAR(255) PRIMARY KEY,
    "fileId" VARCHAR(255) NOT NULL REFERENCES "IngestedFile"("id") ON DELETE CASCADE,
    "pageNumber" INTEGER NOT NULL,
    "imagePath" TEXT,                                    -- storage key of the page image (NULL for office files)
    "width" INTEGER,
    "height" INTEGER,
    "textA" TEXT,                                        -- full page text according to pass A
    "textB" TEXT,                                        -- ... according to pass B
    "agreement" DOUBLE PRECISION,                        -- 0..1 text agreement between passes
    UNIQUE ("fileId", "pageNumber")
);

-- One thing found on a page: a clause, a table, a diagram, a figure, a spreadsheet row
-- or a fact read from a screenshot — with where it is and how sure we are.
CREATE TABLE "ExtractedItem" (
    "id" VARCHAR(255) PRIMARY KEY,
    "fileId" VARCHAR(255) NOT NULL REFERENCES "IngestedFile"("id") ON DELETE CASCADE,
    "pageId" VARCHAR(255) REFERENCES "IngestedPage"("id") ON DELETE CASCADE,
    "position" INTEGER NOT NULL DEFAULT 0,
    "kind" "ExtractedItemKind" NOT NULL,
    "label" VARCHAR(500),                                -- clause number, table title, diagram name, sheet!row
    "content" TEXT NOT NULL,                             -- consensus text (verbatim for clauses)
    "structured" JSONB,                                  -- TABLE {columns,rows} | DIAGRAM {steps:[{id,label,actor,deadline,next}]} | ROW {...} | FACT {key,value}
    "region" JSONB,                                      -- {x,y,w,h} normalized 0..1 on the page image
    "confidence" DOUBLE PRECISION,                       -- combined
    "agreement" DOUBLE PRECISION,                        -- pass A vs pass B similarity
    "quoteVerified" BOOLEAN,                             -- clause text found in the other pass's page text
    "passA" JSONB,
    "passB" JSONB,
    "reviewStatus" "ItemReviewStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "correctedContent" TEXT,                             -- reviewer's fix (reviewStatus CORRECTED)
    "reviewedById" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "reviewedAt" TIMESTAMP WITH TIME ZONE,
    -- what this item became once promoted:
    "promotedObligationId" VARCHAR(255) REFERENCES "Obligation"("id") ON DELETE SET NULL,
    "promotedControlId" VARCHAR(255) REFERENCES "Control"("id") ON DELETE SET NULL,
    "promotedEvidenceId" VARCHAR(255) REFERENCES "Evidence"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Change intelligence  (Regulations: what changed between two versions)
-- ============================================================================

CREATE TABLE "CircularChange" (
    "id" VARCHAR(255) PRIMARY KEY,
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "newCircularId" VARCHAR(255) NOT NULL REFERENCES "Circular"("id") ON DELETE CASCADE,
    "previousCircularId" VARCHAR(255) REFERENCES "Circular"("id") ON DELETE SET NULL,
    "summary" TEXT,
    "added" JSONB,                                       -- obligations only in the new version
    "removed" JSONB,                                     -- obligations only in the previous version
    "modified" JSONB,                                    -- [{before, after, change}]
    "impactedControlIds" TEXT[],                         -- controls mapped to changed/removed obligations
    "reviewStatus" "SuggestionStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdById" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Autonomous agents  (Controls "auto-answer" panel, Regulations "discovery" panel)
-- ============================================================================

-- Per-org schedule for a recurring agent ("every 24h"). The server scheduler
-- claims rows whose nextRunAt has passed (FOR UPDATE SKIP LOCKED) and starts a run.
CREATE TABLE "AgentSchedule" (
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "agent" "AutomationAgent" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
    "intervalHours" INTEGER NOT NULL DEFAULT 24 CHECK ("intervalHours" > 0),
    "config" JSONB,                                      -- e.g. {"onlyEmpty": true, "maxPerRun": 50}
    "lastRunAt" TIMESTAMP WITH TIME ZONE,
    "nextRunAt" TIMESTAMP WITH TIME ZONE,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("organizationId", "agent")
);

-- One run of the control auto-answer agent (scheduled or "Run now").
CREATE TABLE "ControlAnswerRun" (
    "id" VARCHAR(255) PRIMARY KEY,
    "organizationId" VARCHAR(255) NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
    "trigger" "RunTrigger" NOT NULL DEFAULT 'MANUAL',
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "controlsTotal" INTEGER NOT NULL DEFAULT 0,          -- controls considered
    "generated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,                -- already answered / shared controls / over the cap
    "failed" INTEGER NOT NULL DEFAULT 0,
    "stages" JSONB,                                      -- [{key,title,status,detail}, ...]
    "error" TEXT,
    "startedById" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "startedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- Views
-- ============================================================================

-- One row per obligation -> control chain (the Traceability matrix). Evidence,
-- tests and monitoring are one-to-many and are read from their own tables.
CREATE VIEW "TraceabilityLink" AS
SELECT
    oc."obligationId",
    oc."controlId",
    o."organizationId",
    o."identifier"            AS "obligationIdentifier",
    o."requirementText",
    o."obligationType",
    o."deadline",
    o."penalty",
    o."confidence",
    o."sourceSection",
    o."sourceQuote",
    c."id"                    AS "circularRowId",
    c."circularId"            AS "circularCode",
    c."name"                  AS "circularName",
    c."regulator",
    c."dateOfIssue",
    ap."status"               AS "applicabilityStatus",
    ap."entities"             AS "applicableEntities",
    ap."criteria"             AS "applicabilityCriteria",
    ctl."title"               AS "controlTitle",
    ctl."framework",
    ctl."ownerName"           AS "controlOwner",
    ctl."implementationStatus",
    g."id"                    AS "gapId",
    g."identifier"            AS "gapIdentifier",
    g."riskLevel"             AS "gapRiskLevel",
    g."status"                AS "gapStatus",
    g."title"                 AS "gapTitle",
    g."openedAt"              AS "gapOpenedAt",
    g."dueDate"               AS "gapDueDate",
    rp."status"               AS "remediationStatus",
    rp."workOrderId",
    rp."leadTeam"             AS "remediationLeadTeam",
    rp."slaDays"              AS "remediationSlaDays",
    rp."actionSummary"        AS "remediationActionSummary",
    (g."id" IS NULL)          AS "isCompliant"
FROM "ObligationControl" oc
JOIN "Obligation" o          ON o."id" = oc."obligationId"
JOIN "Circular" c            ON c."id" = o."circularId"
JOIN "Control" ctl           ON ctl."id" = oc."controlId"
LEFT JOIN "ObligationApplicability" ap ON ap."obligationId" = o."id"
-- One open gap per link: prefer a gap on this exact obligation, else a control-level
-- gap (raised from the Controls page with no obligation chosen).
LEFT JOIN LATERAL (
    SELECT * FROM "ComplianceGap" gg
     WHERE gg."controlId" = ctl."id" AND gg."organizationId" = o."organizationId"
       AND (gg."obligationId" = o."id" OR gg."obligationId" IS NULL)
       AND gg."status" NOT IN ('RESOLVED', 'RISK_ACCEPTED')
     ORDER BY (gg."obligationId" IS NOT NULL) DESC, gg."openedAt" DESC
     LIMIT 1
) g ON TRUE
LEFT JOIN "RemediationPlan" rp ON rp."gapId" = g."id";

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE UNIQUE INDEX "idx_circular_code" ON "Circular" (COALESCE("organizationId", ''), "circularId");
CREATE UNIQUE INDEX "idx_circular_linkref" ON "Circular" (COALESCE("organizationId", ''), "linkRef") WHERE "linkRef" IS NOT NULL;
CREATE INDEX "idx_circular_regulator_status" ON "Circular" ("regulator", "status");
CREATE INDEX "idx_circular_categorycode" ON "Circular" ("regulator", "categoryCode");

CREATE INDEX "idx_obligation_circular" ON "Obligation" ("circularId");
CREATE INDEX "idx_obligation_org_status" ON "Obligation" ("organizationId", "status");
CREATE INDEX "idx_obligationcontrol_control" ON "ObligationControl" ("controlId");

CREATE INDEX "idx_control_circular" ON "Control" ("circularId");
CREATE INDEX "idx_control_org" ON "Control" ("organizationId");
CREATE INDEX "idx_question_circular" ON "Question" ("circularId");
CREATE INDEX "idx_controlquestion_question" ON "ControlQuestion" ("questionId");

CREATE INDEX "idx_document_org_status" ON "Document" ("organizationId", "status");
CREATE INDEX "idx_document_expiry" ON "Document" ("expiryDate");
CREATE INDEX "idx_evidence_control" ON "Evidence" ("controlId");
CREATE INDEX "idx_controltest_control" ON "ControlTest" ("controlId");
CREATE INDEX "idx_controltestrun_test" ON "ControlTestRun" ("testId", "testedAt" DESC);
CREATE INDEX "idx_monitoringkpi_control" ON "MonitoringKpi" ("controlId");

CREATE INDEX "idx_kbentry_org_status" ON "KnowledgeBaseEntry" ("organizationId", "status");

CREATE INDEX "idx_gap_org_status" ON "ComplianceGap" ("organizationId", "status");
CREATE INDEX "idx_gap_control" ON "ComplianceGap" ("controlId");
-- At most one open gap per (org, control, obligation) — guards concurrent "Mark as gap" calls.
CREATE UNIQUE INDEX "idx_gap_open_unique" ON "ComplianceGap" ("organizationId", "controlId", COALESCE("obligationId", ''))
    WHERE "controlId" IS NOT NULL AND "status" IN ('OPEN', 'REMEDIATING');
CREATE INDEX "idx_gap_obligation" ON "ComplianceGap" ("obligationId");
CREATE INDEX "idx_gap_assignee" ON "ComplianceGap" ("assigneeId");
CREATE INDEX "idx_remediationaction_plan" ON "RemediationAction" ("planId");

CREATE INDEX "idx_signoff_chain" ON "TraceabilitySignoff" ("obligationId", "controlId");
CREATE INDEX "idx_contradictionparty_contradiction" ON "ContradictionParty" ("contradictionId");
CREATE INDEX "idx_obligationcontradiction_contradiction" ON "ObligationContradiction" ("contradictionId");

CREATE INDEX "idx_simulationrun_scenario" ON "SimulationRun" ("organizationId", "scenarioId", "ranAt" DESC);
CREATE INDEX "idx_simulationbreached_run" ON "SimulationBreachedControl" ("runId");

CREATE INDEX "idx_auditlog_org_created" ON "AuditLog" ("organizationId", "createdAt" DESC);
CREATE INDEX "idx_auditlog_object" ON "AuditLog" ("objectType", "objectId");
CREATE INDEX "idx_emailotp_email" ON "EmailOtp" ("email", "purpose");
CREATE INDEX "idx_discoveryrun_org" ON "DiscoveryRun" ("organizationId", "startedAt" DESC);
CREATE INDEX "idx_ingestedfile_org" ON "IngestedFile" ("organizationId", "createdAt" DESC);
CREATE INDEX "idx_ingestedpage_file" ON "IngestedPage" ("fileId", "pageNumber");
CREATE INDEX "idx_extracteditem_file" ON "ExtractedItem" ("fileId", "position");
CREATE INDEX "idx_extracteditem_review" ON "ExtractedItem" ("fileId", "reviewStatus");
CREATE INDEX "idx_obligation_sourcefile" ON "Obligation" ("sourceFileId");
CREATE INDEX "idx_circularchange_new" ON "CircularChange" ("organizationId", "newCircularId");
CREATE INDEX "idx_agentschedule_due" ON "AgentSchedule" ("nextRunAt") WHERE "enabled";
CREATE INDEX "idx_controlanswerrun_org" ON "ControlAnswerRun" ("organizationId", "startedAt" DESC);

interface ComplianceAnswer {
  keywords: string[];
  title: string;
  response: string;
  citations: string[];
  relatedAction?: {
    label: string;
    href: string;
  };
}

const KNOWLEDGE_BASE_ANSWERS: ComplianceAnswer[] = [
  {
    keywords: ["blocked", "export", "critical gap", "critical", "why is export blocked"],
    title: "Audit Signoff & Export Blocking Policy",
    response: `**Export is strictly blocked when 1 or more Critical gaps remain unresolved.**

### Key Auditor Requirements:
1. **Zero Critical Gaps for Signoff:** Statutory auditors and regulatory bodies (RBI/SEBI) require every Critical severity gap to be either **Remediated** or formally **Risk Accepted**.
2. **Acceptable Alternatives:**
   - **Remediation:** Complete the assigned action plan with verified evidence attached in the Gaps tracker.
   - **Formal Risk Acceptance:** If compensating controls exist (e.g. air-gapped immutable backup storage), an authorized Chief Information Security Officer (CISO) or Compliance Head can approve a time-bound Risk Acceptance waiver.
3. **Unblocking Procedure:** Once the critical gap status changes to *Resolved* or *Risk Accepted*, the export restriction lifts automatically.`,
    citations: ["RBI IT Governance Master Direction Sec 7.4", "ISO 27001:2022 Annex A.5.15", "ComplianceOS Gaps Engine v2"],
    relatedAction: {
      label: "View Critical Gaps",
      href: "/gaps",
    },
  },
  {
    keywords: ["rbi", "cyber resilience", "master direction", "rbi cyber", "obligation"],
    title: "RBI Cyber Resilience & IT Governance Directives",
    response: `**The RBI Master Direction on IT Governance, Risk, Controls and Assurance mandates comprehensive baseline security.**

### Core Statutory Obligations:
- **Governance & Oversight:** Mandatory board-level IT Strategy Committee and IT Steering Committee meeting quarterly.
- **Access Control:** Enforced Multi-Factor Authentication (MFA) on all administrative sessions, remote access, and privileged database consoles.
- **Incident Disclosure:** Reporting all cyber incidents within **6 hours** of detection to the Reserve Bank of India and CERT-In.
- **Vulnerability Management:** Quarterly vulnerability assessments (VA) and biannual third-party penetration testing (VAPT) across all critical payment infrastructure.
- **Business Continuity & BCP:** Recovery Time Objective (RTO) under 2 hours and Recovery Point Objective (RPO) under 15 minutes for Tier-1 financial systems.`,
    citations: ["RBI/2023-24/108", "RBI IT Framework Cir. 12562", "Master Direction - IT Governance 2023"],
    relatedAction: {
      label: "View RBI Obligations",
      href: "/regulations",
    },
  },
  {
    keywords: ["risk accept", "risk acceptance", "waiver", "compensating"],
    title: "Formal Risk Acceptance Workflow",
    response: `**Risk Acceptance is an auditable mechanism for managing compliance exceptions without failing statutory audits.**

### Workflow Steps:
1. **Document Compensating Controls:** Provide verifiable technical mitigations that reduce residual impact.
2. **Establish Expiry Date:** All risk acceptances are temporary (maximum 90 to 180 days) and cannot be indefinite.
3. **Role-Based Authorization:** Requires formal signoff from a designated Compliance Officer or Security Lead.
4. **Immutable Audit Trail:** Logged with cryptographic user attestation in the **Audit Log** for external regulatory inspection.`,
    citations: ["Internal Security Policy SEC-POL-09", "Audit Standard SAS-70 / SOC 2 Type II", "ComplianceOS Policy Engine"],
    relatedAction: {
      label: "Inspect Audit Trail",
      href: "/audit-log",
    },
  },
  {
    keywords: ["sebi", "penalty", "penalties", "sebi circular", "reporting window"],
    title: "SEBI Compliance Directives & Enforcement",
    response: `**SEBI mandates rigorous cybersecurity frameworks for Regulated Entities (Stock Brokers, Depository Participants, AMCs).**

### Enforcement & Penalties:
- **Daily Compounding Fines:** Delay in submitting cybersecurity audit reports incurs financial penalties per day under SEBI Act Section 15HB.
- **Root Cause Analysis (RCA):** Regulated entities must submit a comprehensive RCA within **14 calendar days** of any cyber incident.
- **Mandatory External Audit:** Annual cyber audit conducted exclusively by CERT-In empaneled audit organizations.`,
    citations: ["SEBI/HO/MIRSD/MIRSD-PoD-1/P/CIR/2024/37", "SEBI Cybersecurity & Cyber Resilience Framework", "Securities Contracts (Regulation) Act"],
    relatedAction: {
      label: "Explore Regulations",
      href: "/regulations",
    },
  },
  {
    keywords: ["mapping", "ai mapper", "index", "how does ai", "link"],
    title: "AI Regulation-to-Control Mapping Engine",
    response: `**ComplianceOS utilizes domain-tuned LLMs to extract obligations and automate control mapping.**

### How the Pipeline Operates:
1. **Document Ingestion:** Regulatory circulars and directives are parsed and normalized into structured clauses.
2. **Obligation Extraction:** The AI extracts binding compliance mandates, applicability criteria, and stated penalties.
3. **Control Cross-Referencing:** Semantic embeddings match obligations against unified internal controls (e.g. Access Control, Data Encryption, DR).
4. **Audit Question Generation:** Automatically derives self-assessment checklist questions mapped to each indexed obligation.
5. **Human-in-the-Loop:** Compliance teams retain full authority to edit, add manual controls, or override AI suggestions.`,
    citations: ["ComplianceOS Semantic Vector Index", "ISO 27001 Mapping Registry", "Unified Compliance Framework (UCF)"],
    relatedAction: {
      label: "View Controls",
      href: "/controls",
    },
  },
  {
    keywords: ["incident", "cert-in", "disclosure", "6 hours", "timeline"],
    title: "Mandatory Cyber Incident Reporting Timelines",
    response: `**Mandatory statutory disclosure windows across Indian regulatory bodies:**

| Regulatory Body | Reporting Timeline | Contact Channel |
| :--- | :--- | :--- |
| **CERT-In** | Within **6 hours** of notice | incident@cert-in.org.in |
| **RBI** | Within **2 to 6 hours** (Priority) | CSITE Portal |
| **SEBI** | Within **6 hours** (Preliminary), 14 days (RCA) | SEBI Cyber Portal |
| **Data Protection Board (DPDP)** | Without undue delay (72h standard) | DPDP Compliance Portal |

Failure to report within designated windows constitutes a non-remediable regulatory violation.`,
    citations: ["CERT-In Direction No. 20(3)/2022-CERT-In", "RBI CSITE Advisory 2023", "SEBI Master Circular 2024"],
  },
];

export function generateComplianceAiResponse(query: string, currentPath?: string): {
  title: string;
  response: string;
  citations: string[];
  relatedAction?: { label: string; href: string };
} {
  const q = query.toLowerCase().trim();

  // Check matching knowledge base answer
  const matched = KNOWLEDGE_BASE_ANSWERS.find((item) =>
    item.keywords.some((kw) => q.includes(kw))
  );

  if (matched) {
    return matched;
  }

  // Contextual fallback based on path if no keyword matched
  if (currentPath?.includes("regulations") || currentPath?.includes("obligations")) {
    return {
      title: "Regulatory Analysis & Guidance",
      response: `Based on your query **"${query}"** in the context of active Regulations & Obligations:

- **Applicable Framework:** Compliant with current RBI Master Directions and SEBI circular baselines.
- **Traceability Chain:** Every regulatory directive indexed in ComplianceOS automatically cascades into unified controls and assessment questions.
- **Next Steps:** You can view extracted obligations on any circular detail page, adjust control linkages, or upload updated directives directly from the library.`,
      citations: ["RBI Master Direction 2023", "SEBI Cyber Framework 2024", "ComplianceOS Regulatory Index"],
      relatedAction: {
        label: "View Regulations & Obligations",
        href: "/regulations",
      },
    };
  }

  if (currentPath?.includes("gaps") || currentPath?.includes("remediation")) {
    return {
      title: "Compliance Gaps & Remediation Guidance",
      response: `Regarding **"${query}"** for your active compliance gaps:

- **Gap Resolution Priority:** Critical gaps must be addressed first as they block audit signoff.
- **Remediation Plan:** You can generate an automated remediation roadmap with assigned owners and timelines.
- **Audit Verification:** Ensure all evidence artifacts are attached prior to marking a gap as *Resolved*.`,
      citations: ["ComplianceOS Remediation Engine", "Internal Risk Management Framework"],
      relatedAction: {
        label: "Open Gap Tracker",
        href: "/gaps",
      },
    };
  }

  // General authoritative compliance response
  return {
    title: "ComplianceOS Intelligence",
    response: `Here is the regulatory guidance regarding **"${query}"**:

1. **Governance & Accountability:** Ensure compliance policies are approved by executive management and reflected in active controls.
2. **Continuous Monitoring:** Statutory standards require automated checks and periodic re-indexing when new circulars are published.
3. **Audit Readiness:** Maintain verifiable logs and cross-mapped evidence across all operational units.

Feel free to ask about specific circular numbers, control implementations, or gap remediation workflows!`,
    citations: ["Unified Compliance Framework", "RBI / SEBI Standards Index", "ISO 27001:2022"],
    relatedAction: {
      label: "Go to Dashboard",
      href: "/dashboard",
    },
  };
}

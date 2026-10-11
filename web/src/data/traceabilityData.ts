export interface TraceabilityNode {
  id: string;
  regulation: {
    id: string;
    title: string;
    regulator: "RBI" | "SEBI" | "CERT-In" | "DPDP";
    reference: string;
    date: string;
    sourceSection: string;
    sourceQuote: string;
  };
  obligation: {
    id: string;
    type: "REPORTING" | "CONTROL" | "GOVERNANCE" | "OPERATIONAL" | "AUDIT";
    text: string;
    deadline?: string;
    penalty?: string;
    confidence: number;
  };
  applicability: {
    entities: string[];
    criteria: string;
    status: "APPLICABLE" | "EXEMPT" | "CONDITIONAL";
  };
  control: {
    id: string;
    name: string;
    framework: string;
    owner: string;
    implementationStatus: "IMPLEMENTED" | "PARTIAL" | "NOT_IMPLEMENTED";
  };
  evidence: {
    id: string;
    name: string;
    documentType: string;
    status: "VERIFIED" | "PENDING" | "EXPIRED" | "MISSING";
    lastAuditDate: string;
    fileUrl?: string;
  };
  testing: {
    id: string;
    testType: "AUTOMATED_API" | "MANUAL_INSPECTION" | "EXTERNAL_AUDIT" | "VAPT";
    frequency: string;
    lastTested: string;
    result: "PASSED" | "FAILED" | "DEFICIENT";
  };
  gap: {
    id?: string;
    title?: string;
    riskLevel?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "RISK_ACCEPTED";
    openedDaysAgo?: number;
  };
  remediation: {
    workOrderId?: string;
    leadTeam?: string;
    slaDays?: number;
    actionSummary?: string;
    status?: "PENDING_APPROVAL" | "EXECUTING" | "VERIFIED" | "NONE";
  };
  monitoring: {
    kpi: string;
    currentValue: string;
    threshold: string;
    health: "HEALTHY" | "WARNING" | "BREACHED";
    telemetrySource: string;
  };
}

export const TRACEABILITY_DATA: TraceabilityNode[] = [
  {
    id: "TRACE-01",
    regulation: {
      id: "REG-RBI-CYBER-01",
      title: "Master Direction on Information Technology Governance, Risk, Controls and Assurance",
      regulator: "RBI",
      reference: "RBI/2023-24/108 DoS.CO.CSITE.SEC.No.1852/31.01.015/2023-24",
      date: "Nov 07, 2023",
      sourceSection: "Section 18.2 (Incident Management)",
      sourceQuote: "Regulated Entities shall report all unusual cybersecurity incidents involving financial loss or customer data breach to CSITE within 2 hours of detection.",
    },
    obligation: {
      id: "OBL-RBI-INC-01",
      type: "REPORTING",
      text: "Report cybersecurity incidents involving financial loss or customer data breach to RBI CSITE within 2 hours of detection.",
      deadline: "Within 2 hours of detection",
      penalty: "Section 47A Banking Regulation Act monetary penalty & supervisory censure",
      confidence: 0.98,
    },
    applicability: {
      entities: ["Scheduled Commercial Banks", "Payment Banks", "Tier-3/4 UCBs"],
      criteria: "All digital channels, core banking systems, and payment switches",
      status: "APPLICABLE",
    },
    control: {
      id: "CTRL-SEC-INC-02",
      name: "Automated SIEM-to-CSITE Flash Notification Workflow",
      framework: "RBI IT Governance 2023 & ISO 27001 A.16.1",
      owner: "CISO / SOC Incident Lead",
      implementationStatus: "PARTIAL",
    },
    evidence: {
      id: "EVID-SOC-INC-2024-Q3",
      name: "SOC Flash Alert Escalation Runbook v2.4",
      documentType: "Standard Operating Procedure",
      status: "VERIFIED",
      lastAuditDate: "Aug 14, 2024",
    },
    testing: {
      id: "TEST-INC-SIM-04",
      testType: "AUTOMATED_API",
      frequency: "Monthly Drills",
      lastTested: "Sep 10, 2024",
      result: "DEFICIENT",
    },
    gap: {
      id: "GAP-1002",
      title: "Flash notification automated dispatch took 3.2 hours during payment switch failover drill (exceeded 2-hour RBI SLA)",
      riskLevel: "CRITICAL",
      status: "OPEN",
      openedDaysAgo: 14,
    },
    remediation: {
      workOrderId: "REM-WO-8821",
      leadTeam: "SOC Tier-2 Engineering",
      slaDays: 7,
      actionSummary: "Deploy pre-authorized webhook integration from Splunk/Wazuh directly to RBI CSITE encrypted API endpoint to bypass manual phone call authorization.",
      status: "EXECUTING",
    },
    monitoring: {
      kpi: "Mean Time to Regulatory Flash Notification (MTTR-N)",
      currentValue: "112 mins",
      threshold: "< 120 mins",
      health: "WARNING",
      telemetrySource: "Splunk Enterprise Security Webhook Logs",
    },
  },
  {
    id: "TRACE-02",
    regulation: {
      id: "REG-CERTIN-INC-01",
      title: "Directions on Information Security Practices, Procedure, Prevention, Response and Reporting",
      regulator: "CERT-In",
      reference: "No. 20(3)/2022-CERT-In",
      date: "Apr 28, 2022",
      sourceSection: "Annexure I, Rule 5",
      sourceQuote: "Any service provider, intermediary, data centre, body corporate and Government organisation shall report cyber incidents within 6 hours of noticing them to CERT-In.",
    },
    obligation: {
      id: "OBL-CERTIN-INC-01",
      type: "REPORTING",
      text: "Report specified cyber incidents (20 types including ransomware, DDoS, identity theft) to CERT-In within 6 hours of noticing.",
      deadline: "Within 6 hours of noticing",
      penalty: "IT Act Section 70B(7) up to 1 year imprisonment or INR 1 Lakh fine",
      confidence: 0.99,
    },
    applicability: {
      entities: ["All BFSI intermediaries", "Cloud Service Providers", "Payment Gateways"],
      criteria: "All corporate IT, customer-facing portals, and third-party SaaS",
      status: "APPLICABLE",
    },
    control: {
      id: "CTRL-CERTIN-DISP-01",
      name: "CERT-In Mandatory Incident Dispatcher & Log Synchronizer",
      framework: "CERT-In 2022 Security Directives",
      owner: "SecOps / Governance Officer",
      implementationStatus: "IMPLEMENTED",
    },
    evidence: {
      id: "EVID-CERTIN-ACK-2024",
      name: "Annual CERT-In Empanelled Auditor Security Certification",
      documentType: "External Auditor Assurance Report",
      status: "VERIFIED",
      lastAuditDate: "Jul 22, 2024",
    },
    testing: {
      id: "TEST-CERTIN-DRILL",
      testType: "EXTERNAL_AUDIT",
      frequency: "Half-Yearly",
      lastTested: "Jul 18, 2024",
      result: "PASSED",
    },
    gap: {
      id: undefined,
      title: undefined,
      riskLevel: undefined,
      status: "RESOLVED",
      openedDaysAgo: 0,
    },
    remediation: {
      workOrderId: undefined,
      leadTeam: "SecOps",
      slaDays: 0,
      actionSummary: "Incident dispatcher operational; real-time dual-logging enabled.",
      status: "NONE",
    },
    monitoring: {
      kpi: "CERT-In Notification Dispatch Compliance Rate",
      currentValue: "100%",
      threshold: "100%",
      health: "HEALTHY",
      telemetrySource: "CERT-In Portal API Receipt Confirmations",
    },
  },
  {
    id: "TRACE-03",
    regulation: {
      id: "REG-SEBI-CSCRF-01",
      title: "Cybersecurity and Cyber Resilience Framework (CSCRF) for Qualified Entities",
      regulator: "SEBI",
      reference: "SEBI/HO/MIRSD/2024/72",
      date: "Jun 27, 2024",
      sourceSection: "Part II, Section 4 (Vulnerability Assessment & Penetration Testing)",
      sourceQuote: "Entities shall conduct comprehensive VAPT at least once every half-year and for critical trading infrastructure quarterly through CERT-In empanelled auditors.",
    },
    obligation: {
      id: "OBL-SEBI-VAPT-01",
      type: "AUDIT",
      text: "Conduct quarterly external VAPT on core trading, depository, and market gateway systems using CERT-In empanelled testing organizations.",
      deadline: "Within 30 days of quarter end",
      penalty: "Depository participant license suspension / SEBI Adjudication Proceedings",
      confidence: 0.96,
    },
    applicability: {
      entities: ["Stock Brokers", "Mutual Funds", "Qualified Depository Participants"],
      criteria: "Brokers with > 50,000 active retail accounts or direct market access",
      status: "APPLICABLE",
    },
    control: {
      id: "CTRL-VAPT-EXT-03",
      name: "Quarterly Independent External VAPT & Remediation Pipeline",
      framework: "SEBI CSCRF 2024 Part II & CIS Controls v8",
      owner: "Application Security Lead",
      implementationStatus: "PARTIAL",
    },
    evidence: {
      id: "EVID-VAPT-REPORT-Q2",
      name: "Q2 2024 Core Trading Engine Penetration Test Report",
      documentType: "Third-Party Audit Assessment",
      status: "EXPIRED",
      lastAuditDate: "May 10, 2024",
    },
    testing: {
      id: "TEST-VAPT-EXEC-02",
      testType: "VAPT",
      frequency: "Quarterly",
      lastTested: "May 08, 2024",
      result: "DEFICIENT",
    },
    gap: {
      id: "GAP-1004",
      title: "Q3 2024 External VAPT report is 22 days overdue for Market Data Feeder Gateway",
      riskLevel: "CRITICAL",
      status: "OPEN",
      openedDaysAgo: 22,
    },
    remediation: {
      workOrderId: "REM-WO-8822",
      leadTeam: "AppSec & External Vendor (Paladion / EY)",
      slaDays: 5,
      actionSummary: "Execute out-of-cycle comprehensive penetration test on Market Data Feeder Gateway and submit signed remediation certificate to SEBI Portal.",
      status: "EXECUTING",
    },
    monitoring: {
      kpi: "VAPT Cycle Days Elapsed",
      currentValue: "112 days",
      threshold: "< 90 days",
      health: "BREACHED",
      telemetrySource: "Jira Security Task Tracker & Audit Calendar",
    },
  },
  {
    id: "TRACE-04",
    regulation: {
      id: "REG-DPDP-2023-01",
      title: "Digital Personal Data Protection Act, 2023",
      regulator: "DPDP",
      reference: "Act No. 22 of 2023, Ministry of Law and Justice",
      date: "Aug 11, 2023",
      sourceSection: "Section 8(7) (Data Erasure and Retention)",
      sourceQuote: "A Data Fiduciary shall erase personal data upon withdrawal of consent or as soon as it is reasonable to assume that the specified purpose is no longer being served.",
    },
    obligation: {
      id: "OBL-DPDP-ERASE-01",
      type: "CONTROL",
      text: "Implement automated data erasure workflows upon customer consent revocation unless retention is mandated by law.",
      deadline: "Immediate upon consent revocation",
      penalty: "Data Protection Board penalty up to INR 250 Crore for significant breaches",
      confidence: 0.94,
    },
    applicability: {
      entities: ["All Data Fiduciaries", "Banks processing customer KYC and credit histories"],
      criteria: "All Indian citizen personal identifiers and financial records",
      status: "APPLICABLE",
    },
    control: {
      id: "CTRL-PRIV-ERASURE-01",
      name: "Automated Data Lifecycle & Consent-Based Erasure Engine",
      framework: "DPDP Act 2023 & ISO 27701 Privacy Information Management",
      owner: "Data Protection Officer (DPO)",
      implementationStatus: "NOT_IMPLEMENTED",
    },
    evidence: {
      id: "EVID-DPDP-POLICY-2024",
      name: "Enterprise Data Retention & Erasure Policy Draft",
      documentType: "Corporate Policy Document",
      status: "PENDING",
      lastAuditDate: "Jun 30, 2024",
    },
    testing: {
      id: "TEST-ERASURE-DRYRUN",
      testType: "MANUAL_INSPECTION",
      frequency: "Bi-Annual",
      lastTested: "Aug 02, 2024",
      result: "FAILED",
    },
    gap: {
      id: "GAP-1008",
      title: "Conflict between DPDP Section 8 (Data Erasure) and PMLA Rule 3 (Mandatory 5-Year Financial Record Retention) unresolved in Core Banking Database",
      riskLevel: "HIGH",
      status: "OPEN",
      openedDaysAgo: 38,
    },
    remediation: {
      workOrderId: "REM-WO-8823",
      leadTeam: "Legal & Data Architecture Team",
      slaDays: 14,
      actionSummary: "Implement Cryptographic Pseudonymization Layer: erase direct customer identifiers while archiving hashed transaction ledgers for PMLA 5-year compliance.",
      status: "PENDING_APPROVAL",
    },
    monitoring: {
      kpi: "Consent Revocation Processing Latency",
      currentValue: "7 days (Manual)",
      threshold: "< 24 hours",
      health: "WARNING",
      telemetrySource: "Customer Consent Management Portal API",
    },
  },
  {
    id: "TRACE-05",
    regulation: {
      id: "REG-RBI-DIGITAL-PAY-01",
      title: "Master Direction on Digital Payment Security Controls",
      regulator: "RBI",
      reference: "RBI/2020-21/74 DoS.CO.CSITE.SEC.No.1852/31.01.015/2020-21",
      date: "Feb 18, 2021",
      sourceSection: "Section 14 (Source Code Review & Application Security)",
      sourceQuote: "Banks shall mandate static and dynamic application security testing (SAST and DAST) for all internet and mobile banking applications prior to major release and after critical changes.",
    },
    obligation: {
      id: "OBL-RBI-APPSEC-01",
      type: "CONTROL",
      text: "Enforce automated SAST and DAST gates in CI/CD release pipelines for all customer-facing mobile and internet banking apps.",
      deadline: "Continuous in CI/CD pipeline",
      penalty: "Restricted release approval & regulatory audit qualification",
      confidence: 0.97,
    },
    applicability: {
      entities: ["Commercial Banks", "Authorized Payment System Operators"],
      criteria: "Mobile banking applications, UPI SDKs, web payment interfaces",
      status: "APPLICABLE",
    },
    control: {
      id: "CTRL-DEVSECOPS-SAST-01",
      name: "CI/CD Automated Security Quality Gate (SonarQube + Snyk)",
      framework: "RBI Digital Payment Security & OWASP ASVS Level 3",
      owner: "DevSecOps Lead",
      implementationStatus: "IMPLEMENTED",
    },
    evidence: {
      id: "EVID-CI-SCAN-2024-SEP",
      name: "Production Release 4.12 CI/CD Pipeline Scan Artifacts",
      documentType: "Automated Build Log & Security Audit Report",
      status: "VERIFIED",
      lastAuditDate: "Sep 15, 2024",
    },
    testing: {
      id: "TEST-AUTO-SAST-DAILY",
      testType: "AUTOMATED_API",
      frequency: "Per Build / Daily",
      lastTested: "Sep 23, 2024",
      result: "PASSED",
    },
    gap: {
      id: undefined,
      title: undefined,
      riskLevel: undefined,
      status: "RESOLVED",
      openedDaysAgo: 0,
    },
    remediation: {
      workOrderId: undefined,
      leadTeam: "DevSecOps",
      slaDays: 0,
      actionSummary: "Control automated and enforced at pull-request merge gate.",
      status: "NONE",
    },
    monitoring: {
      kpi: "Critical Vulnerabilities in Release Candidate",
      currentValue: "0",
      threshold: "0",
      health: "HEALTHY",
      telemetrySource: "GitLab Security Dashboard API",
    },
  },
];

// --- Contradictions & Cross-Regulation Intelligence Dataset ---
export interface RegulatoryContradiction {
  id: string;
  domain: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  title: string;
  description: string;
  regulatorsInConflict: {
    regulator: "RBI" | "SEBI" | "CERT-In" | "DPDP";
    circularTitle: string;
    clause: string;
    requirement: string;
    timelineOrCondition: string;
  }[];
  conflictNature: "TIMELINE_CLASH" | "RETENTION_MISMATCH" | "DATA_PRIVACY_VS_AUDIT" | "REPORTING_THRESHOLD";
  harmonizedRecommendation: {
    strictestCommonDenominator: string;
    operationalRule: string;
    automatedControlId: string;
    auditDefenseRationale: string;
  };
}

export const REGULATORY_CONTRADICTIONS: RegulatoryContradiction[] = [
  {
    id: "CONTRA-01",
    domain: "Incident Response & Notification Timelines",
    severity: "CRITICAL",
    title: "Tripartite Conflict in Cyber Incident Notification Timelines",
    description: "CERT-In mandates notification within 6 hours of noticing, RBI mandates notification within 2 hours of detection for financial/payment impact, and SEBI CSCRF Part II mandates preliminary report within 15 minutes of critical operational disruption.",
    conflictNature: "TIMELINE_CLASH",
    regulatorsInConflict: [
      {
        regulator: "SEBI",
        circularTitle: "CSCRF Guidelines 2024 Part II",
        clause: "Clause 3.1.2",
        requirement: "Preliminary communication of critical trading outages or ransomware attacks",
        timelineOrCondition: "Within 15 minutes",
      },
      {
        regulator: "RBI",
        circularTitle: "Master Direction on IT Governance 2023",
        clause: "Section 18.2",
        requirement: "Flash report to CSITE for financial loss / data breach incidents",
        timelineOrCondition: "Within 2 hours",
      },
      {
        regulator: "CERT-In",
        circularTitle: "Cybersecurity Directions No. 20(3)/2022",
        clause: "Annexure I, Rule 5",
        requirement: "Mandatory incident report for 20 specified categories",
        timelineOrCondition: "Within 6 hours",
      },
    ],
    harmonizedRecommendation: {
      strictestCommonDenominator: "T+15m Preliminary Alert to SEBI / CISO -> T+120m Enriched Flash to RBI CSITE -> T+360m Full Annexure-1 to CERT-In",
      operationalRule: "Configure SOC automated incident triage to auto-dispatch parallel tiered webhooks: broadcast preliminary severity-1 heartbeat at 15m, payload flash at 2h, and forensics dossier at 6h.",
      automatedControlId: "CTRL-HARMONIZED-INC-TRIAGE",
      auditDefenseRationale: "Adheres to the strictest single timeline (15m) while satisfying the specific regulatory formats of RBI and CERT-In without triggering contradictory breaches.",
    },
  },
  {
    id: "CONTRA-02",
    domain: "Log & Financial Data Retention",
    severity: "HIGH",
    title: "Log Retention Period Mismatch (180 Days vs 5 Years vs 8 Years)",
    description: "CERT-In mandates ICT system logs must be maintained within the Indian jurisdiction for 180 days. SEBI regulations mandate market transaction logs for 5 years. PMLA & RBI Master Direction mandate customer financial audit trails for 8 years.",
    conflictNature: "RETENTION_MISMATCH",
    regulatorsInConflict: [
      {
        regulator: "CERT-In",
        circularTitle: "Cybersecurity Directions 2022",
        clause: "Clause 2(v)",
        requirement: "Maintain system logs securely within Indian jurisdiction",
        timelineOrCondition: "180 rolling days",
      },
      {
        regulator: "SEBI",
        circularTitle: "Stock Broker Master Circular 2024",
        clause: "Section 4.3",
        requirement: "Maintain algorithmic order logs and terminal IP records",
        timelineOrCondition: "5 years",
      },
      {
        regulator: "RBI",
        circularTitle: "Master Direction - KYC Direction 2016 (Updated 2023)",
        clause: "Section 46",
        requirement: "Preserve records of transactions and identification data",
        timelineOrCondition: "8 years from date of transaction",
      },
    ],
    harmonizedRecommendation: {
      strictestCommonDenominator: "8-Year Tiered Retention Policy with Cold Storage Tiering within Indian Jurisdiction",
      operationalRule: "Store hot logs in SIEM for 180 days (satisfying CERT-In rapid query), migrate to encrypted warm S3 bucket (Mumbai region) for years 1-5 (SEBI), and freeze in Glacier for years 6-8 (RBI).",
      automatedControlId: "CTRL-HARMONIZED-LOG-TIER",
      auditDefenseRationale: "Meets the maximum statutory threshold of 8 years while maintaining Indian residency required by CERT-In and cost-optimizing cold storage.",
    },
  },
  {
    id: "CONTRA-03",
    domain: "Data Minimization vs Regulatory Audit Ledger",
    severity: "HIGH",
    title: "Right to Erasure (DPDP) vs Statutory Record Keeping (RBI/PMLA)",
    description: "DPDP Act 2023 Section 8(7) requires erasing personal data when consent is withdrawn. Conversely, RBI Master Directions and PMLA prohibit deleting transaction histories of dormant accounts.",
    conflictNature: "DATA_PRIVACY_VS_AUDIT",
    regulatorsInConflict: [
      {
        regulator: "DPDP",
        circularTitle: "DPDP Act 2023",
        clause: "Section 8(7)",
        requirement: "Erase personal data upon consent revocation or purpose completion",
        timelineOrCondition: "Upon customer request",
      },
      {
        regulator: "RBI",
        circularTitle: "PMLA / Banking Regulation Act Section 45Z",
        clause: "Section 45Z",
        requirement: "Maintain banking books and accounts despite account closure",
        timelineOrCondition: "Minimum 5-8 years mandatory",
      },
    ],
    harmonizedRecommendation: {
      strictestCommonDenominator: "Cryptographic Anonymization & Purpose-Locked Escrow",
      operationalRule: "Upon DPDP erasure request, decouple PII using irreversible HMAC-SHA256 tokens in active CRM, while moving identity-to-ledger mapping key to air-gapped legal escrow accessible solely under court order.",
      automatedControlId: "CTRL-HARMONIZED-PSEUDONYMIZATION",
      auditDefenseRationale: "Complies with DPDP privacy spirit by eliminating active identification while preserving legal defensibility under Section 17 exemptions of DPDP for compliance with statutory laws.",
    },
  },
];

// --- What-If Simulation Scenarios Dataset ---
export interface SimulationScenario {
  id: string;
  name: string;
  category: "REGULATORY_AMENDMENT" | "GEOPOLITICAL_SANCTION" | "INFRASTRUCTURE_FAILURE" | "MERGER_ACQUISITION";
  targetRegulator: string;
  hypothesisText: string;
  initialState: {
    criticalGaps: number;
    highGaps: number;
    complianceScore: number;
  };
  simulatedState: {
    criticalGaps: number;
    highGaps: number;
    complianceScore: number;
    blastRadiusScore: number;
    newlyBreachedControls: {
      id: string;
      name: string;
      reason: string;
      remediationCostEst: string;
      remediationDays: number;
    }[];
    unaffectedControlsCount: number;
    suggestedPlaybook: string;
  };
}

export const PRESET_SIMULATION_SCENARIOS: SimulationScenario[] = [
  {
    id: "SIM-01",
    name: "RBI Cyber Resilience 2025: Mandatory 1-Hour Breach Disclosure SLA",
    category: "REGULATORY_AMENDMENT",
    targetRegulator: "Master Direction on Information Technology Governance, Risk, Controls and Assurance Practices",
    hypothesisText: "RBI reduces the mandatory cybersecurity incident reporting SLA from 2 hours to 60 minutes for all Tier-1 and Tier-2 financial infrastructure, mandating automated forensic telemetry dispatch.",
    initialState: {
      criticalGaps: 2,
      highGaps: 5,
      complianceScore: 84,
    },
    simulatedState: {
      criticalGaps: 6,
      highGaps: 9,
      complianceScore: 61,
      blastRadiusScore: 78,
      newlyBreachedControls: [
        {
          id: "CTRL-SEC-INC-02",
          name: "Automated SIEM-to-CSITE Flash Notification Workflow",
          reason: "Current average SOC validation latency is 84 minutes; cannot meet the revised 60-minute threshold without autonomous AI dispatch.",
          remediationCostEst: "₹18,00,000",
          remediationDays: 14,
        },
        {
          id: "CTRL-SOC-TIER1-TRIAGE",
          name: "Tier-1 Human SOC Analyst Escalation Matrix",
          reason: "Human phone verification step exceeds 30 minutes during off-peak hours.",
          remediationCostEst: "₹8,50,000",
          remediationDays: 10,
        },
        {
          id: "CTRL-PAYMENT-SWITCH-TELEMETRY",
          name: "UPI / IMPS Core Switch Outage Telemetry",
          reason: "Batch health export runs on 90-minute intervals; lacks streaming push notifications.",
          remediationCostEst: "₹24,00,000",
          remediationDays: 21,
        },
        {
          id: "CTRL-THIRD-PARTY-VENDOR-SLA",
          name: "Core Banking Cloud Vendor Incident Reporting SLA",
          reason: "AWS/Azure vendor contract specifies 4-hour breach notice, violating bank's 1-hour requirement.",
          remediationCostEst: "Legal renegotiation",
          remediationDays: 45,
        },
      ],
      unaffectedControlsCount: 42,
      suggestedPlaybook: "Playbook #8: Deploy Agentic Real-Time Flash Dispatcher with zero-touch webhook trigger directly to RBI CSITE API.",
    },
  },
  {
    id: "SIM-02",
    name: "SEBI CSCRF: Mandatory Monthly External VAPT on All Trading Cloud Endpoints",
    category: "REGULATORY_AMENDMENT",
    targetRegulator: "Cybersecurity and Cyber Resilience Framework (CSCRF) for Qualified Stock Brokers (QSBs)",
    hypothesisText: "SEBI amends CSCRF Part II to mandate monthly (instead of quarterly) external VAPT testing for all cloud endpoints interacting with algorithmic trading gateways.",
    initialState: {
      criticalGaps: 2,
      highGaps: 5,
      complianceScore: 84,
    },
    simulatedState: {
      criticalGaps: 5,
      highGaps: 8,
      complianceScore: 68,
      blastRadiusScore: 64,
      newlyBreachedControls: [
        {
          id: "CTRL-VAPT-EXT-03",
          name: "Quarterly Independent External VAPT Pipeline",
          reason: "Vendor engagement schedule and contract terms are structured for quarterly cycles; monthly turnaround creates perpetual audit deficit.",
          remediationCostEst: "₹35,00,000 / yr",
          remediationDays: 30,
        },
        {
          id: "CTRL-PATCH-REMEDIATION-SLA",
          name: "Critical Vulnerability Remediation Window (CVSS >= 9.0)",
          reason: "Average remediation turnaround of 21 days exceeds the new 7-day monthly audit cycle.",
          remediationCostEst: "₹12,00,000",
          remediationDays: 18,
        },
        {
          id: "CTRL-CERTIN-AUDITOR-EMPANELMENT",
          name: "Dedicated CERT-In Vendor Availability Contract",
          reason: "Lead time to schedule external empanelled testers is currently 3 weeks.",
          remediationCostEst: "₹15,00,000",
          remediationDays: 25,
        },
      ],
      unaffectedControlsCount: 45,
      suggestedPlaybook: "Playbook #14: Hybrid Continuous Automated Penetration Testing (D-VAPT) tool integrated into CI/CD with quarterly human signoff.",
    },
  },
  {
    id: "SIM-03",
    name: "DPDP Act Enacted: Strict Prohibition of Cross-Border Financial Cloud Backups",
    category: "REGULATORY_AMENDMENT",
    targetRegulator: "Master Circular for Mutual Funds",
    hypothesisText: "Central Government issues Section 16 negative list notification prohibiting transfer or processing of Indian citizen banking and credit data outside India, invalidating disaster recovery replication to Singapore/Frankfurt.",
    initialState: {
      criticalGaps: 2,
      highGaps: 5,
      complianceScore: 84,
    },
    simulatedState: {
      criticalGaps: 7,
      highGaps: 11,
      complianceScore: 54,
      blastRadiusScore: 89,
      newlyBreachedControls: [
        {
          id: "CTRL-CLOUD-DR-REPLICATION",
          name: "Secondary Disaster Recovery Site in AWS ap-southeast-1 (Singapore)",
          reason: "Cross-border database replication violates direct negative-list transfer prohibition.",
          remediationCostEst: "₹45,00,000",
          remediationDays: 60,
        },
        {
          id: "CTRL-SAAS-VENDOR-RESIDENCY",
          name: "Salesforce / ServiceNow Customer Support Cloud Residency",
          reason: "Support tickets containing customer loan documents stored in multi-tenant US/EU datacenters.",
          remediationCostEst: "₹28,00,000",
          remediationDays: 45,
        },
        {
          id: "CTRL-CREDIT-SCORING-API",
          name: "Third-Party ML Risk Scoring API (US Endpoint)",
          reason: "Credit model queries send plain Aadhaar and transaction tokens across international boundaries.",
          remediationCostEst: "₹16,00,000",
          remediationDays: 20,
        },
      ],
      unaffectedControlsCount: 38,
      suggestedPlaybook: "Playbook #21: Immediate activation of AWS Hyderabad (ap-south-2) or CtrlS / Yotta sovereign banking cloud fallback.",
    },
  },
];

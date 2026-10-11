import type { AiRecommendation, ExistingControl, AssessmentQuestion } from "@/data/circularControlsAndQuestions";

/**
 * Master Direction on Information Technology Governance, Risk, Controls and Assurance Practices (linkRef 12562).
 * Released Nov 07, 2023. Effective April 01, 2024.
 */

export const RBI_IT_GOV_12562_RECOMMENDATIONS: AiRecommendation[] = [
  // IT Governance
  {
    id: "ITG-REC-01",
    title: "IT Governance Framework",
    description: "Design and implement a Board-approved IT Governance Framework that clearly articulates roles, authority and accountability for IT strategy, risk and performance management (Clauses 4–5).",
    relevance: "High",
    category: "Governance",
  },
  {
    id: "ITG-REC-02",
    title: "IT Strategy Committee of the Board",
    description: "Constitute a Board-level ITSC, chaired by an Independent Director with demonstrable IT expertise, with a defined mandate and minimum quarterly meeting cadence (Clause 6).",
    relevance: "High",
    category: "Governance",
  },
  {
    id: "ITG-REC-03",
    title: "IT Steering Committee",
    description: "Establish a senior management IT Steering Committee with clear terms of reference to execute Board-approved IT strategy, oversee major initiatives and monitor IT operations (Clause 7).",
    relevance: "High",
    category: "Governance",
  },
  {
    id: "ITG-REC-04",
    title: "Head of IT Function Appointment",
    description: "Appoint a Head of IT function with appropriate seniority and experience, with formally defined responsibilities for IT delivery, risk, and BCP/DR implementation (Clause 8).",
    relevance: "High",
    category: "Governance",
  },
  {
    id: "ITG-REC-05",
    title: "IT Performance and Maturity Metrics",
    description: "Define, track and periodically report structured metrics for IT performance and IT maturity, beyond BCDR, to support informed Board and senior management oversight (Clause 21c).",
    relevance: "Medium",
    category: "Governance",
  },

  // IT Infrastructure & Services Management
  {
    id: "ITG-REC-06",
    title: "IT Service Management (ITSM)",
    description: "Implement formal ITSM processes to drive consistent service quality, capacity planning and SLA adherence across critical IT services (Clause 9).",
    relevance: "Medium",
    category: "Operations",
  },
  {
    id: "ITG-REC-07",
    title: "IT Asset Management",
    description: "Maintain an end‑to‑end IT asset inventory with unique identifiers, ownership and classification to support lifecycle management and control effectiveness (Clause 11).",
    relevance: "High",
    category: "Infrastructure",
  },
  {
    id: "ITG-REC-08",
    title: "Vendor & Product Assurance",
    description: "Institutionalise vendor assurance procedures, including written certifications and product assurance that applications are free from known vulnerabilities, malware and covert channels (Clause 12f–h).",
    relevance: "High",
    category: "Compliance",
  },
  {
    id: "ITG-REC-09",
    title: "Source Code Escrow",
    description: "Implement source code escrow arrangements, including updates and fixes, for critical third‑party software to safeguard continuity and timely defect resolution (Clause 12f).",
    relevance: "Medium",
    category: "Compliance",
  },
  {
    id: "ITG-REC-10",
    title: "Straight Through Processing (STP)",
    description: "Enable Straight Through Processing for critical business processes and minimise manual intervention in critical data flows through automated, logged and authenticated interfaces (Clause 17).",
    relevance: "High",
    category: "Operations",
  },
  {
    id: "ITG-REC-11",
    title: "Maker-Checker for Critical Systems",
    description: "Apply maker–checker controls and appropriate segregation of duties for critical system parameters, financial transactions and high‑risk IT operations (Clauses 15, 18–19).",
    relevance: "High",
    category: "Operations",
  },
  {
    id: "ITG-REC-12",
    title: "Teleworking Controls",
    description: "Deploy robust security controls, including multi‑factor authentication and endpoint protection, for teleworking and remote access to critical systems and data (Clause 20).",
    relevance: "High",
    category: "Security",
  },

  // IT and Information Security Risk Management
  {
    id: "ITG-REC-13",
    title: "Information Security Policy",
    description: "Maintain a comprehensive, Board‑approved Information Security Policy that defines confidentiality, integrity, availability and authenticity requirements for information assets (Clause 23).",
    relevance: "High",
    category: "Security",
  },
  {
    id: "ITG-REC-14",
    title: "Cyber Security Policy",
    description: "Formulate and implement a dedicated Cyber Security Policy that addresses threat management, resilience, and governance of cyber security initiatives (Clause 23).",
    relevance: "High",
    category: "Security",
  },
  {
    id: "ITG-REC-15",
    title: "CISO Appointment & Independence",
    description: "Designate a senior executive as CISO with an adequately staffed function, independent reporting lines and no conflict of interest with IT operations (Clause 24).",
    relevance: "High",
    category: "Governance",
  },
  {
    id: "ITG-REC-16",
    title: "Vulnerability Management & Pen-Testing",
    description: "Establish a structured VA/PT programme for critical and internet‑facing systems, with formal remediation tracking and reporting to senior management (Clause 26).",
    relevance: "High",
    category: "Security",
  },
  {
    id: "ITG-REC-17",
    title: "Cyber Incident Response & Reporting",
    description: "Operationalise a cyber incident response and regulatory reporting framework, including timely notification to RBI/NHB and CERT‑In and post‑incident lessons‑learnt (Clause 27).",
    relevance: "High",
    category: "Compliance",
  },

  // BCDR
  {
    id: "ITG-REC-18",
    title: "BCDR Policy & Resilience",
    description: "Maintain a Board‑approved BCDR Policy that defines RTO/RPO targets for critical functions, and establishes reconciliation processes where non‑zero RPO is accepted (Clause 28).",
    relevance: "High",
    category: "Resilience",
  },
  {
    id: "ITG-REC-19",
    title: "DR Drills & Periodicity",
    description: "Conduct DR drills at least half‑yearly for critical systems, ensure DR architecture equivalence with the primary site and formally report outcomes and gaps (Clause 29).",
    relevance: "High",
    category: "Resilience",
  },

  // IS Audit
  {
    id: "ITG-REC-20",
    title: "IS Audit Framework",
    description: "Implement an independent IS audit framework, aligned to recognised professional standards, with clear scope, periodicity and escalation to the Audit Committee (Clause 30).",
    relevance: "High",
    category: "Assurance",
  },
];

export const RBI_IT_GOV_12562_CONTROLS: ExistingControl[] = [
  {
    id: "CTRL-ITG-ITSC",
    name: "ITSC Constitution, Periodic Meetings and Minutes",
    framework: "RBI ITG 2023",
    status: "mapped",
  },
  {
    id: "CTRL-ITG-CISO",
    name: "CISO Office Staffing and Direct Reporting to ED/CRO",
    framework: "RBI ITG 2023",
    status: "mapped",
  },
  {
    id: "CTRL-ITG-VAPT",
    name: "Vulnerability Assessment and Penetration Testing Programme",
    framework: "RBI ITG 2023",
    status: "mapped",
  },
  {
    id: "CTRL-ITG-INC",
    name: "Cyber Incident Response and Mandatory Reporting to RBI/CERT-In",
    framework: "RBI ITG 2023",
    status: "mapped",
  },
  {
    id: "CTRL-ITG-REM",
    name: "Teleworking Security and Multi-Factor Authentication (MFA)",
    framework: "RBI ITG 2023",
    status: "mapped",
  },
  {
    id: "CTRL-ITG-DR",
    name: "DR Drills Execution, RTO/RPO Targets and Reconciliation Procedures",
    framework: "RBI ITG 2023",
    status: "mapped",
  },
  {
    id: "CTRL-ITG-STP",
    name: "Straight Through Processing (STP) Controls and Manual Intervention Monitoring",
    framework: "RBI ITG 2023",
    status: "mapped",
  },
  {
    id: "CTRL-ITG-VNR",
    name: "Vendor Risk and Supply Chain Assurance Framework",
    framework: "RBI ITG 2023",
    status: "mapped",
  },
  {
    id: "CTRL-ITG-ASSET",
    name: "IT Asset Inventory and Classification System",
    framework: "RBI ITG 2023",
    status: "mapped",
  },
  {
    id: "CTRL-ITG-AUDIT",
    name: "Independent IS Audit and Audit Committee Oversight",
    framework: "RBI ITG 2023",
    status: "mapped",
  },
];

export const RBI_IT_GOV_12562_QUESTIONS: AssessmentQuestion[] = [
  { id: "Q-ITG-01", title: "Is the IT Strategy Committee chaired by an Independent Director with relevant IT expertise and does it meet at least quarterly?", source: "ai" },
  { id: "Q-ITG-02", title: "Is there a senior management IT Steering Committee, chaired by the CEO or Whole-Time Director (WTD), with clearly defined terms of reference?", source: "ai" },
  { id: "Q-ITG-03", title: "Has a Head of IT function been appointed with adequate seniority and clearly documented responsibilities?", source: "ai" },
  { id: "Q-ITG-04", title: "Are key IT performance and IT maturity metrics defined, monitored and periodically reviewed by the Board or ITSC?", source: "ai" },
  { id: "Q-ITG-05", title: "Is there an effective mechanism to monitor that critical data flows are processed through Straight Through Processing (STP) without manual intervention?", source: "ai" },
  { id: "Q-ITG-06", title: "Are source code escrow arrangements in place for all critical applications supplied by external vendors?", source: "ai" },
  { id: "Q-ITG-07", title: "Do application vendors provide written confirmation that software is free of known vulnerabilities, malicious code and covert channels at go‑live and major changes?", source: "ai" },
  { id: "Q-ITG-08", title: "Is multi-factor authentication (MFA) implemented for all remote access channels and teleworking arrangements?", source: "ai" },
  { id: "Q-ITG-09", title: "Are security controls for teleworking and remote access formally reviewed at defined intervals for continued effectiveness?", source: "ai" },
  { id: "Q-ITG-10", title: "Is the CISO’s reporting line independent of the IT function, thereby avoiding conflicts of interest with IT operations?", source: "ai" },
  { id: "Q-ITG-11", title: "Are significant and suspicious cyber incidents reported to CERT-In and the RBI (or NHB, as applicable) within mandated timelines?", source: "ai" },
  { id: "Q-ITG-12", title: "Is a structured lessons-learnt process followed after major cyber incidents to drive enhancements to controls and resilience?", source: "ai" },
  { id: "Q-ITG-13", title: "Are DR drills for critical systems conducted at least half-yearly, with RTO/RPO achievement monitored and reported?", source: "ai" },
  { id: "Q-ITG-14", title: "Is the DR architecture designed to be broadly equivalent to the primary data center to enable seamless failover?", source: "ai" },
  { id: "Q-ITG-15", title: "Is a documented reconciliation process in place to address data loss in scenarios where a non-zero RPO has been accepted?", source: "ai" },
  { id: "Q-ITG-16", title: "Is the IS audit function organisationally independent and adequately staffed with personnel possessing the necessary technical skills?", source: "ai" },
  { id: "Q-ITG-17", title: "Are all critical IT assets, infrastructure components and applications appropriately covered within the periodic IS audit scope?", source: "ai" },
];
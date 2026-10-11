import type { CircularDetailData } from "@/data/rbiMasterDirectionsIndexed";

/**
 * Pending Circulars (Discovered by Regulatory Crawler, awaiting AI indexing)
 * Stored in data folder as mock/seed data.
 */
const PENDING_CIRCULARS_LIST: CircularDetailData[] = [
  {
    id: "rbi-pending-1",
    circularId: "RBI/2026-27/04",
    name: "Master Direction on Basel III Capital Regulations — Review of Countercyclical Capital Buffer Framework",
    body: "RBI",
    category: "Compliance",
    description: "RBI Master Direction on Basel III Capital Regulations. Review of Countercyclical Capital Buffer Framework.",
    dateOfIssue: "Jan 12, 2026",
    status: "Active",
    version: "1.0",
    tags: ["Commercial Banking", "RBI", "Prudential"],
    link: "https://rbi.org.in/scripts/bs_viewmasterdirections.aspx?id=12890",
    linkRef: "12890",
    applicableTo: "Commercial Banking",
    aiRecommendations: [],
    existingControls: [],
    questions: [],
    aiIndexComplete: false,
  },
  {
    id: "rbi-pending-2",
    circularId: "RBI/2025-26/118",
    name: "Digital Payment Security & Tokenization Controls for Merchant Onboarding",
    body: "RBI",
    category: "Cybersecurity",
    description: "RBI guidelines on Digital Payment Security & Tokenization Controls for Merchant Onboarding.",
    dateOfIssue: "Dec 18, 2025",
    status: "Active",
    version: "1.0",
    tags: ["Payment Systems", "RBI", "Cybersecurity"],
    link: "https://rbi.org.in/scripts/bs_viewmasterdirections.aspx?id=12774",
    linkRef: "12774",
    applicableTo: "Payment System Operators",
    aiRecommendations: [],
    existingControls: [],
    questions: [],
    aiIndexComplete: false,
  },
  {
    id: "sebi-pending-1",
    circularId: "SEBI/HO/MIRSD/2026/02",
    name: "Cybersecurity and Cyber Resilience Framework (CSCRF) for Qualified Stock Brokers (QSBs)",
    body: "SEBI",
    category: "Cybersecurity",
    description: "SEBI Cybersecurity and Cyber Resilience Framework (CSCRF) for Qualified Stock Brokers (QSBs).",
    dateOfIssue: "Jan 08, 2026",
    status: "Active",
    version: "1.0",
    tags: ["Stock Brokers", "SEBI", "Cybersecurity"],
    link: "https://www.sebi.gov.in/legal/circulars/jan-2026/cybersecurity-framework-qsbs_98912.html",
    linkRef: "sebi-pending-1",
    aiRecommendations: [],
    existingControls: [],
    questions: [],
    aiIndexComplete: false,
  },
  {
    id: "sebi-pending-2",
    circularId: "SEBI/HO/CFD/2025/104",
    name: "Specification of Enhanced Disclosure Requirements for High-Value Debt Listed Entities (HVDLEs)",
    body: "SEBI",
    category: "Reporting",
    description: "SEBI specification of Enhanced Disclosure Requirements for High-Value Debt Listed Entities (HVDLEs).",
    dateOfIssue: "Dec 04, 2025",
    status: "Active",
    version: "1.0",
    tags: ["Listing", "SEBI", "Reporting"],
    link: "https://www.sebi.gov.in/legal/circulars/dec-2025/hvdle-disclosure-mandates_98115.html",
    linkRef: "sebi-pending-2",
    aiRecommendations: [],
    existingControls: [],
    questions: [],
    aiIndexComplete: false,
  },
];

export function getAllPendingCircularsForList(): CircularDetailData[] {
  return PENDING_CIRCULARS_LIST;
}

export function getPendingCircularById(id: string): CircularDetailData | undefined {
  return PENDING_CIRCULARS_LIST.find((c) => c.id === id || c.linkRef === id);
}

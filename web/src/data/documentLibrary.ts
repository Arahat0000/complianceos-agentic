export interface DocumentLibraryItem {
  id: string;
  name: string;
  type: string;
  tags: string[];
  lastUpdated: string;
  status: string;
  expiryDate?: string;
  department?: string;
  classification?: string;
  effectiveDate?: string;
  lastRenewalDate?: string;
}

export const MOCK_DOCUMENT_ITEMS: DocumentLibraryItem[] = [
  {
    id: "1",
    name: "Information Security Policy v4.1",
    type: "policy",
    tags: ["SOC2", "ISO27001"],
    lastUpdated: "Feb 18, 2026",
    status: "active",
    expiryDate: "2026-03-05",
    department: "Security",
    classification: "Internal",
    effectiveDate: "2024-01-15",
    lastRenewalDate: "2025-01-15",
  },
  { id: "2", name: "Data Classification Standard", type: "policy", tags: ["DPDP", "Internal"], lastUpdated: "Feb 15, 2026", status: "active", expiryDate: "Mar 05, 2026", department: "Legal", classification: "Public" },
  { id: "3", name: "SOC 2 Type II Controls", type: "framework", tags: ["SOC2"], lastUpdated: "Jan 30, 2026", status: "active", expiryDate: "Jan 30, 2027", department: "Compliance", classification: "Confidential" },
  { id: "4", name: "ISO 27001:2022 Annex A", type: "framework", tags: ["ISO27001"], lastUpdated: "Jan 15, 2026", status: "active", expiryDate: "Jan 15, 2027", department: "Compliance", classification: "Restricted" },
  { id: "5", name: "Vendor & Outsourcing Risk Review Q4 2025", type: "questionnaire", tags: ["Vendor", "Outsourcing", "RBI/MD/nbfc/211"], lastUpdated: "Dec 20, 2025", status: "archived", department: "Procurement", classification: "Internal" },
  { id: "6", name: "RBI Cyber Security Framework Checklist", type: "framework", tags: ["RBI", "Cyber Security"], lastUpdated: "Nov 10, 2025", status: "active", expiryDate: "Feb 20, 2026", department: "Compliance", classification: "Confidential" },
  { id: "7", name: "Employee Security Training Deck", type: "policy", tags: ["Training"], lastUpdated: "Feb 1, 2026", status: "draft", department: "HR", classification: "Internal" },
  { id: "8", name: "Client Security Questionnaire - Acme", type: "questionnaire", tags: ["Client", "SOC2"], lastUpdated: "Feb 10, 2026", status: "active", department: "Sales", classification: "Confidential" },
];

export const DEMO_REFERENCE_DATE = new Date("Feb 26, 2026");

export const getDocumentData = (id: string) => ({
  id,
  name: id === "1" ? "Information Security Policy v4.1" : "Document Detail",
  type: "policy",
  description:
    "Core organizational policy outlining security responsibilities, data protection standards, and incident response protocols. This document is a primary evidence source for SOC 2 and ISO 27001 audits.",
  tags: ["SOC2", "ISO27001", "Compliance", "Security"],
  lastUpdated: "Feb 18, 2026",
  owner: "Chief Security Officer",
  status: "active",
  version: "4.1",
  fileSize: "2.4 MB",
  pageCount: 18,
  expiryDate: "2026-03-05",
  department: "Security",
  classification: "Internal",
  effectiveDate: "2024-01-15",
  lastRenewalDate: "2025-01-15",
  history: [
    {
      version: "4.1",
      date: "Feb 18, 2026",
      user: "Michael Chen",
      change: "Updated encryption standards",
    },
    {
      version: "4.0",
      date: "Jan 12, 2026",
      user: "Sarah Jenkins",
      change: "Major revision for 2026 compliance",
    },
    {
      version: "3.2",
      date: "Nov 02, 2025",
      user: "Michael Chen",
      change: "Minor fixes to HR section",
    },
  ],
  linkedControls: [
    {
      id: "CC1.1",
      name: "COSO Principle 1: Integrity and Ethical Values",
      status: "active",
    },
    {
      id: "CC1.2",
      name: "COSO Principle 2: Board of Directors Independence",
      status: "review-needed",
    },
    {
      id: "CC2.1",
      name: "COSO Principle 6: Specifies Suitable Objectives",
      status: "active",
    },
    {
      id: "CC3.1",
      name: "COSO Principle 10: Selects and Develops Control Activities",
      status: "review-needed",
    },
    {
      id: "CC4.1",
      name: "COSO Principle 13: Obtains and Generates Relevant Information",
      status: "active",
    },
    {
      id: "CC5.1",
      name: "COSO Principle 15: Communicates Externally",
      status: "active",
    },
  ],
});

export const AVAILABLE_CONTROLS = [
  {
    id: "CC1.3",
    name: "COSO Principle 3: Establishes Structure, Authority, and Responsibility",
    status: "unmapped",
  },
  {
    id: "CC1.4",
    name: "COSO Principle 4: Demonstrates Commitment to Competence",
    status: "unmapped",
  },
  {
    id: "CC1.5",
    name: "COSO Principle 5: Enforces Accountability",
    status: "unmapped",
  },
  {
    id: "CC2.2",
    name: "COSO Principle 7: Identifies and Analyzes Risk",
    status: "unmapped",
  },
  {
    id: "CC2.3",
    name: "COSO Principle 8: Assesses Fraud Risk",
    status: "unmapped",
  },
];

import { DEMO_AUDIT_NAME } from "@/demo/complianceScenario";

export interface AuditEntry {
  id: number | string;
  user: string;
  initials: string;
  action: string;
  detail?: string;
  time: string;
  date: string;
  type: "approval" | "edit" | "ai" | "comment" | "upload" | "status" | "system" | "create" | "export";
  assessment?: string;
  ip?: string;
}

export const MOCK_AUDIT_TRAIL: AuditEntry[] = [
  { id: 1, user: "AI Assistant", initials: "AI", action: "Extracted obligations", detail: "3 obligations extracted from RBI/MD/nbfc/211 — 2 of 3 citations verified", time: "10:42 AM", date: "Today", type: "ai", assessment: "RBI/MD/nbfc/211" },
  { id: 2, user: "Sarah Jenkins", initials: "SJ", action: "Confirmed obligation", detail: "OBL-00001 — Board Review of IT Framework and Gap Analysis", time: "10:55 AM", date: "Today", type: "approval", assessment: "RBI/MD/nbfc/211" },
  { id: 3, user: "AI Assistant", initials: "AI", action: "Suggested control", detail: "REC-13 — Role-based Access Control mapped from circular", time: "9:58 AM", date: "Today", type: "ai", assessment: "RBI/MD/nbfc/211" },
  { id: 4, user: "Rahul Mehta", initials: "RM", action: "Changed gap status", detail: "GAP-002 moved to In Remediation", time: "8:05 AM", date: "Today", type: "status", assessment: DEMO_AUDIT_NAME },
  { id: 5, user: "AI Assistant", initials: "AI", action: "Generated remediation plan", detail: "GAP-001 — Board IT/IS gap analysis not yet reviewed", time: "3:30 PM", date: "Yesterday", type: "ai", assessment: DEMO_AUDIT_NAME },
  { id: 6, user: "Priya Iyer", initials: "PI", action: "Added comment", detail: "Cyber incident reporting gap thread", time: "2:11 PM", date: "Yesterday", type: "comment", assessment: DEMO_AUDIT_NAME },
  { id: 7, user: "Karan Singh", initials: "KS", action: "Uploaded document", detail: "BCP_DR_Test_Report_2025.pdf", time: "12:00 PM", date: "Yesterday", type: "upload", assessment: "Business Continuity & DR" },
  { id: 8, user: "System", initials: "SY", action: "Auto-snapshot saved", detail: "Workspace checkpoint #18", time: "9:15 AM", date: "Yesterday", type: "system" },
  { id: 9, user: "Neha Sharma", initials: "NS", action: "Uploaded document", detail: "Vendor_Outsourcing_Contract_Template_v2.pdf", time: "11:00 AM", date: "Feb 22", type: "upload", assessment: "Vendor & Outsourcing Risk Review" },
  { id: 10, user: "Vikram Patel", initials: "VP", action: "Exported report", detail: "Gaps & Remediation summary — PDF", time: "4:00 PM", date: "Feb 22", type: "export", assessment: DEMO_AUDIT_NAME },
];

/** Mock previous month counts for comparison */
export const PREV_MONTH_AUDIT = { total: 8, approvals: 1, ai: 0, edits: 1 };

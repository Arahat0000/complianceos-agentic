import type { CircularChange } from "@complianceos/shared";
import { apiFetch } from "@/lib/api";

export interface ChangeItem {
  requirementText: string;
  sourceQuote?: string;
  reason?: string;
}
export interface ModifiedItem {
  before: string;
  after: string;
  change: string;
  quote?: string;
}

/** API shape: the shared entity plus server-computed extras. */
export type ChangeAnalysis = CircularChange & {
  method?: "AI" | "DETERMINISTIC";
  reopenableGapIds?: string[];
};

export function fetchChanges(circularId: string): Promise<ChangeAnalysis[]> {
  return apiFetch<ChangeAnalysis[]>(`/changes?circularId=${encodeURIComponent(circularId)}`);
}

export function analyzeChange(newCircularId: string, previousCircularId?: string): Promise<ChangeAnalysis> {
  return apiFetch<ChangeAnalysis>("/changes/analyze", {
    method: "POST",
    body: JSON.stringify({ newCircularId, previousCircularId }),
  });
}

/** Curated example shown in demo sessions (no backend). */
export const DEMO_CHANGE: ChangeAnalysis = {
  id: "demo-change",
  organizationId: "demo",
  newCircularId: "demo-new",
  previousCircularId: "demo-old",
  summary:
    "Incident reporting window tightened from 6 hours to 2 hours; MFA for privileged access added; quarterly paper audit report dropped.",
  added: [
    {
      requirementText: "Enforce multi-factor authentication for all privileged administrator access.",
      sourceQuote: "enforce MFA for admin access",
    },
  ],
  removed: [{ requirementText: "Submit a quarterly paper report of internal audits to the regulator." }],
  modified: [
    {
      before: "Report cyber incidents to the regulator within 6 hours.",
      after: "Report cyber incidents to the regulator within 2 hours.",
      change: "Reporting window cut from 6 hours to 2 hours.",
    },
  ],
  impactedControlIds: ["Incident Response Playbook", "Privileged Access Management"],
  reviewStatus: "SUGGESTED",
  createdById: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  method: "AI",
  reopenableGapIds: [],
};

import type { ComplianceGap } from "@complianceos/shared";
import { apiFetch } from "./api";
import type { RiskLevel, GapStatus } from "@/types/enums";

export type BackendComplianceGap = ComplianceGap;

export function fetchComplianceGaps(): Promise<BackendComplianceGap[]> {
  return apiFetch<BackendComplianceGap[]>("/compliance-gaps");
}

export interface CreateComplianceGapInput {
  title: string;
  description?: string;
  riskLevel?: RiskLevel;
  controlId?: string;
  obligationId?: string;
  questionId?: string;
  engagementName?: string;
  evidenceNeeded?: string;
  section?: string;
  assigneeId?: string;
}

export function createComplianceGap(input: CreateComplianceGapInput): Promise<BackendComplianceGap> {
  return apiFetch<BackendComplianceGap>("/compliance-gaps", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface UpdateComplianceGapInput {
  title?: string;
  description?: string;
  riskLevel?: RiskLevel;
  status?: GapStatus;
  obligationId?: string | null;
  controlId?: string | null;
  questionId?: string | null;
  engagementName?: string;
  evidenceNeeded?: string;
  section?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  // Recorded when status becomes RISK_ACCEPTED.
  riskAcceptedReason?: string;
}

export function updateComplianceGap(
  id: string,
  input: UpdateComplianceGapInput,
): Promise<BackendComplianceGap> {
  return apiFetch<BackendComplianceGap>(`/compliance-gaps/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteComplianceGap(id: string): Promise<void> {
  return apiFetch(`/compliance-gaps/${id}`, { method: "DELETE" });
}

// Ephemeral — not saved on the gap, just generated on demand.
export function generateRemediationPlan(id: string): Promise<{ plan: string }> {
  return apiFetch<{ plan: string }>(`/compliance-gaps/${id}/remediation-plan`, {
    method: "POST",
  });
}

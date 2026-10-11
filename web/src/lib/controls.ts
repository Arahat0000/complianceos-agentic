import type { Control, Obligation, Evidence, KnowledgeBaseEntry } from "@complianceos/shared";
import { apiFetch } from "./api";

export type BackendControl = Control;

export function fetchControls(): Promise<BackendControl[]> {
  return apiFetch<BackendControl[]>("/controls");
}

export interface UpdateControlInput {
  title?: string;
  description?: string;
  answer?: string;
  notes?: string;
  ownerName?: string;
  status?: Control["status"];
  implementationStatus?: NonNullable<Control["implementationStatus"]>;
}

export function updateControl(id: string, input: UpdateControlInput): Promise<BackendControl> {
  return apiFetch<BackendControl>(`/controls/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export type LinkedObligation = Obligation & {
  mappingSource?: string;
  mappingConfidence?: number | null;
};

export function fetchControlObligations(controlId: string): Promise<LinkedObligation[]> {
  return apiFetch<LinkedObligation[]>(`/controls/${controlId}/obligations`);
}

export function fetchControlEvidence(controlId: string): Promise<Evidence[]> {
  return apiFetch<Evidence[]>(`/controls/${controlId}/evidence`);
}

export interface AddEvidenceInput {
  documentId?: string;
  name: string;
  documentType?: string;
  section?: string;
  excerpt?: string;
  size?: number;
  status?: Evidence["status"];
}

export function addControlEvidence(controlId: string, input: AddEvidenceInput): Promise<Evidence> {
  return apiFetch<Evidence>(`/controls/${controlId}/evidence`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Link an existing knowledge-base entry to a control (replaces its controlIds).
export function setKnowledgeEntryControls(
  entryId: string,
  controlIds: string[],
): Promise<KnowledgeBaseEntry> {
  return apiFetch<KnowledgeBaseEntry>(`/knowledge-base/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify({ controlIds }),
  });
}

export type GeneratedControlAnswer = BackendControl & { persisted: boolean };

export function generateControlAnswer(id: string): Promise<GeneratedControlAnswer> {
  return apiFetch<GeneratedControlAnswer>(`/controls/${id}/generate-answer`, { method: "POST" });
}

export interface GenerateAnswersResult {
  generated: number;
  skipped: number;
  failed: number;
  controls: BackendControl[];
}

export function generateAnswersForCircular(
  circularId: string,
  onlyEmpty = false,
): Promise<GenerateAnswersResult> {
  return apiFetch<GenerateAnswersResult>("/controls/generate-answers", {
    method: "POST",
    body: JSON.stringify({ circularId, onlyEmpty }),
  });
}

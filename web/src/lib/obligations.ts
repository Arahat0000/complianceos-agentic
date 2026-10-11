import { apiFetch } from "./api";
import type { Obligation, ObligationSummary, ObligationStatus } from "@complianceos/shared";

export type BackendObligation = Obligation;

export interface ExtractionSummary {
  circularId: string;
  chunkCount: number;
  extractedCount: number;
  dedupedCount: number;
  ungroundedCount: number;
  obligations: BackendObligation[];
}

export type { ObligationSummary };

export function fetchObligationSummaries(): Promise<ObligationSummary[]> {
  return apiFetch<ObligationSummary[]>("/obligations/summary");
}

export function fetchObligations(circularId: string): Promise<BackendObligation[]> {
  return apiFetch<BackendObligation[]>(`/circulars/${circularId}/obligations`);
}

// Runs the Obligation Extraction Agent for this circular — a synchronous
// LLM call per ~6000-char chunk of the circular's text, so this can take a
// few seconds on a long document.
export function extractObligations(circularId: string): Promise<ExtractionSummary> {
  return apiFetch<ExtractionSummary>(`/circulars/${circularId}/obligations/extract`, {
    method: "POST",
  });
}

export interface UpdateObligationInput {
  status?: ObligationStatus;
  requirementText?: string;
}

export function updateObligation(
  id: string,
  input: UpdateObligationInput,
): Promise<BackendObligation> {
  return apiFetch<BackendObligation>(`/obligations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

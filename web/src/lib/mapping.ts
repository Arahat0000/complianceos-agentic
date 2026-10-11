import type { ObligationControl, SuggestionSummary } from "@complianceos/shared";
import { apiFetch } from "./api";

export type { ObligationControl };

export interface MappingSuggestionSummary extends SuggestionSummary {
  coverageGaps: { obligationId: string; identifier: string | null; requirementText: string }[];
}

export const fetchMappings = (q: { circularId?: string; obligationId?: string; controlId?: string }) =>
  apiFetch<ObligationControl[]>(`/mapping?${new URLSearchParams(q as Record<string, string>)}`);

export const suggestMappings = (input: { circularId?: string; obligationId?: string; onlyUnmapped?: boolean }) =>
  apiFetch<MappingSuggestionSummary>("/mapping/suggest", { method: "POST", body: JSON.stringify(input) });

export const reviewMapping = (obligationId: string, controlId: string, reviewStatus: "CONFIRMED" | "REJECTED") =>
  apiFetch<ObligationControl>(`/mapping/${obligationId}:${controlId}/review`, {
    method: "POST",
    body: JSON.stringify({ reviewStatus }),
  });

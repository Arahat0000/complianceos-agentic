import type { ObligationApplicability, SuggestionSummary } from "@complianceos/shared";
import { apiFetch } from "./api";

export type { ObligationApplicability, SuggestionSummary };

export const fetchApplicability = (q: { circularId?: string; obligationId?: string }) =>
  apiFetch<ObligationApplicability[]>(`/applicability?${new URLSearchParams(q as Record<string, string>)}`);

export const assessApplicability = (input: { circularId?: string; obligationIds?: string[] }) =>
  apiFetch<SuggestionSummary>("/applicability/assess", { method: "POST", body: JSON.stringify(input) });

export const reviewApplicability = (obligationId: string, reviewStatus: "CONFIRMED" | "REJECTED") =>
  apiFetch<ObligationApplicability>(`/applicability/${obligationId}/review`, {
    method: "POST",
    body: JSON.stringify({ reviewStatus }),
  });

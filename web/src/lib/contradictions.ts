import { apiFetch } from "./api";

interface ContradictionPartyDto {
  id: string;
  regulator: string;
  circularTitle: string | null;
  clause: string | null;
  requirement: string | null;
  obligationId: string | null;
  sourceQuote: string | null;
}

export interface ContradictionDto {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  conflictNature: string;
  strictestCommonDenominator: string | null;
  source: "CURATED" | "AI";
  reviewStatus: "SUGGESTED" | "CONFIRMED" | "REJECTED";
  confidence: number | null;
  parties: ContradictionPartyDto[];
  obligationIds: string[];
}

export interface DetectSummary {
  pairsExamined: number;
  proposed: number;
  dropped: number;
  flaggedUnverified: number;
  contradictionIds: string[];
}

export function fetchContradictions(): Promise<ContradictionDto[]> {
  return apiFetch<ContradictionDto[]>("/contradictions");
}

export function detectContradictionsWithAI(circularIds?: string[]): Promise<DetectSummary> {
  return apiFetch<DetectSummary>("/contradictions/detect", {
    method: "POST",
    body: JSON.stringify({ circularIds }),
  });
}

export function reviewContradiction(
  id: string,
  decision: "CONFIRMED" | "REJECTED",
  harmonize = false,
): Promise<ContradictionDto> {
  return apiFetch<ContradictionDto>(`/contradictions/${id}/review`, {
    method: "POST",
    body: JSON.stringify({ decision, harmonize }),
  });
}

// Curated local suggestions shown in demo mode (no backend).
export const DEMO_AI_SUGGESTIONS: ContradictionDto[] = [
  {
    id: "DEMO-AI-1",
    title: "Log retention: RBI 5 years vs DPDP erasure on purpose completion",
    description: "RBI requires transaction logs kept for five years while DPDP requires erasure once the purpose is served.",
    severity: "HIGH",
    conflictNature: "RETENTION_MISMATCH",
    strictestCommonDenominator: "Retain for 5 years under legal-hold tagging, then erase within 30 days.",
    source: "AI",
    reviewStatus: "SUGGESTED",
    confidence: 0.82,
    obligationIds: [],
    parties: [
      { id: "d1", regulator: "RBI", circularTitle: "Master Direction on IT Governance 2023", clause: "Sec 12.4", requirement: null, obligationId: null, sourceQuote: "Regulated entities shall preserve transaction logs for a minimum period of five years." },
      { id: "d2", regulator: "OTHER", circularTitle: "DPDP Rules 2025", clause: "Rule 8", requirement: null, obligationId: null, sourceQuote: "Personal data shall be erased once the specified purpose is no longer served." },
    ],
  },
];

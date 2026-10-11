import { z } from "zod";
import { ApplicabilityStatus, ObligationStatus, ObligationType } from "../types/enums.js";

// What the LLM must return for a single atomic obligation. sourceQuote is
// required to be a verbatim substring of the circular text — the agent
// verifies this after parsing (see obligationExtractionAgent.ts) rather than
// trusting the model, and stores the result as Obligation.citationVerified.
export const extractedObligationSchema = z.object({
  requirementText: z.string().min(1),
  obligationType: z.enum(ObligationType),
  deadline: z.string().nullable().optional(),
  applicabilityConditions: z.array(z.string()).default([]),
  penalty: z.string().nullable().optional(),
  sourceQuote: z.string().min(1),
  sourceSection: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
});
export type ExtractedObligation = z.infer<typeof extractedObligationSchema>;

export const obligationExtractionResultSchema = z.object({
  obligations: z.array(extractedObligationSchema),
});
export type ObligationExtractionResult = z.infer<typeof obligationExtractionResultSchema>;

export const updateObligationSchema = z.object({
  status: z.enum(ObligationStatus).optional(),
  requirementText: z.string().min(1).optional(),
  obligationType: z.enum(ObligationType).optional(),
  deadline: z.string().nullable().optional(),
  penalty: z.string().nullable().optional(),
});
export type UpdateObligationInput = z.infer<typeof updateObligationSchema>;

// PUT /obligations/:id/applicability — traceability step "Applicability".
export const upsertApplicabilitySchema = z.object({
  entities: z.array(z.string()).default([]),
  criteria: z.string().optional(),
  status: z.enum(ApplicabilityStatus).default("APPLICABLE"),
});
export type UpsertApplicabilityInput = z.infer<typeof upsertApplicabilitySchema>;

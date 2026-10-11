import { z } from "zod";

// AI proposals are reviewed one by one.
export const reviewSuggestionSchema = z.object({
  reviewStatus: z.enum(["CONFIRMED", "REJECTED"]),
});
export type ReviewSuggestionInput = z.infer<typeof reviewSuggestionSchema>;

// POST /mapping/suggest — propose obligation -> control mappings.
export const suggestMappingsSchema = z
  .object({
    circularId: z.string().min(1).optional(),
    obligationId: z.string().min(1).optional(),
    onlyUnmapped: z.boolean().default(true),
    maxObligations: z.number().int().min(1).max(200).default(40),
  })
  .refine((v) => v.circularId || v.obligationId, { message: "circularId or obligationId is required" });
export type SuggestMappingsInput = z.infer<typeof suggestMappingsSchema>;

// POST /applicability/assess — decide APPLICABLE / EXEMPT / CONDITIONAL from the entity profile.
export const assessApplicabilitySchema = z
  .object({
    circularId: z.string().min(1).optional(),
    obligationIds: z.array(z.string()).optional(),
    maxObligations: z.number().int().min(1).max(200).default(60),
  })
  .refine((v) => v.circularId || (v.obligationIds && v.obligationIds.length > 0), {
    message: "circularId or obligationIds is required",
  });
export type AssessApplicabilityInput = z.infer<typeof assessApplicabilitySchema>;

// PUT /profile — what the bank is.
export const upsertProfileSchema = z.object({
  entityType: z.string().optional(),
  regulators: z.array(z.string()).optional(),
  assetSizeCrore: z.number().nonnegative().nullable().optional(),
  licenses: z.array(z.string()).optional(),
  jurisdictions: z.array(z.string()).optional(),
  products: z.array(z.string()).optional(),
  notes: z.string().optional(),
});
export type UpsertProfileInput = z.infer<typeof upsertProfileSchema>;

// POST /contradictions/detect — find conflicts between obligations across circulars/regulators.
export const detectContradictionsSchema = z.object({
  circularIds: z.array(z.string()).optional(),
  maxObligations: z.number().int().min(2).max(300).default(80),
});
export type DetectContradictionsInput = z.infer<typeof detectContradictionsSchema>;

// POST /changes/analyze — what changed between two versions of a regulation.
export const analyzeChangeSchema = z.object({
  newCircularId: z.string().min(1),
  // Default: the circular the new one supersedes (supersededById), else the closest earlier match.
  previousCircularId: z.string().min(1).optional(),
});
export type AnalyzeChangeInput = z.infer<typeof analyzeChangeSchema>;

// POST /simulation/scenarios/:id/run
export const runSimulationSchema = z.object({
  // AUTO: graph-grounded AI reasoning when a model is configured, heuristic otherwise.
  method: z.enum(["AUTO", "HEURISTIC", "AI_GRAPH"]).default("AUTO"),
});
export type RunSimulationInput = z.infer<typeof runSimulationSchema>;

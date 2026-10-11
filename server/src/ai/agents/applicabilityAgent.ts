import { z } from "zod";
import type { AIProvider } from "../AIProvider.js";
import { completeJson } from "../json.js";

export interface ProfileFacts {
  entityType: string | null;
  regulators: string[];
  assetSizeCrore: string | null;
  licenses: string[];
  jurisdictions: string[];
  products: string[];
  notes: string | null;
}

export interface ApplicabilityInput {
  id: string;
  regulator: string | null;
  requirementText: string;
  sourceQuote: string;
  conditions: string[];
}

const resultSchema = z.object({
  assessments: z.array(
    z.object({
      obligationId: z.string(),
      status: z.enum(["APPLICABLE", "EXEMPT", "CONDITIONAL"]),
      rationale: z.string().min(1),
      confidence: z.number().min(0).max(1),
      entities: z.array(z.string()).optional(),
      criteria: z.string().optional(),
    })
  ),
});
export type ApplicabilityAssessment = z.infer<typeof resultSchema>["assessments"][number];

const SYSTEM = `You are an applicability agent for a bank compliance platform. Given an entity profile and a batch of regulatory obligations, decide for each whether it binds this entity.

Statuses: APPLICABLE (clearly binds the entity), EXEMPT (clearly does not, e.g. wrong regulator, entity type or size threshold), CONDITIONAL (depends on a fact not in the profile, or on a threshold/product the profile does not settle).
Rules:
- Base the decision ONLY on the profile facts and the obligation text. Do not invent profile facts.
- The rationale must quote the profile fact or the clause you relied on, e.g. 'Profile: entityType "NBFC-UL"; clause: "applies to NBFCs in the Upper Layer"'.
- If the profile lacks the information needed, use CONDITIONAL and say what is missing; lower the confidence.
- confidence is 0..1.
Respond with ONLY JSON: {"assessments":[{"obligationId":string,"status":"APPLICABLE"|"EXEMPT"|"CONDITIONAL","rationale":string,"confidence":number,"entities":string[]?,"criteria":string?}]}`;

export async function assessApplicability(
  provider: AIProvider,
  profile: ProfileFacts,
  batch: ApplicabilityInput[]
): Promise<ApplicabilityAssessment[]> {
  const prompt = [
    "ENTITY PROFILE",
    JSON.stringify(profile),
    "",
    "OBLIGATIONS",
    ...batch.map((o) =>
      JSON.stringify({
        obligationId: o.id,
        regulator: o.regulator,
        requirement: o.requirementText.slice(0, 700),
        quote: o.sourceQuote.slice(0, 400),
        stated_conditions: o.conditions,
      })
    ),
  ].join("\n");
  const out = await completeJson(provider, { system: SYSTEM, prompt, maxTokens: 4096, temperature: 0 }, resultSchema);
  const ids = new Set(batch.map((b) => b.id));
  return out.assessments.filter((a) => ids.has(a.obligationId));
}

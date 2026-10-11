import { z } from "zod";
import type { AIProvider } from "../AIProvider.js";
import { completeJson } from "../json.js";

export interface MappingObligation {
  id: string;
  requirementText: string;
  obligationType: string;
}

export interface MappingCandidate {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  category: string | null;
}

const resultSchema = z.object({
  mappings: z.array(
    z.object({
      controlId: z.string(),
      confidence: z.number().min(0).max(1),
      rationale: z.string().min(1),
    })
  ),
});
export type ProposedMapping = z.infer<typeof resultSchema>["mappings"][number];

const SYSTEM = `You are a control-mapping agent for a bank compliance platform. Given ONE regulatory obligation and a SHORTLIST of candidate internal controls, propose which controls (if any) satisfy the obligation.

Rules:
- Use ONLY controlIds from the shortlist. Never invent ids.
- Propose a control only if it plausibly implements the obligation; return an empty list if none do.
- rationale: one or two sentences tying the control to the obligation's specific requirement.
- confidence is 0..1 (>=0.8 clear match, 0.5-0.8 partial, <0.5 weak).
Respond with ONLY JSON: {"mappings":[{"controlId":string,"confidence":number,"rationale":string}]}`;

export async function proposeMappings(
  provider: AIProvider,
  obligation: MappingObligation,
  shortlist: MappingCandidate[]
): Promise<ProposedMapping[]> {
  const prompt = [
    `OBLIGATION (${obligation.id}, ${obligation.obligationType})`,
    obligation.requirementText.slice(0, 1200),
    "",
    "SHORTLIST",
    ...shortlist.map((c) =>
      JSON.stringify({
        controlId: c.id,
        code: c.code,
        title: c.title,
        category: c.category,
        description: (c.description ?? "").slice(0, 300),
      })
    ),
  ].join("\n");
  const out = await completeJson(provider, { system: SYSTEM, prompt, maxTokens: 1500, temperature: 0 }, resultSchema);
  const allowed = new Set(shortlist.map((s) => s.id));
  const seen = new Set<string>();
  return out.mappings.filter((m) => {
    if (!allowed.has(m.controlId) || seen.has(m.controlId)) return false;
    seen.add(m.controlId);
    return true;
  });
}

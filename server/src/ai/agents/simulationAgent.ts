import { z } from "zod";
import { getOrgAIConfig } from "../../services/organizationAIConfig.js";
import type { AIProvider } from "../AIProvider.js";
import { completeJson } from "../json.js";
import { getProviderForOrg } from "../orgProvider.js";

// Graph-grounded simulation agent. The model only decides WHICH controls would
// breach under a scenario and why; all numbers are computed by the caller.

export interface SimControlFacts {
  id: string;
  title: string;
  relevance: string | null;
  implementationStatus: string | null;
  obligations: { id: string; identifier: string | null; text: string }[];
  tests: { type: string; result: string; testedAt: string | null; notes: string | null }[];
  evidence: { name: string; status: string; excerpt: string | null; facts: unknown }[];
}

export interface SimScenarioFacts {
  name: string;
  category: string;
  regulator: string | null;
  hypothesis: string;
}

const verdictsSchema = z.object({
  verdicts: z.array(
    z.object({
      controlId: z.string(),
      breached: z.boolean(),
      reason: z.string().min(1).max(600),
      confidence: z.number().min(0).max(1).default(0.5),
      obligationIds: z.array(z.string()).default([]),
    })
  ),
});

export interface ControlVerdict {
  controlId: string;
  breached: boolean;
  reason: string;
  confidence: number;
  obligationIds: string[];
}

const SYSTEM = `You are a compliance simulation analyst for a bank. Given a hypothetical scenario (e.g. a regulatory amendment) and facts about the organisation's controls (linked obligations, latest test results, evidence), decide for EACH control whether it would BREACH, i.e. fall out of compliance, if the scenario happened.

Respond with ONLY JSON (no prose, no fences):
{"verdicts":[{"controlId": string, "breached": boolean, "reason": string, "confidence": number, "obligationIds": string[]}]}

Rules:
- Use only controlId values and obligation ids given in the input. Never invent ids.
- Each reason is one or two sentences citing the specific obligation (identifier) and/or evidence or test result that supports the verdict.
- confidence is 0..1. Prefer breached=false when the facts do not show the control depending on what the scenario changes.
- Return one verdict per control.`;

export async function isAiConfigured(organizationId: string): Promise<boolean> {
  if (process.env.AI_MOCK === "1") return true;
  if (process.env.ANTHROPIC_API_KEY || process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.AWS_ACCESS_KEY_ID) {
    return true;
  }
  const c = await getOrgAIConfig(organizationId);
  return Boolean(
    c?.useCustomAi &&
      c.aiProvider &&
      (c.aiApiKeyEncrypted || c.aiProvider === "OLLAMA" || c.aiProvider === "BEDROCK")
  );
}

export async function assessControls(
  organizationId: string,
  scenario: SimScenarioFacts,
  controls: SimControlFacts[]
): Promise<{ verdicts: ControlVerdict[]; model: string | null }> {
  const provider: AIProvider = await getProviderForOrg(organizationId);
  const prompt = [
    `SCENARIO: ${scenario.name} (${scenario.category})`,
    scenario.regulator ? `Regulator: ${scenario.regulator}` : null,
    `Hypothesis: ${scenario.hypothesis}`,
    "",
    "CONTROLS (JSON):",
    JSON.stringify(controls),
  ]
    .filter((l) => l !== null)
    .join("\n");
  const out = await completeJson(provider, { system: SYSTEM, prompt, maxTokens: 4000, temperature: 0 }, verdictsSchema);

  // Only ids from the input are allowed; first verdict per control wins.
  const byId = new Map(controls.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const verdicts: ControlVerdict[] = [];
  for (const v of out.verdicts) {
    const c = byId.get(v.controlId);
    if (!c || seen.has(v.controlId)) continue;
    seen.add(v.controlId);
    const allowed = new Set(c.obligations.map((o) => o.id));
    verdicts.push({ ...v, obligationIds: v.obligationIds.filter((id) => allowed.has(id)) });
  }
  return { verdicts, model: provider.modelId ?? null };
}

import { generatedRemediationPlanSchema, type GeneratedRemediationPlan } from "@complianceos/shared";
import type { ComplianceGapRow } from "../../db/types.js";
import { decrypt } from "../../lib/encryption.js";
import { getOrgAIConfig } from "../../services/organizationAIConfig.js";
import { resolveProvider } from "../resolveProvider.js";

// Remediation Recommendation Engine — the last hop in the traceability
// chain (regulations -> obligations -> controls -> gaps -> remediation).
// Given a single gap (plus its linked obligation/control text when present),
// proposes a structured plan that the caller persists as RemediationPlan +
// RemediationAction rows.

export interface RemediationContext {
  obligationText?: string | null;
  controlTitle?: string | null;
}

const SYSTEM_PROMPT = `You are a remediation-recommendation agent for a bank compliance platform. Given a single compliance gap, propose a concrete remediation plan a compliance/security team could execute.

Respond with ONLY a JSON object (no preamble, no code fences) of this shape:
{
  "planText": string,        // 3-5 short numbered steps, under 150 words total
  "leadTeam": string,        // optional: team that should own the work
  "slaDays": number,         // optional: positive integer, days to complete
  "actionSummary": string,   // optional: one-sentence summary
  "actions": [ { "title": string, "ownerName": string, "dueInDays": number } ]
}

Rules:
- Each action must be something a named team could actually do (e.g. "Engage a CERT-In empanelled vendor to run the overdue VAPT"), not vague advice.
- "actions" should have 3-5 items matching the steps in planText; ownerName and dueInDays are optional per action (dueInDays is a non-negative integer).
- Reference the stated risk level and evidence needed where relevant.`;

function buildPrompt(gap: ComplianceGapRow, ctx: RemediationContext): string {
  return [
    `Gap: ${gap.title}`,
    gap.description ? `Description: ${gap.description}` : null,
    `Risk level: ${gap.riskLevel}`,
    gap.section ? `Section/domain: ${gap.section}` : null,
    gap.evidenceNeeded ? `Evidence needed to close: ${gap.evidenceNeeded}` : null,
    ctx.obligationText ? `Linked obligation: ${ctx.obligationText}` : null,
    ctx.controlTitle ? `Linked control: ${ctx.controlTitle}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function parsePlan(raw: string): GeneratedRemediationPlan {
  let text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Remediation agent returned no JSON object");
  return generatedRemediationPlanSchema.parse(JSON.parse(text.slice(start, end + 1)));
}

export async function generateRemediationPlan(
  organizationId: string,
  gap: ComplianceGapRow,
  ctx: RemediationContext = {}
): Promise<GeneratedRemediationPlan> {
  const aiConfig = await getOrgAIConfig(organizationId);
  const provider = resolveProvider(
    aiConfig
      ? {
          useCustomAi: aiConfig.useCustomAi,
          aiProvider: aiConfig.aiProvider,
          aiModel: aiConfig.aiModel,
          aiApiKey: aiConfig.aiApiKeyEncrypted ? decrypt(aiConfig.aiApiKeyEncrypted) : null,
        }
      : null
  );

  const raw = await provider.complete({
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(gap, ctx),
    maxTokens: 1024,
  });
  return parsePlan(raw);
}

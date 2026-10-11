import type { ControlRow } from "../../db/types.js";
import { decrypt } from "../../lib/encryption.js";
import { getOrgAIConfig } from "../../services/organizationAIConfig.js";
import { resolveProvider } from "../resolveProvider.js";

// Drafts a concise answer describing how a control is met, grounded only in
// the obligations, evidence and knowledge-base entries supplied.

export interface ControlAnswerContext {
  circularName?: string | null;
  circularCode?: string | null;
  obligations: string[];
  evidence: { name: string; excerpt: string | null }[];
  knowledge: { question: string; answer: string }[];
}

const SYSTEM_PROMPT = `You draft compliance control answers for a bank. Given a control, the regulatory obligations mapped to it, existing evidence and knowledge-base entries, write a concise answer (2-6 sentences, plain text, no markdown, no preamble) explaining how the control addresses the obligations.
Rules:
- Use ONLY the supplied information. Never invent evidence, documents, dates or metrics.
- If evidence is missing or thin, say explicitly what evidence is missing.`;

function buildPrompt(c: ControlRow, ctx: ControlAnswerContext): string {
  const lines: (string | null)[] = [
    `Control: ${c.title}${c.code ? ` (${c.code})` : ""}`,
    c.description ? `Description: ${c.description}` : null,
    c.category ? `Category: ${c.category}` : null,
    c.framework ? `Framework: ${c.framework}` : null,
    c.relevance ? `Relevance: ${c.relevance}` : null,
    ctx.circularName ? `Circular: ${ctx.circularName}${ctx.circularCode ? ` (${ctx.circularCode})` : ""}` : null,
    "Mapped obligations:",
    ...(ctx.obligations.length ? ctx.obligations.map((o) => `- ${o}`) : ["- (none)"]),
    "Existing evidence:",
    ...(ctx.evidence.length
      ? ctx.evidence.map((e) => `- ${e.name}${e.excerpt ? `: ${e.excerpt}` : ""}`)
      : ["- (none)"]),
    "Knowledge base entries:",
    ...(ctx.knowledge.length
      ? ctx.knowledge.map((k) => `- Q: ${k.question} A: ${k.answer}`)
      : ["- (none)"]),
  ];
  return lines.filter((l) => l !== null).join("\n");
}

export async function generateControlAnswer(
  organizationId: string,
  control: ControlRow,
  ctx: ControlAnswerContext
): Promise<string> {
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
    prompt: buildPrompt(control, ctx),
    maxTokens: 600,
  });
  const text = raw.trim();
  if (!text) throw new Error("Control answer agent returned an empty answer");
  return text;
}

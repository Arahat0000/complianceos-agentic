import {
  extractedObligationSchema,
  obligationExtractionResultSchema,
  type ExtractedObligation,
} from "@complianceos/shared";
import { pool } from "../../db/pool.js";
import type { CircularRow, ObligationRow } from "../../db/types.js";
import { decrypt } from "../../lib/encryption.js";
import { getOrgAIConfig } from "../../services/organizationAIConfig.js";
import { auditAsAi } from "../../services/audit.js";
import { createObligations } from "../../services/obligationService.js";
import { resolveProvider } from "../resolveProvider.js";
import type { AIProvider } from "../AIProvider.js";

// --- Chunking -----------------------------------------------------------
//
// Circular.body can be an entire regulation's text. Rather than trusting a
// single completion call to extract every obligation from an arbitrarily
// long document (risking silent truncation), we window the text into
// overlapping chunks and run extraction per chunk, then dedupe. The overlap
// exists so an obligation whose sentence straddles a chunk boundary still
// appears whole in at least one window.
const CHUNK_SIZE = 6000;
const CHUNK_OVERLAP = 500;

function chunkText(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

// --- Prompting ------------------------------------------------------------

const SYSTEM_PROMPT = `You are a regulatory-obligation extraction agent for a bank compliance platform. You are given a slice of a regulatory circular's text and must extract every atomic, testable obligation it imposes on regulated entities.

Rules:
- One obligation per item. If a sentence bundles several distinct requirements, split them into separate items rather than merging them.
- Only extract genuine obligations — things a regulated entity "must", "shall", "is required to", or "should" do (or is prohibited from doing). Skip preambles, definitions, recitals, and purely explanatory text.
- "sourceQuote" MUST be copied VERBATIM, character-for-character, from the provided text — it will be used to locate the obligation in the source document by exact substring match. Do not paraphrase, summarize, or fix typos in it. Keep it as short as possible while still containing the actual obligation (usually one sentence).
- "requirementText" is a clear, self-contained paraphrase of the obligation, understandable without the surrounding context.
- "deadline" and "penalty" should be null if the text doesn't state one for this specific obligation — do not invent one.
- "applicabilityConditions" lists any stated conditions that limit who the obligation applies to (e.g. entity size, license type, geography). Empty array if none stated.
- "confidence" (0 to 1) reflects how explicit and unambiguous the obligation is in the text.
- If this slice of text contains no obligations, return an empty array.

Respond with ONLY a single JSON object matching this exact shape, no markdown fences, no commentary:
{"obligations": [{"requirementText": string, "obligationType": "REPORTING"|"GOVERNANCE"|"CONTROL"|"DISCLOSURE"|"RECORD_KEEPING"|"OPERATIONAL"|"AUDIT"|"OTHER", "deadline": string|null, "applicabilityConditions": string[], "penalty": string|null, "sourceQuote": string, "sourceSection": string|null, "confidence": number}]}`;

function buildPrompt(circular: CircularRow, chunk: string): string {
  return `Circular: ${circular.name} (${circular.circularId})\n\n--- TEXT SLICE START ---\n${chunk}\n--- TEXT SLICE END ---`;
}

// --- JSON extraction / repair ----------------------------------------------

function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function extractFromChunk(
  provider: AIProvider,
  circular: CircularRow,
  chunk: string
): Promise<ExtractedObligation[]> {
  const prompt = buildPrompt(circular, chunk);

  const runOnce = async (extraInstruction?: string): Promise<ExtractedObligation[]> => {
    const raw = await provider.complete({
      system: extraInstruction ? `${SYSTEM_PROMPT}\n\n${extraInstruction}` : SYSTEM_PROMPT,
      prompt,
      maxTokens: 4096,
    });
    const parsed = extractJsonObject(raw);
    const result = obligationExtractionResultSchema.parse(parsed);
    return result.obligations;
  };

  try {
    return await runOnce();
  } catch {
    // One retry with a stricter instruction — a single malformed response
    // (extra prose, truncated JSON) shouldn't fail the whole chunk when the
    // model can usually self-correct given a nudge.
    try {
      return await runOnce(
        "Your previous response was not valid JSON matching the required schema. Respond with ONLY the JSON object, nothing else."
      );
    } catch {
      return [];
    }
  }
}

// --- Grounding verification -------------------------------------------------

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function isGrounded(quote: string, sourceText: string): boolean {
  return normalizeWhitespace(sourceText).includes(normalizeWhitespace(quote));
}

// --- Dedupe -------------------------------------------------------------

function dedupeByQuote(obligations: ExtractedObligation[]): ExtractedObligation[] {
  const seen = new Set<string>();
  const out: ExtractedObligation[] = [];
  for (const o of obligations) {
    const key = normalizeWhitespace(o.sourceQuote).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}

// --- Entry point ----------------------------------------------------------

export interface ExtractionSummary {
  circularId: string;
  chunkCount: number;
  extractedCount: number;
  dedupedCount: number;
  ungroundedCount: number;
  obligations: ObligationRow[];
}

export async function runObligationExtraction(
  organizationId: string,
  circular: CircularRow
): Promise<ExtractionSummary> {
  const body = circular.body?.trim();
  if (!body) {
    throw new Error("Circular has no body text to extract obligations from");
  }
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
  const modelLabel =
    aiConfig?.useCustomAi && aiConfig.aiModel ? aiConfig.aiModel : "claude-sonnet-5";

  const chunks = chunkText(body);
  const perChunkResults = await Promise.all(
    chunks.map((chunk) => extractFromChunk(provider, circular, chunk))
  );
  const rawObligations = perChunkResults.flat();
  const deduped = dedupeByQuote(rawObligations);

  let ungroundedCount = 0;
  const withGrounding = deduped.map((o) => {
    const verified = isGrounded(o.sourceQuote, body);
    if (!verified) ungroundedCount += 1;
    return { ...extractedObligationSchema.parse(o), citationVerified: verified };
  });

  const created = await createObligations(organizationId, circular.id, withGrounding, modelLabel);

  // Mark the circular as AI-indexed (Circular.aiIndexComplete is derived
  // from indexedAt). Scoped to this org's own row or a global one.
  await pool.query(
    'UPDATE "Circular" SET "indexedAt" = CURRENT_TIMESTAMP WHERE id = $1 AND ("organizationId" IS NULL OR "organizationId" = $2)',
    [circular.id, organizationId]
  );

  await auditAsAi(organizationId, {
    type: "AI",
    action: "Obligations extracted",
    detail: `${created.length} obligations from ${chunks.length} chunk(s); ${rawObligations.length - deduped.length} duplicates removed; ${ungroundedCount} ungrounded`,
    objectType: "CIRCULAR",
    objectId: circular.id,
    context: circular.circularId,
  });

  return {
    circularId: circular.id,
    chunkCount: chunks.length,
    extractedCount: created.length,
    dedupedCount: rawObligations.length - deduped.length,
    ungroundedCount,
    obligations: created,
  };
}

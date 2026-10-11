import { ConflictNature, RiskLevel } from "@complianceos/shared";
import { z } from "zod";
import type { AIProvider } from "../AIProvider.js";
import { completeJson } from "../json.js";

// Contradiction Detection Agent — judges shortlisted obligation pairs. The
// shortlist is deterministic; the model only decides whether a genuine conflict
// exists and must quote both obligations verbatim (verified server-side).

export interface PairForJudgement {
  pairId: string; // "P1".."Pn", local to the batch
  a: PairSide;
  b: PairSide;
}
interface PairSide {
  regulator: string;
  circular: string;
  text: string;
}

const contradictionJudgementSchema = z.object({
  judgements: z.array(
    z.object({
      pairId: z.string(),
      conflict: z.boolean(),
      nature: z.enum(ConflictNature).optional(),
      severity: z.enum(RiskLevel).optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      strictestRule: z.string().optional(),
      quoteA: z.string().optional(),
      quoteB: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
  ),
});
export type ContradictionJudgements = z.infer<typeof contradictionJudgementSchema>;

const SYSTEM_PROMPT = `CONTRADICTION_DETECTION. You are a regulatory-conflict analyst for a bank compliance platform. You are given pairs of obligations (A and B) from different circulars/regulators. For each pair decide whether they GENUINELY conflict, i.e. one cannot be satisfied without violating or double-handling the other (different deadlines, retention periods, reporting thresholds, privacy vs audit access). Mere overlap or a stricter-but-compatible rule is NOT a conflict.

Respond with ONLY JSON:
{"judgements":[{"pairId":"P1","conflict":true|false,
 "nature":"TIMELINE_CLASH|RETENTION_MISMATCH|DATA_PRIVACY_VS_AUDIT|REPORTING_THRESHOLD",
 "severity":"LOW|MEDIUM|HIGH|CRITICAL","title":"...","description":"...",
 "strictestRule":"the single operating rule that satisfies both",
 "quoteA":"verbatim excerpt of obligation A","quoteB":"verbatim excerpt of obligation B",
 "confidence":0.0-1.0}]}
Rules: return one entry per pair; when conflict is false omit the other fields; quotes MUST be copied exactly from the given text, never paraphrased.`;

export async function judgeObligationPairs(
  provider: AIProvider,
  pairs: PairForJudgement[]
): Promise<ContradictionJudgements> {
  const prompt = pairs
    .map(
      (p) =>
        `${p.pairId}\nA [${p.a.regulator} - ${p.a.circular}]: ${p.a.text}\nB [${p.b.regulator} - ${p.b.circular}]: ${p.b.text}`
    )
    .join("\n\n");
  return completeJson(
    provider,
    { system: SYSTEM_PROMPT, prompt, maxTokens: 2500, temperature: 0 },
    contradictionJudgementSchema
  );
}

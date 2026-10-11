import { randomUUID } from "node:crypto";
import type {
  ConflictNature,
  DetectContradictionsInput,
  RiskLevel,
} from "@complianceos/shared";
import { getProviderForOrg } from "../ai/orgProvider.js";
import { judgeObligationPairs, type PairForJudgement } from "../ai/agents/contradictionAgent.js";
import { pool } from "../db/pool.js";
import { auditAsAi } from "./audit.js";
import {
  getContradiction,
  harmonizeContradiction,
  type ContradictionWithRelations,
} from "./contradictionService.js";

const MAX_PAIRS = 40;
const BATCH_SIZE = 5;
const MIN_SHARED_KEYWORDS = 3;
const UNVERIFIED_CONFIDENCE_CAP = 0.4;

interface Ob {
  id: string;
  circularId: string;
  regulator: string;
  circularName: string;
  requirementText: string;
  sourceQuote: string;
  sourceSection: string | null;
}

const STOP = new Set(
  "shall must should with that this from have been will their which under other than such into within upon also each any all are for and the not may can its our".split(" ")
);

const norm = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function keywords(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of norm(text).split(" ")) if (w.length >= 4 && !STOP.has(w)) out.add(w);
  return out;
}

const TIME_OR_THRESHOLD = /\b\d+\s*(?:minutes?|hours?|days?|months?|years?|%|lakh|crore)\b/i;

function shortlist(obs: Ob[], skip: Set<string>): { pairs: [Ob, Ob][]; total: number } {
  const kws = new Map(obs.map((o) => [o.id, keywords(`${o.requirementText} ${o.sourceQuote}`)]));
  const scored: { a: Ob; b: Ob; score: number }[] = [];
  for (let i = 0; i < obs.length; i++) {
    for (let j = i + 1; j < obs.length; j++) {
      const a = obs[i];
      const b = obs[j];
      if (a.circularId === b.circularId) continue;
      if (skip.has(pairKey(a.id, b.id))) continue;
      let shared = 0;
      for (const w of kws.get(a.id)!) if (kws.get(b.id)!.has(w)) shared++;
      if (shared < MIN_SHARED_KEYWORDS) continue;
      let score = shared;
      if (TIME_OR_THRESHOLD.test(a.requirementText) && TIME_OR_THRESHOLD.test(b.requirementText)) score += 5;
      if (a.regulator !== b.regulator) score += 2;
      scored.push({ a, b, score });
    }
  }
  scored.sort((x, y) => y.score - x.score || (x.a.id + x.b.id).localeCompare(y.a.id + y.b.id));
  return { pairs: scored.slice(0, MAX_PAIRS).map((s) => [s.a, s.b]), total: scored.length };
}

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

// Fuzzy containment: exact substring after normalisation, or >=80% of the
// quote's word trigrams present in the source text.
function quoteVerified(quote: string | undefined, ...sources: string[]): boolean {
  if (!quote) return false;
  const q = norm(quote);
  if (q.length < 12) return false;
  const text = norm(sources.join(" "));
  if (text.includes(q)) return true;
  const qt = q.split(" ");
  const tt = text.split(" ");
  if (qt.length < 3) return false;
  const grams = new Set<string>();
  for (let i = 0; i + 3 <= tt.length; i++) grams.add(tt.slice(i, i + 3).join(" "));
  let hit = 0;
  const n = qt.length - 2;
  for (let i = 0; i < n; i++) if (grams.has(qt.slice(i, i + 3).join(" "))) hit++;
  return hit / n >= 0.8;
}

export interface DetectSummary {
  pairsExamined: number;
  proposed: number;
  dropped: number;
  flaggedUnverified: number;
  contradictionIds: string[];
}

export async function detectContradictions(
  organizationId: string,
  input: DetectContradictionsInput
): Promise<DetectSummary> {
  const params: unknown[] = [organizationId];
  let circularFilter = "";
  if (input.circularIds?.length) {
    params.push(input.circularIds);
    circularFilter = `AND o."circularId" = ANY($2::varchar[])`;
  }
  const { rows: obs } = await pool.query<Ob>(
    `SELECT o.id, o."circularId", c.regulator::text AS regulator, c.name AS "circularName",
            o."requirementText", o."sourceQuote", o."sourceSection"
       FROM "Obligation" o JOIN "Circular" c ON c.id = o."circularId"
      WHERE o."organizationId" = $1 AND o.status <> 'DISMISSED' ${circularFilter}
      ORDER BY o."createdAt" DESC, o.id
      LIMIT ${Math.trunc(input.maxObligations)}`,
    params
  );

  // Pairs already covered by any contradiction (incl. rejected) are skipped.
  const { rows: existing } = await pool.query<{ a: string; b: string }>(
    `SELECT p1."obligationId" AS a, p2."obligationId" AS b
       FROM "ContradictionParty" p1
       JOIN "ContradictionParty" p2 ON p2."contradictionId" = p1."contradictionId" AND p2.id > p1.id
       JOIN "RegulatoryContradiction" rc ON rc.id = p1."contradictionId"
      WHERE p1."obligationId" IS NOT NULL AND p2."obligationId" IS NOT NULL
        AND (rc."organizationId" IS NULL OR rc."organizationId" = $1)`,
    [organizationId]
  );
  const skip = new Set(existing.map((e) => pairKey(e.a, e.b)));

  const { pairs } = shortlist(obs, skip);
  const summary: DetectSummary = {
    pairsExamined: pairs.length,
    proposed: 0,
    dropped: 0,
    flaggedUnverified: 0,
    contradictionIds: [],
  };
  if (pairs.length === 0) return summary;

  const provider = await getProviderForOrg(organizationId);
  const side = (o: Ob) => ({
    regulator: o.regulator,
    circular: o.circularName,
    text: o.requirementText,
  });

  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    const batch = pairs.slice(i, i + BATCH_SIZE);
    const req: PairForJudgement[] = batch.map(([a, b], k) => ({
      pairId: `P${k + 1}`,
      a: side(a),
      b: side(b),
    }));
    const result = await judgeObligationPairs(provider, req);
    const seen = new Set<string>();
    for (const j of result.judgements) {
      const idx = req.findIndex((r) => r.pairId === j.pairId);
      if (idx === -1 || seen.has(j.pairId) || !j.conflict) continue;
      seen.add(j.pairId);
      const [a, b] = batch[idx];
      const okA = quoteVerified(j.quoteA, a.requirementText, a.sourceQuote);
      const okB = quoteVerified(j.quoteB, b.requirementText, b.sourceQuote);
      if (!okA && !okB) {
        summary.dropped++;
        continue;
      }
      const verified = okA && okB;
      let confidence = j.confidence ?? 0.6;
      if (!verified) {
        confidence = Math.min(confidence, UNVERIFIED_CONFIDENCE_CAP);
        summary.flaggedUnverified++;
      }
      const id = await insertSuggestion(organizationId, a, b, {
        nature: j.nature ?? "TIMELINE_CLASH",
        severity: j.severity ?? "MEDIUM",
        title: j.title?.trim() || `Conflict between ${a.regulator} and ${b.regulator} obligations`,
        description:
          (j.description ?? "") +
          (verified ? "" : " [Flagged: one quote could not be verified against the obligation text.]"),
        strictestRule: j.strictestRule,
        confidence,
        quoteA: okA ? j.quoteA! : null,
        quoteB: okB ? j.quoteB! : null,
      });
      summary.proposed++;
      summary.contradictionIds.push(id);
    }
  }

  await auditAsAi(organizationId, {
    type: "AI",
    action: "Contradiction detection run",
    detail: `${summary.pairsExamined} pairs examined, ${summary.proposed} proposed, ${summary.dropped} dropped`,
    objectType: "CONTRADICTION",
  });
  return summary;
}

async function insertSuggestion(
  organizationId: string,
  a: Ob,
  b: Ob,
  s: {
    nature: ConflictNature;
    severity: RiskLevel;
    title: string;
    description: string;
    strictestRule?: string;
    confidence: number;
    quoteA: string | null;
    quoteB: string | null;
  }
): Promise<string> {
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO "RegulatoryContradiction"
         (id, "organizationId", severity, title, description, "conflictNature",
          "strictestCommonDenominator", source, "reviewStatus", confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'AI','SUGGESTED',$8)`,
      [id, organizationId, s.severity, s.title, s.description, s.nature, s.strictestRule ?? null, s.confidence]
    );
    for (const [o, quote] of [
      [a, s.quoteA],
      [b, s.quoteB],
    ] as const) {
      await client.query(
        `INSERT INTO "ContradictionParty"
           (id, "contradictionId", "circularId", regulator, "circularTitle", clause, requirement,
            "obligationId", "sourceQuote")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [randomUUID(), id, o.circularId, o.regulator, o.circularName, o.sourceSection, o.requirementText, o.id, quote]
      );
      await client.query(
        `INSERT INTO "ObligationContradiction" ("obligationId","contradictionId") VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [o.id, id]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return id;
}

// Confirm/reject an AI suggestion (org-owned only). Confirm may chain into harmonize.
export async function reviewContradiction(
  organizationId: string,
  userId: string,
  id: string,
  decision: "CONFIRMED" | "REJECTED",
  harmonize = false
): Promise<ContradictionWithRelations | null> {
  const { rowCount } = await pool.query(
    `UPDATE "RegulatoryContradiction" SET "reviewStatus" = $3, "updatedAt" = NOW()
      WHERE id = $1 AND "organizationId" = $2 AND source = 'AI'`,
    [id, organizationId, decision]
  );
  if (!rowCount) return null;
  if (decision === "CONFIRMED" && harmonize) {
    const row = await getContradiction(organizationId, id);
    for (const oid of row?.obligationIds ?? []) {
      await harmonizeContradiction(organizationId, userId, id, { obligationId: oid, harmonized: true });
    }
  }
  return getContradiction(organizationId, id);
}

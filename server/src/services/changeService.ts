import { randomUUID } from "node:crypto";
import type { AnalyzeChangeInput } from "@complianceos/shared";
import { getProviderForOrg } from "../ai/orgProvider.js";
import {
  classifyChanges,
  type ChangePair,
  type ChangeUnits,
  type ChangeVerdict,
  type ObligationText,
} from "../ai/agents/changeAnalysisAgent.js";
import { pool } from "../db/pool.js";
import type { CircularChangeRow, CircularRow } from "../db/types.js";

export class ChangeError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

interface ChangeItem {
  requirementText: string;
  sourceQuote?: string;
  reason?: string;
  obligationId?: string;
}
interface ModifiedItem {
  before: string;
  after: string;
  change: string;
  quote?: string;
  beforeObligationId?: string;
  afterObligationId?: string;
}

export type CircularChangeResult = CircularChangeRow & {
  method: "AI" | "DETERMINISTIC";
  reopenableGapIds: string[];
};

// --- deterministic matching ---------------------------------------------------

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9%.\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 || /\d/.test(w))
  );
}

function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / (ta.size + tb.size - inter);
}

const IDENTICAL = 0.95;
const CANDIDATE = 0.4;

function matchObligations(oldObs: ObligationText[], newObs: ObligationText[]) {
  const scored: { o: number; n: number; score: number }[] = [];
  oldObs.forEach((o, i) =>
    newObs.forEach((n, j) => scored.push({ o: i, n: j, score: similarity(o.requirementText, n.requirementText) }))
  );
  scored.sort((x, y) => y.score - x.score);
  const usedO = new Set<number>();
  const usedN = new Set<number>();
  const unchanged: { before: ObligationText; after: ObligationText }[] = [];
  const pairs: ChangePair[] = [];
  for (const s of scored) {
    if (s.score < CANDIDATE) break;
    if (usedO.has(s.o) || usedN.has(s.n)) continue;
    usedO.add(s.o);
    usedN.add(s.n);
    if (s.score >= IDENTICAL) unchanged.push({ before: oldObs[s.o], after: newObs[s.n] });
    else pairs.push({ label: `P${pairs.length + 1}`, before: oldObs[s.o], after: newObs[s.n], score: s.score });
  }
  const removedCandidates = oldObs
    .filter((_, i) => !usedO.has(i))
    .map((o, i) => ({ ...o, label: `R${i + 1}` }));
  const addedCandidates = newObs
    .filter((_, i) => !usedN.has(i))
    .map((o, i) => ({ ...o, label: `A${i + 1}` }));
  const units: ChangeUnits = { pairs, addedCandidates, removedCandidates };
  return { unchanged, units };
}

function numbersIn(s: string): string[] {
  return s.match(/\d+(?:\.\d+)?\s*(?:%|hours?|hrs?|days?|months?|years?|crore|lakh)?/gi)?.map((x) => x.trim()) ?? [];
}

function deterministicChange(p: ChangePair): string {
  const a = numbersIn(p.before.requirementText);
  const b = numbersIn(p.after.requirementText);
  const gone = a.filter((x) => !b.includes(x));
  const came = b.filter((x) => !a.includes(x));
  const pct = Math.round(p.score * 100);
  if (gone.length || came.length) {
    return `Wording changed (${pct}% similar); figures ${gone.join(", ") || "none"} became ${came.join(", ") || "none"}.`;
  }
  return `Wording changed (${pct}% similar).`;
}

// --- persistence / read ---------------------------------------------------------

async function reopenableGaps(organizationId: string, oldObligationIds: string[], controlIds: string[]): Promise<string[]> {
  if (oldObligationIds.length === 0 && controlIds.length === 0) return [];
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM "ComplianceGap"
      WHERE "organizationId" = $1 AND status = 'RESOLVED'
        AND ("obligationId" = ANY($2::varchar[]) OR "controlId" = ANY($3::varchar[]))`,
    [organizationId, oldObligationIds, controlIds]
  );
  return rows.map((r) => r.id);
}

async function decorate(organizationId: string, row: CircularChangeRow): Promise<CircularChangeResult> {
  const oldIds = [
    ...((row.removed as ChangeItem[] | null) ?? []),
    ...((row.modified as ModifiedItem[] | null) ?? []).map((m) => ({ obligationId: m.beforeObligationId })),
  ]
    .map((x) => x.obligationId)
    .filter((x): x is string => !!x);
  const method = (row.summary ?? "").startsWith("[AI]") ? "AI" : "DETERMINISTIC";
  return {
    ...row,
    method,
    reopenableGapIds: await reopenableGaps(organizationId, oldIds, row.impactedControlIds ?? []),
  };
}

export async function listChanges(organizationId: string, circularId?: string): Promise<CircularChangeResult[]> {
  const { rows } = await pool.query<CircularChangeRow>(
    `SELECT * FROM "CircularChange"
      WHERE "organizationId" = $1
        AND ($2::varchar IS NULL OR "newCircularId" = $2 OR "previousCircularId" = $2)
      ORDER BY "createdAt" DESC`,
    [organizationId, circularId ?? null]
  );
  return Promise.all(rows.map((r) => decorate(organizationId, r)));
}

export async function getChange(organizationId: string, id: string): Promise<CircularChangeResult | null> {
  const { rows } = await pool.query<CircularChangeRow>(
    `SELECT * FROM "CircularChange" WHERE id = $1 AND "organizationId" = $2`,
    [id, organizationId]
  );
  return rows[0] ? decorate(organizationId, rows[0]) : null;
}

// --- analysis --------------------------------------------------------------------

async function visibleCircular(organizationId: string, id: string): Promise<CircularRow | null> {
  const { rows } = await pool.query<CircularRow>(
    `SELECT * FROM "Circular" WHERE id = $1 AND ("organizationId" IS NULL OR "organizationId" = $2)`,
    [id, organizationId]
  );
  return rows[0] ?? null;
}

async function loadObligations(organizationId: string, circularId: string) {
  const { rows } = await pool.query<{ id: string; requirementText: string; sourceQuote: string }>(
    `SELECT id, "requirementText", "sourceQuote" FROM "Obligation"
      WHERE "organizationId" = $1 AND "circularId" = $2 ORDER BY identifier NULLS LAST, id`,
    [organizationId, circularId]
  );
  return rows;
}

export async function analyzeChange(
  organizationId: string,
  userId: string | null,
  input: AnalyzeChangeInput
): Promise<CircularChangeResult> {
  const next = await visibleCircular(organizationId, input.newCircularId);
  if (!next) throw new ChangeError(404, "Circular not found");

  let previousId = input.previousCircularId ?? null;
  if (!previousId) {
    // The circular that names this one as its successor.
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM "Circular"
        WHERE "supersededById" = $1 AND ("organizationId" IS NULL OR "organizationId" = $2)
        ORDER BY "dateOfIssue" DESC NULLS LAST LIMIT 1`,
      [next.id, organizationId]
    );
    previousId = rows[0]?.id ?? null;
  }
  if (!previousId) {
    throw new ChangeError(422, "No previous version found; pass previousCircularId");
  }
  if (previousId === next.id) throw new ChangeError(422, "previousCircularId must differ from newCircularId");
  const prev = await visibleCircular(organizationId, previousId);
  if (!prev) throw new ChangeError(404, "Previous circular not found");

  const [oldObs, newObs] = await Promise.all([
    loadObligations(organizationId, prev.id),
    loadObligations(organizationId, next.id),
  ]);
  const { units } = matchObligations(oldObs, newObs);

  let verdicts = new Map<string, ChangeVerdict>();
  let aiSummary = "";
  let usedAi = false;
  const anyUnits = units.pairs.length + units.addedCandidates.length + units.removedCandidates.length > 0;
  if (anyUnits) {
    try {
      const provider = await getProviderForOrg(organizationId);
      const r = await classifyChanges(provider, { newName: next.name, previousName: prev.name }, units);
      verdicts = r.verdicts;
      aiSummary = r.summary;
      usedAi = true;
    } catch (err) {
      console.warn("[changes] model unavailable, using deterministic diff:", err instanceof Error ? err.message : err);
    }
  }

  const added: ChangeItem[] = [];
  const removed: ChangeItem[] = [];
  const modified: ModifiedItem[] = [];
  for (const p of units.pairs) {
    const v = verdicts.get(p.label);
    if (usedAi && v?.classification === "UNCHANGED") continue;
    if (usedAi && v?.classification === "ADDED") {
      added.push({ requirementText: p.after.requirementText, sourceQuote: v.quote ?? p.after.sourceQuote, reason: v.reason, obligationId: p.after.id });
      removed.push({ requirementText: p.before.requirementText, sourceQuote: p.before.sourceQuote, obligationId: p.before.id });
      continue;
    }
    modified.push({
      before: p.before.requirementText,
      after: p.after.requirementText,
      change: v?.reason || deterministicChange(p),
      ...(v?.quote ? { quote: v.quote } : {}),
      beforeObligationId: p.before.id,
      afterObligationId: p.after.id,
    });
  }
  for (const a of units.addedCandidates) {
    const v = verdicts.get(a.label);
    if (usedAi && v?.classification === "UNCHANGED") continue;
    added.push({
      requirementText: a.requirementText,
      sourceQuote: v?.quote ?? a.sourceQuote,
      ...(v?.reason ? { reason: v.reason } : {}),
      obligationId: a.id,
    });
  }
  for (const r of units.removedCandidates) {
    const v = verdicts.get(r.label);
    if (usedAi && v?.classification === "UNCHANGED") continue;
    removed.push({
      requirementText: r.requirementText,
      sourceQuote: v?.quote ?? r.sourceQuote,
      ...(v?.reason ? { reason: v.reason } : {}),
      obligationId: r.id,
    });
  }

  const changedOldIds = [
    ...removed.map((x) => x.obligationId),
    ...modified.map((m) => m.beforeObligationId),
  ].filter((x): x is string => !!x);
  const { rows: ctl } = changedOldIds.length
    ? await pool.query<{ controlId: string }>(
        `SELECT DISTINCT oc."controlId" FROM "ObligationControl" oc
           JOIN "Control" c ON c.id = oc."controlId"
          WHERE oc."obligationId" = ANY($1::varchar[]) AND oc."reviewStatus" <> 'REJECTED'
            AND c."organizationId" = $2`,
        [changedOldIds, organizationId]
      )
    : { rows: [] };
  const impacted = ctl.map((r) => r.controlId);

  const counts = `${added.length} added, ${removed.length} removed, ${modified.length} modified`;
  const summary = usedAi
    ? `[AI] ${aiSummary || `${next.name} vs ${prev.name}: ${counts}.`}`
    : `${next.name} vs ${prev.name}: ${counts} (deterministic text match; no model available).`;

  const id = randomUUID();
  const { rows } = await pool.query<CircularChangeRow>(
    `INSERT INTO "CircularChange"
       (id, "organizationId", "newCircularId", "previousCircularId", summary, added, removed, modified,
        "impactedControlIds", "createdById")
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::text[],$10) RETURNING *`,
    [id, organizationId, next.id, prev.id, summary, JSON.stringify(added), JSON.stringify(removed), JSON.stringify(modified), impacted, userId]
  );
  return decorate(organizationId, rows[0]);
}

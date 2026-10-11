import type { SuggestMappingsInput, SuggestionSummary } from "@complianceos/shared";
import { pool } from "../db/pool.js";
import type { ControlRow, ObligationControlRow, ObligationRow } from "../db/types.js";
import { proposeMappings, type MappingCandidate } from "../ai/agents/mappingAgent.js";
import { getProviderForOrg } from "../ai/orgProvider.js";
import { auditAsAi } from "./audit.js";

const SHORTLIST_SIZE = 8;
const STOP = new Set(
  "the a an and or of to in for on by with be is are shall must at as from that this all any its it their such which have has not may".split(" ")
);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOP.has(t))
  );
}

// Deterministic shortlist: token overlap (Jaccard-ish), boosted for same circular / matching category.
function shortlistControls(
  obligation: Pick<ObligationRow, "requirementText" | "circularId" | "obligationType">,
  controls: ControlRow[],
  size = SHORTLIST_SIZE
): ControlRow[] {
  const ot = tokens(obligation.requirementText);
  const scored = controls.map((c) => {
    const ct = tokens(`${c.title} ${c.description ?? ""} ${c.category ?? ""}`);
    let overlap = 0;
    for (const t of ct) if (ot.has(t)) overlap++;
    let score = ct.size ? overlap / Math.sqrt(ct.size * Math.max(ot.size, 1)) : 0;
    if (overlap === 0) return { c, score: 0 };
    if (c.circularId === obligation.circularId) score *= 1.5;
    if (c.category && ot.has(c.category.toLowerCase())) score *= 1.2;
    return { c, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, size)
    .map((s) => s.c);
}

export interface MappingSummary extends SuggestionSummary {
  coverageGaps: { obligationId: string; identifier: string | null; requirementText: string }[];
}

export async function suggestMappings(organizationId: string, input: SuggestMappingsInput): Promise<MappingSummary> {
  const provider = await getProviderForOrg(organizationId);
  const model = provider.modelId ?? null;
  const summary: MappingSummary = { proposed: 0, skipped: 0, failed: 0, model, coverageGaps: [] };

  const params: unknown[] = [organizationId];
  let where = 'o."organizationId" = $1 AND o.status <> \'DISMISSED\'';
  if (input.obligationId) {
    params.push(input.obligationId);
    where += ` AND o.id = $${params.length}`;
  }
  if (input.circularId) {
    params.push(input.circularId);
    where += ` AND o."circularId" = $${params.length}`;
  }
  if (input.onlyUnmapped) where += ' AND NOT EXISTS (SELECT 1 FROM "ObligationControl" oc WHERE oc."obligationId" = o.id)';
  params.push(input.maxObligations);
  const { rows: obligations } = await pool.query<ObligationRow>(
    `SELECT o.* FROM "Obligation" o WHERE ${where} ORDER BY o.identifier NULLS LAST, o.id LIMIT $${params.length}`,
    params
  );
  const { rows: controls } = await pool.query<ControlRow>('SELECT * FROM "Control" WHERE "organizationId" = $1', [
    organizationId,
  ]);

  for (const o of obligations) {
    const gap = () =>
      summary.coverageGaps.push({ obligationId: o.id, identifier: o.identifier, requirementText: o.requirementText });
    const shortlist = shortlistControls(o, controls);
    if (shortlist.length === 0) {
      gap();
      continue;
    }
    try {
      const candidates: MappingCandidate[] = shortlist.map((c) => ({
        id: c.id, code: c.code, title: c.title, description: c.description, category: c.category,
      }));
      const proposals = await proposeMappings(provider, o, candidates);
      if (proposals.length === 0) gap();
      for (const p of proposals) {
        // Never touch an existing mapping (human or AI).
        const res = await pool.query(
          `INSERT INTO "ObligationControl" ("obligationId", "controlId", "mappingSource", confidence, rationale, "reviewStatus")
           VALUES ($1, $2, 'AI', $3, $4, 'SUGGESTED') ON CONFLICT DO NOTHING`,
          [o.id, p.controlId, p.confidence, p.rationale]
        );
        if (res.rowCount) summary.proposed++;
        else summary.skipped++;
      }
    } catch {
      summary.failed++;
    }
  }

  await auditAsAi(organizationId, {
    type: "AI",
    action: `Suggested control mappings: ${summary.proposed} proposed, ${summary.coverageGaps.length} coverage gaps, ${summary.failed} failed`,
    objectType: "OBLIGATION",
    detail: model,
  });
  return summary;
}

export async function listMappings(
  organizationId: string,
  filter: { circularId?: string; obligationId?: string; controlId?: string; reviewStatus?: string }
): Promise<ObligationControlRow[]> {
  const params: unknown[] = [organizationId];
  let where = 'o."organizationId" = $1';
  for (const [col, val] of [
    ['o."circularId"', filter.circularId],
    ["o.id", filter.obligationId],
    ['oc."controlId"', filter.controlId],
    ['oc."reviewStatus"', filter.reviewStatus],
  ] as const) {
    if (!val) continue;
    params.push(val);
    where += ` AND ${col} = $${params.length}`;
  }
  const { rows } = await pool.query<ObligationControlRow>(
    `SELECT oc.* FROM "ObligationControl" oc JOIN "Obligation" o ON o.id = oc."obligationId" WHERE ${where}`,
    params
  );
  return rows;
}

export async function reviewMapping(
  organizationId: string,
  obligationId: string,
  controlId: string,
  reviewStatus: "CONFIRMED" | "REJECTED"
): Promise<ObligationControlRow | null> {
  const { rows } = await pool.query<ObligationControlRow>(
    `UPDATE "ObligationControl" oc SET "reviewStatus" = $4
       FROM "Obligation" o
      WHERE oc."obligationId" = o.id AND o.id = $1 AND oc."controlId" = $2 AND o."organizationId" = $3
      RETURNING oc.*`,
    [obligationId, controlId, organizationId, reviewStatus]
  );
  return rows[0] ?? null;
}

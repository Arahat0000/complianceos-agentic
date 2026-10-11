import type { AssessApplicabilityInput, SuggestionSummary } from "@complianceos/shared";
import { pool } from "../db/pool.js";
import type { ObligationApplicabilityRow, ObligationRow } from "../db/types.js";
import { assessApplicability, type ApplicabilityInput } from "../ai/agents/applicabilityAgent.js";
import { getProviderForOrg } from "../ai/orgProvider.js";
import { auditAsAi } from "./audit.js";
import { getProfile } from "./profileService.js";

const BATCH = 8;

export async function assessObligations(
  organizationId: string,
  input: AssessApplicabilityInput
): Promise<SuggestionSummary> {
  const provider = await getProviderForOrg(organizationId);
  const model = provider.modelId ?? null;
  const summary: SuggestionSummary = { proposed: 0, skipped: 0, failed: 0, model };

  const profile = await getProfile(organizationId);
  if (!profile) throw Object.assign(new Error("Set up the entity profile before assessing applicability"), { status: 400 });

  const params: unknown[] = [organizationId];
  let where = 'o."organizationId" = $1 AND o.status <> \'DISMISSED\'';
  if (input.obligationIds?.length) {
    params.push(input.obligationIds);
    where += ` AND o.id = ANY($${params.length})`;
  }
  if (input.circularId) {
    params.push(input.circularId);
    where += ` AND o."circularId" = $${params.length}`;
  }
  params.push(input.maxObligations);
  const { rows } = await pool.query<
    ObligationRow & { regulator: string | null; existing: ObligationApplicabilityRow["reviewStatus"] | null }
  >(
    `SELECT o.*, c.regulator, ap."reviewStatus" AS existing
       FROM "Obligation" o
       JOIN "Circular" c ON c.id = o."circularId"
       LEFT JOIN "ObligationApplicability" ap ON ap."obligationId" = o.id
      WHERE ${where}
      ORDER BY o.identifier NULLS LAST, o.id
      LIMIT $${params.length}`,
    params
  );

  // A human-confirmed row is never overwritten.
  const todo: ApplicabilityInput[] = [];
  for (const o of rows) {
    if (o.existing === "CONFIRMED") {
      summary.skipped++;
      continue;
    }
    todo.push({
      id: o.id,
      regulator: o.regulator,
      requirementText: o.requirementText,
      sourceQuote: o.sourceQuote,
      conditions: o.applicabilityConditions ?? [],
    });
  }

  const facts = {
    entityType: profile.entityType,
    regulators: profile.regulators ?? [],
    assetSizeCrore: profile.assetSizeCrore,
    licenses: profile.licenses ?? [],
    jurisdictions: profile.jurisdictions ?? [],
    products: profile.products ?? [],
    notes: profile.notes,
  };

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    try {
      const results = await assessApplicability(provider, facts, batch);
      for (const r of results) {
        const res = await pool.query(
          `INSERT INTO "ObligationApplicability"
             ("obligationId", entities, criteria, status, rationale, source, confidence, "reviewStatus")
           VALUES ($1, $2, $3, $4, $5, 'AI', $6, 'SUGGESTED')
           ON CONFLICT ("obligationId") DO UPDATE SET
             entities = EXCLUDED.entities, criteria = EXCLUDED.criteria, status = EXCLUDED.status,
             rationale = EXCLUDED.rationale, source = 'AI', confidence = EXCLUDED.confidence,
             "reviewStatus" = 'SUGGESTED'
           WHERE "ObligationApplicability"."reviewStatus" <> 'CONFIRMED'`,
          [r.obligationId, r.entities ?? null, r.criteria ?? null, r.status, r.rationale, r.confidence]
        );
        if (res.rowCount) summary.proposed++;
        else summary.skipped++;
      }
      summary.failed += batch.length - results.length;
    } catch {
      summary.failed += batch.length;
    }
  }

  await auditAsAi(organizationId, {
    type: "AI",
    action: `Assessed applicability: ${summary.proposed} proposed, ${summary.skipped} skipped, ${summary.failed} failed`,
    objectType: "OBLIGATION",
    detail: model,
  });
  return summary;
}

export async function listApplicability(
  organizationId: string,
  filter: { circularId?: string; obligationId?: string }
): Promise<ObligationApplicabilityRow[]> {
  const params: unknown[] = [organizationId];
  let where = 'o."organizationId" = $1';
  if (filter.circularId) {
    params.push(filter.circularId);
    where += ` AND o."circularId" = $${params.length}`;
  }
  if (filter.obligationId) {
    params.push(filter.obligationId);
    where += ` AND o.id = $${params.length}`;
  }
  const { rows } = await pool.query<ObligationApplicabilityRow>(
    `SELECT ap.* FROM "ObligationApplicability" ap JOIN "Obligation" o ON o.id = ap."obligationId" WHERE ${where}`,
    params
  );
  return rows;
}

export async function reviewApplicability(
  organizationId: string,
  obligationId: string,
  reviewStatus: "CONFIRMED" | "REJECTED"
): Promise<ObligationApplicabilityRow | null> {
  const { rows } = await pool.query<ObligationApplicabilityRow>(
    `UPDATE "ObligationApplicability" ap SET "reviewStatus" = $3
       FROM "Obligation" o
      WHERE ap."obligationId" = o.id AND o.id = $1 AND o."organizationId" = $2
      RETURNING ap.*`,
    [obligationId, organizationId, reviewStatus]
  );
  return rows[0] ?? null;
}

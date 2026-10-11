import { randomUUID } from "node:crypto";
import type {
  ExtractedObligation,
  LinkObligationControlInput,
  UpdateObligationInput,
  UpsertApplicabilityInput,
} from "@complianceos/shared";
import { pool } from "../db/pool.js";
import { buildSet } from "../db/sql.js";
import type {
  ControlRow,
  ObligationApplicabilityRow,
  ObligationControlRow,
  ObligationRow,
  ObligationSummaryRow,
} from "../db/types.js";

// Powers the /obligations landing grid — one row per circular that has at
// least one extracted obligation, so the grid can show "already worked on"
// circulars without an N+1 fetch per card.
export async function listObligationSummaries(organizationId: string): Promise<ObligationSummaryRow[]> {
  const { rows } = await pool.query<ObligationSummaryRow>(
    `SELECT
       c.id AS "circularId",
       c.name AS "circularName",
       c."circularId" AS "circularCode",
       c.category,
       COUNT(o.id)::int AS total,
       COUNT(*) FILTER (WHERE o."citationVerified")::int AS verified,
       COUNT(*) FILTER (WHERE o.status = 'CONFIRMED')::int AS confirmed,
       COUNT(*) FILTER (WHERE o.status = 'DISMISSED')::int AS dismissed,
       MAX(o."createdAt") AS "lastExtractedAt"
     FROM "Obligation" o
     JOIN "Circular" c ON c.id = o."circularId"
     WHERE o."organizationId" = $1
     GROUP BY c.id, c.name, c."circularId", c.category
     ORDER BY MAX(o."createdAt") DESC`,
    [organizationId]
  );
  return rows;
}

export async function listObligationsByCircular(
  organizationId: string,
  circularId: string
): Promise<ObligationRow[]> {
  const { rows } = await pool.query<ObligationRow>(
    'SELECT * FROM "Obligation" WHERE "organizationId" = $1 AND "circularId" = $2 ORDER BY "createdAt" ASC',
    [organizationId, circularId]
  );
  return rows;
}

async function getObligation(
  organizationId: string,
  id: string
): Promise<ObligationRow | null> {
  const { rows } = await pool.query<ObligationRow>(
    'SELECT * FROM "Obligation" WHERE id = $1 AND "organizationId" = $2',
    [id, organizationId]
  );
  return rows[0] ?? null;
}

// Bulk-inserts the agent's validated output in one transaction — either the
// whole extraction run lands or none of it does, so a mid-run failure can't
// leave a circular with a partial obligation set that looks complete.
export async function createObligations(
  organizationId: string,
  circularId: string,
  obligations: (ExtractedObligation & { citationVerified: boolean })[],
  extractionModel: string
): Promise<ObligationRow[]> {
  if (obligations.length === 0) return [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted: ObligationRow[] = [];
    for (const o of obligations) {
      const { rows } = await client.query<ObligationRow>(
        `INSERT INTO "Obligation"
           (id, identifier, "organizationId", "circularId", "requirementText", "obligationType",
            deadline, "applicabilityConditions", penalty, "sourceQuote", "sourceSection",
            "citationVerified", confidence, "extractionModel")
         VALUES ($1, 'OBL-' || lpad(nextval('obligation_identifier_seq')::text, 5, '0'),
                 $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          randomUUID(),
          organizationId,
          circularId,
          o.requirementText,
          o.obligationType,
          o.deadline ?? null,
          o.applicabilityConditions,
          o.penalty ?? null,
          o.sourceQuote,
          o.sourceSection ?? null,
          o.citationVerified,
          o.confidence,
          extractionModel,
        ]
      );
      inserted.push(rows[0]);
    }
    await client.query("COMMIT");
    return inserted;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const UPDATABLE_COLUMNS = [
  "status",
  "requirementText",
  "obligationType",
  "deadline",
  "penalty",
] as const;

export async function updateObligation(
  organizationId: string,
  id: string,
  input: UpdateObligationInput,
  reviewerId?: string
): Promise<ObligationRow | null> {
  const set = buildSet(input, UPDATABLE_COLUMNS, 3);
  if (!set) return getObligation(organizationId, id);

  // Confirming or dismissing is a review decision: stamp who and when.
  let review = "";
  const values = [...set.values];
  if (input.status === "CONFIRMED" || input.status === "DISMISSED") {
    values.push(reviewerId ?? null);
    review = `, "reviewedById" = $${values.length + 2}, "reviewedAt" = CURRENT_TIMESTAMP`;
  }
  const { rows } = await pool.query<ObligationRow>(
    `UPDATE "Obligation"
       SET ${set.clause}${review}, "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1 AND "organizationId" = $2
     RETURNING *`,
    [id, organizationId, ...values]
  );
  return rows[0] ?? null;
}

export async function deleteObligation(organizationId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM "Obligation" WHERE id = $1 AND "organizationId" = $2',
    [id, organizationId]
  );
  return (rowCount ?? 0) > 0;
}

export async function upsertApplicability(
  organizationId: string,
  obligationId: string,
  input: UpsertApplicabilityInput
): Promise<ObligationApplicabilityRow | null> {
  const obligation = await getObligation(organizationId, obligationId);
  if (!obligation) return null;
  const { rows } = await pool.query<ObligationApplicabilityRow>(
    `INSERT INTO "ObligationApplicability" ("obligationId", entities, criteria, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("obligationId") DO UPDATE
       SET entities = EXCLUDED.entities, criteria = EXCLUDED.criteria, status = EXCLUDED.status
     RETURNING *`,
    [obligationId, input.entities, input.criteria ?? null, input.status]
  );
  return rows[0];
}

export type LinkedControl = ControlRow & {
  mappingSource: ObligationControlRow["mappingSource"];
  mappingConfidence: number | null;
};

export async function listControlsForObligation(
  organizationId: string,
  obligationId: string
): Promise<LinkedControl[] | null> {
  const obligation = await getObligation(organizationId, obligationId);
  if (!obligation) return null;
  const { rows } = await pool.query<LinkedControl>(
    `SELECT c.*, oc."mappingSource", oc.confidence AS "mappingConfidence"
     FROM "ObligationControl" oc
     JOIN "Control" c ON c.id = oc."controlId"
     WHERE oc."obligationId" = $1
       AND (c."organizationId" IS NULL OR c."organizationId" = $2)
     ORDER BY c.title ASC`,
    [obligationId, organizationId]
  );
  return rows;
}

export type LinkedObligation = ObligationRow & {
  mappingSource: ObligationControlRow["mappingSource"];
  mappingConfidence: number | null;
};

export async function listObligationsForControl(
  organizationId: string,
  controlId: string
): Promise<LinkedObligation[] | null> {
  const { rows: controls } = await pool.query(
    'SELECT 1 FROM "Control" WHERE id = $1 AND ("organizationId" IS NULL OR "organizationId" = $2)',
    [controlId, organizationId]
  );
  if (controls.length === 0) return null;
  const { rows } = await pool.query<LinkedObligation>(
    `SELECT o.*, oc."mappingSource", oc.confidence AS "mappingConfidence"
     FROM "ObligationControl" oc
     JOIN "Obligation" o ON o.id = oc."obligationId"
     WHERE oc."controlId" = $1 AND o."organizationId" = $2
     ORDER BY o.identifier ASC`,
    [controlId, organizationId]
  );
  return rows;
}

// Returns null if the obligation or control is not visible to the org.
export async function linkObligationControl(
  organizationId: string,
  obligationId: string,
  input: LinkObligationControlInput
): Promise<ObligationControlRow | null> {
  const obligation = await getObligation(organizationId, obligationId);
  if (!obligation) return null;
  const { rows: controls } = await pool.query(
    'SELECT 1 FROM "Control" WHERE id = $1 AND ("organizationId" IS NULL OR "organizationId" = $2)',
    [input.controlId, organizationId]
  );
  if (controls.length === 0) return null;
  const { rows } = await pool.query<ObligationControlRow>(
    `INSERT INTO "ObligationControl" ("obligationId", "controlId", "mappingSource", confidence)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("obligationId", "controlId") DO UPDATE
       SET "mappingSource" = EXCLUDED."mappingSource", confidence = EXCLUDED.confidence
     RETURNING *`,
    [obligationId, input.controlId, input.mappingSource, input.confidence ?? null]
  );
  return rows[0];
}

export async function unlinkObligationControl(
  organizationId: string,
  obligationId: string,
  controlId: string
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM "ObligationControl"
     WHERE "obligationId" = $1 AND "controlId" = $2
       AND EXISTS (SELECT 1 FROM "Obligation" WHERE id = $1 AND "organizationId" = $3)`,
    [obligationId, controlId, organizationId]
  );
  return (rowCount ?? 0) > 0;
}

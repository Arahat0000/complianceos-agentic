import { randomUUID } from "node:crypto";
import type { CreateControlInput, UpdateControlInput } from "@complianceos/shared";
import { pool } from "../db/pool.js";
import { buildSet } from "../db/sql.js";
import type { ControlRow } from "../db/types.js";
import { getCircular } from "./circularService.js";

// Same visibility model as Circular: global (organizationId IS NULL) or
// org-owned, read-both/write-own. A control also always belongs to a
// circular the caller can see — enforced in createControl below so an org
// can't attach a control to another org's private circular by guessing its id.

// A control's gap state is per organization: a shared (global) control can't hold
// a per-org flag, so status is derived at read time — COMPLIANCE_GAP when the
// caller's org has an open gap on it, otherwise the stored value (which the gap
// service keeps in sync for org-owned controls).
const EFFECTIVE_STATUS = `(CASE WHEN EXISTS (
    SELECT 1 FROM "ComplianceGap" g
     WHERE g."controlId" = c.id AND g."organizationId" = $1
       AND g.status IN ('OPEN', 'REMEDIATING'))
  THEN 'COMPLIANCE_GAP'::"ControlStatus" ELSE c.status END)`;

function withEffectiveStatus(row: ControlRow & { effectiveStatus: ControlRow["status"] }): ControlRow {
  const { effectiveStatus, ...rest } = row;
  return { ...rest, status: effectiveStatus };
}

export async function listControls(
  organizationId: string,
  filters: { circularId?: string; source?: string; status?: string } = {}
): Promise<ControlRow[]> {
  const conditions = ['(c."organizationId" IS NULL OR c."organizationId" = $1)'];
  const params: unknown[] = [organizationId];
  if (filters.circularId) {
    params.push(filters.circularId);
    conditions.push(`c."circularId" = $${params.length}`);
  }
  if (filters.source) {
    params.push(filters.source);
    conditions.push(`c.source = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`${EFFECTIVE_STATUS} = $${params.length}::"ControlStatus"`);
  }
  const { rows } = await pool.query<ControlRow & { effectiveStatus: ControlRow["status"] }>(
    `SELECT c.*, ${EFFECTIVE_STATUS} AS "effectiveStatus" FROM "Control" c
      WHERE ${conditions.join(" AND ")}
      ORDER BY c."title" ASC`,
    params
  );
  return rows.map(withEffectiveStatus);
}

export async function getControl(organizationId: string, id: string): Promise<ControlRow | null> {
  const { rows } = await pool.query<ControlRow & { effectiveStatus: ControlRow["status"] }>(
    `SELECT c.*, ${EFFECTIVE_STATUS} AS "effectiveStatus" FROM "Control" c
      WHERE c.id = $2 AND (c."organizationId" IS NULL OR c."organizationId" = $1)`,
    [organizationId, id]
  );
  return rows[0] ? withEffectiveStatus(rows[0]) : null;
}

export async function createControl(
  organizationId: string,
  input: CreateControlInput
): Promise<ControlRow> {
  const circular = await getCircular(organizationId, input.circularId);
  if (!circular) throw new Error("Circular not found or not visible to this organization");

  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<ControlRow>(
      `INSERT INTO "Control"
         (id, "organizationId", "circularId", code, source, title, description, relevance,
          category, framework, status, "implementationStatus", "ownerName", answer, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        id,
        organizationId,
        input.circularId,
        input.code ?? null,
        input.source,
        input.title,
        input.description ?? null,
        input.relevance ?? null,
        input.category ?? null,
        input.framework ?? null,
        input.status,
        input.implementationStatus ?? null,
        input.ownerName ?? null,
        input.answer ?? null,
        input.notes ?? null,
      ]
    );
    if (input.obligationIds && input.obligationIds.length > 0) {
      // Only link obligations owned by this org; unknown ids are ignored.
      await client.query(
        `INSERT INTO "ObligationControl" ("obligationId", "controlId", "mappingSource")
         SELECT o.id, $1, $2 FROM "Obligation" o
         WHERE o.id = ANY($3::varchar[]) AND o."organizationId" = $4
         ON CONFLICT DO NOTHING`,
        [id, input.source, input.obligationIds, organizationId]
      );
    }
    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const UPDATABLE_COLUMNS = [
  "code",
  "title",
  "description",
  "relevance",
  "category",
  "framework",
  "status",
  "implementationStatus",
  "ownerName",
  "answer",
  "notes",
] as const;

export async function updateControl(
  organizationId: string,
  id: string,
  input: UpdateControlInput
): Promise<ControlRow | null> {
  const set = buildSet(input, UPDATABLE_COLUMNS, 3);
  if (!set) {
    const { rows } = await pool.query<ControlRow>(
      'SELECT * FROM "Control" WHERE id = $1 AND "organizationId" = $2',
      [id, organizationId]
    );
    return rows[0] ?? null;
  }
  const { rows } = await pool.query<ControlRow>(
    `UPDATE "Control"
       SET ${set.clause}, "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1 AND "organizationId" = $2
     RETURNING *`,
    [id, organizationId, ...set.values]
  );
  return rows[0] ?? null;
}

export async function deleteControl(organizationId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM "Control" WHERE id = $1 AND "organizationId" = $2',
    [id, organizationId]
  );
  return (rowCount ?? 0) > 0;
}

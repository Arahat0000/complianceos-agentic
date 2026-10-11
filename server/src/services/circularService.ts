import { randomUUID } from "node:crypto";
import type { CreateCircularInput, UpdateCircularInput } from "@complianceos/shared";
import { pool } from "../db/pool.js";
import { buildSet } from "../db/sql.js";
import type { CircularRow } from "../db/types.js";

// Circulars are either platform-global (organizationId IS NULL, shipped as
// shared library content) or org-owned (custom or discovered). Orgs can read
// both but only ever mutate their own.

export type CircularWithIndex = CircularRow & { aiIndexComplete: boolean };

function withIndex(row: CircularRow): CircularWithIndex {
  return { ...row, aiIndexComplete: row.indexedAt !== null };
}

const UPDATABLE_COLUMNS = [
  "reference",
  "name",
  "regulator",
  "kind",
  "category",
  "categoryCode",
  "description",
  "body",
  "tags",
  "dateOfIssue",
  "lastUpdated",
  "status",
  "version",
  "link",
  "linkRef",
  "applicableTo",
  "filePath",
  "supersededById",
] as const;

export interface CircularFilters {
  regulator?: string;
  kind?: string;
  status?: string;
}

export async function listCirculars(
  organizationId: string,
  filters: CircularFilters = {}
): Promise<CircularWithIndex[]> {
  const conditions = ['("organizationId" IS NULL OR "organizationId" = $1)'];
  const params: unknown[] = [organizationId];
  for (const key of ["regulator", "kind", "status"] as const) {
    const value = filters[key];
    if (value) {
      params.push(value);
      conditions.push(`"${key}" = $${params.length}`);
    }
  }
  const { rows } = await pool.query<CircularRow>(
    `SELECT * FROM "Circular" WHERE ${conditions.join(" AND ")} ORDER BY "name" ASC`,
    params
  );
  return rows.map(withIndex);
}

export async function getCircular(
  organizationId: string,
  id: string
): Promise<CircularWithIndex | null> {
  const { rows } = await pool.query<CircularRow>(
    'SELECT * FROM "Circular" WHERE id = $1 AND ("organizationId" IS NULL OR "organizationId" = $2)',
    [id, organizationId]
  );
  return rows[0] ? withIndex(rows[0]) : null;
}

export async function createCircular(
  organizationId: string,
  input: CreateCircularInput
): Promise<CircularWithIndex> {
  const id = randomUUID();
  const { rows } = await pool.query<CircularRow>(
    `INSERT INTO "Circular"
       (id, "organizationId", "circularId", reference, name, regulator, kind, category,
        "categoryCode", description, body, tags, "dateOfIssue", "lastUpdated", status,
        version, link, "linkRef", "applicableTo", "filePath", "supersededById")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
             $16, $17, $18, $19, $20, $21)
     RETURNING *`,
    [
      id,
      organizationId,
      input.circularId,
      input.reference ?? null,
      input.name,
      input.regulator,
      input.kind,
      input.category,
      input.categoryCode ?? null,
      input.description ?? null,
      input.body ?? null,
      input.tags ?? null,
      input.dateOfIssue ?? null,
      input.lastUpdated ?? null,
      input.status,
      input.version ?? null,
      input.link ?? null,
      input.linkRef ?? null,
      input.applicableTo ?? null,
      input.filePath ?? null,
      input.supersededById ?? null,
    ]
  );
  return withIndex(rows[0]);
}

export async function updateCircular(
  organizationId: string,
  id: string,
  input: UpdateCircularInput
): Promise<CircularWithIndex | null> {
  const set = buildSet(input, UPDATABLE_COLUMNS, 3);
  if (!set) {
    // Nothing to change: only return the row if the caller may edit it.
    const { rows } = await pool.query<CircularRow>(
      'SELECT * FROM "Circular" WHERE id = $1 AND "organizationId" = $2',
      [id, organizationId]
    );
    return rows[0] ? withIndex(rows[0]) : null;
  }
  // organizationId = $2 (not IS NULL) — only an org's own circulars can be
  // edited, never the platform-global library.
  const { rows } = await pool.query<CircularRow>(
    `UPDATE "Circular"
       SET ${set.clause}, "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1 AND "organizationId" = $2
     RETURNING *`,
    [id, organizationId, ...set.values]
  );
  return rows[0] ? withIndex(rows[0]) : null;
}

// PENDING_REVIEW -> ACTIVE for an org-owned discovered circular.
export async function adoptCircular(
  organizationId: string,
  id: string
): Promise<CircularWithIndex | null> {
  const { rows } = await pool.query<CircularRow>(
    `UPDATE "Circular"
       SET status = 'ACTIVE', "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1 AND "organizationId" = $2 AND status = 'PENDING_REVIEW'
     RETURNING *`,
    [id, organizationId]
  );
  return rows[0] ? withIndex(rows[0]) : null;
}

export async function deleteCircular(organizationId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM "Circular" WHERE id = $1 AND "organizationId" = $2',
    [id, organizationId]
  );
  return (rowCount ?? 0) > 0;
}

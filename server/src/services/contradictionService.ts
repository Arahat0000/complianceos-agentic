import { randomUUID } from "node:crypto";
import type {
  ContradictionPartyInput,
  CreateContradictionInput,
  HarmonizeContradictionInput,
  UpdateContradictionInput,
} from "@complianceos/shared";
import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { buildSet } from "../db/sql.js";
import type {
  ContradictionPartyRow,
  ObligationContradictionRow,
  RegulatoryContradictionRow,
} from "../db/types.js";

// Contradictions are global (organizationId IS NULL, readable by all) or
// org-owned (only mutable by that org). Obligation links are always filtered
// to the caller's own obligations, so a global contradiction only shows the
// caller's obligation ids / harmonized flags.

type ContradictionLink = Pick<
  ObligationContradictionRow,
  "obligationId" | "harmonized" | "harmonizedById" | "harmonizedAt"
>;

export type ContradictionWithRelations = RegulatoryContradictionRow & {
  parties: ContradictionPartyRow[];
  obligationIds: string[];
  obligations: ContradictionLink[];
};

const UPDATABLE_COLUMNS = [
  "domain",
  "severity",
  "title",
  "description",
  "conflictNature",
  "strictestCommonDenominator",
  "operationalRule",
  "automatedControlId",
  "auditDefenseRationale",
] as const;

async function attach(
  organizationId: string,
  rows: RegulatoryContradictionRow[]
): Promise<ContradictionWithRelations[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [parties, links] = await Promise.all([
    pool.query<ContradictionPartyRow>(
      `SELECT * FROM "ContradictionParty" WHERE "contradictionId" = ANY($1::varchar[]) ORDER BY id`,
      [ids]
    ),
    pool.query<ContradictionLink & { contradictionId: string }>(
      `SELECT oc."contradictionId", oc."obligationId", oc.harmonized,
              oc."harmonizedById", oc."harmonizedAt"
         FROM "ObligationContradiction" oc
         JOIN "Obligation" o ON o.id = oc."obligationId"
        WHERE oc."contradictionId" = ANY($1::varchar[]) AND o."organizationId" = $2`,
      [ids, organizationId]
    ),
  ]);
  return rows.map((row) => {
    const obligations = links.rows
      .filter((l) => l.contradictionId === row.id)
      .map(({ obligationId, harmonized, harmonizedById, harmonizedAt }) => ({
        obligationId,
        harmonized,
        harmonizedById,
        harmonizedAt,
      }));
    return {
      ...row,
      parties: parties.rows.filter((p) => p.contradictionId === row.id),
      obligationIds: obligations.map((o) => o.obligationId),
      obligations,
    };
  });
}

export async function listContradictions(
  organizationId: string
): Promise<ContradictionWithRelations[]> {
  const { rows } = await pool.query<RegulatoryContradictionRow>(
    `SELECT * FROM "RegulatoryContradiction"
      WHERE "organizationId" IS NULL OR "organizationId" = $1
      ORDER BY "createdAt" DESC`,
    [organizationId]
  );
  return attach(organizationId, rows);
}

export async function getContradiction(
  organizationId: string,
  id: string
): Promise<ContradictionWithRelations | null> {
  const { rows } = await pool.query<RegulatoryContradictionRow>(
    `SELECT * FROM "RegulatoryContradiction"
      WHERE id = $1 AND ("organizationId" IS NULL OR "organizationId" = $2)`,
    [id, organizationId]
  );
  return (await attach(organizationId, rows))[0] ?? null;
}

async function insertParties(
  client: PoolClient,
  contradictionId: string,
  parties: ContradictionPartyInput[]
): Promise<void> {
  for (const p of parties) {
    await client.query(
      `INSERT INTO "ContradictionParty"
         (id, "contradictionId", "circularId", regulator, "circularTitle", clause,
          requirement, "timelineOrCondition")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        randomUUID(),
        contradictionId,
        p.circularId ?? null,
        p.regulator,
        p.circularTitle ?? null,
        p.clause ?? null,
        p.requirement ?? null,
        p.timelineOrCondition ?? null,
      ]
    );
  }
}

// Links only obligations owned by the org; unknown ids are silently skipped.
async function linkObligations(
  client: PoolClient,
  organizationId: string,
  contradictionId: string,
  obligationIds: string[]
): Promise<void> {
  if (obligationIds.length === 0) return;
  await client.query(
    `INSERT INTO "ObligationContradiction" ("obligationId", "contradictionId")
     SELECT id, $1 FROM "Obligation"
      WHERE id = ANY($2::varchar[]) AND "organizationId" = $3
     ON CONFLICT DO NOTHING`,
    [contradictionId, obligationIds, organizationId]
  );
}

async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function createContradiction(
  organizationId: string,
  input: CreateContradictionInput
): Promise<ContradictionWithRelations> {
  const id = randomUUID();
  await withTx(async (client) => {
    await client.query(
      `INSERT INTO "RegulatoryContradiction"
         (id, "organizationId", domain, severity, title, description, "conflictNature",
          "strictestCommonDenominator", "operationalRule", "automatedControlId",
          "auditDefenseRationale")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        organizationId,
        input.domain ?? null,
        input.severity,
        input.title,
        input.description ?? null,
        input.conflictNature,
        input.strictestCommonDenominator ?? null,
        input.operationalRule ?? null,
        input.automatedControlId ?? null,
        input.auditDefenseRationale ?? null,
      ]
    );
    await insertParties(client, id, input.parties);
    await linkObligations(client, organizationId, id, input.obligationIds);
  });
  return (await getContradiction(organizationId, id))!;
}

// Only org-owned rows are editable. `parties` / `obligationIds`, when present,
// replace the existing sets (harmonized flags of kept obligations survive).
export async function updateContradiction(
  organizationId: string,
  id: string,
  input: UpdateContradictionInput
): Promise<ContradictionWithRelations | null> {
  const found = await withTx(async (client) => {
    const own = await client.query(
      `SELECT 1 FROM "RegulatoryContradiction" WHERE id = $1 AND "organizationId" = $2 FOR UPDATE`,
      [id, organizationId]
    );
    if (own.rowCount === 0) return false;

    const set = buildSet(input, UPDATABLE_COLUMNS, 3);
    if (set) {
      await client.query(
        `UPDATE "RegulatoryContradiction" SET ${set.clause}, "updatedAt" = NOW()
          WHERE id = $1 AND "organizationId" = $2`,
        [id, organizationId, ...set.values]
      );
    } else {
      await client.query(`UPDATE "RegulatoryContradiction" SET "updatedAt" = NOW() WHERE id = $1`, [id]);
    }

    if (input.parties) {
      await client.query(`DELETE FROM "ContradictionParty" WHERE "contradictionId" = $1`, [id]);
      await insertParties(client, id, input.parties);
    }
    if (input.obligationIds) {
      await client.query(
        `DELETE FROM "ObligationContradiction" oc USING "Obligation" o
          WHERE oc."contradictionId" = $1 AND o.id = oc."obligationId"
            AND o."organizationId" = $2 AND NOT (oc."obligationId" = ANY($3::varchar[]))`,
        [id, organizationId, input.obligationIds]
      );
      await linkObligations(client, organizationId, id, input.obligationIds);
    }
    return true;
  });
  return found ? getContradiction(organizationId, id) : null;
}

export async function deleteContradiction(organizationId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM "RegulatoryContradiction" WHERE id = $1 AND "organizationId" = $2`,
    [id, organizationId]
  );
  return (rowCount ?? 0) > 0;
}

// Sets/clears the per-org harmonized flag on an existing obligation link.
// Works on global contradictions too (the flag lives on the org's obligation).
export async function harmonizeContradiction(
  organizationId: string,
  userId: string,
  id: string,
  input: HarmonizeContradictionInput
): Promise<ContradictionWithRelations | null> {
  const { rowCount } = await pool.query(
    `UPDATE "ObligationContradiction" oc
        SET harmonized = $4,
            "harmonizedById" = CASE WHEN $4 THEN $5 ELSE NULL END,
            "harmonizedAt" = CASE WHEN $4 THEN NOW() ELSE NULL END
       FROM "Obligation" o, "RegulatoryContradiction" rc
      WHERE oc."contradictionId" = $1 AND oc."obligationId" = $2
        AND o.id = oc."obligationId" AND o."organizationId" = $3
        AND rc.id = oc."contradictionId"
        AND (rc."organizationId" IS NULL OR rc."organizationId" = $3)`,
    [id, input.obligationId, organizationId, input.harmonized, userId]
  );
  if (!rowCount) return null;
  return getContradiction(organizationId, id);
}

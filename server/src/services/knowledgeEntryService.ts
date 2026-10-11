import { randomUUID } from "node:crypto";
import type {
  CreateKnowledgeEntryInput,
  KnowledgeBaseEntry,
  UpdateKnowledgeEntryInput,
} from "@complianceos/shared";
import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import { buildSet } from "../db/sql.js";
import type { KnowledgeBaseEntryRow } from "../db/types.js";

type EntryRow = KnowledgeBaseEntryRow & { controlIds: string[] | null };

function toEntry(r: EntryRow): KnowledgeBaseEntry {
  return {
    ...r,
    controlIds: r.controlIds ?? [],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const SELECT = `SELECT e.*,
       COALESCE((SELECT array_agg(ck."controlId" ORDER BY ck."controlId")
                   FROM "ControlKnowledgeEntry" ck WHERE ck."entryId" = e.id), '{}') AS "controlIds"
  FROM "KnowledgeBaseEntry" e`;

export async function listKnowledgeEntries(
  organizationId: string,
  filters: { status?: string; q?: string } = {}
): Promise<KnowledgeBaseEntry[]> {
  const conditions = ['e."organizationId" = $1'];
  const params: unknown[] = [organizationId];
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`e.status::text = $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q.replace(/[\\%_]/g, "\\$&")}%`);
    conditions.push(`(e.question ILIKE $${params.length} OR e.answer ILIKE $${params.length})`);
  }
  const { rows } = await pool.query<EntryRow>(
    `${SELECT} WHERE ${conditions.join(" AND ")} ORDER BY e."createdAt" DESC`,
    params
  );
  return rows.map(toEntry);
}

export async function getKnowledgeEntry(
  organizationId: string,
  id: string
): Promise<KnowledgeBaseEntry | null> {
  const { rows } = await pool.query<EntryRow>(
    `${SELECT} WHERE e.id = $1 AND e."organizationId" = $2`,
    [id, organizationId]
  );
  return rows[0] ? toEntry(rows[0]) : null;
}

// Replaces the entry's control links, keeping only controls visible to the org.
async function setControls(
  client: PoolClient,
  organizationId: string,
  entryId: string,
  controlIds: string[]
): Promise<void> {
  await client.query('DELETE FROM "ControlKnowledgeEntry" WHERE "entryId" = $1', [entryId]);
  if (controlIds.length === 0) return;
  await client.query(
    `INSERT INTO "ControlKnowledgeEntry" ("controlId", "entryId")
     SELECT c.id, $1 FROM "Control" c
      WHERE c.id = ANY($2::text[]) AND (c."organizationId" IS NULL OR c."organizationId" = $3)
     ON CONFLICT DO NOTHING`,
    [entryId, controlIds, organizationId]
  );
}

export async function createKnowledgeEntry(
  organizationId: string,
  userId: string,
  input: CreateKnowledgeEntryInput
): Promise<KnowledgeBaseEntry> {
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO "KnowledgeBaseEntry"
         (id, "organizationId", question, answer, "sourceType", "sourceAssessment", tags, status, "createdById")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        organizationId,
        input.question,
        input.answer,
        input.sourceType,
        input.sourceAssessment ?? null,
        input.tags ?? null,
        input.status,
        userId,
      ]
    );
    if (input.controlIds) await setControls(client, organizationId, id, input.controlIds);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return (await getKnowledgeEntry(organizationId, id))!;
}

const UPDATABLE = ["question", "answer", "sourceType", "sourceAssessment", "tags", "status"] as const;

export async function updateKnowledgeEntry(
  organizationId: string,
  id: string,
  input: UpdateKnowledgeEntryInput
): Promise<KnowledgeBaseEntry | null> {
  const existing = await getKnowledgeEntry(organizationId, id);
  if (!existing) return null;

  const set = buildSet(input, UPDATABLE, 3);
  if (!set && input.controlIds === undefined) return existing;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (set) {
      await client.query(
        `UPDATE "KnowledgeBaseEntry" SET ${set.clause}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = $1 AND "organizationId" = $2`,
        [id, organizationId, ...set.values]
      );
    } else {
      await client.query(
        'UPDATE "KnowledgeBaseEntry" SET "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 AND "organizationId" = $2',
        [id, organizationId]
      );
    }
    if (input.controlIds !== undefined) await setControls(client, organizationId, id, input.controlIds);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getKnowledgeEntry(organizationId, id);
}

export async function deleteKnowledgeEntry(
  organizationId: string,
  id: string
): Promise<KnowledgeBaseEntry | null> {
  const existing = await getKnowledgeEntry(organizationId, id);
  if (!existing) return null;
  await pool.query('DELETE FROM "KnowledgeBaseEntry" WHERE id = $1 AND "organizationId" = $2', [
    id,
    organizationId,
  ]);
  return existing;
}

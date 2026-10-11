import { randomUUID } from "node:crypto";
import type { CreateQuestionInput, UpdateQuestionInput } from "@complianceos/shared";
import { pool } from "../db/pool.js";
import type { QuestionRow } from "../db/types.js";
import { buildSet } from "../db/sql.js";

// Questions are global (organizationId IS NULL, readable by all) or org-owned.
// Only the owning org may mutate.

export type QuestionWithControls = QuestionRow & { controlIds: string[] };

const SELECT_WITH_CONTROLS = `
  SELECT q.*,
         COALESCE(
           (SELECT array_agg(cq."controlId" ORDER BY cq."controlId")
              FROM "ControlQuestion" cq
              JOIN "Control" c ON c.id = cq."controlId"
             WHERE cq."questionId" = q.id
               AND (c."organizationId" IS NULL OR c."organizationId" = $1)),
           ARRAY[]::varchar[]
         ) AS "controlIds"
    FROM "Question" q`;

export async function listQuestions(
  organizationId: string,
  filter: { circularId?: string; controlId?: string }
): Promise<QuestionWithControls[]> {
  const params: unknown[] = [organizationId];
  const where = ['(q."organizationId" IS NULL OR q."organizationId" = $1)'];
  if (filter.circularId) {
    params.push(filter.circularId);
    where.push(`q."circularId" = $${params.length}`);
  }
  if (filter.controlId) {
    params.push(filter.controlId);
    where.push(
      `EXISTS (SELECT 1 FROM "ControlQuestion" f WHERE f."questionId" = q.id AND f."controlId" = $${params.length})`
    );
  }
  const { rows } = await pool.query<QuestionWithControls>(
    `${SELECT_WITH_CONTROLS} WHERE ${where.join(" AND ")} ORDER BY q."code" ASC NULLS LAST, q."createdAt" ASC`,
    params
  );
  return rows;
}

export async function getQuestion(
  organizationId: string,
  id: string
): Promise<QuestionWithControls | null> {
  const { rows } = await pool.query<QuestionWithControls>(
    `${SELECT_WITH_CONTROLS} WHERE q.id = $2 AND (q."organizationId" IS NULL OR q."organizationId" = $1)`,
    [organizationId, id]
  );
  return rows[0] ?? null;
}

// Returns null when the circular or any referenced control is not visible.
export async function createQuestion(
  organizationId: string,
  input: CreateQuestionInput
): Promise<QuestionWithControls | null> {
  const controlIds = [...new Set(input.controlIds ?? [])];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const circ = await client.query(
      'SELECT 1 FROM "Circular" WHERE id = $1 AND ("organizationId" IS NULL OR "organizationId" = $2)',
      [input.circularId, organizationId]
    );
    if (circ.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    if (controlIds.length > 0) {
      const ctl = await client.query(
        'SELECT id FROM "Control" WHERE id = ANY($1::varchar[]) AND ("organizationId" IS NULL OR "organizationId" = $2)',
        [controlIds, organizationId]
      );
      if (ctl.rowCount !== controlIds.length) {
        await client.query("ROLLBACK");
        return null;
      }
    }
    const id = randomUUID();
    await client.query(
      `INSERT INTO "Question" (id, "organizationId", "circularId", code, title, description, source, answer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        organizationId,
        input.circularId,
        input.code ?? null,
        input.title,
        input.description ?? null,
        input.source,
        input.answer ?? null,
      ]
    );
    if (controlIds.length > 0) {
      await client.query(
        `INSERT INTO "ControlQuestion" ("controlId", "questionId")
         SELECT unnest($1::varchar[]), $2 ON CONFLICT DO NOTHING`,
        [controlIds, id]
      );
    }
    await client.query("COMMIT");
    return getQuestion(organizationId, id);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

const UPDATABLE = ["code", "title", "description", "answer"] as const;

// Returns null when not found / not owned, or (with controlIds) a control is not visible.
export async function updateQuestion(
  organizationId: string,
  id: string,
  input: UpdateQuestionInput
): Promise<QuestionWithControls | null> {
  const controlIds = input.controlIds ? [...new Set(input.controlIds)] : undefined;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query(
      'SELECT 1 FROM "Question" WHERE id = $1 AND "organizationId" = $2 FOR UPDATE',
      [id, organizationId]
    );
    if (owned.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    if (controlIds && controlIds.length > 0) {
      const ctl = await client.query(
        'SELECT id FROM "Control" WHERE id = ANY($1::varchar[]) AND ("organizationId" IS NULL OR "organizationId" = $2)',
        [controlIds, organizationId]
      );
      if (ctl.rowCount !== controlIds.length) {
        await client.query("ROLLBACK");
        return null;
      }
    }
    const set = buildSet(input, UPDATABLE, 3);
    if (set) {
      await client.query(
        `UPDATE "Question" SET ${set.clause}, "updatedAt" = NOW() WHERE id = $1 AND "organizationId" = $2`,
        [id, organizationId, ...set.values]
      );
    }
    if (controlIds) {
      await client.query('DELETE FROM "ControlQuestion" WHERE "questionId" = $1', [id]);
      if (controlIds.length > 0) {
        await client.query(
          `INSERT INTO "ControlQuestion" ("controlId", "questionId")
           SELECT unnest($1::varchar[]), $2 ON CONFLICT DO NOTHING`,
          [controlIds, id]
        );
      }
    }
    await client.query("COMMIT");
    return getQuestion(organizationId, id);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteQuestion(organizationId: string, id: string): Promise<boolean> {
  const res = await pool.query('DELETE FROM "Question" WHERE id = $1 AND "organizationId" = $2', [
    id,
    organizationId,
  ]);
  return (res.rowCount ?? 0) > 0;
}

import { generateControlAnswer } from "../ai/agents/controlAnswerAgent.js";
import { pool } from "../db/pool.js";
import type { ControlRow } from "../db/types.js";
import { auditAsAi } from "./audit.js";
import { listControls } from "./controlService.js";

// Global controls (organizationId NULL) are read-only for orgs. Decision:
// single-control generation returns the answer transiently for them
// (persisted:false, nothing stored); bulk generation skips them.

export interface GeneratedControlAnswer {
  control: ControlRow;
  persisted: boolean;
}

export async function generateAnswerForControl(
  organizationId: string,
  control: ControlRow
): Promise<GeneratedControlAnswer> {
  const [circular, obligations, evidence, kb] = await Promise.all([
    pool.query<{ name: string; circularId: string }>(
      'SELECT name, "circularId" FROM "Circular" WHERE id = $1',
      [control.circularId]
    ),
    pool.query<{ requirementText: string }>(
      `SELECT o."requirementText" FROM "ObligationControl" oc
         JOIN "Obligation" o ON o.id = oc."obligationId"
        WHERE oc."controlId" = $1 AND o."organizationId" = $2 LIMIT 20`,
      [control.id, organizationId]
    ),
    pool.query<{ name: string; excerpt: string | null }>(
      'SELECT name, excerpt FROM "Evidence" WHERE "controlId" = $1 AND "organizationId" = $2 LIMIT 20',
      [control.id, organizationId]
    ),
    pool.query<{ question: string; answer: string }>(
      `SELECT question, answer FROM "KnowledgeBaseEntry"
        WHERE "organizationId" = $1 AND status = 'APPROVED'
          AND (question ILIKE $2 OR question ILIKE $3)
        LIMIT 5`,
      [
        organizationId,
        `%${control.title.replace(/[%_\\]/g, "")}%`,
        `%${(control.code ?? "\u0000none").replace(/[%_\\]/g, "")}%`,
      ]
    ).catch(() => ({ rows: [] as { question: string; answer: string }[] })),
  ]);

  const answer = await generateControlAnswer(organizationId, control, {
    circularName: circular.rows[0]?.name,
    circularCode: circular.rows[0]?.circularId,
    obligations: obligations.rows.map((r) => r.requirementText),
    evidence: evidence.rows,
    knowledge: kb.rows,
  });

  if (control.organizationId !== organizationId) {
    return { control: { ...control, answer }, persisted: false };
  }
  const { rows } = await pool.query<ControlRow>(
    `UPDATE "Control" SET answer = $3, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1 AND "organizationId" = $2 RETURNING *`,
    [control.id, organizationId, answer]
  );
  await auditAsAi(organizationId, {
    type: "AI",
    action: "Control answer generated",
    detail: control.title,
    objectType: "CONTROL",
    objectId: control.id,
    context: control.code,
  });
  return { control: rows[0], persisted: true };
}

export async function generateAnswersForCircular(
  organizationId: string,
  circularId: string,
  onlyEmpty = false,
  cap = 25
) {
  const all = await listControls(organizationId, { circularId });
  const skipped: string[] = [];
  const todo: ControlRow[] = [];
  for (const c of all) {
    if (c.organizationId !== organizationId || (onlyEmpty && c.answer?.trim())) skipped.push(c.id);
    else todo.push(c);
  }
  const batch = todo.slice(0, cap);
  skipped.push(...todo.slice(cap).map((c) => c.id));
  const controls: ControlRow[] = [];
  let failed = 0;
  for (const c of batch) {
    try {
      controls.push((await generateAnswerForControl(organizationId, c)).control);
    } catch (err) {
      failed++;
      console.error("control answer generation failed:", c.id, err);
    }
  }
  return { generated: controls.length, skipped: skipped.length, failed, controls };
}


import { randomUUID } from "node:crypto";
import type {
  CreateRemediationActionInput,
  GeneratedRemediationPlan,
  UpdateRemediationActionInput,
  UpdateRemediationPlanInput,
} from "@complianceos/shared";
import { pool } from "../db/pool.js";
import { buildSet } from "../db/sql.js";
import type { RemediationActionRow, RemediationPlanRow } from "../db/types.js";

export type RemediationPlanWithActions = RemediationPlanRow & { actions: RemediationActionRow[] };

const PLAN_COLUMNS = ["planText", "workOrderId", "leadTeam", "slaDays", "actionSummary", "status"] as const;
const ACTION_COLUMNS = ["title", "ownerId", "ownerName", "dueDate", "position", "status"] as const;

// A plan is visible only if its gap belongs to the caller's organization.
async function loadPlan(organizationId: string, where: string, param: string) {
  const { rows } = await pool.query<RemediationPlanRow>(
    `SELECT rp.* FROM "RemediationPlan" rp
       JOIN "ComplianceGap" cg ON cg.id = rp."gapId"
      WHERE ${where} AND cg."organizationId" = $2`,
    [param, organizationId]
  );
  const plan = rows[0];
  if (!plan) return null;
  const { rows: actions } = await pool.query<RemediationActionRow>(
    'SELECT * FROM "RemediationAction" WHERE "planId" = $1 ORDER BY "position", id',
    [plan.id]
  );
  return { ...plan, actions } satisfies RemediationPlanWithActions;
}

const getRemediationPlan = (organizationId: string, id: string) =>
  loadPlan(organizationId, "rp.id = $1", id);

export const getRemediationPlanForGap = (organizationId: string, gapId: string) =>
  loadPlan(organizationId, 'rp."gapId" = $1', gapId);

async function assertOwnerInOrg(organizationId: string, ownerId: string): Promise<void> {
  const { rows } = await pool.query(
    'SELECT 1 FROM "Membership" WHERE "userId" = $1 AND "organizationId" = $2',
    [ownerId, organizationId]
  );
  if (rows.length === 0) throw new Error("Owner is not a member of this organization");
}

function dueFromDays(days: number | undefined): Date | null {
  if (days === undefined) return null;
  return new Date(Date.now() + days * 86_400_000);
}

// Upserts the (unique-per-gap) plan and replaces its actions atomically.
// The caller must already have verified the gap belongs to the organization.
export async function savePlanForGap(
  organizationId: string,
  gapId: string,
  generated: GeneratedRemediationPlan,
  model: string | null = null
): Promise<RemediationPlanWithActions> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO "RemediationPlan"
         (id, "gapId", "planText", "generatedBy", model, "leadTeam", "slaDays", "actionSummary")
       VALUES ($1, $2, $3, 'AI', $4, $5, $6, $7)
       ON CONFLICT ("gapId") DO UPDATE SET
         "planText" = EXCLUDED."planText",
         "generatedBy" = 'AI',
         model = EXCLUDED.model,
         "leadTeam" = EXCLUDED."leadTeam",
         "slaDays" = EXCLUDED."slaDays",
         "actionSummary" = EXCLUDED."actionSummary",
         status = 'PENDING_APPROVAL',
         "approvedById" = NULL,
         "approvedAt" = NULL,
         "updatedAt" = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        randomUUID(),
        gapId,
        generated.planText,
        model,
        generated.leadTeam ?? null,
        generated.slaDays ?? null,
        generated.actionSummary ?? null,
      ]
    );
    const planId = rows[0].id;
    await client.query('DELETE FROM "RemediationAction" WHERE "planId" = $1', [planId]);
    for (const [position, action] of generated.actions.entries()) {
      await client.query(
        `INSERT INTO "RemediationAction" (id, "planId", "position", title, "ownerName", "dueDate")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), planId, position, action.title, action.ownerName ?? null, dueFromDays(action.dueInDays)]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  const plan = await getRemediationPlanForGap(organizationId, gapId);
  if (!plan) throw new Error("Failed to load remediation plan after save");
  return plan;
}

export async function updateRemediationPlan(
  organizationId: string,
  id: string,
  input: UpdateRemediationPlanInput,
  userId: string
): Promise<RemediationPlanWithActions | null> {
  const current = await getRemediationPlan(organizationId, id);
  if (!current) return null;

  const set = buildSet(input, PLAN_COLUMNS, 2);
  if (!set) return current;
  let clause = set.clause;
  const values = [...set.values];
  // Moving out of PENDING_APPROVAL is an approval.
  if (input.status && input.status !== "PENDING_APPROVAL" && current.status === "PENDING_APPROVAL") {
    values.push(userId);
    clause += `, "approvedById" = $${values.length + 1}, "approvedAt" = CURRENT_TIMESTAMP`;
  }
  await pool.query(
    `UPDATE "RemediationPlan" SET ${clause}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
    [id, ...values]
  );
  return getRemediationPlan(organizationId, id);
}

export async function approveRemediationPlan(
  organizationId: string,
  id: string,
  userId: string
): Promise<RemediationPlanWithActions | null> {
  const current = await getRemediationPlan(organizationId, id);
  if (!current) return null;
  await pool.query(
    `UPDATE "RemediationPlan"
        SET status = 'EXECUTING', "approvedById" = $2, "approvedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1`,
    [id, userId]
  );
  return getRemediationPlan(organizationId, id);
}

// Returns null when the plan isn't visible to the organization.
export async function addRemediationAction(
  organizationId: string,
  planId: string,
  input: CreateRemediationActionInput
): Promise<RemediationActionRow | null> {
  const plan = await getRemediationPlan(organizationId, planId);
  if (!plan) return null;
  if (input.ownerId) await assertOwnerInOrg(organizationId, input.ownerId);
  const position = input.position ?? plan.actions.reduce((max, a) => Math.max(max, a.position + 1), 0);
  const { rows } = await pool.query<RemediationActionRow>(
    `INSERT INTO "RemediationAction" (id, "planId", "position", title, "ownerId", "ownerName", "dueDate")
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [randomUUID(), planId, position, input.title, input.ownerId ?? null, input.ownerName ?? null, input.dueDate ?? null]
  );
  return rows[0];
}

export async function updateRemediationAction(
  organizationId: string,
  planId: string,
  actionId: string,
  input: UpdateRemediationActionInput
): Promise<RemediationActionRow | null> {
  const plan = await getRemediationPlan(organizationId, planId);
  const existing = plan?.actions.find((a) => a.id === actionId);
  if (!plan || !existing) return null;
  if (input.ownerId) await assertOwnerInOrg(organizationId, input.ownerId);

  const set = buildSet(input, ACTION_COLUMNS, 3);
  if (!set) return existing;
  let clause = set.clause;
  if (input.status === "DONE" && existing.status !== "DONE") clause += ', "completedAt" = CURRENT_TIMESTAMP';
  else if (input.status && input.status !== "DONE") clause += ', "completedAt" = NULL';
  const { rows } = await pool.query<RemediationActionRow>(
    `UPDATE "RemediationAction" SET ${clause} WHERE id = $1 AND "planId" = $2 RETURNING *`,
    [actionId, planId, ...set.values]
  );
  return rows[0] ?? null;
}

export async function deleteRemediationAction(
  organizationId: string,
  planId: string,
  actionId: string
): Promise<boolean> {
  const plan = await getRemediationPlan(organizationId, planId);
  if (!plan) return false;
  const { rowCount } = await pool.query(
    'DELETE FROM "RemediationAction" WHERE id = $1 AND "planId" = $2',
    [actionId, planId]
  );
  return (rowCount ?? 0) > 0;
}

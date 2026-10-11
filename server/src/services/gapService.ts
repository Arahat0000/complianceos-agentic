import { randomUUID } from "node:crypto";
import type { CreateComplianceGapInput, UpdateComplianceGapInput } from "@complianceos/shared";
import { pool } from "../db/pool.js";
import { buildSet } from "../db/sql.js";
import type { ComplianceGapWithRelations } from "../db/types.js";

export type { ComplianceGapWithRelations };

const SELECT_WITH_RELATIONS = `
  SELECT cg.*, u.name AS "assigneeName"
    FROM "ComplianceGap" cg
    LEFT JOIN "User" u ON u.id = cg."assigneeId"
`;

const UPDATE_COLUMNS = [
  "title",
  "description",
  "riskLevel",
  "status",
  "obligationId",
  "controlId",
  "questionId",
  "assigneeId",
  "engagementName",
  "section",
  "evidenceNeeded",
  "dueDate",
  "riskAcceptedReason",
  "riskAcceptanceExpiresAt",
] as const;

// Thrown for caller mistakes that should surface as HTTP 400.
export class GapValidationError extends Error {}

// Thrown when an open gap already exists for the same control (+ obligation);
// surfaces as HTTP 409 with the existing gap so the client can link to it.
export class GapConflictError extends Error {
  constructor(message: string, readonly existing: ComplianceGapWithRelations) {
    super(message);
  }
}

// Keeps Control.status in step with its gaps: an org-owned control is
// COMPLIANCE_GAP while any of the org's gaps on it is open/remediating,
// otherwise ACTIVE. Global controls are never written (their status is
// derived per org on read — see controlService).
async function syncControlStatus(organizationId: string, controlId: string | null): Promise<void> {
  if (!controlId) return;
  await pool.query(
    `UPDATE "Control" c
        SET status = (CASE WHEN EXISTS (
              SELECT 1 FROM "ComplianceGap" g
               WHERE g."controlId" = c.id AND g."organizationId" = $2
                 AND g.status IN ('OPEN', 'REMEDIATING'))
            THEN 'COMPLIANCE_GAP' ELSE 'ACTIVE' END)::"ControlStatus",
            "updatedAt" = CURRENT_TIMESTAMP
      WHERE c.id = $1 AND c."organizationId" = $2`,
    [controlId, organizationId]
  );
}

async function findOpenGap(
  organizationId: string,
  controlId: string,
  obligationId: string | null
): Promise<ComplianceGapWithRelations | null> {
  const { rows } = await pool.query<ComplianceGapWithRelations>(
    `${SELECT_WITH_RELATIONS}
      WHERE cg."organizationId" = $1 AND cg."controlId" = $2
        AND COALESCE(cg."obligationId", '') = COALESCE($3, '')
        AND cg.status IN ('OPEN', 'REMEDIATING')
      LIMIT 1`,
    [organizationId, controlId, obligationId]
  );
  return rows[0] ?? null;
}

export async function listComplianceGaps(
  organizationId: string,
  filters: { status?: string; riskLevel?: string } = {}
): Promise<ComplianceGapWithRelations[]> {
  const conditions = ['cg."organizationId" = $1'];
  const params: unknown[] = [organizationId];
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`cg.status = $${params.length}`);
  }
  if (filters.riskLevel) {
    params.push(filters.riskLevel);
    conditions.push(`cg."riskLevel" = $${params.length}`);
  }
  const { rows } = await pool.query<ComplianceGapWithRelations>(
    `${SELECT_WITH_RELATIONS} WHERE ${conditions.join(" AND ")} ORDER BY cg."createdAt" DESC`,
    params
  );
  return rows;
}

export async function getComplianceGap(
  organizationId: string,
  id: string
): Promise<ComplianceGapWithRelations | null> {
  const { rows } = await pool.query<ComplianceGapWithRelations>(
    `${SELECT_WITH_RELATIONS} WHERE cg.id = $1 AND cg."organizationId" = $2`,
    [id, organizationId]
  );
  return rows[0] ?? null;
}

// Obligations are always org-owned; Controls and Questions may be global
// (organizationId NULL) or owned by the caller's org.
async function assertLinksVisible(
  organizationId: string,
  links: { obligationId?: string | null; controlId?: string | null; questionId?: string | null }
): Promise<void> {
  if (links.obligationId) {
    const { rows } = await pool.query('SELECT 1 FROM "Obligation" WHERE id = $1 AND "organizationId" = $2', [
      links.obligationId,
      organizationId,
    ]);
    if (rows.length === 0) throw new GapValidationError("Obligation not found or not visible to this organization");
  }
  for (const [table, id, label] of [
    ["Control", links.controlId, "Control"],
    ["Question", links.questionId, "Question"],
  ] as const) {
    if (!id) continue;
    const { rows } = await pool.query(
      `SELECT 1 FROM "${table}" WHERE id = $1 AND ("organizationId" IS NULL OR "organizationId" = $2)`,
      [id, organizationId]
    );
    if (rows.length === 0) throw new GapValidationError(`${label} not found or not visible to this organization`);
  }
}

// assigneeId must be a real member of the caller's org — otherwise an org
// could assign a gap to an arbitrary user id from any tenant.
async function assertAssigneeInOrg(organizationId: string, assigneeId: string): Promise<void> {
  const { rows } = await pool.query(
    'SELECT 1 FROM "Membership" WHERE "userId" = $1 AND "organizationId" = $2',
    [assigneeId, organizationId]
  );
  if (rows.length === 0) {
    throw new GapValidationError("Assignee is not a member of this organization");
  }
}

export async function createComplianceGap(
  organizationId: string,
  input: CreateComplianceGapInput
): Promise<ComplianceGapWithRelations> {
  await assertLinksVisible(organizationId, input);
  if (input.assigneeId) await assertAssigneeInOrg(organizationId, input.assigneeId);

  if (input.controlId) {
    const existing = await findOpenGap(organizationId, input.controlId, input.obligationId ?? null);
    if (existing) throw new GapConflictError("An open gap already exists for this control", existing);
  }

  const id = randomUUID();
  await pool.query(
    `INSERT INTO "ComplianceGap"
       (id, identifier, "organizationId", "obligationId", "controlId", "questionId", title,
        description, "riskLevel", "assigneeId", "engagementName", section, "evidenceNeeded", "dueDate")
     VALUES ($1, 'GAP-' || lpad(nextval('compliance_gap_identifier_seq')::text, 5, '0'),
             $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      organizationId,
      input.obligationId ?? null,
      input.controlId ?? null,
      input.questionId ?? null,
      input.title,
      input.description ?? null,
      input.riskLevel,
      input.assigneeId ?? null,
      input.engagementName ?? null,
      input.section ?? null,
      input.evidenceNeeded ?? null,
      input.dueDate ?? null,
    ]
  );
  await syncControlStatus(organizationId, input.controlId ?? null);
  const created = await getComplianceGap(organizationId, id);
  if (!created) throw new Error("Failed to load compliance gap after creation");
  return created;
}

export interface GapUpdateResult {
  gap: ComplianceGapWithRelations;
  previousStatus: string;
}

export async function updateComplianceGap(
  organizationId: string,
  id: string,
  input: UpdateComplianceGapInput,
  userId: string
): Promise<GapUpdateResult | null> {
  const existing = await getComplianceGap(organizationId, id);
  if (!existing) return null;

  await assertLinksVisible(organizationId, input);
  if (input.assigneeId) await assertAssigneeInOrg(organizationId, input.assigneeId);

  const set = buildSet(input, UPDATE_COLUMNS, 3);
  if (!set) return { gap: existing, previousStatus: existing.status };
  let clause = set.clause;
  const values = [...set.values];

  if (input.status && input.status !== existing.status) {
    if (input.status === "RESOLVED") clause += ', "resolvedAt" = CURRENT_TIMESTAMP';
    else if (existing.status === "RESOLVED") clause += ', "resolvedAt" = NULL';

    if (input.status === "RISK_ACCEPTED") {
      // A reason is recorded when supplied (the Gaps UI does not collect one yet).
      values.push(userId);
      clause += `, "riskAcceptedById" = $${values.length + 2}, "riskAcceptedAt" = CURRENT_TIMESTAMP`;
    } else if (existing.status === "RISK_ACCEPTED") {
      clause += ', "riskAcceptedById" = NULL, "riskAcceptedAt" = NULL';
    }
  }

  await pool.query(
    `UPDATE "ComplianceGap" SET ${clause}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $1 AND "organizationId" = $2`,
    [id, organizationId, ...values]
  );
  const gap = await getComplianceGap(organizationId, id);
  await syncControlStatus(organizationId, existing.controlId);
  if (gap && gap.controlId !== existing.controlId) await syncControlStatus(organizationId, gap.controlId);
  return gap ? { gap, previousStatus: existing.status } : null;
}

export async function deleteComplianceGap(organizationId: string, id: string): Promise<boolean> {
  const { rows } = await pool.query<{ controlId: string | null }>(
    'DELETE FROM "ComplianceGap" WHERE id = $1 AND "organizationId" = $2 RETURNING "controlId"',
    [id, organizationId]
  );
  if (rows.length > 0) await syncControlStatus(organizationId, rows[0].controlId);
  return rows.length > 0;
}

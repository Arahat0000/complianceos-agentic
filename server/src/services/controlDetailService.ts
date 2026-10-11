import { randomUUID } from "node:crypto";
import type {
  CreateControlTestInput,
  CreateEvidenceInput,
  CreateMonitoringKpiInput,
  RecordTestRunInput,
  UpdateEvidenceInput,
  UpdateMonitoringKpiInput,
} from "@complianceos/shared";
import { pool } from "../db/pool.js";
import { buildSet } from "../db/sql.js";
import type {
  ControlTestRow,
  ControlTestRunRow,
  EvidenceRow,
  MonitoringKpiRow,
  QuestionRow,
} from "../db/types.js";

// Reads on a control's children need the control to be visible (global or own).
// Writes need the control to belong to the caller's org (global = read-only).

async function controlVisible(orgId: string, controlId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM "Control" WHERE id = $1 AND ("organizationId" IS NULL OR "organizationId" = $2)',
    [controlId, orgId]
  );
  return (rowCount ?? 0) > 0;
}

async function controlWritable(orgId: string, controlId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM "Control" WHERE id = $1 AND "organizationId" = $2',
    [controlId, orgId]
  );
  return (rowCount ?? 0) > 0;
}

// ---- Questions ---------------------------------------------------------

// null => control not visible
export async function listControlQuestions(
  orgId: string,
  controlId: string
): Promise<QuestionRow[] | null> {
  if (!(await controlVisible(orgId, controlId))) return null;
  const { rows } = await pool.query<QuestionRow>(
    `SELECT q.* FROM "Question" q
       JOIN "ControlQuestion" cq ON cq."questionId" = q.id
      WHERE cq."controlId" = $1 AND (q."organizationId" IS NULL OR q."organizationId" = $2)
      ORDER BY q."code" ASC NULLS LAST, q."createdAt" ASC`,
    [controlId, orgId]
  );
  return rows;
}

// null => control not writable or question not visible
export async function linkControlQuestion(
  orgId: string,
  controlId: string,
  questionId: string
): Promise<QuestionRow | null> {
  if (!(await controlWritable(orgId, controlId))) return null;
  const q = await pool.query<QuestionRow>(
    'SELECT * FROM "Question" WHERE id = $1 AND ("organizationId" IS NULL OR "organizationId" = $2)',
    [questionId, orgId]
  );
  if (!q.rows[0]) return null;
  await pool.query(
    'INSERT INTO "ControlQuestion" ("controlId", "questionId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [controlId, questionId]
  );
  return q.rows[0];
}

export async function unlinkControlQuestion(
  orgId: string,
  controlId: string,
  questionId: string
): Promise<boolean> {
  if (!(await controlWritable(orgId, controlId))) return false;
  const res = await pool.query(
    'DELETE FROM "ControlQuestion" WHERE "controlId" = $1 AND "questionId" = $2',
    [controlId, questionId]
  );
  return (res.rowCount ?? 0) > 0;
}

// ---- Evidence ----------------------------------------------------------

export async function listEvidence(orgId: string, controlId: string): Promise<EvidenceRow[] | null> {
  if (!(await controlVisible(orgId, controlId))) return null;
  const { rows } = await pool.query<EvidenceRow>(
    'SELECT * FROM "Evidence" WHERE "controlId" = $1 AND "organizationId" = $2 ORDER BY "createdAt" DESC',
    [controlId, orgId]
  );
  return rows;
}

async function documentInOrg(orgId: string, documentId: string): Promise<boolean> {
  const { rowCount } = await pool.query('SELECT 1 FROM "Document" WHERE id = $1 AND "organizationId" = $2', [
    documentId,
    orgId,
  ]);
  return (rowCount ?? 0) > 0;
}

// Evidence is org-scoped, so any control visible to the org may receive it.
// null => control not visible or document not in org.
export async function createEvidence(
  orgId: string,
  controlId: string,
  input: CreateEvidenceInput
): Promise<EvidenceRow | null> {
  if (!(await controlVisible(orgId, controlId))) return null;
  if (input.documentId && !(await documentInOrg(orgId, input.documentId))) return null;
  const { rows } = await pool.query<EvidenceRow>(
    `INSERT INTO "Evidence"
       (id, "organizationId", "controlId", "documentId", name, "documentType", section,
        excerpt, size, "fileUrl", status, "lastAuditDate")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      randomUUID(),
      orgId,
      controlId,
      input.documentId ?? null,
      input.name,
      input.documentType ?? null,
      input.section ?? null,
      input.excerpt ?? null,
      input.size ?? null,
      input.fileUrl ?? null,
      input.status,
      input.lastAuditDate ?? null,
    ]
  );
  return rows[0];
}

const EVIDENCE_COLUMNS = [
  "documentId",
  "name",
  "documentType",
  "section",
  "excerpt",
  "size",
  "fileUrl",
  "status",
  "lastAuditDate",
] as const;

export async function updateEvidence(
  orgId: string,
  id: string,
  input: UpdateEvidenceInput
): Promise<EvidenceRow | null> {
  if (input.documentId && !(await documentInOrg(orgId, input.documentId))) return null;
  const set = buildSet(input, EVIDENCE_COLUMNS, 3);
  if (!set) {
    const { rows } = await pool.query<EvidenceRow>(
      'SELECT * FROM "Evidence" WHERE id = $1 AND "organizationId" = $2',
      [id, orgId]
    );
    return rows[0] ?? null;
  }
  const { rows } = await pool.query<EvidenceRow>(
    `UPDATE "Evidence" SET ${set.clause}, "updatedAt" = NOW()
      WHERE id = $1 AND "organizationId" = $2 RETURNING *`,
    [id, orgId, ...set.values]
  );
  return rows[0] ?? null;
}

export async function deleteEvidence(orgId: string, id: string): Promise<EvidenceRow | null> {
  const { rows } = await pool.query<EvidenceRow>(
    'DELETE FROM "Evidence" WHERE id = $1 AND "organizationId" = $2 RETURNING *',
    [id, orgId]
  );
  return rows[0] ?? null;
}

// ---- Tests -------------------------------------------------------------

export type ControlTestWithLast = ControlTestRow & {
  lastTestedAt: Date | null;
  lastResult: ControlTestRunRow["result"] | null;
};

const TEST_SELECT = `
  SELECT t.*, lr."testedAt" AS "lastTestedAt", lr.result AS "lastResult"
    FROM "ControlTest" t
    LEFT JOIN LATERAL (
      SELECT r."testedAt", r.result FROM "ControlTestRun" r
       WHERE r."testId" = t.id ORDER BY r."testedAt" DESC LIMIT 1
    ) lr ON TRUE`;

export async function listTests(
  orgId: string,
  controlId: string
): Promise<ControlTestWithLast[] | null> {
  if (!(await controlVisible(orgId, controlId))) return null;
  const { rows } = await pool.query<ControlTestWithLast>(
    `${TEST_SELECT} WHERE t."controlId" = $1 ORDER BY t."createdAt" ASC`,
    [controlId]
  );
  return rows;
}

export async function createTest(
  orgId: string,
  controlId: string,
  input: CreateControlTestInput
): Promise<ControlTestWithLast | null> {
  if (!(await controlWritable(orgId, controlId))) return null;
  const id = randomUUID();
  await pool.query(
    'INSERT INTO "ControlTest" (id, "controlId", "testType", frequency) VALUES ($1,$2,$3,$4)',
    [id, controlId, input.testType, input.frequency ?? null]
  );
  const { rows } = await pool.query<ControlTestWithLast>(`${TEST_SELECT} WHERE t.id = $1`, [id]);
  return rows[0] ?? null;
}

// Test visible to org via its parent control; writable only if control is org-owned.
async function testControl(
  orgId: string,
  testId: string
): Promise<{ controlId: string; writable: boolean } | null> {
  const { rows } = await pool.query<{ controlId: string; organizationId: string | null }>(
    `SELECT t."controlId", c."organizationId" FROM "ControlTest" t
       JOIN "Control" c ON c.id = t."controlId"
      WHERE t.id = $1 AND (c."organizationId" IS NULL OR c."organizationId" = $2)`,
    [testId, orgId]
  );
  if (!rows[0]) return null;
  return { controlId: rows[0].controlId, writable: rows[0].organizationId === orgId };
}

export async function listTestRuns(orgId: string, testId: string): Promise<ControlTestRunRow[] | null> {
  if (!(await testControl(orgId, testId))) return null;
  const { rows } = await pool.query<ControlTestRunRow>(
    'SELECT * FROM "ControlTestRun" WHERE "testId" = $1 ORDER BY "testedAt" DESC',
    [testId]
  );
  return rows;
}

export async function recordTestRun(
  orgId: string,
  testId: string,
  input: RecordTestRunInput
): Promise<ControlTestRunRow | null> {
  const t = await testControl(orgId, testId);
  if (!t?.writable) return null;
  const { rows } = await pool.query<ControlTestRunRow>(
    `INSERT INTO "ControlTestRun" (id, "testId", "testedAt", result, notes, "testedByName")
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [randomUUID(), testId, input.testedAt, input.result, input.notes ?? null, input.testedByName ?? null]
  );
  return rows[0];
}

export async function deleteTest(orgId: string, testId: string): Promise<ControlTestRow | null> {
  const { rows } = await pool.query<ControlTestRow>(
    `DELETE FROM "ControlTest" t USING "Control" c
      WHERE t.id = $1 AND c.id = t."controlId" AND c."organizationId" = $2
      RETURNING t.*`,
    [testId, orgId]
  );
  return rows[0] ?? null;
}

// ---- KPIs --------------------------------------------------------------

export async function listKpis(orgId: string, controlId: string): Promise<MonitoringKpiRow[] | null> {
  if (!(await controlVisible(orgId, controlId))) return null;
  const { rows } = await pool.query<MonitoringKpiRow>(
    'SELECT * FROM "MonitoringKpi" WHERE "controlId" = $1 ORDER BY kpi ASC',
    [controlId]
  );
  return rows;
}

export async function createKpi(
  orgId: string,
  controlId: string,
  input: CreateMonitoringKpiInput
): Promise<MonitoringKpiRow | null> {
  if (!(await controlWritable(orgId, controlId))) return null;
  const { rows } = await pool.query<MonitoringKpiRow>(
    `INSERT INTO "MonitoringKpi" (id, "controlId", kpi, threshold, "currentValue", health, "telemetrySource")
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      randomUUID(),
      controlId,
      input.kpi,
      input.threshold ?? null,
      input.currentValue ?? null,
      input.health,
      input.telemetrySource ?? null,
    ]
  );
  return rows[0];
}

const KPI_COLUMNS = ["kpi", "threshold", "currentValue", "health", "telemetrySource"] as const;

export async function updateKpi(
  orgId: string,
  id: string,
  input: UpdateMonitoringKpiInput
): Promise<MonitoringKpiRow | null> {
  const set = buildSet(input, KPI_COLUMNS, 3);
  const clause = set ? `${set.clause}, "updatedAt" = NOW()` : '"updatedAt" = NOW()';
  const { rows } = await pool.query<MonitoringKpiRow>(
    `UPDATE "MonitoringKpi" k SET ${clause}
       FROM "Control" c
      WHERE k.id = $1 AND c.id = k."controlId" AND c."organizationId" = $2
      RETURNING k.*`,
    [id, orgId, ...(set?.values ?? [])]
  );
  return rows[0] ?? null;
}

export async function deleteKpi(orgId: string, id: string): Promise<MonitoringKpiRow | null> {
  const { rows } = await pool.query<MonitoringKpiRow>(
    `DELETE FROM "MonitoringKpi" k USING "Control" c
      WHERE k.id = $1 AND c.id = k."controlId" AND c."organizationId" = $2
      RETURNING k.*`,
    [id, orgId]
  );
  return rows[0] ?? null;
}

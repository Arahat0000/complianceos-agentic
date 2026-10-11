import { createHash, randomUUID } from "node:crypto";
import type { SignoffInput, TraceabilityLink } from "@complianceos/shared";
import { pool } from "../db/pool.js";
import type {
  EvidenceRow,
  MonitoringKpiRow,
  TraceabilitySignoffRow,
} from "../db/types.js";

// Traceability = one row per obligation -> control chain (the "TraceabilityLink"
// view), enriched with the one-to-many evidence, tests and KPIs of the control
// and the latest CCO sign-off. Enrichment uses one batched query per table.

interface TraceabilityTest {
  id: string;
  controlId: string;
  testType: string;
  frequency: string | null;
  lastTestedAt: Date | null;
  lastResult: string | null;
  lastNotes: string | null;
  lastTestedByName: string | null;
}

export type TraceabilityChain = TraceabilityLink & {
  evidence: EvidenceRow[];
  tests: TraceabilityTest[];
  kpis: MonitoringKpiRow[];
  latestSignoff: TraceabilitySignoffRow | null;
};

export interface TraceabilityFilters {
  regulator?: string;
  gapOnly?: boolean;
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

async function enrich(
  organizationId: string,
  links: TraceabilityLink[]
): Promise<TraceabilityChain[]> {
  if (links.length === 0) return [];
  const controlIds = [...new Set(links.map((l) => l.controlId))];
  const obligationIds = [...new Set(links.map((l) => l.obligationId))];

  const [evidence, tests, kpis, signoffs] = await Promise.all([
    pool.query<EvidenceRow>(
      `SELECT * FROM "Evidence"
        WHERE "organizationId" = $1 AND "controlId" = ANY($2::varchar[])
        ORDER BY "createdAt" ASC`,
      [organizationId, controlIds]
    ),
    pool.query<TraceabilityTest>(
      `SELECT t.id, t."controlId", t."testType", t.frequency,
              r."testedAt" AS "lastTestedAt", r.result AS "lastResult",
              r.notes AS "lastNotes", r."testedByName" AS "lastTestedByName"
         FROM "ControlTest" t
         LEFT JOIN LATERAL (
           SELECT * FROM "ControlTestRun" WHERE "testId" = t.id
            ORDER BY "testedAt" DESC LIMIT 1
         ) r ON TRUE
        WHERE t."controlId" = ANY($1::varchar[])
        ORDER BY t."createdAt" ASC`,
      [controlIds]
    ),
    pool.query<MonitoringKpiRow>(
      `SELECT * FROM "MonitoringKpi" WHERE "controlId" = ANY($1::varchar[]) ORDER BY kpi ASC`,
      [controlIds]
    ),
    pool.query<TraceabilitySignoffRow>(
      `SELECT DISTINCT ON ("obligationId", "controlId") *
         FROM "TraceabilitySignoff"
        WHERE "organizationId" = $1 AND "obligationId" = ANY($2::varchar[])
        ORDER BY "obligationId", "controlId", "signedAt" DESC`,
      [organizationId, obligationIds]
    ),
  ]);

  const evByControl = groupBy(evidence.rows, (e) => e.controlId);
  const testsByControl = groupBy(tests.rows, (t) => t.controlId);
  const kpisByControl = groupBy(kpis.rows, (k) => k.controlId);
  const signoffByChain = new Map(
    signoffs.rows.map((s) => [`${s.obligationId}|${s.controlId}`, s])
  );

  return links.map((link) => ({
    ...link,
    evidence: evByControl.get(link.controlId) ?? [],
    tests: testsByControl.get(link.controlId) ?? [],
    kpis: kpisByControl.get(link.controlId) ?? [],
    latestSignoff: signoffByChain.get(`${link.obligationId}|${link.controlId}`) ?? null,
  }));
}

export async function listTraceability(
  organizationId: string,
  filters: TraceabilityFilters = {}
): Promise<TraceabilityChain[]> {
  const conditions = ['"organizationId" = $1'];
  const params: unknown[] = [organizationId];
  if (filters.regulator) {
    params.push(filters.regulator);
    conditions.push(`"regulator" = $${params.length}`);
  }
  if (filters.gapOnly) conditions.push(`"isCompliant" = FALSE`);
  const { rows } = await pool.query<TraceabilityLink>(
    `SELECT * FROM "TraceabilityLink" WHERE ${conditions.join(" AND ")}
      ORDER BY "obligationIdentifier" ASC NULLS LAST, "controlTitle" ASC`,
    params
  );
  return enrich(organizationId, rows);
}

async function getLink(
  organizationId: string,
  obligationId: string,
  controlId: string
): Promise<TraceabilityLink | null> {
  const { rows } = await pool.query<TraceabilityLink>(
    `SELECT * FROM "TraceabilityLink"
      WHERE "organizationId" = $1 AND "obligationId" = $2 AND "controlId" = $3`,
    [organizationId, obligationId, controlId]
  );
  return rows[0] ?? null;
}

export async function getTraceabilityChain(
  organizationId: string,
  obligationId: string,
  controlId: string
): Promise<TraceabilityChain | null> {
  const link = await getLink(organizationId, obligationId, controlId);
  if (!link) return null;
  return (await enrich(organizationId, [link]))[0];
}

// JSON.stringify with recursively sorted keys so the hash is reproducible.
function stableStringify(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Content hash of a chain (sha256 over stable JSON). Hashed fields ONLY:
 *  - link: obligationId, controlId, requirementText, obligationType, deadline,
 *    penalty, applicabilityStatus, controlTitle, implementationStatus, gapId,
 *    gapStatus, gapRiskLevel, remediationStatus, workOrderId, isCompliant
 *  - evidence[]: id, status, fileUrl
 *  - tests[]: id, testType, lastResult
 *  - kpis[]: id, kpi, threshold, health
 * Timestamps, updatedAt and free-text churn (notes, current values) are excluded
 * so unrelated writes do not invalidate a sign-off.
 */
function computeChainHash(chain: TraceabilityChain): string {
  const l = chain;
  const payload = {
    link: {
      obligationId: l.obligationId,
      controlId: l.controlId,
      requirementText: l.requirementText,
      obligationType: l.obligationType,
      deadline: l.deadline,
      penalty: l.penalty,
      applicabilityStatus: l.applicabilityStatus,
      controlTitle: l.controlTitle,
      implementationStatus: l.implementationStatus,
      gapId: l.gapId,
      gapStatus: l.gapStatus,
      gapRiskLevel: l.gapRiskLevel,
      remediationStatus: l.remediationStatus,
      workOrderId: l.workOrderId,
      isCompliant: l.isCompliant,
    },
    evidence: l.evidence
      .map((e) => ({ id: e.id, status: e.status, fileUrl: e.fileUrl ?? null }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    tests: l.tests
      .map((t) => ({ id: t.id, testType: t.testType, lastResult: t.lastResult }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    kpis: l.kpis
      .map((k) => ({ id: k.id, kpi: k.kpi, threshold: k.threshold ?? null, health: k.health }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export async function signoffChain(
  organizationId: string,
  userId: string,
  obligationId: string,
  controlId: string,
  input: SignoffInput
): Promise<{ signoff: TraceabilitySignoffRow; link: TraceabilityLink } | null> {
  const chain = await getTraceabilityChain(organizationId, obligationId, controlId);
  if (!chain) return null;
  const contentHash = computeChainHash(chain);
  const { rows } = await pool.query<TraceabilitySignoffRow>(
    `INSERT INTO "TraceabilitySignoff"
       (id, "organizationId", "obligationId", "controlId", "signedById", "signedRole", "contentHash")
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [randomUUID(), organizationId, obligationId, controlId, userId, input.signedRole, contentHash]
  );
  return { signoff: rows[0], link: chain };
}

export interface VerifyResult {
  signed: boolean;
  verified: boolean;
  signedAt: Date | null;
  signedRole: string | null;
  signedByName: string | null;
  storedHash: string | null;
  currentHash: string;
}

export async function verifyChain(
  organizationId: string,
  obligationId: string,
  controlId: string
): Promise<VerifyResult | null> {
  const chain = await getTraceabilityChain(organizationId, obligationId, controlId);
  if (!chain) return null;
  const currentHash = computeChainHash(chain);
  const signoffs = await listSignoffs(organizationId, obligationId, controlId);
  const latest = signoffs[0] as
    | (TraceabilitySignoffRow & { signedByName?: string | null })
    | undefined;
  return {
    signed: !!latest,
    verified: !!latest && latest.contentHash === currentHash,
    signedAt: latest?.signedAt ?? null,
    signedRole: latest?.signedRole ?? null,
    signedByName: latest?.signedByName ?? null,
    storedHash: latest?.contentHash ?? null,
    currentHash,
  };
}

export async function listSignoffs(
  organizationId: string,
  obligationId: string,
  controlId: string
): Promise<TraceabilitySignoffRow[]> {
  const { rows } = await pool.query<TraceabilitySignoffRow>(
    `SELECT s.*, u.name AS "signedByName"
       FROM "TraceabilitySignoff" s
       LEFT JOIN "User" u ON u.id = s."signedById"
      WHERE s."organizationId" = $1 AND s."obligationId" = $2 AND s."controlId" = $3
      ORDER BY s."signedAt" DESC`,
    [organizationId, obligationId, controlId]
  );
  return rows;
}

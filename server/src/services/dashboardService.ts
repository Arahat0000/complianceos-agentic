import type {
  DailyPipelineSnapshot,
  DashboardSummary,
  GapStatus,
  RiskLevel,
} from "@complianceos/shared";
import { pool } from "../db/pool.js";

const RISK_LEVELS: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const GAP_STATUSES: GapStatus[] = ["OPEN", "REMEDIATING", "RISK_ACCEPTED", "RESOLVED"];

// Compliance score (0-100, one decimal) = share of controls that have no open
// gap: 100 * (1 - controlsWithOpenGap / totalControls). Null when the org has
// no controls. "Open" = gap status not in (RESOLVED, RISK_ACCEPTED).
export function computeComplianceScore(totalControls: number, controlsWithOpenGap: number): number | null {
  if (totalControls <= 0) return null;
  const score = 100 * (1 - Math.min(controlsWithOpenGap, totalControls) / totalControls);
  return Math.round(score * 10) / 10;
}

export interface OrgControlGapCounts {
  totalControls: number;
  controlsWithOpenGap: number;
  openCriticalGaps: number;
  openHighGaps: number;
}

// Shared by the dashboard summary and the simulation estimator.
export async function getControlGapCounts(organizationId: string): Promise<OrgControlGapCounts> {
  const { rows } = await pool.query<OrgControlGapCounts>(
    `SELECT
       (SELECT COUNT(*)::int FROM "Control"
         WHERE "organizationId" IS NULL OR "organizationId" = $1)              AS "totalControls",
       (SELECT COUNT(DISTINCT "controlId")::int FROM "ComplianceGap"
         WHERE "organizationId" = $1 AND "controlId" IS NOT NULL
           AND status NOT IN ('RESOLVED', 'RISK_ACCEPTED'))                    AS "controlsWithOpenGap",
       (SELECT COUNT(*)::int FROM "ComplianceGap"
         WHERE "organizationId" = $1 AND "riskLevel" = 'CRITICAL'
           AND status NOT IN ('RESOLVED', 'RISK_ACCEPTED'))                    AS "openCriticalGaps",
       (SELECT COUNT(*)::int FROM "ComplianceGap"
         WHERE "organizationId" = $1 AND "riskLevel" = 'HIGH'
           AND status NOT IN ('RESOLVED', 'RISK_ACCEPTED'))                    AS "openHighGaps"`,
    [organizationId]
  );
  return rows[0];
}

export async function getDashboardSummary(organizationId: string): Promise<DashboardSummary> {
  const [regs, obls, gaps, counts] = await Promise.all([
    pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM "Circular"
        WHERE "organizationId" IS NULL OR "organizationId" = $1`,
      [organizationId]
    ),
    // Dismissed obligations are not part of the working set.
    pool.query<{ total: number; verified: number }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE "citationVerified")::int AS verified
         FROM "Obligation" WHERE "organizationId" = $1 AND status <> 'DISMISSED'`,
      [organizationId]
    ),
    pool.query<{ riskLevel: RiskLevel; status: GapStatus; n: number }>(
      `SELECT "riskLevel", status, COUNT(*)::int AS n FROM "ComplianceGap"
        WHERE "organizationId" = $1 GROUP BY "riskLevel", status`,
      [organizationId]
    ),
    getControlGapCounts(organizationId),
  ]);

  const gapsByRisk = Object.fromEntries(RISK_LEVELS.map((r) => [r, 0])) as Record<RiskLevel, number>;
  const gapsByStatus = Object.fromEntries(GAP_STATUSES.map((s) => [s, 0])) as Record<GapStatus, number>;
  let openGaps = 0;
  for (const row of gaps.rows) {
    gapsByStatus[row.status] += row.n;
    if (row.status !== "RESOLVED" && row.status !== "RISK_ACCEPTED") {
      gapsByRisk[row.riskLevel] += row.n;
      openGaps += row.n;
    }
  }

  const { total, verified } = obls.rows[0];
  return {
    regulations: regs.rows[0].n,
    obligations: total,
    obligationsVerifiedPct: total === 0 ? 0 : Math.round((verified / total) * 1000) / 10,
    controls: counts.totalControls,
    openGaps,
    // gapsByRisk counts OPEN gaps only (status not RESOLVED/RISK_ACCEPTED).
    gapsByRisk,
    gapsByStatus,
    complianceScore: computeComplianceScore(counts.totalControls, counts.controlsWithOpenGap),
  };
}

// Reads DailyPipelineSnapshot for the last `days` days (inclusive of today).
// With no stored rows in the window, per-day counts are derived from
// Obligation.createdAt and ComplianceGap.resolvedAt (zero-filled).
export async function getPipelineActivity(
  organizationId: string,
  days: number
): Promise<DailyPipelineSnapshot[]> {
  const stored = await pool.query<DailyPipelineSnapshot>(
    `SELECT to_char("snapshotDate", 'YYYY-MM-DD') AS "snapshotDate",
            "obligationsExtracted", "gapsResolved", "openGaps", "complianceScore"
       FROM "DailyPipelineSnapshot"
      WHERE "organizationId" = $1 AND "snapshotDate" > CURRENT_DATE - $2::int
      ORDER BY "snapshotDate" ASC`,
    [organizationId, days]
  );
  if (stored.rows.length > 0) return stored.rows;

  const { rows } = await pool.query<DailyPipelineSnapshot>(
    `SELECT to_char(d.day, 'YYYY-MM-DD') AS "snapshotDate",
            COALESCE(o.n, 0)::int AS "obligationsExtracted",
            COALESCE(g.n, 0)::int AS "gapsResolved",
            NULL::int AS "openGaps",
            NULL::float8 AS "complianceScore"
       FROM generate_series(CURRENT_DATE - ($2::int - 1), CURRENT_DATE, interval '1 day') AS d(day)
       LEFT JOIN (
         SELECT "createdAt"::date AS day, COUNT(*) AS n FROM "Obligation"
          WHERE "organizationId" = $1 GROUP BY 1
       ) o ON o.day = d.day::date
       LEFT JOIN (
         SELECT "resolvedAt"::date AS day, COUNT(*) AS n FROM "ComplianceGap"
          WHERE "organizationId" = $1 AND "resolvedAt" IS NOT NULL GROUP BY 1
       ) g ON g.day = d.day::date
      ORDER BY d.day ASC`,
    [organizationId, days]
  );
  return rows;
}

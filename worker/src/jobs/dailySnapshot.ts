import type { Job } from "bullmq";
import { pool } from "../db/pool.js";

export interface DailySnapshotJobData {
  organizationId?: string;
}

// Upserts today's "DailyPipelineSnapshot" row per organization (all orgs, or
// just data.organizationId). "Today" is CURRENT_DATE in the DB session time zone.
//   obligationsExtracted = Obligations created today
//   gapsResolved         = ComplianceGaps with resolvedAt today
//   openGaps             = gaps currently not RESOLVED / RISK_ACCEPTED
//   complianceScore      = 100 * (org Controls with at least one VERIFIED
//                          Evidence / all org Controls); NULL if no controls.
// Idempotent: re-running the same day overwrites that day's row.
export async function processDailySnapshot(job: Job<DailySnapshotJobData>): Promise<void> {
  const organizationId = job.data?.organizationId ?? null;

  const result = await pool.query(
    `INSERT INTO "DailyPipelineSnapshot"
       ("organizationId", "snapshotDate", "obligationsExtracted", "gapsResolved", "openGaps", "complianceScore")
     SELECT
       org."id",
       CURRENT_DATE,
       (SELECT COUNT(*) FROM "Obligation" o
          WHERE o."organizationId" = org."id" AND o."createdAt"::date = CURRENT_DATE),
       (SELECT COUNT(*) FROM "ComplianceGap" g
          WHERE g."organizationId" = org."id" AND g."resolvedAt"::date = CURRENT_DATE),
       (SELECT COUNT(*) FROM "ComplianceGap" g
          WHERE g."organizationId" = org."id" AND g."status" NOT IN ('RESOLVED', 'RISK_ACCEPTED')),
       (SELECT 100.0 * COUNT(*) FILTER (WHERE EXISTS (
                 SELECT 1 FROM "Evidence" e
                 WHERE e."controlId" = c."id" AND e."status" = 'VERIFIED'))
               / NULLIF(COUNT(*), 0)
          FROM "Control" c WHERE c."organizationId" = org."id")
     FROM "Organization" org
     WHERE $1::varchar IS NULL OR org."id" = $1::varchar
     ON CONFLICT ("organizationId", "snapshotDate") DO UPDATE SET
       "obligationsExtracted" = EXCLUDED."obligationsExtracted",
       "gapsResolved" = EXCLUDED."gapsResolved",
       "openGaps" = EXCLUDED."openGaps",
       "complianceScore" = EXCLUDED."complianceScore"`,
    [organizationId],
  );
  console.log(`[daily-snapshot] upserted ${result.rowCount ?? 0} snapshot row(s)`);
}

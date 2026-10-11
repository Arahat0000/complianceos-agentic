import { randomUUID } from "node:crypto";
import type { Regulator } from "@complianceos/shared";
import { pool } from "../db/pool.js";
import type { DiscoveryRunRow } from "../db/types.js";
import { discoveryQueue } from "../jobs/queue.js";

export async function startDiscoveryRun(
  organizationId: string,
  regulators?: Regulator[]
): Promise<DiscoveryRunRow> {
  const runId = randomUUID();
  const { rows } = await pool.query<DiscoveryRunRow>(
    `INSERT INTO "DiscoveryRun" (id, "organizationId", status) VALUES ($1, $2, 'RUNNING') RETURNING *`,
    [runId, organizationId]
  );
  try {
    await discoveryQueue.add("discovery-run", { runId, organizationId, regulators });
  } catch (err) {
    // Don't leave a run stuck in RUNNING if it could not be queued.
    await pool.query(
      `UPDATE "DiscoveryRun" SET status = 'FAILED', "finishedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
      [runId]
    );
    throw err;
  }
  return rows[0];
}

export async function listDiscoveryRuns(organizationId: string): Promise<DiscoveryRunRow[]> {
  const { rows } = await pool.query<DiscoveryRunRow>(
    'SELECT * FROM "DiscoveryRun" WHERE "organizationId" = $1 ORDER BY "startedAt" DESC',
    [organizationId]
  );
  return rows;
}

export async function getDiscoveryRun(
  organizationId: string,
  id: string
): Promise<DiscoveryRunRow | null> {
  const { rows } = await pool.query<DiscoveryRunRow>(
    'SELECT * FROM "DiscoveryRun" WHERE id = $1 AND "organizationId" = $2',
    [id, organizationId]
  );
  return rows[0] ?? null;
}

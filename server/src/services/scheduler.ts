import type { PoolClient } from "pg";
import { pool } from "../db/pool.js";
import type { AgentScheduleRow } from "../db/types.js";
import { AutomationConflictError, failStaleRuns, startControlAnswerRun } from "./automationService.js";
import { startDiscoveryRun } from "./discoveryService.js";

const TICK_MS = 60_000;

// Claims due schedules atomically (FOR UPDATE SKIP LOCKED) and advances their
// nextRunAt in the same transaction, so with several server instances each due
// schedule is picked up exactly once per interval.
async function claimDue(client: PoolClient): Promise<AgentScheduleRow[]> {
  await client.query("BEGIN");
  try {
    const { rows } = await client.query<AgentScheduleRow>(
      `SELECT * FROM "AgentSchedule"
        WHERE enabled AND "nextRunAt" IS NOT NULL AND "nextRunAt" <= CURRENT_TIMESTAMP
        ORDER BY "nextRunAt" ASC LIMIT 10 FOR UPDATE SKIP LOCKED`
    );
    for (const row of rows) {
      await client.query(
        `UPDATE "AgentSchedule"
            SET "lastRunAt" = CURRENT_TIMESTAMP,
                "nextRunAt" = CURRENT_TIMESTAMP + make_interval(hours => "intervalHours")
          WHERE "organizationId" = $1 AND agent = $2`,
        [row.organizationId, row.agent]
      );
    }
    await client.query("COMMIT");
    return rows;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function runDueSchedules(): Promise<number> {
  const client = await pool.connect();
  let due: AgentScheduleRow[];
  try {
    due = await claimDue(client);
  } finally {
    client.release();
  }
  for (const s of due) {
    try {
      if (s.agent === "CONTROL_ANSWERS") await startControlAnswerRun(s.organizationId, "SCHEDULED", null);
      else if (s.agent === "DISCOVERY") await startDiscoveryRun(s.organizationId);
    } catch (err) {
      // A run already in progress is fine — it will be picked up next interval.
      if (!(err instanceof AutomationConflictError)) {
        console.error(`scheduled ${s.agent} run failed to start for ${s.organizationId}:`, err);
      }
    }
  }
  return due.length;
}

export function startScheduler(): NodeJS.Timeout {
  failStaleRuns().catch((err) => console.error("failStaleRuns:", err));
  const tick = () => runDueSchedules().catch((err) => console.error("scheduler tick failed:", err));
  setTimeout(tick, 10_000);
  const timer = setInterval(tick, TICK_MS);
  timer.unref();
  return timer;
}

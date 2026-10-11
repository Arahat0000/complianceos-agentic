import { randomUUID } from "node:crypto";
import type { AutomationAgent, RunTrigger, UpdateAgentScheduleInput } from "@complianceos/shared";
import { pool } from "../db/pool.js";
import type { AgentScheduleRow, ControlAnswerRunRow, ControlRow } from "../db/types.js";
import { auditAsAi } from "./audit.js";
import { generateAnswerForControl } from "./controlAnswerService.js";

// Thrown when a control-answer run is already in progress for the org (HTTP 409).
export class AutomationConflictError extends Error {}

type Stage = { key: string; title: string; status: "pending" | "running" | "done" | "failed"; detail?: string };

const STAGE_DEFS: Pick<Stage, "key" | "title">[] = [
  { key: "collect", title: "Collect controls" },
  { key: "gather", title: "Gather evidence & knowledge base" },
  { key: "draft", title: "Draft answers" },
  { key: "verify", title: "Save & audit answers" },
];

const DEFAULT_MAX_PER_RUN = 50;
// A run still RUNNING after this long is considered crashed (server restart etc.).
const STALE_RUN_MINUTES = 60;

// --- Schedules ------------------------------------------------------------

function defaultSchedule(organizationId: string, agent: AutomationAgent): AgentScheduleRow {
  return {
    organizationId,
    agent,
    enabled: false,
    intervalHours: 24,
    config: null,
    lastRunAt: null,
    nextRunAt: null,
    updatedAt: null,
  };
}

export async function getSchedule(
  organizationId: string,
  agent: AutomationAgent
): Promise<AgentScheduleRow> {
  const { rows } = await pool.query<AgentScheduleRow>(
    'SELECT * FROM "AgentSchedule" WHERE "organizationId" = $1 AND agent = $2',
    [organizationId, agent]
  );
  return rows[0] ?? defaultSchedule(organizationId, agent);
}

// Enabling (or changing the cadence of) a schedule starts a fresh countdown:
// the first automatic run happens one interval from now. Disabling clears it.
export async function upsertSchedule(
  organizationId: string,
  agent: AutomationAgent,
  input: UpdateAgentScheduleInput
): Promise<AgentScheduleRow> {
  const current = await getSchedule(organizationId, agent);
  const enabled = input.enabled ?? current.enabled;
  const intervalHours = input.intervalHours ?? current.intervalHours;
  const config = input.config ? { ...(current.config ?? {}), ...input.config } : current.config;
  const restart = enabled && (!current.enabled || intervalHours !== current.intervalHours);
  const { rows } = await pool.query<AgentScheduleRow>(
    `INSERT INTO "AgentSchedule"
       ("organizationId", agent, enabled, "intervalHours", config, "nextRunAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5,
             CASE WHEN $3 THEN CURRENT_TIMESTAMP + make_interval(hours => $4) ELSE NULL END,
             CURRENT_TIMESTAMP)
     ON CONFLICT ("organizationId", agent) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       "intervalHours" = EXCLUDED."intervalHours",
       config = EXCLUDED.config,
       "nextRunAt" = CASE
         WHEN NOT EXCLUDED.enabled THEN NULL
         WHEN $6 THEN CURRENT_TIMESTAMP + make_interval(hours => EXCLUDED."intervalHours")
         ELSE "AgentSchedule"."nextRunAt" END,
       "updatedAt" = CURRENT_TIMESTAMP
     RETURNING *`,
    [organizationId, agent, enabled, intervalHours, config ? JSON.stringify(config) : null, restart]
  );
  return rows[0];
}

// --- Runs -----------------------------------------------------------------

export async function listRuns(organizationId: string, limit = 20): Promise<ControlAnswerRunRow[]> {
  const { rows } = await pool.query<ControlAnswerRunRow>(
    'SELECT * FROM "ControlAnswerRun" WHERE "organizationId" = $1 ORDER BY "startedAt" DESC LIMIT $2',
    [organizationId, limit]
  );
  return rows;
}

export async function getRun(organizationId: string, id: string): Promise<ControlAnswerRunRow | null> {
  const { rows } = await pool.query<ControlAnswerRunRow>(
    'SELECT * FROM "ControlAnswerRun" WHERE id = $1 AND "organizationId" = $2',
    [id, organizationId]
  );
  return rows[0] ?? null;
}

async function saveProgress(
  runId: string,
  stages: Stage[],
  counts: Partial<Pick<ControlAnswerRunRow, "controlsTotal" | "generated" | "skipped" | "failed">> = {}
): Promise<void> {
  await pool.query(
    `UPDATE "ControlAnswerRun" SET stages = $2,
       "controlsTotal" = COALESCE($3, "controlsTotal"), generated = COALESCE($4, generated),
       skipped = COALESCE($5, skipped), failed = COALESCE($6, failed)
     WHERE id = $1`,
    [runId, JSON.stringify(stages), counts.controlsTotal ?? null, counts.generated ?? null, counts.skipped ?? null, counts.failed ?? null]
  );
}

// Starts a run and returns immediately (RUNNING); the work continues in the
// background of this process. `SCHEDULED` runs are started by the scheduler,
// which has already advanced the schedule's lastRunAt/nextRunAt.
export async function startControlAnswerRun(
  organizationId: string,
  trigger: RunTrigger,
  startedById: string | null
): Promise<ControlAnswerRunRow> {
  const running = await pool.query(
    `SELECT 1 FROM "ControlAnswerRun"
      WHERE "organizationId" = $1 AND status = 'RUNNING'
        AND "startedAt" > CURRENT_TIMESTAMP - make_interval(mins => $2)`,
    [organizationId, STALE_RUN_MINUTES]
  );
  if (running.rows.length > 0) throw new AutomationConflictError("A run is already in progress");

  const stages: Stage[] = STAGE_DEFS.map((s, i) => ({ ...s, status: i === 0 ? "running" : "pending" }));
  const { rows } = await pool.query<ControlAnswerRunRow>(
    `INSERT INTO "ControlAnswerRun" (id, "organizationId", trigger, stages, "startedById")
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [randomUUID(), organizationId, trigger, JSON.stringify(stages), startedById]
  );
  const run = rows[0];

  if (trigger === "MANUAL") {
    await pool.query(
      `UPDATE "AgentSchedule" SET "lastRunAt" = CURRENT_TIMESTAMP
        WHERE "organizationId" = $1 AND agent = 'CONTROL_ANSWERS'`,
      [organizationId]
    );
  }

  void executeRun(run.id, organizationId).catch((err) => console.error("control answer run crashed:", err));
  return run;
}

async function executeRun(runId: string, organizationId: string): Promise<void> {
  const stages: Stage[] = STAGE_DEFS.map((s) => ({ ...s, status: "pending" }));
  const setStage = (key: string, status: Stage["status"], detail?: string) => {
    const st = stages.find((s) => s.key === key)!;
    st.status = status;
    if (detail !== undefined) st.detail = detail;
  };

  try {
    const schedule = await getSchedule(organizationId, "CONTROL_ANSWERS");
    const onlyEmpty = schedule.config?.onlyEmpty ?? true;
    const maxPerRun = schedule.config?.maxPerRun ?? DEFAULT_MAX_PER_RUN;

    // 1. Collect: org-owned controls are answerable; shared library controls are
    //    read-only for an org, so they are counted as skipped.
    setStage("collect", "running");
    await saveProgress(runId, stages);
    const { rows: controls } = await pool.query<ControlRow>(
      `SELECT * FROM "Control" c
        WHERE c."organizationId" = $1 OR c."organizationId" IS NULL
        ORDER BY c."createdAt" ASC`,
      [organizationId]
    );
    const owned = controls.filter((c) => c.organizationId === organizationId);
    const eligible = owned.filter((c) => !onlyEmpty || !c.answer?.trim());
    const todo = eligible.slice(0, maxPerRun);
    const skipped = controls.length - todo.length;
    setStage("collect", "done", `${controls.length} controls · ${todo.length} to answer`);
    setStage("gather", "running", "Evidence, mapped obligations and knowledge base are gathered per control");
    await saveProgress(runId, stages, { controlsTotal: controls.length, skipped, generated: 0, failed: 0 });

    // 2-3. Gather + draft happen per control inside generateAnswerForControl.
    setStage("gather", "done");
    setStage("draft", "running", `0/${todo.length}`);
    await saveProgress(runId, stages);
    let generated = 0;
    let failed = 0;
    let firstError: string | null = null;
    for (const control of todo) {
      try {
        await generateAnswerForControl(organizationId, control);
        generated++;
      } catch (err) {
        failed++;
        firstError ??= err instanceof Error ? err.message : String(err);
        console.error("auto-answer failed for control", control.id, err);
      }
      setStage("draft", "running", `${generated + failed}/${todo.length}`);
      await saveProgress(runId, stages, { generated, failed });
    }
    setStage("draft", failed > 0 && generated === 0 && todo.length > 0 ? "failed" : "done", `${generated} answered, ${failed} failed`);

    // 4. Save & audit
    setStage("verify", "running");
    await saveProgress(runId, stages);
    const allFailed = todo.length > 0 && generated === 0;
    await auditAsAi(organizationId, {
      type: "AI",
      action: "Autonomous control answering run",
      detail: `${generated} answered, ${skipped} skipped, ${failed} failed`,
      objectType: "CONTROL_ANSWER_RUN",
      objectId: runId,
    });
    setStage("verify", allFailed ? "failed" : "done");
    await pool.query(
      `UPDATE "ControlAnswerRun" SET status = $2, stages = $3, error = $4, "finishedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
      [runId, allFailed ? "FAILED" : "COMPLETED", JSON.stringify(stages), allFailed ? firstError : null]
    );
  } catch (err) {
    const running = stages.find((s) => s.status === "running");
    if (running) running.status = "failed";
    await pool.query(
      `UPDATE "ControlAnswerRun" SET status = 'FAILED', stages = $2, error = $3, "finishedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
      [runId, JSON.stringify(stages), err instanceof Error ? err.message : String(err)]
    );
    throw err;
  }
}

// Marks runs left RUNNING by a crashed/restarted process as FAILED.
export async function failStaleRuns(): Promise<void> {
  await pool.query(
    `UPDATE "ControlAnswerRun"
        SET status = 'FAILED', error = 'Interrupted (server restarted)', "finishedAt" = CURRENT_TIMESTAMP
      WHERE status = 'RUNNING' AND "startedAt" < CURRENT_TIMESTAMP - make_interval(mins => $1)`,
    [STALE_RUN_MINUTES]
  );
}

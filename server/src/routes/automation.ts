import { updateAgentScheduleSchema, type AutomationAgent } from "@complianceos/shared";
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import {
  AutomationConflictError,
  getRun,
  getSchedule,
  listRuns,
  startControlAnswerRun,
  upsertSchedule,
} from "../services/automationService.js";

export const automationRouter = Router();

// URL segment -> agent
const AGENTS: Record<string, AutomationAgent> = {
  "control-answers": "CONTROL_ANSWERS",
  discovery: "DISCOVERY",
};

function fail(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof AutomationConflictError) return res.status(409).json({ error: err.message });
  next(err);
}

function scheduleJson(row: Awaited<ReturnType<typeof getSchedule>>) {
  const { organizationId: _org, ...rest } = row;
  void _org;
  return rest;
}

// --- Control answering runs (must be declared before the generic /:agent routes) ---

automationRouter.post("/control-answers/run", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const run = await startControlAnswerRun(req.user!.organizationId, "MANUAL", req.user!.id);
    await auditAsUser(req, {
      type: "AI",
      action: "Started autonomous control answering",
      objectType: "CONTROL_ANSWER_RUN",
      objectId: run.id,
    });
    res.status(202).json(run);
  } catch (err) {
    fail(err, res, next);
  }
});

automationRouter.get("/control-answers/runs", async (req, res, next) => {
  try {
    res.json(await listRuns(req.user!.organizationId));
  } catch (err) {
    next(err);
  }
});

automationRouter.get("/control-answers/runs/:id", async (req, res, next) => {
  try {
    const run = await getRun(req.user!.organizationId, String(req.params.id));
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json(run);
  } catch (err) {
    next(err);
  }
});

// --- Schedules ---------------------------------------------------------------

automationRouter.get("/:agent", async (req: Request, res, next) => {
  try {
    const agent = AGENTS[String(req.params.agent)];
    if (!agent) return res.status(404).json({ error: "Unknown agent" });
    const orgId = req.user!.organizationId;
    const schedule = scheduleJson(await getSchedule(orgId, agent));
    if (agent === "CONTROL_ANSWERS") {
      const [latestRun] = await listRuns(orgId, 1);
      return res.json({ schedule, latestRun: latestRun ?? null });
    }
    res.json({ schedule });
  } catch (err) {
    next(err);
  }
});

automationRouter.put("/:agent", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const agent = AGENTS[String(req.params.agent)];
    if (!agent) return res.status(404).json({ error: "Unknown agent" });
    const input = updateAgentScheduleSchema.parse(req.body);
    const schedule = await upsertSchedule(req.user!.organizationId, agent, input);
    await auditAsUser(req, {
      type: "EDIT",
      action: `Updated ${agent === "CONTROL_ANSWERS" ? "control auto-answer" : "discovery"} schedule`,
      detail: `${schedule.enabled ? `every ${schedule.intervalHours}h` : "disabled"}`,
      objectType: "SETTINGS",
    });
    res.json(scheduleJson(schedule));
  } catch (err) {
    fail(err, res, next);
  }
});

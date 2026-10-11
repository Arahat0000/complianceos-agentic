import {
  createSimulationScenarioSchema,
  runSimulationSchema,
  updateSimulationScenarioSchema,
} from "@complianceos/shared";
import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import {
  createScenario,
  deleteScenario,
  getScenario,
  listRuns,
  listScenarios,
  runScenario,
  updateScenario,
} from "../services/simulationService.js";

export const simulationRouter = Router();

simulationRouter.get("/scenarios", async (req, res, next) => {
  try {
    res.json(await listScenarios(req.user!.organizationId));
  } catch (err) {
    next(err);
  }
});

simulationRouter.get("/scenarios/:id", async (req, res, next) => {
  try {
    const row = await getScenario(req.user!.organizationId, req.params.id);
    if (!row) return res.status(404).json({ error: "Scenario not found" });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

simulationRouter.post("/scenarios", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = createSimulationScenarioSchema.parse(req.body);
    const row = await createScenario(req.user!.organizationId, req.user!.id, input);
    await auditAsUser(req, {
      type: "CREATE",
      action: "Simulation scenario created",
      detail: row.name,
      objectType: "SIMULATION",
      objectId: row.id,
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

simulationRouter.patch("/scenarios/:id", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = updateSimulationScenarioSchema.parse(req.body);
    const row = await updateScenario(req.user!.organizationId, req.params.id, input);
    if (!row) return res.status(404).json({ error: "Scenario not found or not editable" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Simulation scenario updated",
      detail: Object.keys(input).join(", "),
      objectType: "SIMULATION",
      objectId: row.id,
    });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

simulationRouter.delete("/scenarios/:id", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const ok = await deleteScenario(req.user!.organizationId, req.params.id);
    if (!ok) return res.status(404).json({ error: "Scenario not found or not deletable" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Simulation scenario deleted",
      objectType: "SIMULATION",
      objectId: req.params.id,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

simulationRouter.post(
  "/scenarios/:id/run",
  requireRole("ADMIN", "EDITOR"),
  async (req, res, next) => {
    try {
      const run = await runScenario(
        req.user!.organizationId,
        req.user!.id,
        req.params.id,
        runSimulationSchema.parse(req.body ?? {})
      );
      if (!run) return res.status(404).json({ error: "Scenario not found" });
      await auditAsUser(req, {
        type: "SYSTEM",
        action: "Simulation run",
        detail: `[${run.method}${run.reasoning?.notes ? " fallback" : ""}] ${run.breachedControls.length} controls breached, blast radius ${run.blastRadiusScore ?? "n/a"}`,
        objectType: "SIMULATION",
        objectId: req.params.id,
      });
      res.status(201).json(run);
    } catch (err) {
      next(err);
    }
  }
);

simulationRouter.get("/scenarios/:id/runs", async (req, res, next) => {
  try {
    if (!(await getScenario(req.user!.organizationId, req.params.id))) {
      return res.status(404).json({ error: "Scenario not found" });
    }
    res.json(await listRuns(req.user!.organizationId, req.params.id));
  } catch (err) {
    next(err);
  }
});

import { startDiscoveryRunSchema } from "@complianceos/shared";
import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import {
  getDiscoveryRun,
  listDiscoveryRuns,
  startDiscoveryRun,
} from "../services/discoveryService.js";

export const discoveryRouter = Router();

discoveryRouter.post("/", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = startDiscoveryRunSchema.parse(req.body ?? {});
    const run = await startDiscoveryRun(req.user!.organizationId, input.regulators);
    await auditAsUser(req, {
      type: "SYSTEM",
      action: "Discovery scan started",
      detail: input.regulators?.join(", ") ?? "all regulators",
      objectType: "DISCOVERY_RUN",
      objectId: run.id,
    });
    res.status(201).json(run);
  } catch (err) {
    next(err);
  }
});

discoveryRouter.get("/", async (req, res, next) => {
  try {
    res.json(await listDiscoveryRuns(req.user!.organizationId));
  } catch (err) {
    next(err);
  }
});

discoveryRouter.get("/:id", async (req, res, next) => {
  try {
    const run = await getDiscoveryRun(req.user!.organizationId, req.params.id);
    if (!run) return res.status(404).json({ error: "Discovery run not found" });
    res.json(run);
  } catch (err) {
    next(err);
  }
});

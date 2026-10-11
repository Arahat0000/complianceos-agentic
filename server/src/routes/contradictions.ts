import {
  createContradictionSchema,
  detectContradictionsSchema,
  harmonizeContradictionSchema,
  updateContradictionSchema,
} from "@complianceos/shared";
import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { z } from "zod";
import { auditAsUser } from "../services/audit.js";
import { detectContradictions, reviewContradiction } from "../services/contradictionDetectionService.js";
import {
  createContradiction,
  deleteContradiction,
  getContradiction,
  harmonizeContradiction,
  listContradictions,
  updateContradiction,
} from "../services/contradictionService.js";

export const contradictionsRouter = Router();

contradictionsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await listContradictions(req.user!.organizationId));
  } catch (err) {
    next(err);
  }
});

contradictionsRouter.get("/:id", async (req, res, next) => {
  try {
    const row = await getContradiction(req.user!.organizationId, req.params.id);
    if (!row) return res.status(404).json({ error: "Contradiction not found" });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

contradictionsRouter.post("/", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = createContradictionSchema.parse(req.body);
    const row = await createContradiction(req.user!.organizationId, input);
    await auditAsUser(req, {
      type: "CREATE",
      action: "Contradiction created",
      detail: row.title,
      objectType: "CONTRADICTION",
      objectId: row.id,
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

contradictionsRouter.patch("/:id", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = updateContradictionSchema.parse(req.body);
    const row = await updateContradiction(req.user!.organizationId, req.params.id, input);
    if (!row) return res.status(404).json({ error: "Contradiction not found or not editable" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Contradiction updated",
      detail: Object.keys(input).join(", "),
      objectType: "CONTRADICTION",
      objectId: row.id,
    });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

contradictionsRouter.delete("/:id", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const ok = await deleteContradiction(req.user!.organizationId, req.params.id);
    if (!ok) return res.status(404).json({ error: "Contradiction not found or not deletable" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Contradiction deleted",
      objectType: "CONTRADICTION",
      objectId: req.params.id,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

contradictionsRouter.post(
  "/:id/harmonize",
  requireRole("ADMIN", "EDITOR"),
  async (req, res, next) => {
    try {
      const input = harmonizeContradictionSchema.parse(req.body);
      const row = await harmonizeContradiction(
        req.user!.organizationId,
        req.user!.id,
        req.params.id,
        input
      );
      if (!row) return res.status(404).json({ error: "Contradiction/obligation link not found" });
      await auditAsUser(req, {
        type: "APPROVAL",
        action: input.harmonized ? "Contradiction harmonized" : "Contradiction harmonization reverted",
        detail: row.title,
        objectType: "CONTRADICTION",
        objectId: row.id,
        context: input.obligationId,
      });
      res.json(row);
    } catch (err) {
      next(err);
    }
  }
);

contradictionsRouter.post("/detect", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = detectContradictionsSchema.parse(req.body ?? {});
    res.json(await detectContradictions(req.user!.organizationId, input));
  } catch (err) {
    next(err);
  }
});

const reviewSchema = z.object({
  decision: z.enum(["CONFIRMED", "REJECTED"]),
  harmonize: z.boolean().optional(),
});

contradictionsRouter.post("/:id/review", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = reviewSchema.parse(req.body);
    const row = await reviewContradiction(
      req.user!.organizationId,
      req.user!.id,
      req.params.id,
      input.decision,
      input.harmonize
    );
    if (!row) return res.status(404).json({ error: "AI contradiction not found" });
    await auditAsUser(req, {
      type: "APPROVAL",
      action: `AI contradiction ${input.decision.toLowerCase()}`,
      detail: row.title,
      objectType: "CONTRADICTION",
      objectId: row.id,
    });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

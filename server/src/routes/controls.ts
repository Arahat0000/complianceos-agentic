import { createControlSchema, updateControlSchema } from "@complianceos/shared";
import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import {
  generateAnswerForControl,
  generateAnswersForCircular,
} from "../services/controlAnswerService.js";
import {
  createControl,
  deleteControl,
  getControl,
  listControls,
  updateControl,
} from "../services/controlService.js";

export const controlsRouter = Router();

controlsRouter.get("/", async (req, res, next) => {
  try {
    const q = (v: unknown) => (typeof v === "string" && v ? v : undefined);
    res.json(
      await listControls(req.user!.organizationId, {
        circularId: q(req.query.circularId),
        source: q(req.query.source),
        status: q(req.query.status),
      })
    );
  } catch (err) {
    next(err);
  }
});

// Bulk answer generation (max 25 controls per call, org-owned controls only).
controlsRouter.post("/generate-answers", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const { circularId, onlyEmpty } = (req.body ?? {}) as { circularId?: unknown; onlyEmpty?: unknown };
    if (typeof circularId !== "string" || !circularId)
      return res.status(400).json({ error: "circularId is required" });
    res.json(await generateAnswersForCircular(req.user!.organizationId, circularId, onlyEmpty === true));
  } catch (err) {
    next(err);
  }
});

controlsRouter.post("/:id/generate-answer", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const control = await getControl(req.user!.organizationId, req.params.id);
    if (!control) return res.status(404).json({ error: "Control not found" });
    const { control: updated, persisted } = await generateAnswerForControl(
      req.user!.organizationId,
      control
    );
    res.json({ ...updated, persisted });
  } catch (err) {
    next(err);
  }
});

controlsRouter.get("/:id", async (req, res, next) => {
  try {
    const control = await getControl(req.user!.organizationId, req.params.id);
    if (!control) return res.status(404).json({ error: "Control not found" });
    res.json(control);
  } catch (err) {
    next(err);
  }
});

controlsRouter.post("/", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = createControlSchema.parse(req.body);
    const control = await createControl(req.user!.organizationId, input);
    await auditAsUser(req, {
      type: "CREATE",
      action: "Control created",
      detail: control.title,
      objectType: "CONTROL",
      objectId: control.id,
      context: control.code,
    });
    res.status(201).json(control);
  } catch (err) {
    next(err);
  }
});

controlsRouter.patch("/:id", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = updateControlSchema.parse(req.body);
    const control = await updateControl(req.user!.organizationId, req.params.id, input);
    if (!control) return res.status(404).json({ error: "Control not found or not editable" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Control updated",
      detail: Object.keys(input).join(", "),
      objectType: "CONTROL",
      objectId: control.id,
      context: control.code,
    });
    res.json(control);
  } catch (err) {
    next(err);
  }
});

controlsRouter.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const deleted = await deleteControl(req.user!.organizationId, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Control not found or not deletable" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Control deleted",
      objectType: "CONTROL",
      objectId: req.params.id,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

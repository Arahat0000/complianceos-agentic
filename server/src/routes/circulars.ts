import { createCircularSchema, updateCircularSchema } from "@complianceos/shared";
import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import {
  adoptCircular,
  createCircular,
  deleteCircular,
  getCircular,
  listCirculars,
  updateCircular,
} from "../services/circularService.js";

export const circularsRouter = Router();

circularsRouter.get("/", async (req, res, next) => {
  try {
    const q = (v: unknown) => (typeof v === "string" && v ? v : undefined);
    res.json(
      await listCirculars(req.user!.organizationId, {
        regulator: q(req.query.regulator),
        kind: q(req.query.kind),
        status: q(req.query.status),
      })
    );
  } catch (err) {
    next(err);
  }
});

circularsRouter.get("/:id", async (req, res, next) => {
  try {
    const circular = await getCircular(req.user!.organizationId, req.params.id);
    if (!circular) return res.status(404).json({ error: "Circular not found" });
    res.json(circular);
  } catch (err) {
    next(err);
  }
});

circularsRouter.post("/", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = createCircularSchema.parse(req.body);
    const circular = await createCircular(req.user!.organizationId, input);
    await auditAsUser(req, {
      type: "CREATE",
      action: "Circular created",
      detail: circular.name,
      objectType: "CIRCULAR",
      objectId: circular.id,
      context: circular.circularId,
    });
    res.status(201).json(circular);
  } catch (err) {
    next(err);
  }
});

circularsRouter.patch("/:id", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = updateCircularSchema.parse(req.body);
    const circular = await updateCircular(req.user!.organizationId, req.params.id, input);
    if (!circular) return res.status(404).json({ error: "Circular not found or not editable" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Circular updated",
      detail: Object.keys(input).join(", "),
      objectType: "CIRCULAR",
      objectId: circular.id,
      context: circular.circularId,
    });
    res.json(circular);
  } catch (err) {
    next(err);
  }
});

circularsRouter.post("/:id/adopt", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const circular = await adoptCircular(req.user!.organizationId, req.params.id);
    if (!circular) {
      return res.status(404).json({ error: "Circular not found or not pending review" });
    }
    await auditAsUser(req, {
      type: "APPROVAL",
      action: "Circular adopted",
      detail: circular.name,
      objectType: "CIRCULAR",
      objectId: circular.id,
      context: circular.circularId,
    });
    res.json(circular);
  } catch (err) {
    next(err);
  }
});

circularsRouter.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const deleted = await deleteCircular(req.user!.organizationId, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Circular not found or not deletable" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Circular deleted",
      objectType: "CIRCULAR",
      objectId: req.params.id,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

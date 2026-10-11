import { analyzeChangeSchema } from "@complianceos/shared";
import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import { analyzeChange, ChangeError, getChange, listChanges } from "../services/changeService.js";

export const changesRouter = Router();

changesRouter.get("/", async (req, res, next) => {
  try {
    const circularId = typeof req.query.circularId === "string" ? req.query.circularId : undefined;
    res.json(await listChanges(req.user!.organizationId, circularId));
  } catch (err) {
    next(err);
  }
});

changesRouter.get("/:id", async (req, res, next) => {
  try {
    const row = await getChange(req.user!.organizationId, req.params.id);
    if (!row) return res.status(404).json({ error: "Change analysis not found" });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// Accepts `circularId` as an alias of `newCircularId`.
changesRouter.post("/analyze", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const body = { ...req.body } as Record<string, unknown>;
    if (body.newCircularId === undefined && body.circularId !== undefined) body.newCircularId = body.circularId;
    delete body.circularId;
    const input = analyzeChangeSchema.parse(body);
    const row = await analyzeChange(req.user!.organizationId, req.user!.id, input);
    await auditAsUser(req, {
      type: "AI",
      action: "Regulatory change analysed",
      detail: row.summary?.replace(/^\[AI\]\s*/, "") ?? null,
      objectType: "CIRCULAR_CHANGE",
      objectId: row.id,
      context: row.newCircularId,
    });
    res.status(201).json(row);
  } catch (err) {
    if (err instanceof ChangeError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

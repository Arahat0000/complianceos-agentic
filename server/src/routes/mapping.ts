import { reviewSuggestionSchema, suggestMappingsSchema } from "@complianceos/shared";
import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import { listMappings, reviewMapping, suggestMappings } from "../services/mappingService.js";

export const mappingRouter = Router();

mappingRouter.get("/", async (req, res, next) => {
  try {
    const s = (v: unknown) => (typeof v === "string" ? v : undefined);
    res.json(
      await listMappings(req.user!.organizationId, {
        circularId: s(req.query.circularId),
        obligationId: s(req.query.obligationId),
        controlId: s(req.query.controlId),
        reviewStatus: s(req.query.reviewStatus),
      })
    );
  } catch (err) {
    next(err);
  }
});

mappingRouter.post("/suggest", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = suggestMappingsSchema.parse(req.body);
    res.json(await suggestMappings(req.user!.organizationId, input));
  } catch (err) {
    next(err);
  }
});

// A mapping is keyed by (obligationId, controlId); :id is "<obligationId>:<controlId>".
mappingRouter.post("/:id/review", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const { reviewStatus } = reviewSuggestionSchema.parse(req.body);
    const [obligationId, controlId] = req.params.id.split(":");
    if (!obligationId || !controlId) return res.status(400).json({ error: "id must be <obligationId>:<controlId>" });
    const row = await reviewMapping(req.user!.organizationId, obligationId, controlId, reviewStatus);
    if (!row) return res.status(404).json({ error: "Mapping suggestion not found" });
    await auditAsUser(req, {
      type: "APPROVAL",
      action: `${reviewStatus === "CONFIRMED" ? "Accepted" : "Rejected"} control mapping suggestion`,
      objectType: "OBLIGATION",
      objectId: obligationId,
    });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

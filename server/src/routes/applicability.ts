import { assessApplicabilitySchema, reviewSuggestionSchema } from "@complianceos/shared";
import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import { assessObligations, listApplicability, reviewApplicability } from "../services/applicabilityService.js";

export const applicabilityRouter = Router();

applicabilityRouter.get("/", async (req, res, next) => {
  try {
    const q = req.query;
    res.json(
      await listApplicability(req.user!.organizationId, {
        circularId: typeof q.circularId === "string" ? q.circularId : undefined,
        obligationId: typeof q.obligationId === "string" ? q.obligationId : undefined,
      })
    );
  } catch (err) {
    next(err);
  }
});

applicabilityRouter.post("/assess", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = assessApplicabilitySchema.parse(req.body);
    res.json(await assessObligations(req.user!.organizationId, input));
  } catch (err) {
    next(err);
  }
});

// :id is the obligation id (applicability is one row per obligation).
applicabilityRouter.post("/:id/review", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const { reviewStatus } = reviewSuggestionSchema.parse(req.body);
    const row = await reviewApplicability(req.user!.organizationId, req.params.id, reviewStatus);
    if (!row) return res.status(404).json({ error: "Applicability suggestion not found" });
    await auditAsUser(req, {
      type: "APPROVAL",
      action: `${reviewStatus === "CONFIRMED" ? "Confirmed" : "Rejected"} applicability suggestion`,
      objectType: "OBLIGATION",
      objectId: req.params.id,
    });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

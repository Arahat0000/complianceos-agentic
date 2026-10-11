import {
  createRemediationActionSchema,
  updateRemediationActionSchema,
  updateRemediationPlanSchema,
} from "@complianceos/shared";
import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import {
  addRemediationAction,
  approveRemediationPlan,
  deleteRemediationAction,
  updateRemediationAction,
  updateRemediationPlan,
} from "../services/remediationService.js";

// Mounted at the app root; paths are full.
export const remediationRouter = Router();

const NOT_FOUND = { error: "Remediation plan not found" };

remediationRouter.patch("/remediation-plans/:id", async (req, res, next) => {
  try {
    const input = updateRemediationPlanSchema.parse(req.body);
    const plan = await updateRemediationPlan(req.user!.organizationId, req.params.id, input, req.user!.id);
    if (!plan) return res.status(404).json(NOT_FOUND);
    await auditAsUser(req, {
      type: input.status ? "STATUS" : "EDIT",
      action: input.status ? `Set remediation plan status to ${input.status}` : "Edited remediation plan",
      objectType: "GAP",
      objectId: plan.gapId,
    });
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

remediationRouter.post(
  "/remediation-plans/:id/approve",
  requireRole("ADMIN", "EDITOR"),
  async (req, res, next) => {
    try {
      const plan = await approveRemediationPlan(req.user!.organizationId, req.params.id, req.user!.id);
      if (!plan) return res.status(404).json(NOT_FOUND);
      await auditAsUser(req, {
        type: "APPROVAL",
        action: "Approved remediation plan",
        objectType: "GAP",
        objectId: plan.gapId,
      });
      res.json(plan);
    } catch (err) {
      next(err);
    }
  }
);

remediationRouter.post("/remediation-plans/:id/actions", async (req, res, next) => {
  try {
    const input = createRemediationActionSchema.parse(req.body);
    const action = await addRemediationAction(req.user!.organizationId, req.params.id, input);
    if (!action) return res.status(404).json(NOT_FOUND);
    res.status(201).json(action);
  } catch (err) {
    next(err);
  }
});

remediationRouter.patch("/remediation-plans/:planId/actions/:actionId", async (req, res, next) => {
  try {
    const input = updateRemediationActionSchema.parse(req.body);
    const action = await updateRemediationAction(
      req.user!.organizationId,
      req.params.planId,
      req.params.actionId,
      input
    );
    if (!action) return res.status(404).json({ error: "Remediation action not found" });
    res.json(action);
  } catch (err) {
    next(err);
  }
});

remediationRouter.delete("/remediation-plans/:planId/actions/:actionId", async (req, res, next) => {
  try {
    const deleted = await deleteRemediationAction(
      req.user!.organizationId,
      req.params.planId,
      req.params.actionId
    );
    if (!deleted) return res.status(404).json({ error: "Remediation action not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

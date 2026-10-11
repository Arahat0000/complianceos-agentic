import { createComplianceGapSchema, updateComplianceGapSchema } from "@complianceos/shared";
import { Router } from "express";
import type { NextFunction, Response } from "express";
import { generateRemediationPlan } from "../ai/agents/remediationAgent.js";
import { pool } from "../db/pool.js";
import { auditAsAi, auditAsUser } from "../services/audit.js";
import {
  GapConflictError,
  GapValidationError,
  createComplianceGap,
  deleteComplianceGap,
  getComplianceGap,
  listComplianceGaps,
  updateComplianceGap,
} from "../services/gapService.js";
import { getRemediationPlanForGap, savePlanForGap } from "../services/remediationService.js";

export const complianceGapsRouter = Router();

// Caller mistakes from the service layer are 400s; everything else goes to
// the central error handler.
function fail(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof GapValidationError) return res.status(400).json({ error: err.message });
  if (err instanceof GapConflictError) return res.status(409).json({ error: err.message, existing: err.existing });
  next(err);
}

complianceGapsRouter.get("/", async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const riskLevel = typeof req.query.riskLevel === "string" ? req.query.riskLevel : undefined;
    res.json(await listComplianceGaps(req.user!.organizationId, { status, riskLevel }));
  } catch (err) {
    next(err);
  }
});

complianceGapsRouter.get("/:id", async (req, res, next) => {
  try {
    const gap = await getComplianceGap(req.user!.organizationId, req.params.id);
    if (!gap) return res.status(404).json({ error: "Compliance gap not found" });
    res.json(gap);
  } catch (err) {
    next(err);
  }
});

complianceGapsRouter.post("/", async (req, res, next) => {
  try {
    const input = createComplianceGapSchema.parse(req.body);
    const gap = await createComplianceGap(req.user!.organizationId, input);
    await auditAsUser(req, {
      type: "CREATE",
      action: "Created compliance gap",
      detail: gap.title,
      objectType: "GAP",
      objectId: gap.id,
      context: gap.engagementName,
    });
    res.status(201).json(gap);
  } catch (err) {
    fail(err, res, next);
  }
});

complianceGapsRouter.get("/:id/remediation-plan", async (req, res, next) => {
  try {
    const plan = await getRemediationPlanForGap(req.user!.organizationId, req.params.id);
    if (!plan) return res.status(404).json({ error: "Remediation plan not found" });
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

// Generates a plan with the AI agent and persists it (replacing any existing
// plan and actions for this gap).
complianceGapsRouter.post("/:id/remediation-plan", async (req, res, next) => {
  try {
    const organizationId = req.user!.organizationId;
    const gap = await getComplianceGap(organizationId, req.params.id);
    if (!gap) return res.status(404).json({ error: "Compliance gap not found" });

    const [obligation, control] = await Promise.all([
      gap.obligationId
        ? pool.query<{ requirementText: string }>(
            'SELECT "requirementText" FROM "Obligation" WHERE id = $1 AND "organizationId" = $2',
            [gap.obligationId, organizationId]
          )
        : null,
      gap.controlId
        ? pool.query<{ title: string }>('SELECT title FROM "Control" WHERE id = $1', [gap.controlId])
        : null,
    ]);
    const generated = await generateRemediationPlan(organizationId, gap, {
      obligationText: obligation?.rows[0]?.requirementText,
      controlTitle: control?.rows[0]?.title,
    });
    const plan = await savePlanForGap(organizationId, gap.id, generated);
    await auditAsAi(organizationId, {
      type: "AI",
      action: "Generated remediation plan",
      detail: gap.title,
      objectType: "GAP",
      objectId: gap.id,
    });
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

complianceGapsRouter.patch("/:id", async (req, res, next) => {
  try {
    const input = updateComplianceGapSchema.parse(req.body);
    const result = await updateComplianceGap(req.user!.organizationId, req.params.id, input, req.user!.id);
    if (!result) return res.status(404).json({ error: "Compliance gap not found" });
    const { gap, previousStatus } = result;
    const statusChanged = gap.status !== previousStatus;
    await auditAsUser(req, {
      type: statusChanged ? "STATUS" : "EDIT",
      action: statusChanged
        ? `Changed gap status from ${previousStatus} to ${gap.status}`
        : "Updated compliance gap",
      detail: gap.title,
      objectType: "GAP",
      objectId: gap.id,
      context: gap.engagementName,
    });
    res.json(gap);
  } catch (err) {
    fail(err, res, next);
  }
});

complianceGapsRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await deleteComplianceGap(req.user!.organizationId, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Compliance gap not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

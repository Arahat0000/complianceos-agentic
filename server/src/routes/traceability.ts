import { signoffSchema } from "@complianceos/shared";
import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import {
  getTraceabilityChain,
  listSignoffs,
  listTraceability,
  signoffChain,
  verifyChain,
} from "../services/traceabilityService.js";

export const traceabilityRouter = Router();

traceabilityRouter.get("/", async (req, res, next) => {
  try {
    const regulator =
      typeof req.query.regulator === "string" && req.query.regulator
        ? req.query.regulator
        : undefined;
    res.json(
      await listTraceability(req.user!.organizationId, {
        regulator,
        gapOnly: req.query.gapOnly === "true",
      })
    );
  } catch (err) {
    next(err);
  }
});

traceabilityRouter.get("/:obligationId/:controlId", async (req, res, next) => {
  try {
    const chain = await getTraceabilityChain(
      req.user!.organizationId,
      req.params.obligationId,
      req.params.controlId
    );
    if (!chain) return res.status(404).json({ error: "Traceability chain not found" });
    res.json(chain);
  } catch (err) {
    next(err);
  }
});

traceabilityRouter.get("/:obligationId/:controlId/verify", async (req, res, next) => {
  try {
    const result = await verifyChain(
      req.user!.organizationId,
      req.params.obligationId,
      req.params.controlId
    );
    if (!result) return res.status(404).json({ error: "Traceability chain not found" });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

traceabilityRouter.get("/:obligationId/:controlId/signoffs", async (req, res, next) => {
  try {
    res.json(
      await listSignoffs(req.user!.organizationId, req.params.obligationId, req.params.controlId)
    );
  } catch (err) {
    next(err);
  }
});

traceabilityRouter.post(
  "/:obligationId/:controlId/signoff",
  requireRole("ADMIN", "EDITOR"),
  async (req, res, next) => {
    try {
      const input = signoffSchema.parse(req.body ?? {});
      const result = await signoffChain(
        req.user!.organizationId,
        req.user!.id,
        req.params.obligationId,
        req.params.controlId,
        input
      );
      if (!result) return res.status(404).json({ error: "Traceability chain not found" });
      await auditAsUser(req, {
        type: "APPROVAL",
        action: `Traceability signed off (${input.signedRole})`,
        detail: result.link.requirementText.slice(0, 200),
        objectType: "OBLIGATION",
        objectId: result.link.obligationId,
        context: result.link.circularCode,
      });
      res.status(201).json(result.signoff);
    } catch (err) {
      next(err);
    }
  }
);

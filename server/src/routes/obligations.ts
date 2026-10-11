import {
  linkObligationControlSchema,
  updateObligationSchema,
  upsertApplicabilitySchema,
} from "@complianceos/shared";
import { Router } from "express";
import { runObligationExtraction } from "../ai/agents/obligationExtractionAgent.js";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import { getCircular } from "../services/circularService.js";
import {
  deleteObligation,
  linkObligationControl,
  listControlsForObligation,
  listObligationSummaries,
  listObligationsByCircular,
  listObligationsForControl,
  unlinkObligationControl,
  updateObligation,
  upsertApplicability,
} from "../services/obligationService.js";

export const obligationsRouter = Router();

obligationsRouter.get("/obligations/summary", async (req, res, next) => {
  try {
    res.json(await listObligationSummaries(req.user!.organizationId));
  } catch (err) {
    next(err);
  }
});

obligationsRouter.get("/circulars/:circularId/obligations", async (req, res, next) => {
  try {
    const circular = await getCircular(req.user!.organizationId, req.params.circularId);
    if (!circular) return res.status(404).json({ error: "Circular not found" });
    res.json(await listObligationsByCircular(req.user!.organizationId, req.params.circularId));
  } catch (err) {
    next(err);
  }
});

// Runs the Obligation Extraction Agent synchronously — a completion call
// per ~6000-char chunk of the circular, typically a few seconds — and
// returns the persisted rows plus a summary of dedupe/grounding outcomes so
// the caller can see how much the agent trusted its own output.
obligationsRouter.post(
  "/circulars/:circularId/obligations/extract",
  requireRole("ADMIN", "EDITOR"),
  async (req, res, next) => {
    try {
      const circular = await getCircular(req.user!.organizationId, req.params.circularId);
      if (!circular) return res.status(404).json({ error: "Circular not found" });
      const summary = await runObligationExtraction(req.user!.organizationId, circular);
      await auditAsUser(req, {
        type: "AI",
        action: "Obligation extraction requested",
        objectType: "CIRCULAR",
        objectId: circular.id,
        context: circular.circularId,
      });
      res.status(201).json(summary);
    } catch (err) {
      next(err);
    }
  }
);

obligationsRouter.patch("/obligations/:id", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = updateObligationSchema.parse(req.body);
    const obligation = await updateObligation(
      req.user!.organizationId,
      req.params.id,
      input,
      req.user!.id
    );
    if (!obligation) return res.status(404).json({ error: "Obligation not found" });
    await auditAsUser(req, {
      type: input.status === "CONFIRMED" || input.status === "DISMISSED" ? "APPROVAL" : "EDIT",
      action: input.status ? `Obligation ${input.status.toLowerCase()}` : "Obligation updated",
      detail: obligation.requirementText.slice(0, 200),
      objectType: "OBLIGATION",
      objectId: obligation.id,
      context: obligation.identifier,
    });
    res.json(obligation);
  } catch (err) {
    next(err);
  }
});

obligationsRouter.delete("/obligations/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const deleted = await deleteObligation(req.user!.organizationId, req.params.id);
    if (!deleted) return res.status(404).json({ error: "Obligation not found" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Obligation deleted",
      objectType: "OBLIGATION",
      objectId: req.params.id,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

obligationsRouter.put(
  "/obligations/:id/applicability",
  requireRole("ADMIN", "EDITOR"),
  async (req, res, next) => {
    try {
      const input = upsertApplicabilitySchema.parse(req.body);
      const row = await upsertApplicability(req.user!.organizationId, req.params.id, input);
      if (!row) return res.status(404).json({ error: "Obligation not found" });
      await auditAsUser(req, {
        type: "EDIT",
        action: "Obligation applicability set",
        detail: row.status,
        objectType: "OBLIGATION",
        objectId: req.params.id,
      });
      res.json(row);
    } catch (err) {
      next(err);
    }
  }
);

obligationsRouter.get("/obligations/:id/controls", async (req, res, next) => {
  try {
    const rows = await listControlsForObligation(req.user!.organizationId, req.params.id);
    if (!rows) return res.status(404).json({ error: "Obligation not found" });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

obligationsRouter.post(
  "/obligations/:id/controls",
  requireRole("ADMIN", "EDITOR"),
  async (req, res, next) => {
    try {
      const input = linkObligationControlSchema.parse(req.body);
      const row = await linkObligationControl(req.user!.organizationId, req.params.id, input);
      if (!row) return res.status(404).json({ error: "Obligation or control not found" });
      await auditAsUser(req, {
        type: "EDIT",
        action: "Control mapped to obligation",
        detail: `control ${input.controlId}`,
        objectType: "OBLIGATION",
        objectId: req.params.id,
      });
      res.status(201).json(row);
    } catch (err) {
      next(err);
    }
  }
);

obligationsRouter.delete(
  "/obligations/:id/controls/:controlId",
  requireRole("ADMIN", "EDITOR"),
  async (req, res, next) => {
    try {
      const ok = await unlinkObligationControl(
        req.user!.organizationId,
        req.params.id,
        req.params.controlId
      );
      if (!ok) return res.status(404).json({ error: "Mapping not found" });
      await auditAsUser(req, {
        type: "EDIT",
        action: "Control unmapped from obligation",
        detail: `control ${req.params.controlId}`,
        objectType: "OBLIGATION",
        objectId: req.params.id,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

obligationsRouter.get("/controls/:controlId/obligations", async (req, res, next) => {
  try {
    const rows = await listObligationsForControl(req.user!.organizationId, req.params.controlId);
    if (!rows) return res.status(404).json({ error: "Control not found" });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

import {
  createControlTestSchema,
  createEvidenceSchema,
  createMonitoringKpiSchema,
  recordTestRunSchema,
  updateEvidenceSchema,
  updateMonitoringKpiSchema,
} from "@complianceos/shared";
import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import {
  createEvidence,
  createKpi,
  createTest,
  deleteEvidence,
  deleteKpi,
  deleteTest,
  linkControlQuestion,
  listControlQuestions,
  listEvidence,
  listKpis,
  listTestRuns,
  listTests,
  recordTestRun,
  unlinkControlQuestion,
  updateEvidence,
  updateKpi,
} from "../services/controlDetailService.js";

// Mounted at the app root; every path is fully specified.
export const controlDetailsRouter = Router();

const linkQuestionSchema = z.object({ questionId: z.string().min(1) });
const writer = requireRole("ADMIN", "EDITOR");
const admin = requireRole("ADMIN");
const NOT_FOUND_CTL = { error: "Control not found" };
const NOT_WRITABLE_CTL = { error: "Control not found or not editable" };

// ---- Questions ----

controlDetailsRouter.get("/controls/:controlId/questions", async (req, res, next) => {
  try {
    const rows = await listControlQuestions(req.user!.organizationId, req.params.controlId);
    if (!rows) return res.status(404).json(NOT_FOUND_CTL);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

controlDetailsRouter.post("/controls/:controlId/questions", writer, async (req, res, next) => {
  try {
    const { questionId } = linkQuestionSchema.parse(req.body);
    const q = await linkControlQuestion(req.user!.organizationId, req.params.controlId, questionId);
    if (!q) return res.status(404).json({ error: "Control not editable or question not found" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Question linked to control",
      detail: q.title,
      objectType: "CONTROL",
      objectId: req.params.controlId,
    });
    res.status(201).json(q);
  } catch (err) {
    next(err);
  }
});

controlDetailsRouter.delete(
  "/controls/:controlId/questions/:questionId",
  writer,
  async (req, res, next) => {
    try {
      const ok = await unlinkControlQuestion(
        req.user!.organizationId,
        req.params.controlId,
        req.params.questionId
      );
      if (!ok) return res.status(404).json({ error: "Link not found or control not editable" });
      await auditAsUser(req, {
        type: "EDIT",
        action: "Question unlinked from control",
        objectType: "CONTROL",
        objectId: req.params.controlId,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

// ---- Evidence ----

controlDetailsRouter.get("/controls/:controlId/evidence", async (req, res, next) => {
  try {
    const rows = await listEvidence(req.user!.organizationId, req.params.controlId);
    if (!rows) return res.status(404).json(NOT_FOUND_CTL);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

controlDetailsRouter.post("/controls/:controlId/evidence", writer, async (req, res, next) => {
  try {
    const input = createEvidenceSchema.parse(req.body);
    const ev = await createEvidence(req.user!.organizationId, req.params.controlId, input);
    if (!ev) return res.status(404).json({ error: "Control or document not found" });
    await auditAsUser(req, {
      type: "UPLOAD",
      action: "Evidence added",
      detail: ev.name,
      objectType: "CONTROL",
      objectId: ev.controlId,
    });
    res.status(201).json(ev);
  } catch (err) {
    next(err);
  }
});

controlDetailsRouter.patch("/evidence/:id", writer, async (req, res, next) => {
  try {
    const input = updateEvidenceSchema.parse(req.body);
    const ev = await updateEvidence(req.user!.organizationId, req.params.id, input);
    if (!ev) return res.status(404).json({ error: "Evidence or document not found" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Evidence updated",
      detail: ev.name,
      objectType: "CONTROL",
      objectId: ev.controlId,
    });
    res.json(ev);
  } catch (err) {
    next(err);
  }
});

controlDetailsRouter.delete("/evidence/:id", admin, async (req, res, next) => {
  try {
    const ev = await deleteEvidence(req.user!.organizationId, req.params.id);
    if (!ev) return res.status(404).json({ error: "Evidence not found" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Evidence removed",
      detail: ev.name,
      objectType: "CONTROL",
      objectId: ev.controlId,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---- Tests ----

controlDetailsRouter.get("/controls/:controlId/tests", async (req, res, next) => {
  try {
    const rows = await listTests(req.user!.organizationId, req.params.controlId);
    if (!rows) return res.status(404).json(NOT_FOUND_CTL);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

controlDetailsRouter.post("/controls/:controlId/tests", writer, async (req, res, next) => {
  try {
    const input = createControlTestSchema.parse(req.body);
    const t = await createTest(req.user!.organizationId, req.params.controlId, input);
    if (!t) return res.status(404).json(NOT_WRITABLE_CTL);
    await auditAsUser(req, {
      type: "CREATE",
      action: "Control test defined",
      detail: t.testType,
      objectType: "CONTROL",
      objectId: t.controlId,
    });
    res.status(201).json(t);
  } catch (err) {
    next(err);
  }
});

controlDetailsRouter.get("/tests/:testId/runs", async (req, res, next) => {
  try {
    const rows = await listTestRuns(req.user!.organizationId, req.params.testId);
    if (!rows) return res.status(404).json({ error: "Test not found" });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

controlDetailsRouter.post("/tests/:testId/runs", writer, async (req, res, next) => {
  try {
    const input = recordTestRunSchema.parse(req.body);
    const run = await recordTestRun(req.user!.organizationId, req.params.testId, input);
    if (!run) return res.status(404).json({ error: "Test not found or not editable" });
    await auditAsUser(req, {
      type: "STATUS",
      action: "Control test run recorded",
      detail: run.result,
      objectType: "CONTROL_TEST",
      objectId: req.params.testId,
    });
    res.status(201).json(run);
  } catch (err) {
    next(err);
  }
});

controlDetailsRouter.delete("/tests/:id", admin, async (req, res, next) => {
  try {
    const t = await deleteTest(req.user!.organizationId, req.params.id);
    if (!t) return res.status(404).json({ error: "Test not found or not deletable" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Control test removed",
      detail: t.testType,
      objectType: "CONTROL",
      objectId: t.controlId,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---- KPIs ----

controlDetailsRouter.get("/controls/:controlId/kpis", async (req, res, next) => {
  try {
    const rows = await listKpis(req.user!.organizationId, req.params.controlId);
    if (!rows) return res.status(404).json(NOT_FOUND_CTL);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

controlDetailsRouter.post("/controls/:controlId/kpis", writer, async (req, res, next) => {
  try {
    const input = createMonitoringKpiSchema.parse(req.body);
    const k = await createKpi(req.user!.organizationId, req.params.controlId, input);
    if (!k) return res.status(404).json(NOT_WRITABLE_CTL);
    await auditAsUser(req, {
      type: "CREATE",
      action: "Monitoring KPI added",
      detail: k.kpi,
      objectType: "CONTROL",
      objectId: k.controlId,
    });
    res.status(201).json(k);
  } catch (err) {
    next(err);
  }
});

controlDetailsRouter.patch("/kpis/:id", writer, async (req, res, next) => {
  try {
    const input = updateMonitoringKpiSchema.parse(req.body);
    const k = await updateKpi(req.user!.organizationId, req.params.id, input);
    if (!k) return res.status(404).json({ error: "KPI not found or not editable" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Monitoring KPI updated",
      detail: k.kpi,
      objectType: "CONTROL",
      objectId: k.controlId,
    });
    res.json(k);
  } catch (err) {
    next(err);
  }
});

controlDetailsRouter.delete("/kpis/:id", admin, async (req, res, next) => {
  try {
    const k = await deleteKpi(req.user!.organizationId, req.params.id);
    if (!k) return res.status(404).json({ error: "KPI not found or not deletable" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Monitoring KPI removed",
      detail: k.kpi,
      objectType: "CONTROL",
      objectId: k.controlId,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

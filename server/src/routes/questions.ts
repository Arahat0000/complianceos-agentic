import { createQuestionSchema, updateQuestionSchema } from "@complianceos/shared";
import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import {
  createQuestion,
  deleteQuestion,
  getQuestion,
  listQuestions,
  updateQuestion,
} from "../services/questionService.js";

export const questionsRouter = Router();

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

questionsRouter.get("/", async (req, res, next) => {
  try {
    res.json(
      await listQuestions(req.user!.organizationId, {
        circularId: str(req.query.circularId),
        controlId: str(req.query.controlId),
      })
    );
  } catch (err) {
    next(err);
  }
});

questionsRouter.get("/:id", async (req, res, next) => {
  try {
    const q = await getQuestion(req.user!.organizationId, req.params.id);
    if (!q) return res.status(404).json({ error: "Question not found" });
    res.json(q);
  } catch (err) {
    next(err);
  }
});

questionsRouter.post("/", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = createQuestionSchema.parse(req.body);
    const q = await createQuestion(req.user!.organizationId, input);
    if (!q) return res.status(404).json({ error: "Circular or control not found" });
    await auditAsUser(req, {
      type: "CREATE",
      action: "Question created",
      detail: q.title,
      objectType: "QUESTION",
      objectId: q.id,
    });
    res.status(201).json(q);
  } catch (err) {
    next(err);
  }
});

questionsRouter.patch("/:id", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = updateQuestionSchema.parse(req.body);
    const q = await updateQuestion(req.user!.organizationId, req.params.id, input);
    if (!q) return res.status(404).json({ error: "Question not found or not editable" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Question updated",
      detail: q.title,
      objectType: "QUESTION",
      objectId: q.id,
    });
    res.json(q);
  } catch (err) {
    next(err);
  }
});

questionsRouter.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const ok = await deleteQuestion(req.user!.organizationId, req.params.id);
    if (!ok) return res.status(404).json({ error: "Question not found or not deletable" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Question deleted",
      objectType: "QUESTION",
      objectId: req.params.id,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

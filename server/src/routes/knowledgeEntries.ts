import { createKnowledgeEntrySchema, updateKnowledgeEntrySchema } from "@complianceos/shared";
import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import {
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  getKnowledgeEntry,
  listKnowledgeEntries,
  updateKnowledgeEntry,
} from "../services/knowledgeEntryService.js";

export const knowledgeEntriesRouter = Router();

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const truncate = (s: string) => (s.length > 120 ? `${s.slice(0, 117)}...` : s);

knowledgeEntriesRouter.get("/", async (req, res, next) => {
  try {
    res.json(
      await listKnowledgeEntries(req.user!.organizationId, {
        status: str(req.query.status),
        q: str(req.query.q),
      })
    );
  } catch (err) {
    next(err);
  }
});

knowledgeEntriesRouter.get("/:id", async (req, res, next) => {
  try {
    const entry = await getKnowledgeEntry(req.user!.organizationId, req.params.id);
    if (!entry) return res.status(404).json({ error: "Knowledge entry not found" });
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

knowledgeEntriesRouter.post("/", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = createKnowledgeEntrySchema.parse(req.body);
    const entry = await createKnowledgeEntry(req.user!.organizationId, req.user!.id, input);
    await auditAsUser(req, {
      type: "CREATE",
      action: "Created knowledge entry",
      detail: truncate(entry.question),
      objectType: "KB_ENTRY",
      objectId: entry.id,
    });
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

knowledgeEntriesRouter.patch("/:id", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = updateKnowledgeEntrySchema.parse(req.body);
    const entry = await updateKnowledgeEntry(req.user!.organizationId, req.params.id, input);
    if (!entry) return res.status(404).json({ error: "Knowledge entry not found" });
    await auditAsUser(req, {
      type: input.status ? "STATUS" : "EDIT",
      action: "Updated knowledge entry",
      detail: truncate(entry.question),
      objectType: "KB_ENTRY",
      objectId: entry.id,
    });
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

knowledgeEntriesRouter.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const entry = await deleteKnowledgeEntry(req.user!.organizationId, req.params.id);
    if (!entry) return res.status(404).json({ error: "Knowledge entry not found" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Deleted knowledge entry",
      detail: truncate(entry.question),
      objectType: "KB_ENTRY",
      objectId: entry.id,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

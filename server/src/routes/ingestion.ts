import { promoteItemsSchema, reviewItemSchema, uploadIngestionSchema } from "@complianceos/shared";
import { Router } from "express";
import type { NextFunction, Response } from "express";
import multer from "multer";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import {
  createIngestedFile,
  deleteIngestedFile,
  getIngestedFileDetail,
  getPageImage,
  IngestionInputError,
  listIngestedFiles,
  processFile,
  promoteItems,
  reviewItem,
} from "../services/ingestion/ingestionService.js";
import { storage } from "../storage/index.js";

export const ingestionRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.INGEST_MAX_MB ?? 50) * 1024 * 1024 },
});

function fail(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof IngestionInputError) return res.status(400).json({ error: err.message });
  next(err);
}

ingestionRouter.post("/files", requireRole("ADMIN", "EDITOR"), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });
    const input = uploadIngestionSchema.parse(req.body);
    const f = await createIngestedFile(req.user!.organizationId, req.user!.id, req.file, input);
    await auditAsUser(req, { type: "UPLOAD", action: "Uploaded source for multimodal extraction", detail: f.fileName, objectType: "INGESTED_FILE", objectId: f.id });
    res.status(202).json(f);
  } catch (err) {
    fail(err, res, next);
  }
});

ingestionRouter.get("/files", async (req, res, next) => {
  try {
    res.json(await listIngestedFiles(req.user!.organizationId));
  } catch (err) {
    next(err);
  }
});

ingestionRouter.get("/files/:id", async (req, res, next) => {
  try {
    const f = await getIngestedFileDetail(req.user!.organizationId, req.params.id);
    if (!f) return res.status(404).json({ error: "File not found" });
    res.json(f);
  } catch (err) {
    next(err);
  }
});

// Streams the page image (send the bearer token). `?url=1` returns a short-lived signed URL
// instead, usable directly as <img src> where the storage mode supports it.
ingestionRouter.get("/files/:id/pages/:n/image", async (req, res, next) => {
  try {
    const n = Number(req.params.n);
    if (!Number.isInteger(n) || n < 1) return res.status(400).json({ error: "Invalid page number" });
    const img = await getPageImage(req.user!.organizationId, req.params.id, n);
    if (!img) return res.status(404).json({ error: "Page image not found" });
    if (req.query.url === "1") return res.json({ url: await storage.getSignedUrl(img.key, 300) });
    res.setHeader("content-type", img.mime);
    res.setHeader("cache-control", "private, max-age=300");
    res.send(await storage.download(img.key));
  } catch (err) {
    next(err);
  }
});

ingestionRouter.post("/files/:id/reprocess", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const f = await getIngestedFileDetail(req.user!.organizationId, req.params.id);
    if (!f) return res.status(404).json({ error: "File not found" });
    if (f.status === "PROCESSING") return res.status(409).json({ error: "Already processing" });
    void processFile(f.id).catch((e) => console.error("ingestion failed:", e));
    res.status(202).json({ id: f.id });
  } catch (err) {
    next(err);
  }
});

ingestionRouter.patch("/items/:id", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = reviewItemSchema.parse(req.body);
    const r = await reviewItem(req.user!.organizationId, req.user!.id, req.params.id, input);
    if (!r) return res.status(404).json({ error: "Item not found" });
    await auditAsUser(req, {
      type: "APPROVAL",
      action: `Reviewed extracted item: ${input.reviewStatus}`,
      detail: `${r.fileName} - ${r.item.label ?? r.item.kind}`,
      objectType: "EXTRACTED_ITEM",
      objectId: r.item.id,
    });
    res.json(r.item);
  } catch (err) {
    fail(err, res, next);
  }
});

ingestionRouter.post("/files/:id/promote", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = promoteItemsSchema.parse(req.body);
    const r = await promoteItems(req.user!.organizationId, req.params.id, input);
    if (!r) return res.status(404).json({ error: "File not found" });
    await auditAsUser(req, {
      type: "CREATE",
      action: `Promoted extracted items to ${input.target.toLowerCase()}`,
      detail: `${r.obligations} obligations, ${r.controls} controls, ${r.evidence} evidence`,
      objectType: "INGESTED_FILE",
      objectId: req.params.id,
    });
    res.json(r);
  } catch (err) {
    fail(err, res, next);
  }
});

ingestionRouter.delete("/files/:id", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    if (!(await deleteIngestedFile(req.user!.organizationId, req.params.id))) return res.status(404).json({ error: "File not found" });
    await auditAsUser(req, { type: "STATUS", action: "Deleted ingested file", objectType: "INGESTED_FILE", objectId: req.params.id });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

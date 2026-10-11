import {
  createDocumentSchema,
  createDocumentVersionSchema,
  updateDocumentSchema,
} from "@complianceos/shared";
import { Router } from "express";
import multer from "multer";
import { requireRole } from "../auth/middleware.js";
import {
  addDocumentVersion,
  createDocument,
  deleteDocument,
  getDocument,
  getDocumentDownloadUrl,
  listDocuments,
  updateDocument,
} from "../services/documentService.js";
import { auditAsUser } from "../services/audit.js";

export const documentsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

documentsRouter.get("/", async (req, res, next) => {
  try {
    res.json(
      await listDocuments(req.user!.organizationId, {
        status: str(req.query.status),
        type: str(req.query.type),
        expiring: req.query.expiring === "true",
      })
    );
  } catch (err) {
    next(err);
  }
});

documentsRouter.get("/:id/download-url", async (req, res, next) => {
  try {
    const result = await getDocumentDownloadUrl(req.user!.organizationId, req.params.id);
    if (!result) return res.status(404).json({ error: "Document or file not found" });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

documentsRouter.get("/:id", async (req, res, next) => {
  try {
    const doc = await getDocument(req.user!.organizationId, req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

documentsRouter.post(
  "/",
  requireRole("ADMIN", "EDITOR"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: "file is required" });
      const input = createDocumentSchema.parse(req.body);
      const doc = await createDocument(req.user!.organizationId, req.user!.id, req.file, input);
      await auditAsUser(req, {
        type: "UPLOAD",
        action: "Uploaded document",
        detail: `${doc.name} (v${doc.version})`,
        objectType: "DOCUMENT",
        objectId: doc.id,
      });
      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  }
);

documentsRouter.patch("/:id", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const { change, ...rest } = (req.body ?? {}) as Record<string, unknown>;
    const input = updateDocumentSchema.parse(rest);
    const doc = await updateDocument(
      req.user!.organizationId,
      req.user!.id,
      req.params.id,
      input,
      str(change)
    );
    if (!doc) return res.status(404).json({ error: "Document not found" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Updated document",
      detail: doc.name,
      objectType: "DOCUMENT",
      objectId: doc.id,
    });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

documentsRouter.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const doc = await deleteDocument(req.user!.organizationId, req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Deleted document",
      detail: doc.name,
      objectType: "DOCUMENT",
      objectId: doc.id,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

documentsRouter.post(
  "/:id/versions",
  requireRole("ADMIN", "EDITOR"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const input = createDocumentVersionSchema.parse(req.body);
      const doc = await addDocumentVersion(
        req.user!.organizationId,
        req.user!.id,
        req.params.id,
        input,
        req.file
      );
      if (!doc) return res.status(404).json({ error: "Document not found" });
      await auditAsUser(req, {
        type: "UPLOAD",
        action: "Added document version",
        detail: `${doc.name} v${input.version}: ${input.change}`,
        objectType: "DOCUMENT",
        objectId: doc.id,
      });
      res.status(201).json(doc);
    } catch (err) {
      next(err);
    }
  }
);

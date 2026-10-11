import { z } from "zod";
import {
  DocumentClassification,
  DocumentStatus,
  DocumentType,
} from "../types/enums.js";

// multer/busboy parses a multipart field into an array only when the same
// field name appears more than once — a single repeated "tags" entry (the
// common case: one tag, or none) arrives as a plain string instead, which
// z.array(z.string()) then rejects. Coerce that one case back into an array
// so create-document uploads aren't sensitive to how many tags were sent.
const tagsField = z.preprocess(
  (val) => (typeof val === "string" ? [val] : val),
  z.array(z.string()).optional()
);

export const createDocumentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(DocumentType).optional(),
  status: z.enum(DocumentStatus).default("ACTIVE"),
  classification: z.enum(DocumentClassification).optional(),
  department: z.string().optional(),
  owner: z.string().optional(),
  version: z.string().optional(),
  tags: tagsField,
  effectiveDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  lastRenewalDate: z.coerce.date().optional(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(DocumentType).optional(),
  status: z.enum(DocumentStatus).optional(),
  classification: z.enum(DocumentClassification).optional(),
  department: z.string().optional(),
  owner: z.string().optional(),
  version: z.string().optional(),
  tags: z.array(z.string()).optional(),
  effectiveDate: z.coerce.date().nullable().optional(),
  expiryDate: z.coerce.date().nullable().optional(),
  lastRenewalDate: z.coerce.date().nullable().optional(),
});
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

// POST /documents/:id/versions
export const createDocumentVersionSchema = z.object({
  version: z.string().min(1),
  change: z.string().min(1),
});
export type CreateDocumentVersionInput = z.infer<typeof createDocumentVersionSchema>;

import { z } from "zod";
import { SourceModality } from "../types/enums.js";

// POST /ingestion/files (multipart: field "file" + these text fields)
export const uploadIngestionSchema = z.object({
  // Regulatory source: promote clauses into obligations of this circular.
  circularId: z.string().min(1).optional(),
  // Evidence screenshot: facts are attached to this control.
  controlId: z.string().min(1).optional(),
  // Optional hint; otherwise inferred from mime type / extension.
  modality: z.enum(SourceModality).optional(),
});
export type UploadIngestionInput = z.infer<typeof uploadIngestionSchema>;

// PATCH /ingestion/items/:id — the reviewer's decision on one extracted item.
export const reviewItemSchema = z
  .object({
    reviewStatus: z.enum(["ACCEPTED", "CORRECTED", "REJECTED"]),
    correctedContent: z.string().min(1).optional(),
  })
  .refine((v) => v.reviewStatus !== "CORRECTED" || !!v.correctedContent, {
    message: "correctedContent is required when correcting an item",
    path: ["correctedContent"],
  });
export type ReviewItemInput = z.infer<typeof reviewItemSchema>;

// POST /ingestion/files/:id/promote — turn reviewed items into pipeline records.
export const promoteItemsSchema = z.object({
  // Default: every AGREED / ACCEPTED / CORRECTED item of a promotable kind.
  itemIds: z.array(z.string()).optional(),
  // CLAUSE + DIAGRAM steps -> obligations; ROW -> controls; FACT -> control evidence.
  target: z.enum(["OBLIGATIONS", "CONTROLS", "EVIDENCE"]),
  circularId: z.string().min(1).optional(),
  controlId: z.string().min(1).optional(),
});
export type PromoteItemsInput = z.infer<typeof promoteItemsSchema>;

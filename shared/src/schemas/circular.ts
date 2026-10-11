import { z } from "zod";
import { CircularCategory, CircularKind, CircularStatus, Regulator } from "../types/enums.js";

export const createCircularSchema = z.object({
  circularId: z.string().min(1),
  reference: z.string().optional(),
  name: z.string().min(1),
  regulator: z.enum(Regulator).default("OTHER"),
  kind: z.enum(CircularKind).default("CIRCULAR"),
  category: z.enum(CircularCategory).default("COMPLIANCE"),
  categoryCode: z.string().optional(),
  description: z.string().optional(),
  // Full circular text — what the Obligation Extraction Agent reads. Optional
  // because a circular can be registered from metadata alone.
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dateOfIssue: z.coerce.date().optional(),
  lastUpdated: z.coerce.date().optional(),
  status: z.enum(CircularStatus).default("ACTIVE"),
  version: z.string().optional(),
  link: z.string().url().optional(),
  linkRef: z.string().optional(),
  applicableTo: z.string().optional(),
  filePath: z.string().optional(),
  supersededById: z.string().optional(),
});
export type CreateCircularInput = z.infer<typeof createCircularSchema>;

export const updateCircularSchema = createCircularSchema
  .omit({ circularId: true })
  .partial()
  .extend({
    supersededById: z.string().nullable().optional(),
  });
export type UpdateCircularInput = z.infer<typeof updateCircularSchema>;

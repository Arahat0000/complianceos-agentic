import { z } from "zod";
import { KBStatus, SourceType } from "../types/enums.js";

export const createKnowledgeEntrySchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  sourceType: z.enum(SourceType).default("INTERNAL"),
  sourceAssessment: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(KBStatus).default("DRAFT"),
  controlIds: z.array(z.string()).optional(),
});
export type CreateKnowledgeEntryInput = z.infer<typeof createKnowledgeEntrySchema>;

export const updateKnowledgeEntrySchema = createKnowledgeEntrySchema.partial();
export type UpdateKnowledgeEntryInput = z.infer<typeof updateKnowledgeEntrySchema>;

import { z } from "zod";

// GET /dashboard/pipeline-activity?days=90
export const pipelineActivityQuerySchema = z.object({
  days: z.coerce.number().int().refine((n) => [7, 30, 90].includes(n), "days must be 7, 30 or 90").default(90),
});
export type PipelineActivityQuery = z.infer<typeof pipelineActivityQuerySchema>;

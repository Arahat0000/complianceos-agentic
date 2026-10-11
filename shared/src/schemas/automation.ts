import { z } from "zod";

// Allowed schedule cadences in hours (1h, 6h, 12h, daily, weekly).
export const AGENT_INTERVAL_HOURS = [1, 6, 12, 24, 168] as const;

// PUT /automation/control-answers — Controls page "autonomous answering" panel.
export const updateAgentScheduleSchema = z.object({
  enabled: z.boolean().optional(),
  intervalHours: z
    .number()
    .int()
    .refine((n) => (AGENT_INTERVAL_HOURS as readonly number[]).includes(n), "Unsupported interval")
    .optional(),
  config: z
    .object({
      // Only answer controls that have no answer yet (default true).
      onlyEmpty: z.boolean().default(true),
      // Cap on controls answered per run (default 50).
      maxPerRun: z.number().int().min(1).max(500).default(50),
    })
    .partial()
    .optional(),
});
export type UpdateAgentScheduleInput = z.infer<typeof updateAgentScheduleSchema>;

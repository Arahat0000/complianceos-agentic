import { z } from "zod";
import { ActionStatus, RemediationStatus } from "../types/enums.js";

// What the remediation agent must return: a readable plan plus structured
// actions that get persisted as RemediationPlan + RemediationAction rows.
export const generatedRemediationPlanSchema = z.object({
  planText: z.string().min(1),
  leadTeam: z.string().optional(),
  slaDays: z.number().int().positive().optional(),
  actionSummary: z.string().optional(),
  actions: z
    .array(
      z.object({
        title: z.string().min(1),
        ownerName: z.string().optional(),
        dueInDays: z.number().int().nonnegative().optional(),
      })
    )
    .default([]),
});
export type GeneratedRemediationPlan = z.infer<typeof generatedRemediationPlanSchema>;

export const updateRemediationPlanSchema = z.object({
  planText: z.string().min(1).optional(),
  workOrderId: z.string().optional(),
  leadTeam: z.string().optional(),
  slaDays: z.number().int().positive().nullable().optional(),
  actionSummary: z.string().optional(),
  status: z.enum(RemediationStatus).optional(),
});
export type UpdateRemediationPlanInput = z.infer<typeof updateRemediationPlanSchema>;

export const createRemediationActionSchema = z.object({
  title: z.string().min(1),
  ownerId: z.string().optional(),
  ownerName: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  position: z.number().int().nonnegative().optional(),
});
export type CreateRemediationActionInput = z.infer<typeof createRemediationActionSchema>;

export const updateRemediationActionSchema = createRemediationActionSchema
  .partial()
  .extend({ status: z.enum(ActionStatus).optional() });
export type UpdateRemediationActionInput = z.infer<typeof updateRemediationActionSchema>;

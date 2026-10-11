import { z } from "zod";
import { GapStatus, RiskLevel } from "../types/enums.js";

export const createComplianceGapSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  riskLevel: z.enum(RiskLevel).default("MEDIUM"),
  // Pipeline links: which obligation/control/question this gap is about.
  obligationId: z.string().optional(),
  controlId: z.string().optional(),
  questionId: z.string().optional(),
  assigneeId: z.string().optional(),
  // Audit engagement label shown in the Gaps table's "Assessment" column.
  engagementName: z.string().optional(),
  section: z.string().optional(),
  evidenceNeeded: z.string().optional(),
  dueDate: z.coerce.date().optional(),
});
export type CreateComplianceGapInput = z.infer<typeof createComplianceGapSchema>;

export const updateComplianceGapSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  riskLevel: z.enum(RiskLevel).optional(),
  status: z.enum(GapStatus).optional(),
  obligationId: z.string().nullable().optional(),
  controlId: z.string().nullable().optional(),
  questionId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  engagementName: z.string().optional(),
  section: z.string().optional(),
  evidenceNeeded: z.string().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  // Required by the server when status moves to RISK_ACCEPTED.
  riskAcceptedReason: z.string().optional(),
  riskAcceptanceExpiresAt: z.coerce.date().nullable().optional(),
});
export type UpdateComplianceGapInput = z.infer<typeof updateComplianceGapSchema>;

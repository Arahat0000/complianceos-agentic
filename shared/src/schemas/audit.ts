import { z } from "zod";
import { AuditActorType, AuditEventType } from "../types/enums.js";

// Used by services that write audit rows (see server/src/services/audit.ts).
export const recordAuditSchema = z.object({
  actorType: z.enum(AuditActorType).default("USER"),
  actorName: z.string().min(1),
  type: z.enum(AuditEventType),
  action: z.string().min(1),
  detail: z.string().optional(),
  objectType: z.string().optional(),
  objectId: z.string().optional(),
  context: z.string().optional(),
  ip: z.string().optional(),
});
export type RecordAuditInput = z.infer<typeof recordAuditSchema>;

// GET /audit-log query string.
export const auditLogQuerySchema = z.object({
  type: z.enum(AuditEventType).optional(),
  actorType: z.enum(AuditActorType).optional(),
  objectType: z.string().optional(),
  objectId: z.string().optional(),
  search: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

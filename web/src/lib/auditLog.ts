import type { AuditLogEntry } from "@complianceos/shared";
import { apiFetch } from "./api";

export type BackendAuditLogEntry = AuditLogEntry;

export function fetchAuditLog(): Promise<BackendAuditLogEntry[]> {
  return apiFetch<BackendAuditLogEntry[]>("/audit-log");
}

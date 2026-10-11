import { randomUUID } from "node:crypto";
import type { Request } from "express";
import type { AuditActorType, AuditEventType } from "@complianceos/shared";
import { pool } from "../db/pool.js";

export interface AuditEvent {
  organizationId: string;
  actorType?: AuditActorType; // defaults to USER
  actorUserId?: string | null;
  actorName: string;
  type: AuditEventType;
  action: string;
  detail?: string | null;
  objectType?: string | null; // CIRCULAR, OBLIGATION, CONTROL, GAP, DOCUMENT, KB_ENTRY, SETTINGS, ...
  objectId?: string | null;
  context?: string | null; // circular code / engagement label shown on the row
  ip?: string | null;
}

// Best-effort: an audit write must never fail the request that triggered it.
async function recordAudit(event: AuditEvent): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO "AuditLog"
         (id, "organizationId", "actorType", "actorUserId", "actorName", type, action,
          detail, "objectType", "objectId", context, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        randomUUID(),
        event.organizationId,
        event.actorType ?? "USER",
        event.actorUserId ?? null,
        event.actorName,
        event.type,
        event.action,
        event.detail ?? null,
        event.objectType ?? null,
        event.objectId ?? null,
        event.context ?? null,
        event.ip ?? null,
      ]
    );
  } catch (err) {
    console.error("audit write failed:", err);
  }
}

async function userName(userId: string): Promise<string> {
  const { rows } = await pool.query<{ name: string }>('SELECT name FROM "User" WHERE id = $1', [userId]);
  return rows[0]?.name ?? "Unknown user";
}

// Convenience wrapper: records an event performed by the authenticated user
// of `req` (org, user id, display name and client IP filled in).
export async function auditAsUser(
  req: Request,
  event: Omit<AuditEvent, "organizationId" | "actorType" | "actorUserId" | "actorName" | "ip">
): Promise<void> {
  const user = req.user!;
  await recordAudit({
    ...event,
    organizationId: user.organizationId,
    actorType: "USER",
    actorUserId: user.id,
    actorName: await userName(user.id),
    ip: req.ip ?? null,
  });
}

// For events performed by the AI assistant (extraction, mapping, plans).
export function auditAsAi(
  organizationId: string,
  event: Omit<AuditEvent, "organizationId" | "actorType" | "actorUserId" | "actorName" | "ip">
): Promise<void> {
  return recordAudit({ ...event, organizationId, actorType: "AI", actorName: "AI Assistant" });
}

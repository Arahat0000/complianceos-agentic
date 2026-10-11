import { auditLogQuerySchema } from "@complianceos/shared";
import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import { auditLogCsv, queryAuditLog } from "../services/auditLogQueryService.js";

export const auditLogRouter = Router();

auditLogRouter.get("/", async (req, res, next) => {
  try {
    const query = auditLogQuerySchema.parse(req.query);
    const { entries, total } = await queryAuditLog(req.user!.organizationId, query);
    res.setHeader("X-Total-Count", String(total));
    res.json(entries);
  } catch (err) {
    next(err);
  }
});

// Registered before any /:id-style route; streams every row matching the filter.
auditLogRouter.get("/export.csv", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const query = auditLogQuerySchema.parse(req.query);
    const stream = auditLogCsv(req.user!.organizationId, query);
    // Pull the first chunk before sending headers so query errors reach next(err).
    const first = await stream.next();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="audit-log.csv"');
    if (!first.done) res.write(first.value);
    for await (const chunk of stream) {
      if (!res.write(chunk)) await new Promise((r) => res.once("drain", r));
    }
    res.end();
    await auditAsUser(req, {
      type: "EXPORT",
      action: "Exported audit log",
      detail: "CSV",
      objectType: "AUDIT_LOG",
    });
  } catch (err) {
    if (res.headersSent) res.end();
    else next(err);
  }
});

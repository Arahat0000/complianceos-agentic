import type { AuditLogEntry, AuditLogQuery } from "@complianceos/shared";
import { pool } from "../db/pool.js";
import type { AuditLogRow } from "../db/types.js";

function buildWhere(organizationId: string, q: AuditLogQuery): { where: string; params: unknown[] } {
  const conditions = ['"organizationId" = $1'];
  const params: unknown[] = [organizationId];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    conditions.push(sql.replace("?", `$${params.length}`));
  };
  if (q.type) add("type::text = ?", q.type);
  if (q.actorType) add('"actorType"::text = ?', q.actorType);
  if (q.objectType) add('"objectType" = ?', q.objectType);
  if (q.objectId) add('"objectId" = ?', q.objectId);
  if (q.from) add('"createdAt" >= ?', q.from);
  if (q.to) add('"createdAt" <= ?', q.to);
  if (q.search) {
    params.push(`%${q.search.replace(/[\\%_]/g, "\\$&")}%`);
    const n = `$${params.length}`;
    conditions.push(
      `(action ILIKE ${n} OR detail ILIKE ${n} OR "actorName" ILIKE ${n} OR context ILIKE ${n})`
    );
  }
  return { where: conditions.join(" AND "), params };
}

function toEntry(r: AuditLogRow): AuditLogEntry {
  return {
    id: r.id,
    actorType: r.actorType,
    actorUserId: r.actorUserId,
    actorName: r.actorName,
    type: r.type,
    action: r.action,
    detail: r.detail,
    objectType: r.objectType,
    objectId: r.objectId,
    context: r.context,
    ip: r.ip,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function queryAuditLog(
  organizationId: string,
  q: AuditLogQuery
): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const { where, params } = buildWhere(organizationId, q);
  const [rows, count] = await Promise.all([
    pool.query<AuditLogRow>(
      `SELECT * FROM "AuditLog" WHERE ${where}
        ORDER BY "createdAt" DESC, id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, q.limit, q.offset]
    ),
    pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM "AuditLog" WHERE ${where}`, params),
  ]);
  return { entries: rows.rows.map(toEntry), total: Number(count.rows[0].count) };
}

const CSV_COLUMNS = [
  "createdAt",
  "actorType",
  "actorName",
  "type",
  "action",
  "detail",
  "objectType",
  "objectId",
  "context",
  "ip",
] as const;

// Neutralise spreadsheet formula injection, then RFC 4180-quote.
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Async generator of CSV chunks, paged so large logs aren't held in memory.
// Ignores the query's limit/offset: the export covers every matching row.
export async function* auditLogCsv(
  organizationId: string,
  q: AuditLogQuery
): AsyncGenerator<string> {
  const { where, params } = buildWhere(organizationId, q);
  yield `${CSV_COLUMNS.join(",")}\r\n`;
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { rows } = await pool.query<AuditLogRow>(
      `SELECT * FROM "AuditLog" WHERE ${where}
        ORDER BY "createdAt" DESC, id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    );
    if (rows.length === 0) return;
    yield rows.map((r) => CSV_COLUMNS.map((c) => csvCell(r[c])).join(",")).join("\r\n") + "\r\n";
    if (rows.length < pageSize) return;
  }
}

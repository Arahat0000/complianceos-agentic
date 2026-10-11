import { randomUUID } from "node:crypto";
import type {
  CreateDocumentInput,
  CreateDocumentVersionInput,
  Document,
  DocumentVersion,
  UpdateDocumentInput,
} from "@complianceos/shared";
import { pool } from "../db/pool.js";
import { buildSet } from "../db/sql.js";
import type { DocumentRow, DocumentVersionRow } from "../db/types.js";
import { documentQueue } from "../jobs/queue.js";
import { storage } from "../storage/index.js";

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface DocumentFilters {
  status?: string;
  type?: string;
  expiring?: boolean;
}

export interface DocumentWithVersions extends Document {
  versions: DocumentVersion[];
}

// Zod parses "YYYY-MM-DD" to UTC midnight; send DATE columns as plain strings
// so the server timezone can't shift the day.
function toDateParam(d: Date | null | undefined): string | null | undefined {
  if (d === undefined) return undefined;
  return d === null ? null : d.toISOString().slice(0, 10);
}

// pg returns DATE as a local-midnight Date.
function fromDate(d: Date | null): string | null {
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function toDocument(r: DocumentRow): Document {
  return {
    ...r,
    size: r.size === null ? null : Number(r.size),
    effectiveDate: fromDate(r.effectiveDate),
    expiryDate: fromDate(r.expiryDate),
    lastRenewalDate: fromDate(r.lastRenewalDate),
    isAiRecommended: r.isAiRecommended ?? false,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toVersion(r: DocumentVersionRow): DocumentVersion {
  return {
    id: r.id,
    documentId: r.documentId,
    version: r.version,
    change: r.change,
    userId: r.userId,
    userName: r.userName,
    createdAt: r.createdAt.toISOString(),
  };
}

async function userName(userId: string): Promise<string> {
  const { rows } = await pool.query<{ name: string }>('SELECT name FROM "User" WHERE id = $1', [
    userId,
  ]);
  return rows[0]?.name ?? "Unknown user";
}

export async function listDocuments(
  organizationId: string,
  filters: DocumentFilters = {}
): Promise<Document[]> {
  const conditions = ['"organizationId" = $1'];
  const params: unknown[] = [organizationId];
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status::text = $${params.length}`);
  }
  if (filters.type) {
    params.push(filters.type);
    conditions.push(`type::text = $${params.length}`);
  }
  if (filters.expiring) {
    conditions.push(`"expiryDate" IS NOT NULL AND "expiryDate" <= CURRENT_DATE + INTERVAL '90 days'`);
  }
  const { rows } = await pool.query<DocumentRow>(
    `SELECT * FROM "Document" WHERE ${conditions.join(" AND ")} ORDER BY "createdAt" DESC`,
    params
  );
  return rows.map(toDocument);
}

export async function getDocument(
  organizationId: string,
  id: string
): Promise<DocumentWithVersions | null> {
  const { rows } = await pool.query<DocumentRow>(
    'SELECT * FROM "Document" WHERE id = $1 AND "organizationId" = $2',
    [id, organizationId]
  );
  if (!rows[0]) return null;
  const versions = await pool.query<DocumentVersionRow>(
    'SELECT * FROM "DocumentVersion" WHERE "documentId" = $1 ORDER BY "createdAt" DESC',
    [id]
  );
  return { ...toDocument(rows[0]), versions: versions.rows.map(toVersion) };
}

export async function createDocument(
  organizationId: string,
  userId: string,
  file: UploadedFile,
  input: CreateDocumentInput
): Promise<DocumentWithVersions> {
  const id = randomUUID();
  const key = `${organizationId}/documents/${id}-${file.originalname}`;
  const { path } = await storage.upload({ key, body: file.buffer, contentType: file.mimetype });
  const version = input.version ?? "1.0";
  const uploader = await userName(userId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO "Document"
         (id, "organizationId", name, description, path, size, type, status, "ingestionStatus",
          classification, department, owner, version, tags, "effectiveDate", "expiryDate",
          "lastRenewalDate", "uploadedById")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDING',$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        id,
        organizationId,
        input.name,
        input.description ?? null,
        path,
        file.size,
        input.type ?? null,
        input.status,
        input.classification ?? null,
        input.department ?? null,
        input.owner ?? null,
        version,
        input.tags ?? null,
        toDateParam(input.effectiveDate) ?? null,
        toDateParam(input.expiryDate) ?? null,
        toDateParam(input.lastRenewalDate) ?? null,
        userId,
      ]
    );
    await client.query(
      `INSERT INTO "DocumentVersion" (id, "documentId", version, change, "userId", "userName", path, size)
       VALUES ($1,$2,$3,'Initial upload',$4,$5,$6,$7)`,
      [randomUUID(), id, version, userId, uploader, path, file.size]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    await storage.delete(path).catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  await documentQueue.add("parse", { documentId: id, organizationId });
  return (await getDocument(organizationId, id))!;
}

const UPDATABLE = [
  "name",
  "description",
  "type",
  "status",
  "classification",
  "department",
  "owner",
  "version",
  "tags",
  "effectiveDate",
  "expiryDate",
  "lastRenewalDate",
] as const;

// `change` is an optional extra body field: when `version` changes and a
// change note is given, a DocumentVersion row is recorded.
export async function updateDocument(
  organizationId: string,
  userId: string,
  id: string,
  input: UpdateDocumentInput,
  change?: string
): Promise<DocumentWithVersions | null> {
  const existing = await getDocument(organizationId, id);
  if (!existing) return null;

  const normalized = {
    ...input,
    effectiveDate: toDateParam(input.effectiveDate),
    expiryDate: toDateParam(input.expiryDate),
    lastRenewalDate: toDateParam(input.lastRenewalDate),
  };
  const set = buildSet(normalized, UPDATABLE, 3);
  const versionChanged = input.version !== undefined && input.version !== existing.version;
  if (!set) return existing;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE "Document" SET ${set.clause}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1 AND "organizationId" = $2`,
      [id, organizationId, ...set.values]
    );
    if (versionChanged && change) {
      await client.query(
        `INSERT INTO "DocumentVersion" (id, "documentId", version, change, "userId", "userName", path, size)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          randomUUID(),
          id,
          input.version,
          change,
          userId,
          await userName(userId),
          existing.path,
          existing.size,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return getDocument(organizationId, id);
}

export async function deleteDocument(organizationId: string, id: string): Promise<Document | null> {
  const doc = await getDocument(organizationId, id);
  if (!doc) return null;
  // Version rows cascade-delete, so collect stored file paths first.
  const { rows } = await pool.query<{ path: string | null }>(
    'SELECT path FROM "DocumentVersion" WHERE "documentId" = $1',
    [id]
  );
  const paths = new Set<string>(rows.flatMap((r) => (r.path ? [r.path] : [])));
  if (doc.path) paths.add(doc.path);

  const { rowCount } = await pool.query(
    'DELETE FROM "Document" WHERE id = $1 AND "organizationId" = $2',
    [id, organizationId]
  );
  if (!rowCount) return null;
  for (const p of paths) await storage.delete(p).catch(() => undefined);
  return doc;
}

export async function addDocumentVersion(
  organizationId: string,
  userId: string,
  id: string,
  input: CreateDocumentVersionInput,
  file?: UploadedFile
): Promise<DocumentWithVersions | null> {
  const existing = await getDocument(organizationId, id);
  if (!existing) return null;

  let path = existing.path;
  let size = existing.size;
  if (file) {
    const key = `${organizationId}/documents/${id}-v${input.version}-${file.originalname}`;
    ({ path } = await storage.upload({ key, body: file.buffer, contentType: file.mimetype }));
    size = file.size;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO "DocumentVersion" (id, "documentId", version, change, "userId", "userName", path, size)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), id, input.version, input.change, userId, await userName(userId), path, size]
    );
    await client.query(
      `UPDATE "Document"
          SET version = $3, path = $4, size = $5,
              "ingestionStatus" = CASE WHEN $6::boolean THEN 'PENDING'::"IngestionStatus" ELSE "ingestionStatus" END,
              "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = $1 AND "organizationId" = $2`,
      [id, organizationId, input.version, path, size, Boolean(file)]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  if (file) await documentQueue.add("parse", { documentId: id, organizationId });
  return getDocument(organizationId, id);
}

export async function getDocumentDownloadUrl(
  organizationId: string,
  id: string,
  expiresInSeconds = 300
): Promise<{ url: string; expiresInSeconds: number } | null> {
  const { rows } = await pool.query<{ path: string | null }>(
    'SELECT path FROM "Document" WHERE id = $1 AND "organizationId" = $2',
    [id, organizationId]
  );
  if (!rows[0]?.path) return null;
  const url = await storage.getSignedUrl(rows[0].path, expiresInSeconds);
  return { url, expiresInSeconds };
}

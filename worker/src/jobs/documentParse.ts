import type { Job } from "bullmq";
import { pool } from "../db/pool.js";

export interface DocumentParseJobData {
  documentId: string;
  organizationId: string;
}

// TODO: fetch the file via the same StorageAdapter interface as the API
// server (server/src/storage/), extract text (officeparser/pdf-parse for
// PDF/DOCX/PPTX), chunk it, generate embeddings, and store them — the
// schema has no vector column yet, so that needs to land first. pageCount
// can be set from the parser once one is added (it is not determinable
// without a new dependency). For now this only walks
// "Document"."ingestionStatus" PENDING -> PROCESSING -> PROCESSED so uploads
// don't stay stuck; the separate "status" lifecycle column is never touched.
export async function processDocumentParse(job: Job<DocumentParseJobData>): Promise<void> {
  const { documentId, organizationId } = job.data;

  const started = await pool.query(
    `UPDATE "Document" SET "ingestionStatus" = 'PROCESSING', "updatedAt" = CURRENT_TIMESTAMP
     WHERE "id" = $1 AND "organizationId" = $2`,
    [documentId, organizationId],
  );
  if (started.rowCount === 0) {
    throw new Error(`Document ${documentId} not found for organization ${organizationId}`);
  }

  try {
    // TODO: parse + chunk + embed here (see note above).
    await pool.query(
      `UPDATE "Document" SET "ingestionStatus" = 'PROCESSED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
      [documentId],
    );
  } catch (err) {
    console.error(`[document-parse] document ${documentId} failed:`, err);
    await pool.query(
      `UPDATE "Document" SET "ingestionStatus" = 'FAILED', "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
      [documentId],
    );
    throw err;
  }
}

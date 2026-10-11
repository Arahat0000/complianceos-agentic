import { randomUUID } from "node:crypto";
import path from "node:path";
import type {
  ExtractedItem,
  ExtractedItemKind,
  IngestedFile,
  IngestedFileDetail,
  IngestedPage,
  IngestionMetrics,
  ItemReviewStatus,
  PromoteItemsInput,
  Region,
  ReviewItemInput,
  SourceModality,
} from "@complianceos/shared";
import { readPage, type PassItem, type PassResult } from "../../ai/agents/ingestionAgent.js";
import { pool } from "../../db/pool.js";
import type { ExtractedItemRow, IngestedFileRow, IngestedPageRow } from "../../db/types.js";
import { storage } from "../../storage/index.js";
import { auditAsAi } from "../audit.js";
import { docxPages, imageSize, rasterizePdf, readWorkbook } from "./extractors.js";
import { quoteFound, similarity } from "./similarity.js";

const MAX_PAGES = Number(process.env.INGEST_MAX_PAGES ?? 30);
const AGREE_OK = Number(process.env.INGEST_AGREEMENT_THRESHOLD ?? 0.8);
const AGREE_DISPUTED = 0.5;
const CONF_LOW = Number(process.env.INGEST_MIN_CONFIDENCE ?? 0.6);
const STALE_MINUTES = 10;

export class IngestionInputError extends Error {}

// --- mapping ---------------------------------------------------------------

function toFile(r: IngestedFileRow): IngestedFile {
  const { path: _p, ...rest } = r;
  void _p;
  return {
    ...rest,
    stages: r.stages as IngestedFile["stages"],
    size: r.size === null ? null : Number(r.size),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
  };
}

function toPage(r: IngestedPageRow): IngestedPage {
  return {
    id: r.id,
    fileId: r.fileId,
    pageNumber: r.pageNumber,
    hasImage: !!r.imagePath,
    width: r.width,
    height: r.height,
    agreement: r.agreement,
    textA: r.textA,
    textB: r.textB,
  };
}

function toItem(r: ExtractedItemRow & { pageNumber?: number | null }): ExtractedItem {
  const { createdAt: _c, reviewedAt, pageNumber, ...rest } = r;
  void _c;
  return { ...rest, pageNumber: pageNumber ?? null, reviewedAt: reviewedAt ? reviewedAt.toISOString() : null };
}

// --- modality --------------------------------------------------------------

const ext = (name: string) => path.extname(name).toLowerCase();

function inferModality(fileName: string, mimeType: string, hint?: SourceModality, controlId?: string): SourceModality {
  if (hint) return hint;
  const e = ext(fileName);
  if (mimeType === "application/pdf" || e === ".pdf") return "TEXT_PDF"; // refined to SCANNED_PDF when processed
  if (mimeType.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(e)) {
    return controlId ? "SCREENSHOT" : "IMAGE";
  }
  if ([".xlsx", ".csv"].includes(e) || mimeType.includes("spreadsheetml") || mimeType === "text/csv") return "SPREADSHEET";
  if (e === ".docx" || mimeType.includes("wordprocessingml")) return "WORD";
  throw new IngestionInputError("Unsupported file type. Upload a PDF, image, .xlsx/.csv or .docx.");
}

// --- CRUD ------------------------------------------------------------------

export async function createIngestedFile(
  organizationId: string,
  userId: string,
  file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
  input: { circularId?: string; controlId?: string; modality?: SourceModality }
): Promise<IngestedFile> {
  const modality = inferModality(file.originalname, file.mimetype, input.modality, input.controlId);
  if (input.circularId) {
    const c = await pool.query('SELECT 1 FROM "Circular" WHERE id = $1', [input.circularId]);
    if (!c.rowCount) throw new IngestionInputError("circularId not found");
  }
  if (input.controlId) await assertControl(organizationId, input.controlId);

  const id = randomUUID();
  const key = `${organizationId}/ingestion/${id}/original${ext(file.originalname) || ""}`;
  await storage.upload({ key, body: file.buffer, contentType: file.mimetype });
  const { rows } = await pool.query<IngestedFileRow>(
    `INSERT INTO "IngestedFile"
       (id, "organizationId", "circularId", "controlId", "fileName", "mimeType", modality, path, size, status, stages, "uploadedById")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING',$10,$11) RETURNING *`,
    [
      id, organizationId, input.circularId ?? null, input.controlId ?? null, file.originalname.slice(0, 500),
      file.mimetype, modality, key, file.size,
      JSON.stringify([{ key: "upload", title: "Upload", status: "done" }]), userId,
    ]
  );
  void processFile(id).catch((err) => console.error("ingestion failed:", id, err));
  return toFile(rows[0]);
}

async function assertControl(organizationId: string, controlId: string) {
  const c = await pool.query('SELECT 1 FROM "Control" WHERE id = $1 AND ("organizationId" IS NULL OR "organizationId" = $2)', [controlId, organizationId]);
  if (!c.rowCount) throw new IngestionInputError("controlId not found");
}

export async function listIngestedFiles(organizationId: string): Promise<IngestedFile[]> {
  const { rows } = await pool.query<IngestedFileRow>(
    'SELECT * FROM "IngestedFile" WHERE "organizationId" = $1 ORDER BY "createdAt" DESC LIMIT 200',
    [organizationId]
  );
  return rows.map(toFile);
}

async function getFileRow(organizationId: string, id: string): Promise<IngestedFileRow | null> {
  const { rows } = await pool.query<IngestedFileRow>('SELECT * FROM "IngestedFile" WHERE id = $1 AND "organizationId" = $2', [id, organizationId]);
  return rows[0] ?? null;
}

export async function getIngestedFileDetail(organizationId: string, id: string): Promise<IngestedFileDetail | null> {
  const f = await getFileRow(organizationId, id);
  if (!f) return null;
  const [pages, items] = await Promise.all([
    pool.query<IngestedPageRow>('SELECT * FROM "IngestedPage" WHERE "fileId" = $1 ORDER BY "pageNumber"', [id]),
    pool.query<ExtractedItemRow & { pageNumber: number | null }>(
      `SELECT i.*, p."pageNumber" FROM "ExtractedItem" i LEFT JOIN "IngestedPage" p ON p.id = i."pageId"
        WHERE i."fileId" = $1 ORDER BY p."pageNumber" NULLS LAST, i.position`,
      [id]
    ),
  ]);
  return { ...toFile(f), pages: pages.rows.map(toPage), items: items.rows.map(toItem) };
}

export async function getPageImage(organizationId: string, id: string, pageNumber: number) {
  const { rows } = await pool.query<{ imagePath: string | null }>(
    `SELECT p."imagePath" FROM "IngestedPage" p JOIN "IngestedFile" f ON f.id = p."fileId"
      WHERE f.id = $1 AND f."organizationId" = $2 AND p."pageNumber" = $3`,
    [id, organizationId, pageNumber]
  );
  const key = rows[0]?.imagePath;
  if (!key) return null;
  const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" }[ext(key)] ?? "image/png";
  return { key, mime };
}

export async function deleteIngestedFile(organizationId: string, id: string): Promise<boolean> {
  const f = await getFileRow(organizationId, id);
  if (!f) return false;
  const pages = await pool.query<{ imagePath: string | null }>('SELECT "imagePath" FROM "IngestedPage" WHERE "fileId" = $1', [id]);
  await pool.query('DELETE FROM "IngestedFile" WHERE id = $1', [id]);
  const keys = new Set([f.path, ...pages.rows.map((p) => p.imagePath).filter((k): k is string => !!k)]);
  await Promise.all([...keys].map((k) => storage.delete(k).catch(() => undefined)));
  return true;
}

export async function recoverStaleIngestions(): Promise<void> {
  await pool.query(
    `UPDATE "IngestedFile" SET status = 'FAILED', error = 'Interrupted (server restarted)', "finishedAt" = CURRENT_TIMESTAMP
      WHERE status IN ('PENDING','PROCESSING') AND "updatedAt" < CURRENT_TIMESTAMP - make_interval(mins => $1)`,
    [STALE_MINUTES]
  );
}

// --- review ----------------------------------------------------------------

export async function reviewItem(organizationId: string, userId: string, itemId: string, input: ReviewItemInput) {
  const { rows } = await pool.query<ExtractedItemRow & { pageNumber: number | null; fileName: string }>(
    `UPDATE "ExtractedItem" i
        SET "reviewStatus" = $3, "correctedContent" = $4, "reviewedById" = $5, "reviewedAt" = CURRENT_TIMESTAMP
       FROM "IngestedFile" f
      WHERE i.id = $1 AND f.id = i."fileId" AND f."organizationId" = $2
      RETURNING i.*, f."fileName",
        (SELECT "pageNumber" FROM "IngestedPage" WHERE id = i."pageId") AS "pageNumber"`,
    [itemId, organizationId, input.reviewStatus, input.reviewStatus === "CORRECTED" ? input.correctedContent : null, userId]
  );
  return rows[0] ? { item: toItem(rows[0]), fileName: rows[0].fileName } : null;
}

// --- processing ------------------------------------------------------------

type Stage = { key: string; title: string; status: "pending" | "running" | "done" | "failed"; detail?: string };

class Progress {
  stages: Stage[] = [
    { key: "upload", title: "Upload", status: "done" },
    { key: "prepare", title: "Prepare pages", status: "pending" },
    { key: "passA", title: "Pass A: primary reader", status: "pending" },
    { key: "passB", title: "Pass B: independent verifier", status: "pending" },
    { key: "reconcile", title: "Compare passes", status: "pending" },
  ];
  constructor(private id: string) {}
  async set(key: string, status: Stage["status"], detail?: string) {
    const s = this.stages.find((x) => x.key === key)!;
    s.status = status;
    if (detail !== undefined) s.detail = detail;
    await pool.query('UPDATE "IngestedFile" SET stages = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1', [this.id, JSON.stringify(this.stages)]);
  }
}

interface PreparedPage {
  pageNumber: number;
  id: string;
  image?: { data: Buffer; mediaType: string };
  text?: string; // text-only pages (Word)
  textLayer: string; // embedded PDF text layer or the page's ground-truth text
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
function normRegion(r: PassItem["region"]): Region | null {
  if (!r || ![r.x, r.y, r.w, r.h].every(Number.isFinite)) return null;
  const x = clamp01(r.x), y = clamp01(r.y);
  return { x, y, w: clamp01(Math.min(r.w, 1 - x)), h: clamp01(Math.min(r.h, 1 - y)) };
}
const clampConf = (c: number | null | undefined) => (typeof c === "number" && Number.isFinite(c) ? clamp01(c) : null);

export async function processFile(id: string): Promise<void> {
  const { rows } = await pool.query<IngestedFileRow>('SELECT * FROM "IngestedFile" WHERE id = $1', [id]);
  const file = rows[0];
  if (!file) return;
  const orgId = file.organizationId;
  const prog = new Progress(id);
  try {
    await pool.query(`UPDATE "IngestedFile" SET status = 'PROCESSING', error = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
    await pool.query('DELETE FROM "IngestedPage" WHERE "fileId" = $1', [id]); // cascades items (idempotent re-run)
    const original = await storage.download(file.path);

    // --- prepare pages
    await prog.set("prepare", "running");
    let modality = file.modality;
    const pages: PreparedPage[] = [];
    let pageCount = 0;
    const insertPage = async (n: number, imagePath: string | null, w: number | null, h: number | null, textA: string | null = null) => {
      const pid = randomUUID();
      await pool.query(
        'INSERT INTO "IngestedPage" (id, "fileId", "pageNumber", "imagePath", width, height, "textA") VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [pid, id, n, imagePath, w, h, textA]
      );
      return pid;
    };

    if (modality === "SPREADSHEET") {
      const sheets = await readWorkbook(original, ext(file.fileName) === ".csv");
      pageCount = sheets.length;
      await pool.query('UPDATE "IngestedFile" SET "pageCount" = $2 WHERE id = $1', [id, pageCount]);
      await prog.set("prepare", "done", `${sheets.length} sheet(s)`);
      await prog.set("passA", "done", "Parsed deterministically (no model needed)");
      await prog.set("passB", "done", "Skipped for spreadsheets");
      let total = 0;
      for (const [i, sh] of sheets.entries()) {
        const text = [sh.columns.join("\t"), ...sh.rows.map((r) => sh.columns.map((c) => r.values[c]).join("\t"))].join("\n");
        const pid = await insertPage(i + 1, null, null, null, text);
        await insertItem(id, pid, 0, "TABLE", sh.sheet, text, { sheet: sh.sheet, columns: sh.columns, rows: sh.rows.map((r) => sh.columns.map((c) => r.values[c])) }, null, 1, 1, null, null, null, "AGREED");
        for (const [j, r] of sh.rows.entries()) {
          const content = sh.columns.map((c) => `${c}: ${r.values[c]}`).filter((l) => !l.endsWith(": ")).join("; ");
          await insertItem(id, pid, j + 1, "ROW", `${sh.sheet}!${r.row}`, content, { sheet: sh.sheet, row: r.row, values: r.values }, null, 1, 1, null, null, null, "AGREED");
          total++;
        }
      }
      await prog.set("reconcile", "done", `${total} rows`);
      await finish(file, null, null);
      return;
    }

    if (modality === "TEXT_PDF" || modality === "SCANNED_PDF") {
      const { pages: ras, totalPages } = await rasterizePdf(original, MAX_PAGES);
      pageCount = totalPages;
      const avg = ras.reduce((s, p) => s + p.textLayer.length, 0) / Math.max(ras.length, 1);
      modality = avg >= 100 ? "TEXT_PDF" : "SCANNED_PDF";
      for (const p of ras) {
        const key = `${orgId}/ingestion/${id}/page-${p.pageNumber}.png`;
        await storage.upload({ key, body: p.png, contentType: "image/png" });
        const pid = await insertPage(p.pageNumber, key, p.width, p.height);
        pages.push({ pageNumber: p.pageNumber, id: pid, image: { data: p.png, mediaType: "image/png" }, textLayer: p.textLayer });
      }
    } else if (modality === "WORD") {
      const chunks = await docxPages(original);
      pageCount = chunks.length;
      for (const [i, t] of chunks.entries()) {
        const pid = await insertPage(i + 1, null, null, null);
        pages.push({ pageNumber: i + 1, id: pid, text: t, textLayer: t });
      }
    } else {
      // IMAGE / SCREENSHOT: the upload itself is page 1
      pageCount = 1;
      const size = await imageSize(original);
      const pid = await insertPage(1, file.path, size?.width ?? null, size?.height ?? null);
      const mediaType = file.mimeType.startsWith("image/") ? file.mimeType : "image/png";
      pages.push({ pageNumber: 1, id: pid, image: { data: original, mediaType }, textLayer: "" });
    }
    if (pages.length === 0) throw new Error("No readable content found in the file");
    await pool.query('UPDATE "IngestedFile" SET "pageCount" = $2, modality = $3 WHERE id = $1', [id, pageCount, modality]);
    await prog.set("prepare", "done", `${pages.length} page(s)${pageCount > pages.length ? ` of ${pageCount} (capped at ${MAX_PAGES})` : ""}`);

    // --- pass A then pass B, page by page, independently
    const input = (p: PreparedPage) => ({
      fileName: file.fileName, modality, pageNumber: p.pageNumber, pageCount: pages.length,
      image: p.image, text: p.text,
    });
    const A = new Map<number, PassResult>();
    const B = new Map<number, PassResult>();
    let modelA: string | null = null, modelB: string | null = null;
    const failures: string[] = [];
    for (const [pass, out] of [["A", A], ["B", B]] as const) {
      await prog.set(pass === "A" ? "passA" : "passB", "running", `0/${pages.length} pages`);
      let n = 0;
      for (const p of pages) {
        try {
          const r = await readPage(orgId, pass, input(p));
          out.set(p.pageNumber, r.result);
          if (pass === "A") modelA = r.model; else modelB = r.model;
        } catch (err) {
          failures.push(`pass ${pass} page ${p.pageNumber}: ${err instanceof Error ? err.message : String(err)}`);
        }
        n++;
        await prog.set(pass === "A" ? "passA" : "passB", "running", `${n}/${pages.length} pages`);
      }
      const ok = out.size;
      await prog.set(pass === "A" ? "passA" : "passB", ok === 0 ? "failed" : "done", `${ok}/${pages.length} pages read`);
      if (pass === "A" && ok === 0) throw new Error(`Pass A could not read any page. ${failures[0] ?? ""}`);
    }

    // --- reconcile
    await prog.set("reconcile", "running");
    const all: { agreement: number; confidence: number | null; status: ItemReviewStatus; quote: boolean | null; kind: ExtractedItemKind }[] = [];
    for (const p of pages) {
      const a = A.get(p.pageNumber);
      const b = B.get(p.pageNumber);
      if (!a) continue;
      const bItems = b?.items ?? [];
      const used = new Set<number>();
      const bText = [b?.pageText ?? "", ...bItems.map((i) => i.content)].join("\n");
      const source = p.textLayer.trim().length > 30 ? p.textLayer : bText;
      const pageAgreement = b ? similarity(a.pageText, b.pageText) : 0;
      await pool.query('UPDATE "IngestedPage" SET "textA" = $2, "textB" = $3, agreement = $4 WHERE id = $1', [p.id, a.pageText, b?.pageText ?? null, b ? pageAgreement : null]);

      let pos = 0;
      for (const ai of a.items) {
        let best = -1, bestSim = 0;
        bItems.forEach((bi, j) => {
          if (used.has(j)) return;
          const s = similarity(ai.content, bi.content) * (bi.kind === ai.kind ? 1 : 0.85);
          if (s > bestSim) { bestSim = s; best = j; }
        });
        const matched = best >= 0 && bestSim >= 0.2;
        if (matched) used.add(best);
        const bi = matched ? bItems[best] : null;
        const agreement = matched ? Math.min(1, bestSim) : 0;
        const confA = clampConf(ai.confidence);
        const confB = bi ? clampConf(bi.confidence) : null;
        const confidence = confA === null ? confB : bi ? (confA + (confB ?? confA)) / 2 : confA * 0.5;
        const isClause = ai.kind === "CLAUSE";
        const quote = ai.quote?.trim() || ai.content;
        const quoteVerified = isClause ? quoteFound(quote, source) : null;
        const status = decide(agreement, confidence, quoteVerified);
        await insertItem(id, p.id, pos++, ai.kind, ai.label ?? null, ai.content, ai.structured ?? null, normRegion(ai.region), confidence, agreement, quoteVerified, ai, bi, status);
        all.push({ agreement, confidence, status, quote: quoteVerified, kind: ai.kind });
      }
      // Things only the verifier saw: surface them for a human rather than dropping them.
      for (const [j, bi] of bItems.entries()) {
        if (used.has(j)) continue;
        const conf = clampConf(bi.confidence);
        await insertItem(id, p.id, pos++, bi.kind, bi.label ?? null, bi.content, bi.structured ?? null, normRegion(bi.region), conf === null ? null : conf * 0.5, 0, bi.kind === "CLAUSE" ? quoteFound(bi.quote?.trim() || bi.content, source) : null, null, bi, "DISPUTED");
        all.push({ agreement: 0, confidence: conf, status: "DISPUTED", quote: null, kind: bi.kind });
      }
    }
    const metrics = computeMetrics(all);
    await prog.set("reconcile", "done", `${metrics.itemsTotal} items, ${metrics.needsReview + metrics.disputed} need review`);
    if (failures.length) console.warn("ingestion partial failures:", id, failures.slice(0, 5));
    await finish(file, modelA, modelB, metrics, failures.length ? `${failures.length} page read(s) failed: ${failures[0]}` : null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("ingestion failed:", id, msg);
    await pool.query(`UPDATE "IngestedFile" SET status = 'FAILED', error = $2, "finishedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1`, [id, msg.slice(0, 2000)]);
    await auditAsAi(orgId, { type: "AI", action: "Ingestion failed", detail: `${file.fileName}: ${msg.slice(0, 300)}`, objectType: "INGESTED_FILE", objectId: id });
  }
}

function decide(agreement: number, confidence: number | null, quoteVerified: boolean | null): ItemReviewStatus {
  if (agreement < AGREE_DISPUTED) return "DISPUTED";
  if (agreement < AGREE_OK || (confidence !== null && confidence < CONF_LOW) || quoteVerified === false) return "NEEDS_REVIEW";
  return "AGREED";
}

function computeMetrics(items: { agreement: number; confidence: number | null; status: ItemReviewStatus; quote: boolean | null; kind: ExtractedItemKind }[]): IngestionMetrics {
  const total = items.length;
  const clauses = items.filter((i) => i.kind === "CLAUSE");
  const confs = items.map((i) => i.confidence).filter((c): c is number => c !== null);
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    itemsTotal: total,
    agreed: items.filter((i) => i.status === "AGREED").length,
    disputed: items.filter((i) => i.status === "DISPUTED").length,
    needsReview: items.filter((i) => i.status === "NEEDS_REVIEW").length,
    agreementRate: total ? round(items.filter((i) => i.agreement >= AGREE_OK).length / total) : 0,
    quoteMatchRate: clauses.length ? round(clauses.filter((i) => i.quote === true).length / clauses.length) : null,
    meanConfidence: confs.length ? round(confs.reduce((s, c) => s + c, 0) / confs.length) : null,
  };
}

async function insertItem(
  fileId: string, pageId: string, position: number, kind: ExtractedItemKind, label: string | null, content: string,
  structured: unknown, region: Region | null, confidence: number | null, agreement: number | null, quoteVerified: boolean | null,
  passA: unknown, passB: unknown, status: ItemReviewStatus
) {
  await pool.query(
    `INSERT INTO "ExtractedItem" (id, "fileId", "pageId", position, kind, label, content, structured, region, confidence, agreement, "quoteVerified", "passA", "passB", "reviewStatus")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [randomUUID(), fileId, pageId, position, kind, label?.slice(0, 500) ?? null, content, structured == null ? null : JSON.stringify(structured), region ? JSON.stringify(region) : null,
      confidence, agreement, quoteVerified, passA == null ? null : JSON.stringify(passA), passB == null ? null : JSON.stringify(passB), status]
  );
}

async function finish(file: IngestedFileRow, modelA: string | null, modelB: string | null, metrics?: IngestionMetrics, note?: string | null) {
  let m = metrics;
  if (!m) {
    const { rows } = await pool.query<ExtractedItemRow>('SELECT * FROM "ExtractedItem" WHERE "fileId" = $1', [file.id]);
    m = computeMetrics(rows.map((r) => ({ agreement: r.agreement ?? 0, confidence: r.confidence, status: r.reviewStatus, quote: r.quoteVerified, kind: r.kind })));
  }
  await pool.query(
    `UPDATE "IngestedFile" SET status = 'PROCESSED', metrics = $2, "passAModel" = $3, "passBModel" = $4, error = $5, "finishedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1`,
    [file.id, JSON.stringify(m), modelA, modelB, note ?? null]
  );
  await auditAsAi(file.organizationId, {
    type: "AI",
    action: "Extracted items from uploaded source",
    detail: `${file.fileName}: ${m.itemsTotal} items, agreement ${Math.round(m.agreementRate * 100)}%, ${m.needsReview + m.disputed} need review`,
    objectType: "INGESTED_FILE",
    objectId: file.id,
  });
}

// --- promote ---------------------------------------------------------------

const pick = (v: Record<string, string>, ...names: string[]) => {
  const lower = Object.fromEntries(Object.entries(v).map(([k, x]) => [k.toLowerCase().trim(), x]));
  for (const n of names) if (lower[n]?.trim()) return lower[n].trim();
  return null;
};

export interface PromoteResult {
  obligations: number;
  controls: number;
  evidence: number;
  skipped: number;
  obligationIds: string[];
  controlIds: string[];
  evidenceIds: string[];
}

export async function promoteItems(organizationId: string, fileId: string, input: PromoteItemsInput): Promise<PromoteResult | null> {
  const file = await getFileRow(organizationId, fileId);
  if (!file) return null;
  const kinds: ExtractedItemKind[] = input.target === "OBLIGATIONS" ? ["CLAUSE", "DIAGRAM"] : input.target === "CONTROLS" ? ["ROW"] : ["FACT"];
  const { rows: all } = await pool.query<ExtractedItemRow & { pageNumber: number | null }>(
    `SELECT i.*, p."pageNumber" FROM "ExtractedItem" i LEFT JOIN "IngestedPage" p ON p.id = i."pageId"
      WHERE i."fileId" = $1 ORDER BY p."pageNumber" NULLS LAST, i.position`, [fileId]);
  const explicit = input.itemIds ? new Set(input.itemIds) : null;
  const okStatus: ItemReviewStatus[] = ["AGREED", "ACCEPTED", "CORRECTED"];
  const selected = all.filter((i) => kinds.includes(i.kind) && i.reviewStatus !== "REJECTED" && (explicit ? explicit.has(i.id) : okStatus.includes(i.reviewStatus)));
  const already = (i: ExtractedItemRow) => !!(i.promotedObligationId || i.promotedControlId || i.promotedEvidenceId);
  const todo = selected.filter((i) => !already(i));
  const result: PromoteResult = { obligations: 0, controls: 0, evidence: 0, skipped: (explicit ? explicit.size : all.filter((i) => kinds.includes(i.kind)).length) - todo.length, obligationIds: [], controlIds: [], evidenceIds: [] };
  if (result.skipped < 0) result.skipped = 0;

  const circularId = input.circularId ?? file.circularId;
  const controlId = input.controlId ?? file.controlId;
  if (input.target !== "EVIDENCE" && !circularId) throw new IngestionInputError("circularId is required to promote to " + input.target.toLowerCase());
  if (input.target === "EVIDENCE" && !controlId) throw new IngestionInputError("controlId is required to promote evidence");
  if (circularId && input.target !== "EVIDENCE") {
    const c = await pool.query('SELECT 1 FROM "Circular" WHERE id = $1', [circularId]);
    if (!c.rowCount) throw new IngestionInputError("circularId not found");
  }
  if (controlId && input.target === "EVIDENCE") await assertControl(organizationId, controlId);
  if (todo.length === 0) return result;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (input.target === "OBLIGATIONS") {
      for (const it of todo) {
        const corrected = it.reviewStatus === "CORRECTED" ? it.correctedContent : null;
        const units: { text: string; quote: string; label: string | null }[] = [];
        if (it.kind === "DIAGRAM") {
          const steps = ((it.structured as { steps?: { label?: string; actor?: string | null; deadline?: string | null }[] } | null)?.steps ?? []).filter((s) => s.label);
          if (corrected || steps.length === 0) units.push({ text: corrected ?? it.content, quote: corrected ?? it.content, label: it.label });
          else for (const s of steps) units.push({ text: [s.actor ? `${s.actor}:` : "", s.label, s.deadline ? `(${s.deadline})` : ""].filter(Boolean).join(" "), quote: s.label!, label: it.label });
        } else {
          const quote = corrected ?? ((it.passA as { quote?: string | null } | null)?.quote?.trim() || it.content);
          units.push({ text: corrected ?? it.content, quote, label: it.label });
        }
        let firstId: string | null = null;
        for (const u of units) {
          const oid = randomUUID();
          await client.query(
            `INSERT INTO "Obligation" (id, identifier, "organizationId", "circularId", "requirementText", "obligationType", "sourceQuote", "sourceSection",
               "citationVerified", confidence, status, "extractionModel", "sourceFileId", "sourcePage", "sourceRegion")
             VALUES ($1, 'OBL-' || lpad(nextval('obligation_identifier_seq')::text, 5, '0'), $2,$3,$4,'OTHER',$5,$6,$7,$8,'EXTRACTED',$9,$10,$11,$12)`,
            [oid, organizationId, circularId, u.text, u.quote, u.label?.slice(0, 255) ?? null, it.quoteVerified === true || corrected !== null, it.confidence, file.passAModel, fileId, it.pageNumber, it.region ? JSON.stringify(it.region) : null]
          );
          result.obligations++;
          result.obligationIds.push(oid);
          firstId ??= oid;
        }
        await client.query('UPDATE "ExtractedItem" SET "promotedObligationId" = $2 WHERE id = $1', [it.id, firstId]);
      }
    } else if (input.target === "CONTROLS") {
      for (const it of todo) {
        const v = ((it.structured as { values?: Record<string, string> } | null)?.values ?? {}) as Record<string, string>;
        const corrected = it.reviewStatus === "CORRECTED" ? it.correctedContent : null;
        const title = (pick(v, "title", "control", "control name", "control title", "name", "control objective") ?? Object.values(v).find((x) => x?.trim()) ?? it.label ?? "Imported control").slice(0, 500);
        const desc = corrected ?? pick(v, "description", "control description", "details", "objective", "requirement") ?? it.content;
        const cid = randomUUID();
        await client.query(
          `INSERT INTO "Control" (id, "organizationId", "circularId", code, source, title, description, category, framework, "ownerName", notes)
           VALUES ($1,$2,$3,$4,'MANUAL',$5,$6,$7,$8,$9,$10)`,
          [cid, organizationId, circularId, pick(v, "code", "control id", "id", "ref", "reference")?.slice(0, 100) ?? null, title, desc,
            pick(v, "category", "domain", "type")?.slice(0, 100) ?? null, pick(v, "framework", "standard")?.slice(0, 255) ?? null,
            pick(v, "owner", "owner name", "ownername", "responsible", "team")?.slice(0, 255) ?? null, `Imported from ${file.fileName} (${it.label ?? "row"})`]
        );
        await client.query('UPDATE "ExtractedItem" SET "promotedControlId" = $2 WHERE id = $1', [it.id, cid]);
        result.controls++;
        result.controlIds.push(cid);
      }
    } else {
      const facts = todo.map((it) => {
        const s = (it.structured as { key?: string; value?: string } | null) ?? {};
        let key = s.key ?? it.label ?? "fact";
        let value = s.value ?? it.content;
        if (it.reviewStatus === "CORRECTED" && it.correctedContent) {
          const m = /^([^:]{1,120}):\s*([\s\S]+)$/.exec(it.correctedContent);
          if (m) { key = m[1].trim(); value = m[2].trim(); } else value = it.correctedContent;
        }
        return { key, value, confidence: it.confidence ?? undefined };
      });
      const eid = randomUUID();
      await client.query(
        `INSERT INTO "Evidence" (id, "organizationId", "controlId", name, "documentType", excerpt, size, "sourceFileId", facts, status)
         VALUES ($1,$2,$3,$4,'Screenshot',$5,$6,$7,$8,'PENDING')`,
        [eid, organizationId, controlId, file.fileName.slice(0, 255), facts.map((f) => `${f.key}: ${f.value}`).join("\n").slice(0, 2000), file.size === null ? null : Number(file.size), fileId, JSON.stringify(facts)]
      );
      for (const it of todo) await client.query('UPDATE "ExtractedItem" SET "promotedEvidenceId" = $2 WHERE id = $1', [it.id, eid]);
      result.evidence = 1;
      result.evidenceIds.push(eid);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return result;
}

import ExcelJS from "exceljs";
import { OfficeParser } from "officeparser";
import { createCanvas, loadImage } from "@napi-rs/canvas";
// The legacy build targets Node (the default build needs newer browser APIs).
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface RasterPage {
  pageNumber: number;
  png: Buffer;
  width: number;
  height: number;
  textLayer: string;
}

const MAX_EDGE = 1800; // px, longest edge of a rasterised page

// Rasterises pages to PNG and pulls each page's embedded text layer (empty for scans).
export async function rasterizePdf(
  data: Buffer,
  maxPages: number
): Promise<{ pages: RasterPage[]; totalPages: number }> {
  // pdf.js takes ownership of the buffer it is given, so hand it a copy.
  const task = getDocument({ data: new Uint8Array(data), useSystemFonts: true, verbosity: 0 });
  const doc = await task.promise;
  try {
    const totalPages = doc.numPages;
    const pages: RasterPage[] = [];
    for (let i = 1; i <= Math.min(totalPages, maxPages); i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, MAX_EDGE / Math.max(base.width, base.height, 1));
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // @napi-rs/canvas is DOM-compatible at runtime; the DOM lib types are not loaded on the server.
      const renderParams = { canvas, canvasContext: ctx, viewport } as unknown as Parameters<typeof page.render>[0];
      await page.render(renderParams).promise;
      let textLayer = "";
      try {
        const content = await page.getTextContent();
        let line = "";
        for (const item of content.items) {
          if (!("str" in item)) continue;
          line += item.str;
          if (item.hasEOL) line += "\n";
          else if (item.str) line += " ";
        }
        textLayer = line.replace(/[ \t]+\n/g, "\n").trim();
      } catch {
        /* no text layer */
      }
      pages.push({ pageNumber: i, png: canvas.toBuffer("image/png"), width: canvas.width, height: canvas.height, textLayer });
      page.cleanup();
    }
    return { pages, totalPages };
  } finally {
    await task.destroy();
  }
}

export async function imageSize(data: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    const img = await loadImage(data);
    return { width: img.width, height: img.height };
  } catch {
    return null;
  }
}

export interface SheetRows {
  sheet: string;
  columns: string[];
  rows: { row: number; values: Record<string, string> }[];
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((r) => r.text).join("");
    if ("result" in o) return cellText(o.result as ExcelJS.CellValue);
    if ("text" in o) return String(o.text);
    return "";
  }
  return String(v).trim();
}

export async function readWorkbook(data: Buffer, isCsv: boolean): Promise<SheetRows[]> {
  const wb = new ExcelJS.Workbook();
  if (isCsv) {
    const { Readable } = await import("node:stream");
    await wb.csv.read(Readable.from(data));
  } else {
    await wb.xlsx.load(data as unknown as ArrayBuffer);
  }
  const out: SheetRows[] = [];
  for (const ws of wb.worksheets) {
    const matrix: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      const cells: string[] = [];
      for (let c = 1; c <= row.cellCount; c++) cells.push(cellText(row.getCell(c).value));
      matrix[n] = cells;
    });
    const rowNums = matrix.map((_, i) => i).filter((i) => matrix[i]);
    if (rowNums.length === 0) continue;
    const headerRow = rowNums[0];
    const columns = matrix[headerRow].map((h, i) => h || `Column ${i + 1}`);
    const rows = rowNums.slice(1).flatMap((n) => {
      const values: Record<string, string> = {};
      columns.forEach((c, i) => (values[c] = matrix[n][i] ?? ""));
      return Object.values(values).some(Boolean) ? [{ row: n, values }] : [];
    });
    out.push({ sheet: ws.name, columns, rows });
  }
  return out;
}

// Word -> plain text, split into page-sized chunks on paragraph boundaries.
export async function docxPages(data: Buffer, maxChars = 3500): Promise<string[]> {
  const ast = await OfficeParser.parseOffice(data);
  const value = ast.toText();
  const pages: string[] = [];
  let cur = "";
  for (const para of value.split(/\n{1,}/)) {
    if (cur && cur.length + para.length > maxChars) {
      pages.push(cur.trim());
      cur = "";
    }
    cur += para + "\n";
  }
  if (cur.trim()) pages.push(cur.trim());
  return pages;
}

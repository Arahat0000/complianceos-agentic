import { z } from "zod";
import type { Attachment } from "../AIProvider.js";
import { completeJson } from "../json.js";
import { getProviderForOrg, getVerifierForOrg } from "../orgProvider.js";

// Reads one page (image, or plain text for office files) and returns every item on it.
// Pass A and pass B are deliberately independent: different provider (verifier), different
// prompt wording, and neither sees the other's output.

const PASS_KINDS = ["CLAUSE", "TABLE", "DIAGRAM", "FIGURE", "TEXT_BLOCK", "FACT"] as const;

const num = z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().finite());
const regionSchema = z
  .object({ x: num, y: num, w: num, h: num })
  .nullish()
  .catch(null);

const passItemSchema = z.object({
  kind: z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() : v), z.enum(PASS_KINDS)),
  label: z.string().nullish(),
  content: z.string().min(1),
  structured: z.unknown().optional(),
  region: regionSchema,
  confidence: num.nullish().catch(null),
  quote: z.string().nullish(),
});
export type PassItem = z.infer<typeof passItemSchema>;

const passResultSchema = z.object({
  pageText: z.string().nullish(),
  items: z.array(z.unknown()).transform((arr) =>
    arr.flatMap((raw) => {
      const p = passItemSchema.safeParse(raw);
      return p.success ? [p.data] : [];
    })
  ),
});
export type PassResult = { pageText: string; items: PassItem[] };

export interface PageInput {
  fileName: string;
  modality: string;
  pageNumber: number;
  pageCount: number;
  image?: { data: Buffer; mediaType: string };
  text?: string; // office files: the page's text instead of an image
}

const SHAPE = `{"pageText": string, "items": [{"kind": "CLAUSE"|"TABLE"|"DIAGRAM"|"FIGURE"|"TEXT_BLOCK"|"FACT", "label": string|null, "content": string, "structured": object|null, "region": {"x":number,"y":number,"w":number,"h":number}|null, "confidence": number, "quote": string|null}]}`;

const KIND_RULES = `Item kinds:
- CLAUSE: a numbered/lettered provision or a sentence imposing a requirement. "label" = its number (e.g. "4.2(a)"). "content" and "quote" = the exact text as printed.
- TABLE: "content" = the table as plain text, one row per line; "structured" = {"columns": string[], "rows": string[][]}.
- DIAGRAM: flowcharts/process diagrams. "content" = a one-line description; "structured" = {"steps":[{"id":string,"label":string,"actor":string|null,"deadline":string|null,"next":string[]}]} in reading order.
- FIGURE: photos, charts, logos, stamps or signatures worth noting. "content" = short description.
- TEXT_BLOCK: any other paragraph/heading.
- FACT: for screenshots of systems/consoles, one item per visible setting or value; "structured" = {"key":string,"value":string}; "content" = "key: value".
"region" is the bounding box of the item as fractions (0 to 1) of the page width/height, origin top-left. "confidence" is 0 to 1.`;

function systemA(modality: string): string {
  return `[ingestion-pass:A] You are a document digitisation agent for a bank compliance platform. You are shown one page of a source document (${modality}). Transcribe it faithfully and split it into items.
${KIND_RULES}
Never invent text that is not visible. If part of the page is illegible, lower the confidence instead of guessing.
Respond with ONLY one JSON object, no markdown fences: ${SHAPE}
"pageText" is the full transcription of the page in reading order.`;
}

function systemB(modality: string): string {
  return `[ingestion-pass:B] Act as an independent second reader who double-checks scanned records (${modality}). Nobody has read this page before you. Look at the page carefully and report (a) all of its readable text and (b) a list of the distinct content units on it.
${KIND_RULES}
Copy wording exactly as printed, including numbering; do not correct or paraphrase. Be honest about uncertainty through "confidence".
Return a single JSON object only, matching: ${SHAPE}
Put the whole page's text, in reading order, in "pageText".`;
}

function userPrompt(p: PageInput, pass: "A" | "B"): string {
  const head = `File: ${p.fileName}\nPage ${p.pageNumber} of ${p.pageCount}`;
  const lead = pass === "A" ? "Extract every item from this page." : "Read this page and list its content units.";
  if (p.text !== undefined) return `${head}\n\n${lead}\n\n--- PAGE TEXT START ---\n${p.text}\n--- PAGE TEXT END ---`;
  return `${head}\n\n${lead} The page image is attached.`;
}

function attachments(p: PageInput): Attachment[] | undefined {
  return p.image ? [{ kind: "image", mediaType: p.image.mediaType, data: p.image.data, name: `page-${p.pageNumber}` }] : undefined;
}

export async function readPage(
  organizationId: string,
  pass: "A" | "B",
  page: PageInput
): Promise<{ result: PassResult; model: string | null }> {
  const provider = pass === "A" ? await getProviderForOrg(organizationId) : await getVerifierForOrg(organizationId);
  const parsed = await completeJson(
    provider,
    {
      system: pass === "A" ? systemA(page.modality) : systemB(page.modality),
      prompt: userPrompt(page, pass),
      temperature: 0,
      maxTokens: 8000,
      attachments: attachments(page),
    },
    passResultSchema
  );
  return {
    result: { pageText: parsed.pageText ?? parsed.items.map((i) => i.content).join("\n"), items: parsed.items },
    model: provider.modelId ?? null,
  };
}

import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";

interface FeedSource {
  regulator: "RBI" | "SEBI";
  name: string;
  url: string;
}

const FEED_SOURCES: FeedSource[] = [
  { regulator: "RBI", name: "RBI notifications", url: "https://rbi.org.in/notifications_rss.xml" },
  { regulator: "RBI", name: "RBI press releases", url: "https://rbi.org.in/pressreleases_rss.xml" },
  { regulator: "SEBI", name: "SEBI circulars", url: "https://www.sebi.gov.in/sebirss.xml" },
];

export type FetchText = (url: string) => Promise<string>;

const USER_AGENT = "Mozilla/5.0 (compatible; ComplianceOS-Discovery/1.0; +https://complianceos.app/bot)";

const defaultFetchText: FetchText = async (url) => {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(15_000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: Date | null;
  guid: string | null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function tagText(block: string, tag: string): string {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  if (!m) return "";
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(m[1]);
  const raw = cdata ? cdata[1] : decodeEntities(m[1]);
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Minimal, forgiving RSS 2.0 / Atom parser (regex based; no external dependency).
function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  const re = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[2];
    let link = tagText(block, "link");
    if (!link) link = /<link[^>]*href=["']([^"']+)["']/i.exec(block)?.[1] ?? "";
    const title = tagText(block, "title");
    if (!title || !link) continue;
    const date = tagText(block, "pubDate") || tagText(block, "updated") || tagText(block, "published");
    const parsed = date ? new Date(date) : null;
    items.push({
      title,
      link: decodeEntities(link),
      description: tagText(block, "description") || tagText(block, "summary"),
      pubDate: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
      guid: tagText(block, "guid") || tagText(block, "id") || null,
    });
  }
  return items;
}

// e.g. RBI/2024-25/45, SEBI/HO/MRD/MRD-PoD-1/P/CIR/2024/123
const REFERENCE_RE = /\b(?:RBI|SEBI)\/[A-Za-z0-9\-_.]+(?:\/[A-Za-z0-9\-_.]+)+/;

function deriveIdentity(item: FeedItem): { circularId: string; reference: string | null; linkRef: string | null } {
  const reference = REFERENCE_RE.exec(item.title)?.[0] ?? REFERENCE_RE.exec(item.description)?.[0] ?? null;
  let linkRef: string | null = null;
  try {
    const u = new URL(item.link);
    linkRef = u.searchParams.get("Id") ?? u.searchParams.get("id");
    if (!linkRef) linkRef = u.pathname.split("/").filter(Boolean).pop()?.replace(/\.html?$/i, "") ?? null;
  } catch {
    /* keep null */
  }
  const hash = createHash("sha1").update(item.link).digest("hex").slice(0, 12);
  return { circularId: reference ?? linkRef ?? `feed-${hash}`, reference, linkRef };
}

interface SourceResult {
  source: string;
  url: string;
  found: number;
  new: number;
  error?: string;
}

export interface CrawlResult {
  sources: SourceResult[];
  found: number;
  newCount: number;
  errors: number;
}

export interface CrawlOptions {
  pool: Pick<Pool, "query">;
  organizationId: string;
  runId: string;
  regulators?: string[];
  fetchText?: FetchText;
  sources?: FeedSource[];
  maxPerSource?: number;
}

export async function crawlFeeds(opts: CrawlOptions): Promise<CrawlResult> {
  const fetchText = opts.fetchText ?? defaultFetchText;
  const wanted = opts.regulators?.map((r) => r.toUpperCase());
  const sources = (opts.sources ?? FEED_SOURCES).filter((s) => !wanted?.length || wanted.includes(s.regulator));
  const results: SourceResult[] = [];

  for (const src of sources) {
    const result: SourceResult = { source: src.name, url: src.url, found: 0, new: 0 };
    results.push(result);
    let items: FeedItem[];
    try {
      items = parseFeed(await fetchText(src.url));
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      continue;
    }
    items = items.slice(0, opts.maxPerSource ?? 50);
    result.found = items.length;
    for (const item of items) {
      try {
        if (await insertIfNew(opts, src, item)) result.new++;
      } catch (err) {
        result.error = `insert failed: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }
  return {
    sources: results,
    found: results.reduce((n, r) => n + r.found, 0),
    newCount: results.reduce((n, r) => n + r.new, 0),
    errors: results.filter((r) => r.error).length,
  };
}

// Dedupes per org (and against the global library) by link or reference. Rows are
// org-owned PENDING_REVIEW so the existing adopt flow (PENDING_REVIEW -> ACTIVE) applies.
async function insertIfNew(opts: CrawlOptions, src: FeedSource, item: FeedItem): Promise<boolean> {
  const { circularId, reference, linkRef } = deriveIdentity(item);
  const exists = await opts.pool.query(
    `SELECT 1 FROM "Circular"
      WHERE ("organizationId" = $1 OR "organizationId" IS NULL)
        AND ("link" = $2 OR ($3::text IS NOT NULL AND ("reference" = $3 OR "circularId" = $3)))
      LIMIT 1`,
    [opts.organizationId, item.link, reference],
  );
  if ((exists.rowCount ?? 0) > 0) return false;
  await opts.pool.query(
    `INSERT INTO "Circular"
       (id, "organizationId", "circularId", "reference", "name", "regulator", "description",
        "dateOfIssue", "status", "link", "linkRef", "discoveryRunId", "discoveredAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_REVIEW', $9, $10, $11, CURRENT_TIMESTAMP)`,
    [
      randomUUID(),
      opts.organizationId,
      circularId,
      reference,
      item.title.slice(0, 500),
      src.regulator,
      item.description || null,
      item.pubDate ? item.pubDate.toISOString().slice(0, 10) : null,
      item.link,
      linkRef,
      opts.runId,
    ],
  );
  return true;
}

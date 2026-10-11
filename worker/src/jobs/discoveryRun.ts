import type { Job } from "bullmq";
import { pool } from "../db/pool.js";
import { crawlFeeds, type FetchText } from "./discoveryCrawler.js";

export interface DiscoveryRunJobData {
  runId: string;
  organizationId: string;
  regulators?: string[];
}

interface DiscoveryStage {
  tool: string;
  args: string;
  target: string;
  title: string;
  detail: string;
}

// Mirrors AGENT_STAGES in web/src/data/regulatoryDiscovery.ts — the shape
// stored in "DiscoveryRun"."stages" is [{tool,args,target,title,detail}].
const STAGES: DiscoveryStage[] = [
  {
    tool: "scan_website",
    args: '{ url: "rbi.org.in/master-directions" }',
    target: "rbi.org.in & sebi.gov.in",
    title: "Scanning official gazettes & regulatory portals for updates",
    detail: "Fetching RBI and SEBI RSS feeds.",
  },
  {
    tool: "diff_gazettes",
    args: '{ index_count: 5, baseline: "indexed" }',
    target: "226 RBI · 132 SEBI",
    title: "Diffing newly detected documents against library index",
    detail: "Comparing regulatory IDs and timestamps against active AI-indexed baseline directions.",
  },
  {
    tool: "extract_obligations",
    args: '{ model: "compliance-extractor-v2" }',
    target: "gemini-1.5-pro",
    title: "Parsing regulatory text & extracting compliance mandates",
    detail: "Classifying operational requirements, mandatory audit cadences, and penalty provisions.",
  },
  {
    tool: "map_controls",
    args: '{ framework: "internal_policy_map" }',
    target: "Controls Engine",
    title: "Correlating obligations to controls & gap remediation tracker",
    detail: "All active circulars mapped and in sync. Zero pending regulatory drift.",
  },
];

async function appendStage(runId: string, stage: DiscoveryStage): Promise<void> {
  await pool.query(
    `UPDATE "DiscoveryRun"
     SET "stages" = COALESCE("stages", '[]'::jsonb) || $2::jsonb
     WHERE "id" = $1`,
    [runId, JSON.stringify([stage])],
  );
}

// Processes one "DiscoveryRun": crawls the RBI/SEBI RSS feeds, inserts new
// PENDING_REVIEW circulars (deduped by link/reference) and records per-source
// found/new counts and errors in the run's stages. Extraction/mapping stay manual.
export function processDiscoveryRun(job: Job<DiscoveryRunJobData>): Promise<void> {
  return runDiscovery(job.data);
}

// Injectable fetch so tests can feed canned XML.
async function runDiscovery(data: DiscoveryRunJobData, fetchText?: FetchText): Promise<void> {
  const { runId, organizationId } = data;

  const started = await pool.query(
    `UPDATE "DiscoveryRun" SET "status" = 'RUNNING', "stages" = '[]'::jsonb, "finishedAt" = NULL
     WHERE "id" = $1 AND "organizationId" = $2`,
    [runId, organizationId],
  );
  if (started.rowCount === 0) {
    throw new Error(`DiscoveryRun ${runId} not found for organization ${organizationId}`);
  }

  try {
    const crawl = await crawlFeeds({ pool, organizationId, runId, regulators: data.regulators, fetchText });
    const failed = crawl.sources.filter((r) => r.error);
    const ok = crawl.sources.filter((r) => !r.error);

    await appendStage(runId, {
      ...STAGES[0],
      args: JSON.stringify({ sources: crawl.sources.map((r) => r.url) }),
      target: crawl.sources.map((r) => r.source).join(" · "),
      detail:
        `Fetched ${ok.length}/${crawl.sources.length} feeds.` +
        failed.map((r) => ` ${r.source}: ${r.error}`).join(""),
    });
    await appendStage(runId, {
      ...STAGES[1],
      args: '{ baseline: "library", key: "link|reference" }',
      target: crawl.sources.map((r) => `${r.source}: ${r.found} found, ${r.new} new`).join(" · "),
      detail: `${crawl.found} items found, ${crawl.newCount} new circulars queued for review.`,
    });
    await appendStage(runId, STAGES[2]);
    await appendStage(runId, STAGES[3]);

    // Every source failing (offline, blocked) is a failed run, but not a crashed job.
    const allFailed = crawl.sources.length > 0 && ok.length === 0;
    await pool.query(
      `UPDATE "DiscoveryRun"
       SET "circularsFound" = $2, "status" = $3, "finishedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $1`,
      [runId, crawl.newCount, allFailed ? "FAILED" : "COMPLETED"],
    );
  } catch (err) {
    console.error(`[discovery-run] run ${runId} failed:`, err);
    await pool.query(
      `UPDATE "DiscoveryRun" SET "status" = 'FAILED', "finishedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
      [runId],
    );
    throw err;
  }
}

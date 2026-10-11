import { QUEUE_NAMES } from "@complianceos/shared";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { config } from "./config.js";
import { processDailySnapshot } from "./jobs/dailySnapshot.js";
import { processDiscoveryRun } from "./jobs/discoveryRun.js";
import { processDocumentParse } from "./jobs/documentParse.js";

const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

// Redis being down produces an error on every retry; log one clear line per 30s instead.
let lastRedisWarn = 0;
function warnRedis(source: string, err: unknown) {
  const now = Date.now();
  if (now - lastRedisWarn < 30_000) return;
  lastRedisWarn = now;
  const code = (err as { code?: string; errors?: { code?: string }[] })?.code ?? (err as { errors?: { code?: string }[] })?.errors?.[0]?.code;
  console.error(
    code === "ECONNREFUSED"
      ? `[${source}] cannot reach Redis at ${config.redisUrl} (connection refused). Start Redis, or set REDIS_URL. Retrying; background jobs are paused until it is up.`
      : `[${source}] Redis error:`,
    code === "ECONNREFUSED" ? "" : err
  );
}
connection.on("error", (err) => warnRedis("worker", err));

const workers = [
  new Worker(QUEUE_NAMES.documentParse, processDocumentParse, { connection }),
  new Worker(QUEUE_NAMES.discoveryRun, processDiscoveryRun, { connection }),
  new Worker(QUEUE_NAMES.dailySnapshot, processDailySnapshot, { connection }),
];

for (const worker of workers) {
  worker.on("error", (err) => warnRedis(worker.name, err));
  worker.on("completed", (job) => console.log(`[${worker.name}] completed job ${job.id}`));
  worker.on("failed", (job, err) => console.error(`[${worker.name}] job ${job?.id} failed:`, err));
}

// Snapshots run without a producer: a repeatable job fires daily at 00:05
// (server time). upsertJobScheduler is idempotent across restarts.
const snapshotQueue = new Queue(QUEUE_NAMES.dailySnapshot, { connection });
snapshotQueue.on("error", (err) => warnRedis("worker", err));
await snapshotQueue.upsertJobScheduler("daily-snapshot-all-orgs", { pattern: "5 0 * * *" }, { name: "snapshot", data: {} });

console.log(`worker listening on queues: ${workers.map((w) => w.name).join(", ")} (${config.nodeEnv})`);

async function shutdown() {
  console.log("shutting down worker...");
  await Promise.all(workers.map((w) => w.close()));
  await snapshotQueue.close();
  await connection.quit();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

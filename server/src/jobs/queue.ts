import { QUEUE_NAMES } from "@complianceos/shared";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config.js";

// Producer side only — enqueues jobs from HTTP request handlers. The
// consumer side (BullMQ Workers that actually process these queues) lives
// in the separate @complianceos/worker package/process; the two only need
// to agree on queue names (shared/src/queues.ts) and REDIS_URL.
const redisConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

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
redisConnection.on("error", (err) => warnRedis("server", err));

export const documentQueue = new Queue(QUEUE_NAMES.documentParse, { connection: redisConnection });
export const discoveryQueue = new Queue(QUEUE_NAMES.discoveryRun, { connection: redisConnection });
const snapshotQueue = new Queue(QUEUE_NAMES.dailySnapshot, { connection: redisConnection });

for (const q of [documentQueue, discoveryQueue, snapshotQueue]) q.on("error", (err) => warnRedis("server", err));

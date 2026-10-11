# @complianceos/worker

BullMQ consumer for the queues declared in `@complianceos/shared` (`src/queues.ts`). Runs as its own process and shares `DATABASE_URL` / `REDIS_URL` with the API.

```bash
npm run dev --workspace=worker
npm run build --workspace=worker
```

| Queue | Job | What it does |
|---|---|---|
| `document-parse` | `jobs/documentParse.ts` | Moves a `Document` through `ingestionStatus` (`PROCESSING → PROCESSED / FAILED`) |
| `discovery-run` | `jobs/discoveryRun.ts` | Executes a `DiscoveryRun`, recording stages and `circularsFound` Crawls the RBI and SEBI RSS feeds, creates `PENDING_REVIEW` circulars deduped by link or reference, and records per-source counts and errors in the run's stages |
| `daily-snapshot` | `jobs/dailySnapshot.ts` | Upserts today's `DailyPipelineSnapshot` per organization; also registered as a daily repeatable job |

# @complianceos/shared

The single contract between the database, API and UI. Consumed by `server` and `worker` at runtime and by `web` for **types only** (no zod in the browser bundle).

| Path | Contents |
|---|---|
| `src/types/enums.ts` | Every enum as a readonly array + same-named union type (mirrors the Postgres enums in `sql/postgres/full_schema.sql`); `enumObject()` helper for `Enum.VALUE` style access |
| `src/schemas/*.ts` | zod request schemas and their inferred `*Input` types (auth, org, circular, control, obligation, gap, remediation, traceability, document, knowledge entry, audit, automation, discovery, dashboard, ingestion, intelligence) |
| `src/types/entities.ts` | JSON response shapes, one per table (plus the `TraceabilityLink` view and dashboard/automation aggregates) |
| `src/queues.ts` | BullMQ queue names shared by producer (server) and consumer (worker) |

```bash
npm run build --workspace=shared   # tsc -b → dist/
npm run dev --workspace=shared     # watch
```

> `dist/` is what other packages import. If a build looks stale after deleting a source file, remove `dist/` and `tsconfig.tsbuildinfo` and rebuild (`tsc -b` does not delete outputs of removed sources).

When the schema changes, update the enum here first, then `entities.ts` and the schemas, then `server/src/db/types.ts`.

# Database

PostgreSQL schema for ComplianceOS.

| File | Purpose |
|---|---|
| [`postgres/full_schema.sql`](postgres/full_schema.sql) | Creates all enums, 43 tables, sequences, indexes and the `TraceabilityLink` view |
| [`postgres/full_delete_schema.sql`](postgres/full_delete_schema.sql) | Drops everything the schema creates (and leftovers of older schema versions) - **destroys all data** |
| [`postgres/seed/create_storage_bucket.sql`](postgres/seed/create_storage_bucket.sql) | Supabase storage bucket for uploaded files |

With Docker, `docker compose up -d` at the repo root starts Postgres 16 and Redis and loads `full_schema.sql` into an empty database automatically.

```bash
DATABASE_URL=postgres://… npm run migrate            # create
DATABASE_URL=postgres://… npm run migrate -- reset   # drop, then create
```

The schema follows the traceability chain - `Circular → Obligation → ObligationControl → Control → Evidence / ControlTest / MonitoringKpi → ComplianceGap → RemediationPlan` - plus tenancy/auth, contradictions, simulation, audit and automation tables. Section comments in `full_schema.sql` name the page each table serves.

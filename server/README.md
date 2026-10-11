# @complianceos/server

Express + TypeScript API. Raw `pg` queries (no ORM), zod validation from `@complianceos/shared`, JWT auth.

```bash
npm run dev --workspace=server     # tsx watch, :4000
npm run build --workspace=server
npm run lint --workspace=server
```

Configuration is read from the repo-root `.env` (see [`.env.example`](../.env.example)). Required: `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`. Optional: Bedrock/AI keys, SMTP, Google OAuth, storage (`STORAGE_MODE`: `supabase`, `s3` or `local`), `TRUST_PROXY`. `AI_MOCK=1` swaps the model for a deterministic mock (tests only).

## Layout

| Path | What |
|---|---|
| `src/routes/` | Thin Express routers - parse with a shared schema, call a service |
| `src/services/` | Business logic and SQL; every query is org-scoped |
| `src/ai/` | `resolveProvider` (Bedrock / Anthropic / OpenAI / Ollama), `completeJson` for schema-validated model output, and the agents in `agents/` |
| `src/services/scheduler.ts` | Claims due `AgentSchedule` rows (`FOR UPDATE SKIP LOCKED`) and starts scheduled runs |
| `src/auth/`, `src/middleware/` | JWT, roles, org IP allowlist, error handling |
| `src/db/types.ts` | Row types mirroring `sql/postgres/full_schema.sql` |
| `src/storage/` | Supabase / S3 / local-disk file adapters (`local` serves files through signed `/storage/*` links) |

## API surface (all except `/auth`, `/health` and `/storage` require a JWT)

`/auth` · `/users` · `/organizations` (members, invites, security, IP allowlist, AI config) · `/circulars` · `/obligations` · `/controls` · `/questions` · `/compliance-gaps` (+ remediation plans) · `/traceability` · `/contradictions` · `/simulation` · `/dashboard` · `/documents` · `/knowledge-base` · `/audit-log` · `/discovery-runs` · `/automation` · `/ingestion` (multimodal upload, review, promote) · `/changes` · `/mapping` · `/applicability` · `/profile` · `/storage` (signed file links, no JWT)

Every mutating route writes an `AuditLog` row through `services/audit.ts`.

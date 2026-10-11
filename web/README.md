# @complianceos/web

The ComplianceOS frontend - React 19 + Vite + Tailwind + shadcn/ui, TanStack Table, Motion, Recharts.

```bash
npm run dev --workspace=web        # http://localhost:5173
npm run build --workspace=web      # tsc -b && vite build
npm run lint --workspace=web
```

## Demo mode vs real mode

Every data page branches on `useAuth().isDemo`:

* **Demo mode**: sign in with **Quick Demo** on the login page. No backend needed. All pages read one connected dataset from [`src/demo/complianceScenario.ts`](src/demo/complianceScenario.ts) and the RBI/SEBI reference data in [`src/data/`](src/data) (circular → obligations → controls → gaps → remediation), so numbers agree across the dashboard, sidebar and tables.
* **Real mode**: pages call the API through the typed wrappers in [`src/lib/`](src/lib) (`apiFetch` attaches the JWT). Response types come from `@complianceos/shared` (type-only imports).

## Pages

| Route | Page |
|---|---|
| `/dashboard` | Pipeline counts, activity chart, controls table |
| `/regulations`, `/regulations/:id` | Circular library, AI-indexed filter, discovery agent, circular detail |
| `/obligations`, `/obligations/:circularId` | Extraction agent, verified/unverified citations, confirm/dismiss, mapping and applicability suggestions, source-page grounding |
| `/controls` | Framework/control library, autonomous answering agent, evidence, Mark as Gap |
| `/gaps` | Risk-ranked gaps, AI remediation plans |
| `/traceability`, `/traceability/:id` | Nine-step chain per obligation→control, hash-verified sign-off |
| `/simulation` | What-if scenarios and blast radius; heuristic or AI-graph method with per-control reasoning |
| `/library`, `/knowledge-base` | Document library and historical Q&A |
| `/audit-log`, `/settings` | Audit trail, users, security, AI provider settings, entity profile |

## Environment

`VITE_API_URL` points at the API (see `.env`). The vite config also reads the repo-root `.env` at build time to expose the **non-secret** default AI model names (`AWS_BEDROCK_MODEL_ID`, `AWS_BEDROCK_EMBEDDING_MODEL_ID`) to Settings - never the token.

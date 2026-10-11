import cors from "cors";
import express from "express";
import helmet from "helmet";
import { passport } from "./auth/passport.js";
import { requireAuth } from "./auth/middleware.js";
import { config } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { ipAllowlist } from "./middleware/ipAllowlist.js";
import { auditLogRouter } from "./routes/auditLog.js";
import { applicabilityRouter } from "./routes/applicability.js";
import { authRouter } from "./routes/auth.js";
import { automationRouter } from "./routes/automation.js";
import { changesRouter } from "./routes/changes.js";
import { circularsRouter } from "./routes/circulars.js";
import { complianceGapsRouter } from "./routes/complianceGaps.js";
import { contradictionsRouter } from "./routes/contradictions.js";
import { controlDetailsRouter } from "./routes/controlDetails.js";
import { controlsRouter } from "./routes/controls.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { discoveryRouter } from "./routes/discovery.js";
import { documentsRouter } from "./routes/documents.js";
import { healthRouter } from "./routes/health.js";
import { ingestionRouter } from "./routes/ingestion.js";
import { knowledgeEntriesRouter } from "./routes/knowledgeEntries.js";
import { mappingRouter } from "./routes/mapping.js";
import { obligationsRouter } from "./routes/obligations.js";
import { organizationsRouter } from "./routes/organizations.js";
import { profileRouter } from "./routes/profile.js";
import { questionsRouter } from "./routes/questions.js";
import { remediationRouter } from "./routes/remediation.js";
import { simulationRouter } from "./routes/simulation.js";
import { storageRouter } from "./routes/storage.js";
import { traceabilityRouter } from "./routes/traceability.js";
import { describeDatabase, schemaReady } from "./db/schemaCheck.js";
import { recoverStaleIngestions } from "./services/ingestion/ingestionService.js";
import { startScheduler } from "./services/scheduler.js";
import { usersRouter } from "./routes/users.js";

const app = express();

// Behind a reverse proxy / load balancer set TRUST_PROXY (e.g. "1", "loopback",
// or a comma-separated CIDR list) so req.ip is the real client address — the
// IP allowlist and audit log both depend on it.
if (process.env.TRUST_PROXY) {
  const v = process.env.TRUST_PROXY;
  app.set("trust proxy", /^\d+$/.test(v) ? Number(v) : v === "true" ? true : v);
}

app.use(helmet());
app.use(cors());
app.use(express.json());
// Express 5 leaves req.body undefined when a request has no body (Express 4 gave {}).
// Routes with optional bodies, such as POST /simulation/scenarios/:id/run, rely on {}.
app.use((req, _res, next) => {
  req.body ??= {};
  next();
});
app.use(passport.initialize());

app.use("/health", healthRouter);
app.use("/auth", authRouter);
// Signed-URL file serving for STORAGE_MODE=local (the signature is the auth).
app.use("/storage", storageRouter);

// Everything below requires a valid JWT + org IP allowlist check.
app.use(requireAuth, ipAllowlist);

app.use("/organizations", organizationsRouter);
app.use("/users", usersRouter);

// Regulations -> Obligations -> Controls -> Gaps pipeline.
app.use("/circulars", circularsRouter);
app.use("/controls", controlsRouter);
app.use("/questions", questionsRouter);
app.use("/discovery-runs", discoveryRouter);
// Multimodal ingestion (scanned circulars, tables, diagrams, office files, screenshots).
app.use("/ingestion", ingestionRouter);
// Intelligence agents: change analysis, obligation->control mapping, applicability, entity profile.
app.use("/changes", changesRouter);
app.use("/mapping", mappingRouter);
app.use("/applicability", applicabilityRouter);
app.use("/profile", profileRouter);
// Mixed-prefix routers — mounted at root since their paths are fully specified:
//   obligationsRouter:     /circulars/:id/obligations*, /obligations/*
//   controlDetailsRouter:  /controls/:id/{evidence,tests,kpis,questions}, /evidence/:id, /tests/:id/runs, /kpis/:id
//   remediationRouter:     /remediation-plans/*
app.use(obligationsRouter);
app.use(controlDetailsRouter);
app.use(remediationRouter);
app.use("/compliance-gaps", complianceGapsRouter);

app.use("/traceability", traceabilityRouter);
app.use("/contradictions", contradictionsRouter);
app.use("/simulation", simulationRouter);
app.use("/dashboard", dashboardRouter);
app.use("/automation", automationRouter);

app.use("/documents", documentsRouter);
app.use("/knowledge-base", knowledgeEntriesRouter);
app.use("/audit-log", auditLogRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`server listening on :${config.port} (${config.nodeEnv})`);
  startBackgroundWork();
});

// Background work (recurring agents, stale-run recovery) needs the schema. If the database is
// empty or still starting, say so once and retry, instead of failing on every query.
function startBackgroundWork() {
  let warned = false;
  const attempt = async () => {
    if (await schemaReady()) {
      if (warned) console.log("database schema found, starting background work");
      // Recurring agents (control auto-answering, discovery): claims due AgentSchedule rows.
      startScheduler();
      recoverStaleIngestions().catch((e) => console.error("recoverStaleIngestions:", e));
      return;
    }
    if (!warned) {
      warned = true;
      console.error(
        `database ${describeDatabase()} is unreachable or has no schema. Start it (docker compose up -d) and apply the schema ` +
          `(npm run migrate, or let Docker load it into an empty volume). Retrying every 10s; API requests that need data will fail until then.`
      );
    }
    setTimeout(attempt, 10_000).unref();
  };
  void attempt();
}

import { randomUUID } from "node:crypto";
import type {
  CreateSimulationScenarioInput,
  RunSimulationInput,
  SimulationMethod,
  SimulationReasoning,
  SimulationBreachedControl,
  SimulationCategory,
  SimulationRun,
  SimulationScenario,
  UpdateSimulationScenarioInput,
} from "@complianceos/shared";
import { assessControls, isAiConfigured, type SimControlFacts } from "../ai/agents/simulationAgent.js";
import { pool } from "../db/pool.js";
import { buildSet } from "../db/sql.js";
import type {
  SimulationBreachedControlRow,
  SimulationRunRow,
  SimulationScenarioRow,
} from "../db/types.js";
import { computeComplianceScore, getControlGapCounts } from "./dashboardService.js";

// Scenarios: global presets (organizationId IS NULL) are readable by everyone,
// only org-owned ones are mutable. Every SimulationRun carries the
// organizationId that ran it, so a preset's runs never leak across orgs.
const RUN_VISIBLE = `r."organizationId" = $1`;

const UPDATABLE_COLUMNS = [
  "name",
  "category",
  "targetCircularId",
  "targetRegulator",
  "hypothesisText",
] as const;

function toBreached(row: SimulationBreachedControlRow): SimulationBreachedControl {
  return {
    ...row,
    remediationCostAmount: row.remediationCostAmount === null ? null : Number(row.remediationCostAmount),
  };
}

function toRun(row: SimulationRunRow, breached: SimulationBreachedControlRow[]): SimulationRun {
  return {
    ...row,
    ranAt: row.ranAt as unknown as string,
    reasoning: (row.reasoning as SimulationReasoning | null) ?? null,
    breachedControls: breached.map(toBreached),
  };
}

async function loadBreached(runIds: string[]): Promise<Map<string, SimulationBreachedControlRow[]>> {
  const map = new Map<string, SimulationBreachedControlRow[]>();
  if (runIds.length === 0) return map;
  const { rows } = await pool.query<SimulationBreachedControlRow>(
    `SELECT * FROM "SimulationBreachedControl" WHERE "runId" = ANY($1::varchar[])
      ORDER BY "remediationCostAmount" DESC NULLS LAST, id`,
    [runIds]
  );
  for (const r of rows) {
    const list = map.get(r.runId);
    if (list) list.push(r);
    else map.set(r.runId, [r]);
  }
  return map;
}

function toScenario(row: SimulationScenarioRow, latestRun: SimulationRun | null): SimulationScenario {
  return {
    ...row,
    createdAt: row.createdAt as unknown as string,
    updatedAt: row.updatedAt as unknown as string,
    latestRun,
  };
}

export async function listScenarios(organizationId: string): Promise<SimulationScenario[]> {
  const { rows } = await pool.query<SimulationScenarioRow>(
    `SELECT * FROM "SimulationScenario"
      WHERE "organizationId" IS NULL OR "organizationId" = $1
      ORDER BY ("organizationId" IS NULL) DESC, "createdAt" ASC`,
    [organizationId]
  );
  if (rows.length === 0) return [];
  const runs = await pool.query<SimulationRunRow>(
    `SELECT DISTINCT ON (r."scenarioId") r.*
       FROM "SimulationRun" r JOIN "SimulationScenario" s ON s.id = r."scenarioId"
      WHERE r."scenarioId" = ANY($2::varchar[]) AND ${RUN_VISIBLE}
      ORDER BY r."scenarioId", r."ranAt" DESC`,
    [organizationId, rows.map((r) => r.id)]
  );
  const breached = await loadBreached(runs.rows.map((r) => r.id));
  const latest = new Map(runs.rows.map((r) => [r.scenarioId, toRun(r, breached.get(r.id) ?? [])]));
  return rows.map((row) => toScenario(row, latest.get(row.id) ?? null));
}

async function getScenarioRow(
  organizationId: string,
  id: string
): Promise<SimulationScenarioRow | null> {
  const { rows } = await pool.query<SimulationScenarioRow>(
    `SELECT * FROM "SimulationScenario"
      WHERE id = $1 AND ("organizationId" IS NULL OR "organizationId" = $2)`,
    [id, organizationId]
  );
  return rows[0] ?? null;
}

export async function getScenario(
  organizationId: string,
  id: string
): Promise<SimulationScenario | null> {
  const row = await getScenarioRow(organizationId, id);
  if (!row) return null;
  const runs = await listRuns(organizationId, id, 1);
  return toScenario(row, runs[0] ?? null);
}

export async function createScenario(
  organizationId: string,
  userId: string,
  input: CreateSimulationScenarioInput
): Promise<SimulationScenario> {
  const { rows } = await pool.query<SimulationScenarioRow>(
    `INSERT INTO "SimulationScenario"
       (id, "organizationId", name, category, "targetCircularId", "targetRegulator",
        "hypothesisText", "createdById")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      randomUUID(),
      organizationId,
      input.name,
      input.category,
      input.targetCircularId ?? null,
      input.targetRegulator ?? null,
      input.hypothesisText,
      userId,
    ]
  );
  return toScenario(rows[0], null);
}

export async function updateScenario(
  organizationId: string,
  id: string,
  input: UpdateSimulationScenarioInput
): Promise<SimulationScenario | null> {
  const set = buildSet(input, UPDATABLE_COLUMNS, 3);
  const { rows } = await pool.query<SimulationScenarioRow>(
    `UPDATE "SimulationScenario"
        SET ${set ? `${set.clause}, ` : ""}"updatedAt" = NOW()
      WHERE id = $1 AND "organizationId" = $2 RETURNING *`,
    [id, organizationId, ...(set?.values ?? [])]
  );
  if (!rows[0]) return null;
  const runs = await listRuns(organizationId, id, 1);
  return toScenario(rows[0], runs[0] ?? null);
}

export async function deleteScenario(organizationId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM "SimulationScenario" WHERE id = $1 AND "organizationId" = $2`,
    [id, organizationId]
  );
  return (rowCount ?? 0) > 0;
}

// Newest first. Returns [] for an unknown / invisible scenario.
export async function listRuns(
  organizationId: string,
  scenarioId: string,
  limit = 50
): Promise<SimulationRun[]> {
  const { rows } = await pool.query<SimulationRunRow>(
    `SELECT r.* FROM "SimulationRun" r JOIN "SimulationScenario" s ON s.id = r."scenarioId"
      WHERE r."scenarioId" = $2 AND (s."organizationId" IS NULL OR s."organizationId" = $1)
        AND ${RUN_VISIBLE}
      ORDER BY r."ranAt" DESC LIMIT $3`,
    [organizationId, scenarioId, limit]
  );
  const breached = await loadBreached(rows.map((r) => r.id));
  return rows.map((r) => toRun(r, breached.get(r.id) ?? []));
}

// --- Deterministic estimator (no LLM) ---------------------------------------
//
// Heuristics per hypothesis category:
//   affectedShare   fraction of all controls the event would push out of
//                   compliance (N = ceil(share * totalControls), capped by the
//                   number of controls that currently have no open gap);
//   criticalShare   fraction of those N new gaps that are CRITICAL, the rest HIGH;
//   costPerControl  INR remediation cost per breached control;
//   days            remediation lead time per breached control.
// Breached controls are picked from controls with no open gap, preferring the
// scenario's target circular, then IMPLEMENTED ones (they lose status), then
// HIGH-relevance ones. Relevance HIGH costs 1.5x, LOW 0.6x.
// initial/simulated score = computeComplianceScore (controls without open gap);
// blastRadiusScore = 100 * N / totalControls.

interface CategoryModel {
  affectedShare: number;
  criticalShare: number;
  costPerControl: number;
  days: number;
  label: string;
}

const MODELS: Record<SimulationCategory, CategoryModel> = {
  REGULATORY_AMENDMENT: { affectedShare: 0.25, criticalShare: 0.2, costPerControl: 250_000, days: 30, label: "regulatory amendment" },
  GEOPOLITICAL_SANCTION: { affectedShare: 0.15, criticalShare: 0.3, costPerControl: 800_000, days: 45, label: "geopolitical sanction" },
  INFRASTRUCTURE_FAILURE: { affectedShare: 0.35, criticalShare: 0.4, costPerControl: 500_000, days: 21, label: "infrastructure failure" },
  MERGER_ACQUISITION: { affectedShare: 0.3, criticalShare: 0.25, costPerControl: 1_000_000, days: 90, label: "merger / acquisition" },
};

const RELEVANCE_COST: Record<string, number> = { HIGH: 1.5, MEDIUM: 1, LOW: 0.6 };

interface CandidateControl {
  id: string;
  title: string;
  relevance: string | null;
}

const AI_CONTEXT_LIMIT = 60;

async function loadGraphFacts(
  organizationId: string,
  controlIds: string[]
): Promise<Map<string, Omit<SimControlFacts, "id" | "title" | "relevance" | "implementationStatus">>> {
  const map = new Map<string, Omit<SimControlFacts, "id" | "title" | "relevance" | "implementationStatus">>();
  for (const id of controlIds) map.set(id, { obligations: [], tests: [], evidence: [] });
  if (controlIds.length === 0) return map;
  const obl = await pool.query<{ controlId: string; id: string; identifier: string | null; text: string }>(
    `SELECT oc."controlId", o.id, o.identifier, LEFT(o."requirementText", 500) AS text
       FROM "ObligationControl" oc JOIN "Obligation" o ON o.id = oc."obligationId"
      WHERE oc."controlId" = ANY($1::varchar[]) AND oc."reviewStatus" = 'CONFIRMED'
        AND (o."organizationId" IS NULL OR o."organizationId" = $2)
      ORDER BY o.identifier`,
    [controlIds, organizationId]
  );
  for (const r of obl.rows) {
    const list = map.get(r.controlId)!.obligations;
    if (list.length < 6) list.push({ id: r.id, identifier: r.identifier, text: r.text });
  }
  const tests = await pool.query<{ controlId: string; type: string; result: string; testedAt: Date | null; notes: string | null }>(
    `SELECT DISTINCT ON (t.id) t."controlId", t."testType" AS type, r.result, r."testedAt", LEFT(r.notes, 300) AS notes
       FROM "ControlTest" t JOIN "ControlTestRun" r ON r."testId" = t.id
      WHERE t."controlId" = ANY($1::varchar[])
      ORDER BY t.id, r."testedAt" DESC`,
    [controlIds]
  );
  for (const r of tests.rows) {
    map.get(r.controlId)!.tests.push({
      type: r.type,
      result: r.result,
      testedAt: r.testedAt ? new Date(r.testedAt).toISOString().slice(0, 10) : null,
      notes: r.notes,
    });
  }
  const ev = await pool.query<{ controlId: string; name: string; status: string; excerpt: string | null; facts: unknown }>(
    `SELECT "controlId", name, status, LEFT(excerpt, 300) AS excerpt, facts
       FROM "Evidence" WHERE "controlId" = ANY($1::varchar[]) AND "organizationId" = $2
      ORDER BY "createdAt" DESC`,
    [controlIds, organizationId]
  );
  for (const r of ev.rows) {
    const list = map.get(r.controlId)!.evidence;
    if (list.length < 5) list.push({ name: r.name, status: r.status, excerpt: r.excerpt, facts: r.facts });
  }
  return map;
}

interface Selection {
  method: SimulationMethod;
  listed: (CandidateControl & { reason?: string })[];
  breachedCount: number;
  reasoning: SimulationReasoning | null;
  fallbackNote?: string;
}

export async function runScenario(
  organizationId: string,
  userId: string,
  scenarioId: string,
  input: RunSimulationInput = { method: "AUTO" }
): Promise<SimulationRun | null> {
  const scenario = await getScenarioRow(organizationId, scenarioId);
  if (!scenario) return null;
  const model = MODELS[scenario.category];
  const counts = await getControlGapCounts(organizationId);

  const candidates = await pool.query<CandidateControl & { total: number; implementationStatus: string | null }>(
    `SELECT c.id, c.title, c.relevance, c."implementationStatus", COUNT(*) OVER ()::int AS total
       FROM "Control" c
      WHERE (c."organizationId" IS NULL OR c."organizationId" = $1)
        AND NOT EXISTS (
          SELECT 1 FROM "ComplianceGap" g
           WHERE g."controlId" = c.id AND g."organizationId" = $1
             AND g.status NOT IN ('RESOLVED', 'RISK_ACCEPTED'))
      ORDER BY (c."circularId" IS NOT DISTINCT FROM $2) DESC,
               (c."implementationStatus" = 'IMPLEMENTED') DESC NULLS LAST,
               (c.relevance = 'HIGH') DESC NULLS LAST,
               c.id ASC
      LIMIT ${AI_CONTEXT_LIMIT}`,
    [organizationId, scenario.targetCircularId]
  );
  const available = candidates.rows[0]?.total ?? 0;

  const heuristic = (): Selection => {
    const breachedCount = Math.min(Math.ceil(model.affectedShare * counts.totalControls), available);
    return {
      method: "HEURISTIC",
      listed: candidates.rows.slice(0, Math.min(breachedCount, 10)),
      breachedCount,
      reasoning: null,
    };
  };

  let sel: Selection;
  const wantAi =
    input.method === "AI_GRAPH" || (input.method === "AUTO" && (await isAiConfigured(organizationId)));
  if (!wantAi) {
    sel = heuristic();
  } else {
    try {
      const facts = await loadGraphFacts(organizationId, candidates.rows.map((c) => c.id));
      const controls: SimControlFacts[] = candidates.rows.map((c) => ({
        id: c.id,
        title: c.title,
        relevance: c.relevance,
        implementationStatus: c.implementationStatus,
        ...facts.get(c.id)!,
      }));
      const { verdicts, model: modelId } = await assessControls(
        organizationId,
        {
          name: scenario.name,
          category: scenario.category,
          regulator: scenario.targetRegulator,
          hypothesis: scenario.hypothesisText,
        },
        controls
      );
      const byId = new Map(candidates.rows.map((c) => [c.id, c]));
      const breachedVerdicts = verdicts
        .filter((v) => v.breached)
        .sort((a, b) => b.confidence - a.confidence);
      const reasonOf = new Map(breachedVerdicts.map((v) => [v.controlId, v.reason]));
      sel = {
        method: "AI_GRAPH",
        listed: breachedVerdicts.map((v) => ({ ...byId.get(v.controlId)!, reason: reasonOf.get(v.controlId) })),
        breachedCount: breachedVerdicts.length,
        reasoning: {
          method: "AI_GRAPH",
          model: modelId,
          graph: {
            obligations: controls.reduce((n, c) => n + c.obligations.length, 0),
            controls: controls.length,
            openGaps: counts.controlsWithOpenGap,
          },
          controls: verdicts.map((v) => ({
            controlId: v.controlId,
            breached: v.breached,
            reason: v.reason,
            obligationIds: v.obligationIds,
          })),
        },
      };
    } catch (err) {
      sel = heuristic();
      const msg = err instanceof Error ? err.message : String(err);
      sel.fallbackNote = `AI graph analysis failed (${msg.slice(0, 200)}); fell back to the heuristic estimate.`;
      sel.reasoning = {
        method: "AI_GRAPH",
        model: null,
        graph: { obligations: 0, controls: 0, openGaps: counts.controlsWithOpenGap },
        controls: [],
        notes: sel.fallbackNote,
      };
    }
  }

  const breachedCount = sel.breachedCount;
  const newCritical = Math.round(breachedCount * model.criticalShare);
  const newHigh = breachedCount - newCritical;
  const listed = sel.listed;
  const isAi = sel.method === "AI_GRAPH";

  const target = scenario.targetRegulator ?? "the targeted regulator";
  const hypothesis = scenario.hypothesisText.replace(/\s+/g, " ").slice(0, 160);
  const runId = randomUUID();
  const run: SimulationRunRow = {
    id: runId,
    scenarioId,
    organizationId,
    initialCriticalGaps: counts.openCriticalGaps,
    initialHighGaps: counts.openHighGaps,
    initialComplianceScore: computeComplianceScore(counts.totalControls, counts.controlsWithOpenGap),
    simulatedCriticalGaps: counts.openCriticalGaps + newCritical,
    simulatedHighGaps: counts.openHighGaps + newHigh,
    simulatedComplianceScore: computeComplianceScore(
      counts.totalControls,
      counts.controlsWithOpenGap + breachedCount
    ),
    blastRadiusScore:
      counts.totalControls > 0
        ? Math.round((breachedCount / counts.totalControls) * 1000) / 10
        : null,
    unaffectedControlsCount: Math.max(counts.totalControls - breachedCount, 0),
    suggestedPlaybook:
      `${isAi ? "Graph-grounded" : "Estimated"} ${model.label} impact on ${target}: ${breachedCount} of ${counts.totalControls} controls ` +
      `would fall out of compliance (${newCritical} critical, ${newHigh} high new gaps). ` +
      `1) Freeze changes to the breached controls. 2) Assign owners and open remediation plans, ` +
      `starting with the critical gaps (about ${model.days} days each). ` +
      `3) Re-run this scenario after mitigation. Hypothesis: ${hypothesis}`,
    method: sel.method,
    reasoning: sel.reasoning,
    ranById: userId,
    ranAt: new Date(),
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ran = await client.query<{ ranAt: Date }>(
      `INSERT INTO "SimulationRun"
         (id, "scenarioId", "organizationId", "initialCriticalGaps", "initialHighGaps", "initialComplianceScore",
          "simulatedCriticalGaps", "simulatedHighGaps", "simulatedComplianceScore",
          "blastRadiusScore", "unaffectedControlsCount", "suggestedPlaybook", method, reasoning, "ranById")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING "ranAt"`,
      [
        run.id,
        run.scenarioId,
        run.organizationId,
        run.initialCriticalGaps,
        run.initialHighGaps,
        run.initialComplianceScore,
        run.simulatedCriticalGaps,
        run.simulatedHighGaps,
        run.simulatedComplianceScore,
        run.blastRadiusScore,
        run.unaffectedControlsCount,
        run.suggestedPlaybook,
        run.method,
        run.reasoning ? JSON.stringify(run.reasoning) : null,
        run.ranById,
      ]
    );
    run.ranAt = ran.rows[0].ranAt;

    const breached: SimulationBreachedControlRow[] = [];
    for (const c of listed) {
      const row: SimulationBreachedControlRow = {
        id: randomUUID(),
        runId,
        controlId: c.id,
        controlName: c.title,
        reason: c.reason ?? `Assumed to fall out of compliance under the ${model.label} hypothesis.`,
        remediationCostAmount: String(Math.round(model.costPerControl * (RELEVANCE_COST[c.relevance ?? "MEDIUM"] ?? 1))),
        remediationCostCurrency: "INR",
        remediationCostNote: isAi ? "AI-graph estimate" : "Heuristic estimate",
        remediationDays: model.days,
      };
      await client.query(
        `INSERT INTO "SimulationBreachedControl"
           (id, "runId", "controlId", "controlName", reason, "remediationCostAmount",
            "remediationCostCurrency", "remediationCostNote", "remediationDays")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          row.id,
          row.runId,
          row.controlId,
          row.controlName,
          row.reason,
          row.remediationCostAmount,
          row.remediationCostCurrency,
          row.remediationCostNote,
          row.remediationDays,
        ]
      );
      breached.push(row);
    }
    await client.query("COMMIT");
    return toRun(run, breached);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

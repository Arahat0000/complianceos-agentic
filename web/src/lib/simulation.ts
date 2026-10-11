import type { SimulationScenario, SimulationRun, SimulationBreachedControl, SimulationReasoning, SimulationMethod } from "@complianceos/shared";
import { apiFetch } from "@/lib/api";

export type SimCategory = SimulationScenario["category"];

interface UiBreachedControl {
  id: string;
  name: string;
  reason: string;
  remediationCostEst: string;
  remediationDays: number | null;
}

export type RunMethod = "AUTO" | SimulationMethod;

export interface UiSimulatedState {
  method?: SimulationMethod;
  reasoning?: SimulationReasoning | null;
  criticalGaps: number;
  highGaps: number;
  complianceScore: number | null;
  blastRadiusScore: number | null;
  newlyBreachedControls: UiBreachedControl[];
  unaffectedControlsCount: number | null;
  suggestedPlaybook: string;
}

/** Superset of the static preset type (demo presets are assignable to it). */
export interface UiScenario {
  id: string;
  name: string;
  category: SimCategory;
  targetRegulator: string;
  targetCircularId?: string | null;
  hypothesisText: string;
  /** false for built-in presets (organizationId null) */
  editable?: boolean;
  initialState: { criticalGaps: number; highGaps: number; complianceScore: number | null };
  /** null when the scenario has never been run */
  simulatedState: UiSimulatedState | null;
}

function formatCost(c: SimulationBreachedControl): string {
  const amount =
    c.remediationCostAmount == null
      ? null
      : new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: c.remediationCostCurrency || "INR",
          maximumFractionDigits: 0,
        }).format(c.remediationCostAmount);
  if (amount && c.remediationCostNote) return `${amount} ${c.remediationCostNote}`;
  return amount ?? c.remediationCostNote ?? "N/A";
}

function mapRun(run: SimulationRun): {
  initialState: UiScenario["initialState"];
  simulatedState: UiSimulatedState;
} {
  return {
    initialState: {
      criticalGaps: run.initialCriticalGaps,
      highGaps: run.initialHighGaps,
      complianceScore: run.initialComplianceScore,
    },
    simulatedState: {
      method: run.method,
      reasoning: run.reasoning,
      criticalGaps: run.simulatedCriticalGaps,
      highGaps: run.simulatedHighGaps,
      complianceScore: run.simulatedComplianceScore,
      blastRadiusScore: run.blastRadiusScore,
      unaffectedControlsCount: run.unaffectedControlsCount,
      suggestedPlaybook: run.suggestedPlaybook ?? "",
      newlyBreachedControls: run.breachedControls.map((c) => ({
        id: c.controlId ?? c.id,
        name: c.controlName,
        reason: c.reason ?? "",
        remediationCostEst: formatCost(c),
        remediationDays: c.remediationDays,
      })),
    },
  };
}

function mapScenario(s: SimulationScenario): UiScenario {
  const run = s.latestRun ? mapRun(s.latestRun) : null;
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    targetRegulator: s.targetRegulator ?? "",
    targetCircularId: s.targetCircularId,
    hypothesisText: s.hypothesisText,
    editable: s.organizationId !== null,
    initialState: run?.initialState ?? { criticalGaps: 0, highGaps: 0, complianceScore: null },
    simulatedState: run?.simulatedState ?? null,
  };
}

export interface ScenarioInput {
  name: string;
  category?: SimCategory;
  targetRegulator?: string;
  targetCircularId?: string;
  hypothesisText: string;
}

export async function fetchScenarios(): Promise<UiScenario[]> {
  const rows = await apiFetch<SimulationScenario[]>("/simulation/scenarios");
  return rows.map(mapScenario);
}

export async function createScenario(input: ScenarioInput & { category: SimCategory }): Promise<UiScenario> {
  const row = await apiFetch<SimulationScenario>("/simulation/scenarios", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return mapScenario(row);
}

export async function updateScenario(id: string, input: Partial<ScenarioInput>): Promise<UiScenario> {
  const row = await apiFetch<SimulationScenario>(`/simulation/scenarios/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return mapScenario(row);
}

export async function deleteScenario(id: string): Promise<void> {
  await apiFetch(`/simulation/scenarios/${id}`, { method: "DELETE" });
}

export async function runScenario(id: string, method: RunMethod = "AUTO") {
  const run = await apiFetch<SimulationRun>(`/simulation/scenarios/${id}/run`, {
    method: "POST",
    body: JSON.stringify({ method }),
  });
  return mapRun(run);
}

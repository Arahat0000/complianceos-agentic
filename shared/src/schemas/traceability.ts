import { z } from "zod";
import {
  ConflictNature,
  Regulator,
  RiskLevel,
  SimulationCategory,
} from "../types/enums.js";

// POST /traceability/:obligationId/:controlId/signoff
export const signoffSchema = z.object({
  signedRole: z.string().min(1).default("CCO"),
});
export type SignoffInput = z.infer<typeof signoffSchema>;

export const contradictionPartySchema = z.object({
  circularId: z.string().optional(),
  regulator: z.enum(Regulator),
  circularTitle: z.string().optional(),
  clause: z.string().optional(),
  requirement: z.string().optional(),
  timelineOrCondition: z.string().optional(),
});
export type ContradictionPartyInput = z.infer<typeof contradictionPartySchema>;

export const createContradictionSchema = z.object({
  domain: z.string().optional(),
  severity: z.enum(RiskLevel).default("MEDIUM"),
  title: z.string().min(1),
  description: z.string().optional(),
  conflictNature: z.enum(ConflictNature),
  strictestCommonDenominator: z.string().optional(),
  operationalRule: z.string().optional(),
  automatedControlId: z.string().optional(),
  auditDefenseRationale: z.string().optional(),
  parties: z.array(contradictionPartySchema).default([]),
  obligationIds: z.array(z.string()).default([]),
});
export type CreateContradictionInput = z.infer<typeof createContradictionSchema>;

export const updateContradictionSchema = createContradictionSchema.partial();
export type UpdateContradictionInput = z.infer<typeof updateContradictionSchema>;

// POST /contradictions/:id/harmonize
export const harmonizeContradictionSchema = z.object({
  obligationId: z.string().min(1),
  harmonized: z.boolean().default(true),
});
export type HarmonizeContradictionInput = z.infer<typeof harmonizeContradictionSchema>;

// --- Simulation ---------------------------------------------------------

export const createSimulationScenarioSchema = z.object({
  name: z.string().min(1),
  category: z.enum(SimulationCategory).default("REGULATORY_AMENDMENT"),
  targetCircularId: z.string().optional(),
  targetRegulator: z.string().optional(),
  hypothesisText: z.string().min(1),
});
export type CreateSimulationScenarioInput = z.infer<typeof createSimulationScenarioSchema>;

export const updateSimulationScenarioSchema = createSimulationScenarioSchema.partial();
export type UpdateSimulationScenarioInput = z.infer<typeof updateSimulationScenarioSchema>;

export const simulationBreachedControlSchema = z.object({
  controlId: z.string().optional(),
  controlName: z.string().min(1),
  reason: z.string().optional(),
  remediationCostAmount: z.number().nonnegative().optional(),
  remediationCostCurrency: z.string().length(3).default("INR"),
  remediationCostNote: z.string().optional(),
  remediationDays: z.number().int().nonnegative().optional(),
});

// Result of one simulation run (what a simulation engine/agent produces).
export const simulationRunResultSchema = z.object({
  initialCriticalGaps: z.number().int().nonnegative(),
  initialHighGaps: z.number().int().nonnegative(),
  initialComplianceScore: z.number().optional(),
  simulatedCriticalGaps: z.number().int().nonnegative(),
  simulatedHighGaps: z.number().int().nonnegative(),
  simulatedComplianceScore: z.number().optional(),
  blastRadiusScore: z.number().optional(),
  unaffectedControlsCount: z.number().int().nonnegative().optional(),
  suggestedPlaybook: z.string().optional(),
  breachedControls: z.array(simulationBreachedControlSchema).default([]),
});
export type SimulationRunResult = z.infer<typeof simulationRunResultSchema>;

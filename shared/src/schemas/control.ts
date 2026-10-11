import { z } from "zod";
import {
  ControlStatus,
  EvidenceStatus,
  ImplementationStatus,
  MonitoringHealth,
  OriginSource,
  Relevance,
  TestResult,
  TestType,
} from "../types/enums.js";

export const createControlSchema = z.object({
  circularId: z.string().min(1),
  code: z.string().optional(),
  source: z.enum(OriginSource).default("MANUAL"),
  title: z.string().min(1),
  description: z.string().optional(),
  relevance: z.enum(Relevance).optional(),
  category: z.string().optional(),
  framework: z.string().optional(),
  status: z.enum(ControlStatus).default("ACTIVE"),
  implementationStatus: z.enum(ImplementationStatus).optional(),
  ownerName: z.string().optional(),
  answer: z.string().optional(),
  notes: z.string().optional(),
  // Obligations this control satisfies (many-to-many via ObligationControl).
  obligationIds: z.array(z.string()).optional(),
});
export type CreateControlInput = z.infer<typeof createControlSchema>;

export const updateControlSchema = createControlSchema
  .omit({ circularId: true, source: true, obligationIds: true })
  .partial();
export type UpdateControlInput = z.infer<typeof updateControlSchema>;

// POST /obligations/:id/controls — map a control to an obligation.
export const linkObligationControlSchema = z.object({
  controlId: z.string().min(1),
  mappingSource: z.enum(OriginSource).default("MANUAL"),
  confidence: z.number().min(0).max(1).optional(),
});
export type LinkObligationControlInput = z.infer<typeof linkObligationControlSchema>;

// Control question shown per circular ("Q-RBI-05"), linked to controls.
export const createQuestionSchema = z.object({
  circularId: z.string().min(1),
  code: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  source: z.enum(OriginSource).default("MANUAL"),
  answer: z.string().optional(),
  controlIds: z.array(z.string()).optional(),
});
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const updateQuestionSchema = createQuestionSchema
  .omit({ circularId: true, source: true })
  .partial();
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;

// Evidence attached to a control (a library document or a stand-alone file).
export const createEvidenceSchema = z.object({
  documentId: z.string().optional(),
  name: z.string().min(1),
  documentType: z.string().optional(),
  section: z.string().optional(),
  excerpt: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  fileUrl: z.string().optional(),
  status: z.enum(EvidenceStatus).default("PENDING"),
  lastAuditDate: z.coerce.date().optional(),
});
export type CreateEvidenceInput = z.infer<typeof createEvidenceSchema>;

export const updateEvidenceSchema = createEvidenceSchema.partial();
export type UpdateEvidenceInput = z.infer<typeof updateEvidenceSchema>;

// Control testing and monitoring (traceability steps "Testing", "Monitoring").
export const createControlTestSchema = z.object({
  testType: z.enum(TestType),
  frequency: z.string().optional(),
});
export type CreateControlTestInput = z.infer<typeof createControlTestSchema>;

export const recordTestRunSchema = z.object({
  testedAt: z.coerce.date().default(() => new Date()),
  result: z.enum(TestResult),
  notes: z.string().optional(),
  testedByName: z.string().optional(),
});
export type RecordTestRunInput = z.infer<typeof recordTestRunSchema>;

export const createMonitoringKpiSchema = z.object({
  kpi: z.string().min(1),
  threshold: z.string().optional(),
  currentValue: z.string().optional(),
  health: z.enum(MonitoringHealth).default("HEALTHY"),
  telemetrySource: z.string().optional(),
});
export type CreateMonitoringKpiInput = z.infer<typeof createMonitoringKpiSchema>;

export const updateMonitoringKpiSchema = createMonitoringKpiSchema.partial();
export type UpdateMonitoringKpiInput = z.infer<typeof updateMonitoringKpiSchema>;

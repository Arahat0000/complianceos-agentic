import { z } from "zod";
import { Regulator } from "../types/enums.js";

// POST /discovery-runs — "Scan Now". Optionally limit to some regulators.
export const startDiscoveryRunSchema = z.object({
  regulators: z.array(z.enum(Regulator)).optional(),
});
export type StartDiscoveryRunInput = z.infer<typeof startDiscoveryRunSchema>;

// One stage of the discovery agent, stored in DiscoveryRun.stages.
export const discoveryStageSchema = z.object({
  tool: z.string(),
  args: z.string().optional(),
  target: z.string().optional(),
  title: z.string(),
  detail: z.string().optional(),
});
export type DiscoveryStage = z.infer<typeof discoveryStageSchema>;

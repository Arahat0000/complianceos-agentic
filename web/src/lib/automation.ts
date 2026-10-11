import type { AgentSchedule, ControlAnswerRun, ControlAnswerAutomation } from "@complianceos/shared";
import { apiFetch } from "@/lib/api";

const BASE = "/automation/control-answers";

export interface UpdateAutomationInput {
  enabled?: boolean;
  intervalHours?: number;
  config?: { onlyEmpty?: boolean; maxPerRun?: number };
}

export const fetchControlAnswerAutomation = () => apiFetch<ControlAnswerAutomation>(BASE);
export const updateControlAnswerAutomation = (body: UpdateAutomationInput) =>
  apiFetch<AgentSchedule>(BASE, { method: "PUT", body: JSON.stringify(body) });
export const runControlAnswerAutomation = () =>
  apiFetch<ControlAnswerRun>(`${BASE}/run`, { method: "POST" });
export const fetchControlAnswerRun = (id: string) => apiFetch<ControlAnswerRun>(`${BASE}/runs/${id}`);

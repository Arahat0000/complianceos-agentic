import type { DashboardSummary, DailyPipelineSnapshot } from "@complianceos/shared";
import { apiFetch } from "./api";

export function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>("/dashboard/summary");
}

export function fetchPipelineActivity(days: 7 | 30 | 90): Promise<DailyPipelineSnapshot[]> {
  return apiFetch<DailyPipelineSnapshot[]>(`/dashboard/pipeline-activity?days=${days}`);
}

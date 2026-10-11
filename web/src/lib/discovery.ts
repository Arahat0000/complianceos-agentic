import type { DiscoveryRun, Circular } from "@complianceos/shared";
import { apiFetch } from "./api";

export function startDiscoveryRun(regulators?: string[]): Promise<DiscoveryRun> {
  return apiFetch<DiscoveryRun>("/discovery-runs", {
    method: "POST",
    body: JSON.stringify(regulators ? { regulators } : {}),
  });
}

export function fetchDiscoveryRuns(): Promise<DiscoveryRun[]> {
  return apiFetch<DiscoveryRun[]>("/discovery-runs");
}

export function fetchDiscoveryRun(id: string): Promise<DiscoveryRun> {
  return apiFetch<DiscoveryRun>(`/discovery-runs/${id}`);
}

export function adoptCircular(id: string): Promise<Circular> {
  return apiFetch<Circular>(`/circulars/${id}/adopt`, { method: "POST" });
}

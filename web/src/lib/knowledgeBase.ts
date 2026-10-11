import type { KnowledgeBaseEntry } from "@complianceos/shared";
import { apiFetch } from "./api";

export type BackendKnowledgeBaseEntry = KnowledgeBaseEntry;

export function fetchKnowledgeBaseEntries(): Promise<BackendKnowledgeBaseEntry[]> {
  return apiFetch<BackendKnowledgeBaseEntry[]>("/knowledge-base");
}

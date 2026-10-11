import type { Document } from "@complianceos/shared";
import { apiFetch } from "./api";

export type BackendDocument = Document;

export function fetchDocuments(): Promise<BackendDocument[]> {
  return apiFetch<BackendDocument[]>("/documents");
}

export interface UploadDocumentInput {
  name: string;
  department?: string;
  classification?: string;
  description?: string;
  owner?: string;
  tags?: string[];
  effectiveDate?: string;
  expiryDate?: string;
}

export function uploadDocument(file: File, input: UploadDocumentInput): Promise<BackendDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", input.name);
  if (input.department) formData.append("department", input.department);
  if (input.classification) formData.append("classification", input.classification);
  if (input.description) formData.append("description", input.description);
  if (input.owner) formData.append("owner", input.owner);
  if (input.tags) input.tags.forEach((tag) => formData.append("tags", tag));
  if (input.effectiveDate) formData.append("effectiveDate", input.effectiveDate);
  if (input.expiryDate) formData.append("expiryDate", input.expiryDate);

  return apiFetch<BackendDocument>("/documents", {
    method: "POST",
    body: formData,
  });
}

export function fetchDocumentDownloadUrl(
  id: string,
): Promise<{ url: string; expiresInSeconds: number }> {
  return apiFetch<{ url: string; expiresInSeconds: number }>(`/documents/${id}/download-url`);
}

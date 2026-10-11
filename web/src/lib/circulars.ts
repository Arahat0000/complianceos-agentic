import type { Circular } from "@complianceos/shared";
import { apiFetch } from "./api";

export type BackendCircular = Circular;

export function fetchCirculars(): Promise<BackendCircular[]> {
  return apiFetch<BackendCircular[]>("/circulars");
}

export function fetchCircular(id: string): Promise<BackendCircular> {
  return apiFetch<BackendCircular>(`/circulars/${id}`);
}

export interface CreateCircularInput {
  circularId: string;
  name: string;
  body: string;
  category?: string;
  categoryCode?: string;
  description?: string;
  tags?: string[];
  dateOfIssue?: string;
  status?: string;
  version?: string;
  link?: string;
  linkRef?: string;
  applicableTo?: string;
}

export function createCircular(input: CreateCircularInput): Promise<BackendCircular> {
  return apiFetch<BackendCircular>("/circulars", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

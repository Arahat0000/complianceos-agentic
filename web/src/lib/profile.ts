import { apiFetch } from "./api";

export interface EntityProfile {
  organizationId?: string;
  entityType: string | null;
  regulators: string[] | null;
  assetSizeCrore: string | number | null;
  licenses: string[] | null;
  jurisdictions: string[] | null;
  products: string[] | null;
  notes: string | null;
}

export interface UpsertEntityProfile {
  entityType?: string;
  regulators?: string[];
  assetSizeCrore?: number | null;
  licenses?: string[];
  jurisdictions?: string[];
  products?: string[];
  notes?: string;
}

export const fetchProfile = () => apiFetch<EntityProfile | null>("/profile");

export const saveProfile = (input: UpsertEntityProfile) =>
  apiFetch<EntityProfile>("/profile", { method: "PUT", body: JSON.stringify(input) });

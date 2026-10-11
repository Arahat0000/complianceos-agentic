import type { UpsertProfileInput } from "@complianceos/shared";
import { pool } from "../db/pool.js";
import type { OrganizationProfileRow } from "../db/types.js";

export async function getProfile(organizationId: string): Promise<OrganizationProfileRow | null> {
  const { rows } = await pool.query<OrganizationProfileRow>(
    'SELECT * FROM "OrganizationProfile" WHERE "organizationId" = $1',
    [organizationId]
  );
  return rows[0] ?? null;
}

// Upsert; fields not present in the input keep their stored value.
export async function upsertProfile(
  organizationId: string,
  input: UpsertProfileInput
): Promise<OrganizationProfileRow> {
  const has = (k: keyof UpsertProfileInput) => input[k] !== undefined;
  const { rows } = await pool.query<OrganizationProfileRow>(
    `INSERT INTO "OrganizationProfile"
       ("organizationId", "entityType", regulators, "assetSizeCrore", licenses, jurisdictions, products, notes, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
     ON CONFLICT ("organizationId") DO UPDATE SET
       "entityType" = CASE WHEN $9 THEN EXCLUDED."entityType" ELSE "OrganizationProfile"."entityType" END,
       regulators = CASE WHEN $10 THEN EXCLUDED.regulators ELSE "OrganizationProfile".regulators END,
       "assetSizeCrore" = CASE WHEN $11 THEN EXCLUDED."assetSizeCrore" ELSE "OrganizationProfile"."assetSizeCrore" END,
       licenses = CASE WHEN $12 THEN EXCLUDED.licenses ELSE "OrganizationProfile".licenses END,
       jurisdictions = CASE WHEN $13 THEN EXCLUDED.jurisdictions ELSE "OrganizationProfile".jurisdictions END,
       products = CASE WHEN $14 THEN EXCLUDED.products ELSE "OrganizationProfile".products END,
       notes = CASE WHEN $15 THEN EXCLUDED.notes ELSE "OrganizationProfile".notes END,
       "updatedAt" = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      organizationId,
      input.entityType ?? null,
      input.regulators ?? null,
      input.assetSizeCrore ?? null,
      input.licenses ?? null,
      input.jurisdictions ?? null,
      input.products ?? null,
      input.notes ?? null,
      has("entityType"),
      has("regulators"),
      has("assetSizeCrore"),
      has("licenses"),
      has("jurisdictions"),
      has("products"),
      has("notes"),
    ]
  );
  return rows[0];
}

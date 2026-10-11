import { randomUUID } from "node:crypto";
import type {
  AddIpWhitelistInput,
  InviteMemberInput,
  Role,
  UpdateOrganizationInput,
  UpdateOrgSecuritySettingsInput,
} from "@complianceos/shared";
import { pool } from "../db/pool.js";
import { buildSet } from "../db/sql.js";
import type {
  InviteRow,
  MembershipRow,
  MembershipWithUserRow,
  OrganizationIPWhitelistRow,
  OrganizationRow,
  OrganizationSettingsRow,
} from "../db/types.js";

// Thrown for expected, user-facing failures; the router maps it to a status.
export class OrgServiceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function getOrganization(id: string): Promise<OrganizationRow | null> {
  const { rows } = await pool.query<OrganizationRow>('SELECT * FROM "Organization" WHERE id = $1', [
    id,
  ]);
  return rows[0] ?? null;
}

export async function updateOrganization(
  id: string,
  input: UpdateOrganizationInput
): Promise<OrganizationRow | null> {
  if (input.name === undefined) return getOrganization(id);
  const { rows } = await pool.query<OrganizationRow>(
    'UPDATE "Organization" SET name = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
    [id, input.name]
  );
  return rows[0] ?? null;
}

export async function listMembers(organizationId: string): Promise<MembershipWithUserRow[]> {
  const { rows } = await pool.query<MembershipWithUserRow>(
    `SELECT "Membership".*, "User".email, "User".name, "User"."avatarUrl"
       FROM "Membership"
       JOIN "User" ON "User".id = "Membership"."userId"
      WHERE "Membership"."organizationId" = $1
      ORDER BY "Membership"."createdAt" ASC`,
    [organizationId]
  );
  return rows;
}

export async function inviteMember(
  organizationId: string,
  input: InviteMemberInput
): Promise<InviteRow> {
  const id = randomUUID();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const { rows } = await pool.query<InviteRow>(
    `INSERT INTO "Invite" (id, email, role, token, "organizationId", "expiresAt")
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, input.email, input.role, token, organizationId, expiresAt]
  );
  // Sending the invite email is a side effect for the worker, not this
  // request path — enqueue it (a new queue + worker/src/jobs/inviteEmail.ts)
  // once outbound email sending exists.
  return rows[0];
}

// --- Members ------------------------------------------------------------

async function loadMemberForUpdate(
  client: import("pg").PoolClient,
  organizationId: string,
  membershipId: string
): Promise<MembershipRow> {
  // Lock every ADMIN row of the org too, so two concurrent demotions can't
  // both pass the "last admin" check.
  await client.query(
    `SELECT id FROM "Membership" WHERE "organizationId" = $1 AND role = 'ADMIN' FOR UPDATE`,
    [organizationId]
  );
  const { rows } = await client.query<MembershipRow>(
    'SELECT * FROM "Membership" WHERE id = $1 AND "organizationId" = $2 FOR UPDATE',
    [membershipId, organizationId]
  );
  if (!rows[0]) throw new OrgServiceError("Member not found", 404);
  return rows[0];
}

async function otherActiveAdminCount(
  client: import("pg").PoolClient,
  organizationId: string,
  excludeMembershipId: string
): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM "Membership"
      WHERE "organizationId" = $1 AND role = 'ADMIN' AND status = 'ACTIVE' AND id <> $2`,
    [organizationId, excludeMembershipId]
  );
  return Number(rows[0].count);
}

async function getMember(
  organizationId: string,
  membershipId: string
): Promise<MembershipWithUserRow | null> {
  const { rows } = await pool.query<MembershipWithUserRow>(
    `SELECT "Membership".*, "User".email, "User".name, "User"."avatarUrl"
       FROM "Membership" JOIN "User" ON "User".id = "Membership"."userId"
      WHERE "Membership".id = $1 AND "Membership"."organizationId" = $2`,
    [membershipId, organizationId]
  );
  return rows[0] ?? null;
}

export async function updateMemberRole(
  organizationId: string,
  membershipId: string,
  role: Role
): Promise<{ member: MembershipWithUserRow; previousRole: Role }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await loadMemberForUpdate(client, organizationId, membershipId);
    if (
      current.role === "ADMIN" &&
      role !== "ADMIN" &&
      (await otherActiveAdminCount(client, organizationId, membershipId)) === 0
    ) {
      throw new OrgServiceError("Cannot demote the last admin", 409);
    }
    await client.query(
      'UPDATE "Membership" SET role = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1',
      [membershipId, role]
    );
    await client.query("COMMIT");
    const member = await getMember(organizationId, membershipId);
    return { member: member!, previousRole: current.role };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function removeMember(
  organizationId: string,
  membershipId: string,
  actingUserId: string
): Promise<MembershipWithUserRow> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await loadMemberForUpdate(client, organizationId, membershipId);
    if (current.userId === actingUserId) {
      throw new OrgServiceError("You cannot remove yourself", 400);
    }
    if (
      current.role === "ADMIN" &&
      (await otherActiveAdminCount(client, organizationId, membershipId)) === 0
    ) {
      throw new OrgServiceError("Cannot remove the last admin", 409);
    }
    const member = await getMember(organizationId, membershipId);
    await client.query('DELETE FROM "Membership" WHERE id = $1', [membershipId]);
    await client.query("COMMIT");
    return member!;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

// --- Security settings --------------------------------------------------

const SECURITY_COLUMNS = ["ssoEnabled", "ssoProvider", "ssoConfig", "mfaRequired", "sessionTimeout"];

// ssoConfig (may hold IdP secrets) is deliberately not returned.
function toSecuritySettings(row: OrganizationSettingsRow | undefined) {
  return {
    ssoEnabled: row?.ssoEnabled ?? false,
    ssoProvider: row?.ssoProvider ?? null,
    mfaRequired: row?.mfaRequired ?? false,
    sessionTimeout: row?.sessionTimeout ?? 30,
    updatedAt: row?.updatedAt ?? null,
  };
}

export async function getSecuritySettings(organizationId: string) {
  const { rows } = await pool.query<OrganizationSettingsRow>(
    'SELECT * FROM "OrganizationSettings" WHERE "organizationId" = $1',
    [organizationId]
  );
  return toSecuritySettings(rows[0]);
}

export async function upsertSecuritySettings(
  organizationId: string,
  input: UpdateOrgSecuritySettingsInput
) {
  const normalized = {
    ...input,
    ssoConfig:
      input.ssoConfig === undefined || input.ssoConfig === null
        ? input.ssoConfig
        : JSON.stringify(input.ssoConfig),
  };
  await pool.query(
    'INSERT INTO "OrganizationSettings" ("organizationId") VALUES ($1) ON CONFLICT DO NOTHING',
    [organizationId]
  );
  const set = buildSet(normalized, SECURITY_COLUMNS, 2);
  if (!set) return getSecuritySettings(organizationId);
  const { rows } = await pool.query<OrganizationSettingsRow>(
    `UPDATE "OrganizationSettings" SET ${set.clause}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = $1 RETURNING *`,
    [organizationId, ...set.values]
  );
  return toSecuritySettings(rows[0]);
}

// --- IP allowlist -------------------------------------------------------

export async function listIpWhitelist(
  organizationId: string
): Promise<Omit<OrganizationIPWhitelistRow, "organizationId">[]> {
  const { rows } = await pool.query(
    `SELECT id, "cidr"::text AS cidr, label, "createdAt"
       FROM "OrganizationIPWhitelist" WHERE "organizationId" = $1 ORDER BY "createdAt" ASC`,
    [organizationId]
  );
  return rows;
}

export async function addIpWhitelist(organizationId: string, input: AddIpWhitelistInput) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO "OrganizationIPWhitelist" (id, "organizationId", "cidr", label)
       VALUES ($1, $2, $3::cidr, $4)
       RETURNING id, "cidr"::text AS cidr, label, "createdAt"`,
      [randomUUID(), organizationId, input.cidr.trim(), input.label ?? null]
    );
    return rows[0];
  } catch (err) {
    // 22P02 invalid_text_representation, 22P03/… for malformed or host-bits-set CIDRs.
    const code = (err as { code?: string }).code;
    if (code === "22P02" || code === "22P03") {
      throw new OrgServiceError("Invalid CIDR (e.g. 203.0.113.0/24 or 203.0.113.7)", 400);
    }
    throw err;
  }
}

export async function deleteIpWhitelist(organizationId: string, id: string) {
  const { rows } = await pool.query(
    `DELETE FROM "OrganizationIPWhitelist" WHERE id = $1 AND "organizationId" = $2
     RETURNING id, "cidr"::text AS cidr, label`,
    [id, organizationId]
  );
  return rows[0] ?? null;
}

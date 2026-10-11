import bcrypt from "bcrypt";
import type { Role, UpdateProfileInput, User } from "@complianceos/shared";
import { pool } from "../db/pool.js";
import type { UserRow } from "../db/types.js";
import { storage } from "../storage/index.js";

export async function getUser(id: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>('SELECT * FROM "User" WHERE id = $1', [id]);
  return rows[0] ?? null;
}

// Maps a User row to the shared User shape — never exposes passwordHash or
// googleId. Dates are left as Date (serialised to ISO strings by res.json).
export function toSharedUser(
  row: UserRow,
  ctx: { role?: Role; organizationId?: string } = {}
): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
    emailVerifiedAt: row.emailVerifiedAt as unknown as string | null,
    hasPassword: Boolean(row.passwordHash),
    isGoogleUser: Boolean(row.googleId),
    role: ctx.role,
    organizationId: ctx.organizationId,
    createdAt: row.createdAt as unknown as string,
    updatedAt: row.updatedAt as unknown as string,
  };
}

const AVATAR_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const AVATAR_MIME_TYPES = Object.keys(AVATAR_EXTENSIONS);
// Avatars are rendered in <img> tags (no Authorization header), so store a
// long-lived signed URL.
const AVATAR_URL_TTL_SECONDS = 365 * 24 * 60 * 60;

export async function saveAvatar(
  userId: string,
  file: { buffer: Buffer; mimetype: string }
): Promise<UserRow | null> {
  const ext = AVATAR_EXTENSIONS[file.mimetype];
  if (!ext) throw new Error("Unsupported image type");
  const key = `avatars/${userId}/${Date.now()}.${ext}`;
  await storage.upload({ key, body: file.buffer, contentType: file.mimetype });
  const url = await storage.getSignedUrl(key, AVATAR_URL_TTL_SECONDS);
  const { rows } = await pool.query<UserRow>(
    'UPDATE "User" SET "avatarUrl" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
    [userId, url]
  );
  return rows[0] ?? null;
}

export async function updateProfile(
  id: string,
  input: UpdateProfileInput
): Promise<UserRow | null> {
  const fields = Object.entries(input).filter(([, value]) => value !== undefined);
  if (fields.length === 0) return getUser(id);

  const setClauses = fields.map(([key], i) => `"${key}" = $${i + 2}`);
  const values = fields.map(([, value]) => value);
  const { rows } = await pool.query<UserRow>(
    `UPDATE "User" SET ${setClauses.join(", ")}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return rows[0] ?? null;
}

export async function changePassword(
  id: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  const { rows } = await pool.query<UserRow>('SELECT * FROM "User" WHERE id = $1', [id]);
  const user = rows[0];
  if (!user?.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return false;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.query(
    'UPDATE "User" SET "passwordHash" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $1',
    [id, passwordHash]
  );
  return true;
}

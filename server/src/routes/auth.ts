import bcrypt from "bcrypt";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  emailOnlySchema,
  googleAuthSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "@complianceos/shared";
import { signToken } from "../auth/jwt.js";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import type { MembershipRow, UserRow } from "../db/types.js";
import { issueOtp, OTP_ERROR_MESSAGES, verifyOtp } from "../services/otpService.js";

export const authRouter = Router();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Creates Organization + ADMIN/ACTIVE Membership + default OrganizationSettings
// for a new user, inside the caller's transaction.
async function createOrganizationFor(
  client: PoolClient,
  userId: string,
  orgName: string
): Promise<string> {
  const orgId = randomUUID();
  // Slug always gets a uniqueness suffix from the org id — two users with the
  // same derived name would otherwise collide on Organization.slug (UNIQUE).
  const base = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "org";
  const slug = `${base}-${orgId.slice(0, 8)}`;
  await client.query('INSERT INTO "Organization" (id, name, slug) VALUES ($1, $2, $3)', [
    orgId,
    orgName,
    slug,
  ]);
  await client.query(
    'INSERT INTO "Membership" (id, "userId", "organizationId", role, status) VALUES ($1, $2, $3, $4, $5)',
    [randomUUID(), userId, orgId, "ADMIN", "ACTIVE"]
  );
  await client.query('INSERT INTO "OrganizationSettings" ("organizationId") VALUES ($1)', [orgId]);
  return orgId;
}

// Shared by /login, /verify-otp and /google: picks the user's membership,
// stamps lastLogin, and builds { token, user }.
async function buildLoginPayload(user: UserRow) {
  const { rows } = await pool.query<MembershipRow>(
    `SELECT * FROM "Membership"
      WHERE "userId" = $1 AND status <> 'SUSPENDED'
      ORDER BY (status = 'ACTIVE') DESC, "createdAt" ASC LIMIT 1`,
    [user.id]
  );
  const membership = rows[0];
  if (!membership) return null;

  await pool.query(
    'UPDATE "Membership" SET "lastLogin" = CURRENT_TIMESTAMP WHERE id = $1',
    [membership.id]
  );
  const token = signToken({
    userId: user.id,
    organizationId: membership.organizationId,
    role: membership.role,
  });
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerifiedAt: user.emailVerifiedAt,
      hasPassword: Boolean(user.passwordHash),
      isGoogleUser: Boolean(user.googleId),
      role: membership.role,
      organizationId: membership.organizationId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
}

async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const { rows } = await pool.query<UserRow>('SELECT * FROM "User" WHERE email = $1', [email]);
  return rows[0];
}

authRouter.post("/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const email = normalizeEmail(input.email);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existing = await client.query('SELECT id FROM "User" WHERE email = $1', [email]);
      if (existing.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Email already registered" });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      const userId = randomUUID();
      await client.query(
        'INSERT INTO "User" (id, email, "passwordHash", name) VALUES ($1, $2, $3, $4)',
        [userId, email, passwordHash, input.name]
      );
      await createOrganizationFor(
        client,
        userId,
        input.organizationName ?? `${input.name}'s Organization`
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }

    await issueOtp(email, "SIGNUP");
    res.status(201).json({ requiresOtp: true, email });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/verify-otp", async (req, res, next) => {
  try {
    const input = verifyOtpSchema.parse(req.body);
    const email = normalizeEmail(input.email);

    const result = await verifyOtp(email, "SIGNUP", input.otp);
    if (!result.ok) return res.status(400).json({ error: OTP_ERROR_MESSAGES[result.reason] });

    const { rows } = await pool.query<UserRow>(
      `UPDATE "User"
          SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", CURRENT_TIMESTAMP),
              "updatedAt" = CURRENT_TIMESTAMP
        WHERE email = $1 RETURNING *`,
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(400).json({ error: OTP_ERROR_MESSAGES.invalid });

    const payload = await buildLoginPayload(user);
    if (!payload) return res.status(403).json({ error: "No active organization membership" });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

// Always 200 so the endpoint can't be used to probe which emails exist.
authRouter.post("/resend-otp", async (req, res, next) => {
  try {
    const email = normalizeEmail(emailOnlySchema.parse(req.body).email);
    const user = await findUserByEmail(email);
    if (user && !user.emailVerifiedAt) await issueOtp(email, "SIGNUP");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await findUserByEmail(normalizeEmail(input.email));
    if (!user?.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.emailVerifiedAt && !user.googleId) {
      await issueOtp(user.email, "SIGNUP");
      return res.status(403).json({
        error: "Email not verified. We sent a new verification code to your email.",
        requiresOtp: true,
        email: user.email,
      });
    }

    const payload = await buildLoginPayload(user);
    if (!payload) return res.status(403).json({ error: "No organization membership" });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    const email = normalizeEmail(emailOnlySchema.parse(req.body).email);
    const user = await findUserByEmail(email);
    if (user) await issueOtp(email, "PASSWORD_RESET");
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/reset-password", async (req, res, next) => {
  try {
    const input = resetPasswordSchema.parse(req.body);
    const email = normalizeEmail(input.email);

    const result = await verifyOtp(email, "PASSWORD_RESET", input.otp);
    if (!result.ok) return res.status(400).json({ error: OTP_ERROR_MESSAGES[result.reason] });

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    // Proving control of the mailbox also verifies the email.
    const { rowCount } = await pool.query(
      `UPDATE "User"
          SET "passwordHash" = $2,
              "emailVerifiedAt" = COALESCE("emailVerifiedAt", CURRENT_TIMESTAMP),
              "updatedAt" = CURRENT_TIMESTAMP
        WHERE email = $1`,
      [email, passwordHash]
    );
    if (!rowCount) return res.status(400).json({ error: OTP_ERROR_MESSAGES.invalid });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

interface GoogleProfile {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

async function fetchGoogleProfile(code: string): Promise<GoogleProfile> {
  const { clientId, clientSecret, redirectUri } = config.google;
  if (!clientId || !clientSecret) throw new GoogleAuthError("Google sign-in is not configured", 503);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      // "postmessage" is what Google's popup code flow uses.
      redirect_uri: redirectUri || "postmessage",
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) throw new GoogleAuthError("Google authorization failed", 401);
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) throw new GoogleAuthError("Google authorization failed", 401);

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) throw new GoogleAuthError("Could not read Google profile", 401);
  return (await infoRes.json()) as GoogleProfile;
}

class GoogleAuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

authRouter.post("/google", async (req, res, next) => {
  try {
    const { code } = googleAuthSchema.parse(req.body);
    let profile: GoogleProfile;
    try {
      profile = await fetchGoogleProfile(code);
    } catch (err) {
      if (err instanceof GoogleAuthError) return res.status(err.status).json({ error: err.message });
      throw err;
    }
    if (!profile.email || profile.email_verified === false) {
      return res.status(401).json({ error: "Google account email is not verified" });
    }
    const email = normalizeEmail(profile.email);

    let user: UserRow | undefined;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query<UserRow>(
        'SELECT * FROM "User" WHERE "googleId" = $1 OR email = $2 ORDER BY ("googleId" = $1) DESC NULLS LAST LIMIT 1 FOR UPDATE',
        [profile.sub, email]
      );
      user = found.rows[0];
      if (user) {
        if (user.googleId && user.googleId !== profile.sub) {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: "Email is linked to a different Google account" });
        }
        // Link Google to an existing (email-matched) account; Google has
        // verified the mailbox so mark the email verified too.
        const updated = await client.query<UserRow>(
          `UPDATE "User"
              SET "googleId" = $2,
                  "emailVerifiedAt" = COALESCE("emailVerifiedAt", CURRENT_TIMESTAMP),
                  "avatarUrl" = COALESCE("avatarUrl", $3),
                  "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $1 RETURNING *`,
          [user.id, profile.sub, profile.picture ?? null]
        );
        user = updated.rows[0];
      } else {
        const name = profile.name?.trim() || email.split("@")[0];
        const inserted = await client.query<UserRow>(
          `INSERT INTO "User" (id, email, "googleId", name, "avatarUrl", "emailVerifiedAt")
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING *`,
          [randomUUID(), email, profile.sub, name, profile.picture ?? null]
        );
        user = inserted.rows[0];
        await createOrganizationFor(client, user.id, `${name}'s Organization`);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }

    const payload = await buildLoginPayload(user);
    if (!payload) return res.status(403).json({ error: "No organization membership" });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

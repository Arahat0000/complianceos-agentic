import bcrypt from "bcrypt";
import { randomInt, randomUUID } from "node:crypto";
import type { OtpPurpose } from "@complianceos/shared";
import { pool } from "../db/pool.js";
import type { EmailOtpRow } from "../db/types.js";
import { sendMail } from "./mailer.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export type OtpFailure = "invalid" | "expired" | "too_many_attempts";

const SUBJECTS: Record<OtpPurpose, string> = {
  SIGNUP: "Verify your ComplianceOS email",
  PASSWORD_RESET: "Reset your ComplianceOS password",
};

// Creates a fresh OTP, invalidating any earlier unconsumed ones for the same
// email+purpose, and emails it.
export async function issueOtp(email: string, purpose: OtpPurpose): Promise<void> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await pool.query(
    'UPDATE "EmailOtp" SET "consumedAt" = CURRENT_TIMESTAMP WHERE email = $1 AND purpose = $2 AND "consumedAt" IS NULL',
    [email, purpose]
  );
  await pool.query(
    'INSERT INTO "EmailOtp" (id, email, purpose, "codeHash", "expiresAt") VALUES ($1, $2, $3, $4, $5)',
    [randomUUID(), email, purpose, codeHash, expiresAt]
  );
  await sendMail({
    to: email,
    subject: SUBJECTS[purpose],
    text: `Your ComplianceOS verification code is ${code}. It expires in 10 minutes.`,
  });
}

// Checks the latest unconsumed OTP for email+purpose. On success it is marked
// consumed (single use). Wrong guesses increment attempts; after
// MAX_OTP_ATTEMPTS the code is dead.
export async function verifyOtp(
  email: string,
  purpose: OtpPurpose,
  code: string
): Promise<{ ok: true } | { ok: false; reason: OtpFailure }> {
  const { rows } = await pool.query<EmailOtpRow>(
    `SELECT * FROM "EmailOtp"
      WHERE email = $1 AND purpose = $2 AND "consumedAt" IS NULL
      ORDER BY "createdAt" DESC LIMIT 1`,
    [email, purpose]
  );
  const otp = rows[0];
  if (!otp) return { ok: false, reason: "invalid" };
  if (otp.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (otp.attempts >= MAX_OTP_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  // Count the attempt atomically before comparing, so parallel guesses can't
  // exceed the limit.
  const { rows: bumped } = await pool.query(
    'UPDATE "EmailOtp" SET attempts = attempts + 1 WHERE id = $1 AND attempts < $2 RETURNING id',
    [otp.id, MAX_OTP_ATTEMPTS]
  );
  if (bumped.length === 0) return { ok: false, reason: "too_many_attempts" };

  if (!(await bcrypt.compare(code, otp.codeHash))) return { ok: false, reason: "invalid" };

  const { rowCount } = await pool.query(
    'UPDATE "EmailOtp" SET "consumedAt" = CURRENT_TIMESTAMP WHERE id = $1 AND "consumedAt" IS NULL',
    [otp.id]
  );
  return rowCount ? { ok: true } : { ok: false, reason: "invalid" };
}

export const OTP_ERROR_MESSAGES: Record<OtpFailure, string> = {
  invalid: "Invalid verification code",
  expired: "Verification code has expired; request a new one",
  too_many_attempts: "Too many attempts; request a new code",
};

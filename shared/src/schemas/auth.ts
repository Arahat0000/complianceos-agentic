import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  // Optional — the signup form only collects name/email/password; when
  // omitted the server defaults it from the user's name (see routes/auth.ts).
  organizationName: z.string().min(1).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

const otpField = z.string().regex(/^\d{6}$/, "OTP must be 6 digits");

// POST /auth/verify-otp — confirms the signup OTP emailed by /auth/register.
export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: otpField,
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

// POST /auth/resend-otp and POST /auth/forgot-password
export const emailOnlySchema = z.object({
  email: z.string().email(),
});
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;

// POST /auth/reset-password
export const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: otpField,
  newPassword: z.string().min(8),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// POST /auth/google — the frontend posts an OAuth authorization code.
export const googleAuthSchema = z.object({
  code: z.string().min(1),
});
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;

import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

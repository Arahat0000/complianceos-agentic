import { z } from "zod";
import { AIProvider, EmbeddingProvider, Role, SSOProvider } from "../types/enums.js";

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(Role).default("VIEWER"),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberSchema = z.object({
  role: z.enum(Role).optional(),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const updateOrgAIConfigSchema = z.object({
  useCustomAi: z.boolean(),
  aiProvider: z.enum(AIProvider).optional(),
  aiModel: z.string().optional(),
  // Plaintext in the request, encrypted server-side before storage — never
  // returned back to any client afterward.
  aiApiKey: z.string().min(1).optional(),
  useCustomEmbedding: z.boolean().optional(),
  embeddingProvider: z.enum(EmbeddingProvider).optional(),
  embeddingModel: z.string().optional(),
  embeddingApiKey: z.string().min(1).optional(),
  embeddingNamespace: z.string().optional(),
});
export type UpdateOrgAIConfigInput = z.infer<typeof updateOrgAIConfigSchema>;

// Settings > Security tab (OrganizationSettings).
export const updateOrgSecuritySettingsSchema = z.object({
  ssoEnabled: z.boolean().optional(),
  ssoProvider: z.enum(SSOProvider).nullable().optional(),
  ssoConfig: z.record(z.string(), z.unknown()).nullable().optional(),
  mfaRequired: z.boolean().optional(),
  sessionTimeout: z.number().int().min(5).max(1440).optional(),
});
export type UpdateOrgSecuritySettingsInput = z.infer<typeof updateOrgSecuritySettingsSchema>;

// Settings > Security tab (OrganizationIPWhitelist).
export const addIpWhitelistSchema = z.object({
  cidr: z.string().min(1),
  label: z.string().optional(),
});
export type AddIpWhitelistInput = z.infer<typeof addIpWhitelistSchema>;

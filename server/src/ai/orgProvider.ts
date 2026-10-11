import { decrypt } from "../lib/encryption.js";
import { getOrgAIConfig } from "../services/organizationAIConfig.js";
import type { AIProvider } from "./AIProvider.js";
import { resolveProvider, resolveVerifierProvider, type OrgAIConfig } from "./resolveProvider.js";

async function loadConfig(organizationId: string): Promise<OrgAIConfig | null> {
  const c = await getOrgAIConfig(organizationId);
  if (!c) return null;
  return {
    useCustomAi: c.useCustomAi,
    aiProvider: c.aiProvider,
    aiModel: c.aiModel,
    aiApiKey: c.aiApiKeyEncrypted ? decrypt(c.aiApiKeyEncrypted) : null,
  };
}

// The org's configured chat/vision model (or the platform default).
export async function getProviderForOrg(organizationId: string): Promise<AIProvider> {
  return resolveProvider(await loadConfig(organizationId));
}

// A second, independent reader for cross-checking.
export async function getVerifierForOrg(organizationId: string): Promise<AIProvider> {
  return resolveVerifierProvider(await loadConfig(organizationId));
}

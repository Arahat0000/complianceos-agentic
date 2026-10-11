import {
  AIProvider,
  EmbeddingProvider,
  type UpdateOrgAIConfigInput,
} from "@complianceos/shared";
import { pool } from "../db/pool.js";
import type { OrganizationAIConfigRow } from "../db/types.js";
import { encrypt } from "../lib/encryption.js";

export async function getOrgAIConfig(organizationId: string): Promise<OrganizationAIConfigRow | null> {
  const { rows } = await pool.query<OrganizationAIConfigRow>(
    'SELECT * FROM "OrganizationAIConfig" WHERE "organizationId" = $1',
    [organizationId]
  );
  return rows[0] ?? null;
}

// Returns the config with key presence flagged, never a key itself
// (encrypted or otherwise) — this is what the settings UI reads back.
export async function getOrgAIConfigSummary(organizationId: string) {
  const row = await getOrgAIConfig(organizationId);
  return {
    useCustomAi: row?.useCustomAi ?? false,
    aiProvider: row?.aiProvider ?? null,
    aiModel: row?.aiModel ?? null,
    hasAiKey: Boolean(row?.aiApiKeyEncrypted),
    useCustomEmbedding: row?.useCustomEmbedding ?? false,
    embeddingProvider: row?.embeddingProvider ?? null,
    embeddingModel: row?.embeddingModel ?? null,
    embeddingNamespace: row?.embeddingNamespace ?? null,
    hasEmbeddingKey: Boolean(row?.embeddingApiKeyEncrypted),
  };
}

// AI settings are overwritten as a whole (omitted provider/model clear them);
// embedding settings are only changed when the request mentions them, and an
// omitted key keeps the stored one.
export async function upsertOrgAIConfig(
  organizationId: string,
  input: UpdateOrgAIConfigInput
): Promise<void> {
  const aiApiKeyEncrypted = input.aiApiKey ? encrypt(input.aiApiKey) : null;
  const embeddingApiKeyEncrypted = input.embeddingApiKey ? encrypt(input.embeddingApiKey) : null;

  await pool.query(
    `INSERT INTO "OrganizationAIConfig"
       ("organizationId", "useCustomAi", "aiProvider", "aiModel", "aiApiKeyEncrypted",
        "useCustomEmbedding", "embeddingProvider", "embeddingModel", "embeddingApiKeyEncrypted",
        "embeddingNamespace")
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, FALSE), $7, $8, $9, $10)
     ON CONFLICT ("organizationId") DO UPDATE SET
       "useCustomAi" = $2,
       "aiProvider" = $3,
       "aiModel" = $4,
       "aiApiKeyEncrypted" = COALESCE($5, "OrganizationAIConfig"."aiApiKeyEncrypted"),
       "useCustomEmbedding" = COALESCE($6, "OrganizationAIConfig"."useCustomEmbedding"),
       "embeddingProvider" = COALESCE($7, "OrganizationAIConfig"."embeddingProvider"),
       "embeddingModel" = COALESCE($8, "OrganizationAIConfig"."embeddingModel"),
       "embeddingApiKeyEncrypted" = COALESCE($9, "OrganizationAIConfig"."embeddingApiKeyEncrypted"),
       "embeddingNamespace" = COALESCE($10, "OrganizationAIConfig"."embeddingNamespace"),
       "updatedAt" = CURRENT_TIMESTAMP`,
    [
      organizationId,
      input.useCustomAi,
      input.aiProvider ?? null,
      input.aiModel ?? null,
      aiApiKeyEncrypted,
      input.useCustomEmbedding ?? null,
      input.embeddingProvider ?? null,
      input.embeddingModel ?? null,
      embeddingApiKeyEncrypted,
      input.embeddingNamespace ?? null,
    ]
  );
}

// --- Static provider catalogues (Settings > AI) ---------------------------

interface ProviderInfo {
  id: string; // enum value sent back in PUT /ai-config
  name: string; // lower-case key the UI uses for icons/model maps
  label: string;
  defaultModel: string;
  requiresApiKey: boolean;
}

const AI_PROVIDER_INFO: Record<AIProvider, Omit<ProviderInfo, "id" | "name">> = {
  OPENAI: { label: "OpenAI", defaultModel: "gpt-4o-mini", requiresApiKey: true },
  ANTHROPIC: { label: "Anthropic", defaultModel: "claude-sonnet-5", requiresApiKey: true },
  VERTEXAI: { label: "Google Vertex AI", defaultModel: "gemini-1.5-pro", requiresApiKey: true },
  OLLAMA: { label: "Ollama", defaultModel: "llama3.1", requiresApiKey: false },
  BEDROCK: {
    label: "AWS Bedrock",
    // Getter: read env when used (after dotenv has loaded), not at module load.
    get defaultModel() {
      return process.env.AWS_BEDROCK_MODEL_ID || "apac.amazon.nova-pro-v1:0";
    },
    requiresApiKey: false,
  },
  SARVAMAI: { label: "Sarvam AI", defaultModel: "sarvam-m", requiresApiKey: true },
};

const EMBEDDING_PROVIDER_INFO: Record<EmbeddingProvider, Omit<ProviderInfo, "id" | "name">> = {
  OPENAI: { label: "OpenAI", defaultModel: "text-embedding-3-small", requiresApiKey: true },
  VERTEXAI: { label: "Google Vertex AI", defaultModel: "text-embedding-004", requiresApiKey: true },
  OLLAMA: { label: "Ollama", defaultModel: "nomic-embed-text", requiresApiKey: false },
  BEDROCK: {
    label: "AWS Bedrock",
    get defaultModel() {
      return process.env.AWS_BEDROCK_EMBEDDING_MODEL_ID || "amazon.titan-embed-text-v2:0";
    },
    requiresApiKey: false,
  },
};

export function listAIProviders(): ProviderInfo[] {
  return AIProvider.map((id) => ({ id, name: id.toLowerCase(), ...AI_PROVIDER_INFO[id] }));
}

export function listEmbeddingProviders(): ProviderInfo[] {
  return EmbeddingProvider.map((id) => ({
    id,
    name: id.toLowerCase(),
    ...EMBEDDING_PROVIDER_INFO[id],
  }));
}

// What the platform uses when an org has not brought its own provider — mirrors
// platformDefaultProvider() in ai/resolveProvider.ts (Bedrock when AWS credentials
// are configured on the server, otherwise the platform Anthropic key).
export function getPlatformDefault() {
  const bedrock = Boolean(process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.AWS_ACCESS_KEY_ID);
  if (bedrock) {
    return {
      provider: "bedrock",
      model: AI_PROVIDER_INFO.BEDROCK.defaultModel,
      embeddingProvider: "bedrock",
      embeddingModel: EMBEDDING_PROVIDER_INFO.BEDROCK.defaultModel,
      region: process.env.AWS_REGION || "ap-south-1",
    };
  }
  return {
    provider: "anthropic",
    model: AI_PROVIDER_INFO.ANTHROPIC.defaultModel,
    embeddingProvider: "",
    embeddingModel: "",
    region: null,
  };
}

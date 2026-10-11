import type {
  AIProvider as AIProviderName,
  EmbeddingProvider as EmbeddingProviderName,
} from "@complianceos/shared";
import type { AIProvider } from "./AIProvider.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { BedrockProvider } from "./providers/bedrock.js";
import { OllamaProvider } from "./providers/ollama.js";
import { MockProvider } from "./providers/mock.js";
import { OpenAIProvider } from "./providers/openai.js";

export interface OrgAIConfig {
  useCustomAi: boolean;
  aiProvider: AIProviderName | null;
  aiModel: string | null;
  aiApiKey: string | null; // decrypted before reaching this function
  // Optional embedding settings (OrganizationAIConfig embedding columns).
  // Callers that only need completions may omit them.
  useCustomEmbedding?: boolean;
  embeddingProvider?: EmbeddingProviderName | null;
  embeddingModel?: string | null;
  embeddingApiKey?: string | null; // decrypted
}

const platformDefaultKey = process.env.ANTHROPIC_API_KEY ?? "";

// Platform default provider: AWS Bedrock when Bedrock credentials are configured
// on the server (AWS_BEARER_TOKEN_BEDROCK or AWS_ACCESS_KEY_ID), otherwise the
// platform Anthropic key. Orgs can still override via OrganizationAIConfig.
function platformDefaultProvider(): AIProvider {
  if (process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.AWS_ACCESS_KEY_ID) {
    return new BedrockProvider();
  }
  return new AnthropicProvider(platformDefaultKey);
}

function unsupported(name: string): never {
  throw new Error(
    `AI provider ${name} is not configured on this server; choose OpenAI, Anthropic, AWS Bedrock or Ollama`
  );
}

function chatProvider(cfg: OrgAIConfig): AIProvider {
  const model = cfg.aiModel ?? undefined;
  switch (cfg.aiProvider) {
    case "OPENAI":
      if (!cfg.aiApiKey) throw new Error("OpenAI API key is missing");
      return new OpenAIProvider(cfg.aiApiKey, model);
    case "ANTHROPIC":
      if (!cfg.aiApiKey) throw new Error("Anthropic API key is missing");
      return new AnthropicProvider(cfg.aiApiKey, model);
    case "OLLAMA":
      return new OllamaProvider(model);
    case "BEDROCK":
      return new BedrockProvider(model, cfg.aiApiKey ?? undefined);
    case "VERTEXAI":
    case "SARVAMAI":
      return unsupported(cfg.aiProvider);
    default:
      throw new Error("No AI provider selected");
  }
}

function embeddingProvider(cfg: OrgAIConfig): AIProvider {
  const model = cfg.embeddingModel ?? undefined;
  switch (cfg.embeddingProvider) {
    case "OPENAI":
      if (!cfg.embeddingApiKey) throw new Error("OpenAI embedding API key is missing");
      return new OpenAIProvider(cfg.embeddingApiKey, undefined, model);
    case "OLLAMA":
      return new OllamaProvider(undefined, model);
    case "BEDROCK":
      return new BedrockProvider(undefined, cfg.embeddingApiKey ?? undefined, model);
    case "VERTEXAI":
      return unsupported("VERTEXAI");
    default:
      throw new Error("No embedding provider selected");
  }
}

// Resolves which AIProvider implementation to use for a given org, honoring
// OrganizationAIConfig.useCustomAi (bring-your-own-key) with a platform
// default fallback. When useCustomEmbedding is set, embed() is served by the
// configured embedding provider while complete() stays with the chat provider.
export function resolveProvider(orgConfig: OrgAIConfig | null): AIProvider {
  if (process.env.AI_MOCK === "1") return new MockProvider();
  const customChat =
    orgConfig?.useCustomAi &&
    orgConfig.aiProvider &&
    (orgConfig.aiApiKey ||
      orgConfig.aiProvider === "OLLAMA" ||
      orgConfig.aiProvider === "BEDROCK");

  const chat: AIProvider =
    customChat && orgConfig ? chatProvider(orgConfig) : platformDefaultProvider();

  if (orgConfig?.useCustomEmbedding && orgConfig.embeddingProvider) {
    const embedder = embeddingProvider(orgConfig);
    return {
      complete: (req) => chat.complete(req),
      embed: (text) => embedder.embed(text),
      modelId: chat.modelId,
    };
  }
  return chat;
}

// A second, independent reader for cross-checking (multimodal extraction pass B).
// Independence comes from a different model where one is configured
// (AWS_BEDROCK_VERIFIER_MODEL_ID for Bedrock); otherwise the same model is used and
// the caller relies on a differently-worded, blind prompt.
export function resolveVerifierProvider(orgConfig: OrgAIConfig | null): AIProvider {
  if (process.env.AI_MOCK === "1") return new MockProvider("mock-verifier");
  const verifierModel = process.env.AWS_BEDROCK_VERIFIER_MODEL_ID || undefined;
  const customChat =
    orgConfig?.useCustomAi &&
    orgConfig.aiProvider &&
    (orgConfig.aiApiKey || orgConfig.aiProvider === "OLLAMA" || orgConfig.aiProvider === "BEDROCK");
  if (customChat && orgConfig) {
    if (orgConfig.aiProvider === "BEDROCK" && verifierModel) {
      return new BedrockProvider(verifierModel, orgConfig.aiApiKey ?? undefined);
    }
    return chatProvider(orgConfig);
  }
  if (process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.AWS_ACCESS_KEY_ID) {
    return new BedrockProvider(verifierModel);
  }
  return platformDefaultProvider();
}

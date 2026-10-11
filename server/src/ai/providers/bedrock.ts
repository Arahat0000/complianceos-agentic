import {
  BedrockRuntimeClient,
  ConverseCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { AIProvider, Attachment, CompletionRequest } from "../AIProvider.js";

// Platform defaults come from env (AWS_BEDROCK_MODEL_ID, AWS_REGION, AWS_BEARER_TOKEN_BEDROCK).
const defaultModel = () => process.env.AWS_BEDROCK_MODEL_ID || "apac.amazon.nova-pro-v1:0";
const defaultEmbeddingModel = () => process.env.AWS_BEDROCK_EMBEDDING_MODEL_ID || "amazon.titan-embed-text-v2:0";

const region = () => process.env.AWS_REGION || "ap-south-1";

const IMAGE_FORMATS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/gif": "gif",
  "image/webp": "webp",
};
const DOCUMENT_FORMATS: Record<string, string> = {
  "application/pdf": "pdf",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/html": "html",
  "text/plain": "txt",
  "text/markdown": "md",
};

// Bedrock document names allow only alphanumerics, spaces, hyphens, parentheses, brackets.
const safeDocName = (name: string | undefined, i: number) =>
  (name ?? `document ${i + 1}`).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9 \-()[\]]/g, " ").replace(/\s+/g, " ").trim() ||
  `document ${i + 1}`;

// Converse content blocks. The REST (bearer token) path needs base64 strings, the SDK path bytes.
function attachmentBlocks(attachments: Attachment[], asBase64: boolean): unknown[] {
  return attachments.map((a, i) => {
    const bytes = asBase64 ? a.data.toString("base64") : new Uint8Array(a.data);
    if (a.kind === "image") {
      const format = IMAGE_FORMATS[a.mediaType.toLowerCase()];
      if (!format) throw new Error(`Bedrock does not accept images of type ${a.mediaType}`);
      return { image: { format, source: { bytes } } };
    }
    const format = DOCUMENT_FORMATS[a.mediaType.toLowerCase()];
    if (!format) throw new Error(`Bedrock does not accept documents of type ${a.mediaType}`);
    return { document: { format, name: safeDocName(a.name, i), source: { bytes } } };
  });
}

interface ConverseResponse {
  output?: { message?: { content?: Array<{ text?: string }> } };
}

function extractText(data: ConverseResponse): string {
  return (data.output?.message?.content ?? [])
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

function explain(err: unknown, model: string, rgn: string): Error {
  const e = err as { name?: string; message?: string };
  const msg = e?.message ?? String(err);
  switch (e?.name) {
    case "AccessDeniedException":
      return new Error(
        `Bedrock access denied for model ${model} in ${rgn}: check IAM permissions (bedrock:InvokeModel) and model access. ${msg}`
      );
    case "ResourceNotFoundException":
    case "ValidationException":
      return new Error(`Bedrock rejected model ${model} in ${rgn} (model id/region invalid?): ${msg}`);
    case "CredentialsProviderError":
      return new Error(`No AWS credentials found for Bedrock: ${msg}`);
    default:
      return new Error(`Bedrock request failed: ${msg}`);
  }
}

// AWS Bedrock via the Converse API. Without an API key, the default AWS
// credential chain is used; with one, it is sent as a Bedrock bearer token.
export class BedrockProvider implements AIProvider {
  private client?: BedrockRuntimeClient;

  constructor(
    private readonly model = defaultModel(),
    // An org-supplied key wins; otherwise the platform bearer token; otherwise the
    // SDK default credential chain (AWS_ACCESS_KEY_ID/role/profile).
    private readonly apiKey: string | undefined = process.env.AWS_BEARER_TOKEN_BEDROCK || undefined,
    private readonly embeddingModel = defaultEmbeddingModel()
  ) {}

  private sdk(): BedrockRuntimeClient {
    this.client ??= new BedrockRuntimeClient({ region: region() });
    return this.client;
  }

  get modelId() {
    return this.model;
  }

  async complete({ system, prompt, maxTokens = 1024, temperature, attachments }: CompletionRequest): Promise<string> {
    const rgn = region();
    const build = (asBase64: boolean) => ({
      messages: [
        {
          role: "user",
          content: [...attachmentBlocks(attachments ?? [], asBase64), { text: prompt }],
        },
      ],
      ...(system ? { system: [{ text: system }] } : {}),
      inferenceConfig: { maxTokens, ...(temperature !== undefined ? { temperature } : {}) },
    });
    if (this.apiKey) {
      const url = `https://bedrock-runtime.${rgn}.amazonaws.com/model/${encodeURIComponent(this.model)}/converse`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(build(true)),
      });
      if (!res.ok) {
        throw new Error(
          `Bedrock request failed (${res.status}) for model ${this.model} in ${rgn}: ${await res.text()}`
        );
      }
      return extractText((await res.json()) as ConverseResponse);
    }
    try {
      const out = await this.sdk().send(
        new ConverseCommand({ modelId: this.model, ...build(false) } as ConstructorParameters<typeof ConverseCommand>[0])
      );
      return extractText(out as ConverseResponse);
    } catch (err) {
      throw explain(err, this.model, rgn);
    }
  }

  async embed(text: string): Promise<number[]> {
    const rgn = region();
    const isCohere = this.embeddingModel.startsWith("cohere.");
    const payload = isCohere
      ? { texts: [text], input_type: "search_document" }
      : { inputText: text };
    try {
      let raw: string;
      if (this.apiKey) {
        const url = `https://bedrock-runtime.${rgn}.amazonaws.com/model/${encodeURIComponent(this.embeddingModel)}/invoke`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Bedrock embed failed (${res.status}): ${await res.text()}`);
        raw = await res.text();
      } else {
        const out = await this.sdk().send(
          new InvokeModelCommand({
            modelId: this.embeddingModel,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(payload),
          })
        );
        raw = new TextDecoder().decode(out.body);
      }
      const data = JSON.parse(raw) as { embedding?: number[]; embeddings?: number[][] };
      const vec = data.embedding ?? data.embeddings?.[0];
      if (!vec) throw new Error("Bedrock embed response contained no embedding");
      return vec;
    } catch (err) {
      throw explain(err, this.embeddingModel, rgn);
    }
  }
}

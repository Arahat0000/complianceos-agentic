import type { AIProvider, CompletionRequest } from "../AIProvider.js";

// Ollama's local HTTP API. Base URL from OLLAMA_BASE_URL (default localhost).
const baseUrl = () => (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/+$/, "");

export class OllamaProvider implements AIProvider {
  constructor(
    private readonly model = "llama3.1",
    private readonly embeddingModel = "nomic-embed-text"
  ) {}

  get modelId() {
    return this.model;
  }

  async complete({ system, prompt, maxTokens = 1024, temperature, attachments }: CompletionRequest): Promise<string> {
    if (attachments?.some((a) => a.kind === "document")) {
      throw new Error("Ollama vision models read images only; send page images instead of documents");
    }
    const res = await fetch(`${baseUrl()}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        options: { num_predict: maxTokens, ...(temperature !== undefined ? { temperature } : {}) },
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          {
            role: "user",
            content: prompt,
            ...(attachments?.length ? { images: attachments.map((a) => a.data.toString("base64")) } : {}),
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama request failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { message: { content: string } };
    return data.message.content;
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${baseUrl()}/api/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.embeddingModel, input: text }),
    });
    if (!res.ok) throw new Error(`Ollama embed failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { embeddings: number[][] };
    return data.embeddings[0];
  }
}

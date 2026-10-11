import type { AIProvider, CompletionRequest } from "../AIProvider.js";

export class AnthropicProvider implements AIProvider {
  constructor(private readonly apiKey: string, private readonly model = "claude-sonnet-5") {}

  get modelId() {
    return this.model;
  }

  async complete({ system, prompt, maxTokens = 1024, temperature, attachments }: CompletionRequest): Promise<string> {
    const content: unknown[] = (attachments ?? []).map((a) => ({
      type: a.kind === "image" ? "image" : "document",
      source: { type: "base64", media_type: a.mediaType, data: a.data.toString("base64") },
    }));
    content.push({ type: "text", text: prompt });
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        system,
        ...(temperature !== undefined ? { temperature } : {}),
        messages: [{ role: "user", content }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic request failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { content: { text: string }[] };
    return data.content.map((block) => block.text).join("");
  }

  async embed(): Promise<number[]> {
    throw new Error("Anthropic does not provide an embeddings endpoint; use an EmbeddingProvider");
  }
}

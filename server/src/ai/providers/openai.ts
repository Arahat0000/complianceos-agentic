import type { AIProvider, CompletionRequest } from "../AIProvider.js";

export class OpenAIProvider implements AIProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = "gpt-4o-mini",
    private readonly embeddingModel = "text-embedding-3-small"
  ) {}

  get modelId() {
    return this.model;
  }

  async complete({ system, prompt, maxTokens = 1024, temperature, attachments }: CompletionRequest): Promise<string> {
    if (attachments?.some((a) => a.kind === "document")) {
      throw new Error("OpenAI chat completions cannot read PDF/office documents directly; send page images instead");
    }
    const userContent = attachments?.length
      ? [
          ...attachments.map((a) => ({
            type: "image_url",
            image_url: { url: `data:${a.mediaType};base64,${a.data.toString("base64")}` },
          })),
          { type: "text", text: prompt },
        ]
      : prompt;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        ...(temperature !== undefined ? { temperature } : {}),
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI request failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0].message.content;
  }

  async embed(text: string): Promise<number[]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: this.embeddingModel, input: text }),
    });
    if (!res.ok) throw new Error(`OpenAI embed failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data[0].embedding;
  }
}

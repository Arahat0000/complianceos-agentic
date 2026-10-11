import type { z } from "zod";
import type { AIProvider, CompletionRequest } from "./AIProvider.js";

// Pulls the first JSON object/array out of a model reply (handles ```json fences
// and stray prose around it).
function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/[[{]/);
  if (start === -1) throw new Error("no JSON found in model output");
  const open = body[start];
  const close = open === "{" ? "}" : "]";
  const end = body.lastIndexOf(close);
  if (end <= start) throw new Error("unterminated JSON in model output");
  return JSON.parse(body.slice(start, end + 1));
}

// Calls the model and validates the reply against a zod schema. On invalid output
// it re-asks once, quoting the validation error, before giving up — structured
// output is a reliability boundary, malformed replies are never trusted.
export async function completeJson<S extends z.ZodTypeAny>(
  provider: AIProvider,
  req: CompletionRequest,
  schema: S,
  retries = 1
): Promise<z.infer<S>> {
  let lastError = "";
  let prompt = req.prompt;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const raw = await provider.complete({ ...req, prompt });
    try {
      const parsed = schema.safeParse(extractJson(raw));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    prompt = `${req.prompt}\n\nYour previous reply was rejected: ${lastError}\nReturn ONLY valid JSON that matches the requested schema.`;
  }
  throw new Error(`Model returned invalid JSON after ${retries + 1} attempts: ${lastError}`);
}

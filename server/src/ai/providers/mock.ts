import { readFileSync } from "node:fs";
import type { AIProvider, CompletionRequest } from "../AIProvider.js";

// Deterministic stand-in for a real model — DEVELOPMENT / TEST ONLY.
// Enabled with AI_MOCK=1 and AI_MOCK_FIXTURES=/path/to/fixtures.json:
//   [{ "match": "substring or /regex/i tested against system+prompt", "response": "text" | {…json…} }]
// The first matching fixture wins; a missing match throws so tests fail loudly.
interface Fixture {
  match: string;
  response: unknown;
}

function load(): Fixture[] {
  const path = process.env.AI_MOCK_FIXTURES;
  if (!path) throw new Error("AI_MOCK=1 requires AI_MOCK_FIXTURES to point at a JSON fixtures file");
  return JSON.parse(readFileSync(path, "utf8")) as Fixture[];
}

function matches(pattern: string, haystack: string): boolean {
  const re = /^\/(.+)\/([a-z]*)$/.exec(pattern);
  return re ? new RegExp(re[1], re[2]).test(haystack) : haystack.includes(pattern);
}

export class MockProvider implements AIProvider {
  constructor(readonly modelId = "mock-model") {}

  async complete({ system, prompt }: CompletionRequest): Promise<string> {
    const haystack = `${system ?? ""}\n${prompt}`;
    const hit = load().find((f) => matches(f.match, haystack));
    if (!hit) throw new Error(`MockProvider: no fixture matches this request (${haystack.slice(0, 120)}…)`);
    return typeof hit.response === "string" ? hit.response : JSON.stringify(hit.response);
  }

  async embed(): Promise<number[]> {
    return [0];
  }
}

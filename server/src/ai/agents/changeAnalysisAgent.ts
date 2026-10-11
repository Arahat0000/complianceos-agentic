import { z } from "zod";
import type { AIProvider } from "../AIProvider.js";
import { completeJson } from "../json.js";

export interface ObligationText {
  id: string;
  requirementText: string;
  sourceQuote: string;
}

export interface ChangePair {
  label: string; // P1..
  before: ObligationText;
  after: ObligationText;
  score: number;
}

export interface ChangeUnits {
  pairs: ChangePair[];
  addedCandidates: (ObligationText & { label: string })[]; // A1..
  removedCandidates: (ObligationText & { label: string })[]; // R1..
}

export interface ChangeVerdict {
  label: string;
  classification: "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED";
  reason: string;
  quote: string | null;
  grounded: boolean;
}

const replySchema = z.object({
  summary: z.string().default(""),
  items: z.array(
    z.object({
      label: z.string(),
      classification: z.enum(["ADDED", "REMOVED", "MODIFIED", "UNCHANGED"]),
      reason: z.string().default(""),
      quote: z.string().nullable().optional(),
    })
  ),
});

const SYSTEM = `You are a regulatory change-analysis agent for a bank compliance platform. You compare obligations from an earlier version of a regulation with the version that amends or supersedes it.
Each unit has a label:
- P* : a matched pair (BEFORE / AFTER) -> classify MODIFIED (substantive change to duty, scope, deadline, threshold, penalty) or UNCHANGED (cosmetic rewording only).
- A* : an obligation only found in the new version -> ADDED, or UNCHANGED if it is really an existing duty reworded elsewhere.
- R* : an obligation only found in the old version -> REMOVED, or UNCHANGED if it is carried over reworded.
For every item give a short "reason" and a "quote" copied VERBATIM from the NEW text (ADDED/MODIFIED) or the OLD text (REMOVED) that evidences it; use null if none exists. Never invent text.
Respond with ONLY JSON: {"summary": string, "items": [{"label": string, "classification": "ADDED"|"REMOVED"|"MODIFIED"|"UNCHANGED", "reason": string, "quote": string|null}]}`;

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export async function classifyChanges(
  provider: AIProvider,
  ctx: { newName: string; previousName: string },
  units: ChangeUnits
): Promise<{ summary: string; verdicts: Map<string, ChangeVerdict> }> {
  const t = (o: ObligationText) => o.requirementText + (o.sourceQuote ? ` [quote: ${o.sourceQuote}]` : "");
  const lines: string[] = [];
  for (const p of units.pairs) lines.push(`${p.label}\nBEFORE: ${t(p.before)}\nAFTER: ${t(p.after)}`);
  for (const a of units.addedCandidates) lines.push(`${a.label} (new only): ${t(a)}`);
  for (const r of units.removedCandidates) lines.push(`${r.label} (old only): ${t(r)}`);
  const reply = await completeJson(
    provider,
    {
      system: SYSTEM,
      prompt: `OLD: ${ctx.previousName}\nNEW: ${ctx.newName}\n\n${lines.join("\n\n")}`,
      temperature: 0,
      maxTokens: 4000,
    },
    replySchema
  );

  // Ground every quote against the text it claims to come from.
  const newText = new Map<string, string>();
  const oldText = new Map<string, string>();
  for (const p of units.pairs) {
    newText.set(p.label, norm(`${p.after.requirementText} ${p.after.sourceQuote}`));
    oldText.set(p.label, norm(`${p.before.requirementText} ${p.before.sourceQuote}`));
  }
  for (const a of units.addedCandidates) newText.set(a.label, norm(`${a.requirementText} ${a.sourceQuote}`));
  for (const r of units.removedCandidates) oldText.set(r.label, norm(`${r.requirementText} ${r.sourceQuote}`));

  const verdicts = new Map<string, ChangeVerdict>();
  for (const it of reply.items) {
    if (!newText.has(it.label) && !oldText.has(it.label)) continue; // unknown label
    const q = it.quote?.trim() ? it.quote.trim() : null;
    const hay = [newText.get(it.label), oldText.get(it.label)];
    const grounded = q != null && hay.some((h) => h != null && h.includes(norm(q)));
    verdicts.set(it.label, {
      label: it.label,
      classification: it.classification,
      reason: it.reason,
      quote: grounded ? q : null,
      grounded,
    });
  }
  return { summary: reply.summary, verdicts };
}

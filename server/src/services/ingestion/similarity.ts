// Text-agreement helpers for comparing two independent transcriptions.

function tokens(s: string): string[] {
  return s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
}

function counts(t: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of t) m.set(w, (m.get(w) ?? 0) + 1);
  return m;
}

function dice(a: Map<string, number>, na: number, b: Map<string, number>, nb: number): number {
  if (na === 0 && nb === 0) return 1;
  if (na === 0 || nb === 0) return 0;
  let overlap = 0;
  for (const [w, c] of a) overlap += Math.min(c, b.get(w) ?? 0);
  return (2 * overlap) / (na + nb);
}

// 0..1 bag-of-words F1 between two texts.
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  return dice(counts(ta), ta.length, counts(tb), tb.length);
}

// Is `quote` (fuzzily) present in `haystack`? Exact normalised substring, or a token window
// of similar length whose similarity to the quote reaches `threshold`.
export function quoteFound(quote: string, haystack: string, threshold = 0.85): boolean {
  const q = tokens(quote);
  const h = tokens(haystack);
  if (q.length === 0 || h.length === 0) return false;
  if (` ${h.join(" ")} `.includes(` ${q.join(" ")} `)) return true;
  const qc = counts(q);
  const len = Math.min(q.length, h.length);
  for (let i = 0; i + len <= h.length; i++) {
    const w = h.slice(i, i + len);
    if (dice(qc, q.length, counts(w), w.length) >= threshold) return true;
  }
  return false;
}

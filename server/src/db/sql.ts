// Small helpers for building parameterised SQL. Column names are ALWAYS
// checked against an allowlist — never interpolate request keys directly.

export interface SetClause {
  clause: string; // e.g. '"title" = $3, "status" = $4'
  values: unknown[];
}

// Builds a SET clause from the keys of `input` that are (a) present and not
// undefined and (b) in `allowed`. `startIndex` is the first free $N.
export function buildSet(
  input: object,
  allowed: readonly string[],
  startIndex: number
): SetClause | null {
  const entries = Object.entries(input).filter(
    ([key, value]) => value !== undefined && allowed.includes(key)
  );
  if (entries.length === 0) return null;
  return {
    clause: entries.map(([key], i) => `"${key}" = $${startIndex + i}`).join(", "),
    values: entries.map(([, value]) => value),
  };
}

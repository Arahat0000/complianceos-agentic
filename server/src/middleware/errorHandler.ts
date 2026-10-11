import type { NextFunction, Request, Response } from "express";
import { ZodError, flattenError } from "zod";

// Schemas live in @complianceos/shared, which can resolve its own copy of zod —
// `instanceof ZodError` then fails across the package boundary, so also match by shape.
function isZodError(err: unknown): err is ZodError {
  return (
    err instanceof ZodError ||
    (typeof err === "object" &&
      err !== null &&
      (err as { name?: string }).name === "ZodError" &&
      Array.isArray((err as { issues?: unknown }).issues))
  );
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (isZodError(err)) {
    return res.status(400).json({ error: "Validation failed", details: flattenError(err) });
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  // Services can signal an expected client error with `{ status: 4xx }` on the thrown Error.
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    return res.status(status).json({ error: message });
  }
  console.error(err);
  res.status(500).json({ error: message });
}

import type { NextFunction, Request, Response } from "express";
import type { Role } from "@complianceos/shared";
import { passport } from "./passport.js";

interface AuthenticatedUser {
  id: string;
  organizationId: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthenticatedUser {}
  }
}

export const requireAuth = passport.authenticate("jwt", { session: false });

// Express 5 types req.params values as `string | string[]` (wildcard segments). Declaring the
// middleware's params as plain strings lets route handlers keep `req.params.id` typed as string.
type StringParams = Record<string, string>;

export function requireRole(...roles: Role[]) {
  return (req: Request<StringParams>, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

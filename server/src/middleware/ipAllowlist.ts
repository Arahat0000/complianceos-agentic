import type { NextFunction, Request, Response } from "express";
import { pool } from "../db/pool.js";
import { isIPInCIDR } from "./ipCidr.js";

// "::ffff:203.0.113.5" (IPv4-mapped IPv6, common behind dual-stack sockets)
// -> "203.0.113.5" so it can match IPv4 CIDRs.
function normalizeIp(ip: string): string {
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  return mapped ? mapped[1] : ip;
}

// Enforces OrganizationIPWhitelist for orgs that have configured one. An org
// with no rows in the table is unrestricted. Uses req.ip, so set
// `trust proxy` on the app when running behind a load balancer. Only IPv4
// CIDRs can match (see ipCidr.ts); IPv6 clients of a restricted org are denied.
export async function ipAllowlist(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return next();

  try {
    const { rows } = await pool.query<{ cidr: string }>(
      'SELECT "cidr"::text AS cidr FROM "OrganizationIPWhitelist" WHERE "organizationId" = $1',
      [req.user.organizationId]
    );
    if (rows.length === 0) return next();

    const clientIp = normalizeIp(req.ip ?? "");
    const allowed = rows.some((row) => isIPInCIDR(clientIp, row.cidr));
    if (!allowed) return res.status(403).json({ error: "IP not allowlisted for this organization" });
    next();
  } catch (err) {
    next(err);
  }
}

import {
  addIpWhitelistSchema,
  inviteMemberSchema,
  updateMemberSchema,
  updateOrgAIConfigSchema,
  updateOrganizationSchema,
  updateOrgSecuritySettingsSchema,
} from "@complianceos/shared";
import { Router } from "express";
import { isIPInCIDR } from "../middleware/ipCidr.js";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import {
  getOrgAIConfigSummary,
  getPlatformDefault,
  listAIProviders,
  listEmbeddingProviders,
  upsertOrgAIConfig,
} from "../services/organizationAIConfig.js";
import {
  addIpWhitelist,
  deleteIpWhitelist,
  getOrganization,
  getSecuritySettings,
  inviteMember,
  listIpWhitelist,
  listMembers,
  OrgServiceError,
  removeMember,
  updateMemberRole,
  updateOrganization,
  upsertSecuritySettings,
} from "../services/organizationService.js";
import type { NextFunction, Request, Response } from "express";

export const organizationsRouter = Router();

// Turns expected service failures into their HTTP status.
function fail(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof OrgServiceError) return res.status(err.status).json({ error: err.message });
  next(err);
}

const param = (req: Request, name: string) => String(req.params[name]);

organizationsRouter.get("/me", async (req, res, next) => {
  try {
    const org = await getOrganization(req.user!.organizationId);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    res.json(org);
  } catch (err) {
    next(err);
  }
});

organizationsRouter.patch("/me", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = updateOrganizationSchema.parse(req.body);
    const org = await updateOrganization(req.user!.organizationId, input);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    res.json(org);
  } catch (err) {
    next(err);
  }
});

// --- Members & invites --------------------------------------------------

organizationsRouter.get("/me/members", async (req, res, next) => {
  try {
    res.json(await listMembers(req.user!.organizationId));
  } catch (err) {
    next(err);
  }
});

organizationsRouter.patch("/me/members/:membershipId", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = updateMemberSchema.parse(req.body);
    if (!input.role) return res.status(400).json({ error: "role is required" });
    const { member, previousRole } = await updateMemberRole(
      req.user!.organizationId,
      param(req, "membershipId"),
      input.role
    );
    await auditAsUser(req, {
      type: "EDIT",
      action: "Changed member role",
      detail: `${member.email}: ${previousRole} -> ${member.role}`,
      objectType: "SETTINGS",
      objectId: member.id,
    });
    res.json(member);
  } catch (err) {
    fail(err, res, next);
  }
});

organizationsRouter.delete("/me/members/:membershipId", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const member = await removeMember(
      req.user!.organizationId,
      param(req, "membershipId"),
      req.user!.id
    );
    await auditAsUser(req, {
      type: "EDIT",
      action: "Removed member",
      detail: member.email,
      objectType: "SETTINGS",
      objectId: member.id,
    });
    res.status(204).end();
  } catch (err) {
    fail(err, res, next);
  }
});

organizationsRouter.post("/me/invites", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = inviteMemberSchema.parse(req.body);
    const invite = await inviteMember(req.user!.organizationId, input);
    await auditAsUser(req, {
      type: "CREATE",
      action: "Invited member",
      detail: `${invite.email} as ${invite.role}`,
      objectType: "SETTINGS",
      objectId: invite.id,
    });
    // The token is a bearer secret for joining the org; not returned.
    res.status(201).json({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

// --- AI configuration ---------------------------------------------------

organizationsRouter.get("/me/ai-config", requireRole("ADMIN"), async (req, res, next) => {
  try {
    res.json(await getOrgAIConfigSummary(req.user!.organizationId));
  } catch (err) {
    next(err);
  }
});

organizationsRouter.put("/me/ai-config", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = updateOrgAIConfigSchema.parse(req.body);
    await upsertOrgAIConfig(req.user!.organizationId, input);
    await auditAsUser(req, {
      type: "EDIT",
      action: "Updated AI configuration",
      detail: [
        `custom AI: ${input.useCustomAi ? `${input.aiProvider ?? "?"}/${input.aiModel ?? "default"}` : "off"}`,
        input.aiApiKey ? "AI key replaced" : null,
        input.embeddingProvider ? `embeddings: ${input.embeddingProvider}` : null,
        input.embeddingApiKey ? "embedding key replaced" : null,
      ]
        .filter(Boolean)
        .join("; "),
      objectType: "SETTINGS",
      objectId: req.user!.organizationId,
    });
    res.json(await getOrgAIConfigSummary(req.user!.organizationId));
  } catch (err) {
    next(err);
  }
});

organizationsRouter.get("/me/ai/platform-default", (_req, res) => {
  res.json(getPlatformDefault());
});

organizationsRouter.get("/me/ai/providers", (_req, res) => {
  res.json({ providers: listAIProviders() });
});

organizationsRouter.get("/me/embeddings/providers", (_req, res) => {
  res.json({ providers: listEmbeddingProviders() });
});

// --- Security settings & IP allowlist ------------------------------------

organizationsRouter.get("/me/security", requireRole("ADMIN"), async (req, res, next) => {
  try {
    res.json(await getSecuritySettings(req.user!.organizationId));
  } catch (err) {
    next(err);
  }
});

organizationsRouter.put("/me/security", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = updateOrgSecuritySettingsSchema.parse(req.body);
    const settings = await upsertSecuritySettings(req.user!.organizationId, input);
    await auditAsUser(req, {
      type: "EDIT",
      action: "Updated security settings",
      detail: Object.keys(input)
        .filter((k) => k !== "ssoConfig")
        .map((k) => `${k}=${String(input[k as keyof typeof input])}`)
        .concat("ssoConfig" in input ? ["ssoConfig updated"] : [])
        .join(", "),
      objectType: "SETTINGS",
      objectId: req.user!.organizationId,
    });
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

organizationsRouter.get("/me/ip-whitelist", requireRole("ADMIN"), async (req, res, next) => {
  try {
    res.json(await listIpWhitelist(req.user!.organizationId));
  } catch (err) {
    next(err);
  }
});

organizationsRouter.post("/me/ip-whitelist", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = addIpWhitelistSchema.parse(req.body);
    // Adding the first entry switches the org from "unrestricted" to
    // "allowlist only" — refuse if that would lock out the caller.
    const existing = await listIpWhitelist(req.user!.organizationId);
    if (existing.length === 0 && !isIPInCIDR(req.ip ?? "", input.cidr)) {
      return res.status(400).json({
        error: `This entry does not include your current IP (${req.ip ?? "unknown"}) and would lock you out`,
      });
    }
    const entry = await addIpWhitelist(req.user!.organizationId, input);
    await auditAsUser(req, {
      type: "CREATE",
      action: "Added IP allowlist entry",
      detail: entry.cidr,
      objectType: "SETTINGS",
      objectId: entry.id,
    });
    res.status(201).json(entry);
  } catch (err) {
    fail(err, res, next);
  }
});

organizationsRouter.delete("/me/ip-whitelist/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const entry = await deleteIpWhitelist(req.user!.organizationId, param(req, "id"));
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    await auditAsUser(req, {
      type: "EDIT",
      action: "Removed IP allowlist entry",
      detail: entry.cidr,
      objectType: "SETTINGS",
      objectId: entry.id,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

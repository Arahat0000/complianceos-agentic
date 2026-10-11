import { upsertProfileSchema } from "@complianceos/shared";
import { Router } from "express";
import { requireRole } from "../auth/middleware.js";
import { auditAsUser } from "../services/audit.js";
import { getProfile, upsertProfile } from "../services/profileService.js";

export const profileRouter = Router();

// Returns {} shape with nulls when no profile has been saved yet.
profileRouter.get("/", async (req, res, next) => {
  try {
    res.json((await getProfile(req.user!.organizationId)) ?? null);
  } catch (err) {
    next(err);
  }
});

profileRouter.put("/", requireRole("ADMIN", "EDITOR"), async (req, res, next) => {
  try {
    const input = upsertProfileSchema.parse(req.body);
    const profile = await upsertProfile(req.user!.organizationId, input);
    await auditAsUser(req, {
      type: "EDIT",
      action: "Updated entity profile",
      objectType: "SETTINGS",
      objectId: req.user!.organizationId,
    });
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

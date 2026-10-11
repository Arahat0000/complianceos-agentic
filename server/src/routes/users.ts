import { changePasswordSchema, updateProfileSchema } from "@complianceos/shared";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import {
  AVATAR_MIME_TYPES,
  changePassword,
  getUser,
  saveAvatar,
  toSharedUser,
  updateProfile,
} from "../services/userService.js";

export const usersRouter = Router();

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, AVATAR_MIME_TYPES.includes(file.mimetype)),
}).single("avatar");

function handleAvatarUpload(req: Request, res: Response, next: NextFunction) {
  avatarUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const tooLarge = err.code === "LIMIT_FILE_SIZE";
      return res
        .status(tooLarge ? 413 : 400)
        .json({ error: tooLarge ? "File size must be less than 2MB" : err.message });
    }
    next(err);
  });
}

usersRouter.get("/me", async (req, res, next) => {
  try {
    const user = await getUser(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(toSharedUser(user, { role: req.user!.role, organizationId: req.user!.organizationId }));
  } catch (err) {
    next(err);
  }
});

usersRouter.patch("/me", async (req, res, next) => {
  try {
    const input = updateProfileSchema.parse(req.body);
    const user = await updateProfile(req.user!.id, input);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(toSharedUser(user, { role: req.user!.role, organizationId: req.user!.organizationId }));
  } catch (err) {
    next(err);
  }
});

usersRouter.post("/me/change-password", async (req, res, next) => {
  try {
    const input = changePasswordSchema.parse(req.body);
    const ok = await changePassword(req.user!.id, input.currentPassword, input.newPassword);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

usersRouter.post("/avatar", handleAvatarUpload, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "An image file (png, jpeg, webp, gif) is required in field 'avatar'" });
    }
    const user = await saveAvatar(req.user!.id, req.file);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ avatarUrl: user.avatarUrl });
  } catch (err) {
    next(err);
  }
});

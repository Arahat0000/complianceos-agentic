import { Router } from "express";
import { config } from "../config.js";
import { storage } from "../storage/index.js";
import { verifySignature } from "../storage/localStorage.js";

// Serves files for STORAGE_MODE=local through short-lived HMAC-signed URLs
// (see LocalStorageAdapter.getSignedUrl). Public route: the signature is the auth.
export const storageRouter = Router();

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

storageRouter.get(/^\/(.+)$/, async (req, res, next) => {
  try {
    if (config.storageMode !== "local") return res.status(404).end();
    const key = decodeURIComponent(req.path.slice(1));
    const exp = Number(req.query.exp);
    const sig = String(req.query.sig ?? "");
    if (!verifySignature(key, exp, sig)) return res.status(403).json({ error: "Invalid or expired link" });
    const body = await storage.download(key);
    const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
    res.setHeader("content-type", TYPES[ext] ?? "application/octet-stream");
    res.setHeader("cache-control", "private, max-age=60");
    res.send(body);
  } catch (err) {
    next(err);
  }
});

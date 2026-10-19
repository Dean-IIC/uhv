import { randomBytes } from "node:crypto";
import { BUCKET, MAX_UPLOAD_BYTES } from "../lib/config.js";
import { db } from "../lib/db.js";
import { methodNotAllowed, readBody, requireAdmin, sendJson } from "../lib/http.js";

// Accepts one image (raw body). Only JPG, PNG and WebP up to 5 MB; the file's own bytes must match its type.
const TYPES = {
  "image/jpeg": { ext: "jpg", ok: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", ok: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { ext: "webp", ok: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  if (!requireAdmin(req, res)) return;
  const type = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  const kind = TYPES[type];
  if (!kind) return sendJson(res, 415, { error: "Only JPG, PNG and WebP images are allowed." });
  const declared = Number(req.headers["content-length"] ?? 0);
  if (declared > MAX_UPLOAD_BYTES) return sendJson(res, 413, { error: "Images must be 5 MB or smaller." });
  const body = await readBody(req, MAX_UPLOAD_BYTES);
  if (!body) return sendJson(res, 413, { error: "Images must be 5 MB or smaller." });
  if (body.length < 12 || !kind.ok(body)) return sendJson(res, 415, { error: "That file is not a valid JPG, PNG or WebP image." });

  const now = new Date();
  const name = `p/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${Date.now()}-${randomBytes(6).toString("hex")}.${kind.ext}`;
  try {
    const storage = db().storage.from(BUCKET);
    const { error } = await storage.upload(name, body, { contentType: type, cacheControl: "31536000", upsert: false });
    if (error) throw error;
    sendJson(res, 200, { url: storage.getPublicUrl(name).data.publicUrl });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: "The image could not be uploaded. Please try again." });
  }
}

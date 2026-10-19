import { saveChange } from "../lib/db.js";
import { methodNotAllowed, readJson, requireAdmin, sendJson } from "../lib/http.js";
import { cleanPlain, cleanValue } from "../lib/sanitize.js";

// Saves one piece of content: { key, value, label }.
export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  if (!requireAdmin(req, res)) return;
  const body = await readJson(req);
  if (!body || typeof body.key !== "string") return sendJson(res, 400, { error: "Nothing to save." });
  const cleaned = cleanValue(body.key, body.value);
  if (cleaned.error) return sendJson(res, 400, { error: cleaned.error });
  try {
    await saveChange(body.key, cleaned.value, cleanPlain(body.label ?? "", 160) || body.key);
    sendJson(res, 200, { ok: true, value: cleaned.value });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: "The change could not be saved. Please try again." });
  }
}

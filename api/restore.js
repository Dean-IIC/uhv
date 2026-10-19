import { historyEntry, readOne, saveChange } from "../lib/db.js";
import { methodNotAllowed, readJson, requireAdmin, sendJson } from "../lib/http.js";
import { revertChange } from "../lib/revert.js";

// Reverses a chosen change from History (see lib/revert.js). The restore is itself recorded, so Undo reverses it.
export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  if (!requireAdmin(req, res)) return;
  const body = await readJson(req, 1024);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return sendJson(res, 400, { error: "Unknown history entry." });
  try {
    const entry = await historyEntry(id);
    if (!entry) return sendJson(res, 404, { error: "That history entry no longer exists." });
    // Every key is copied into the database first, so there is always an earlier version.
    if (!entry.before) return sendJson(res, 400, { error: "There is no earlier version to restore." });
    const current = await readOne(entry.key);
    const value = revertChange(entry.before.v, entry.after?.v, current.value);
    await saveChange(entry.key, value, `Restored: ${entry.label}`.slice(0, 160));
    sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: "Restore failed. Please try again." });
  }
}

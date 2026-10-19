import { applyState, deleteHistory, latestHistory } from "../lib/db.js";
import { methodNotAllowed, requireAdmin, sendJson } from "../lib/http.js";

// Reverses the most recent change and removes it from history (so Undo can be pressed again).
export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  if (!requireAdmin(req, res)) return;
  try {
    const last = await latestHistory();
    if (!last) return sendJson(res, 200, { ok: false, message: "Nothing to undo." });
    await applyState(last.key, last.before);
    await deleteHistory(last.id);
    sendJson(res, 200, { ok: true, label: last.label });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: "Undo failed. Please try again." });
  }
}

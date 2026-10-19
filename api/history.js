import { listHistory } from "../lib/db.js";
import { methodNotAllowed, requireAdmin, sendJson } from "../lib/http.js";

const plain = (v) => String(v ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const clip = (s, n = 140) => (s.length > n ? s.slice(0, n - 1) + "…" : s) || "(empty)";
const FIELDS = ["name", "designation", "department", "bio", "caption", "photo"];
const show = (field, v) => (field === "photo" ? (v ? "a photo" : "no photo") : clip(plain(v), 70));

/** A short "before" / "after" description of one change, for the History list. */
function describe(beforeState, afterState) {
  const b = beforeState?.v, a = afterState?.v;
  if (!Array.isArray(a) || !Array.isArray(b)) {
    const one = (v) => (v === null || v === undefined ? "No photo" : typeof v === "string" ? clip(plain(v)) : v.url ? "Photo" : "");
    return { before: beforeState ? one(b) : "(empty)", after: one(a) };
  }
  const label = (i) => plain(i.name) || plain(i.caption) || "photo";
  const B = new Map(b.map((i) => [i.id, i])), A = new Map(a.map((i) => [i.id, i]));
  const before = [], after = [];
  const added = a.filter((i) => !B.has(i.id)), deleted = b.filter((i) => !A.has(i.id));
  if (added.length) { before.push("—"); after.push(`Added: ${added.map(label).join(", ")}`); }
  if (deleted.length) { before.push(deleted.map(label).join(", ")); after.push("Deleted"); }
  for (const old of b) {
    const now = A.get(old.id);
    if (!now) continue;
    for (const f of FIELDS) {
      if ((old[f] ?? "") === (now[f] ?? "")) continue;
      before.push(`${label(old)} – ${f}: ${show(f, old[f])}`);
      after.push(`${f}: ${show(f, now[f])}`);
    }
  }
  if (!before.length && b.map((i) => i.id).join() !== a.map((i) => i.id).join()) { before.push("Earlier order"); after.push("New order"); }
  return { before: clip(before.join("; "), 200), after: clip(after.join("; "), 200) };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(res, "GET");
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await listHistory();
    sendJson(res, 200, { entries: rows.map((r) => ({ id: r.id, at: r.at, key: r.key, label: r.label, ...describe(r.before, r.after) })) });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: "History could not be loaded." });
  }
}

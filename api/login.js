import bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import { adminConfig, LOCK_MINUTES, MAX_FAILED_ATTEMPTS } from "../lib/config.js";
import { readSecurity, writeSecurity } from "../lib/db.js";
import { methodNotAllowed, readJson, sendJson } from "../lib/http.js";
import { sessionCookie } from "../lib/session.js";

const sameText = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  const cfg = adminConfig();
  if (!cfg.ready) return sendJson(res, 503, { error: "Admin sign-in is not set up yet (missing environment variables)." });
  if (req.headers["x-uhv-admin"] !== "1") return sendJson(res, 403, { error: "Request refused." });

  const body = await readJson(req, 4096);
  const username = String(body?.username ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  try {
    const sec = await readSecurity();
    const left = sec.lockedUntil ? Date.parse(sec.lockedUntil) - Date.now() : 0;
    if (left > 0) return sendJson(res, 429, { error: `Too many attempts. Try again in ${Math.ceil(left / 60000)} minute(s).` });

    const passwordOk = await bcrypt.compare(password, cfg.hash);
    if (!(sameText(username, cfg.username) && passwordOk)) {
      const failed = (sec.failed ?? 0) + 1;
      await writeSecurity(
        failed >= MAX_FAILED_ATTEMPTS
          ? { failed: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() }
          : { failed, lockedUntil: null },
      );
      return sendJson(res, 401, { error: "Wrong username or password." });
    }
    if (sec.failed || sec.lockedUntil) await writeSecurity({ failed: 0, lockedUntil: null });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: "Sign-in is unavailable right now. Please try again." });
  }
  sendJson(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(req) });
}

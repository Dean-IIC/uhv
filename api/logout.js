import { methodNotAllowed, sendJson } from "../lib/http.js";
import { clearedSessionCookie } from "../lib/session.js";

export default function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(res, "POST");
  sendJson(res, 200, { ok: true }, { "Set-Cookie": clearedSessionCookie(req) });
}

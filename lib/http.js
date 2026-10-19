import { isAdminRequest } from "./session.js";

export function sendJson(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

export function query(req) {
  return new URL(req.url, "http://x").searchParams;
}

/** Reads the raw body, stopping early when it is larger than `limit` bytes. Returns null if too large. */
export async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req, limit = 512 * 1024) {
  const buf = await readBody(req, limit);
  if (!buf) return null;
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Guard for every save, upload and delete route. The request must carry a valid admin
 * session cookie, and changes must come from this site's own pages: the custom header
 * cannot be sent cross-site without a CORS preflight (which is never allowed), and the
 * Origin, when sent, must match the host.
 */
export function requireAdmin(req, res) {
  if (!isAdminRequest(req)) {
    sendJson(res, 401, { error: "Please sign in again." });
    return false;
  }
  if (req.method !== "GET") {
    const origin = req.headers.origin;
    const sameOrigin = !origin || new URL(origin).host === req.headers.host;
    if (req.headers["x-uhv-admin"] !== "1" || !sameOrigin) {
      sendJson(res, 403, { error: "Request refused." });
      return false;
    }
  }
  return true;
}

export function methodNotAllowed(res, allowed) {
  res.setHeader("Allow", allowed);
  sendJson(res, 405, { error: "Method not allowed." });
}

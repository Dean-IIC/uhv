import { createHmac, timingSafeEqual } from "node:crypto";
import { adminConfig, SESSION_COOKIE, SESSION_MAX_AGE } from "./config.js";

/*
 * The admin session is a signed value: a small payload (who, and when it ends) plus an
 * HMAC signature made with SESSION_SECRET and the password hash. Nothing is stored on the
 * server, so a session ends when the cookie expires (seven days), when the admin signs out,
 * or when the password (or SESSION_SECRET) is changed. Same scheme as hkbkce.in.
 */
const sign = (payload, secret) => createHmac("sha256", secret).update(payload).digest("base64url");

export function createSessionValue(secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ sub: "admin", exp: now + SESSION_MAX_AGE * 1000 })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function isValidSessionValue(value, secret, now = Date.now()) {
  if (!value || !secret) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.sub === "admin" && typeof data.exp === "number" && data.exp > now;
  } catch {
    return false;
  }
}

/** The signing key: the session secret plus the password hash, so a new password ends all sessions. */
function signingKey() {
  const cfg = adminConfig();
  return cfg.ready ? `${cfg.secret}.${cfg.hash}` : "";
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function isAdminRequest(req) {
  return isValidSessionValue(readCookie(req, SESSION_COOKIE), signingKey());
}

function isHttps(req) {
  return req.headers["x-forwarded-proto"] === "https" || Boolean(process.env.VERCEL);
}

export function sessionCookie(req) {
  const secure = isHttps(req) ? "; Secure" : "";
  return `${SESSION_COOKIE}=${createSessionValue(signingKey())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`;
}

export function clearedSessionCookie(req) {
  const secure = isHttps(req) ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

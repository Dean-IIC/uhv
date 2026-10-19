/*
 * Settings come from environment variables:
 *   SUPABASE_URL          the Supabase project URL (NEXT_PUBLIC_SUPABASE_URL is also accepted)
 *   SUPABASE_SECRET_KEY   the Supabase secret (service) key, used only on the server
 *   ADMIN_USERNAME        the admin's sign-in name
 *   ADMIN_PASSWORD_HASH   a bcrypt hash of the admin password (make one with: npm run admin:hash)
 *   SESSION_SECRET        a random string of at least 32 characters
 */
export const PAGES = ["index", "about", "activities", "team", "contact"];
export const SESSION_COOKIE = "uhv_admin";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // seven days, in seconds
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
export const HISTORY_LIMIT = 30;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const BUCKET = "uhv";
// UHV_TABLES lets local testing use separate tables (e.g. uhvtest_content); production uses uhvportal_*.
const TABLE_PREFIX = /^[a-z_]{1,30}$/.test(process.env.UHV_TABLES ?? "") ? process.env.UHV_TABLES : "uhvportal";
export const TABLE = `${TABLE_PREFIX}_content`;
export const HISTORY_TABLE = `${TABLE_PREFIX}_history`;

export function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = (process.env.SUPABASE_SECRET_KEY || "").trim();
  return { url, key, ready: Boolean(url && key) };
}

export function adminConfig() {
  const username = (process.env.ADMIN_USERNAME ?? "").trim().toLowerCase();
  const hash = (process.env.ADMIN_PASSWORD_HASH ?? "").trim();
  const secret = process.env.SESSION_SECRET ?? "";
  return { username, hash, secret, ready: Boolean(username && hash.startsWith("$2") && secret.length >= 32) };
}

/** Public URL prefix of uploaded images; saved photo values must start with it. */
export function publicImagePrefix() {
  return `${supabaseConfig().url}/storage/v1/object/public/${BUCKET}/`;
}

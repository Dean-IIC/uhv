import { createClient } from "@supabase/supabase-js";
import { supabaseConfig, TABLE, HISTORY_TABLE, HISTORY_LIMIT } from "./config.js";

let client;
export function db() {
  const cfg = supabaseConfig();
  if (!cfg.ready) throw new Error("Supabase is not configured.");
  client ??= createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** All page content as { key: value }. System rows (_sys:*) are left out. */
export async function readAll() {
  const { data, error } = await db().from(TABLE).select("key, value").not("key", "like", "\\_sys:%");
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.key, r.value]));
}

/** Returns { exists, value } for one key. */
export async function readOne(key) {
  const { data, error } = await db().from(TABLE).select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data ? { exists: true, value: data.value } : { exists: false, value: null };
}

export async function writeOne(key, value) {
  const { error } = await db().from(TABLE).upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

async function removeOne(key) {
  const { error } = await db().from(TABLE).delete().eq("key", key);
  if (error) throw error;
}

// The database may return object keys in a different order, so compare with sorted keys.
const stable = (v) => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));

/**
 * Saves a value and records the change in history. History stores { v: value } wrappers so a
 * key that did not exist before (null) can be told apart from a value that is null.
 */
export async function saveChange(key, value, label) {
  const before = await readOne(key);
  if (before.exists && stable(before.value) === stable(value)) return { unchanged: true };
  await writeOne(key, value);
  const { error } = await db()
    .from(HISTORY_TABLE)
    .insert({ key, label, before: before.exists ? { v: before.value } : null, after: { v: value } });
  if (error) throw error;
  await pruneHistory();
  return { unchanged: false };
}

/** Puts a key back to a recorded state ({ v } wrapper, or null meaning "did not exist"). */
export async function applyState(key, state) {
  if (state) await writeOne(key, state.v);
  else await removeOne(key);
}

async function pruneHistory() {
  const { data, error } = await db().from(HISTORY_TABLE).select("id").order("id", { ascending: false }).range(HISTORY_LIMIT, HISTORY_LIMIT + 500);
  if (error) throw error;
  if (data.length) await db().from(HISTORY_TABLE).delete().in("id", data.map((r) => r.id));
}

export async function listHistory() {
  const { data, error } = await db().from(HISTORY_TABLE).select("id, at, key, label, before, after").order("id", { ascending: false }).limit(HISTORY_LIMIT);
  if (error) throw error;
  return data;
}

export async function latestHistory() {
  const { data, error } = await db().from(HISTORY_TABLE).select("id, key, label, before").order("id", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function historyEntry(id) {
  const { data, error } = await db().from(HISTORY_TABLE).select("id, key, label, before, after").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteHistory(id) {
  const { error } = await db().from(HISTORY_TABLE).delete().eq("id", id);
  if (error) throw error;
}

// ── Sign-in lockout (5 failures lock sign-in for 15 minutes), stored as a system row ──
const SECURITY_KEY = "_sys:security";
export async function readSecurity() {
  const row = await readOne(SECURITY_KEY);
  return row.value ?? { failed: 0, lockedUntil: null };
}
export async function writeSecurity(value) {
  await writeOne(SECURITY_KEY, value);
}

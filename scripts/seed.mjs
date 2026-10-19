// Copies all current page content from templates/*.html into the database.
// Only keys that are not in the database yet are added, so running it again never overwrites edits.
// Usage: npm run seed            (add --reset to wipe UHV content + history and copy again)
import { PAGES, TABLE, HISTORY_TABLE } from "../lib/config.js";
import { db } from "../lib/db.js";
import { extractContent } from "../lib/render.js";
import { cleanValue } from "../lib/sanitize.js";

const reset = process.argv.includes("--reset");
if (reset) {
  for (const t of [HISTORY_TABLE, TABLE]) {
    const { error } = await db().from(t).delete().not(t === TABLE ? "key" : "id", "is", null);
    if (error) throw error;
  }
  console.log("Cleared UHV content and history.");
}

const all = {};
for (const page of PAGES) Object.assign(all, extractContent(page));
// Stored in the same cleaned form the editor saves, so the first edit only changes what was edited.
const rows = Object.entries(all).map(([key, value]) => ({ key, value: key.startsWith("img:") ? value : cleanValue(key, value).value }));
const { error } = await db().from(TABLE).upsert(rows, { onConflict: "key", ignoreDuplicates: true });
if (error) throw error;
const { count } = await db().from(TABLE).select("key", { count: "exact", head: true });
console.log(`Copied ${rows.length} content items. The database now holds ${count} rows.`);

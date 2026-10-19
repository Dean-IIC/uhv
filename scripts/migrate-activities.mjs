// Moves the Activities page to editable activity boxes, keeping everything already saved:
//   - each box is built from the CURRENT saved text of its fields (t:activities.N) and the
//     photos of its old gallery (list:activities.galleryN);
//   - the 2026 tab and the "coming soon" box are added; the heading becomes 2020–2026.
// Safe to run more than once: it does nothing if list:activities.cards already exists.
// Usage: node --env-file=.env.local scripts/migrate-activities.mjs [--cleanup]
//   --cleanup  afterwards removes the old per-field and per-gallery rows (run after deploying).
import { execSync } from "node:child_process";
import { parseHTML } from "linkedom";
import { TABLE } from "../lib/config.js";
import { db, readAll, writeOne } from "../lib/db.js";
import { extractContent, readActivityCards } from "../lib/render.js";
import { cleanValue } from "../lib/sanitize.js";

const OLD_TEMPLATE_COMMIT = "bc4c079";
const oldHtml = execSync(`git show ${OLD_TEMPLATE_COMMIT}:templates/activities.html`, { encoding: "utf8" });
const { document } = parseHTML(oldHtml);
const grid = document.querySelector(".activity-grid");
const oldKeys = [...grid.querySelectorAll("[data-e]")].map((el) => el.getAttribute("data-e"));
const galleryKeys = [...grid.querySelectorAll("[data-list]")].map((el) => el.getAttribute("data-list"));

const content = await readAll();
console.log(`Table ${TABLE}: ${Object.keys(content).length} rows.`);

if (process.argv.includes("--cleanup")) {
  const gone = [...oldKeys, ...galleryKeys];
  const { error } = await db().from(TABLE).delete().in("key", gone);
  if (error) throw error;
  console.log(`Removed ${gone.length} old rows (per-field text and per-box galleries).`);
  process.exit(0);
}

if (content["list:activities.cards"]) {
  console.log("Activity boxes already exist; nothing to do.");
  process.exit(0);
}

// Fill the old template with the saved values, then read the boxes out of it.
for (const el of grid.querySelectorAll("[data-e]")) {
  const v = content[el.getAttribute("data-e")];
  if (typeof v === "string") el.innerHTML = v;
}
const photosFor = (card) => {
  const key = card.querySelector("[data-list]")?.getAttribute("data-list");
  return (content[key] ?? []).map((p) => ({ id: p.id, photo: p.photo, caption: p.caption ?? "" }));
};
const boxes = readActivityCards(grid, photosFor);

// The new 2026 "coming soon" box and year tabs come from the updated template.
const fresh = extractContent("activities");
const placeholder = fresh["list:activities.cards"].find((c) => c.year === "2026");
const cards = cleanValue("list:activities.cards", [...boxes, { ...placeholder, id: `act-${boxes.length + 1}` }]);
const years = cleanValue("list:activities.years", fresh["list:activities.years"]);
if (cards.error || years.error) throw new Error(cards.error || years.error);

await writeOne("list:activities.cards", cards.value);
await writeOne("list:activities.years", years.value);
const heading = content["t:activities.4"];
if (typeof heading === "string" && heading.includes("2020–2025")) {
  await writeOne("t:activities.4", heading.replace("2020–2025", "2020–2026"));
}
console.log(`Saved ${cards.value.length} activity boxes (${cards.value.reduce((n, c) => n + c.photos.length, 0)} photos kept) and ${years.value.length} year tabs.`);

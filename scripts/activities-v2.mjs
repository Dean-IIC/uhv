// One-time template change for the Activities page (2026 + editable activity boxes).
// - The activity grid becomes one list (list:activities.cards); the per-field keys inside the
//   boxes and the per-box photo galleries are folded into it.
// - The year tabs become a list (list:activities.years) and 2026 is added after 2025.
// - A 2026 placeholder box is added and the heading becomes "Implementation Journey 2020–2026".
// Prints the old keys that were inside the boxes, for scripts/migrate-activities.mjs.
// Usage: node scripts/activities-v2.mjs
import { readFileSync, writeFileSync } from "node:fs";

const file = "templates/activities.html";
let src = readFileSync(file, "utf8");
if (src.includes('data-list="list:activities.cards"')) {
  console.log("already updated, skipped");
  process.exit(0);
}

const gridStart = src.indexOf('<div class="activity-grid">');
const gridEnd = src.indexOf("</div><!-- end activity-grid -->");
let grid = src.slice(gridStart, gridEnd);

const oldKeys = [...grid.matchAll(/ data-e="(t:activities\.\d+)"/g)].map((m) => m[1]);
const galleries = [...grid.matchAll(/data-list="(list:activities\.gallery\d+)"/g)].map((m) => m[1]);

grid = grid
  .replace(/ data-e="t:activities\.\d+"/g, "")
  .replace(/\n\s*<div class="uhv-gallery" data-list="list:activities\.gallery\d+" data-tpl="gallery"><\/div>/g, "")
  .replace('<div class="activity-grid">', '<div class="activity-grid" data-list="list:activities.cards" data-tpl="activity">');

const placeholder = `
      <!-- ─── 2026 ─── -->
      <div class="activity-card theme-indigo" data-year="2026" data-aos="fade-up" data-delay="0">
        <div class="activity-header">
          <div class="activity-icon-wrap">🗓️</div>
          <span class="activity-year-tag">2026</span>
          <div class="activity-card-date"><i class="fas fa-calendar"></i> 2026</div>
          <h3 class="activity-card-title">UHV activities 2026 — coming soon</h3>
        </div>
        <div class="activity-body">
          <p class="activity-desc">
            Universal Human Values activities for 2026 will be added here soon.
          </p>
          <div class="activity-meta">
            <span class="meta-item"><i class="fas fa-university"></i> HKBKCE</span>
          </div>
        </div>
      </div>
    `;
grid = grid.replace(/\s*$/, "") + "\n" + placeholder;

src = src.slice(0, gridStart) + grid + src.slice(gridEnd);
src = src
  .replace('<div class="filter-bar">', '<div class="filter-bar" data-years="list:activities.years">')
  .replace(
    '<button class="filter-btn" data-filter="2025">2025</button>',
    '<button class="filter-btn" data-filter="2025">2025</button>\n      <button class="filter-btn" data-filter="2026">2026</button>',
  )
  .replace("Implementation Journey 2020–2025</h3>", "Implementation Journey 2020–2026</h3>");

writeFileSync(file, src);
console.log(JSON.stringify({ oldKeys, galleries }));

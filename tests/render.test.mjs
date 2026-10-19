import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPage, extractContent } from "../lib/render.js";
import { PAGES } from "../lib/config.js";

process.env.SUPABASE_URL ||= "https://example.supabase.co";
const { cleanValue } = await import("../lib/sanitize.js");
const cleaned = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, k.startsWith("img:") ? v : cleanValue(k, v).value]));

// Visitors must see exactly the original page when the database holds the copied content.
const norm = (h) =>
  h
    .replace(/ data-(id|f|pf|pid)="[^"]*"/g, "")
    .replace(/<div class="uhv-gallery"><\/div>/g, "")
    .replace(/<a class="active" href="([^"]*)"/g, '<a href="$1" class="active"')
    .replace(/>\s+/g, ">").replace(/\s+</g, "<")
    .replace(/\s+/g, " ")
    .replace(/<br\s*\/?>/g, "<br>")
    .replace(/\/>/g, ">")
    .trim();

for (const page of PAGES) {
  test(`${page}: rendering the copied content reproduces the original page`, () => {
    assert.equal(norm(renderPage(page, extractContent(page))), norm(renderPage(page, {})));
  });
  test(`${page}: the cleaned copy stored in the database also reproduces the page`, () => {
    const n = (h) => norm(h).replace(/ rel="noopener noreferrer"/g, ' rel="noopener"');
    assert.equal(n(renderPage(page, cleaned(extractContent(page)))), n(renderPage(page, {})));
  });
}

test("visitors get no admin code; admins do", () => {
  const visitor = renderPage("team", extractContent("team"));
  assert.ok(!visitor.includes("admin.js") && !visitor.includes("uhv-data"));
  const admin = renderPage("team", extractContent("team"), { admin: true });
  assert.ok(admin.includes("/assets/js/admin.js") && admin.includes('id="uhv-data"'));
});

test("saved values are placed into the page", () => {
  const content = { "t:team.1": "Our <strong>People</strong>", "list:team.members": [{ id: "a1", name: "Dr. Test", department: "CSE", designation: "Faculty", photo: null, icon: "🙂" }] };
  const out = renderPage("team", content);
  assert.match(out, /data-e="t:team.1">Our <strong>People<\/strong><\/h1>/);
  assert.match(out, /<div class="member-name" data-f="name">Dr. Test<\/div>/);
  assert.equal((out.match(/class="member-card"/g) ?? []).length, 1);
});

test("activities: 2026 tab, newest year first, placeholder box", () => {
  const out = renderPage("activities", cleaned(extractContent("activities")));
  const years = [...out.matchAll(/class="activity-card [^"]*" data-year="(\d{4})"/g)].map((m) => Number(m[1]));
  assert.deepEqual(years, [...years].sort((a, b) => b - a));
  assert.equal(years[0], 2026);
  assert.match(out, /data-filter="2025">2025<\/button>\s*<button class="filter-btn" data-filter="2026">2026<\/button>/);
  assert.match(out, /UHV activities 2026 — coming soon/);
  assert.match(out, /Implementation Journey 2020–2026/);
  assert.equal(years.length, 20);
});

test("activities: a saved box with photos renders in the same design", () => {
  const content = cleaned(extractContent("activities"));
  const url = "https://example.supabase.co/storage/v1/object/public/uhv/p/x.webp";
  content["list:activities.cards"] = [{ id: "n1", year: "2027", theme: "theme-green", delay: 0, icon: "🌱", tag: "Jan 2027", date: '<i class="fas fa-calendar"></i> 5 Jan 2027', title: "New", desc: "Desc", meta: "", photos: [{ id: "q1", photo: url, caption: "Cap" }] }];
  content["list:activities.years"] = [{ id: "y2027", year: "2027" }];
  const out = renderPage("activities", content);
  assert.match(out, /<div class="activity-card theme-green" data-year="2027"/);
  assert.match(out, /<figure class="uhv-gallery-item" data-pid="q1"><img src="[^"]+x\.webp" alt="Cap"/);
  assert.match(out, /data-filter="2027">2027</);
});

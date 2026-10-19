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
    .replace(/ data-(id|f)="[^"]*"/g, "")
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

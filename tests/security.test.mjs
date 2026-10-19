import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "https://example.supabase.co";
const { cleanValue, cleanInline } = await import("../lib/sanitize.js");
const { createSessionValue, isValidSessionValue } = await import("../lib/session.js");

const IMG = "https://example.supabase.co/storage/v1/object/public/uhv/p/1.webp";

test("scripts and event handlers are removed from edited text", () => {
  const out = cleanInline(`Hi<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)" onclick="x()">x</a><b onmouseover="y()">b</b>`);
  assert.ok(!/script|onerror|onclick|onmouseover|javascript:|<img/i.test(out), out);
  assert.match(out, /<b>b<\/b>/);
});

test("simple formatting and icons survive", () => {
  const out = cleanInline(`<i class="fas fa-users" style="color:#f39c12;margin-right:12px"></i>Our <strong>Team</strong><br/><a href="about.html">About</a>`);
  assert.match(out, /<i class="fas fa-users" style="color:#f39c12;margin-right:12px"><\/i>/);
  assert.match(out, /<a href="about.html">About<\/a>/);
});

test("unsafe styles are dropped", () => {
  assert.ok(!cleanInline(`<span style="background:url(javascript:x)">a</span>`).includes("url("));
});

test("only this site's uploaded images can be saved", () => {
  assert.ok(cleanValue("img:index.card1", { url: IMG }).value);
  assert.ok(cleanValue("img:index.card1", { url: "https://evil.example/x.png" }).error);
  assert.ok(cleanValue("img:index.card1", { url: IMG + '"onerror="x' }).error);
  assert.ok(cleanValue("list:team.members", [{ id: "a", photo: "https://evil.example/x.png" }]).error);
});

test("keys are validated, system keys cannot be written", () => {
  assert.ok(cleanValue("_sys:security", {}).error);
  assert.ok(cleanValue("t:../x", "a").error);
});

test("list fields are cleaned", () => {
  const { value } = cleanValue("list:team.members", [{ id: "a1", name: "<script>x</script>Dr. A", designation: "<b>Prof</b>", photo: IMG }]);
  assert.equal(value[0].name, "Dr. A");
  assert.equal(value[0].designation, "<b>Prof</b>");
});

test("session values are signed and expire", () => {
  const v = createSessionValue("k".repeat(40));
  assert.ok(isValidSessionValue(v, "k".repeat(40)));
  assert.ok(!isValidSessionValue(v, "other-secret".repeat(4)));
  assert.ok(!isValidSessionValue(v.replace(/^./, "x"), "k".repeat(40)));
  assert.ok(!isValidSessionValue(v, "k".repeat(40), Date.now() + 8 * 864e5));
});

test("obfuscated and nested attacks are removed", () => {
  const attacks = [
    `<a href="java\tscript:alert(1)">x</a>`,
    `<a href="&#106;avascript:alert(1)">x</a>`,
    `<a href=" JAVASCRIPT:alert(1)">x</a>`,
    `<a href="data:text/html,<script>alert(1)</script>">x</a>`,
    `<a href="//evil.example">x</a>`,
    `<svg onload=alert(1)><circle/></svg>`,
    `<iframe src="https://evil.example"></iframe>`,
    `<div onclick="x()"><script>alert(1)</script>ok</div>`,
    `<IMG SRC=x OnError=alert(1)>`,
    `<span style="color:red;background:url(javascript:alert(1))" onmouseover="x()">s</span>`,
    `<math><mi xlink:href="javascript:alert(1)">m</mi></math>`,
    `<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>`,
    `<template><script>alert(1)</script></template>`,
    `<!-- <script>alert(1)</script> -->`,
  ];
  for (const a of attacks) {
    const out = cleanInline(a);
    assert.ok(!/javascript:|data:|on\w+=|<script|<svg|<iframe|<img|<math|\/\/evil|<!--/i.test(out), `${a} -> ${out}`);
  }
  assert.equal(cleanInline(`<div onclick="x()"><script>alert(1)</script>ok</div>`), "ok");
  assert.equal(cleanInline(`<span style="color:red;background:url(x)">s</span>`), `<span style="color:red">s</span>`);
});

test("plain text fields strip all markup", async () => {
  const { cleanPlain } = await import("../lib/sanitize.js");
  assert.equal(cleanPlain(`<b>Hi</b> <script>alert(1)</script>there`), "Hi there");
});

test("activity boxes and years are validated", () => {
  const ok = cleanValue("list:activities.cards", [{ id: "a1", year: "2026", theme: "theme-x", title: "<script>x</script>T", desc: "<b>d</b>", photos: [{ id: "p1", photo: IMG, caption: "c" }] }]);
  assert.equal(ok.value[0].title, "T");
  assert.equal(ok.value[0].theme, "theme-indigo");
  assert.equal(ok.value[0].tag, "2026");
  assert.ok(cleanValue("list:activities.cards", [{ id: "a1", year: "20x6" }]).error);
  assert.ok(cleanValue("list:activities.cards", [{ id: "a1", year: "2026", photos: [{ id: "p", photo: "https://evil.example/a.png" }] }]).error);
  assert.deepEqual(cleanValue("list:activities.years", [{ year: "2027" }, { year: "2020" }]).value.map((y) => y.year), ["2020", "2027"]);
  assert.ok(cleanValue("list:activities.years", [{ year: "2026" }, { year: "2026" }]).error);
});

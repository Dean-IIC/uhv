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

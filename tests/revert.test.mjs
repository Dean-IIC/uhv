import { test } from "node:test";
import assert from "node:assert/strict";
import { revertChange } from "../lib/revert.js";

const p = (id, name = id, extra = {}) => ({ id, name, ...extra });
const ids = (list) => list.map((i) => i.id).join(",");

test("text and photos get the earlier value back", () => {
  assert.equal(revertChange("old", "new", "newer"), "old");
  assert.equal(revertChange(null, { url: "x" }, { url: "y" }), null);
});

test("an old edit is reversed without losing later changes", () => {
  const before = [p("a", "Lijimol"), p("b")];
  const after = [p("a", "Lijimol K"), p("b")];
  const current = [p("a", "Lijimol K"), p("b", "b", { photo: "new.webp" }), p("c")];
  const out = revertChange(before, after, current);
  assert.equal(out[0].name, "Lijimol");
  assert.equal(out[1].photo, "new.webp");
  assert.equal(ids(out), "a,b,c");
});

test("an old addition is removed; a later addition stays", () => {
  const out = revertChange([p("a")], [p("a"), p("x")], [p("a"), p("x"), p("y")]);
  assert.equal(ids(out), "a,y");
});

test("an old deletion is put back near its old place", () => {
  const out = revertChange([p("a"), p("b"), p("c")], [p("a"), p("c")], [p("a"), p("c"), p("d")]);
  assert.equal(ids(out), "a,b,c,d");
});

test("an old reorder is reversed for the items that still exist", () => {
  const out = revertChange([p("a"), p("b"), p("c")], [p("c"), p("a"), p("b")], [p("c"), p("a"), p("b"), p("d")]);
  assert.equal(ids(out), "a,b,c,d");
});

test("field order does not count as an edit", () => {
  const before = [{ id: "a", name: "A", photo: null }, { id: "b", name: "B", photo: null }];
  const after = [{ photo: null, name: "A", id: "a" }, { id: "b", name: "B2", photo: null }];
  const current = [{ id: "a", name: "A", photo: "later.webp" }, { id: "b", name: "B2", photo: null }];
  const out = revertChange(before, after, current);
  assert.equal(out[0].photo, "later.webp");
  assert.equal(out[1].name, "B");
});

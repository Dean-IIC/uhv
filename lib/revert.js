/*
 * Restoring an old History entry should reverse only what that change did, not wipe out
 * later changes to the same list. For lists (person cards, gallery photos) this compares
 * the entry's before/after and applies the reverse to the current list:
 *   added in that change    -> removed again
 *   deleted in that change  -> put back near its old position
 *   edited in that change   -> that item gets its earlier version back
 *   only reordered          -> the earlier order is applied to the items that still exist
 * Text and single photos are one value, so they simply get the earlier value back.
 */
// Compare with sorted keys at every level (the database may return keys in another order).
const stable = (v) => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
const same = (a, b) => stable(a) === stable(b);

export function revertChange(before, after, current) {
  if (!Array.isArray(before) || !Array.isArray(after) || !Array.isArray(current)) return before;

  const B = new Map(before.map((i) => [i.id, i]));
  const A = new Map(after.map((i) => [i.id, i]));
  let result = current.slice();

  const added = after.filter((i) => !B.has(i.id)).map((i) => i.id);
  const deleted = before.filter((i) => !A.has(i.id));
  const edited = before.filter((i) => A.has(i.id) && !same(i, A.get(i.id)));

  if (!added.length && !deleted.length && !edited.length) {
    // Only the order changed: put the items that still exist back in their earlier order.
    const rank = new Map(before.map((i, n) => [i.id, n]));
    const known = result.filter((i) => rank.has(i.id)).sort((x, y) => rank.get(x.id) - rank.get(y.id));
    let k = 0;
    return result.map((i) => (rank.has(i.id) ? known[k++] : i));
  }

  result = result.filter((i) => !added.includes(i.id));
  result = result.map((i) => (edited.some((e) => e.id === i.id) ? B.get(i.id) : i));
  for (const item of deleted) {
    if (result.some((i) => i.id === item.id)) continue;
    // Insert after the nearest earlier neighbour (from the old list) that is still present.
    const pos = before.findIndex((i) => i.id === item.id);
    let at = 0;
    for (let n = pos - 1; n >= 0; n--) {
      const idx = result.findIndex((i) => i.id === before[n].id);
      if (idx !== -1) { at = idx + 1; break; }
    }
    result.splice(at, 0, item);
  }
  return result;
}

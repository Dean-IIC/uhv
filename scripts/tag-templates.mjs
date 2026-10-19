// One-time script: marks the editable parts of templates/*.html by inserting attributes
// (data-e, data-num, data-img, data-list) at exact source offsets, so the rest of each file
// stays byte-for-byte the same. Safe to re-run: files that are already tagged are skipped.
// Usage: node scripts/tag-templates.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "parse5";

const PAGES = ["index", "about", "activities", "team", "contact"];
const INLINE = new Set(["a", "i", "strong", "em", "b", "u", "span", "br", "small", "sup", "sub"]);
const SKIP = new Set(["head", "script", "style", "button", "input", "textarea", "select", "option", "svg", "form"]);

const cls = (n) => (n.attrs?.find((a) => a.name === "class")?.value ?? "").split(/\s+/);
const hasClass = (n, c) => cls(n).includes(c);
const kids = (n) => n.childNodes ?? [];
const isEl = (n) => !!n.tagName;

function allInline(n) {
  return kids(n).every((c) => !isEl(c) || (INLINE.has(c.tagName) && !hasClass(c, "count-up") && allInline(c)));
}
function hasText(n) {
  return kids(n).some((c) => (c.nodeName === "#text" ? c.value.trim() !== "" : isEl(c) && hasText(c)));
}

for (const page of PAGES) {
  const file = `templates/${page}.html`;
  const src = readFileSync(file, "utf8");
  if (src.includes("data-e=")) {
    console.log(`${file}: already tagged, skipped`);
    continue;
  }
  const doc = parse(src, { sourceCodeLocationInfo: true });
  const inserts = []; // [offset, text]
  const counters = {};
  const next = (prefix) => (counters[prefix] = (counters[prefix] ?? 0) + 1);
  // Attribute goes right after the tag name, e.g. <div data-e="t:x" class="...">
  const addAttr = (n, attr) => inserts.push([n.sourceCodeLocation.startTag.startOffset + 1 + n.tagName.length, ` ${attr}`]);

  function walk(n, inNav) {
    for (const c of kids(n)) {
      if (!isEl(c) || SKIP.has(c.tagName) || hasClass(c, "filter-bar")) continue;
      const nav = inNav || hasClass(c, "navbar");
      const prefix = nav ? "nav" : page;

      // Person card lists (team page)
      if (page === "team" && (hasClass(c, "leadership-card") || hasClass(c, "coordinator-card"))) {
        const which = hasClass(c, "leadership-card") ? ["leaders", "leader"] : ["coordinators", "coordinator"];
        inserts.push([c.sourceCodeLocation.startOffset, `<div data-list="list:team.${which[0]}" data-tpl="${which[1]}">`]);
        inserts.push([c.sourceCodeLocation.endOffset, `</div>`]);
        continue;
      }
      if (page === "team" && hasClass(c, "member-grid")) {
        addAttr(c, `data-list="list:team.members" data-tpl="member"`);
        continue;
      }
      // Photo slot on the home page event cards; its badge stays editable text
      if (hasClass(c, "card-img")) {
        addAttr(c, `data-img="img:${page}.card${next(page + ".card")}"`);
        walk(c, nav);
        continue;
      }
      // Count-up statistics: the number lives in data-target
      if (hasClass(c, "count-up")) {
        addAttr(c, `data-num="t:${page}.num${next(page + ".num")}"`);
        continue;
      }
      // Event photo gallery, empty (and hidden) until photos are added
      if (hasClass(c, "activity-body")) {
        walk(c, nav);
        inserts.push([c.sourceCodeLocation.endTag.startOffset, `  <div class="uhv-gallery" data-list="list:activities.gallery${next("gallery")}" data-tpl="gallery"></div>\n        `]);
        continue;
      }
      if (!hasClass(c, "footer-bottom") && hasText(c) && allInline(c) && !kids(c).some((k) => isEl(k) && hasClass(k, "count-up"))) {
        addAttr(c, `data-e="t:${prefix}.${next(prefix)}"`);
        continue;
      }
      walk(c, nav);
    }
  }
  walk(doc, false);

  // Shared stylesheet for photos/galleries, and the discreet footer "Admin" link
  const styleTag = src.indexOf('<link rel="stylesheet" href="assets/css/style.css"/>');
  inserts.push([styleTag + '<link rel="stylesheet" href="assets/css/style.css"/>'.length, `\n  <link rel="stylesheet" href="assets/css/cms.css"/>`]);
  const fb = src.indexOf('<div class="footer-bottom">');
  const fbEnd = src.indexOf("</div>", fb);
  inserts.push([fbEnd, `  <a href="/admin/login" class="uhv-admin-link" rel="nofollow">Admin</a>\n  `]);

  let out = src;
  for (const [at, text] of inserts.sort((a, b) => b[0] - a[0])) out = out.slice(0, at) + text + out.slice(at);
  writeFileSync(file, out);
  console.log(`${file}: ${inserts.length} insertions`);
}

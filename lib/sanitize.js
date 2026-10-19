import { parseHTML } from "linkedom";
import { publicImagePrefix } from "./config.js";

/*
 * Edited text is cleaned on the server before it is stored. This is an allow-list: only simple
 * inline formatting survives (bold, italics, links, line breaks, icons). Every other element is
 * unwrapped (its text kept) or, for script-like elements, dropped with its content. Event
 * handlers and any attribute not listed are removed; links must be http(s), mailto, tel or
 * relative; inline styles keep only a few safe properties.
 */
const ALLOWED_TAGS = new Set(["a", "i", "strong", "em", "b", "u", "span", "br", "small", "sup", "sub"]);
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template", "textarea", "title", "svg", "math", "select", "option", "xmp", "noembed", "noframes", "plaintext", "head"]);
const ALLOWED_ATTRS = { a: ["href", "class", "target", "rel"], i: ["class", "style"], span: ["class", "style"] };
const STYLE_RULES = {
  color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]{3,20}$/i],
  "margin-right": [/^\d{1,3}px$/],
  "margin-left": [/^\d{1,3}px$/],
  "font-size": [/^\d{1,3}(px|rem|em|%)$/],
};
const CLASS_OK = /^[A-Za-z0-9_ -]{0,200}$/;

function safeHref(value) {
  const v = value.trim();
  // Remove characters browsers ignore inside a scheme (tabs, newlines, control chars) before checking it.
  const compact = v.replace(/[\u0000- \u007f-\u009f]/g, "").toLowerCase();
  if (/^(https?:|mailto:|tel:)/.test(compact)) return v;
  if (/^[a-z][a-z0-9+.-]*:/.test(compact) || compact.startsWith("//")) return null; // other schemes, protocol-relative
  return v; // relative link such as about.html or #top
}

function safeStyle(value) {
  const kept = [];
  for (const decl of value.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const val = decl.slice(i + 1).trim();
    if (STYLE_RULES[prop]?.some((re) => re.test(val))) kept.push(`${prop}:${val}`);
  }
  return kept.join(";");
}

function cleanNode(node, doc) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === 3) continue; // text
    if (child.nodeType !== 1) { child.remove(); continue; } // comments etc.
    const tag = child.tagName.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag)) { child.remove(); continue; }
    if (!ALLOWED_TAGS.has(tag)) {
      // Unwrap: keep the (cleaned) text inside, drop the element itself.
      cleanNode(child, doc);
      const frag = doc.createDocumentFragment();
      while (child.firstChild) frag.appendChild(child.firstChild);
      child.replaceWith(frag);
      continue;
    }
    const allowed = ALLOWED_ATTRS[tag] ?? ["class"];
    for (const { name, value } of [...child.attributes]) {
      const n = name.toLowerCase();
      if (!allowed.includes(n)) { child.removeAttribute(name); continue; }
      if (n === "class" && !CLASS_OK.test(value)) child.removeAttribute(name);
      if (n === "href") { const h = safeHref(value); h === null ? child.removeAttribute(name) : child.setAttribute("href", h); }
      if (n === "style") { const s = safeStyle(value); s ? child.setAttribute("style", s) : child.removeAttribute(name); }
      if (n === "target" && value !== "_blank") child.removeAttribute(name);
    }
    if (tag === "a" && child.getAttribute("target") === "_blank") child.setAttribute("rel", "noopener noreferrer");
    else if (tag === "a" && child.hasAttribute("rel")) child.setAttribute("rel", child.getAttribute("rel").replace(/[^a-z ]/gi, ""));
    cleanNode(child, doc);
  }
}

export function cleanInline(value, max = 10000) {
  if (typeof value !== "string") return "";
  const { document } = parseHTML(`<!doctype html><html><body><div id="x"></div></body></html>`);
  const box = document.getElementById("x");
  box.innerHTML = value.slice(0, max * 2);
  cleanNode(box, document);
  return box.innerHTML.trim().slice(0, max);
}

export function cleanPlain(value, max = 300) {
  if (typeof value !== "string") return "";
  const { document } = parseHTML(`<!doctype html><html><body><div id="x"></div></body></html>`);
  const box = document.getElementById("x");
  box.innerHTML = value;
  for (const el of box.querySelectorAll(DROP_WITH_CONTENT_SELECTOR)) el.remove();
  return box.textContent.replace(/\s+/g, " ").trim().slice(0, max);
}
const DROP_WITH_CONTENT_SELECTOR = [...DROP_WITH_CONTENT].join(",");

const IMAGE_PATH = /^[A-Za-z0-9/_.-]{1,200}$/;
export function isOwnImageUrl(url) {
  const prefix = publicImagePrefix();
  return typeof url === "string" && url.startsWith(prefix) && IMAGE_PATH.test(url.slice(prefix.length)) && !url.includes("..");
}

export const KEY_PATTERN = /^(t|img|list):[a-z0-9._-]{1,80}$/;
const ITEM_ID = /^[A-Za-z0-9-]{1,40}$/;

/** Checks and cleans a value for a content key. Returns { value } or { error }. */
export function cleanValue(key, value) {
  if (!KEY_PATTERN.test(key)) return { error: "Unknown content key." };
  const kind = key.slice(0, key.indexOf(":"));

  if (kind === "t") {
    if (typeof value !== "string") return { error: "Text expected." };
    return { value: cleanInline(value) };
  }

  if (kind === "img") {
    if (value === null) return { value: null };
    if (!value || !isOwnImageUrl(value.url)) return { error: "Unknown image." };
    return { value: { url: value.url, alt: cleanPlain(value.alt ?? "", 200) } };
  }

  // list: person cards or gallery photos
  if (!Array.isArray(value) || value.length > 300) return { error: "List expected." };
  const items = [];
  const seen = new Set();
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || !ITEM_ID.test(raw.id ?? "") || seen.has(raw.id)) return { error: "Bad list item." };
    seen.add(raw.id);
    if (raw.photo != null && !isOwnImageUrl(raw.photo)) return { error: "Unknown image in list." };
    const item = { id: raw.id, photo: raw.photo ?? null };
    for (const f of ["name", "designation", "department", "bio", "caption"]) {
      if (raw[f] != null) item[f] = cleanInline(String(raw[f]), 4000);
    }
    if (raw.icon != null) item.icon = cleanPlain(String(raw.icon), 16);
    items.push(item);
  }
  return { value: items };
}

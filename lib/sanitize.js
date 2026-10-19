import sanitizeHtml from "sanitize-html";
import { publicImagePrefix } from "./config.js";

/*
 * Edited text is cleaned on the server before it is stored. Only simple inline formatting
 * survives (bold, italics, links, line breaks, icons); scripts, event handlers, iframes,
 * javascript: links and any other markup are removed.
 */
const INLINE_OPTIONS = {
  allowedTags: ["a", "i", "strong", "em", "b", "u", "span", "br", "small", "sup", "sub"],
  allowedAttributes: {
    a: ["href", "class", "target", "rel"],
    i: ["class", "style"],
    span: ["class", "style"],
    "*": ["class"],
  },
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i],
      "margin-right": [/^\d{1,3}px$/],
      "margin-left": [/^\d{1,3}px$/],
      "font-size": [/^\d{1,3}(px|rem|em|%)$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: attribs.target === "_blank" ? { ...attribs, rel: "noopener noreferrer" } : attribs,
    }),
  },
};

export function cleanInline(value, max = 10000) {
  if (typeof value !== "string") return "";
  return sanitizeHtml(value.slice(0, max * 2), INLINE_OPTIONS).trim().slice(0, max);
}

export function cleanPlain(value, max = 300) {
  if (typeof value !== "string") return "";
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim().slice(0, max);
}

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

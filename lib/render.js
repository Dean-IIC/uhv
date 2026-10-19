import { readFileSync } from "node:fs";
import path from "node:path";
import { parseHTML } from "linkedom";

/*
 * Pages are the original HTML files in templates/, with editable parts marked:
 *   data-e="t:..."      text (inner HTML)            data-num="t:..."  a count-up number
 *   data-img="img:..."  a photo slot                 data-list="list:..." data-tpl="..."  cards
 * Content from the database replaces the marked parts. Anything not in the database keeps
 * the template's own content, so the site still works if the database cannot be reached.
 */
const templateCache = new Map();
export function loadTemplate(page) {
  if (!templateCache.has(page)) {
    templateCache.set(page, readFileSync(path.join(process.cwd(), "templates", `${page}.html`), "utf8"));
  }
  return templateCache.get(page);
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function avatar(item, fallbackIcon) {
  if (item.photo) return `<img class="uhv-avatar-img" src="${esc(item.photo)}" alt="${esc(textOf(item.name))}" loading="lazy"/>`;
  return esc(item.icon || fallbackIcon);
}
const textOf = (html) => String(html ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
// Values were cleaned (sanitize.js) when saved, or copied from the trusted templates.
const html = (v) => v ?? "";

const TEMPLATES = {
  leader: (item) => `<div class="leadership-card" data-aos="fade-up" data-id="${esc(item.id)}">
      <div class="leadership-avatar" data-f="photo">${avatar(item, "👨‍💼")}</div>
      <div class="leadership-info">
        <div class="badge" data-f="designation">${html(item.designation)}</div>
        <h2 data-f="name">${html(item.name)}</h2>
        <div class="designation" data-f="department">${html(item.department)}</div>
        <p data-f="bio">${html(item.bio)}</p>
      </div>
    </div>`,
  coordinator: (item) => `<div class="coordinator-card" data-aos="fade-up" data-id="${esc(item.id)}">
      <div class="coord-avatar" data-f="photo">${avatar(item, "👩‍🏫")}</div>
      <div class="coord-info">
        <div class="badge-role" data-f="designation">${html(item.designation)}</div>
        <h3 data-f="name">${html(item.name)}</h3>
        <div class="dept" data-f="department">${html(item.department)}</div>
        <p data-f="bio">${html(item.bio)}</p>
      </div>
    </div>`,
  member: (item, i) => `
      <div class="member-card" data-aos="fade-up" data-delay="${i * 50}" data-id="${esc(item.id)}">
        <div class="member-avatar" data-f="photo">${avatar(item, "👩‍🏫")}</div>
        <div class="member-name" data-f="name">${html(item.name)}</div>
        <div class="member-dept" data-f="department">${html(item.department)}</div>
        <div class="member-role" data-f="designation">${html(item.designation)}</div>
      </div>`,
  gallery: (item) =>
    `<figure class="uhv-gallery-item" data-id="${esc(item.id)}"><img src="${esc(item.photo)}" alt="${esc(textOf(item.caption))}" loading="lazy"/><figcaption data-f="caption">${html(item.caption)}</figcaption></figure>`,
};

/** Renders a page. `content` is { key: value } from the database. */
export function renderPage(page, content, { admin = false } = {}) {
  const { document } = parseHTML(loadTemplate(page));

  for (const el of document.querySelectorAll("[data-e]")) {
    const v = content[el.getAttribute("data-e")];
    if (typeof v === "string") el.innerHTML = v;
  }
  for (const el of document.querySelectorAll("[data-num]")) {
    const v = content[el.getAttribute("data-num")];
    if (typeof v === "string" && /^\d{1,7}$/.test(v)) el.setAttribute("data-target", v);
  }
  for (const el of document.querySelectorAll("[data-img]")) {
    const v = content[el.getAttribute("data-img")];
    if (v && v.url) {
      el.classList.add("has-photo");
      el.insertAdjacentHTML("afterbegin", `<img class="uhv-slot-img" src="${esc(v.url)}" alt="${esc(v.alt ?? "")}" loading="lazy"/>`);
    }
  }
  for (const el of document.querySelectorAll("[data-list]")) {
    const items = content[el.getAttribute("data-list")];
    const tpl = TEMPLATES[el.getAttribute("data-tpl")];
    if (Array.isArray(items) && tpl) {
      const isMembers = el.getAttribute("data-tpl") === "member";
      el.innerHTML = items.map((item, i) => tpl(item, i)).join("") + (isMembers && items.length ? "\n    " : "");
    }
  }

  // Mark the current page in the menu (the menu text is shared by all pages).
  for (const a of document.querySelectorAll(".nav-links a")) {
    a.classList.toggle("active", a.getAttribute("href") === `${page}.html`);
    if (!a.getAttribute("class")) a.removeAttribute("class");
  }

  if (admin) {
    const data = { page, img: {}, lists: {} };
    for (const el of document.querySelectorAll("[data-img]")) data.img[el.getAttribute("data-img")] = content[el.getAttribute("data-img")] ?? null;
    for (const el of document.querySelectorAll("[data-list]")) data.lists[el.getAttribute("data-list")] = content[el.getAttribute("data-list")] ?? [];
    document.head.insertAdjacentHTML("beforeend", `<link rel="stylesheet" href="/assets/css/admin.css"/>\n`);
    const json = JSON.stringify(data).replace(/</g, "\\u003c");
    document.body.insertAdjacentHTML("beforeend", `<script id="uhv-data" type="application/json">${json}</script>\n<script src="/assets/js/admin.js" defer></script>\n`);
  }
  return document.toString();
}

/** Reads every editable value out of a template, for the first copy into the database. */
export function extractContent(page) {
  const { document } = parseHTML(loadTemplate(page));
  const out = {};
  for (const el of document.querySelectorAll("[data-e]")) {
    let v = el.innerHTML;
    if (el.closest(".nav-links")) v = v.replace(/ class="active"/g, "");
    out[el.getAttribute("data-e")] = v;
  }
  for (const el of document.querySelectorAll("[data-num]")) out[el.getAttribute("data-num")] = el.getAttribute("data-target");
  for (const el of document.querySelectorAll("[data-img]")) out[el.getAttribute("data-img")] = null;

  const inner = (card, sel) => (card.querySelector(sel)?.innerHTML ?? "").replace(/\s+/g, " ").trim();
  const ownText = (el) => [...(el?.childNodes ?? [])].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
  for (const el of document.querySelectorAll("[data-list]")) {
    const key = el.getAttribute("data-list");
    const tpl = el.getAttribute("data-tpl");
    const slug = key.split(".").pop().replace(/s$/, "");
    if (tpl === "leader") {
      out[key] = [...el.querySelectorAll(".leadership-card")].map((c, i) => ({
        id: `${slug}-${i + 1}`, photo: null, icon: ownText(c.querySelector(".leadership-avatar")),
        designation: inner(c, ".badge"), name: inner(c, "h2"), department: inner(c, ".designation"), bio: inner(c, "p"),
      }));
    } else if (tpl === "coordinator") {
      out[key] = [...el.querySelectorAll(".coordinator-card")].map((c, i) => ({
        id: `${slug}-${i + 1}`, photo: null, icon: ownText(c.querySelector(".coord-avatar")),
        designation: inner(c, ".badge-role"), name: inner(c, "h3"), department: inner(c, ".dept"), bio: inner(c, "p"),
      }));
    } else if (tpl === "member") {
      out[key] = [...el.querySelectorAll(".member-card")].map((c, i) => ({
        id: `${slug}-${i + 1}`, photo: null, icon: ownText(c.querySelector(".member-avatar")),
        name: inner(c, ".member-name"), department: inner(c, ".member-dept"), designation: inner(c, ".member-role"),
      }));
    } else {
      out[key] = [];
    }
  }
  return out;
}

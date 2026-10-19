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

const photoFigure = (p) =>
  `<figure class="uhv-gallery-item" data-pid="${esc(p.id)}"><img src="${esc(p.photo)}" alt="${esc(textOf(p.caption))}" loading="lazy"/><figcaption data-pf="caption">${html(p.caption)}</figcaption></figure>`;

/** Activity boxes are shown newest year first; boxes keep their saved order within a year. */
export function sortActivities(items) {
  return items.map((item, i) => [item, i]).sort((a, b) => Number(b[0].year) - Number(a[0].year) || a[1] - b[1]).map(([item]) => item);
}
const sortYears = (years) => [...years].sort((a, b) => Number(a.year) - Number(b.year));

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
  activity: (item) => `
      <div class="activity-card ${esc(item.theme || "theme-indigo")}" data-year="${esc(item.year)}" data-aos="fade-up" data-delay="${Number(item.delay) || 0}" data-id="${esc(item.id)}">
        <div class="activity-header">
          <div class="activity-icon-wrap" data-f="icon">${esc(item.icon || "📌")}</div>
          <span class="activity-year-tag" data-f="tag">${esc(item.tag || item.year)}</span>
          <div class="activity-card-date" data-f="date">${html(item.date)}</div>
          <h3 class="activity-card-title" data-f="title">${html(item.title)}</h3>
        </div>
        <div class="activity-body">
          <p class="activity-desc" data-f="desc">${html(item.desc)}</p>
          <div class="activity-meta" data-f="meta">${html(item.meta)}</div>
          <div class="uhv-gallery">${(item.photos || []).map(photoFigure).join("")}</div>
        </div>
      </div>`,
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
    const kind = el.getAttribute("data-tpl");
    if (Array.isArray(items) && tpl) {
      const list = kind === "activity" ? sortActivities(items) : items;
      el.innerHTML = list.map((item, i) => tpl(item, i)).join("") + ((kind === "member" || kind === "activity") && list.length ? "\n    " : "");
    } else if (kind === "activity") {
      const cards = [...el.querySelectorAll(":scope > .activity-card")];
      const sorted = cards.map((c, i) => [c, i]).sort((a, b) => Number(b[0].dataset.year) - Number(a[0].dataset.year) || a[1] - b[1]);
      el.innerHTML = sorted.map(([c]) => "\n      " + c.outerHTML).join("") + "\n    ";
    }
  }

  // Year tabs on the Activities page
  for (const el of document.querySelectorAll("[data-years]")) {
    const years = content[el.getAttribute("data-years")];
    if (Array.isArray(years)) {
      el.innerHTML =
        `\n      <button class="filter-btn active" data-filter="all">All Activities</button>` +
        sortYears(years).map((y) => `\n      <button class="filter-btn" data-filter="${esc(y.year)}">${esc(y.year)}</button>`).join("") +
        "\n    ";
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
    for (const el of document.querySelectorAll("[data-years]")) data.lists[el.getAttribute("data-years")] = content[el.getAttribute("data-years")] ?? readYears(el);
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
    } else if (tpl === "activity") {
      out[key] = readActivityCards(el);
    } else {
      out[key] = [];
    }
  }
  for (const el of document.querySelectorAll("[data-years]")) out[el.getAttribute("data-years")] = readYears(el);
  return out;
}

/** Reads the year tabs (not "All Activities") from a filter bar. */
export function readYears(el) {
  return [...el.querySelectorAll(".filter-btn[data-filter]")]
    .map((b) => b.getAttribute("data-filter"))
    .filter((y) => /^\d{4}$/.test(y))
    .map((year) => ({ id: `y${year}`, year }));
}

/** Reads activity boxes from template markup into list items. */
export function readActivityCards(grid, photosFor = () => []) {
  const inner = (card, sel) => (card.querySelector(sel)?.innerHTML ?? "").replace(/\s+/g, " ").trim();
  const text = (card, sel) => (card.querySelector(sel)?.textContent ?? "").trim();
  return [...grid.querySelectorAll(".activity-card")].map((c, i) => ({
    id: `act-${i + 1}`,
    year: c.getAttribute("data-year"),
    theme: [...c.classList].find((k) => k.startsWith("theme-")) || "theme-indigo",
    delay: Number(c.getAttribute("data-delay")) || 0,
    icon: text(c, ".activity-icon-wrap"),
    tag: text(c, ".activity-year-tag"),
    date: inner(c, ".activity-card-date"),
    title: inner(c, ".activity-card-title"),
    desc: inner(c, ".activity-desc"),
    meta: inner(c, ".activity-meta"),
    photos: photosFor(c, i),
  }));
}

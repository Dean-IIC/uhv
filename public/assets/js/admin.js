// On-page editor for the UHV portal. The server only sends this file to a signed-in admin;
// every change is checked again on the server (session, allowed keys, cleaned text, image type/size).
(() => {
  const data = JSON.parse(document.getElementById("uhv-data").textContent);
  const PAGE_NAMES = { index: "Home", about: "About", activities: "Activities", team: "Team", contact: "Contact" };
  const PAGE = PAGE_NAMES[data.page] || data.page;
  const PERSON_TPLS = ["leader", "coordinator", "member"];
  const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
  const MAX_BYTES = 5 * 1024 * 1024;
  let editing = false;
  try { editing = sessionStorage.getItem("uhv-edit") === "1"; } catch {}

  // ── Small helpers ──
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const plain = (html) => { const d = document.createElement("div"); d.innerHTML = html ?? ""; return d.textContent.replace(/\s+/g, " ").trim(); };
  const short = (s, n = 50) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const fill = (el, ...kids) => el.replaceChildren(...kids.filter((k) => k != null));
  const newId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  async function api(path, body, { method = "POST", raw = null } = {}) {
    const opts = { method, headers: { "X-UHV-Admin": "1" }, credentials: "same-origin" };
    if (raw) { opts.headers["Content-Type"] = raw.type; opts.body = raw; }
    else if (method !== "GET") { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body ?? {}); }
    let res;
    try { res = await fetch(path, opts); } catch { throw new Error("No connection to the server."); }
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) { status("Your session has ended. Please sign in again.", "err", 0); throw new Error(json.error || "Please sign in again."); }
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
    return json;
  }

  // ── Toolbar ──
  const statusEl = h("span", { class: "uhv-status", role: "status", "aria-live": "polite" });
  let statusTimer;
  function status(text, kind = "", ms = 2500) {
    clearTimeout(statusTimer);
    statusEl.textContent = text;
    statusEl.className = "uhv-status " + kind;
    if (ms) statusTimer = setTimeout(() => (statusEl.textContent = ""), ms);
  }
  const editBtn = h("button", { type: "button", "aria-pressed": "false", onclick: () => setEditing(!editing) }, "✏️ Edit page: OFF");
  const bar = h("div", { class: "uhv-bar", role: "toolbar", "aria-label": "Admin" },
    h("span", { class: "uhv-who" }, "Signed in as admin"),
    editBtn,
    h("button", { type: "button", onclick: undo, title: "Undo my last change" }, "↶ Undo"),
    h("button", { type: "button", onclick: showHistory }, "🕘 History"),
    statusEl,
    h("span", { class: "uhv-spacer" }),
    h("button", { type: "button", onclick: signOut }, "Sign out"),
  );
  document.body.prepend(bar);
  document.body.classList.add("uhv-admin");

  function setEditing(on) {
    editing = on;
    try { sessionStorage.setItem("uhv-edit", on ? "1" : "0"); } catch {}
    document.body.classList.toggle("uhv-editing", on);
    editBtn.setAttribute("aria-pressed", String(on));
    editBtn.textContent = on ? "✏️ Edit page: ON" : "✏️ Edit page: OFF";
    if (!on) document.activeElement?.blur?.();
    if (on) status("Click any text or photo to change it. Links don't open while editing.", "", 4000);
  }

  async function save(key, value, label) {
    status("Saving…", "", 0);
    try {
      const out = await api("/api/save", { key, value, label });
      status("Saved ✓", "ok");
      return out.value;
    } catch (err) {
      status("⚠ Not saved: " + err.message, "err", 10000);
      throw err;
    }
  }

  async function undo() {
    status("Undoing…", "", 0);
    try {
      const out = await api("/api/undo");
      if (!out.ok) return status(out.message || "Nothing to undo.");
      status("Undone ✓ " + short(out.label || "", 60), "ok");
      setTimeout(() => location.reload(), 500);
    } catch (err) {
      status("⚠ " + err.message, "err", 8000);
    }
  }

  async function signOut() {
    try { await api("/api/logout"); } catch {}
    try { sessionStorage.removeItem("uhv-edit"); } catch {}
    location.reload();
  }

  // ── Dialogs ──
  function modal(title, ...content) {
    const box = h("div", { class: "uhv-modal", role: "dialog", "aria-modal": "true", "aria-label": title }, h("h3", {}, title), ...content);
    const back = h("div", { class: "uhv-modal-back" }, box);
    const close = () => { back.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
    document.addEventListener("keydown", onKey);
    document.body.append(back);
    return { box, close };
  }

  async function showHistory() {
    const list = h("ul", { class: "uhv-history" }, h("li", {}, "Loading…"));
    const { close } = modal("History (last 30 changes)", h("p", {}, "Restore brings back the version from before that change. Restoring is itself a change, so Undo can reverse it."), list,
      h("div", { class: "uhv-row" }, h("button", { class: "uhv-btn", type: "button", onclick: () => close() }, "Close")));
    try {
      const { entries } = await api("/api/history", null, { method: "GET" });
      list.replaceChildren(...(entries.length ? entries.map((e) => h("li", {},
        h("div", {},
          h("div", { class: "uhv-when" }, new Date(e.at).toLocaleString()),
          h("div", { class: "uhv-label" }, e.label),
          h("div", { class: "uhv-diff" }, `Before: ${e.before}`),
          h("div", { class: "uhv-diff" }, `After: ${e.after}`)),
        h("button", { class: "uhv-btn", type: "button", onclick: async (ev) => {
          ev.target.disabled = true;
          try {
            await api("/api/restore", { id: e.id });
            status("Restored ✓", "ok");
            close();
            setTimeout(() => location.reload(), 400);
          } catch (err) {
            ev.target.disabled = false;
            status("⚠ " + err.message, "err", 8000);
          }
        } }, "Restore previous version"))) : [h("li", {}, "No changes yet.")]));
    } catch (err) {
      list.replaceChildren(h("li", {}, "⚠ " + err.message));
    }
  }

  // ── Images: checks, crop/zoom, resize, compress, upload ──
  function checkFile(file) {
    if (!ALLOWED.includes(file.type)) return "Only JPG, PNG and WebP images are allowed.";
    if (file.size > MAX_BYTES) return `"${file.name}" is larger than 5 MB.`;
    return "";
  }
  function pickFiles(multiple = false) {
    return new Promise((resolve) => {
      const input = h("input", { type: "file", accept: ALLOWED.join(","), multiple });
      input.addEventListener("change", () => resolve([...input.files]));
      input.click();
    });
  }
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That image could not be opened."));
      img.src = URL.createObjectURL(file);
    });
  }
  async function encode(canvas) {
    for (const q of [0.85, 0.75, 0.6, 0.45]) {
      let blob = await new Promise((r) => canvas.toBlob(r, "image/webp", q));
      if (!blob || blob.type !== "image/webp") blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", q));
      if (blob && blob.size <= 4 * 1024 * 1024) return blob;
    }
    throw new Error("The image is too large even after compressing.");
  }
  async function resizeOnly(file, maxSide = 1600) {
    const img = await loadImage(file);
    const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = h("canvas", { width: Math.round(img.naturalWidth * s), height: Math.round(img.naturalHeight * s) });
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return encode(c);
  }
  async function upload(blob) {
    return (await api("/api/upload", null, { raw: blob })).url;
  }

  /** Shows a crop/zoom preview. Resolves to the cropped, resized, compressed image, or null if cancelled. */
  async function cropImage(file, aspect, outWidth) {
    const problem = checkFile(file);
    if (problem) { status("⚠ " + problem, "err", 8000); return null; }
    const img = await loadImage(file);
    const W = Math.min(480, window.innerWidth - 72);
    const H = Math.round(W / aspect);
    const dpr = window.devicePixelRatio || 1;
    const canvas = h("canvas", { width: W * dpr, height: H * dpr });
    const ctx = canvas.getContext("2d");
    const base = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    let zoom = 1, x = 0, y = 0;
    const clamp = () => {
      const s = base * zoom, dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      x = Math.min(0, Math.max(W - dw, x));
      y = Math.min(0, Math.max(H - dh, y));
    };
    const draw = () => {
      clamp();
      const s = base * zoom;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, x, y, img.naturalWidth * s, img.naturalHeight * s);
    };
    // start centred
    x = (W - img.naturalWidth * base) / 2;
    y = (H - img.naturalHeight * base) / 2;
    const setZoom = (z, cx = W / 2, cy = H / 2) => {
      const old = base * zoom;
      zoom = Math.min(4, Math.max(1, z));
      const s = base * zoom;
      x = cx - ((cx - x) * s) / old;
      y = cy - ((cy - y) * s) / old;
      slider.value = zoom;
      draw();
    };
    const frame = h("div", { class: "uhv-crop", style: `width:${W}px;height:${H}px` }, canvas);
    let drag = null;
    frame.addEventListener("pointerdown", (e) => { drag = { px: e.clientX, py: e.clientY, x, y }; frame.setPointerCapture(e.pointerId); });
    frame.addEventListener("pointermove", (e) => { if (!drag) return; x = drag.x + e.clientX - drag.px; y = drag.y + e.clientY - drag.py; draw(); });
    frame.addEventListener("pointerup", () => (drag = null));
    frame.addEventListener("wheel", (e) => { e.preventDefault(); const r = frame.getBoundingClientRect(); setZoom(zoom * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    const slider = h("input", { type: "range", min: "1", max: "4", step: "0.01", value: "1", "aria-label": "Zoom" });
    slider.addEventListener("input", () => setZoom(Number(slider.value)));
    draw();

    return new Promise((resolve) => {
      const done = (v) => { close(); URL.revokeObjectURL(img.src); resolve(v); };
      const useBtn = h("button", { class: "uhv-btn primary", type: "button", onclick: async () => {
        useBtn.disabled = true;
        const outH = Math.round(outWidth / aspect);
        const out = h("canvas", { width: outWidth, height: outH });
        const f = outWidth / W, s = base * zoom;
        const octx = out.getContext("2d");
        octx.imageSmoothingQuality = "high";
        octx.drawImage(img, x * f, y * f, img.naturalWidth * s * f, img.naturalHeight * s * f);
        try { done(await encode(out)); } catch (err) { status("⚠ " + err.message, "err", 8000); done(null); }
      } }, "Use this photo");
      const { close } = modal("Crop photo",
        h("p", {}, "Drag to position. Use the slider or mouse wheel to zoom."),
        frame,
        h("div", { class: "uhv-zoom" }, "−", slider, "+"),
        h("div", { class: "uhv-row" }, h("button", { class: "uhv-btn", type: "button", onclick: () => done(null) }, "Cancel"), useBtn));
    });
  }

  async function chooseCroppedPhoto(aspect, outWidth) {
    const [file] = await pickFiles(false);
    if (!file) return null;
    const blob = await cropImage(file, aspect, outWidth);
    if (!blob) return null;
    status("Uploading photo…", "", 0);
    try {
      const url = await upload(blob);
      status("Photo uploaded", "ok");
      return url;
    } catch (err) {
      status("⚠ Upload failed: " + err.message, "err", 10000);
      return null;
    }
  }

  // ── Inline text editing ──
  function startText(el) {
    if (el.isContentEditable) return;
    const isNum = el.hasAttribute("data-num");
    const key = el.getAttribute(isNum ? "data-num" : "data-e");
    const original = isNum ? el.dataset.target : el.innerHTML;
    if (isNum) el.textContent = original;
    el.contentEditable = "true";
    el.focus();
    let cancelled = false;
    const onKey = (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); el.blur(); }
      else if (e.key === "Enter" && e.shiftKey && !isNum) { e.preventDefault(); document.execCommand("insertLineBreak"); }
      else if (e.key === "Escape") { cancelled = true; el.blur(); }
    };
    const onBlur = async () => {
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("blur", onBlur);
      el.contentEditable = "false";
      if (cancelled) { isNum ? (el.textContent = original) : (el.innerHTML = original); return; }
      if (isNum) {
        const v = el.textContent.replace(/\D/g, "").slice(0, 7);
        if (!v || v === original) { el.textContent = original; return; }
        try { await save(key, v, `${PAGE}: number changed to ${v}`); el.dataset.target = v; el.textContent = v; }
        catch { el.textContent = original; }
        return;
      }
      const value = el.innerHTML;
      if (value === original) return;
      try {
        const clean = await save(key, value, `${PAGE}: "${short(plain(value) || "(empty)")}"`);
        if (clean !== value) el.innerHTML = clean;
      } catch {
        el.innerHTML = original;
      }
    };
    el.addEventListener("keydown", onKey);
    el.addEventListener("blur", onBlur);
  }

  // Paste as plain text only, inside anything being edited.
  document.addEventListener("paste", (e) => {
    const t = e.target.closest?.('[contenteditable="true"]');
    if (!t) return;
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData?.getData("text/plain") || "").replace(/\s*\n\s*/g, " "));
  });

  // ── Photo slots (home page event cards) ──
  let menuEl = null;
  function closeMenu() { menuEl?.remove(); menuEl = null; }
  function openSlotMenu(slot) {
    closeMenu();
    const key = slot.getAttribute("data-img");
    const has = slot.classList.contains("has-photo");
    const r = slot.getBoundingClientRect();
    menuEl = h("div", { class: "uhv-menu", style: `left:${Math.max(8, r.left + window.scrollX + r.width / 2 - 75)}px;top:${r.top + window.scrollY + Math.max(8, r.height / 2 - 45)}px` },
      h("button", { class: "uhv-btn primary", type: "button", onclick: async () => {
        closeMenu();
        const aspect = r.width / r.height;
        const url = await chooseCroppedPhoto(aspect, 1200);
        if (!url) return;
        try {
          await save(key, { url, alt: "" }, `${PAGE}: photo replaced`);
          slot.querySelector(":scope > .uhv-slot-img")?.remove();
          slot.prepend(h("img", { class: "uhv-slot-img", src: url, alt: "" }));
          slot.classList.add("has-photo");
          data.img[key] = { url, alt: "" };
        } catch {}
      } }, has ? "📷 Replace photo" : "📷 Add photo"),
      has ? h("button", { class: "uhv-btn", type: "button", onclick: async () => {
        closeMenu();
        try {
          await save(key, null, `${PAGE}: photo removed`);
          slot.querySelector(":scope > .uhv-slot-img")?.remove();
          slot.classList.remove("has-photo");
          data.img[key] = null;
        } catch {}
      } }, "Remove photo") : null,
      h("button", { class: "uhv-btn", type: "button", onclick: closeMenu }, "Cancel"));
    document.body.append(menuEl);
  }

  // ── Person cards ──
  const FIELDS = { leader: ["designation", "name", "department", "bio"], coordinator: ["designation", "name", "department", "bio"], member: ["name", "department", "designation"] };
  const FIELD_NAMES = { name: "Name", designation: "Designation", department: "Department", bio: "About (optional)" };
  const DEFAULT_ICON = { leader: "👨‍💼", coordinator: "👩‍🏫", member: "👩‍🏫" };
  const listLabel = (listEl) => ({ leader: "Leadership", coordinator: "Coordinator", member: "Faculty" })[listEl.getAttribute("data-tpl")] || "Gallery";

  function setAvatar(slot, item, tpl) {
    if (item.photo) slot.replaceChildren(h("img", { class: "uhv-avatar-img", src: item.photo, alt: plain(item.name) }));
    else slot.textContent = item.icon || DEFAULT_ICON[tpl];
  }

  function confirmBox(anchor, question, onYes) {
    anchor.querySelector(":scope > .uhv-confirm")?.remove();
    const box = h("div", { class: "uhv-ui uhv-confirm", role: "alertdialog" }, question,
      h("div", {},
        h("button", { class: "uhv-btn danger", type: "button", onclick: (e) => { e.stopPropagation(); box.remove(); onYes(); } }, "Confirm"),
        h("button", { class: "uhv-btn", type: "button", onclick: (e) => { e.stopPropagation(); box.remove(); } }, "Cancel")));
    anchor.append(box);
    box.querySelector("button").focus();
  }

  function decoratePersonList(listEl) {
    const key = listEl.getAttribute("data-list");
    const tpl = listEl.getAttribute("data-tpl");
    const items = () => data.lists[key] || [];
    const commit = async (next, label) => { const clean = await save(key, next, `${PAGE} – ${listLabel(listEl)}: ${label}`); data.lists[key] = clean; return clean; };

    for (const card of listEl.querySelectorAll(":scope > [data-id]")) decorateCard(card);
    listEl.append(h("div", { class: "uhv-ui uhv-add-card", role: "button", tabindex: "0", onclick: addPerson, onkeydown: (e) => e.key === "Enter" && addPerson() }, h("span", { style: "font-size:28px" }, "➕"), "Add new"));

    function decorateCard(card) {
      const id = card.dataset.id;
      const actions = h("div", { class: "uhv-ui uhv-card-actions" });
      const showButtons = () => fill(actions,
        h("button", { class: "uhv-btn", type: "button", onclick: (e) => { e.stopPropagation(); startCardEdit(); } }, "✏️ Edit"),
        h("button", { class: "uhv-btn", type: "button", onclick: (e) => { e.stopPropagation(); confirmBox(card, "Delete this person?", del); } }, "🗑️ Delete"));
      showButtons();
      card.append(actions);

      async function del() {
        const item = items().find((i) => i.id === id);
        try { await commit(items().filter((i) => i.id !== id), `deleted ${plain(item?.name)}`); card.remove(); } catch {}
      }
      function startCardEdit() {
        const item = items().find((i) => i.id === id);
        if (!item || card.classList.contains("uhv-card-editing")) return;
        card.classList.add("uhv-card-editing");
        let photo = item.photo;
        const fields = FIELDS[tpl].map((f) => card.querySelector(`[data-f="${f}"]`)).filter(Boolean);
        for (const f of fields) { f.contentEditable = "true"; f.dataset.placeholder = FIELD_NAMES[f.dataset.f]; }
        fields.find((f) => f.dataset.f === "name")?.focus();
        const avatar = card.querySelector('[data-f="photo"]');
        const onAvatar = async (e) => {
          e.stopPropagation();
          const url = await chooseCroppedPhoto(1, 600);
          if (url) { photo = url; setAvatar(avatar, { ...item, photo }, tpl); renderEditButtons(); }
        };
        avatar.addEventListener("click", onAvatar);
        const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); finish(true); } else if (e.key === "Escape") finish(false); };
        card.addEventListener("keydown", onKey);

        const renderEditButtons = () => fill(actions,
          h("button", { class: "uhv-btn", type: "button", onclick: onAvatar }, photo ? "📷 Change photo" : "📷 Add photo"),
          photo ? h("button", { class: "uhv-btn", type: "button", onclick: (e) => { e.stopPropagation(); photo = null; setAvatar(avatar, { ...item, photo: null }, tpl); renderEditButtons(); } }, "Remove photo") : null,
          h("button", { class: "uhv-btn primary", type: "button", onclick: (e) => { e.stopPropagation(); finish(true); } }, "Save"),
          h("button", { class: "uhv-btn", type: "button", onclick: (e) => { e.stopPropagation(); finish(false); } }, "Cancel"));
        renderEditButtons();

        async function finish(keep) {
          const restoreView = (it) => {
            for (const f of fields) { f.contentEditable = "false"; f.innerHTML = it[f.dataset.f] ?? ""; }
            setAvatar(avatar, it, tpl);
            avatar.removeEventListener("click", onAvatar);
            card.removeEventListener("keydown", onKey);
            card.classList.remove("uhv-card-editing");
            showButtons();
          };
          if (!keep) return restoreView(item);
          const updated = { ...item, photo };
          for (const f of fields) updated[f.dataset.f] = f.innerHTML.trim();
          if (!plain(updated.name)) { status("⚠ Please enter a name.", "err", 5000); return; }
          try {
            const clean = await commit(items().map((i) => (i.id === id ? updated : i)), `edited ${plain(updated.name)}`);
            restoreView(clean.find((i) => i.id === id) || updated);
          } catch {}
        }
      }
    }

    function addPerson() {
      let photo = null;
      const thumb = h("div", { class: "uhv-thumb" }, DEFAULT_ICON[tpl]);
      const inputs = {};
      const err = h("div", { class: "uhv-err", role: "alert" });
      const fieldEls = FIELDS[tpl].map((f) => {
        inputs[f] = f === "bio" ? h("textarea", { id: "uhv-f-" + f }) : h("input", { type: "text", id: "uhv-f-" + f, maxlength: "300" });
        return [h("label", { for: "uhv-f-" + f }, FIELD_NAMES[f] + (f === "name" ? " *" : "")), inputs[f]];
      });
      const saveBtn = h("button", { class: "uhv-btn primary", type: "button", onclick: async () => {
        const name = inputs.name.value.trim();
        if (!name) { err.textContent = "Please enter a name."; return inputs.name.focus(); }
        saveBtn.disabled = true;
        const item = { id: newId(), photo, icon: DEFAULT_ICON[tpl] };
        for (const f of FIELDS[tpl]) item[f] = esc(inputs[f].value.trim()).replace(/\n/g, "<br/>");
        try {
          await commit([...items(), item], `added ${name}`);
          close();
          setTimeout(() => location.reload(), 300);
        } catch (e) {
          err.textContent = e.message;
          saveBtn.disabled = false;
        }
      } }, "Add person");
      const { close } = modal(`Add a person – ${listLabel(listEl)}`,
        h("label", {}, "Photo"),
        h("div", { class: "uhv-person-photo" }, thumb,
          h("button", { class: "uhv-btn", type: "button", onclick: async () => {
            const url = await chooseCroppedPhoto(1, 600);
            if (url) { photo = url; thumb.textContent = ""; thumb.style.backgroundImage = `url("${url}")`; }
          } }, "📷 Choose photo")),
        fieldEls,
        err,
        h("div", { class: "uhv-row" }, h("button", { class: "uhv-btn", type: "button", onclick: () => close() }, "Cancel"), saveBtn));
      inputs.name.focus();
    }
  }

  // ── Photo galleries (activities) ──
  function decorateGallery(listEl) {
    const key = listEl.getAttribute("data-list");
    const items = () => data.lists[key] || [];
    const eventTitle = plain(listEl.closest(".activity-card")?.querySelector(".activity-card-title")?.innerHTML) || "event";
    const commit = async (next, label) => { const clean = await save(key, next, `${PAGE} – ${short(eventTitle, 40)}: ${label}`); data.lists[key] = clean; return clean; };

    for (const fig of listEl.querySelectorAll(":scope > figure[data-id]")) decorateFigure(fig);
    const addTile = h("div", { class: "uhv-ui uhv-add-card", role: "button", tabindex: "0", onclick: addPhotos, onkeydown: (e) => e.key === "Enter" && addPhotos() }, h("span", { style: "font-size:20px" }, "➕"), "Add photos");
    listEl.append(addTile);

    function decorateFigure(fig) {
      const id = fig.dataset.id;
      fig.draggable = true;
      fig.append(h("button", { class: "uhv-ui uhv-btn danger uhv-photo-del", type: "button", title: "Delete photo", "aria-label": "Delete photo",
        onclick: (e) => { e.stopPropagation(); confirmBox(fig, "Delete this photo?", async () => {
          try { await commit(items().filter((i) => i.id !== id), "deleted a photo"); fig.remove(); } catch {}
        }); } }, "✕"));
      const cap = fig.querySelector("figcaption");
      cap.addEventListener("click", (e) => {
        if (!editing || cap.isContentEditable) return;
        e.stopPropagation();
        const original = cap.innerHTML;
        cap.contentEditable = "true";
        fig.draggable = false;
        cap.focus();
        const onKey = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); cap.blur(); } else if (ev.key === "Escape") { cap.innerHTML = original; cap.blur(); } };
        cap.addEventListener("keydown", onKey);
        cap.addEventListener("blur", async () => {
          cap.removeEventListener("keydown", onKey);
          cap.contentEditable = "false";
          fig.draggable = true;
          const value = cap.innerHTML.trim();
          if (value === original) return;
          try {
            const clean = await commit(items().map((i) => (i.id === id ? { ...i, caption: value } : i)), `caption "${short(plain(value) || "(empty)", 40)}"`);
            cap.innerHTML = clean.find((i) => i.id === id)?.caption ?? "";
          } catch { cap.innerHTML = original; }
        }, { once: true });
      });
      // drag to reorder
      fig.addEventListener("dragstart", (e) => { if (!editing) return e.preventDefault(); e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; fig.classList.add("uhv-dragging"); });
      fig.addEventListener("dragend", () => fig.classList.remove("uhv-dragging"));
      fig.addEventListener("dragover", (e) => {
        e.preventDefault();
        const after = e.offsetX > fig.offsetWidth / 2;
        fig.classList.toggle("uhv-drop-after", after);
        fig.classList.toggle("uhv-drop-before", !after);
      });
      fig.addEventListener("dragleave", () => fig.classList.remove("uhv-drop-after", "uhv-drop-before"));
      fig.addEventListener("drop", async (e) => {
        e.preventDefault();
        const after = fig.classList.contains("uhv-drop-after");
        fig.classList.remove("uhv-drop-after", "uhv-drop-before");
        const movedId = e.dataTransfer.getData("text/plain");
        const moved = listEl.querySelector(`:scope > figure[data-id="${CSS.escape(movedId)}"]`);
        if (!moved || moved === fig) return;
        const before = [...listEl.querySelectorAll(":scope > figure[data-id]")];
        fig[after ? "after" : "before"](moved);
        const order = [...listEl.querySelectorAll(":scope > figure[data-id]")].map((f) => f.dataset.id);
        const byId = Object.fromEntries(items().map((i) => [i.id, i]));
        try { await commit(order.map((oid) => byId[oid]).filter(Boolean), "photos reordered"); }
        catch { listEl.prepend(...before); }
      });
    }

    async function addPhotos() {
      const files = await pickFiles(true);
      if (!files.length) return;
      const bad = files.map(checkFile).filter(Boolean);
      if (bad.length) status("⚠ Skipped: " + bad.join(" "), "err", 10000);
      const good = files.filter((f) => !checkFile(f));
      if (!good.length) return;
      const added = [];
      for (const [n, file] of good.entries()) {
        status(`Uploading photo ${n + 1} of ${good.length}…`, "", 0);
        try { added.push({ id: newId(), photo: await upload(await resizeOnly(file)), caption: "" }); }
        catch (err) { status(`⚠ "${file.name}" failed: ${err.message}`, "err", 10000); }
      }
      if (!added.length) return;
      try {
        await commit([...items(), ...added], `added ${added.length} photo${added.length > 1 ? "s" : ""}`);
        setTimeout(() => location.reload(), 300);
      } catch {}
    }
  }

  // ── Wire up ──
  for (const listEl of document.querySelectorAll("[data-list]")) {
    if (PERSON_TPLS.includes(listEl.getAttribute("data-tpl"))) decoratePersonList(listEl);
    else if (listEl.getAttribute("data-tpl") === "gallery") decorateGallery(listEl);
  }

  document.addEventListener("click", (e) => {
    if (!editing) return;
    if (e.target.closest(".uhv-bar, .uhv-modal-back, .uhv-menu")) return;
    if (menuEl && !e.target.closest(".uhv-menu")) closeMenu();
    if (e.target.closest("a")) e.preventDefault(); // links don't navigate while editing
    if (e.target.closest(".uhv-ui, .uhv-card-editing")) return;
    const text = e.target.closest("[data-e], [data-num]");
    if (text && !text.closest("[data-list]")) { e.preventDefault(); return startText(text); }
    const slot = e.target.closest("[data-img]");
    if (slot) { e.preventDefault(); openSlotMenu(slot); }
  }, true);

  // Leaving edit mode or the page while a field is open: save it first (blur triggers the save).
  window.addEventListener("beforeunload", () => document.activeElement?.blur?.());

  setEditing(editing);
})();

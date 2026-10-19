import { PAGES, supabaseConfig } from "../lib/config.js";
import { readAll } from "../lib/db.js";
import { query } from "../lib/http.js";
import { renderPage } from "../lib/render.js";
import { isAdminRequest } from "../lib/session.js";

// Serves every public page: the template filled with content from the database.
export default async function handler(req, res) {
  const page = query(req).get("p") || "index";
  if (!PAGES.includes(page)) {
    res.statusCode = 404;
    return res.end("Not found");
  }
  const admin = isAdminRequest(req);
  let content = {};
  if (supabaseConfig().ready) {
    try {
      content = await readAll();
    } catch (err) {
      console.error("Content could not be loaded; serving the built-in page.", err);
    }
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Not cached on the CDN, so edits show at once and the admin page is never shared.
  res.setHeader("Cache-Control", admin ? "private, no-store" : "public, max-age=0, must-revalidate");
  res.end(renderPage(page, content, { admin }));
}

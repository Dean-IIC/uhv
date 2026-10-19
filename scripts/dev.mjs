// Local server that behaves like Vercel: same rewrites, static files from public/, routes from api/.
// Usage: npm run dev   (reads .env.local), then open http://localhost:3000
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const config = JSON.parse(await readFile(path.join(root, "vercel.json"), "utf8"));
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };

function rewrite(pathname) {
  for (const r of config.rewrites) {
    const names = [];
    const re = new RegExp("^" + r.source.replace(/:(\w+)\(([^)]+)\)/g, (_, n, alt) => (names.push(n), `(${alt})`)).replace(/\./g, "\\.") + "$");
    const m = pathname.match(re);
    if (m) return names.reduce((d, n, i) => d.replace(`:${n}`, m[i + 1]), r.destination);
  }
  return null;
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const target = rewrite(url.pathname);
    const dest = new URL(target ?? req.url, "http://localhost");
    if (dest.pathname.startsWith("/api/")) {
      req.url = dest.pathname + dest.search;
      try {
        const mod = await import(path.join(root, "api", dest.pathname.slice(5) + ".js"));
        return await mod.default(req, res);
      } catch (err) {
        console.error(err);
        res.statusCode = err.code === "ERR_MODULE_NOT_FOUND" ? 404 : 500;
        return res.end("Error");
      }
    }
    const file = path.join(root, "public", path.normalize(dest.pathname).replace(/^(\.\.[/\\])+/, ""));
    try {
      const body = await readFile(file);
      res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end("Not found");
    }
  })
  .listen(process.env.PORT || 3000, () => console.log(`UHV portal on http://localhost:${process.env.PORT || 3000}`));

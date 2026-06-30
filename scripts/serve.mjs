#!/usr/bin/env node
// scripts/serve.mjs — zero-dependency static file server for the app.
// Serves the repo root so index.html + app/* load as a normal static site.
// Usage: node scripts/serve.mjs [port]
import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2]) || 4173;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(req.url.split("?")[0]);
    if (rel === "/") rel = "/index.html";
    const full = path.join(root, path.normalize(rel));
    if (!full.startsWith(root)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    const s = await stat(full).catch(() => null);
    if (!s || !s.isFile()) {
      res.writeHead(404).end("Not found");
      return;
    }
    const body = await readFile(full);
    res.writeHead(200, {
      "content-type": TYPES[path.extname(full)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
});

server.listen(port, () => {
  console.log(`Podcast Design Canvas dev server: http://localhost:${port}`);
});

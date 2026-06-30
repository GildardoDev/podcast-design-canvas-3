#!/usr/bin/env node
// scripts/preview-build.mjs — static shippability check (no bundler, no deps).
// Verifies the app is self-consistent and servable as a static site:
//  - index.html exists and references the entry module
//  - every local ES module import resolves to a real file
//  - app modules parse as valid ES modules
// Exits non-zero on any problem so a broken preview never ships.
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let problems = [];

// 1) index.html present and wired to the app entry.
const indexPath = path.join(root, "index.html");
if (!existsSync(indexPath)) {
  problems.push("index.html missing");
} else {
  const html = readFileSync(indexPath, "utf8");
  if (!/app\/ui\.js/.test(html)) problems.push("index.html does not load app/ui.js");
  if (!/<canvas/i.test(html)) problems.push("index.html has no <canvas> for the preview");
}

// 2) Walk local imports from the app entry; every one must resolve.
const entry = path.join(root, "app", "ui.js");
const seen = new Set();
function walk(file) {
  if (seen.has(file)) return;
  seen.add(file);
  if (!existsSync(file)) {
    problems.push(`missing module: ${path.relative(root, file)}`);
    return;
  }
  const src = readFileSync(file, "utf8");
  const re = /\b(?:import|export)\b[^'"`]*?from\s*['"](\.[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const dep = path.resolve(path.dirname(file), m[1]);
    walk(dep);
  }
}
if (existsSync(entry)) walk(entry);
else problems.push("app/ui.js entry missing");

// 3) Each app module must import cleanly in Node (catches syntax errors).
//    Browser-only modules (touch document/window/MediaRecorder) are guarded so
//    importing them under Node does not execute DOM code at module top-level.
const toParse = ["presets.js", "episode.js", "export-plan.js"];
for (const f of toParse) {
  const full = path.join(root, "app", f);
  if (!existsSync(full)) {
    problems.push(`missing app/${f}`);
    continue;
  }
  try {
    await import(pathToFileURL(full).href);
  } catch (e) {
    problems.push(`app/${f} failed to import: ${e.message}`);
  }
}

if (problems.length) {
  console.error("preview-build FAILED:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("preview-build OK — static app is self-consistent and servable.");

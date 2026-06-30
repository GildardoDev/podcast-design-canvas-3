// tests/export-plan.test.js — render plan derivation + cover-fit math.
import assert from "node:assert/strict";
import { createEpisode, assignSpeakerFile, setPreset } from "../app/episode.js";
import { buildExportPlan, coverRect, DEFAULT_RESOLUTIONS } from "../app/export-plan.js";

const ep = createEpisode();
assert.throws(() => buildExportPlan(ep), /not ready/);

assignSpeakerFile(ep, "host", { name: "h.webm", durationSec: 90 });
assignSpeakerFile(ep, "guest1", { name: "g.webm", durationSec: 120.4 });
setPreset(ep, "side-by-side");

const plan = buildExportPlan(ep, { resolution: "720p", fps: 30 });
assert.equal(plan.width, 1280);
assert.equal(plan.height, 720);
assert.equal(plan.fps, 30);
assert.equal(plan.durationSec, 120.4, "duration = longest track");
assert.equal(plan.frames.length, 2, "frame per assigned speaker");
assert.deepEqual(plan.audioBuckets, ["host", "guest1"], "all speakers contribute audio");
assert.equal(plan.background, "#0e1116");
assert.equal(plan.frameCount, Math.round(120.4 * 30));

// 1080p + fps clamp (15..60).
const hd = buildExportPlan(ep, { resolution: "1080p", fps: 999 });
assert.equal(hd.width, DEFAULT_RESOLUTIONS["1080p"].width);
assert.equal(hd.fps, 60, "fps clamps to 60");
assert.equal(buildExportPlan(ep, { fps: 1 }).fps, 15, "fps clamps to 15");

// cover-fit: fills the rect, crops overflow, stays centered.
const frame = { x: 10, y: 20, w: 200, h: 100 };
const c = coverRect(frame, 400, 400); // square source into 2:1 rect
assert.equal(c.dw, 200);
assert.equal(c.dh, 100);
assert.ok(c.sw <= 400 && c.sh <= 400, "source crop within bounds");
assert.ok(Math.abs(c.sx - (400 - c.sw) / 2) < 0.001, "horizontal crop centered");

console.log("export-plan.test.js OK");

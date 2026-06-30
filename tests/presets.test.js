// tests/presets.test.js — layout math for every preset.
import assert from "node:assert/strict";
import { PRESETS, getPreset, SPEAKER_BUCKETS } from "../app/presets.js";

const W = 1280;
const H = 720;

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

for (const preset of PRESETS) {
  for (const n of [2, 3]) {
    const buckets = SPEAKER_BUCKETS.slice(0, n);
    const frames = preset.layout(buckets, W, H);

    assert.equal(frames.length, n, `${preset.id}: one frame per speaker (${n})`);

    // Every frame is inside the canvas with positive area.
    for (const f of frames) {
      assert.ok(f.w > 0 && f.h > 0, `${preset.id}: positive frame size`);
      assert.ok(f.x >= 0 && f.y >= 0, `${preset.id}: frame within top-left`);
      assert.ok(f.x + f.w <= W + 1, `${preset.id}: frame within width`);
      assert.ok(f.y + f.h <= H + 1, `${preset.id}: frame within height`);
      assert.ok(buckets.includes(f.bucket), `${preset.id}: frame maps to a real bucket`);
    }

    // No two speaker frames overlap.
    for (let i = 0; i < frames.length; i++) {
      for (let j = i + 1; j < frames.length; j++) {
        assert.ok(!overlaps(frames[i], frames[j]), `${preset.id}: frames ${i}/${j} must not overlap`);
      }
    }
  }
}

assert.equal(getPreset("side-by-side").id, "side-by-side");
assert.equal(getPreset("nope"), null);
assert.ok(PRESETS.length >= 3, "at least three preset styles offered");

console.log("presets.test.js OK");

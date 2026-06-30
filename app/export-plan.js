// app/export-plan.js
// DOM-free bridge between the episode model and the canvas compositor/exporter.
// Produces a concrete, testable render plan: output dimensions, fps, duration,
// the per-speaker frame rects from the chosen preset, and which buckets carry
// audio. The live preview and the MediaRecorder export consume the SAME plan,
// so what a creator previews is what gets exported.

import { assignedBuckets, episodeDurationSec, canCompose } from "./episode.js";
import { getPreset } from "./presets.js";

export const DEFAULT_RESOLUTIONS = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
};

export function buildExportPlan(episode, opts = {}) {
  if (!canCompose(episode)) {
    throw new Error("Episode is not ready to compose (need 2+ speakers and a preset).");
  }
  const res = DEFAULT_RESOLUTIONS[opts.resolution] ||
    (opts.width && opts.height ? { width: opts.width, height: opts.height } : DEFAULT_RESOLUTIONS["720p"]);
  const width = res.width;
  const height = res.height;
  const fps = clampFps(opts.fps);
  const preset = getPreset(episode.presetId);
  const buckets = assignedBuckets(episode);
  const frames = preset.layout(buckets, width, height);
  const durationSec = round2(episodeDurationSec(episode));

  return {
    presetId: preset.id,
    presetName: preset.name,
    background: preset.background,
    accent: preset.accent,
    width,
    height,
    fps,
    durationSec,
    frameCount: Math.max(1, Math.round(durationSec * fps)),
    frames, // [{ bucket, x, y, w, h }]
    audioBuckets: buckets.slice(), // every assigned speaker contributes audio
  };
}

// Inset a source video of size (sw, sh) into a frame rect using cover-fit
// (fill the rect, center-crop overflow) so real frames never letterbox-distort.
export function coverRect(frame, sw, sh) {
  if (!sw || !sh) return { dx: frame.x, dy: frame.y, dw: frame.w, dh: frame.h, sx: 0, sy: 0, sw: 0, sh: 0 };
  const scale = Math.max(frame.w / sw, frame.h / sh);
  const cropW = frame.w / scale;
  const cropH = frame.h / scale;
  const sx = (sw - cropW) / 2;
  const sy = (sh - cropH) / 2;
  return { sx, sy, sw: cropW, sh: cropH, dx: frame.x, dy: frame.y, dw: frame.w, dh: frame.h };
}

function clampFps(fps) {
  const n = Number(fps) || 30;
  return Math.min(60, Math.max(15, Math.round(n)));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

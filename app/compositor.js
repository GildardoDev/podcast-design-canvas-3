// app/compositor.js  (browser)
// Draws REAL uploaded video frames onto a 2D canvas using the layout from the
// export plan. The same draw routine powers the live preview and the exported
// frames, so the preview is an honest representation of the export — no CSS
// placeholder circles, actual pixels from the uploaded media.

import { coverRect } from "./export-plan.js";
import { BUCKET_LABELS } from "./presets.js";

// Draw one composed frame. `videos` maps bucket -> HTMLVideoElement.
// Returns true if at least one real video frame was painted this call.
export function drawComposite(ctx, plan, videos, { title } = {}) {
  const { width, height, background, accent, frames } = plan;
  ctx.save();

  // Background.
  ctx.fillStyle = background || "#0e1116";
  ctx.fillRect(0, 0, width, height);

  let paintedReal = false;
  for (const f of frames) {
    const v = videos[f.bucket];
    roundRectPath(ctx, f.x, f.y, f.w, f.h, Math.round(Math.min(f.w, f.h) * 0.04));
    ctx.save();
    ctx.clip();

    if (v && v.readyState >= 2 && v.videoWidth > 0) {
      const c = coverRect(f, v.videoWidth, v.videoHeight);
      ctx.drawImage(v, c.sx, c.sy, c.sw, c.sh, c.dx, c.dy, c.dw, c.dh);
      paintedReal = true;
    } else {
      // Fallback only while a frame is still decoding.
      ctx.fillStyle = "#1b2030";
      ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.fillStyle = "#5b667e";
      ctx.font = `${Math.round(f.h * 0.07)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("loading…", f.x + f.w / 2, f.y + f.h / 2);
    }
    ctx.restore();

    // Frame border.
    roundRectPath(ctx, f.x, f.y, f.w, f.h, Math.round(Math.min(f.w, f.h) * 0.04));
    ctx.lineWidth = Math.max(2, Math.round(width / 640));
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.stroke();

    // Speaker name chip.
    drawChip(ctx, f, BUCKET_LABELS[f.bucket] || f.bucket, accent);
  }

  // Title bar.
  if (title) {
    const barH = Math.round(height * 0.06);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, width, barH);
    ctx.fillStyle = "#e9edf6";
    ctx.font = `600 ${Math.round(barH * 0.5)}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(title, Math.round(width * 0.02), barH / 2);
  }

  ctx.restore();
  return paintedReal;
}

function drawChip(ctx, f, label, accent) {
  const pad = Math.round(Math.min(f.w, f.h) * 0.03);
  const fs = Math.max(12, Math.round(f.h * 0.06));
  ctx.font = `600 ${fs}px system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const tw = ctx.measureText(label).width;
  const cw = tw + pad * 2;
  const ch = fs + pad;
  const cx = f.x + pad;
  const cy = f.y + f.h - pad - ch;
  roundRectPath(ctx, cx, cy, cw, ch, ch / 2);
  ctx.fillStyle = "rgba(8,10,14,0.66)";
  ctx.fill();
  ctx.fillStyle = accent || "#5b8cff";
  ctx.fillRect(cx + pad * 0.5, cy + ch / 2 - fs * 0.28, Math.max(3, fs * 0.18), fs * 0.56);
  ctx.fillStyle = "#f2f5fb";
  ctx.fillText(label, cx + pad * 0.5 + Math.max(3, fs * 0.18) + 6, cy + ch - pad * 0.9);
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

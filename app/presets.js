// app/presets.js
// DOM-free preset + layout model. Pure functions only so the same layout math
// drives the live canvas preview, the MediaRecorder export, and the unit tests.

export const SPEAKER_BUCKETS = ["host", "guest1", "guest2"];

export const BUCKET_LABELS = {
  host: "Host",
  guest1: "Guest 1",
  guest2: "Guest 2",
};

// Each preset describes a long-form visual identity. `layout(buckets, w, h)`
// returns one frame rect per assigned speaker bucket, in canvas pixels.
export const PRESETS = [
  {
    id: "side-by-side",
    name: "Side by Side",
    description: "Equal columns — balanced conversation framing.",
    pacing: "steady",
    background: "#0e1116",
    accent: "#5b8cff",
    layout: sideBySide,
  },
  {
    id: "spotlight",
    name: "Host Spotlight",
    description: "Large host frame with guests stacked alongside.",
    pacing: "host-led",
    background: "#121017",
    accent: "#ff7a59",
    layout: spotlight,
  },
  {
    id: "stacked-band",
    name: "Stacked Band",
    description: "Full-width speaker bands — clean vertical rhythm.",
    pacing: "even",
    background: "#0c1412",
    accent: "#39d98a",
    layout: stackedBand,
  },
];

export function getPreset(id) {
  return PRESETS.find((p) => p.id === id) || null;
}

const PAD = 0.025; // fraction of the smaller dimension used as gutter

function gutter(w, h) {
  return Math.round(Math.min(w, h) * PAD);
}

// Equal columns across the width.
function sideBySide(buckets, w, h) {
  const n = Math.max(buckets.length, 1);
  const g = gutter(w, h);
  const cellW = Math.floor((w - g * (n + 1)) / n);
  const cellH = h - g * 2;
  return buckets.map((bucket, i) => ({
    bucket,
    x: g + i * (cellW + g),
    y: g,
    w: cellW,
    h: cellH,
  }));
}

// First bucket large on the left; the rest stacked on the right.
function spotlight(buckets, w, h) {
  const g = gutter(w, h);
  if (buckets.length <= 1) return sideBySide(buckets, w, h);
  const bigW = Math.floor((w - g * 3) * 0.62);
  const sideW = w - g * 3 - bigW;
  const rest = buckets.slice(1);
  const sideH = Math.floor((h - g * (rest.length + 1)) / rest.length);
  const frames = [
    { bucket: buckets[0], x: g, y: g, w: bigW, h: h - g * 2 },
  ];
  rest.forEach((bucket, i) => {
    frames.push({
      bucket,
      x: g * 2 + bigW,
      y: g + i * (sideH + g),
      w: sideW,
      h: sideH,
    });
  });
  return frames;
}

// Full-width horizontal bands.
function stackedBand(buckets, w, h) {
  const n = Math.max(buckets.length, 1);
  const g = gutter(w, h);
  const cellH = Math.floor((h - g * (n + 1)) / n);
  const cellW = w - g * 2;
  return buckets.map((bucket, i) => ({
    bucket,
    x: g,
    y: g + i * (cellH + g),
    w: cellW,
    h: cellH,
  }));
}

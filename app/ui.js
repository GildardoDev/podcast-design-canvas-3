// app/ui.js  (browser entry)
// Wires the import -> assign -> style -> preview -> export workflow to the DOM,
// driving the real-frame compositor and the MediaRecorder exporter.

import { SPEAKER_BUCKETS, BUCKET_LABELS, PRESETS } from "./presets.js";
import {
  createEpisode,
  assignSpeakerFile,
  setSocialLink,
  setPreset,
  canCompose,
  readinessReason,
  assignedBuckets,
} from "./episode.js";
import { buildExportPlan } from "./export-plan.js";
import { drawComposite } from "./compositor.js";
import { exportEpisode, downloadBlob } from "./exporter.js";

const episode = createEpisode({ title: "Episode 1" });
const videos = {}; // bucket -> HTMLVideoElement (decoding the uploaded file)
let plan = null;
let previewRAF = 0;

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const ctx = stage.getContext("2d");

// ---- build speaker bucket cards ----
const bucketsEl = $("buckets");
for (const bucket of SPEAKER_BUCKETS) {
  const card = document.createElement("div");
  card.className = "bucket";
  card.innerHTML = `
    <div class="bucket-head">${BUCKET_LABELS[bucket]}</div>
    <input type="file" accept="video/*" data-bucket="${bucket}" class="file" />
    <input type="url" placeholder="social link (optional)" data-link="${bucket}" class="link" />
    <div class="bucket-status" data-status="${bucket}">No file</div>`;
  bucketsEl.appendChild(card);
}

bucketsEl.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.dataset.bucket && t.files && t.files[0]) {
    await loadSpeakerFile(t.dataset.bucket, t.files[0]);
  } else if (t.dataset.link) {
    setSocialLink(episode, t.dataset.link, t.value.trim());
  }
});

async function loadSpeakerFile(bucket, file) {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.preload = "auto";
  v.src = url;
  v.playsInline = true;
  v.muted = true; // muted so autoplay/decoding is allowed; unmuted during export
  // Wait for a genuinely decoded frame (readyState >= HAVE_CURRENT_DATA) so the
  // composed preview paints real pixels rather than the loading fallback.
  await new Promise((res) => {
    const ok = () => { if (v.readyState >= 2) res(); };
    v.onloadeddata = ok;
    v.oncanplay = ok;
    v.onerror = res;
    setTimeout(res, 6000);
  });
  // Seek a hair in so a frame is present even before playback starts.
  await new Promise((res) => {
    v.onseeked = res;
    try { v.currentTime = 0.05; } catch { res(); }
    setTimeout(res, 1500);
  });
  videos[bucket] = v;
  assignSpeakerFile(episode, bucket, {
    name: file.name,
    size: file.size,
    type: file.type,
    durationSec: isFinite(v.duration) ? v.duration : 0,
  });
  $(`[data-status="${bucket}"]`).textContent =
    `${file.name} · ${isFinite(v.duration) ? v.duration.toFixed(1) + "s" : "loaded"}`;
  $(`[data-status="${bucket}"]`).classList.add("ok");
  refreshReadiness();
}

// ---- preset picker ----
const presetsEl = $("presets");
for (const p of PRESETS) {
  const b = document.createElement("button");
  b.className = "preset";
  b.dataset.preset = p.id;
  b.innerHTML = `<strong>${p.name}</strong><span>${p.description}</span>`;
  b.addEventListener("click", () => {
    setPreset(episode, p.id);
    [...presetsEl.children].forEach((c) => c.classList.toggle("sel", c.dataset.preset === p.id));
    refreshReadiness();
  });
  presetsEl.appendChild(b);
}

function refreshReadiness() {
  const ready = canCompose(episode);
  $("compose").disabled = !ready;
  $("readiness").textContent = ready
    ? `Ready: ${assignedBuckets(episode).length} speakers, “${episode.presetId}” style.`
    : readinessReason(episode) || "";
}

// ---- compose preview ----
$("compose").addEventListener("click", () => composePreview());

function composePreview() {
  if (!canCompose(episode)) return;
  plan = buildExportPlan(episode, { resolution: $("resolution").value, fps: 30 });
  stage.width = plan.width;
  stage.height = plan.height;
  $("canvasEmpty").hidden = true;
  setStep(3);
  drawOnce();
  $("play").disabled = false;
  $("export").disabled = false;
}

$("resolution").addEventListener("change", () => {
  if (plan) composePreview();
});

function drawOnce() {
  if (!plan) return;
  drawComposite(ctx, plan, videos, { title: episode.title });
}

// ---- live preview playback ----
$("play").addEventListener("click", async () => {
  if (!plan) return;
  cancelAnimationFrame(previewRAF);
  for (const b of plan.audioBuckets) {
    const v = videos[b];
    if (!v) continue;
    v.muted = true;
    try { v.currentTime = 0; await v.play(); } catch {}
  }
  const loop = () => {
    drawComposite(ctx, plan, videos, { title: episode.title });
    const playing = plan.audioBuckets.some((b) => videos[b] && !videos[b].ended);
    if (playing) previewRAF = requestAnimationFrame(loop);
  };
  previewRAF = requestAnimationFrame(loop);
});

// ---- export ----
$("export").addEventListener("click", async () => {
  if (!plan) return;
  cancelAnimationFrame(previewRAF);
  const btn = $("export");
  btn.disabled = true;
  $("title") && (episode.title = $("title").value || episode.title);
  $("progress").hidden = false;
  $("result").hidden = true;
  try {
    const out = await exportEpisode(stage, plan, videos, {
      title: episode.title,
      maxSeconds: plan.durationSec,
      onProgress: (p) => ($("bar").style.width = Math.round(p * 100) + "%"),
    });
    const fname = (episode.title || "episode").replace(/[^\w.-]+/g, "_") + ".webm";
    downloadBlob(out.url, fname);
    $("result").hidden = false;
    $("result").innerHTML =
      `Exported <strong>${fname}</strong> — ${(out.bytes / 1024).toFixed(0)} KB, ` +
      `${plan.width}×${plan.height}, ~${plan.durationSec}s. ` +
      `<a href="${out.url}" download="${fname}">Download again</a>`;
    window.__exportResult = { bytes: out.bytes, mimeType: out.mimeType, url: out.url, fname };
  } catch (err) {
    $("result").hidden = false;
    $("result").textContent = "Export failed: " + (err && err.message);
  } finally {
    btn.disabled = false;
  }
});

// ---- step indicator ----
function setStep(n) {
  document.querySelectorAll(".step").forEach((s) =>
    s.classList.toggle("is-active", Number(s.dataset.step) <= n)
  );
}
$("title").addEventListener("input", (e) => {
  episode.title = e.target.value || "Episode";
  if (plan) drawOnce();
});

refreshReadiness();
// Expose hooks for headless verification (does not affect the UI).
window.__pdc = { episode, videos, get plan() { return plan; }, composePreview, drawOnce };

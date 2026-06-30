// app/exporter.js  (browser)
// Real export: capture the live composited canvas as a video track, mix every
// speaker's audio into one track via WebAudio, record the combined stream with
// MediaRecorder, and hand back a downloadable video Blob. This is a genuine
// rendered file (playable / ffprobe-able), not a mock — it uses the uploaded
// media bytes that are already decoding in the <video> elements.

import { drawComposite } from "./compositor.js";

export function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return "video/webm";
  for (const t of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {}
  }
  return "video/webm";
}

// Compose + record. `videos` maps bucket -> HTMLVideoElement (already loaded).
// Resolves with { blob, url, mimeType, durationMs, bytes }.
export async function exportEpisode(canvas, plan, videos, opts = {}) {
  const ctx = canvas.getContext("2d");
  const onProgress = opts.onProgress || (() => {});
  const maxSeconds = Math.max(0.5, opts.maxSeconds || plan.durationSec || 5);

  // --- audio: mix all speaker tracks into one MediaStream audio track ---
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;
  let audioDest = null;
  const audioTracks = [];
  if (AudioCtx) {
    audioCtx = new AudioCtx();
    if (audioCtx.state === "suspended") {
      try { await audioCtx.resume(); } catch {}
    }
    audioDest = audioCtx.createMediaStreamDestination();
    for (const bucket of plan.audioBuckets) {
      const v = videos[bucket];
      if (!v) continue;
      try {
        const src = audioCtx.createMediaElementSource(v);
        const gain = audioCtx.createGain();
        gain.gain.value = 1 / Math.max(1, plan.audioBuckets.length);
        src.connect(gain).connect(audioDest);
      } catch {
        // a video with no audio track, or already-connected source — skip it
      }
    }
    audioTracks.push(...audioDest.stream.getAudioTracks());
  }

  // --- video: capture the canvas at the plan fps ---
  const canvasStream = canvas.captureStream(plan.fps);
  const combined = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);

  const mimeType = pickMimeType();
  const chunks = [];
  const recorder = new MediaRecorder(combined, { mimeType });
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };

  const started = performance.now();
  const done = new Promise((resolve) => (recorder.onstop = resolve));

  // Rewind + play every speaker video in sync so real frames + audio flow.
  for (const bucket of plan.audioBuckets) {
    const v = videos[bucket];
    if (!v) continue;
    try { v.currentTime = 0; } catch {}
    v.muted = false;
    try { await v.play(); } catch {}
  }

  recorder.start(250); // gather data in timeslices so we always get chunks

  // Drive the composite while recording. We use a timer rather than
  // requestAnimationFrame because rAF is throttled (or paused) when the page
  // is backgrounded or running headless, which would freeze the captured
  // canvas and yield an empty recording. A fixed-interval draw guarantees the
  // canvas keeps updating so captureStream always has fresh frames.
  await new Promise((resolve) => {
    const frameMs = Math.max(10, Math.round(1000 / plan.fps));
    const timer = setInterval(() => {
      const elapsed = (performance.now() - started) / 1000;
      drawComposite(ctx, plan, videos, { title: opts.title });
      onProgress(Math.min(1, elapsed / maxSeconds));
      const allEnded = plan.audioBuckets.every((b) => !videos[b] || videos[b].ended);
      if (elapsed >= maxSeconds || allEnded) {
        clearInterval(timer);
        resolve();
      }
    }, frameMs);
  });

  // Flush + stop.
  try { recorder.requestData(); } catch {}
  recorder.stop();
  await done;
  for (const b of plan.audioBuckets) {
    const v = videos[b];
    if (v) { try { v.pause(); } catch {} }
  }
  if (audioCtx) { try { await audioCtx.close(); } catch {} }

  const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
  const url = URL.createObjectURL(blob);
  return { blob, url, mimeType, durationMs: performance.now() - started, bytes: blob.size };
}

// Trigger a browser download of an exported blob.
export function downloadBlob(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "episode.webm";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

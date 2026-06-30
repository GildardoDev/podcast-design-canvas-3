// app/episode.js
// DOM-free episode model. Holds the creator's setup (speaker files, social
// links, chosen preset) and the readiness gates the UI and export rely on.
// No browser APIs here so it runs identically in Node tests and the app.

import { SPEAKER_BUCKETS, getPreset } from "./presets.js";

export function createEpisode(init = {}) {
  return {
    title: init.title || "Untitled Episode",
    speakers: {}, // bucket -> { name, size, type, durationSec }
    socialLinks: {}, // bucket -> url
    presetId: init.presetId || null,
  };
}

// Attach an uploaded file's metadata to a speaker bucket.
export function assignSpeakerFile(episode, bucket, file) {
  if (!SPEAKER_BUCKETS.includes(bucket)) {
    throw new Error(`Unknown speaker bucket: ${bucket}`);
  }
  if (!file || !file.name) {
    throw new Error("A file with a name is required");
  }
  episode.speakers[bucket] = {
    name: file.name,
    size: Number(file.size) || 0,
    type: file.type || "",
    durationSec: Number(file.durationSec) || 0,
  };
  return episode;
}

export function setSocialLink(episode, bucket, url) {
  if (!SPEAKER_BUCKETS.includes(bucket)) {
    throw new Error(`Unknown speaker bucket: ${bucket}`);
  }
  if (url) episode.socialLinks[bucket] = url;
  else delete episode.socialLinks[bucket];
  return episode;
}

export function setPreset(episode, presetId) {
  if (presetId && !getPreset(presetId)) {
    throw new Error(`Unknown preset: ${presetId}`);
  }
  episode.presetId = presetId;
  return episode;
}

// Buckets that have an assigned file, in canonical order.
export function assignedBuckets(episode) {
  return SPEAKER_BUCKETS.filter((b) => episode.speakers[b]);
}

// Longest speaker track defines the episode length (handles hour-plus episodes).
export function episodeDurationSec(episode) {
  const ds = assignedBuckets(episode).map(
    (b) => episode.speakers[b].durationSec || 0
  );
  return ds.length ? Math.max(...ds) : 0;
}

// MVP gate: at least two assigned speakers and a chosen preset.
export function canCompose(episode) {
  return assignedBuckets(episode).length >= 2 && !!getPreset(episode.presetId);
}

// Why the compose/export action is not yet available (for UI hints).
export function readinessReason(episode) {
  if (assignedBuckets(episode).length < 2) {
    return "Upload and assign at least two speaker videos.";
  }
  if (!getPreset(episode.presetId)) return "Choose a preset visual style.";
  return null;
}

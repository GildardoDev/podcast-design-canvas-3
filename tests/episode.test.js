// tests/episode.test.js — episode model + readiness gates.
import assert from "node:assert/strict";
import {
  createEpisode,
  assignSpeakerFile,
  setSocialLink,
  setPreset,
  assignedBuckets,
  episodeDurationSec,
  canCompose,
  readinessReason,
} from "../app/episode.js";

const ep = createEpisode({ title: "Ep 1" });
assert.equal(ep.title, "Ep 1");
assert.equal(canCompose(ep), false);
assert.match(readinessReason(ep), /two speaker videos/);

// One speaker assigned: still not ready.
assignSpeakerFile(ep, "host", { name: "host.webm", size: 1000, type: "video/webm", durationSec: 3600 });
assert.deepEqual(assignedBuckets(ep), ["host"]);
assert.equal(canCompose(ep), false);

// Two speakers but no preset: gated on preset.
assignSpeakerFile(ep, "guest1", { name: "g1.webm", size: 2000, type: "video/webm", durationSec: 1800 });
assert.deepEqual(assignedBuckets(ep), ["host", "guest1"]);
assert.equal(canCompose(ep), false);
assert.match(readinessReason(ep), /preset/i);

// Duration is the longest track (hour-plus safe).
assert.equal(episodeDurationSec(ep), 3600);

// Add preset -> ready.
setPreset(ep, "spotlight");
assert.equal(canCompose(ep), true);
assert.equal(readinessReason(ep), null);

// Social links and validation.
setSocialLink(ep, "host", "https://x.com/host");
assert.equal(ep.socialLinks.host, "https://x.com/host");
assert.throws(() => assignSpeakerFile(ep, "nope", { name: "x" }), /Unknown speaker bucket/);
assert.throws(() => setPreset(ep, "missing"), /Unknown preset/);
assert.throws(() => assignSpeakerFile(ep, "guest2", {}), /file with a name/);

console.log("episode.test.js OK");

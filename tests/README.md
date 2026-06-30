# Tests & verification

Two layers, matching `.builderloops/verify.json`:

## 1. Zero-dependency unit tests (the gate)
```
node scripts/run-tests.mjs     # runs every tests/*.test.js in its own node process
node scripts/preview-build.mjs # static shippability: index.html wired, imports resolve, modules parse
```
These cover the DOM-free models that the live preview and the export share:
- `presets.test.js` — every preset layout returns one in-bounds, non-overlapping frame per speaker.
- `episode.test.js` — speaker assignment, social links, duration = longest track, the compose/export readiness gate.
- `export-plan.test.js` — render-plan dimensions/fps/duration/frames and the cover-fit crop math.

## 2. Real product proof (browser, run manually)
```
node tests/browser-export-flow.mjs
```
This is **not** a `*.test.js` file, so the zero-dep gate does not run it. It needs a
Chrome/Chromium binary (set `CHROME_PATH` if it is not at a standard location) and
**skips cleanly (exit 0) when none is present**, so it never breaks a build.

It serves the app, generates two short speaker clips in-page, then drives the *actual*
`app/*` pipeline — import → assign to Host/Guest buckets → pick a preset → compose →
export — and asserts that:
- the composed preview paints **real uploaded frames** (it pixel-samples the host frame
  and confirms it is the uploaded clip's color, not the loading placeholder), and
- the MediaRecorder export is a **genuinely playable video**: the exported blob loads back
  into a `<video>` at the planned dimensions (1280×720).

Verified locally with system Google Chrome: real-frame preview confirmed and a ~145 KB
playable 1280×720 WebM produced from the uploaded media. To verify the artifact yourself,
export from the running app (`npm start`, open the page, upload two videos, compose,
Export video) and play the downloaded file or inspect it with `ffprobe`.

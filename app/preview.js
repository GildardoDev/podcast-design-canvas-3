// app/preview.js
// Renders the composed preview from the REAL uploaded video pixels. Each speaker
// is a live <video> element backed by an object URL of the uploaded file; the
// selected preset positions them on a 16:9 stage with CSS percentages. There is
// no canvas and no placeholder — what you see is the decoded uploaded media.
//
// Playback is synchronized: a single Play/Pause/restart drives every speaker
// video together, and looping keeps the composed preview alive for inspection.
// Classic script — exposed on window.PDC.preview.
(function () {
  const PDC = (window.PDC = window.PDC || {});
  const { getPreset } = PDC.presets;

  // A Preview owns the live <video> elements for the session so that uploaded
  // media survives re-layouts, preset switches, and other UI interaction. We
  // create one <video> per bucket on first upload and reuse it thereafter.
  function createPreview(stageEl) {
    const videos = {}; // bucket -> HTMLVideoElement
    let playing = false;

    function ensureVideo(bucket) {
      let v = videos[bucket];
      if (!v) {
        v = document.createElement("video");
        v.muted = true; // muted is required for programmatic autoplay
        v.loop = true;
        v.autoplay = true; // re-attaching on a preset switch auto-resumes, so a
        v.playsInline = true; // layout change never leaves a paused/black frame
        v.setAttribute("playsinline", "");
        v.preload = "auto";
        v.dataset.speaker = bucket;
        videos[bucket] = v;
      }
      return v;
    }

    // Point a bucket's video at a fresh object URL, revoking any previous one.
    function setSource(bucket, file) {
      const v = ensureVideo(bucket);
      if (v.dataset.objectUrl) URL.revokeObjectURL(v.dataset.objectUrl);
      const url = URL.createObjectURL(file);
      v.dataset.objectUrl = url;
      v.src = url;
      v.load();
      // Force a decoded frame to paint as soon as the media is ready, so the
      // speaker shows real pixels immediately instead of a black box even if
      // autoplay has not produced a frame yet.
      v.addEventListener(
        "loadeddata",
        () => {
          if (v.currentTime < 0.01) {
            try { v.currentTime = 0.05; } catch (e) { /* not seekable yet */ }
          }
        },
        { once: true },
      );
      return v;
    }

    function clear(bucket) {
      const v = videos[bucket];
      if (v && v.dataset.objectUrl) URL.revokeObjectURL(v.dataset.objectUrl);
      delete videos[bucket];
    }

    // Lay the assigned speaker videos onto the stage using the preset geometry.
    // A preset switch only REPOSITIONS existing frames (and the live <video>
    // elements inside them) — it never tears down and rebuilds the stage. That
    // keeps each speaker video continuously attached and playing, so switching
    // layouts can't flash a black/blank frame (the regression #41 targets).
    function render(episode) {
      const buckets = PDC.episode.assignedBuckets(episode);
      const preset = getPreset(episode.presetId) || PDC.presets.PRESETS[0];
      const rects = preset.layout(buckets.length);

      stageEl.dataset.preset = preset.id;
      stageEl.dataset.speakers = String(buckets.length);

      // Drop only frames whose speaker is no longer present.
      const wanted = new Set(buckets);
      [...stageEl.querySelectorAll(".speaker-frame")].forEach((f) => {
        if (!wanted.has(f.dataset.speaker)) f.remove();
      });

      buckets.forEach((bucket, i) => {
        const rect = rects[i] || rects[rects.length - 1];
        let frame = stageEl.querySelector('.speaker-frame[data-speaker="' + bucket + '"]');
        if (!frame) {
          frame = document.createElement("div");
          frame.className = "speaker-frame";
          frame.dataset.speaker = bucket;
          frame.appendChild(ensureVideo(bucket)); // persistent <video>, reused across layouts
          const tag = document.createElement("span");
          tag.className = "speaker-tag";
          tag.dataset.speakerTag = bucket;
          frame.appendChild(tag);
        }
        // Reposition in place (no detach => the video keeps painting).
        frame.style.left = rect.x + "%";
        frame.style.top = rect.y + "%";
        frame.style.width = rect.w + "%";
        frame.style.height = rect.h + "%";
        // Keep the social-derived speaker name current.
        frame.querySelector(".speaker-tag").textContent = PDC.episode.speakerName(episode, bucket);
        // Keep DOM order == speaker order (moving an attached node doesn't reset it).
        stageEl.appendChild(frame);
      });

      // Keep playing across re-layout so a preset switch doesn't freeze the preview.
      if (playing) play();
      return buckets.length;
    }

    function play() {
      playing = true;
      Object.values(videos).forEach((v) => {
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      });
    }

    function pause() {
      playing = false;
      Object.values(videos).forEach((v) => v.pause());
    }

    function restart() {
      Object.values(videos).forEach((v) => {
        try {
          v.currentTime = 0;
        } catch (e) {
          /* not yet seekable; ignore */
        }
      });
      play();
    }

    function setMuted(muted) {
      Object.values(videos).forEach((v) => (v.muted = muted));
    }

    return {
      setSource,
      clear,
      render,
      play,
      pause,
      restart,
      setMuted,
      isPlaying: () => playing,
    };
  }

  PDC.preview = { createPreview };
})();

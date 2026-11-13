// extension/content-scripts/smart-rewind.js
//
// Week 10 Module B: smart rewind.
//
// When a word is looked up during playback, the video steps back a few
// seconds, so the learner can hear the sentence again. The video keeps playing.
// Live streams are left alone, because they have no fixed timeline to step back on.
//
// Loaded before word-lookup.js (see manifest.json), so it is available there.

const REWIND_SECONDS = 4;

// The time to jump back to: never before the start of the video.
function rewindTarget(currentTime, seconds = REWIND_SECONDS) {
  return Math.max(0, currentTime - seconds);
}

// Steps the video back. Returns true if it did, false if it was skipped
// (no video, or a live stream with no finite length).
function applySmartRewind(videoEl, seconds = REWIND_SECONDS) {
  if (!videoEl || !Number.isFinite(videoEl.duration)) return false;
  videoEl.currentTime = rewindTarget(videoEl.currentTime, seconds);
  return true;
}

if (typeof module !== "undefined") {
  module.exports = { REWIND_SECONDS, rewindTarget, applySmartRewind };
}

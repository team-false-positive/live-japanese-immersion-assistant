// content-scripts/watch-history.js
//
// Week 5 Module B — Watch History & Resume.
//
// Tracks video ID, platform, and last-watched timestamp per video, and
// resumes playback from where you left off when you return to a video.
//
// This talks to background.js (not storage.js directly) because
// storage.js is an ES module, and background.js is already the
// project's "central message hub" for exactly this kind of thing.

(function () {
  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("youtube.com")) return "youtube";
    if (host.includes("netflix.com")) return "netflix";
    if (host.includes("hotstar.com")) return "hotstar";
    return "unknown";
  }

  function getVideoId(platform) {
    const url = new URL(window.location.href);

    if (platform === "youtube") {
      // Normal watch pages: youtube.com/watch?v=XXXXXXXXXXX
      return url.searchParams.get("v") || url.pathname;
    }

    if (platform === "netflix") {
      // Netflix watch URLs look like: netflix.com/watch/81234567
      const match = url.pathname.match(/\/watch\/(\d+)/);
      return match ? match[1] : url.pathname;
    }

    // Hotstar / anything else: the URL path is a reasonably stable ID.
    return url.pathname;
  }

  const platform = detectPlatform();
  const videoId = getVideoId(platform);
  console.log("[LJIA] watch-history.js tracking:", { platform, videoId });

  let videoEl = null;
  let hasResumed = false;
  const SAVE_INTERVAL_MS = 5000;
  const MIN_RESUME_SECONDS = 5; // don't bother "resuming" the first few seconds

  function resumePlayback() {
    if (hasResumed || !videoEl) return;

    chrome.runtime.sendMessage({ type: "GET_WATCH_PROGRESS", videoId }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("[LJIA] Could not fetch watch progress:", chrome.runtime.lastError.message);
        hasResumed = true;
        return;
      }

      const progress = response && response.progress;
      if (progress && progress.lastPosition > MIN_RESUME_SECONDS) {
        videoEl.currentTime = progress.lastPosition;
        console.log(
          "[LJIA] Resumed",
          videoId,
          "at",
          progress.lastPosition.toFixed(1),
          "seconds"
        );
      }
      hasResumed = true;
    });
  }

  function saveProgress() {
    if (!videoEl || videoEl.currentTime === 0) return;

    chrome.runtime.sendMessage({
      type: "SAVE_WATCH_PROGRESS",
      videoId,
      platform,
      timestampSeconds: videoEl.currentTime,
    });
  }

  function attachToVideo(video) {
    videoEl = video;
    console.log("[LJIA] Video element found, attaching watch-history tracking.");

    // Resume as soon as we can safely set currentTime.
    if (videoEl.readyState >= 1) {
      resumePlayback();
    } else {
      videoEl.addEventListener("loadedmetadata", resumePlayback, { once: true });
    }

    // Save progress periodically while playing...
    setInterval(saveProgress, SAVE_INTERVAL_MS);

    // ...and immediately on pause or when leaving the page, so we don't
    // lose up to SAVE_INTERVAL_MS seconds of progress.
    videoEl.addEventListener("pause", saveProgress);
    window.addEventListener("beforeunload", saveProgress);
  }

  // Netflix/YouTube are single-page apps — the <video> element might not
  // exist yet the instant this script runs, so watch for it to appear.
  const existingVideo = document.querySelector("video");
  if (existingVideo) {
    attachToVideo(existingVideo);
  } else {
    const videoWatcher = new MutationObserver(() => {
      const video = document.querySelector("video");
      if (video) {
        videoWatcher.disconnect();
        attachToVideo(video);
      }
    });
    videoWatcher.observe(document.body, { childList: true, subtree: true });
  }

  // TODO (once Week 4 Module B's popup is finished): wire its "save word"
  // button to also send a { type: "SAVE_WORD", word, data } message here,
  // so words get linked to this same videoId/timestamp automatically.
})();

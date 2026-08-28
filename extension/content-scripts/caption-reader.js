// content-scripts/caption-reader.js
//
// This file gets injected directly into the video page (Netflix, Hotstar,
// YouTube — see the "matches" list in manifest.json) as soon as the page
// is idle. Anything you write here can read and touch that page's DOM,
// same as a browser extension's DevTools console could.
//
// Module C (Caption-Track Reader): detects the platform's existing
// subtitle element and reads its text live as it changes, via DOM
// observation only — no video pixels are touched.

console.log("[LJIA] caption-reader.js injected on:", window.location.hostname);

// ---------------------------------------------------------------------
// 1. Figure out which platform we're on, and where its captions live.
// ---------------------------------------------------------------------
//
// Each platform renders subtitles differently, so each needs its own
// CSS selector telling us where to look. `combine` decides how to turn
// however many matching elements we find into one string of text.
function detectPlatform() {
  const host = window.location.hostname;

  if (host.includes("youtube.com")) {
    return {
      name: "youtube",
      // YouTube splits one caption line across several small <span> segments.
      selector: ".ytp-caption-segment",
      combine: (elements) =>
        Array.from(elements).map((el) => el.textContent.trim()).join(" "),
    };
  }

  if (host.includes("netflix.com")) {
    return {
      name: "netflix",
      selector: ".player-timedtext-text-container",
      combine: (elements) =>
        Array.from(elements).map((el) => el.textContent.trim()).join(" "),
    };
  }

  // Hotstar (and anything else not explicitly handled above): fall back to
  // a generic heuristic, since exact class names vary and change often.
  // We look for elements whose class name mentions "caption" or "subtitle",
  // or that are marked as a live region (common for accessibility captions).
  return {
    name: "generic",
    selector:
      '[class*="caption" i], [class*="subtitle" i], [aria-live="polite"], [aria-live="assertive"]',
    combine: (elements) =>
      Array.from(elements)
        .map((el) => el.textContent.trim())
        .filter((text) => text.length > 0)
        .join(" "),
  };
}

const platform = detectPlatform();
console.log("[LJIA] Detected platform:", platform.name);

// ---------------------------------------------------------------------
// 2. Read the current caption text from the page right now.
// ---------------------------------------------------------------------
function readCurrentCaptionText() {
  const elements = document.querySelectorAll(platform.selector);
  if (elements.length === 0) return "";
  return platform.combine(elements);
}

// ---------------------------------------------------------------------
// 3. Watch the page for changes, and only log when the caption text
//    actually changes (the DOM mutates constantly — video players update
//    timestamps, progress bars, etc. — we don't want to log every twitch).
// ---------------------------------------------------------------------
let lastCaptionText = "";

function handlePotentialCaptionChange() {
  const currentText = readCurrentCaptionText();

  if (currentText !== lastCaptionText) {
    lastCaptionText = currentText;
document.dispatchEvent( new CustomEvent("ljia:caption", { detail: { text: currentText, platform: platform.name, timestamp: Date.now() }, }) );

    if (currentText.length > 0) {
      console.log(
        "[LJIA] Caption changed:",
        currentText,
        "| platform:",
        platform.name,
        "| time:",
        new Date().toISOString()
      );

      // Forward-looking: later weeks (subtitle overlay, dictionary lookup)
      // will want this data too. Sending it now costs nothing and means
      // background.js is already receiving real caption events.
      chrome.runtime.sendMessage({
        type: "CAPTION_UPDATE",
        text: currentText,
        platform: platform.name,
        timestamp: Date.now(),
      });
    }
  }
}

const observer = new MutationObserver(() => {
  handlePotentialCaptionChange();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
});

console.log("[LJIA] Caption observer started, watching for:", platform.selector);

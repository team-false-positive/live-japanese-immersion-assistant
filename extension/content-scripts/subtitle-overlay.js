// content-scripts/subtitle-overlay.js
//
// Week 4 Module A — Subtitle Overlay Rendering.
//
// Renders a floating dual-line subtitle bar (Japanese on top, English
// underneath) positioned over the video player, and keeps it updated
// live from Week 3 Module C's caption stream.
//
// This runs in the SAME page as caption-reader.js (see manifest.json —
// both files are listed for the same "matches"), so instead of round-
// tripping through the background service worker, it just listens for
// the "ljia:caption" DOM event that caption-reader.js dispatches every
// time it detects new caption text.

(function () {
  const STYLE_ID = "ljia-subtitle-overlay-style";
  const BAR_ID = "ljia-subtitle-overlay-bar";

  // ---------------------------------------------------------------------
  // 1. Inject the CSS for the overlay bar once.
  // ---------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BAR_ID} {
        position: fixed;
        left: 50%;
        bottom: 8%;
        transform: translateX(-50%);
        max-width: 80%;
        z-index: 2147483647; /* sit above the video player's own UI */
        background: rgba(0, 0, 0, 0.75);
        color: #ffffff;
        padding: 10px 18px;
        border-radius: 8px;
        font-family: "Hiragino Sans", "Yu Gothic", "Segoe UI", sans-serif;
        text-align: center;
        pointer-events: none; /* clicks pass through to the video controls */
        display: none;
      }
      #${BAR_ID} .ljia-jp {
        font-size: 22px;
        font-weight: 600;
        line-height: 1.4;
      }
      #${BAR_ID} .ljia-en {
        font-size: 15px;
        color: #d0d0d0;
        margin-top: 4px;
        line-height: 1.3;
      }
ytp-caption-window-container { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------------
  // 2. Create the bar element itself (just once, reused after that).
  // ---------------------------------------------------------------------
  function createBar() {
    let bar = document.getElementById(BAR_ID);
    if (bar) return bar;

    bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.innerHTML = `
      <div class="ljia-jp"></div>
      <div class="ljia-en"></div>
    `;
    document.body.appendChild(bar);
    return bar;
  }

  injectStyles();
  const bar = createBar();
  const jpLine = bar.querySelector(".ljia-jp");
  const enLine = bar.querySelector(".ljia-en");

  // ---------------------------------------------------------------------
  // 3. Show/hide/update the bar based on incoming caption text.
  // ---------------------------------------------------------------------
  function showCaption(japaneseText, englishText) {
    if (!japaneseText) {
      bar.style.display = "none";
      return;
    }
    jpLine.textContent = japaneseText;
    enLine.textContent = englishText || "";
    bar.style.display = "block";
  }

  // caption-reader.js dispatches this every time detected caption text changes.
  document.addEventListener("ljia:caption", (event) => {
    const { text } = event.detail || {};
    showCaption(text, "");
  });

  // Reserved for Week 4 Module D (translation API): whenever a translation
  // arrives for the current line, this fills in the English line below —
  // without needing to touch this file again once that module exists.
  document.addEventListener("ljia:translation", (event) => {
    const { text } = event.detail || {};
    enLine.textContent = text || "";
  });

  console.log("[LJIA] subtitle-overlay.js ready, listening for ljia:caption events");
})();

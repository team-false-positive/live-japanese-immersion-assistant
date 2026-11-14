// extension/content-scripts/translate-line.js
//
// English sentence line. Translates each subtitle line (native captions and
// Whisper text alike) and sends the English to the overlay, which shows it
// under the Japanese line.
//
// - Each line is translated once; repeated lines come from a cache, so they
//   don't use up the translation quota again.
// - The "Show English subtitle line" setting is respected, and changes apply
//   straight away.
// - An English result is only shown if its Japanese line is still on screen,
//   so a slow translation never shows against the wrong sentence.
//
// Wrapped in a function so its names cannot clash with the other content scripts.

(function () {
  const MAX_CHARS = 400;            // longer lines are skipped (service limit per request)
  const cache = new Map();          // Japanese line -> English
  let currentLine = "";             // the Japanese line on screen right now
  let enabled = true;

  // Sends English to the overlay (an empty string clears the English line).
  function sendEnglish(text) {
    document.dispatchEvent(new CustomEvent("ljia:translation", { detail: { text } }));
  }

  // Asks the background to translate one line. Resolves to the reply, or null.
  function askBackground(text) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "TRANSLATE", text }, (response) => {
        resolve(chrome.runtime.lastError ? null : response || null);
      });
    });
  }

  async function translateLine(line) {
    if (!enabled || !line) return;

    if (cache.has(line)) {
      if (line === currentLine) sendEnglish(cache.get(line));
      return;
    }
    if (line.length > MAX_CHARS) return;

    const response = await askBackground(line);
    if (!response || !response.success || !response.translated) return;

    cache.set(line, response.translated);
    if (line === currentLine) sendEnglish(response.translated);
  }

  // The setting is read on load, and again whenever it is changed on the options page.
  chrome.storage.local.get("settings", (result) => {
    const settings = result.settings || { showEnglishSubtitle: true };
    enabled = settings.showEnglishSubtitle !== false;
    if (!enabled) sendEnglish("");
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.settings) return;
    const settings = changes.settings.newValue || { showEnglishSubtitle: true };
    enabled = settings.showEnglishSubtitle !== false;
    if (!enabled) {
      sendEnglish("");
    } else if (currentLine) {
      translateLine(currentLine);
    }
  });

  // A new Japanese line arrived. A short delay makes sure the overlay has
  // updated its Japanese line first, so the English is shown after it.
  document.addEventListener("ljia:caption", (event) => {
    const text = ((event.detail && event.detail.text) || "").trim();
    currentLine = text;
    if (!text) {
      sendEnglish("");
      return;
    }
    setTimeout(() => translateLine(text), 0);
  });
})();

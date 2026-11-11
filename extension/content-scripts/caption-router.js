// content-scripts/caption-router.js
//
// Week 6 Module D: fallback routing.
// Shows Whisper text on the subtitle overlay only when the page has no
// native captions. Native captions are the ones caption-reader.js reports
// through "ljia:caption" events. Whisper text arrives from background.js
// as a WHISPER_TEXT message.

(function () {
  // Native captions count as present for this long after the last one seen.
  const NATIVE_HOLD_MS = 8000;
  let lastNativeAt = 0;

  // Track native captions. Ignore events we dispatch ourselves (platform "whisper"),
  // otherwise our own fallback text would look like native captions.
  document.addEventListener("ljia:caption", (event) => {
    const detail = event.detail || {};
    if (detail.platform === "whisper") return;
    if (detail.text && detail.text.length > 0) {
      lastNativeAt = Date.now();
    }
  });

  // Whisper text from background.js.
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== "WHISPER_TEXT") return;

    const nativeActive = Date.now() - lastNativeAt < NATIVE_HOLD_MS;
    if (nativeActive) {
      console.log("[LJIA] router: native captions active, Whisper text not shown");
      return;
    }

    console.log("[LJIA] router: no native captions, showing Whisper text");
    // The subtitle overlay already listens for "ljia:caption" and shows its text.
    document.dispatchEvent(
      new CustomEvent("ljia:caption", {
        detail: { text: message.text, platform: "whisper", timestamp: Date.now() },
      })
    );
  });
})();

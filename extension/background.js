// background.js
// This is the "service worker" — a script that runs in the background,
// separate from any web page, for as long as Chrome needs it (it can be
// stopped and restarted automatically, so never assume it's "always on"
// or store important state only in variables here — use chrome.storage)
 import { saveWatchProgress, getWatchProgress } from "./storage/storage.js";

// Runs once, the moment the extension is installed or updated.
chrome.runtime.onInstalled.addListener((details) => {
  console.log("[LJIA] Extension installed/updated:", details.reason);

  // Set sensible defaults the first time the extension is installed.
  if (details.reason === "install") {
    chrome.storage.local.set({
      settings: {
        extensionEnabled: true,
        showEnglishSubtitle: true
      }
    });
  }
});

// Takes Japanese text, returns the English translation using MyMemory (free, no API key).
async function translateText(japaneseText) {
  const params = new URLSearchParams({
    q: japaneseText,
    langpair: "ja|en"
  });

  const response = await fetch(`https://api.mymemory.translated.net/get?${params}`);
  const data = await response.json();

  if (data.responseStatus === 200) {
    return data.responseData.translatedText;
  } else {
    throw new Error("Translation failed: " + JSON.stringify(data));
  }
}

// Central message hub. Content scripts (caption reader, subtitle overlay,
// etc.) and the popup/options pages will all send messages here when they
// need something — e.g. a dictionary lookup that has to go through the
// WASM-backed hash table. For now this just proves the wiring works.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[LJIA] Message received in background:", message);

  if (message.type === "PING") {
    sendResponse({ type: "PONG", receivedAt: Date.now() });
    return true; // keep the message channel open for the async response
  }
 if (message.type === "SAVE_WATCH_PROGRESS") { saveWatchProgress(message.videoId, message.platform, message.timestampSeconds) .then(() => sendResponse({ success: true })) .catch((error) => sendResponse({ success: false, error: error.message })); return true; } if (message.type === "GET_WATCH_PROGRESS") { getWatchProgress(message.videoId) .then((progress) => sendResponse({ progress })) .catch((error) => sendResponse({ progress: null, error: error.message })); return true; }

  if (message.type === "TRANSLATE") {
    translateText(message.text)
      .then((translated) => sendResponse({ success: true, translated }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for the async translation call
  }

  // TODO (later weeks): route lookup requests to the WASM dictionary,
  // route "save word" actions to the storage layer, etc.
});

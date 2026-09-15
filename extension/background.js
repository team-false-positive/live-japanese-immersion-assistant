// background.js
// This is the "service worker" — a script that runs in the background,
// separate from any web page, for as long as Chrome needs it (it can be
// stopped and restarted automatically, so never assume it's "always on"
// or store important state only in variables here — use chrome.storage)
 import {
  saveWatchProgress,
  getWatchProgress,
  recordWordOccurrence,
  getWordHistory,
} from "./storage/storage.js";

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

  if (message.type === "RECORD_WORD_OCCURRENCE") {
    recordWordOccurrence(
      message.word,
      message.videoId,
      message.platform,
      message.timestampSeconds,
      message.show
    )
      .then((record) => sendResponse({ success: true, record }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === "SEARCH_WORD_HISTORY") {
    getWordHistory(message.word)
      .then((record) => sendResponse({ occurrences: record ? record.occurrences : [] }))
      .catch((error) => sendResponse({ occurrences: [], error: error.message }));
    return true;
  }

  if (message.type === "JUMP_TO_OCCURRENCE") {
    jumpToOccurrence(message.occurrence)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // TODO (later weeks): route lookup requests to the WASM dictionary,
  // route "save word" actions to the storage layer, etc.
});

// Opens (or focuses) the tab for an occurrence's video, and seeks to
// its saved timestamp.
async function jumpToOccurrence(occurrence) {
  const { platform, videoId, timestampSeconds } = occurrence;

  if (platform === "youtube") {
    // YouTube supports a timestamp directly in the URL -- simplest case.
    const url = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(timestampSeconds)}s`;
    const existing = await findTabForVideo(videoId, "youtube.com");
    if (existing) {
      await chrome.tabs.update(existing.id, { url, active: true });
      await chrome.windows.update(existing.windowId, { focused: true });
    } else {
      await chrome.tabs.create({ url });
    }
    return;
  }

  // Netflix / Hotstar don't support a timestamp in the URL, so we open
  // or focus the tab, then tell the content script to seek once the
  // <video> element is ready.
  const domain = platform === "netflix" ? "netflix.com" : "hotstar.com";
  let tab = await findTabForVideo(videoId, domain);

  if (!tab) {
    const url =
      platform === "netflix"
        ? `https://www.netflix.com/watch/${videoId}`
        : `https://www.hotstar.com${videoId}`;
    tab = await chrome.tabs.create({ url });
    await waitForTabLoad(tab.id);
  } else {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  }

  sendSeekWithRetry(tab.id, timestampSeconds);
}

// Finds an already-open tab whose URL matches this video, if any exists.
async function findTabForVideo(videoId, domainHint) {
  const tabs = await chrome.tabs.query({ url: `*://*.${domainHint}/*` });
  return tabs.find((tab) => tab.url && tab.url.includes(videoId));
}

// Waits for a freshly-opened tab to finish loading its page.
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// The <video> element can take a moment to appear after the page loads
// (watch-history.js's own MutationObserver is still searching for it),
// so retry the SEEK_TO message a few times instead of giving up on the
// first miss.
function sendSeekWithRetry(tabId, timestampSeconds, attemptsLeft = 5) {
  chrome.tabs.sendMessage(tabId, { type: "SEEK_TO", timestampSeconds }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      if (attemptsLeft > 0) {
        setTimeout(() => sendSeekWithRetry(tabId, timestampSeconds, attemptsLeft - 1), 1000);
      }
    }
  });
}
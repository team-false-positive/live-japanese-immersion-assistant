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
  saveWord,
} from "./storage/storage.js";

// Tab that tab-audio capture is running on. Whisper text is sent here.
// Not kept in storage: if the worker restarts, capture is restarted from the popup.
let captureTabId = null;

// Last watch position saved. A paused video reports the same position again
// and again, so identical saves are skipped.
let lastSaved = null;

// Dictionary for click-to-lookup, loaded the first time it is needed.
let dictionaryMap = null;

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

// Loads the dictionary into a map, word -> entry. Runs once.
async function getDictionary() {
  if (dictionaryMap) return dictionaryMap;
  const text = await (await fetch(chrome.runtime.getURL("data/dictionary_full.tsv"))).text();
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const [word = "", reading = "", meaning = ""] = line.split("\t");
    const w = word.trim();
    if (w && !map.has(w)) {
      map.set(w, { word: w, reading: reading.trim(), meaning: meaning.trim() });
    }
  }
  dictionaryMap = map;
  return map;
}

// Finds the longest dictionary word that contains position `index` in `run`.
// `run` is a stretch of Japanese text, so words can be matched inside it.
async function lookupInRun(run, index) {
  const dict = await getDictionary();
  for (let len = Math.min(8, run.length); len >= 1; len--) {
    const first = Math.max(0, index - len + 1);
    const last = Math.min(index, run.length - len);
    for (let start = first; start <= last; start++) {
      const entry = dict.get(run.substr(start, len));
      if (entry) return entry;
    }
  }
  return null;
}

// Saves a word: the saved-words store, a watch occurrence, and the review deck.
async function saveWordEverywhere(message) {
  await saveWord(message.word, { reading: message.reading, meaning: message.meaning });
  await recordWordOccurrence(
    message.word,
    message.videoId,
    message.platform,
    message.timestampSeconds,
    message.show
  );

  // Add to the review deck, unless it is already there.
  const stored = await chrome.storage.local.get("cards");
  const cards = stored.cards || {};
  if (!cards[message.word]) {
    cards[message.word] = { word: message.word, interval: 1, due: Date.now(), correct: 0, wrong: 0 };
    await chrome.storage.local.set({ cards });
  }
  return { success: true };
}

// Central message hub. Content scripts, the popup, and the offscreen page
// send messages here when they need something.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[LJIA] Message received in background:", message);

  if (message.type === "PING") {
    sendResponse({ type: "PONG", receivedAt: Date.now() });
    return true; // keep the message channel open for the async response
  }

  // ---- Week 4 Module B: click-to-lookup ----
  if (message.type === "LOOKUP_WORD") {
    lookupInRun(message.run, message.index)
      .then((entry) => sendResponse({ entry }))
      .catch((error) => sendResponse({ entry: null, error: error.message }));
    return true;
  }

  // ---- Week 5 Module B: save word ----
  if (message.type === "SAVE_WORD") {
    saveWordEverywhere(message)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === "SAVE_WATCH_PROGRESS") {
    const unchanged =
      lastSaved !== null &&
      lastSaved.videoId === message.videoId &&
      lastSaved.timestampSeconds === message.timestampSeconds;
    if (unchanged) {
      sendResponse({ success: true, skipped: true });
      return;
    }
    lastSaved = { videoId: message.videoId, timestampSeconds: message.timestampSeconds };
    saveWatchProgress(message.videoId, message.platform, message.timestampSeconds)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.type === "GET_WATCH_PROGRESS") {
    getWatchProgress(message.videoId)
      .then((progress) => sendResponse({ progress }))
      .catch((error) => sendResponse({ progress: null, error: error.message }));
    return true;
  }

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

  // ---- Week 6 Module B: live tab-audio capture ----
  if (message.type === "START_TAB_CAPTURE") {
    startCapture(message.streamId)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  if (message.type === "STOP_TAB_CAPTURE") {
    stopCapture().then(() => sendResponse({ ok: true }));
    return true;
  }

  // ---- Week 6 Module D: fallback routing ----
  // The offscreen page sends each Whisper transcript here. Forward it to the
  // captured tab, where caption-router.js decides whether to show it.
  if (message.type === "WHISPER_TEXT") {
    if (captureTabId !== null && message.text) {
      chrome.tabs
        .sendMessage(captureTabId, { type: "WHISPER_TEXT", text: message.text })
        .catch(() => {}); // tab may have closed or reloaded; nothing to do
    }
    return;
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

// ---- Week 6 Module B: live tab-audio capture ----

// Creates the hidden offscreen page (if needed) and tells it to start
// capturing the tab audio identified by streamId. Remembers the tab that
// is being captured, so Whisper text can be sent back to it.
async function startCapture(streamId) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  captureTabId = tab ? tab.id : null;

  const existing = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (existing.length === 0) {
    await chrome.offscreen.createDocument({
      url: "offscreen/offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Capture tab audio for live Japanese transcription",
    });
  }
  chrome.runtime.sendMessage({ target: "offscreen", type: "START_CAPTURE", streamId });
}

// Tells the offscreen page to stop, then closes it.
async function stopCapture() {
  captureTabId = null;
  chrome.runtime.sendMessage({ target: "offscreen", type: "STOP_CAPTURE" });
  await chrome.offscreen.closeDocument().catch(() => {});
}

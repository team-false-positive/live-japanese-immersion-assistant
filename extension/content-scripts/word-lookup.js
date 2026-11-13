// extension/content-scripts/word-lookup.js
//
// Week 4 Module B: click-to-lookup. Week 5 Module B: save word.
// Week 10 Module B: smart rewind on lookup (uses smart-rewind.js).
//
// Click a word in the subtitle bar. The word under the click is found, its
// dictionary entry is fetched from the background script, and a small bubble
// shows its reading and meaning, with a Save button. When the word is found,
// the video steps back a few seconds so the sentence can be heard again.

const JAPANESE_CHAR = /[\u3040-\u30ff\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;

let bubble = null;

// Sends a message to the background, and resolves to its reply (or null).
function sendToBackground(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(chrome.runtime.lastError ? null : response || null);
    });
  });
}

// The text position under the mouse, in the browser's own terms.
function caretAt(x, y) {
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  return null;
}

// The run of Japanese characters around the click, and the click's position in it.
// Tries the character at the caret, then the one before it.
function japaneseRun(text, i) {
  let pos = null;
  for (const candidate of [i, i - 1]) {
    if (candidate >= 0 && candidate < text.length && JAPANESE_CHAR.test(text[candidate])) {
      pos = candidate;
      break;
    }
  }
  if (pos === null) return null;

  let start = pos;
  let end = pos;
  while (start > 0 && JAPANESE_CHAR.test(text[start - 1])) start--;
  while (end < text.length - 1 && JAPANESE_CHAR.test(text[end + 1])) end++;
  return { run: text.slice(start, end + 1), index: pos - start };
}

// Which video this page is showing, in the same terms watch-history.js uses.
function videoInfo() {
  const url = new URL(location.href);
  if (location.hostname.includes("youtube.com")) {
    return { platform: "youtube", videoId: url.searchParams.get("v") || url.pathname };
  }
  if (location.hostname.includes("netflix.com")) {
    const m = url.pathname.match(/\/watch\/(\d+)/);
    return { platform: "netflix", videoId: m ? m[1] : url.pathname };
  }
  return { platform: "hotstar", videoId: url.pathname };
}

function closeBubble() {
  if (bubble) {
    bubble.remove();
    bubble = null;
  }
}

// A small bubble at the click, with the entry and a Save button.
// entry is null when the word is not in the dictionary.
function showBubble(x, y, entry, clickedText) {
  closeBubble();
  bubble = document.createElement("div");
  bubble.className = "ljia-bubble";
  bubble.style.left = `${Math.min(x, window.innerWidth - 280)}px`;
  bubble.style.top = `${Math.max(8, y - 140)}px`;

  const word = document.createElement("div");
  word.className = "word";
  const reading = document.createElement("div");
  reading.className = "reading";
  const meaning = document.createElement("div");
  const status = document.createElement("div");
  status.className = "status";

  if (!entry) {
    word.textContent = clickedText;
    meaning.textContent = "Not in the dictionary.";
  } else {
    word.textContent = entry.word;
    reading.textContent = entry.reading;
    meaning.textContent = entry.meaning;
  }

  bubble.appendChild(word);
  bubble.appendChild(reading);
  bubble.appendChild(meaning);

  if (entry) {
    const save = document.createElement("button");
    save.textContent = "Save word";
    save.addEventListener("click", async () => {
      save.disabled = true;
      const v = videoInfo();
      const video = document.querySelector("video");
      const response = await sendToBackground({
        type: "SAVE_WORD",
        word: entry.word,
        reading: entry.reading,
        meaning: entry.meaning,
        videoId: v.videoId,
        platform: v.platform,
        timestampSeconds: video ? video.currentTime : 0,
        show: document.title,
      });
      status.textContent = response && response.success ? "Saved to your review deck." : "Could not save.";
    });
    bubble.appendChild(save);
  }
  bubble.appendChild(status);
  document.body.appendChild(bubble);
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest(".ljia-bubble")) return;

  // Only subtitle text is clickable; any other click closes the bubble.
  const subtitle = target.closest(".ljia-jp");
  if (!subtitle) {
    closeBubble();
    return;
  }

  const hit = caretAt(event.clientX, event.clientY);
  if (!hit || hit.node.nodeType !== Node.TEXT_NODE) return;

  const found = japaneseRun(hit.node.textContent, hit.offset);
  if (!found) return;

  const response = await sendToBackground({
    type: "LOOKUP_WORD",
    run: found.run,
    index: found.index,
  });
  const entry = response ? response.entry : null;

  // A word was found: step the video back so the sentence can be heard again.
  if (entry) {
    applySmartRewind(document.querySelector("video"));
  }

  const clicked = found.run.charAt(found.index);
  showBubble(event.clientX, event.clientY, entry, clicked);
});

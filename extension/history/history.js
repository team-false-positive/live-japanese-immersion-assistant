// history/history.js
// Reads watch history straight from the extension's IndexedDB store, which
// storage.js writes to. Lists videos most recent first.

const DB_NAME = "jimaku_storage";
const HISTORY_STORE = "watchHistory";

const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");

// Opens the database. Creates the stores too, in case this page runs first.
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("savedWords")) {
        db.createObjectStore("savedWords", { keyPath: "word" });
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        db.createObjectStore(HISTORY_STORE, { keyPath: "videoId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Reads every watch-history record.
async function readAllHistory() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, "readonly");
    const request = tx.objectStore(HISTORY_STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 92.4 seconds becomes "1:32".
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

// Link that reopens the video at its saved position.
function linkFor(entry) {
  const t = Math.floor(entry.lastPosition || 0);
  if (entry.platform === "youtube") {
    return `https://www.youtube.com/watch?v=${entry.videoId}&t=${t}s`;
  }
  if (entry.platform === "netflix") {
    return `https://www.netflix.com/watch/${entry.videoId}`;
  }
  return `https://www.hotstar.com${entry.videoId}`;
}

async function main() {
  let entries;
  try {
    entries = await readAllHistory();
  } catch (e) {
    statusEl.textContent = "Could not read history: " + e.message;
    return;
  }

  // Entries whose video ID is "/" were saved from a page with no video ID
  // (for example, the YouTube home page). They can't be reopened, so hide them.
  const playable = entries
    .filter((e) => e.videoId && e.videoId !== "/")
    .sort((a, b) => (b.lastWatched || 0) - (a.lastWatched || 0));

  if (playable.length === 0) {
    statusEl.textContent = "No watched videos yet.";
    return;
  }
  statusEl.textContent = `${playable.length} video(s)`;

  for (const entry of playable) {
    const item = document.createElement("li");

    const link = document.createElement("a");
    link.href = linkFor(entry);
    link.target = "_blank";
    link.textContent = `${entry.platform}: ${entry.videoId}`;

    const meta = document.createElement("div");
    meta.className = "meta";
    const when = entry.lastWatched ? new Date(entry.lastWatched).toLocaleString() : "";
    meta.textContent = `resume at ${formatTime(entry.lastPosition || 0)}  |  last watched ${when}`;

    item.appendChild(link);
    item.appendChild(meta);
    listEl.appendChild(item);
  }
}

main();

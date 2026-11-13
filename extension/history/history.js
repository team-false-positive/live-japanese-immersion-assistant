// extension/history/history.js
// Week 9 Module B: library page.
//
// Reads watch history straight from the extension's IndexedDB store. Lists
// videos most recent first, each as a card with a resume button.

const DB_NAME = "jimaku_storage";
const HISTORY_STORE = "watchHistory";

const statusEl = document.getElementById("status");
const statsEl = document.getElementById("stats");
const statVideosEl = document.getElementById("stat-videos");
const statLatestEl = document.getElementById("stat-latest");
const listEl = document.getElementById("list");

// Opens the database. Does not pass a version number, so it opens whatever
// version exists. Creates the stores too, in case this page runs first.
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

function platformName(platform) {
  if (platform === "youtube") return "YouTube";
  if (platform === "netflix") return "Netflix";
  if (platform === "hotstar") return "Hotstar";
  return platform || "Video";
}

// One card for one video.
function drawCard(entry) {
  const card = document.createElement("div");
  card.className = "card";

  const row = document.createElement("div");
  row.className = "video-row";

  const text = document.createElement("div");

  const title = document.createElement("div");
  title.className = "video-title";
  title.textContent = `${platformName(entry.platform)}: ${entry.videoId}`;

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = `resume at ${formatTime(entry.lastPosition || 0)}`;

  const meta = document.createElement("div");
  meta.className = "video-meta";
  meta.textContent = entry.lastWatched ? `last watched ${new Date(entry.lastWatched).toLocaleString()}` : "";

  text.appendChild(title);
  text.appendChild(badge);
  text.appendChild(meta);

  const resume = document.createElement("a");
  resume.className = "btn btn-primary";
  resume.href = linkFor(entry);
  resume.target = "_blank";
  resume.textContent = "Resume";

  row.appendChild(text);
  row.appendChild(resume);
  card.appendChild(row);
  listEl.appendChild(card);
}

async function main() {
  let entries;
  try {
    entries = await readAllHistory();
  } catch (e) {
    statusEl.textContent = "Could not read the library: " + e.message;
    return;
  }

  // Entries whose video ID is "/" were saved from a page with no video ID
  // (for example, the YouTube home page). They can't be reopened, so hide them.
  const playable = entries
    .filter((e) => e.videoId && e.videoId !== "/")
    .sort((a, b) => (b.lastWatched || 0) - (a.lastWatched || 0));

  if (playable.length === 0) {
    statusEl.textContent = "No watched videos yet. Watch something with captions on, and it will appear here.";
    return;
  }

  statusEl.textContent = "";
  statsEl.hidden = false;
  statVideosEl.textContent = String(playable.length);
  statLatestEl.textContent = playable[0].lastWatched
    ? new Date(playable[0].lastWatched).toLocaleDateString()
    : "-";

  for (const entry of playable) drawCard(entry);
}

main();

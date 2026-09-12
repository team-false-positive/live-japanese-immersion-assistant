// storage.js
// Local persistent storage layer for saved words and watch history.
// Uses IndexedDB directly (no external libraries) so it works inside
// a browser extension with zero dependencies.

const DB_NAME = "jimaku_storage";
const DB_VERSION = 1;
const WORDS_STORE = "savedWords";
const HISTORY_STORE = "watchHistory";

// Opens (or creates, on first run) the database and its two stores.
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // This only runs the very first time, or when DB_VERSION is bumped later.
        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(WORDS_STORE)) {
                // "word" is the primary key -- each word gets exactly one entry.
                db.createObjectStore(WORDS_STORE, { keyPath: "word" });
            }

            if (!db.objectStoreNames.contains(HISTORY_STORE)) {
                // "videoId" is the primary key -- one history entry per video.
                db.createObjectStore(HISTORY_STORE, { keyPath: "videoId" });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// Save a word, or update it if it already exists.
async function saveWord(word, data) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(WORDS_STORE, "readwrite");
        const store = tx.objectStore(WORDS_STORE);

        // { word, reading, meaning, savedAt } -- data is whatever the caller passes in,
        // we just make sure "word" and a timestamp are always present.
        const record = { word, ...data, savedAt: data.savedAt || Date.now() };
        const request = store.put(record); // put() = insert or overwrite, same idea as our C++ insert()

        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error);
    });
}

// Look up a single saved word. Returns undefined if it was never saved.
async function getSavedWord(word) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(WORDS_STORE, "readonly");
        const store = tx.objectStore(WORDS_STORE);
        const request = store.get(word);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Save (or update) watch progress for a video.
async function saveWatchProgress(videoId, platform, timestampSeconds) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(HISTORY_STORE, "readwrite");
        const store = tx.objectStore(HISTORY_STORE);

        const record = {
            videoId,
            platform,
            lastPosition: timestampSeconds,
            lastWatched: Date.now(),
        };
        const request = store.put(record);

        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error);
    });
}

// Get saved progress for a video, so playback can resume from it.
async function getWatchProgress(videoId) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(HISTORY_STORE, "readonly");
        const store = tx.objectStore(HISTORY_STORE);
        const request = store.get(videoId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Exported so both the browser extension and our test file can use these.
export { saveWord, getSavedWord, saveWatchProgress, getWatchProgress };

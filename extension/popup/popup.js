// popup.js
// Runs when the popup window itself opens (clicking the toolbar icon).

const statusEl = document.getElementById("status");
const optionsBtn = document.getElementById("open-options");

// Confirm the popup can read saved settings from chrome.storage.
chrome.storage.local.get("settings", (result) => {
  if (result.settings && result.settings.extensionEnabled) {
    statusEl.textContent = "Extension is active.";
  } else {
    statusEl.textContent = "Extension is installed but disabled.";
  }
});

// Confirm the popup can talk to background.js.
chrome.runtime.sendMessage({ type: "PING" }, (response) => {
  console.log("[LJIA] popup got response from background:", response);
});

optionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

const searchInput = document.getElementById("history-search-input");
const searchBtn = document.getElementById("history-search-btn");
const resultsList = document.getElementById("history-results");

// Turns 92.4 seconds into "1:32" for display.
function formatTimestamp(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function renderResults(occurrences) {
  resultsList.innerHTML = "";

  if (!occurrences || occurrences.length === 0) {
    const empty = document.createElement("li");
    empty.className = "no-results";
    empty.textContent = "No past occurrences found for this word.";
    resultsList.appendChild(empty);
    return;
  }

  occurrences.forEach((occurrence) => {
    const item = document.createElement("li");
    item.className = "result-item";
    item.textContent = `${occurrence.show} — ${formatTimestamp(occurrence.timestampSeconds)}`;
    item.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "JUMP_TO_OCCURRENCE", occurrence }, (response) => {
        if (!response || !response.success) {
          console.warn("[LJIA] Could not jump to occurrence:", response && response.error);
        }
      });
    });
    resultsList.appendChild(item);
  });
}

function runSearch() {
  const word = searchInput.value.trim();
  if (!word) return;

  resultsList.innerHTML = '<li class="no-results">Searching...</li>';

  chrome.runtime.sendMessage({ type: "SEARCH_WORD_HISTORY", word }, (response) => {
    renderResults(response && response.occurrences);
  });
}

searchBtn.addEventListener("click", runSearch);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") runSearch();
});
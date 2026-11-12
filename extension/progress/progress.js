// extension/progress/progress.js
// Week 8 Module D: JLPT progress page.
//
// Reads the level list from data/jlpt-levels.tsv and the learner's deck from
// chrome.storage.local, then draws one bar per JLPT level.

const CARDS_KEY = "cards";

const statusEl = document.getElementById("status");
const levelsEl = document.getElementById("levels");

function loadDeck() {
  return new Promise((resolve) => {
    chrome.storage.local.get(CARDS_KEY, (result) => resolve(result[CARDS_KEY] || {}));
  });
}

async function loadLevelList() {
  const response = await fetch(chrome.runtime.getURL("data/jlpt-levels.tsv"));
  if (!response.ok) return null;
  return parseLevels(await response.text());
}

function drawRow(row) {
  const box = document.createElement("div");
  box.className = "row";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = `${row.level}: ${row.percent}% learned`;

  const bar = document.createElement("div");
  bar.className = "bar";
  const fill = document.createElement("div");
  fill.className = "fill";
  fill.style.width = `${row.percent}%`;
  bar.appendChild(fill);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${row.learned} learned, ${row.seen} seen, ${row.total} words on the list`;

  box.appendChild(label);
  box.appendChild(bar);
  box.appendChild(meta);
  levelsEl.appendChild(box);
}

async function init() {
  const entries = await loadLevelList();
  if (!entries || entries.length === 0) {
    statusEl.textContent =
      "No JLPT level list loaded yet. Add data/jlpt-levels.tsv (word, tab, level N5 to N1) to the extension.";
    return;
  }
  const deck = await loadDeck();
  const rows = levelProgress(entries, deck);
  statusEl.textContent = `${entries.length} words on the level list. ${Object.keys(deck).length} words in your deck.`;
  for (const row of rows) drawRow(row);
}

init();

// extension/progress/progress.js
// Week 8 Module D, fixed in Week 11 B (bug row 3).
//
// Reads the level list from data/jlpt-levels.tsv and the learner's deck from
// chrome.storage.local, then draws one row per JLPT level.
//
// Each bar has two layers:
//   - a light layer for words seen (in the deck at all)
//   - a dark layer on top for words learned (interval of four days or more)
// So progress shows from the first word, not only once a word is learned.

const CARDS_KEY = "cards";

const statusEl = document.getElementById("status");
const levelsEl = document.getElementById("levels");

function loadDeck() {
  return new Promise((resolve) => {
    chrome.storage.local.get(CARDS_KEY, (result) => resolve(result[CARDS_KEY] || {}));
  });
}

// Returns the parsed level list, or null if the file is missing or unreadable.
// Chrome rejects a request for a missing extension file, so that is caught here.
async function loadLevelList() {
  try {
    const response = await fetch(chrome.runtime.getURL("data/jlpt-levels.tsv"));
    if (!response.ok) return null;
    return parseLevels(await response.text());
  } catch (e) {
    return null;
  }
}

// One bar with a layer for each value (percent from 0 to 100).
function makeLayeredBar(layers) {
  const bar = document.createElement("div");
  bar.className = "bar";
  bar.style.position = "relative";
  for (const layer of layers) {
    const fill = document.createElement("div");
    fill.className = "fill";
    fill.style.position = "absolute";
    fill.style.top = "0";
    fill.style.left = "0";
    fill.style.width = `${layer.percent}%`;
    fill.style.background = layer.colour;
    bar.appendChild(fill);
  }
  return bar;
}

function drawRow(row) {
  const box = document.createElement("div");
  box.className = "row";

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = `${row.level}: ${row.percent}% learned`;

  const seenPercent = row.total ? Math.round((100 * row.seen) / row.total) : 0;
  const bar = makeLayeredBar([
    { percent: seenPercent, colour: "#aab4e0" },   // light: seen
    { percent: row.percent, colour: "#2e3a87" },   // dark: learned
  ]);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent =
    `${row.learned} learned, ${row.seen} seen, ${row.total} words on the list. ` +
    `Light bar: seen. Dark bar: learned.`;

  box.appendChild(label);
  box.appendChild(bar);
  box.appendChild(meta);
  levelsEl.appendChild(box);
}

async function init() {
  try {
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
  } catch (e) {
    statusEl.textContent = "Could not load progress: " + e.message;
  }
}

init();

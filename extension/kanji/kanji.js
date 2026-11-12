// extension/kanji/kanji.js
// Week 8 Module C: kanji explorer page.
//
// Click a kanji to see its parts. Click a part to see the kanji that contain
// it: first the kanji in your deck, then any dictionary kanji if your deck has
// none. Click any listed kanji to move on through the tree.

const CARDS_KEY = "cards";
const MAX_LIST = 60; // shown kanji per part, to keep the page short

const statusEl = document.getElementById("status");
const inputEl = document.getElementById("kanji-input");
const goBtn = document.getElementById("go");
const knownEl = document.getElementById("known");
const viewEl = document.getElementById("kanji-view");
const bigEl = document.getElementById("big");
const infoEl = document.getElementById("info");
const partsEl = document.getElementById("parts");
const resultsEl = document.getElementById("results");

let radicals = {};   // kanji -> parts
let index = new Map(); // part -> kanji containing it
let known = new Set(); // kanji from the learner's deck
let current = null;

function loadDeck() {
  return new Promise((resolve) => {
    chrome.storage.local.get(CARDS_KEY, (result) => resolve(result[CARDS_KEY] || {}));
  });
}

function renderKnown() {
  knownEl.innerHTML = "";
  const withParts = [...known].filter((k) => radicals[k]).sort();
  if (withParts.length === 0) {
    knownEl.textContent = "No kanji from your deck have parts data yet. Add words on the review screen.";
    return;
  }
  for (const k of withParts) {
    const btn = document.createElement("button");
    btn.className = "k";
    btn.textContent = k;
    btn.addEventListener("click", () => show(k));
    knownEl.appendChild(btn);
  }
}

// Shows a kanji and its parts.
function show(kanji) {
  current = kanji;
  viewEl.hidden = false;
  bigEl.textContent = kanji;
  resultsEl.innerHTML = "";
  partsEl.innerHTML = "";

  const parts = partsOf(kanji, radicals);
  if (parts.length === 0) {
    infoEl.textContent = "No parts data for this kanji.";
    return;
  }
  infoEl.textContent = "Parts (click one to see the kanji that share it):";
  for (const part of parts) {
    const btn = document.createElement("button");
    btn.className = "part";
    btn.textContent = part;
    btn.addEventListener("click", () => showPart(part));
    partsEl.appendChild(btn);
  }
}

// Shows the kanji that contain a part: your deck's kanji first, then dictionary kanji.
function showPart(part) {
  resultsEl.innerHTML = "";
  const inDeck = kanjiContaining(part, index, known).filter((k) => k !== current);

  let list, heading;
  if (inDeck.length > 0) {
    list = inDeck;
    heading = `Kanji in your deck with ${part}:`;
  } else {
    list = kanjiContaining(part, index, null).filter((k) => k !== current);
    heading = `No kanji in your deck contain ${part}. Dictionary kanji with ${part}:`;
  }

  const title = document.createElement("div");
  title.textContent = heading;
  resultsEl.appendChild(title);

  for (const k of list.slice(0, MAX_LIST)) {
    const btn = document.createElement("button");
    btn.className = "k";
    btn.textContent = k;
    btn.addEventListener("click", () => show(k));
    resultsEl.appendChild(btn);
  }
  if (list.length > MAX_LIST) {
    const more = document.createElement("div");
    more.textContent = `…and ${list.length - MAX_LIST} more.`;
    resultsEl.appendChild(more);
  }
}

// The first kanji in whatever was typed.
function submitInput() {
  const match = inputEl.value.match(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/);
  if (!match) {
    infoEl.textContent = "Type a kanji first.";
    viewEl.hidden = false;
    return;
  }
  show(match[0]);
}

goBtn.addEventListener("click", submitInput);
inputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") submitInput();
});

async function init() {
  radicals = JSON.parse(
    await (await fetch(chrome.runtime.getURL("data/kanji-radicals.json"))).text()
  );
  index = buildPartIndex(radicals);
  const deck = await loadDeck();
  known = knownKanjiFromWords(Object.keys(deck));
  statusEl.textContent = `${Object.keys(radicals).length} kanji with parts loaded.`;
  renderKnown();
}

init();

// extension/recommend/recommend.js
// Week 10 Module A: next-word recommendations page.
//
// Reads the learner's deck from chrome.storage.local, finds the kanji they
// already know, and suggests words that build on them. Add puts a word into
// the review deck.

const CARDS_KEY = "cards";
const COUNT = 15;

const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");

function loadDeck() {
  return new Promise((resolve) => {
    chrome.storage.local.get(CARDS_KEY, (result) => resolve(result[CARDS_KEY] || {}));
  });
}

function saveDeck(deck) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CARDS_KEY]: deck }, resolve);
  });
}

function drawSuggestion(pick, deck) {
  const card = document.createElement("div");
  card.className = "card";

  const row = document.createElement("div");
  row.className = "rec-row";

  const text = document.createElement("div");
  const word = document.createElement("div");
  word.className = "rec-word ja";
  word.textContent = pick.word;
  const reading = document.createElement("div");
  reading.className = "rec-reading ja";
  reading.textContent = pick.reading;
  const meaning = document.createElement("div");
  meaning.className = "rec-meaning";
  meaning.textContent = pick.meaning;
  const meta = document.createElement("div");
  meta.className = "rec-meta";
  meta.textContent = `new kanji: ${pick.unknownKanji.join(" ")}`;
  text.appendChild(word);
  text.appendChild(reading);
  text.appendChild(meaning);
  text.appendChild(meta);

  const add = document.createElement("button");
  add.className = "btn btn-primary";
  add.textContent = "Add to review";
  add.addEventListener("click", async () => {
    deck[pick.word] = createCard(pick.word, Date.now());
    await saveDeck(deck);
    add.textContent = "Added";
    add.disabled = true;
  });

  row.appendChild(text);
  row.appendChild(add);
  card.appendChild(row);
  listEl.appendChild(card);
}

async function init() {
  try {
    const text = await (await fetch(chrome.runtime.getURL("data/dictionary_full.tsv"))).text();
    const entries = parseDictionary(text);
    const deck = await loadDeck();

    const knownKanji = knownKanjiFromDeck(Object.keys(deck));
    const knownWords = new Set(Object.keys(deck));
    const picks = nextWords(entries, knownKanji, knownWords, { count: COUNT });

    if (picks.length === 0) {
      statusEl.textContent = "Add more words to your review deck, and suggestions will appear here.";
      return;
    }
    statusEl.textContent = `Suggestions built on the ${knownKanji.size} kanji in your deck.`;
    for (const pick of picks) drawSuggestion(pick, deck);
  } catch (e) {
    statusEl.textContent = "Could not load suggestions: " + e.message;
  }
}

// The kanji in the deck's words. Uses the same rule as the kanji explorer.
function knownKanjiFromDeck(words) {
  const set = new Set();
  for (const w of words) {
    for (const k of w.match(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g) || []) set.add(k);
  }
  return set;
}

init();

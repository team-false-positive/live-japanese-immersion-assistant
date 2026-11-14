// extension/review/review.js
// Week 7 Module C, restyled in Week 9 Module C.
//
// Shows the most overdue word with four meanings to choose from. Each answer
// goes through review() from the scheduler, and a wrong answer also runs
// propagateWrongAnswer() over the word graph. The deck is saved in
// chrome.storage.local, so it survives closing the browser.

const CARDS_KEY = "cards";

const progressEl = document.getElementById("progress");
const streakEl = document.getElementById("streak");
const sessionEl = document.getElementById("session");
const wordEl = document.getElementById("word");
const readingEl = document.getElementById("reading");
const choicesEl = document.getElementById("choices");
const feedbackEl = document.getElementById("feedback");
const nextBtn = document.getElementById("next");
const emptyEl = document.getElementById("empty");
const addInput = document.getElementById("add-input");
const addBtn = document.getElementById("add-btn");
const addStatus = document.getElementById("add-status");

let entryOf = new Map();   // word -> { reading, meaning } from the dictionary
let graph = null;          // word graph built from the dictionary
let deck = {};             // word -> card (see scheduler.js)
let current = null;        // card being reviewed
let correctMeaning = "";
let answered = false;
let allEntries = [];

// The first meaning, shortened: "obvious, clear, plain" -> "obvious"
function shortMeaning(meaning) {
  return meaning.split(",")[0].trim();
}

async function loadDictionary() {
  const url = chrome.runtime.getURL("data/dictionary_full.tsv");
  const text = await (await fetch(url)).text();
  const entries = parseDictionary(text);
  // The graph is built on the first wrong answer, not at page load.
  for (const e of entries) {
    if (!entryOf.has(e.word)) entryOf.set(e.word, { reading: e.reading, meaning: e.meaning });
  }
  return entries;
}

function loadDeck() {
  return new Promise((resolve) => {
    chrome.storage.local.get(CARDS_KEY, (result) => resolve(result[CARDS_KEY] || {}));
  });
}

function saveDeck() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CARDS_KEY]: deck }, resolve);
  });
}

function updateProgress() {
  const now = Date.now();
  const due = dueWords(Object.values(deck), now).length;
  progressEl.textContent = `${due} due now, ${Object.keys(deck).length} words in your deck`;
}

// Four choices: the right meaning plus three from other dictionary words.
function buildChoices(correct, entries) {
  const others = new Set();
  while (others.size < 3) {
    const pick = entries[Math.floor(Math.random() * entries.length)];
    const m = shortMeaning(pick.meaning);
    if (m && m !== correct) others.add(m);
  }
  const options = [correct, ...others];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

function showNext() {
  const due = dueWords(Object.values(deck), Date.now());
  updateProgress();
  nextBtn.hidden = true;
  feedbackEl.textContent = "";
  feedbackEl.className = "";

  if (due.length === 0) {
    sessionEl.hidden = true;
    emptyEl.hidden = false;
    current = null;
    return;
  }

  emptyEl.hidden = true;
  sessionEl.hidden = false;
  current = due[0];
  answered = false;

  const info = entryOf.get(current.word) || { reading: "", meaning: "" };
  correctMeaning = shortMeaning(info.meaning);

  wordEl.textContent = current.word;
  readingEl.textContent = info.reading;
  choicesEl.innerHTML = "";

  for (const option of buildChoices(correctMeaning, allEntries)) {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = option;
    btn.addEventListener("click", () => answer(option, btn));
    choicesEl.appendChild(btn);
  }
}

async function answer(choice, button) {
  if (answered || !current) return;
  answered = true;

  const now = Date.now();
  const correct = choice === correctMeaning;

  // Mark the buttons: the right one green, a wrong pick red, then animate.
  for (const b of choicesEl.querySelectorAll(".choice")) {
    if (b.textContent === correctMeaning) b.classList.add("right");
  }
  if (!correct) button.classList.add("wrong");
  animateAnswer(button, correct);

  updateStreak(correct);
  renderStreak(streakEl);

  // Update the deck: review the card, then propagate on a wrong answer.
  deck[current.word] = review(current, correct, now);
  if (!correct) {
    if (!graph) graph = buildWordGraph(allEntries);
    const updated = propagateWrongAnswer(Object.values(deck), graph, current.word, now);
    deck = Object.fromEntries(updated.map((c) => [c.word, c]));
  }
  await saveDeck();

  feedbackEl.className = correct ? "feedback-correct" : "feedback-wrong";
  feedbackEl.textContent = feedbackMessage(correct, correctMeaning);
  nextBtn.hidden = false;
  updateProgress();
}

nextBtn.addEventListener("click", showNext);

addBtn.addEventListener("click", async () => {
  const word = addInput.value.trim();
  if (!word) return;
  if (!entryOf.has(word)) {
    addStatus.textContent = "That word is not in the dictionary.";
    return;
  }
  if (deck[word]) {
    addStatus.textContent = "That word is already in your deck.";
    return;
  }
  deck[word] = createCard(word, Date.now());
  await saveDeck();
  addStatus.textContent = `Added ${word}.`;
  addInput.value = "";
  if (!current) showNext();
  else updateProgress();
});

async function init() {
  allEntries = await loadDictionary();
  deck = await loadDeck();
  progressEl.textContent = "";
  renderStreak(streakEl);
  showNext();
}

init();

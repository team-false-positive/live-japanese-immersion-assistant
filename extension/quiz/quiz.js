// extension/quiz/quiz.js
// Week 8 Module A and B: quiz page.
//
// Uses the same deck as the review screen (chrome.storage.local "cards"), so
// answers here affect the same schedule. Wrong answers also run propagation.
// In multiple-choice mode, wrong choices come from graph neighbors.

const CARDS_KEY = "cards";
const SESSION_SIZE = 10;

const progressEl = document.getElementById("progress");
const questionEl = document.getElementById("question");
const promptEl = document.getElementById("prompt");
const hintEl = document.getElementById("hint");
const choicesEl = document.getElementById("choices");
const typedEl = document.getElementById("typed");
const typedInput = document.getElementById("typed-input");
const submitBtn = document.getElementById("submit");
const feedbackEl = document.getElementById("feedback");
const nextBtn = document.getElementById("next");
const summaryEl = document.getElementById("summary");
const emptyEl = document.getElementById("empty");
const againBtn = document.getElementById("again");
const modeSelect = document.getElementById("mode");

let entryOf = new Map();    // word -> { reading, meaning }
let allMeanings = [];       // every short meaning, used only as a fallback
let graph = null;           // word graph, for distractors and propagation
let deck = {};              // word -> card
let session = null;
let answered = false;
let typedMode = false;

function shortMeaning(meaning) {
  return (meaning || "").split(",")[0].trim();
}

// Short meaning of a dictionary word, for use as a distractor.
function meaningOfWord(word) {
  const info = entryOf.get(word);
  return info ? shortMeaning(info.meaning) : "";
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

function startNewSession() {
  const due = dueWords(Object.values(deck), Date.now());
  feedbackEl.textContent = "";
  summaryEl.hidden = true;
  againBtn.hidden = true;
  nextBtn.hidden = true;
  questionEl.hidden = true;
  emptyEl.hidden = true;

  if (due.length === 0) {
    progressEl.textContent = "";
    emptyEl.hidden = false;
    return;
  }
  session = startSession(due, SESSION_SIZE);
  typedMode = modeSelect.value === "typed";
  progressEl.textContent = `Session: ${session.queue.length} question(s)`;
  showQuestion();
}

function showQuestion() {
  if (isFinished(session)) {
    showSummary();
    return;
  }

  answered = false;
  feedbackEl.textContent = "";
  nextBtn.hidden = true;
  choicesEl.innerHTML = "";
  typedInput.value = "";
  questionEl.hidden = false;

  const card = currentCard(session);
  const info = entryOf.get(card.word) || { reading: "", meaning: "" };
  const correct = shortMeaning(info.meaning);
  progressEl.textContent = `Question ${session.index + 1} of ${session.queue.length}`;

  if (typedMode) {
    // Show the meaning, ask for the reading.
    promptEl.textContent = correct;
    hintEl.textContent = "Type the reading of this word";
    choicesEl.hidden = true;
    typedEl.hidden = false;
    typedInput.focus();
    return;
  }

  // Show the word, pick its meaning. Wrong choices are graph neighbors first.
  promptEl.textContent = card.word;
  hintEl.textContent = info.reading;
  choicesEl.hidden = false;
  typedEl.hidden = true;

  const distractors = graphDistractors(card.word, correct, graph, meaningOfWord, allMeanings);
  const options = buildMultipleChoice(correct, distractors);
  for (const option of options) {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = option;
    btn.addEventListener("click", () => {
      btn.classList.add(option === correct ? "right" : "wrong");
      markRight(correct);
      answer(option === correct);
    });
    choicesEl.appendChild(btn);
  }
}

function markRight(correct) {
  for (const b of choicesEl.querySelectorAll(".choice")) {
    if (b.textContent === correct) b.classList.add("right");
  }
}

// Called once per question with whether the answer was right.
async function answer(isCorrect) {
  if (answered || !currentCard(session)) return;
  answered = true;

  const now = Date.now();
  const card = currentCard(session);
  deck[card.word] = review(deck[card.word] || card, isCorrect, now);
  if (!isCorrect) {
    const updated = propagateWrongAnswer(Object.values(deck), graph, card.word, now);
    deck = Object.fromEntries(updated.map((c) => [c.word, c]));
  }
  await saveDeck();

  session = recordAnswer(session, isCorrect);
  const info = entryOf.get(card.word) || { reading: "", meaning: "" };
  feedbackEl.textContent = isCorrect
    ? "Correct."
    : `Not quite. Reading: ${info.reading}. Meaning: ${shortMeaning(info.meaning)}`;
  nextBtn.hidden = false;
}

function submitTyped() {
  if (answered || !currentCard(session)) return;
  const card = currentCard(session);
  const info = entryOf.get(card.word) || { reading: "", meaning: "" };
  answer(checkTyped(typedInput.value, info.reading));
}

function showSummary() {
  questionEl.hidden = true;
  progressEl.textContent = "";
  const s = summarize(session);
  summaryEl.hidden = false;
  summaryEl.textContent = `Score: ${s.correct} of ${s.total} (${s.percent}%)`;
  againBtn.hidden = false;
}

submitBtn.addEventListener("click", submitTyped);
typedInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") submitTyped();
});
nextBtn.addEventListener("click", showQuestion);
againBtn.addEventListener("click", startNewSession);
modeSelect.addEventListener("change", startNewSession);

async function init() {
  const text = await (await fetch(chrome.runtime.getURL("data/dictionary_full.tsv"))).text();
  const entries = parseDictionary(text);
  graph = buildWordGraph(entries);
  for (const e of entries) {
    if (!entryOf.has(e.word)) entryOf.set(e.word, { reading: e.reading, meaning: e.meaning });
  }
  allMeanings = entries.map((e) => shortMeaning(e.meaning)).filter(Boolean);
  deck = await loadDeck();
  startNewSession();
}

init();

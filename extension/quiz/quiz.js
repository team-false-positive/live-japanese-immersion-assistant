// extension/quiz/quiz.js
// Week 8 Module A and B, restyled in Week 9 Module C, fixed in Week 11 B (bug 6).
//
// Uses the same deck as the review screen (chrome.storage.local "cards"), so
// answers here affect the same schedule. Wrong answers also run propagation.
// In multiple-choice mode, wrong choices come from graph neighbors.

const CARDS_KEY = "cards";
const SESSION_SIZE = 10;

const progressEl = document.getElementById("progress");
const streakEl = document.getElementById("streak");
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

// A time gap as plain words: "about 2 hours", "about 15 minutes", "about 3 days".
function describeWait(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `about ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `about ${days} days`;
}

// The message shown when nothing is due: when the next word comes back.
function nothingDueMessage() {
  const now = Date.now();
  const upcoming = Object.values(deck)
    .map((c) => c.due)
    .filter((due) => due > now)
    .sort((a, b) => a - b);
  if (upcoming.length === 0) {
    return "Nothing is due, and your deck is empty. Add words on the Review screen.";
  }
  return `Nothing is due right now. The next word comes back in ${describeWait(upcoming[0] - now)}. Come back then, or add words on the Review screen.`;
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
  feedbackEl.className = "";
  summaryEl.hidden = true;
  againBtn.hidden = true;
  nextBtn.hidden = true;
  questionEl.hidden = true;
  emptyEl.hidden = true;

  if (due.length === 0) {
    progressEl.textContent = "";
    emptyEl.textContent = nothingDueMessage();
    emptyEl.hidden = false;
    againBtn.hidden = false;
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
  feedbackEl.className = "";
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
      if (answered) return;
      if (option !== correct) btn.classList.add("wrong");
      markRight(correct);
      answer(option === correct, btn);
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
// element is the button or input to animate.
async function answer(isCorrect, element) {
  if (answered || !currentCard(session)) return;
  answered = true;

  animateAnswer(element, isCorrect);
  updateStreak(isCorrect);
  renderStreak(streakEl);

  const now = Date.now();
  const card = currentCard(session);
  deck[card.word] = review(deck[card.word] || card, isCorrect, now);
  if (!isCorrect) {
    if (!graph) graph = buildWordGraph(allEntries);
    const updated = propagateWrongAnswer(Object.values(deck), graph, card.word, now);
    deck = Object.fromEntries(updated.map((c) => [c.word, c]));
  }
  await saveDeck();

  session = recordAnswer(session, isCorrect);
  const info = entryOf.get(card.word) || { reading: "", meaning: "" };
  const answerText = typedMode ? info.reading : shortMeaning(info.meaning);
  feedbackEl.className = isCorrect ? "feedback-correct" : "feedback-wrong";
  feedbackEl.textContent = feedbackMessage(isCorrect, answerText);
  nextBtn.hidden = false;
}

function submitTyped() {
  if (answered || !currentCard(session)) return;
  const card = currentCard(session);
  const info = entryOf.get(card.word) || { reading: "", meaning: "" };
  answer(checkTyped(typedInput.value, info.reading), typedInput);
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

let allEntries = [];

async function init() {
  const text = await (await fetch(chrome.runtime.getURL("data/dictionary_full.tsv"))).text();
  allEntries = parseDictionary(text);
  graph = buildWordGraph(allEntries);
  for (const e of allEntries) {
    if (!entryOf.has(e.word)) entryOf.set(e.word, { reading: e.reading, meaning: e.meaning });
  }
  allMeanings = allEntries.map((e) => shortMeaning(e.meaning)).filter(Boolean);
  deck = await loadDeck();
  renderStreak(streakEl);
  startNewSession();
}

init();

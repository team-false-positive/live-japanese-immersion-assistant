// extension/quiz/quiz-engine.js
//
// Week 8 Module A and B: quiz engine (pure logic, no browser APIs).
//
// Two question types:
//   - multiple choice: see the word, pick its meaning from four choices
//   - typed recall:    see the meaning, type the reading in hiragana
// A session takes a list of due cards (from the scheduler), asks them in
// order, and keeps score.
//
// Week 8 B: wrong choices in multiple choice come from graph neighbors, the
// words that share a kanji with the question word, so they look similar and
// are harder to guess. Random meanings are used only as a fallback.

const CHOICE_COUNT = 4;

// Converts katakana to hiragana, so a typed reading matches whichever kana the dictionary uses.
function toHiragana(text) {
  return text.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// Trims spaces, removes internal spaces, and converts to hiragana.
function normalizeReading(text) {
  return toHiragana(text.trim()).replace(/\s+/g, "");
}

// True if the typed text matches the reading. An empty reading never matches.
function checkTyped(typed, reading) {
  const expected = normalizeReading(reading || "");
  return expected.length > 0 && normalizeReading(typed || "") === expected;
}

// Wrong choices from the word's graph neighbors, strongest link first.
// meaningOf(word) returns that word's short meaning. fallback is a list of
// meanings to draw from when the graph gives too few. rng returns a number in [0, 1).
function graphDistractors(word, correct, graph, meaningOf, fallback, rng = Math.random, count = CHOICE_COUNT - 1) {
  const picked = [];
  const row = graph.edges.get(word);
  if (row) {
    const ranked = [...row.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    for (const [neighbor] of ranked) {
      const m = meaningOf(neighbor);
      if (m && m !== correct && !picked.includes(m)) picked.push(m);
      if (picked.length >= count) break;
    }
  }
  for (let attempts = 0; picked.length < count && attempts < fallback.length * 3; attempts++) {
    const m = fallback[Math.floor(rng() * fallback.length)];
    if (m && m !== correct && !picked.includes(m)) picked.push(m);
  }
  return picked;
}

// Four options: the correct meaning plus distractors. rng returns a number in [0, 1).
function buildMultipleChoice(correct, distractors, rng = Math.random) {
  const options = [correct];
  for (const d of distractors) {
    if (options.length >= CHOICE_COUNT) break;
    if (d && !options.includes(d)) options.push(d);
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

// A session asks the first `size` cards of dueCards, in the order given (most overdue first).
function startSession(dueCards, size = 10) {
  return { queue: dueCards.slice(0, size), index: 0, correct: 0, wrong: 0 };
}

function currentCard(session) {
  return session.queue[session.index] || null;
}

function recordAnswer(session, correct) {
  return {
    ...session,
    index: session.index + 1,
    correct: session.correct + (correct ? 1 : 0),
    wrong: session.wrong + (correct ? 0 : 1),
  };
}

function isFinished(session) {
  return session.index >= session.queue.length;
}

// Score for the session, as counts and a whole-number percentage.
function summarize(session) {
  const total = session.correct + session.wrong;
  return {
    total,
    correct: session.correct,
    percent: total ? Math.round((100 * session.correct) / total) : 0,
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    CHOICE_COUNT,
    toHiragana,
    normalizeReading,
    checkTyped,
    graphDistractors,
    buildMultipleChoice,
    startSession,
    currentCard,
    recordAnswer,
    isFinished,
    summarize,
  };
}

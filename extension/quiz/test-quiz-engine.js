// extension/quiz/test-quiz-engine.js
// Run from the project root:  node extension/quiz/test-quiz-engine.js
const {
  CHOICE_COUNT, toHiragana, normalizeReading, checkTyped,
  buildMultipleChoice, startSession, currentCard, recordAnswer, isFinished, summarize,
} = require("./quiz-engine.js");

let failures = 0;
function check(condition, description) {
  if (condition) {
    console.log("[PASS] " + description);
  } else {
    console.log("[FAIL] " + description);
    failures++;
  }
}

// Fixed random source, so shuffles are repeatable.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x80000000;
  };
}

// 1. kana handling
check(toHiragana("カード") === "かーど", "katakana converts to hiragana");
check(toHiragana("めいはく") === "めいはく", "hiragana is left unchanged");
check(normalizeReading(" めい は く ") === "めいはく", "spaces are removed before comparing");

// 2. typed answers
check(checkTyped("めいはく", "めいはく"), "the correct reading is accepted");
check(checkTyped("メイハク", "めいはく"), "the reading typed in katakana is accepted");
check(checkTyped(" めいはく ", "めいはく"), "surrounding spaces are ignored");
check(!checkTyped("めいはい", "めいはく"), "a wrong reading is rejected");
check(!checkTyped("", "めいはく"), "an empty answer is rejected");
check(!checkTyped("", ""), "an empty reading never matches");

// 3. multiple choice
const options = buildMultipleChoice("obvious", ["card", "clear", "obvious", "plain", "tomorrow"], seeded(7));
check(options.length === CHOICE_COUNT, "there are four options");
check(options.includes("obvious"), "the correct meaning is among the options");
check(new Set(options).size === options.length, "no option appears twice");
check(
  JSON.stringify(buildMultipleChoice("obvious", ["card", "clear", "plain", "tomorrow"], seeded(7))) ===
  JSON.stringify(buildMultipleChoice("obvious", ["card", "clear", "plain", "tomorrow"], seeded(7))),
  "the same random source gives the same order"
);
check(buildMultipleChoice("obvious", ["a", "b"], seeded(3)).length === 3, "with few distractors, fewer options are returned");

// 4. session flow
const due = ["A", "B", "C"].map((w) => ({ word: w }));
let session = startSession(due, 2);
check(session.queue.length === 2, "a session takes at most the requested number of cards");
check(currentCard(session).word === "A", "the first card asked is the first due card");
check(!isFinished(session), "a new session is not finished");

session = recordAnswer(session, true);
check(currentCard(session).word === "B", "after an answer, the next card is asked");
session = recordAnswer(session, false);
check(isFinished(session), "the session is finished after the last card");
check(currentCard(session) === null, "there is no current card after the session ends");

// 5. scoring
const result = summarize(session);
check(result.total === 2 && result.correct === 1, "the summary counts answers and correct ones");
check(result.percent === 50, "the summary gives the percentage correct");
check(summarize(startSession([], 5)).percent === 0, "an empty session scores 0%, without dividing by zero");

// 6. an empty deck gives an empty session
check(isFinished(startSession([], 10)), "an empty deck starts a session that is already finished");

console.log(failures === 0 ? "\nAll quiz-engine tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

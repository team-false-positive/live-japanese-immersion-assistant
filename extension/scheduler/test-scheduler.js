// extension/scheduler/test-scheduler.js
// Run from the project root:  node extension/scheduler/test-scheduler.js
const { MINUTE, DAY, WRONG_RETRY_MS, createCard, review, dueWords, MinHeap } = require("./scheduler.js");

let failures = 0;
function check(condition, description) {
  if (condition) {
    console.log("[PASS] " + description);
  } else {
    console.log("[FAIL] " + description);
    failures++;
  }
}

const NOW = 1_000_000_000_000; // fixed clock so results are repeatable

// 1. new cards
const card = createCard("明白", NOW);
check(card.due === NOW && card.interval === 1, "a new card is due immediately with interval 1 day");

// 2. correct answers lengthen the interval
const once = review(card, true, NOW);
check(once.interval === 2 && once.due === NOW + 2 * DAY, "one correct answer makes the interval 2 days");
const twice = review(once, true, NOW);
check(twice.interval === 4, "two correct answers make the interval 4 days");

// 3. wrong answers reset the interval and bring the word back soon
const wrong = review(twice, false, NOW);
check(wrong.interval === 1, "a wrong answer resets the interval to 1 day");
check(wrong.due === NOW + WRONG_RETRY_MS, "a wrong answer brings the word back after 10 minutes");
check(wrong.wrong === 1 && wrong.correct === 2, "answer counts are kept");

// 4. review does not change the card it is given
check(card.interval === 1 && card.correct === 0, "review returns a new card and leaves the old one unchanged");

// 5. due words: only those due now, most overdue first
const cards = [
  { word: "A", due: NOW - 1 * DAY },   // most overdue
  { word: "B", due: NOW + 1 * DAY },   // not due
  { word: "C", due: NOW - 3 * DAY },   // overdue the most
  { word: "D", due: NOW },             // due exactly now
];
const due = dueWords(cards, NOW).map((c) => c.word);
check(JSON.stringify(due) === JSON.stringify(["C", "A", "D"]), "due words are C, A, D, most overdue first");
check(!due.includes("B"), "a word not yet due is left out");

// 6. the due list changes as answers change
let deck = [createCard("一", NOW - DAY), createCard("二", NOW - DAY), createCard("三", NOW - DAY)];
check(dueWords(deck, NOW).length === 3, "all three new cards are due");
deck = deck.map((c) => (c.word === "一" ? review(c, true, NOW) : c));
check(dueWords(deck, NOW).length === 2, "after answering 一 correctly, it leaves the due list");
deck = deck.map((c) => (c.word === "二" ? review(c, false, NOW) : c));
check(dueWords(deck, NOW).length === 1, "a wrong answer takes 二 out of the due list for now");
check(dueWords(deck, NOW + WRONG_RETRY_MS).some((c) => c.word === "二"), "二 is due again after 10 minutes");

// 7. heap order
const heap = new MinHeap((x) => x);
[5, 1, 4, 2, 3].forEach((x) => heap.push(x));
const popped = [];
while (heap.size > 0) popped.push(heap.pop());
check(JSON.stringify(popped) === JSON.stringify([1, 2, 3, 4, 5]), "the min-heap pops values in ascending order");

console.log(failures === 0 ? "\nAll scheduler tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

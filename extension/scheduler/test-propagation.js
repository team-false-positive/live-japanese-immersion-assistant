// extension/scheduler/test-propagation.js
// Run from the project root:  node extension/scheduler/test-propagation.js
const { DAY, WRONG_RETRY_MS, createCard, review } = require("./scheduler.js");
const { propagateWrongAnswer } = require("./propagation.js");
const { parseDictionary, buildWordGraph } = require("../graph/word-graph.js");

let failures = 0;
function check(condition, description) {
  if (condition) {
    console.log("[PASS] " + description);
  } else {
    console.log("[FAIL] " + description);
    failures++;
  }
}

const NOW = 1_000_000_000_000;
const LATER = NOW + 3 * DAY; // every card starts due three days from now

// Small hand-built graph:  A - B - C - D,   X alone
function chainGraph() {
  const edges = new Map();
  const link = (a, b) => {
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!edges.has(x)) edges.set(x, new Map());
      edges.get(x).set(y, 1);
    }
  };
  link("A", "B");
  link("B", "C");
  link("C", "D");
  return { edges };
}

const deck = ["A", "B", "C", "D", "X"].map((w) => ({ ...createCard(w, LATER), due: LATER }));
const graph = chainGraph();
const after = propagateWrongAnswer(deck, graph, "A", NOW);
const dueOf = (w) => after.find((c) => c.word === w).due;

// 1. fade with distance
check(dueOf("B") === NOW + 0.5 * DAY, "one hop away (B) is pulled to half a day");
check(dueOf("C") === NOW + 0.75 * DAY, "two hops away (C) is pulled to three-quarters of a day");
check(dueOf("B") < dueOf("C"), "the closer word comes back sooner than the farther one");

// 2. hop limit
check(dueOf("D") === LATER, "three hops away (D) is beyond the limit and unchanged");

// 3. unrelated words
check(dueOf("X") === LATER, "an unconnected word (X) is unchanged");

// 4. the wrong word itself is left to review()
check(dueOf("A") === LATER, "the wrong word is not changed by propagation");

// 5. never pushed later
const soon = { ...createCard("B", NOW), due: NOW + 1000 }; // already due sooner than the pull
const kept = propagateWrongAnswer([soon], graph, "A", NOW)[0];
check(kept.due === NOW + 1000, "a card already due sooner is not pushed later");

// 6. inputs are not changed
check(deck[1].due === LATER, "propagation returns new cards and leaves the input unchanged");

// 7. full flow: review the wrong word, then propagate
const wrong = review(createCard("A", NOW), false, NOW);
const flow = propagateWrongAnswer([wrong, ...deck.slice(1)], graph, "A", NOW);
check(flow.find((c) => c.word === "A").due === NOW + WRONG_RETRY_MS, "after review, the wrong word comes back in 10 minutes");
check(flow.find((c) => c.word === "B").due < flow.find((c) => c.word === "C").due, "after propagation, related words come back in order of distance");

// 8. real graph from dictionary entries: 明白 and 明日 share 明, so they are linked
const dictionary = parseDictionary("明白\tめいはく\tobvious\n明日\tあした\ttomorrow\nカード\tかーど\tcard\n");
const realGraph = buildWordGraph(dictionary);
const realDeck = ["明白", "明日", "カード"].map((w) => ({ ...createCard(w, LATER), due: LATER }));
const realAfter = propagateWrongAnswer(realDeck, realGraph, "明白", NOW);
const realDue = (w) => realAfter.find((c) => c.word === w).due;
check(realDue("明日") === NOW + 0.5 * DAY, "明日 (shares 明 with the wrong word) is pulled earlier");
check(realDue("カード") === LATER, "カード (no shared kanji) is unchanged");

console.log(failures === 0 ? "\nAll propagation tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

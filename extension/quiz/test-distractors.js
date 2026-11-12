// extension/quiz/test-distractors.js
// Run from the project root:  node extension/quiz/test-distractors.js
const { graphDistractors, buildMultipleChoice } = require("./quiz-engine.js");
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

// Fixed random source, so results are repeatable.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x80000000;
  };
}

// Hand-built graph: A is linked to B (weight 1), C (weight 2), D (weight 3).
const edges = new Map([
  ["A", new Map([["B", 1], ["C", 2], ["D", 3]])],
  ["B", new Map([["A", 1]])],
  ["C", new Map([["A", 2]])],
  ["D", new Map([["A", 3]])],
  ["E", new Map([["F", 1]])],
  ["F", new Map([["E", 1]])],
]);
const graph = { edges };
const meanings = { A: "a", B: "b", C: "c", D: "d", E: "e", F: "f" };
const meaningOf = (w) => meanings[w] || "";
const FALLBACK = ["x", "y", "z", "w"];

// 1. strongest neighbors come first
const picked = graphDistractors("A", "a", graph, meaningOf, FALLBACK, seeded(1), 3);
check(JSON.stringify(picked) === JSON.stringify(["d", "c", "b"]), "neighbors are used strongest link first (d, c, b)");

// 2. the correct meaning is never used as a distractor
const withCorrectInGraph = graphDistractors("A", "d", graph, meaningOf, FALLBACK, seeded(1), 3);
check(!withCorrectInGraph.includes("d"), "a neighbor with the correct meaning is skipped");
check(withCorrectInGraph.length === 3, "the next neighbors fill the gap, so three distractors are still returned");

// 3. fallback when the graph is thin
const thin = graphDistractors("E", "e", graph, meaningOf, FALLBACK, seeded(5), 3);
check(thin.length === 3, "a word with one neighbor still gets three distractors");
check(thin[0] === "f", "the neighbor's meaning comes first");
check(thin.slice(1).every((m) => FALLBACK.includes(m)), "the rest come from the fallback list");
check(new Set(thin).size === thin.length, "no distractor is repeated");

// 4. a word not in the graph uses only the fallback
const unknown = graphDistractors("Z", "e", graph, meaningOf, FALLBACK, seeded(9), 3);
check(unknown.length === 3 && unknown.every((m) => FALLBACK.includes(m)), "a word not in the graph uses only the fallback");

// 5. the options built from them are four, with the correct one included
const options = buildMultipleChoice("a", picked, seeded(2));
check(options.length === 4 && options.includes("a"), "the question gets four options including the correct meaning");

// 6. real dictionary entries: words sharing a kanji are the distractors
const dictionary = parseDictionary(
  "明白\tめいはく\tobvious\n" +
  "明日\tあした\ttomorrow\n" +
  "白紙\tはくし\tblank paper\n" +
  "カード\tかーど\tcard\n"
);
const realGraph = buildWordGraph(dictionary);
const realMeaning = (w) => {
  const e = dictionary.find((x) => x.word === w);
  return e ? e.meaning.split(",")[0].trim() : "";
};
const realPick = graphDistractors("明白", "obvious", realGraph, realMeaning, ["card"], seeded(3), 3);
check(realPick.includes("tomorrow") && realPick.includes("blank paper"), "明白's distractors include 明日 and 白紙, which share a kanji with it");
check(!realPick.includes("obvious") && realPick.length === 3, "the correct meaning is not used and three choices are returned");

console.log(failures === 0 ? "\nAll distractor tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

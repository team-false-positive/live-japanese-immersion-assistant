// tools/benchmark.js
// Week 11 Module A: performance measurement.
//
// Times the operations the app runs most, on the full dictionary and a deck
// of every kanji word. Reports the median of several runs, so one slow run
// does not skew the result.
//
// Usage (from the project root):
//   node tools/benchmark.js

const fs = require("fs");
const { parseDictionary, buildWordGraph } = require("../extension/graph/word-graph.js");
const { createCard, DAY } = require("../extension/scheduler/scheduler.js");
const { propagateWrongAnswer } = require("../extension/scheduler/propagation.js");
const { graphDistractors } = require("../extension/quiz/quiz-engine.js");
const { buildPartIndex, kanjiContaining } = require("../extension/kanji/kanji-tree.js");
const { nextWords } = require("../extension/recommend/next-words.js");

// Runs fn several times and returns the median time in milliseconds.
function median(runs, fn) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const start = process.hrtime.bigint();
    fn();
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

const results = [];
function record(label, ms, note = "") {
  results.push({ label, ms, note });
}

const dictionaryText = fs.readFileSync("data/dictionary_full.tsv", "utf8");
const radicals = JSON.parse(fs.readFileSync("data/kanji-radicals.json", "utf8"));

// 1. Loading: this runs every time a page that uses the dictionary opens.
let entries;
record("parse dictionary (22,572 lines)", median(5, () => { entries = parseDictionary(dictionaryText); }),
  "runs on every page that uses the dictionary");

let graph;
record("build word graph", median(5, () => { graph = buildWordGraph(entries); }),
  "runs on every page that uses the dictionary");

// 2. Per question: the quiz picks distractors once per question.
const words = [...graph.wordKanji.keys()];
const meaningOf = (w) => {
  const e = entries.find((x) => x.word === w); // slow on purpose: measures a real call pattern
  return e ? e.meaning.split(",")[0].trim() : "";
};
const fallback = entries.slice(0, 500).map((e) => e.meaning.split(",")[0].trim());
const sampleWords = words.filter((_, i) => i % 40 === 0).slice(0, 25);
const perCall = median(5, () => {
  for (const w of sampleWords) graphDistractors(w, "x", graph, meaningOf, fallback);
}) / sampleWords.length;
record("graph distractors, per question", perCall, "runs once per quiz question");

// 3. Per wrong answer: propagation over the whole deck.
const deck = words.map((w, i) => {
  const due = Date.now() + ((i * 7) % 10 + 1) * DAY;
  return { ...createCard(w, due), due };
});
const wrong = words[0];
record("propagation over 17,890 cards", median(5, () => {
  propagateWrongAnswer(deck, graph, wrong, Date.now());
}), "runs once per wrong answer");

// 4. Suggestions: next words over the whole dictionary.
const knownKanji = new Set(["日", "本", "人", "一", "大", "年", "月", "木", "水", "火"]);
const knownWords = new Set(["日本", "人", "一"]);
record("next words over full dictionary", median(5, () => {
  nextWords(entries, knownKanji, knownWords, { count: 15 });
}), "runs when the Next words page opens");

// 5. Kanji explorer: index build and a common-kanji lookup.
record("build kanji part index", median(5, () => { buildPartIndex(radicals); }),
  "runs when the Kanji page opens");
const index = buildPartIndex(radicals);
record("list kanji containing 日", median(20, () => { kanjiContaining("日", index); }),
  "runs on each click in the explorer");

// Report.
console.log("Operation                              median (ms)  when it runs");
console.log("-------------------------------------  -----------  ------------");
for (const r of results) {
  console.log(`${r.label.padEnd(37)}  ${r.ms.toFixed(2).padStart(11)}  ${r.note}`);
}
const slowest = results.reduce((a, b) => (b.ms > a.ms ? b : a));
console.log(`\nSlowest: ${slowest.label} (${slowest.ms.toFixed(2)} ms)`);

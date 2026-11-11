// extension/graph/test-word-graph.js
// Run from the project root:  node extension/graph/test-word-graph.js
const fs = require("fs");
const { kanjiOf, parseDictionary, buildWordGraph, neighbors } = require("./word-graph.js");

const MAX_WORDS_PER_KANJI = 80; // must match the default in word-graph.js

let failures = 0;
function check(condition, description) {
  if (condition) {
    console.log("[PASS] " + description);
  } else {
    console.log("[FAIL] " + description);
    failures++;
  }
}

// 1. kanji extraction
check(JSON.stringify(kanjiOf("明白")) === JSON.stringify(["明", "白"]), "kanjiOf extracts 明 and 白 from 明白");
check(kanjiOf("カード").length === 0, "katakana-only word has no kanji");

// 2. parsing
const sample = parseDictionary("明白\tめいはく\tobvious\n\nカード\tかーど\tcard\n");
check(sample.length === 2, "parseDictionary skips blank lines");
check(sample[0].word === "明白" && sample[0].reading === "めいはく", "parseDictionary reads word and reading");

// 3. full dictionary
const path = "data/dictionary_full.tsv";
if (!fs.existsSync(path)) {
  console.log("[FAIL] " + path + " not found. Run this from the project root.");
  process.exit(1);
}
const entries = parseDictionary(fs.readFileSync(path, "utf8"));
const started = Date.now();
const graph = buildWordGraph(entries, { maxWordsPerKanji: MAX_WORDS_PER_KANJI });
const ms = Date.now() - started;
console.log(`entries: ${entries.length}, words with kanji: ${graph.wordKanji.size}, build time: ${ms} ms`);
check(graph.wordKanji.size > 1000, "graph contains more than 1000 kanji words");

// Kanji the graph actually links through: skips very common ones.
const usable = (k) => graph.kanjiIndex.get(k).length <= MAX_WORDS_PER_KANJI;

// 4. every edge is symmetric and its weight equals the usable shared kanji
let symmetric = true, weightsMatch = true, checked = 0;
for (const [a, row] of graph.edges) {
  for (const [b, weight] of row) {
    checked++;
    const back = graph.edges.get(b);
    if (!back || back.get(a) !== weight) symmetric = false;
    const kb = new Set(graph.wordKanji.get(b));
    const shared = graph.wordKanji.get(a).filter((k) => kb.has(k) && usable(k)).length;
    if (shared !== weight) weightsMatch = false;
  }
  if (checked > 20000) break; // checking a sample is enough
}
check(symmetric, "edges are symmetric (A to B has the same weight as B to A)");
check(weightsMatch, "edge weight equals the number of shared kanji the graph uses");

// 5. neighbors of a sample word
const sampleWord = "明白";
const near = neighbors(graph, sampleWord, 8);
console.log(`\nNeighbors of ${sampleWord}:`);
for (const n of near) {
  console.log(`  ${n.word}  weight ${n.weight}`);
}
check(near.length > 0, `${sampleWord} has neighbors`);
const everyNeighborSharesKanji = near.every((n) => {
  const shared = kanjiOf(n.word).filter((k) => kanjiOf(sampleWord).includes(k));
  return shared.length > 0;
});
check(everyNeighborSharesKanji, `every neighbor of ${sampleWord} shares a kanji with it`);

console.log(failures === 0 ? "\nAll word-graph tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

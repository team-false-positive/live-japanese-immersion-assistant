// extension/scheduler/tune-propagation.js
// Week 7 Module D: tuning and sanity checks for propagation.
// Run from the project root:  node extension/scheduler/tune-propagation.js
//
// The deck is every kanji word in the dictionary, with due times spread over
// 1 to 10 days, so decay changes both how many cards move and how soon they
// come back. The table shows each combination.

const fs = require("fs");
const { createCard, DAY } = require("./scheduler.js");
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
const entries = parseDictionary(fs.readFileSync("data/dictionary_full.tsv", "utf8"));
const graph = buildWordGraph(entries);
const words = [...graph.wordKanji.keys()];

// Deterministic spread: due in 1 to 10 days, so results can be repeated.
const deck = words.map((w, i) => {
  const due = NOW + ((i * 7) % 10 + 1) * DAY;
  return { ...createCard(w, due), due };
});
console.log(`deck: ${deck.length} cards, graph covers ${graph.edges.size} words\n`);

// Sample wrong words: the most connected words, so the worst cases are included.
const sample = [...graph.edges.entries()]
  .sort((a, b) => b[1].size - a[1].size)
  .slice(0, 20)
  .map(([w]) => w);

const DECAYS = [0.3, 0.5, 0.7];
const CAPS = [10, 1000]; // 1000 is effectively no cap, for comparison
const rows = [];

for (const maxPerWord of CAPS) {
  for (const decay of DECAYS) {
    let totalMoved = 0, worstMoved = 0, worstMs = 0, totalDelay = 0, delayCount = 0;
    let withinCap = true;

    for (const wrong of sample) {
      const started = process.hrtime.bigint();
      const out = propagateWrongAnswer(deck, graph, wrong, NOW, { decay, maxPerWord });
      const ms = Number(process.hrtime.bigint() - started) / 1e6;

      let moved = 0;
      for (let i = 0; i < deck.length; i++) {
        if (out[i].due !== deck[i].due) {
          moved++;
          totalDelay += out[i].due - NOW;
          delayCount++;
        }
      }
      totalMoved += moved;
      worstMoved = Math.max(worstMoved, moved);
      worstMs = Math.max(worstMs, ms);

      // With a cap of k per word and two hops, at most k + k*k cards can move.
      if (maxPerWord === 10 && moved > 10 + 10 * 10) withinCap = false;
    }

    rows.push({
      cap: maxPerWord,
      decay,
      avgMoved: Math.round(totalMoved / sample.length),
      worstMoved,
      avgDelayHours: delayCount ? (totalDelay / delayCount / (60 * 60 * 1000)).toFixed(1) : "-",
      worstMs: worstMs.toFixed(1),
    });

    if (maxPerWord === 10) {
      check(withinCap, `cap 10, decay ${decay}: never moves more than 10 + 100 cards`);
      check(worstMs < 200, `cap 10, decay ${decay}: worst run under 200 ms (took ${worstMs.toFixed(1)} ms)`);
    }
  }
}

console.log("\nCap   Decay  avg moved  worst moved  avg delay (h)  worst time (ms)");
for (const r of rows) {
  console.log(
    `${String(r.cap).padEnd(5)} ${String(r.decay).padEnd(6)} ${String(r.avgMoved).padEnd(10)} ` +
    `${String(r.worstMoved).padEnd(12)} ${String(r.avgDelayHours).padEnd(14)} ${r.worstMs}`
  );
}

console.log(failures === 0 ? "\nAll tuning checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

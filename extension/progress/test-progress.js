// extension/progress/test-progress.js
// Run from the project root:  node extension/progress/test-progress.js
const { LEVELS, parseLevels, levelProgress } = require("./progress-logic.js");

let failures = 0;
function check(condition, description) {
  if (condition) {
    console.log("[PASS] " + description);
  } else {
    console.log("[FAIL] " + description);
    failures++;
  }
}

// 1. parsing
const parsed = parseLevels("明日\tN5\n\n白紙\tn4\n謎\tX9\n食べる\tN3\n");
check(parsed.length === 3, "lines with an unknown level are skipped, and blank lines ignored");
check(parsed[1].word === "白紙" && parsed[1].level === "N4", "levels are read in either case");
check(LEVELS.length === 5, "there are five JLPT levels, N5 to N1");

// 2. counts and percentages
const entries = [
  { word: "明日", level: "N5" },
  { word: "食べる", level: "N5" },
  { word: "白紙", level: "N4" },
  { word: "謎", level: "N4" },
  { word: "明白", level: "N4" },
  { word: "一", level: "N3" },
];
const deck = {
  "明日": { interval: 4 },   // learned
  "食べる": { interval: 1 }, // seen, not yet learned
  "白紙": { interval: 8 },   // learned
  "明白": { interval: 2 },   // seen, not yet learned
  "不在": { interval: 16 },  // in the deck but not on any level list
};
const rows = levelProgress(entries, deck);
const row = (level) => rows.find((r) => r.level === level);

check(row("N5").total === 2 && row("N5").seen === 2 && row("N5").learned === 1, "N5: two words, both seen, one learned");
check(row("N5").percent === 50, "N5: 50% learned");
check(row("N4").total === 3 && row("N4").seen === 2 && row("N4").learned === 1, "N4: three words, two seen, one learned");
check(row("N4").percent === 33, "N4: 33% learned, rounded");
check(row("N3").total === 1 && row("N3").seen === 0 && row("N3").percent === 0, "N3: one word not in the deck, so 0% seen");
check(row("N2").total === 0 && row("N2").percent === 0, "a level with no words shows 0%, without dividing by zero");
check(rows.length === 5, "every level is reported, even empty ones");

// 3. a word with interval exactly 4 days counts as learned; 3 does not
const edge = levelProgress([{ word: "A", level: "N5" }, { word: "B", level: "N5" }], {
  "A": { interval: 4 },
  "B": { interval: 3 },
});
check(edge[0].learned === 1, "an interval of exactly 4 days counts as learned, 3 days does not");

console.log(failures === 0 ? "\nAll progress tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

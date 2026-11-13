// extension/recommend/test-next-words.js
// Run from the project root:  node extension/recommend/test-next-words.js
const fs = require("fs");
const { kanjiOfWord, nextWords } = require("./next-words.js");
const { parseDictionary } = require("../graph/word-graph.js");

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
check(JSON.stringify(kanjiOfWord("明白")) === JSON.stringify(["明", "白"]), "kanjiOfWord returns the kanji of a word");
check(kanjiOfWord("カード").length === 0, "a kana-only word has no kanji");

// Sample: the learner knows 明 and 白, and has 明白 in the deck.
const known = new Set(["明", "白"]);
const deckWords = new Set(["明白"]);
const sample = parseDictionary(
  "明日\tあした\ttomorrow\n" +      // 明 known, 日 unknown: suggested
  "白紙\tはくし\tblank paper\n" +   // 白 known, 紙 unknown: suggested
  "戦争\tせんそう\twar\n" +          // nothing known: not suggested
  "明白\tめいはく\tobvious\n" +      // already in the deck: not suggested
  "完全無欠\tかんぜんむけつ\tperfect\n" + // four unknown: too far ahead
  "明白な\tめいはくな\tobvious\n" +   // 明 and 白 known, no unknown: already known
  "カード\tかーど\tcard\n"            // no kanji: not suggested
);

// 2. the rules
const picks = nextWords(sample, known, deckWords, { count: 10 });
const words = picks.map((p) => p.word);
check(words.includes("明日"), "明日 is suggested (one unknown kanji)");
check(words.includes("白紙"), "白紙 is suggested (one unknown kanji)");
check(!words.includes("戦争"), "戦争 is not suggested (no known kanji)");
check(!words.includes("明白"), "a word already in the deck is not suggested");
check(!words.includes("完全無欠"), "a word with too many unknown kanji is not suggested");
check(!words.includes("明白な"), "a word whose kanji are all known is not suggested");
check(!words.includes("カード"), "a kana-only word is not suggested");

// 3. details and ranking
const tomorrow = picks.find((p) => p.word === "明日");
check(tomorrow && JSON.stringify(tomorrow.unknownKanji) === JSON.stringify(["日"]), "each suggestion lists its unknown kanji");
check(tomorrow && tomorrow.familiarity === 0.5, "familiarity is the share of kanji already known");

// 4. count limit
check(nextWords(sample, known, deckWords, { count: 1 }).length === 1, "the count option limits the number of suggestions");

// 5. real dictionary, with a deck of common kanji
const path = "data/dictionary_full.tsv";
if (!fs.existsSync(path)) {
  console.log(`[FAIL] ${path} not found. Run this from the project root.`);
  failures++;
} else {
  const entries = parseDictionary(fs.readFileSync(path, "utf8"));
  const realKnown = new Set(["日", "本", "人", "一", "大"]);
  const realDeck = new Set(["日本"]);
  const real = nextWords(entries, realKnown, realDeck, { count: 10 });
  check(real.length === 10, "the real dictionary gives ten suggestions for a common-kanji deck");
  check(real.every((p) => !realDeck.has(p.word)), "none of the real suggestions is already in the deck");
  check(real.every((p) => p.unknownKanji.length >= 1 && p.unknownKanji.length <= 2), "every real suggestion has one or two unknown kanji");
}

console.log(failures === 0 ? "\nAll next-word tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

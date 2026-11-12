// extension/kanji/test-kanji-tree.js
// Run from the project root:  node extension/kanji/test-kanji-tree.js
const fs = require("fs");
const {
  kanjiInWord, buildPartIndex, partsOf, kanjiContaining, knownKanjiFromWords,
} = require("./kanji-tree.js");

let failures = 0;
function check(condition, description) {
  if (condition) {
    console.log("[PASS] " + description);
  } else {
    console.log("[FAIL] " + description);
    failures++;
  }
}

// Sorted copy, so lists are compared as sets regardless of order.
const sorted = (arr) => [...arr].sort();
const sameSet = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

// Small sample: 日 appears in 明, 晴 and 時; 木 appears in 林 and 森.
const radicals = {
  "明": ["日", "月"],
  "晴": ["日", "青"],
  "時": ["日", "寺"],
  "林": ["木"],
  "森": ["木"],
};
const index = buildPartIndex(radicals);

// 1. kanji extraction from words
check(JSON.stringify(kanjiInWord("明白")) === JSON.stringify(["明", "白"]), "kanjiInWord returns the kanji of a word");
check(kanjiInWord("カード").length === 0, "a kana-only word has no kanji");
check(JSON.stringify(kanjiInWord("日日")) === JSON.stringify(["日"]), "a repeated kanji is listed once");

// 2. forward lookup
check(JSON.stringify(partsOf("明", radicals)) === JSON.stringify(["日", "月"]), "a kanji's parts are returned");
check(partsOf("一", radicals).length === 0, "a kanji with no data has no parts");

// 3. reverse lookup
check(sameSet(kanjiContaining("日", index), ["明", "晴", "時"]), "every kanji containing 日 is found");
check(sameSet(kanjiContaining("木", index), ["林", "森"]), "every kanji containing 木 is found");
check(kanjiContaining("火", index).length === 0, "a part no kanji contains gives an empty list");

// 4. filter to known kanji
const known = new Set(["明", "時", "林"]);
check(sameSet(kanjiContaining("日", index, known), ["明", "時"]), "with a known set, only known kanji containing 日 are returned");
check(kanjiContaining("日", index, new Set()).length === 0, "with no known kanji, nothing is returned");

// 5. the part itself is never listed
const selfIndex = buildPartIndex({ "日": ["日"], "明": ["日"] });
check(JSON.stringify(kanjiContaining("日", selfIndex)) === JSON.stringify(["明"]), "a part is never listed as containing itself");

// 6. known kanji from deck words
const knownFromDeck = knownKanjiFromWords(["明白", "明日", "カード"]);
check(knownFromDeck.has("明") && knownFromDeck.has("白") && knownFromDeck.has("日"), "known kanji come from every deck word");
check(knownFromDeck.size === 3, "each known kanji is counted once");

// 7. real data: check against the kanji-radical file built in Week 3 B
const dataPath = "data/kanji-radicals.json";
if (!fs.existsSync(dataPath)) {
  console.log(`[FAIL] ${dataPath} not found. Run this from the project root.`);
  failures++;
} else {
  const realRadicals = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const realIndex = buildPartIndex(realRadicals);
  check(partsOf("明", realRadicals).includes("日"), "real data: 明 has 日 as a part");
  check(kanjiContaining("日", realIndex).includes("明"), "real data: 日 is found inside 明");
  check(kanjiContaining("日", realIndex).length > 100, "real data: 日 appears in more than 100 kanji");
}

console.log(failures === 0 ? "\nAll kanji-tree tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

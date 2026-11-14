// extension/quiz/test-romaji.js
// Run from the project root:  node extension/quiz/test-romaji.js
const { romajiToHiragana, checkTyped } = require("./quiz-engine.js");

let failures = 0;
function check(condition, description) {
  if (condition) {
    console.log("[PASS] " + description);
  } else {
    console.log("[FAIL] " + description);
    failures++;
  }
}

// 1. syllables
check(romajiToHiragana("a") === "あ", "a becomes あ");
check(romajiToHiragana("aiueo") === "あいうえお", "vowels become あいうえお");
check(romajiToHiragana("ka") === "か", "ka becomes か");
check(romajiToHiragana("ichi") === "いち", "ichi becomes いち");
check(romajiToHiragana("nya") === "にゃ", "nya (a small-kana syllable) becomes にゃ");

// 2. the n rules
check(romajiToHiragana("shinbun") === "しんぶん", "n before b becomes ん: shinbun is しんぶん");
check(romajiToHiragana("konnichiha") === "こんにちは", "nn becomes one ん: konnichiha is こんにちは");
check(romajiToHiragana("nana") === "ななあ".slice(0, 2) || romajiToHiragana("nana") === "なな", "na followed by na is なな");

// 3. doubled consonants
check(romajiToHiragana("gakkou") === "がっこう", "kk becomes っ: gakkou is がっこう");
check(romajiToHiragana("matte") === "まって", "tt becomes っ: matte is まって");

// 4. long vowels and whole words
check(romajiToHiragana("kansenshou") === "かんせんしょう", "kansenshou is かんせんしょう (the quiz reading)");
check(romajiToHiragana("kansensho") === "かんせんしょ", "kansensho (without ou) is かんせんしょ");

// 5. checking a typed answer
const reading = "かんせんしょう";
check(checkTyped("kansenshou", reading), "romaji typed answer is accepted");
check(checkTyped("かんせんしょう", reading), "hiragana typed answer is accepted");
check(checkTyped("カンセンショウ", reading), "katakana typed answer is accepted");
check(checkTyped(" kan sen shou ", reading), "spaces in a romaji answer are ignored");
check(!checkTyped("kansensho", reading), "a wrong answer (missing ou) is rejected");
check(!checkTyped("", reading), "an empty answer is rejected");

console.log(failures === 0 ? "\nAll romaji tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

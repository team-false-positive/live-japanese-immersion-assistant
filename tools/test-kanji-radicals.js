// tools/test-kanji-radicals.js
// Run from the project root:
//   node tools/test-kanji-radicals.js data/kanji-radicals.json

const fs = require("fs");

const file = process.argv[2] || "data/kanji-radicals.json";
if (!fs.existsSync(file)) {
  console.log(`[FAIL] ${file} not found. Build it first with tools/build-kanji-radicals.js.`);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(file, "utf8"));

let failures = 0;
function check(condition, description) {
  if (condition) {
    console.log("[PASS] " + description);
  } else {
    console.log("[FAIL] " + description);
    failures++;
  }
}
const has = (kanji, part) => (data[kanji] || []).includes(part);

check(Object.keys(data).length > 1000, "more than 1000 kanji have parts");
check(has("明", "日") && has("明", "月"), "明 is made of 日 and 月");
check(has("林", "木"), "林 contains 木");
check(has("好", "女") && has("好", "子"), "好 is made of 女 and 子");
check(!has("明", "明") && !has("木", "木"), "a kanji is never listed as its own part");

// Sample output for your report
console.log("\n明 parts:", (data["明"] || []).join(" "));
console.log("林 parts:", (data["林"] || []).join(" "));

console.log(failures === 0 ? "\nAll kanji-radical tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

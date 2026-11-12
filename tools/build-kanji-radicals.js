// tools/build-kanji-radicals.js
// Week 3 Module B: kanji radical data from KanjiVG.
//
// Each KanjiVG file is named by the kanji's code point (for example 04e00.svg
// is 一). Inside the file, every part of the kanji is tagged with a
// kvg:element attribute. This script collects those parts for each kanji.
//
// Usage (from the project root):
//   node tools/build-kanji-radicals.js <path to kanjivg/kanji> <output.json>

const fs = require("fs");
const path = require("path");

const ELEMENT = /kvg:element="([^"]+)"/g;

// "04e00.svg" -> "一". Returns null for files that are not plain kanji.
function kanjiFromFile(name) {
  const m = /^([0-9a-f]{5})\.svg$/.exec(name);
  if (!m) return null;
  return String.fromCodePoint(parseInt(m[1], 16));
}

// Every distinct part named in the SVG, except the kanji itself.
function partsOf(svg, kanji) {
  const parts = new Set();
  for (const m of svg.matchAll(ELEMENT)) {
    if (m[1] !== kanji) parts.add(m[1]);
  }
  return [...parts];
}

function main() {
  const [srcDir, outFile] = process.argv.slice(2);
  if (!srcDir || !outFile) {
    console.error("usage: node tools/build-kanji-radicals.js <kanjivg/kanji folder> <output.json>");
    process.exit(1);
  }

  const result = {};
  let files = 0;
  for (const name of fs.readdirSync(srcDir)) {
    const kanji = kanjiFromFile(name);
    if (!kanji) continue;
    files++;
    const svg = fs.readFileSync(path.join(srcDir, name), "utf8");
    const parts = partsOf(svg, kanji);
    if (parts.length > 0) result[kanji] = parts;
  }

  fs.writeFileSync(outFile, JSON.stringify(result));
  console.log(`files read: ${files}, kanji with parts: ${Object.keys(result).length}`);
  console.log(`written to: ${outFile}`);
}

main();

// tools/convert-jlpt.js
// Converts OpenJLPT vocabulary CSV files into extension/data/jlpt-levels.tsv.
// Output: one "word<TAB>level" line per word, with no header.
//
// Usage (from the project root):
//   node tools/convert-jlpt.js extension/data/jlpt-levels.tsv vocab-n5.csv vocab-n4.csv vocab-n3.csv vocab-n2.csv vocab-n1.csv

const fs = require("fs");

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

// Parses CSV text into rows of fields. Handles quoted fields, doubled quotes
// inside them, commas inside quotes, and line breaks inside quotes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function main() {
  const [outFile, ...inputs] = process.argv.slice(2);
  if (!outFile || inputs.length === 0) {
    console.error("usage: node tools/convert-jlpt.js <output.tsv> <vocab-file.csv> [more files...]");
    process.exit(1);
  }

  const lines = [];
  const seen = new Set();

  for (const file of inputs) {
    // Remove a byte-order mark if the file has one (Windows often adds it).
    const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const rows = parseCsv(text);
    const header = rows.shift() || [];
    const wordCol = header.indexOf("word");
    const levelCol = header.indexOf("level");
    if (wordCol < 0 || levelCol < 0) {
      console.error(`${file}: needs "word" and "level" columns`);
      process.exit(1);
    }

    for (const r of rows) {
      const word = (r[wordCol] || "").trim();
      const level = (r[levelCol] || "").trim().toUpperCase();
      if (!word || !LEVELS.includes(level)) continue;
      const key = `${word}\t${level}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(key);
    }
  }

  fs.writeFileSync(outFile, lines.join("\n") + "\n");

  const counts = {};
  for (const line of lines) {
    const level = line.split("\t")[1];
    counts[level] = (counts[level] || 0) + 1;
  }
  console.log(`words written: ${lines.length}`);
  for (const level of LEVELS) {
    console.log(`  ${level}: ${counts[level] || 0}`);
  }
  console.log(`written to: ${outFile}`);
}

main();

// tools/audit-network.js
// Week 10 Module C: offline audit.
//
// Lists every web address and network API in the extension's app code, and
// checks each one against the list of expected uses. Study features must work
// offline, so any unexpected network use makes the script fail.
//
// Compiled engine folders (whisper, wasm) and bundled data (data) are skipped.
// They are generated code, not app logic, and are checked when they are built.
//
// Usage (from the project root):
//   node tools/audit-network.js

const fs = require("fs");
const path = require("path");

const ROOT = "extension";
const SKIP_DIRS = new Set(["whisper", "wasm", "data"]);
const URL_PATTERN = /https?:\/\/[^\s"'`)<>]+/g;
const NETWORK_API = /XMLHttpRequest|WebSocket|sendBeacon/;
const MAX_SHOWN = 110; // longer lines are shortened in the report

// Expected web addresses, each with the reason it is allowed.
const EXPECTED = [
  {
    match: "api.mymemory.translated.net",
    reason: "optional English translation; fails gracefully when offline",
  },
  {
    match: "youtube.com",
    reason: "opens a video page when resuming or jumping to a saved position",
  },
  {
    match: "netflix.com",
    reason: "opens a video page when resuming or jumping to a saved position",
  },
  {
    match: "hotstar.com",
    reason: "opens a video page when resuming or jumping to a saved position",
  },
];

// Every .js and .html file under the extension folder, skipping SKIP_DIRS.
function listFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) files.push(...listFiles(full));
    } else if (/\.(js|html)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

// Shortens a line for the report, so minified code does not flood the screen.
function shorten(text) {
  const t = text.trim();
  return t.length > MAX_SHOWN ? t.slice(0, MAX_SHOWN) + "…" : t;
}

function main() {
  const expected = [];
  const unexpected = [];

  for (const file of listFiles(ROOT)) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      const where = `${file}:${i + 1}`;

      for (const match of line.matchAll(URL_PATTERN)) {
        const url = match[0];
        const rule = EXPECTED.find((r) => url.includes(r.match));
        if (rule) {
          expected.push({ where, url: shorten(url), reason: rule.reason });
        } else {
          unexpected.push({ where, url: shorten(url), reason: "not on the expected list" });
        }
      }

      if (NETWORK_API.test(line)) {
        unexpected.push({ where, url: shorten(line), reason: "network API used directly" });
      }
    });
  }

  console.log(`Expected external uses (${expected.length}):`);
  for (const e of expected) {
    console.log(`  ${e.where}  ${e.url}\n      ${e.reason}`);
  }

  console.log(`\nUnexpected network uses (${unexpected.length}):`);
  if (unexpected.length === 0) {
    console.log("  none");
  } else {
    for (const u of unexpected) {
      console.log(`  ${u.where}  ${u.url}\n      ${u.reason}`);
    }
  }

  console.log(unexpected.length === 0
    ? "\nAudit passed: study features make no unexpected network calls."
    : "\nAudit failed: review the unexpected uses above.");
  process.exit(unexpected.length === 0 ? 0 : 1);
}

main();

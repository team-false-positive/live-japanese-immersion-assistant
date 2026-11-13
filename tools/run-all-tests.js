// tools/run-all-tests.js
// Week 10 Module D: runs every automated test in the project.
//
// Runs each JavaScript test file with Node, and compiles and runs each C++
// test in core/tests with g++. A C++ test that needs a source file to link
// (for example, test_bst.cpp needs bst.cpp) is listed in CPP_SOURCES.
//
// Usage (from the project root):
//   node tools/run-all-tests.js

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// JavaScript tests, run with Node.
const JS_TESTS = [
  "extension/graph/test-word-graph.js",
  "extension/scheduler/test-scheduler.js",
  "extension/scheduler/test-propagation.js",
  "extension/scheduler/tune-propagation.js",
  "extension/quiz/test-quiz-engine.js",
  "extension/quiz/test-distractors.js",
  "extension/kanji/test-kanji-tree.js",
  "extension/progress/test-progress.js",
  "extension/recommend/test-next-words.js",
  "extension/content-scripts/test-smart-rewind.js",
  "tools/test-kanji-radicals.js",
];

// Extra source files each C++ test must be built with.
const CPP_SOURCES = {
  "core/tests/test_bst.cpp": ["core/bst.cpp"],
};

// Runs one JavaScript test. Passes if Node exits with code 0.
function runJs(file) {
  if (!fs.existsSync(file)) {
    return { name: file, ok: false, detail: "file not found" };
  }
  const r = spawnSync("node", [file], { encoding: "utf8" });
  const output = (r.stdout || "") + (r.stderr || "");
  const last = output.trim().split("\n").pop() || "";
  return { name: file, ok: r.status === 0, detail: last };
}

// Compiles one C++ test together with its extra sources, then runs it.
// Passes if the program exits with code 0.
function runCpp(file) {
  const sources = [file, ...(CPP_SOURCES[file] || [])];
  const exe = path.join(os.tmpdir(), path.basename(file, ".cpp"));
  const compile = spawnSync("g++", ["-std=c++17", ...sources, "-o", exe], { encoding: "utf8" });
  if (compile.status !== 0) {
    const firstError = (compile.stderr || "").split("\n").find((l) => l.includes("error")) || "compile failed";
    return { name: file, ok: false, detail: "compile failed: " + firstError.trim() };
  }
  const run = spawnSync(exe, [], { encoding: "utf8" });
  const last = (run.stdout || "").trim().split("\n").pop() || "";
  return { name: file, ok: run.status === 0, detail: last };
}

// Every .cpp file in core/tests.
function cppTests() {
  const dir = "core/tests";
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".cpp"))
    .map((f) => path.join(dir, f));
}

function main() {
  const results = [];
  for (const file of JS_TESTS) results.push(runJs(file));
  for (const file of cppTests()) results.push(runCpp(file));

  console.log("Automated tests\n");
  for (const r of results) {
    const mark = r.ok ? "PASS" : "FAIL";
    console.log(`[${mark}] ${r.name}`);
    if (!r.ok || process.env.VERBOSE) console.log(`       ${r.detail}`);
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} of ${results.length} test files passed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main();

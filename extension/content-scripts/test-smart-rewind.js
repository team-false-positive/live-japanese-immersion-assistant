// extension/content-scripts/test-smart-rewind.js
// Run from the project root:  node extension/content-scripts/test-smart-rewind.js
const { REWIND_SECONDS, rewindTarget, applySmartRewind } = require("./smart-rewind.js");

let failures = 0;
function check(condition, description) {
  if (condition) {
    console.log("[PASS] " + description);
  } else {
    console.log("[FAIL] " + description);
    failures++;
  }
}

// 1. the rule
check(REWIND_SECONDS === 4, "the default rewind is four seconds");
check(rewindTarget(10) === 6, "at 10 s, rewind goes back to 6 s");
check(rewindTarget(10, 2) === 8, "a custom rewind amount is respected");
check(rewindTarget(2) === 0, "near the start, rewind stops at 0 and never goes negative");
check(rewindTarget(0) === 0, "at 0 s, the position stays at 0");

// 2. applying it to a video element
const video = { currentTime: 30, duration: 600 };
check(applySmartRewind(video) === true, "a normal video is rewound");
check(video.currentTime === 26, "the video's time moves back by four seconds");

const liveStream = { currentTime: 30, duration: Infinity };
check(applySmartRewind(liveStream) === false, "a live stream is skipped");
check(liveStream.currentTime === 30, "a live stream's time is left unchanged");

check(applySmartRewind(null) === false, "a missing video is skipped without an error");

console.log(failures === 0 ? "\nAll smart-rewind tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);

// extension/progress/progress-logic.js
//
// Week 8 Module D: JLPT progress (pure logic).
//
// A word counts as "learned" when its card's interval is at least four days,
// which the scheduler only reaches after several correct answers. "Seen" means
// the word is in the learner's deck at all.

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const LEARNED_INTERVAL_DAYS = 4;

// Parses a file of "word<TAB>level" lines, such as N5 to N1. Lines with an
// unknown level are skipped.
function parseLevels(text) {
  const entries = [];
  for (const line of text.split(/\r?\n/)) {
    const [word = "", level = ""] = line.split("\t");
    const w = word.trim();
    const l = level.trim().toUpperCase();
    if (w && LEVELS.includes(l)) entries.push({ word: w, level: l });
  }
  return entries;
}

// Progress for each level. deck maps word -> card (see scheduler.js).
function levelProgress(entries, deck) {
  const rows = LEVELS.map((level) => ({ level, total: 0, seen: 0, learned: 0, percent: 0 }));
  const rowOf = new Map(rows.map((r) => [r.level, r]));

  for (const entry of entries) {
    const row = rowOf.get(entry.level);
    if (!row) continue;
    row.total++;
    const card = deck[entry.word];
    if (card) {
      row.seen++;
      if ((card.interval || 0) >= LEARNED_INTERVAL_DAYS) row.learned++;
    }
  }
  for (const row of rows) {
    row.percent = row.total ? Math.round((100 * row.learned) / row.total) : 0;
  }
  return rows;
}

if (typeof module !== "undefined") {
  module.exports = { LEVELS, LEARNED_INTERVAL_DAYS, parseLevels, levelProgress };
}

// extension/kanji/kanji-tree.js
//
// Week 8 Module C: kanji radical tree (pure logic).
//
// Uses the kanji-to-parts data from Week 3 B (data/kanji-radicals.json).
// Forward: a kanji -> its parts. Reverse: a part -> the kanji that contain it.
// "Known" kanji are the kanji appearing in the learner's own deck.

const KANJI_CHARS = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g;

// The distinct kanji in a word.
function kanjiInWord(word) {
  return [...new Set(word.match(KANJI_CHARS) || [])];
}

// Reverse index: part -> kanji that contain it.
function buildPartIndex(radicals) {
  const index = new Map();
  for (const kanji of Object.keys(radicals)) {
    for (const part of radicals[kanji]) {
      if (!index.has(part)) index.set(part, []);
      index.get(part).push(kanji);
    }
  }
  return index;
}

// The parts of a kanji, or an empty list if it has no data.
function partsOf(kanji, radicals) {
  return radicals[kanji] || [];
}

// Kanji containing `part`. If `known` (a Set) is given, only those kanji are returned.
// The part itself is never in the list.
function kanjiContaining(part, index, known = null) {
  const all = index.get(part) || [];
  const list = known ? all.filter((k) => known.has(k)) : all;
  return list.filter((k) => k !== part);
}

// The set of kanji in the given words (for example, the words in the deck).
function knownKanjiFromWords(words) {
  const known = new Set();
  for (const word of words) {
    for (const k of kanjiInWord(word)) known.add(k);
  }
  return known;
}

if (typeof module !== "undefined") {
  module.exports = { kanjiInWord, buildPartIndex, partsOf, kanjiContaining, knownKanjiFromWords };
}

// extension/recommend/next-words.js
//
// Week 10 Module A: "watch next" recommendations.
//
// The project has no catalogue of videos, so the recommendations are the next
// words to learn. A word is suggested when:
//   - it shares at least one kanji with words the learner already knows, and
//   - it has at most `maxUnknown` kanji the learner doesn't know yet
//     (challenging, but not overwhelming).
// Suggestions are ranked by the share of their kanji that the learner already
// knows, so the most familiar-looking words come first.
//
// Pure logic, so it runs in the browser and in Node.

const NEXT_KANJI_CHARS = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g;

// The distinct kanji in a word.
function kanjiOfWord(word) {
  return [...new Set(word.match(NEXT_KANJI_CHARS) || [])];
}

// knownKanji: a Set of kanji the learner knows (from their deck).
// knownWords: a Set of words already in the deck, which are never suggested.
// entries: dictionary entries ({ word, reading, meaning }).
// Returns up to `count` suggestions, best first.
function nextWords(entries, knownKanji, knownWords, options = {}) {
  const { count = 10, maxUnknown = 2 } = options;
  const scored = [];

  for (const entry of entries) {
    if (knownWords.has(entry.word)) continue;
    const kanji = kanjiOfWord(entry.word);
    if (kanji.length === 0) continue;

    const known = kanji.filter((k) => knownKanji.has(k)).length;
    const unknown = kanji.length - known;
    if (known === 0) continue;             // no overlap with what the learner knows
    if (unknown < 1 || unknown > maxUnknown) continue; // already known, or too far ahead

    scored.push({
      word: entry.word,
      reading: entry.reading,
      meaning: entry.meaning,
      familiarity: known / kanji.length,
      unknownKanji: kanji.filter((k) => !knownKanji.has(k)),
    });
  }

  scored.sort((a, b) => b.familiarity - a.familiarity || (a.word < b.word ? -1 : 1));
  return scored.slice(0, count);
}

if (typeof module !== "undefined") {
  module.exports = { kanjiOfWord, nextWords };
}

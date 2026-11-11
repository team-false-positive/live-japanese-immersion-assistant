// extension/graph/word-graph.js
//
// Week 4 Module C: word-relationship graph.
// Two words are connected when they share a kanji. The edge weight is the
// number of kanji they share, so words sharing two kanji are more strongly
// related than words sharing one.
//
// Radical-level edges (weaker links) are not built here, because the
// kanji-radical data (KanjiVG) is not loaded yet.

// CJK ideograph ranges (common, extension A, and compatibility ideographs).
const KANJI = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g;

// Returns the distinct kanji in a word.
function kanjiOf(word) {
  return [...new Set(word.match(KANJI) || [])];
}

// Parses dictionary_full.tsv: word, reading, meaning, one entry per line.
function parseDictionary(text) {
  const entries = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [word = "", reading = "", meaning = ""] = line.split("\t");
    if (!word.trim()) continue;
    entries.push({
      word: word.trim(),
      reading: reading.trim(),
      meaning: meaning.trim(),
    });
  }
  return entries;
}

// Builds the graph. maxWordsPerKanji skips very common kanji (such as 日),
// which would otherwise link thousands of words together and say little.
function buildWordGraph(entries, { maxWordsPerKanji = 80 } = {}) {
  const kanjiIndex = new Map(); // kanji -> words containing it
  const wordKanji = new Map();  // word -> its kanji

  for (const entry of entries) {
    const kanji = kanjiOf(entry.word);
    if (kanji.length === 0) continue; // kana-only words have no kanji link
    if (wordKanji.has(entry.word)) continue;
    wordKanji.set(entry.word, kanji);
    for (const k of kanji) {
      if (!kanjiIndex.has(k)) kanjiIndex.set(k, []);
      kanjiIndex.get(k).push(entry.word);
    }
  }

  // edges: word -> Map(neighbor -> weight). Stored in both directions.
  const edges = new Map();
  const bump = (a, b) => {
    if (!edges.has(a)) edges.set(a, new Map());
    const row = edges.get(a);
    row.set(b, (row.get(b) || 0) + 1);
  };

  for (const words of kanjiIndex.values()) {
    if (words.length > maxWordsPerKanji) continue;
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j < words.length; j++) {
        bump(words[i], words[j]);
        bump(words[j], words[i]);
      }
    }
  }

  return { edges, wordKanji, kanjiIndex };
}

// Returns the strongest neighbors of a word, sorted by weight.
function neighbors(graph, word, limit = 10) {
  const row = graph.edges.get(word);
  if (!row) return [];
  return [...row.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w, weight]) => ({ word: w, weight }));
}

if (typeof module !== "undefined") {
  module.exports = { kanjiOf, parseDictionary, buildWordGraph, neighbors };
}

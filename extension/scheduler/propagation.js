// extension/scheduler/propagation.js
//
// Week 7 Module B: structural propagation.
//
// When a word is answered wrong, words that share a kanji with it (found in
// the word graph from Week 4 C) are pulled earlier in the review queue, so
// the learner meets them again soon.
//   - strength = decay ^ hops          (fades with distance)
//   - delay    = baseDelayMs * (1 - strength)
//   - each word passes on the pull to at most maxPerWord of its strongest
//     neighbors (by shared-kanji weight). This keeps one wrong answer from
//     crowding the queue: the kanji-sharing graph is dense, and without a cap
//     two hops can reach a large share of the deck.
// A related card's due time becomes now + delay, but only if that is earlier
// than its current due time. Cards are never pushed later.
// Words beyond maxHops, and words with no link, are left untouched.
//
// The wrong word itself is rescheduled by review() in scheduler.js, not here.
//
// Works in the browser (plain script) and in Node.

// cards:   array of scheduler cards (see scheduler.js)
// graph:   result of buildWordGraph() from extension/graph/word-graph.js
// Returns a new array of cards. The inputs are not changed.
function propagateWrongAnswer(cards, graph, wrongWord, now, options = {}) {
  const {
    maxHops = 2,
    decay = 0.5,
    baseDelayMs = 24 * 60 * 60 * 1000,
    maxPerWord = 10,
  } = options;

  // Breadth-first walk from the wrong word, recording how many hops away each word is.
  const hopOf = new Map([[wrongWord, 0]]);
  let frontier = [wrongWord];
  for (let hop = 1; hop <= maxHops; hop++) {
    const next = [];
    for (const word of frontier) {
      const row = graph.edges.get(word);
      if (!row) continue;
      // Strongest neighbors first; only the top maxPerWord are passed on.
      const ranked = [...row.entries()]
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
        .slice(0, maxPerWord);
      for (const [neighbor] of ranked) {
        if (!hopOf.has(neighbor)) {
          hopOf.set(neighbor, hop);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }

  return cards.map((card) => {
    if (card.word === wrongWord || !hopOf.has(card.word)) return card;
    const hop = hopOf.get(card.word);
    const strength = Math.pow(decay, hop);
    const pulledDue = now + baseDelayMs * (1 - strength);
    return pulledDue < card.due ? { ...card, due: pulledDue } : card;
  });
}

if (typeof module !== "undefined") {
  module.exports = { propagateWrongAnswer };
}

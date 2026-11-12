// extension/scheduler/scheduler.js
//
// Week 7 Module A: baseline spaced-repetition scheduler.
//
// Each saved word is a card with a due time and an interval (in days).
//   - A correct answer doubles the interval.
//   - A wrong answer resets the interval to one day and brings the word
//     back after a short delay.
// dueWords() returns the words due now, most overdue first, using a
// min-heap keyed by due time (the same idea as the Week 1 priority queue).
//
// Pure logic: no browser APIs, so it can be tested in Node.

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const WRONG_RETRY_MS = 10 * MINUTE; // a wrong word comes back after this long

// A new card is due immediately.
function createCard(word, now = Date.now()) {
  return { word, interval: 1, due: now, correct: 0, wrong: 0 };
}

// Returns the card after one answer. Does not change the card you pass in.
function review(card, correct, now = Date.now()) {
  if (correct) {
    const interval = card.interval * 2;
    return { ...card, interval, due: now + interval * DAY, correct: card.correct + 1 };
  }
  return { ...card, interval: 1, due: now + WRONG_RETRY_MS, wrong: card.wrong + 1 };
}

// Min-heap ordered by a key function (smallest key comes out first).
class MinHeap {
  constructor(key) {
    this.key = key;
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.key(this.items[parent]) <= this.key(this.items[i])) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop() {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        let smallest = i;
        if (left < this.items.length && this.key(this.items[left]) < this.key(this.items[smallest])) smallest = left;
        if (right < this.items.length && this.key(this.items[right]) < this.key(this.items[smallest])) smallest = right;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

// Words due at or before `now`, most overdue first.
function dueWords(cards, now = Date.now()) {
  const heap = new MinHeap((card) => card.due);
  for (const card of cards) heap.push(card);
  const due = [];
  while (heap.size > 0 && heap.items[0].due <= now) {
    due.push(heap.pop());
  }
  return due;
}

if (typeof module !== "undefined") {
  module.exports = { MINUTE, DAY, WRONG_RETRY_MS, createCard, review, dueWords, MinHeap };
}

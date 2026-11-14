// extension/quiz/quiz-engine.js
//
// Week 8 Module A and B, fixed in Week 11 B (bug row 2): quiz engine (pure logic, no browser APIs).
//
// Two question types:
//   - multiple choice: see the word, pick its meaning from four choices
//   - typed recall:    see the meaning, type the reading
// The reading can be typed in hiragana, in katakana, or in English letters
// (romaji), such as "kansenshou" for かんせんしょう. Romaji is converted to
// hiragana before it is checked, so learners without Japanese input can answer.
//
// Wrong choices in multiple choice come from graph neighbors (words sharing a
// kanji with the question word), with random meanings only as a fallback.

const CHOICE_COUNT = 4;

// Romaji syllables to hiragana. Longest matches are tried first, so "shi" wins over "s".
const ROMAJI_TABLE = {
  a: "あ", i: "い", u: "う", e: "え", o: "お",
  ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ",
  sa: "さ", si: "し", shi: "し", su: "す", se: "せ", so: "そ",
  ta: "た", ti: "ち", chi: "ち", tu: "つ", tsu: "つ", te: "て", to: "と",
  na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
  ha: "は", hi: "ひ", fu: "ふ", hu: "ふ", he: "へ", ho: "ほ",
  ma: "ま", mi: "み", mu: "む", me: "め", mo: "も",
  ya: "や", yu: "ゆ", yo: "よ",
  ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ",
  wa: "わ", wo: "を",
  ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
  za: "ざ", ji: "じ", zi: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
  da: "だ", di: "ぢ", du: "づ", de: "で", do: "ど",
  ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",
  pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ",
  kya: "きゃ", kyu: "きゅ", kyo: "きょ",
  sha: "しゃ", shu: "しゅ", sho: "しょ", sya: "しゃ", syu: "しゅ", syo: "しょ",
  cha: "ちゃ", chu: "ちゅ", cho: "ちょ",
  nya: "にゃ", nyu: "にゅ", nyo: "にょ",
  hya: "ひゃ", hyu: "ひゅ", hyo: "ひょ",
  mya: "みゃ", myu: "みゅ", myo: "みょ",
  rya: "りゃ", ryu: "りゅ", ryo: "りょ",
  gya: "ぎゃ", gyu: "ぎゅ", gyo: "ぎょ",
  ja: "じゃ", ju: "じゅ", jo: "じょ",
  bya: "びゃ", byu: "びゅ", byo: "びょ",
  pya: "ぴゃ", pyu: "ぴゅ", pyo: "ぴょ",
};

// Converts English letters (romaji) to hiragana. Other characters are kept as they are.
//   "kansenshou" -> "かんせんしょう"   "gakkou" -> "がっこう"   "shinbun" -> "しんぶん"
function romajiToHiragana(input) {
  const s = (input || "").toLowerCase();
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i];

    // Two- and three-letter syllables first.
    let matched = false;
    for (const len of [3, 2]) {
      const chunk = s.substr(i, len);
      if (chunk.length === len && ROMAJI_TABLE[chunk]) {
        out += ROMAJI_TABLE[chunk];
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // "n" is ん before a consonant or at the end. "nn" is one ん.
    if (c === "n") {
      const next = s[i + 1];
      if (next === "n") {
        const after = s[i + 2];
        out += "ん";
        i += after && /[aeiouy]/.test(after) ? 1 : 2;
        continue;
      }
      if (next === undefined || !/[aeiouy]/.test(next)) {
        out += "ん";
        i += 1;
        continue;
      }
    }

    // A doubled consonant (kk, ss, tt) is a small っ, as in がっこう.
    if (!/[aeiou]/.test(c) && c !== "n" && s[i + 1] === c) {
      out += "っ";
      i += 1;
      continue;
    }

    // A single vowel.
    if (ROMAJI_TABLE[c]) {
      out += ROMAJI_TABLE[c];
      i += 1;
      continue;
    }

    // Anything else (spaces, kana already typed, punctuation) is kept.
    out += c;
    i += 1;
  }
  return out;
}

// Converts katakana to hiragana, and removes spaces, so readings compare fairly.
function toHiragana(text) {
  return text.replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// Trims spaces, removes internal spaces, and converts to hiragana.
function normalizeReading(text) {
  return toHiragana(text.trim()).replace(/\s+/g, "");
}

// True if the typed text matches the reading. Accepts hiragana, katakana, or
// English letters (romaji). An empty reading never matches.
function checkTyped(typed, reading) {
  const expected = normalizeReading(reading || "");
  const raw = typed || "";
  const asKana = /[a-z]/i.test(raw) ? romajiToHiragana(raw) : raw;
  return expected.length > 0 && normalizeReading(asKana) === expected;
}

// Wrong choices from the word's graph neighbors, strongest link first.
// meaningOf(word) returns that word's short meaning. fallback is a list of
// meanings to draw from when the graph gives too few. rng returns a number in [0, 1).
function graphDistractors(word, correct, graph, meaningOf, fallback, rng = Math.random, count = CHOICE_COUNT - 1) {
  const picked = [];
  const row = graph.edges.get(word);
  if (row) {
    const ranked = [...row.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    for (const [neighbor] of ranked) {
      const m = meaningOf(neighbor);
      if (m && m !== correct && !picked.includes(m)) picked.push(m);
      if (picked.length >= count) break;
    }
  }
  for (let attempts = 0; picked.length < count && attempts < fallback.length * 3; attempts++) {
    const m = fallback[Math.floor(rng() * fallback.length)];
    if (m && m !== correct && !picked.includes(m)) picked.push(m);
  }
  return picked;
}

// Four options: the correct meaning plus distractors. rng returns a number in [0, 1).
function buildMultipleChoice(correct, distractors, rng = Math.random) {
  const options = [correct];
  for (const d of distractors) {
    if (options.length >= CHOICE_COUNT) break;
    if (d && !options.includes(d)) options.push(d);
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

// A session asks the first `size` cards of dueCards, in the order given (most overdue first).
function startSession(dueCards, size = 10) {
  return { queue: dueCards.slice(0, size), index: 0, correct: 0, wrong: 0 };
}

function currentCard(session) {
  return session.queue[session.index] || null;
}

function recordAnswer(session, correct) {
  return {
    ...session,
    index: session.index + 1,
    correct: session.correct + (correct ? 1 : 0),
    wrong: session.wrong + (correct ? 0 : 1),
  };
}

function isFinished(session) {
  return session.index >= session.queue.length;
}

// Score for the session, as counts and a whole-number percentage.
function summarize(session) {
  const total = session.correct + session.wrong;
  return {
    total,
    correct: session.correct,
    percent: total ? Math.round((100 * session.correct) / total) : 0,
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    CHOICE_COUNT,
    ROMAJI_TABLE,
    romajiToHiragana,
    toHiragana,
    normalizeReading,
    checkTyped,
    graphDistractors,
    buildMultipleChoice,
    startSession,
    currentCard,
    recordAnswer,
    isFinished,
    summarize,
  };
}

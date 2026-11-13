// extension/ui/feedback.js
// Week 9 Module C: shared feedback for the review and quiz screens.
//
// Gives short, varied messages, a streak counter, and a pop (correct) or
// shake (wrong) animation. The animations are switched off automatically when
// the system asks for reduced motion (see theme.css).

const PRAISE_MESSAGES = [
  "Correct!",
  "Nice work!",
  "Exactly right.",
  "Sugoi! (すごい)",
  "Well done!",
];

const ENCOURAGE_MESSAGES = [
  "Not quite. You'll remember it next time.",
  "Close. Look at the reading again.",
  "Almost. This one will come back soon.",
  "Ganbatte! (頑張って) Keep going.",
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// The message shown after an answer. answerText is the correct meaning or reading.
function feedbackMessage(correct, answerText) {
  if (correct) return pickRandom(PRAISE_MESSAGES);
  return `${pickRandom(ENCOURAGE_MESSAGES)} It means: ${answerText}`;
}

// Streak: correct answers in a row, kept for this page visit.
const streakState = { current: 0, best: 0 };

// Updates the streak for one answer and returns the new count.
function updateStreak(correct) {
  streakState.current = correct ? streakState.current + 1 : 0;
  streakState.best = Math.max(streakState.best, streakState.current);
  return streakState.current;
}

// Shows the streak in an element.
function renderStreak(el) {
  el.textContent = `Streak: ${streakState.current}`;
}

// Plays the pop (correct) or shake (wrong) animation on an element.
function animateAnswer(el, correct) {
  el.classList.remove("pop", "shake");
  void el.offsetWidth; // restart the animation if it was already playing
  el.classList.add(correct ? "pop" : "shake");
}

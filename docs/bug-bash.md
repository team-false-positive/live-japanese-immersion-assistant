# Week 11 B: bug bash

Work through every feature the way a learner would. Log each problem in the table at the end, with its severity. Don't fix anything yet: finish the whole list first, then sort the log.

**Severity:**
- **Blocker:** a core feature cannot be used at all.
- **Major:** a feature works, but wrongly or confusingly.
- **Minor:** a cosmetic or rare problem.

## Checklist

### Setup and first run
- [X] Reload the extension at `chrome://extensions`. No errors in the Errors list.
- [X] Open the popup. All links are present: Watch history, Review, Quiz, JLPT progress, Next words, Kanji, Settings.
- [X] Each link opens its page with no red errors in the page's console.

### Watching and subtitles
- [X] On a YouTube video with captions, the native subtitles show, and the overlay does not duplicate them.
- [X] On a video without captions, capture produces Japanese text on the overlay within about 30 seconds.
- [X] Clicking a word in the subtitles shows its reading and meaning.
- [X] Words not in the dictionary show "Not in the dictionary."
- [X] Clicking elsewhere on the page closes the bubble.
- [X] The video steps back about 4 seconds after a successful lookup, and keeps playing.
- [X] Save word adds the word to the review deck, and shows "Saved."
- [X] Saving the same word twice does not create a duplicate.

### Watch history and library
- [X] Watching a video records it in the library.
- [X] Moving to another video without reloading records the new video, not `/`.
- [X] Repeated pauses do not flood the record.
- [X] Resume opens the video at the saved time.

### Review
- [X] A new word appears as due.
- [X] A correct answer makes it leave the due list.
- [X] A wrong answer brings it back in about 10 minutes.
- [X] A wrong answer moves related words up.
- [X] The streak goes up on correct answers and resets on wrong ones.
- [X] Adding a word that is not in the dictionary gives a clear message.
- [X] Adding a word already in the deck gives a clear message.
- [X] The deck survives closing and reopening the browser.

### Quiz
- [X] Multiple choice shows four options, including the right one.
- [X] The wrong options share a kanji with the word.
- [X] Typed recall accepts hiragana and katakana readings.
- [X] A session ends with a score.
- [X] "Start again" begins a new session.

### Kanji explorer
- [X] Typing a kanji and pressing Enter shows its parts.
- [X] Clicking a part shows kanji that contain it.
- [X] Known kanji from the deck are listed first.

### Next words and progress
- [X] Next words shows suggestions built on the deck's kanji.
- [X] Add to review adds the word to the deck.
- [X] JLPT progress shows a bar for each level, with the counts.

### Visual and layout
- [X] Every page uses the shared styling (indigo headings, washi background).
- [X] Text is readable on every page, and no text overlaps or is cut off.
- [X] The overlay does not cover the video's controls.
- [X] The popup fits without scrolling.

## Bug log

| # | Feature | What happened | Steps to reproduce | Severity | Status |
|---|---|---|---|---|---|
| 1 | Next words | Clicking **Add to review** did nothing. Console showed `ReferenceError: createCard is not defined` (recommend/recommend.js:55). | Open Next words from the popup, click Add to review on any word | Blocker | Fixed: scheduler.js added to recommend.html |
| 2 | Quiz (typed recall) | A learner who hasn't set up Japanese input can't type a reading, and the screen gives no hint about this. | Open Quiz, choose Typed recall, try to type a reading without Japanese input | Major | Open |
| 3 | JLPT progress | The bars show no colour at 0% learned, and seen words appear only as text. | Open JLPT progress with words in the deck | Minor | Fixed |
| 4 | Popup | The **Kanji** link was missing from the popup. | Open the popup and look at the links | Major | Fixed |
| 5 | Popup | The placeholder text said "wired in (Week 4)", which was out of date. | Open the popup and read the grey box | Minor | Fixed |
| 6 | Quiz | After a session, **Start again** shows "Nothing is due right now" with no explanation, so it looks broken. | Finish a session, then click Start again | Major | Fixed |
| 7 | Review (Add a word) | The box only accepts the written form. A reading such as あう gives "not in the dictionary", with no way forward. | Open Review, type あう in the Add box, click Add | Major | Open |

## After the test

**Open:** 0 blockers, 3 majors (rows 2, 6, 7), 1 minor (row 3).
**Fixed:** 1 blocker (row 1), 2 majors (rows 4), 1 minor (row 5).

Fix order: row 6 (Start again), row 3 (JLPT bars), row 7 (reading lookup), row 2 (typed recall, English letters). Known issues to list in the report are any open rows left at the end.
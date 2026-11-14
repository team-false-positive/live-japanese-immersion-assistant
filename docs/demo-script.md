# Demo script: Live Japanese Immersion Assistant

Total time: about 8 minutes. Practise it twice before the day. Use a YouTube news video with Japanese captions turned on.

## Before the demo (the day before)

- [ ] Reload the extension at `chrome://extensions` (**Clear all** first).
- [ ] Open the demo video, play it for 30 seconds, and check the **Japanese caption** and the **English line** both appear. The English line uses a daily translation limit, so check it the day before.
- [ ] Open the popup and check the links open: Review, Quiz, JLPT progress, Next words, Kanji, Watch history.
- [ ] Put at least 5 words in the review deck, so Review and Quiz have something due.
- [ ] Turn Japanese input **off** (English keyboard), so the typed-recall demo uses romaji.
- [ ] Close other tabs and turn off notifications.
- [ ] Record a 2-minute screen recording of the whole demo as a backup.

## Script

### 0:00 to 0:30: Introduction
**Say:** "This is a Chrome extension that helps you learn Japanese while you watch real Japanese videos. You watch the video you already enjoy, and the extension teaches you from its subtitles."
**Show:** the popup, with its header and the links.

### 0:30 to 1:30: Subtitles with English
**Do:** Open the demo video, play it.
**Say:** "The Japanese subtitles are on screen. Under them, the English line translates each sentence as it appears, so I can follow the news while I watch."
**Expect:** a Japanese line and an English line under it. The English changes with each sentence.

### 1:30 to 2:30: Word lookup and rewind
**Do:** Pause on a sentence, then click a Japanese word in the subtitle bar. Keep the video playing.
**Say:** "Clicking a word shows its reading and meaning. The video steps back a few seconds, so I can hear the sentence again."
**Expect:** a bubble with the word, reading, and meaning. The video jumps back about 4 seconds and keeps playing.

### 2:30 to 3:00: Save a word
**Do:** Click **Save word** in the bubble.
**Say:** "I save words I want to remember. They go straight into my review deck."
**Expect:** "Saved to your review deck."

### 3:00 to 4:00: Review
**Do:** Open **Review** from the popup.
**Say:** "The saved word is due now. I answer the meaning, and the schedule updates. If I get one wrong, it comes back in about 10 minutes, and related words that share a kanji move up the queue."
**Do:** Answer one correctly, then one incorrectly.
**Expect:** green or red feedback, the streak counter, and the next card.

### 4:00 to 5:00: Typed recall with romaji and Listen
**Do:** Open **Quiz**, choose **Typed recall**. Press **Listen**. Then type the reading in romaji, such as `kansenshou`.
**Say:** "Typed recall checks that I can produce the reading. I don't need Japanese input: I type the sounds in English letters, and it converts them. The Listen button speaks the word."
**Expect:** the word is spoken in Japanese, and the answer is accepted.

### 5:00 to 5:45: Kanji explorer
**Do:** Open **Kanji**, type 明, press Enter, then click the part 日.
**Say:** "This breaks a kanji into its parts, and shows the other kanji that share each part. Kanji I already know are listed first."
**Expect:** 明 with its parts, then the kanji that contain 日.

### 5:45 to 6:30: Next words
**Do:** Open **Next words**, click **Add to review** on one word.
**Say:** "The extension suggests words that build on the kanji I already know, with only one or two new ones. Adding a word puts it straight into my review."
**Expect:** the word appears in Review.

### 6:30 to 7:00: JLPT progress
**Do:** Open **JLPT progress**.
**Say:** "Each JLPT level shows how many words I've seen, and how many I've learned, against the official list."
**Expect:** bars for each level, with the counts.

### 7:00 to 7:30: Library and resume
**Do:** Open **Watch history**, click **Resume** on the demo video.
**Say:** "Every video I watch is saved, so I can pick up where I stopped."
**Expect:** the video opens at the saved time.

### 7:30 to 8:00: Closing
**Say:** "Everything I've shown runs without internet, except the video and the English translation. Our tests pass, and the main lookup responds in under a millisecond. The limits are the translation quota and the need to watch the video online. Thank you."

## Fallback plans

| If this happens | Do this |
|---|---|
| The English line doesn't appear (quota used up) | Say "the English translation uses a free daily limit, and it's used up for today." Show the Japanese lookup instead, then play the backup recording for the English line. |
| No subtitles on the demo video | Switch to a video with captions, which you tested the day before. |
| Capture produces no text (uncaptioned video) | Skip that part, and mention it as a feature that works on videos without captions. |
| The popup or a page shows an error | Refresh the page with F5, or reload the extension, then continue. |
| Something worked the day before but not on the day | Show the backup recording, and say what you'd fix next. |
| Time runs short | Skip Next words and JLPT progress. Keep subtitles, lookup, review, and typed recall. |

## Questions to expect

- **Does it work on Netflix?** The subtitle reader works on YouTube. Netflix and Hotstar are the next step, and we haven't tested their subtitle reading yet.
- **Why use a free translation service?** It needs no card and no API key, so anyone can run it. A paid service would give more daily characters.
- **Does it store my data?** Everything is stored on your own computer. Only the video page and the translation request leave it.

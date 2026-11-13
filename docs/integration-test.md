# Week 10 D: integration test

Run this after `node tools/run-all-tests.js` passes. It checks the features work together on real content, not just in isolation.

Before you start: reload the extension at `chrome://extensions` (Clear all first), then press F5 on each video tab.

## Scenario 1: YouTube with native captions

Use a video with captions turned on in the player.

| Step | Action | Expected |
|---|---|---|
| 1 | Open the video, press play | Native subtitles show on the video |
| 2 | Look at the console on the page (F12) | `[LJIA] router: native captions active, Whisper text not shown` |
| 3 | Click a Japanese word in the bar | Bubble with the word, reading and meaning appears |
| 4 | Watch the video | It steps back about 4 seconds after the lookup, and keeps playing |
| 5 | Click **Save word** | "Saved to your review deck." |
| 6 | Open **Review** from the popup | The saved word is in the deck |
| 7 | Open **Watch history** | The video is listed, with a resume time |

Result: ____  Notes: ____________________

## Scenario 2: YouTube without captions

Use a video with no captions at all.

| Step | Action | Expected |
|---|---|---|
| 1 | Click **Start capturing this tab** in the popup | Capture starts |
| 2 | Wait about 30 seconds | Japanese transcript text appears on the bar |
| 3 | Console on the page | `[LJIA] router: no native captions, showing Whisper text` |
| 4 | Click a word in the transcript | Bubble appears, as in Scenario 1 |
| 5 | Click **Save word** | Saved |
| 6 | Click **Stop** (or stop capture) | Transcript stops; the video keeps playing |

Result: ____  Notes: ____________________

## Scenario 3: Netflix or Hotstar

Use whichever of these you have access to. Netflix needs a subscription; use Hotstar if that's what you have.

| Step | Action | Expected |
|---|---|---|
| 1 | Open a Japanese-subtitled title, press play | Subtitles show, and the extension's content scripts run (console shows `subtitle-overlay.js ready`) |
| 2 | Click a Japanese word in the subtitles | Bubble appears |
| 3 | Click **Save word** | Saved to the review deck |
| 4 | Open **Watch history**, click **Resume** on this title | The site opens the title at about the saved position |

Result: ____  Notes: ____________________

## Scenario 4: Study features offline

Turn off Wi-Fi. This is the same check as the offline test, repeated here as part of the full run.

| Step | Action | Expected |
|---|---|---|
| 1 | Open **Review** and answer one card | Feedback, streak, and progress update |
| 2 | Open **Quiz** and answer three questions, in both modes | Score shown at the end |
| 3 | Open **Kanji** and click a kanji, then one of its parts | Kanji from your deck are listed first |
| 4 | Open **Next words** | Suggestions appear |
| 5 | Open **JLPT progress** | Bars show the level list |
| 6 | Open **Watch history** | The library cards show |

Result: ____  Notes: ____________________

## Bug log

Record anything that fails, with the scenario and step.

| Scenario | Step | What happened | Console error (if any) |
|---|---|---|---|
| | | | |

## Sign-off

- [ ] `node tools/run-all-tests.js` passes
- [ ] `node tools/audit-network.js` passes
- [ ] Scenarios 1 to 4 run, and every failure is either fixed or in the bug log with a reason
- [ ] The bug log lists any known limitations for the report (for example, offline video playback, which content scripts don't support)

# Week 11 A: performance

Measured with `node tools/benchmark.js` on the full dictionary (22,572 entries) and a deck of every kanji word (17,890 cards). Times are the median of several runs.

## Baseline

| Operation | Median (ms) | When it runs |
|---|---|---|
| Parse dictionary | 33.9 | Every page that uses the dictionary |
| Build word graph | 211.1 | Every page that uses the dictionary |
| Graph distractors, per question | 0.8 | Once per quiz question |
| Propagation over 17,890 cards | 2.6 | Once per wrong answer |
| Next words over full dictionary | 16.8 | When the Next words page opens |
| Build kanji part index | 4.5 | When the Kanji page opens |
| List kanji containing 日 | 0.03 | Each click in the kanji explorer |

The slowest operation is building the word graph, at 211 ms.

## The change

The review page built the graph when it opened, but the graph is only needed for a wrong answer. It is now built on the first wrong answer and kept for the rest of the visit.

Effect on the review page when it opens:

| | Before | After |
|---|---|---|
| Work before the page is ready | about 245 ms (parse 34 ms + graph 211 ms) | about 34 ms (parse only) |
| First wrong answer | immediate | about 211 ms longer, once |

The quiz page still builds the graph on opening, because its first question needs graph-based choices.

## Why the other operations were left alone

- **Parse dictionary (34 ms):** cheap, and it has to run once per page.
- **Propagation (2.6 ms):** far below anything a learner would notice.
- **Next words (17 ms):** runs only when that page opens, so it isn't a repeated cost.
- **Kanji index and lookups (4.5 ms and 0.03 ms):** already fast.

## Limitations

- The graph build itself is unchanged, at about 211 ms. Moving it to a background worker would remove that pause entirely, but it was not worth the extra complexity this week.
- The quiz page still pays the graph cost on opening.
- All figures were measured on one Windows laptop running WSL, so they will differ on other machines.

# Week 7 D: scheduler and propagation parameters

## Chosen defaults

| Parameter | Value | Where | Reason |
|---|---|---|---|
| New card due time | now | scheduler.js | A new word should be reviewed straight away. |
| Interval after a correct answer | doubles (1, 2, 4, 8 ... days) | scheduler.js | Words you know well are seen less often, the core idea of spaced repetition. |
| Interval after a wrong answer | reset to 1 day | scheduler.js | A wrong word needs relearning from the start. |
| Wrong-word retry delay | 10 minutes | scheduler.js | The word comes back in the same session, before the mistake fades. |
| Propagation decay | 0.5 | propagation.js | Gives related words a delay of half a day for one hop, and three-quarters of a day for two hops. |
| Propagation depth | 2 hops | propagation.js | Reaches words that share a kanji with a neighbor, without reaching most of the dictionary. |
| Per-word cap | 10 neighbors | propagation.js | Stops one wrong answer from crowding the queue (see results). |
| Propagation base delay | 1 day | propagation.js | Related words come back before their normal due time, but after the wrong word itself. |
| Propagation never pushes later | enforced | propagation.js | Propagation should only bring words sooner. |

## How the propagation parameters work

- **Strength** for a word n hops away is decay^n.
- **Delay** is base delay × (1 − strength). With decay 0.5, one hop gives 0.5 × 1 day = 12 hours, and two hops give 0.75 × 1 day = 18 hours.
- **Higher decay means a stronger pull**: related words come back sooner. Lower decay means a gentler pull.
- **Cap** is the number of neighbors each word passes the pull to, taking the strongest first.

## Measured results

Source: `node extension/scheduler/tune-propagation.js`. Deck: all 17,890 kanji words, due times spread over 1 to 10 days. Test wrong words: the 20 most connected words.

```
Cap   Decay  avg moved  worst moved  avg delay (h)  worst time (ms)
10    0.3    47         66           20.8           7.7
10    0.5    47         66           16.7           3.2
10    0.7    47         66           11.2           4.1
1000  0.3    3931       4866         21.6           40.2
1000  0.5    3931       4866         17.7           19.0
1000  0.7    3931       4866         12.0           21.9
```

## Reasoning

1. **The cap is needed.** Without it, one wrong answer moved about 22% of the deck on average (3,931 of 17,890), and the worst case moved 4,866. That crowds out the rest of the review queue. With a cap of 10, the average is 47 cards (about 0.3%), and the worst is 66.
2. **Decay 0.5 is the middle choice.** Decay 0.3 pulls related words back about 21 hours on average, which is so gentle the learner may not notice. Decay 0.7 pulls them back about 11 hours, which makes related words nearly as urgent as the wrong word. Decay 0.5 gives about 17 hours: the same day or the next morning.
3. **Speed is not the constraint.** Every setting runs in under 50 ms per wrong answer, which is fast enough for a review screen. The cap was chosen for crowding, not speed.

## Automated checks

- `extension/scheduler/test-scheduler.js`: 14 checks on intervals, retries, due ordering, and the min-heap.
- `extension/scheduler/test-propagation.js`: 12 checks on distance fade, the hop limit, unrelated words, never pushing later, and a real-graph check using dictionary entries.
- `extension/scheduler/tune-propagation.js`: checks that the cap bound holds for every decay value, and that each run stays under 200 ms.

## Limitations to state in the report

- The parameters were chosen by reasoning and measured on a synthetic spread of due times, not on real learners. Real use would be the next thing to tune.
- Only the kanji-sharing graph is used. The weaker radical-level links are not built.
- The name "decay" is misleading, because a higher value gives a stronger pull. Renaming it to "pull" would be a clear improvement in a later cleanup.

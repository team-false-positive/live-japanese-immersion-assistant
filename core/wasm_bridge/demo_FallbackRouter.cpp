// demo_FallbackRouter.cpp -- Module D deliverable demo.
// Runs three videos through ONE FallbackRouter + ONE SubtitleDisplay:
//   A. captioned video              (captions path)
//   B. uncaptioned / live news      (Whisper path)
//   C. captions vanish mid-video    (captions -> Whisper switch)

#include "FallbackRouter.h"

#include <cstdio>
#include <iostream>

static void runVideo(const char* title, FallbackRouter& router,
                     SubtitleDisplay& display, double endSec) {
    std::printf("\n==================== %s ====================\n", title);
    display.reset();
    SourceKind first = router.beginVideo(0.0);
    std::printf("-- start: using %s\n", sourceName(first));

    SourceKind last = first;
    for (double t = 0.0; t < endSec; t += 0.5) {
        const SubtitleCue* cue = router.tick(t);
        if (router.active() != last) {
            std::printf("-- [%05.1fs] SWITCH %s -> %s\n", t, sourceName(last),
                        sourceName(router.active()));
            last = router.active();
        }
        display.show(stdout, t, cue, router.active());  // the ONE display path
    }
    std::cout << "-- end: " << display.shownCount()
              << " lines shown, final source = " << sourceName(router.active())
              << '\n';
}

int main() {
    // A. Captioned drama (studio captions).
    static const SubtitleCue drama[] = {
        {1.0, 3.0, "おはようございます。", "Good morning."},
        {3.5, 5.5, "今日はいい天気ですね。", "Nice weather today, isn't it?"},
        {6.0, 8.0, "駅までいっしょに行きましょう。", "Let's go to the station together."},
        {8.5, 10.0, "はい、行きましょう。", "Yes, let's go."},
    };

    // B. Live news, no captions anywhere: this is what Whisper would hear.
    static const SubtitleCue news[] = {
        {1.0, 3.0, "こんにちは、ニュースの時間です。", "Hello, it's time for the news."},
        {3.5, 5.5, "今日は東京で大雨が降っています。", "Heavy rain is falling in Tokyo today."},
        {6.0, 8.0, "電車は一部で止まっています。", "Some trains have stopped running."},
        {8.5, 10.0, "明日は晴れるでしょう。", "It should be sunny tomorrow."},
    };

    // C. Captioned video whose track disappears at t = 7.0 s.
    static const SubtitleCue lecture[] = {
        {1.0, 3.0, "今日は漢字について話します。", "Today we talk about kanji."},
        {3.5, 5.5, "漢字は部首に分けられます。", "Kanji can be split into radicals."},
        {6.0, 8.0, "たとえば、「休」は人と木です。", "For example, 休 is person + tree."},
        {8.5, 10.5, "人が木の横で休んでいます。", "A person rests beside a tree."},
        {11.0, 13.0, "では、次の漢字を見ましょう。", "Now, let's look at the next kanji."},
        {13.5, 15.5, "ありがとうございました。", "Thank you very much."},
    };

    SubtitleDisplay display;  // ONE display shared by every path

    // A: captions healthy for the whole video.
    {
        CaptionTrackFeed cap(drama, 4);
        WhisperFallbackFeed wh(drama, 4);
        FallbackRouter r(&cap, &wh);
        runVideo("A: captioned video (captions path)", r, display, 12.0);
    }
    // B: no caption track exists at all.
    {
        CaptionTrackFeed cap(nullptr, 0);
        WhisperFallbackFeed wh(news, 4, 1.5);
        FallbackRouter r(&cap, &wh);
        runVideo("B: uncaptioned / live video (Whisper path)", r, display, 13.0);
    }
    // C: captions vanish mid-video.
    {
        CaptionTrackFeed cap(lecture, 6, /*dropout*/ 7.0);
        WhisperFallbackFeed wh(lecture, 6, 1.5);
        RouterConfig cfg;
        cfg.dropoutGraceSec = 1.0;
        FallbackRouter r(&cap, &wh, cfg);
        runVideo("C: captions disappear mid-video (clean switch)", r, display, 18.0);
    }
    return 0;
}

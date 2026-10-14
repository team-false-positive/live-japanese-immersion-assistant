// test_FallbackRouter.cpp -- standalone tests for Module D (no framework).
// Build: see README.md

#include "../wasm_bridge/FallbackRouter.h"

#include <cstdio>
#include <cstring>

static int g_checks = 0, g_failed = 0;
#define CHECK(cond)                                                          \
    do {                                                                     \
        ++g_checks;                                                          \
        if (!(cond)) {                                                       \
            ++g_failed;                                                      \
            std::printf("  FAIL %s:%d  %s\n", __FILE__, __LINE__, #cond);    \
        }                                                                    \
    } while (0)

// Shared script: 4 lines, 1s long each, starting at t = 1, 3, 5, 7.
static const SubtitleCue kScript[4] = {
    {1.0, 2.0, "one", "ONE"},
    {3.0, 4.0, "two", "TWO"},
    {5.0, 6.0, "three", "THREE"},
    {7.0, 8.0, "four", "FOUR"},
};
static const std::size_t kN = 4;

// 1. Captioned video starts on captions and returns the right cue.
static void testCaptionedStart() {
    CaptionTrackFeed cap(kScript, kN);
    WhisperFallbackFeed wh(kScript, kN);
    FallbackRouter r(&cap, &wh);
    CHECK(r.beginVideo(0.0) == SourceKind::Captions);
    CHECK(r.active() == SourceKind::Captions);
    const SubtitleCue* c = r.tick(1.5);
    CHECK(c != nullptr && c->jp == "one");
    CHECK(r.tick(2.5) == nullptr);          // gap between lines is not a dropout
    CHECK(r.active() == SourceKind::Captions);
    CHECK(r.switchCount() == 1);            // only the initial pick
    CHECK(!wh.isActive());                  // Whisper never started
}

// 2. Uncaptioned video falls back to Whisper; cues arrive latency-late.
static void testUncaptionedUsesWhisper() {
    CaptionTrackFeed cap(nullptr, 0);       // no track at all
    WhisperFallbackFeed wh(kScript, kN, 1.5);
    FallbackRouter r(&cap, &wh);
    CHECK(r.beginVideo(0.0) == SourceKind::Whisper);
    CHECK(wh.isActive());
    CHECK(r.tick(1.5) == nullptr);          // spoken at t=1, not shown until 2.5
    const SubtitleCue* c = r.tick(2.6);
    CHECK(c != nullptr && c->en == "ONE");
}

// 3. Neither source usable: no crash, nullptr, state None.
static void testNothingAvailable() {
    FallbackRouter r(nullptr, nullptr);
    CHECK(r.beginVideo(0.0) == SourceKind::None);
    CHECK(r.tick(1.0) == nullptr);
    CHECK(r.active() == SourceKind::None);
    CHECK(r.switchCount() == 0);
    CHECK(r.switchEvent(0) == nullptr);
}

// 4. Router before beginVideo() is inert.
static void testTickBeforeBegin() {
    CaptionTrackFeed cap(kScript, kN);
    FallbackRouter r(&cap, nullptr);
    CHECK(r.tick(1.5) == nullptr);
    CHECK(r.active() == SourceKind::None);
}

// 5. Permanent mid-video dropout -> exactly one clean switch to Whisper.
static void testMidVideoDropoutSwitches() {
    CaptionTrackFeed cap(kScript, kN, /*dropout*/ 4.5);
    WhisperFallbackFeed wh(kScript, kN, 1.5);
    RouterConfig cfg; cfg.dropoutGraceSec = 1.0;
    FallbackRouter r(&cap, &wh, cfg);
    r.beginVideo(0.0);

    for (double t = 0.0; t < 12.0; t += 0.5) r.tick(t);

    CHECK(r.active() == SourceKind::Whisper);
    CHECK(r.switchCount() == 2);            // initial pick + one switch
    const SwitchEvent* e = r.switchEvent(1);
    CHECK(e != nullptr);
    if (e) {
        CHECK(e->from == SourceKind::Captions);
        CHECK(e->to == SourceKind::Whisper);
        CHECK(e->atSec >= 5.5 && e->atSec < 6.0);   // dropout 4.5 + grace 1.0
        CHECK(std::strcmp(e->reason, "captions dropped mid-video") == 0);
    }
}

// 6. After the switch, Whisper shows only lines spoken from the dropout on
//    (line "two" at t=3 was before warm-up and must NOT be replayed).
static void testNoReplayAfterSwitch() {
    CaptionTrackFeed cap(kScript, kN, 4.5);
    WhisperFallbackFeed wh(kScript, kN, 1.5);
    FallbackRouter r(&cap, &wh);
    r.beginVideo(0.0);
    bool sawTwo = false, sawThree = false, sawFour = false;
    for (double t = 0.0; t < 12.0; t += 0.25) {
        const SubtitleCue* c = r.tick(t);
        if (!c) continue;
        if (c->jp == "two"   && r.active() == SourceKind::Whisper) sawTwo = true;
        if (c->jp == "three" && r.active() == SourceKind::Whisper) sawThree = true;
        if (c->jp == "four"  && r.active() == SourceKind::Whisper) sawFour = true;
    }
    CHECK(!sawTwo);
    CHECK(sawThree);                        // spoken at t=5 >= warm-up at 4.5
    CHECK(sawFour);
}

// 7. Short glitch (< grace) does not switch; Whisper warm-up is cancelled.
static void testTransientGlitchIgnored() {
    CaptionTrackFeed cap(kScript, kN, /*dropout*/ 4.5, /*reappear*/ 5.0);
    WhisperFallbackFeed wh(kScript, kN);
    RouterConfig cfg; cfg.dropoutGraceSec = 1.0;
    FallbackRouter r(&cap, &wh, cfg);
    r.beginVideo(0.0);
    r.tick(4.5);
    CHECK(wh.isActive());                   // warming up during the suspicion window
    r.tick(5.0);
    CHECK(!wh.isActive());                  // captions are back, warm-up cancelled
    for (double t = 5.0; t < 10.0; t += 0.5) r.tick(t);
    CHECK(r.active() == SourceKind::Captions);
    CHECK(r.switchCount() == 1);
}

// 8. Forward-only: captions reappearing after the switch do NOT switch back.
static void testForwardOnly() {
    CaptionTrackFeed cap(kScript, kN, 2.0, /*reappear*/ 8.0);
    WhisperFallbackFeed wh(kScript, kN);
    FallbackRouter r(&cap, &wh);
    r.beginVideo(0.0);
    for (double t = 0.0; t < 12.0; t += 0.5) r.tick(t);
    CHECK(r.active() == SourceKind::Whisper);
    CHECK(r.switchCount() == 2);
}

// 9. Captions die and there is no Whisper feed: ends in None, no crash.
static void testDropoutWithoutFallback() {
    CaptionTrackFeed cap(kScript, kN, 2.0);
    FallbackRouter r(&cap, nullptr);
    r.beginVideo(0.0);
    for (double t = 0.0; t < 6.0; t += 0.5) r.tick(t);
    CHECK(r.active() == SourceKind::None);
    CHECK(r.tick(5.0) == nullptr);
}

// 10. An unavailable Whisper feed is not selected after captions drop out.
static void testDropoutWithUnavailableFallback() {
    CaptionTrackFeed cap(kScript, kN, 2.0);
    WhisperFallbackFeed wh(nullptr, 0);
    RouterConfig cfg; cfg.dropoutGraceSec = 1.0;
    FallbackRouter r(&cap, &wh, cfg);
    r.beginVideo(0.0);
    for (double t = 0.0; t < 6.0; t += 0.5) r.tick(t);
    CHECK(r.active() == SourceKind::None);
    CHECK(!wh.isActive());
}

// 11. Same router reused for a second video: state fully reset.
static void testRouterReusedForNextVideo() {
    CaptionTrackFeed cap(kScript, kN, 2.0);
    WhisperFallbackFeed wh(kScript, kN);
    FallbackRouter r(&cap, &wh);
    r.beginVideo(0.0);
    for (double t = 0.0; t < 6.0; t += 0.5) r.tick(t);
    CHECK(r.active() == SourceKind::Whisper);

    CaptionTrackFeed cap2(kScript, kN);     // a healthy captioned video
    FallbackRouter r2(&cap2, &wh);
    CHECK(r2.beginVideo(0.0) == SourceKind::Captions);
    CHECK(!wh.isActive());                  // beginVideo() stopped the old session

    CHECK(r.beginVideo(0.0) == SourceKind::Captions);  // dropout is at 2.0, still fine at 0
    CHECK(r.switchCount() == 1);
}

// 12. Seeking backwards after fallback keeps the source (no flip-flop).
static void testSeekBackKeepsSource() {
    CaptionTrackFeed cap(kScript, kN, 2.0);
    WhisperFallbackFeed wh(kScript, kN);
    FallbackRouter r(&cap, &wh);
    r.beginVideo(0.0);
    for (double t = 0.0; t < 6.0; t += 0.5) r.tick(t);
    CHECK(r.active() == SourceKind::Whisper);
    r.tick(1.0);                            // user seeks back
    CHECK(r.active() == SourceKind::Whisper);
    CHECK(r.switchCount() == 2);
}

// 13. Unified display: identical layout for both sources, no duplicate prints.
static void testUnifiedDisplay() {
    SubtitleDisplay d;
    std::string a = d.format(65.0, kScript[0], SourceKind::Captions);
    std::string b = d.format(65.0, kScript[0], SourceKind::Whisper);
    CHECK(a.find("[01:05] (captions)") == 0);
    CHECK(b.find("[01:05] (whisper)") == 0);
    CHECK(a.substr(a.find('\n')) == b.substr(b.find('\n')));   // same body

    std::FILE* f = std::tmpfile();
    CHECK(f != nullptr);
    if (f) {
        CHECK(d.show(f, 1.0, &kScript[0], SourceKind::Captions));
        CHECK(!d.show(f, 1.5, &kScript[0], SourceKind::Captions));  // same cue: skip
        CHECK(d.show(f, 3.0, &kScript[1], SourceKind::Captions));
        CHECK(!d.show(f, 3.5, nullptr, SourceKind::Captions));      // nothing to show
        CHECK(d.shownCount() == 2);
        std::fclose(f);
    }
}

int main() {
    struct { const char* name; void (*fn)(); } tests[] = {
        {"captioned video starts on captions", testCaptionedStart},
        {"uncaptioned video uses whisper", testUncaptionedUsesWhisper},
        {"nothing available -> None", testNothingAvailable},
        {"tick before beginVideo is inert", testTickBeforeBegin},
        {"mid-video dropout switches once", testMidVideoDropoutSwitches},
        {"no replay of lines before warm-up", testNoReplayAfterSwitch},
        {"transient glitch ignored", testTransientGlitchIgnored},
        {"forward-only (no switch back)", testForwardOnly},
        {"dropout with no whisper feed", testDropoutWithoutFallback},
        {"dropout with unavailable whisper feed", testDropoutWithUnavailableFallback},
        {"router reused for next video", testRouterReusedForNextVideo},
        {"seek back keeps source", testSeekBackKeepsSource},
        {"unified display", testUnifiedDisplay},
    };
    const int n = static_cast<int>(sizeof tests / sizeof tests[0]);
    for (int i = 0; i < n; ++i) {
        int before = g_failed;
        tests[i].fn();
        std::printf("[%s] %s\n", g_failed == before ? "PASS" : "FAIL", tests[i].name);
    }
    std::printf("\n%d tests, %d assertions, %d failed\n", n, g_checks, g_failed);
    return g_failed == 0 ? 0 : 1;
}

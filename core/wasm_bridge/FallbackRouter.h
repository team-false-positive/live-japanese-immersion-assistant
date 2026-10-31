// FallbackRouter.h  --  Module D: Fallback Routing Logic
// Live Japanese Immersion Assistant
//
// JOB: per video, decide whether subtitles come from the platform's existing
// caption track (Module C path) or from live Whisper transcription (fallback),
// and switch cleanly if the captions disappear mid-video. Both sources are
// exposed through ONE interface (SubtitleFeed) so the display never knows or
// cares where a cue came from.
//
// CONVENTIONS (team-wide):
//   * nullptr on recoverable failure / "nothing to show" -- never exceptions.
//   * Stub-first: CaptionTrackFeed and WhisperFallbackFeed are scripted stubs.
//     Places where the real implementation must replace a stub are marked
//     with "ADAPT:" comments.
//   * Header-only, C++17.
//
// STATE MACHINE (forward-only):
//
//        beginVideo()
//             |
//     captions available? --yes--> [CAPTIONS] --dropout >= grace--> [WHISPER]
//             |                        |                               (terminal)
//             no                       +-- back within grace --> stay CAPTIONS
//             |                            (Whisper warm-up cancelled)
//             v
//        [WHISPER] (terminal)          neither feed usable --> [NONE]
//
// Once on Whisper we never go back to captions for that video: flip-flopping
// between sources causes duplicate / out-of-order lines, which is exactly what
// "switch cleanly" means we must avoid.

#ifndef FALLBACK_ROUTER_H
#define FALLBACK_ROUTER_H

#include <cstddef>
#include <cstdio>
#include <string>

// ---------------------------------------------------------------- basic types

enum class SourceKind { None, Captions, Whisper };

inline const char* sourceName(SourceKind k) {
    switch (k) {
        case SourceKind::Captions: return "captions";
        case SourceKind::Whisper:  return "whisper";
        default:                   return "none";
    }
}

// One subtitle line: Japanese on top, English below (same for every source).
struct SubtitleCue {
    double startSec = 0.0;
    double endSec = 0.0;
    std::string jp;
    std::string en;
};

// ------------------------------------------------------- the shared interface
// C analogy: a struct of function pointers. Each feed fills in the same
// "slots"; the router calls through them without knowing which feed it has.
class SubtitleFeed {
public:
    virtual ~SubtitleFeed() {}

    // Can this feed produce subtitles right now?
    virtual bool isAvailable(double nowSec) const = 0;

    // Cue to display at nowSec, or nullptr (gap between lines, or unavailable).
    // The returned pointer stays valid until the feed is destroyed.
    virtual const SubtitleCue* cueAt(double nowSec) = 0;

    virtual SourceKind kind() const = 0;

    // Router tells the feed when it is being (de)activated. Defaults: no-op.
    virtual void onActivate(double nowSec) { (void)nowSec; }
    virtual void onDeactivate() {}
};

// ----------------------------------------------------------- stub: caption feed
// ADAPT: replace with the real caption-track reader (Week 3 Module C path) that
// reads the platform's DOM/API caption track. The router only needs
// isAvailable() to become false when the track detaches.
//
// cues/count are NOT owned (like passing a C array + length).
// dropoutAtSec / reappearAtSec script an outage: the track is gone in
// [dropoutAtSec, reappearAtSec). dropoutAtSec < 0 means "never drops".
// reappearAtSec < 0 means "never comes back".
class CaptionTrackFeed : public SubtitleFeed {
public:
    CaptionTrackFeed(const SubtitleCue* cues, std::size_t count,
                     double dropoutAtSec = -1.0, double reappearAtSec = -1.0)
        : cues_(cues), count_(count),
          dropoutAt_(dropoutAtSec), reappearAt_(reappearAtSec) {}

    bool isAvailable(double nowSec) const override {
        if (cues_ == nullptr || count_ == 0) return false;
        if (dropoutAt_ < 0.0 || nowSec < dropoutAt_) return true;
        return reappearAt_ >= 0.0 && nowSec >= reappearAt_;
    }

    const SubtitleCue* cueAt(double nowSec) override {
        if (!isAvailable(nowSec)) return nullptr;
        for (std::size_t i = 0; i < count_; ++i) {
            if (nowSec >= cues_[i].startSec && nowSec < cues_[i].endSec)
                return &cues_[i];
        }
        return nullptr;  // a gap between lines is NOT a dropout
    }

    SourceKind kind() const override { return SourceKind::Captions; }

private:
    const SubtitleCue* cues_;
    std::size_t count_;
    double dropoutAt_;
    double reappearAt_;
};

// --------------------------------------------------------- stub: Whisper feed
// ADAPT: replace with the real Whisper.cpp pipeline (this week's work).
// The stub is given the "what was actually said" script and models two real
// properties of live ASR:
//   1. LATENCY: a line is shown latencySec after it was spoken (1-3 s).
//   2. NO TIME TRAVEL: it can only transcribe audio heard AFTER it was
//      activated, so lines spoken before onActivate() are never produced.
class WhisperFallbackFeed : public SubtitleFeed {
public:
    WhisperFallbackFeed(const SubtitleCue* spoken, std::size_t count,
                        double latencySec = 1.5)
        : spoken_(spoken), count_(count), latency_(latencySec) {}

    // The model runs on-device, so it is always "available" to be started.
    bool isAvailable(double) const override { return spoken_ != nullptr; }

    const SubtitleCue* cueAt(double nowSec) override {
        if (!active_) return nullptr;
        for (std::size_t i = 0; i < count_; ++i) {
            if (spoken_[i].startSec < activatedAt_) continue;  // never heard it
            if (nowSec >= spoken_[i].startSec + latency_ &&
                nowSec <  spoken_[i].endSec + latency_)
                return &spoken_[i];
        }
        return nullptr;
    }

    SourceKind kind() const override { return SourceKind::Whisper; }

    void onActivate(double nowSec) override { active_ = true; activatedAt_ = nowSec; }
    void onDeactivate() override { active_ = false; }

    bool isActive() const { return active_; }  // for tests / status display

private:
    const SubtitleCue* spoken_;
    std::size_t count_;
    double latency_;
    bool active_ = false;
    double activatedAt_ = 0.0;
};

// ---------------------------------------------------------------- the router

struct RouterConfig {
    // Captions must be gone this long before we commit to Whisper. Filters out
    // momentary glitches (track re-attaching after a seek / ad break).
    double dropoutGraceSec = 1.0;
};

struct SwitchEvent {
    double atSec = 0.0;
    SourceKind from = SourceKind::None;
    SourceKind to = SourceKind::None;
    const char* reason = "";  // string literal, never freed
};

class FallbackRouter {
public:
    // Feeds are NOT owned. Either may be nullptr (= that source is unusable).
    FallbackRouter(SubtitleFeed* captions, SubtitleFeed* whisper,
                   RouterConfig cfg = RouterConfig())
        : captions_(captions), whisper_(whisper), cfg_(cfg) {}

    // Start a new video: reset state and pick the initial source.
    // Returns the chosen source (None if neither feed is usable).
    SourceKind beginVideo(double nowSec) {
        if (whisper_) whisper_->onDeactivate();
        active_ = SourceKind::None;
        unavailableSince_ = -1.0;
        eventCount_ = 0;
        begun_ = true;
        pickInitial(nowSec);
        return active_;
    }

    // Call once per display refresh. Returns the cue to show, or nullptr.
    const SubtitleCue* tick(double nowSec) {
        if (!begun_) return nullptr;

        if (active_ == SourceKind::None)          pickInitial(nowSec);   // late captions
        else if (active_ == SourceKind::Captions) watchCaptions(nowSec);

        switch (active_) {
            case SourceKind::Captions: return captions_ ? captions_->cueAt(nowSec) : nullptr;
            case SourceKind::Whisper:  return whisper_  ? whisper_->cueAt(nowSec)  : nullptr;
            default:                   return nullptr;
        }
    }

    SourceKind active() const { return active_; }
    std::size_t switchCount() const { return eventCount_; }

    // nullptr if index out of range (team convention).
    const SwitchEvent* switchEvent(std::size_t i) const {
        return i < eventCount_ ? &events_[i] : nullptr;
    }

private:
    static const std::size_t kMaxEvents = 8;

    void pickInitial(double nowSec) {
        if (captions_ && captions_->isAvailable(nowSec)) {
            switchTo(SourceKind::Captions, nowSec, "captions available");
        } else if (whisper_ && whisper_->isAvailable(nowSec)) {
            whisper_->onActivate(nowSec);
            switchTo(SourceKind::Whisper, nowSec, "no captions, using whisper");
        }
        // else: stay None
    }

    // Only called while active_ == Captions.
    void watchCaptions(double nowSec) {
        if (captions_ && captions_->isAvailable(nowSec)) {
            if (unavailableSince_ >= 0.0) {          // false alarm: it came back
                unavailableSince_ = -1.0;
                if (whisper_) whisper_->onDeactivate();
            }
            return;
        }

        if (unavailableSince_ < 0.0) {               // first missing poll
            unavailableSince_ = nowSec;
            if (whisper_ && whisper_->isAvailable(nowSec)) {
                whisper_->onActivate(nowSec);        // warm up to avoid a gap
            }
        }
        if (nowSec - unavailableSince_ >= cfg_.dropoutGraceSec) {
            if (whisper_ && whisper_->isAvailable(nowSec)) {
                switchTo(SourceKind::Whisper, nowSec, "captions dropped mid-video");
            } else {
                switchTo(SourceKind::None, nowSec, "captions dropped, no fallback");
            }
        }
    }

    void switchTo(SourceKind to, double nowSec, const char* reason) {
        if (eventCount_ < kMaxEvents) {
            SwitchEvent& e = events_[eventCount_++];
            e.atSec = nowSec;
            e.from = active_;
            e.to = to;
            e.reason = reason;
        }
        active_ = to;
        unavailableSince_ = -1.0;
    }

    SubtitleFeed* captions_;
    SubtitleFeed* whisper_;
    RouterConfig cfg_;
    SourceKind active_ = SourceKind::None;
    double unavailableSince_ = -1.0;
    bool begun_ = false;
    SwitchEvent events_[kMaxEvents];
    std::size_t eventCount_ = 0;
};

// ------------------------------------------------- one unified subtitle display
// Same layout for every source, so the viewer sees one consistent subtitle bar.
// ADAPT: in the browser extension this becomes the overlay renderer; the
// formatting contract (JP on top, EN below) stays the same.
class SubtitleDisplay {
public:
    std::string format(double nowSec, const SubtitleCue& cue, SourceKind src) const {
        char stamp[32];
        int total = static_cast<int>(nowSec);
        std::snprintf(stamp, sizeof stamp, "[%02d:%02d] (%s)", total / 60, total % 60, sourceName(src));
        return std::string(stamp) + "\n    " + cue.jp + "\n    " + cue.en + "\n";
    }

    // Prints only when the cue changes (no repeated lines on every tick).
    // Returns true if something was printed.
    bool show(std::FILE* out, double nowSec, const SubtitleCue* cue, SourceKind src) {
        if (cue == nullptr) return false;
        if (shown_ > 0 && cue->jp == lastJp_ && cue->startSec == lastStart_) return false;
        std::fputs(format(nowSec, *cue, src).c_str(), out);
        lastJp_ = cue->jp;
        lastStart_ = cue->startSec;
        ++shown_;
        return true;
    }

    void reset() { shown_ = 0; lastJp_.clear(); lastStart_ = 0.0; }
    std::size_t shownCount() const { return shown_; }

private:
    std::string lastJp_;
    double lastStart_ = 0.0;
    std::size_t shown_ = 0;
};

#endif  // FALLBACK_ROUTER_H

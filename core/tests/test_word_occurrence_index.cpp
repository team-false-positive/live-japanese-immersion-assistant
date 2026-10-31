// test_word_occurrence_index.cpp
//
// Standalone assertion-heavy test suite for WordOccurrenceIndex.h
// (Module C addition — Cross-Platform Word Unification)
//
// Build:
//   g++ -std=c++17 -Wall -Wextra -Wshadow -Wconversion
//       -fsanitize=address,undefined -g
//       test_word_occurrence_index.cpp -o test_word_occurrence_index
//
// Run:
//   ./test_word_occurrence_index

#include "../WordOccurrenceIndex.h"

#include <cassert>
#include <iostream>
#include <string>

namespace {

int g_testsRun = 0;
int g_assertionsRun = 0;

// Lightweight assertion wrapper so we get a running assertion count
// (mirrors the style used in the WordGraph test suite) instead of a bare
// assert() that gives no visibility into how many checks passed.
void check(bool condition, const std::string& description) {
    ++g_assertionsRun;
    if (!condition) {
        std::cerr << "ASSERTION FAILED: " << description << "\n";
        assert(false && "assertion failed");
    }
}

void beginTest(const std::string& name) {
    ++g_testsRun;
    std::cout << "[TEST " << g_testsRun << "] " << name << "\n";
}

// ---------------------------------------------------------------------
// Test 1: A brand-new word creates exactly one entry.
// ---------------------------------------------------------------------
void testNewWordCreatesEntry() {
    beginTest("new word creates a single entry");
    WordOccurrenceIndex index;
    check(index.uniqueWordCount() == 0, "index starts empty");

    index.recordOccurrence("\xe6\x97\xa5\xe6\x9c\xac", "video_01", 12.5); // 日本
    check(index.uniqueWordCount() == 1, "one word tracked after first record");
    check(index.occurrenceCount("\xe6\x97\xa5\xe6\x9c\xac") == 1, "one occurrence recorded");
    check(index.showCount("\xe6\x97\xa5\xe6\x9c\xac") == 1, "seen in one show so far");
}

// ---------------------------------------------------------------------
// Test 2: The core cross-platform unification guarantee — the same word
// from two DIFFERENT videos lands under ONE entry with BOTH occurrences.
// ---------------------------------------------------------------------
void testSameWordAcrossTwoVideosIsUnified() {
    beginTest("same word from two different videos unifies to one entry");
    WordOccurrenceIndex index;
    const std::string word = "\xe5\x8b\x89\xe5\xbc\xb7"; // 勉強 (study)

    index.recordOccurrence(word, "anime_episode_03", 45.2);
    index.recordOccurrence(word, "news_broadcast_07", 118.75);

    check(index.uniqueWordCount() == 1, "still exactly one entry for the word");
    check(index.occurrenceCount(word) == 2, "both occurrences recorded");
    check(index.showCount(word) == 2, "occurrences span two distinct shows");

    const WordEntry* entry = index.lookup(word);
    check(entry != nullptr, "lookup returns a valid entry");
    check(entry->word == word, "entry stores the correct word");
    check(entry->occurrences.size() == 2, "entry's occurrence list has both hits");
    check(entry->occurrences[0].show == "anime_episode_03", "first occurrence's show is correct");
    check(entry->occurrences[1].show == "news_broadcast_07", "second occurrence's show is correct");
    check(entry->occurrences[0].timestampSec == 45.2, "first occurrence's timestamp is correct");
    check(entry->occurrences[1].timestampSec == 118.75, "second occurrence's timestamp is correct");
}

// ---------------------------------------------------------------------
// Test 3: Repeated occurrences of the same word within the SAME show are
// all recorded (not collapsed) — only cross-entry duplication is avoided.
// ---------------------------------------------------------------------
void testRepeatedOccurrencesWithinSameShow() {
    beginTest("repeated occurrences within one show all recorded");
    WordOccurrenceIndex index;
    const std::string word = "\xe3\x81\x82\xe3\x82\x8a\xe3\x81\x8c\xe3\x81\xa8\xe3\x81\x86"; // ありがとう

    index.recordOccurrence(word, "vlog_12", 5.0);
    index.recordOccurrence(word, "vlog_12", 200.0);
    index.recordOccurrence(word, "vlog_12", 310.4);

    check(index.uniqueWordCount() == 1, "one entry despite three sightings");
    check(index.occurrenceCount(word) == 3, "all three occurrences recorded");
    check(index.showCount(word) == 1, "all three occurrences share one show");
}

// ---------------------------------------------------------------------
// Test 4: Distinct words never collide with one another.
// ---------------------------------------------------------------------
void testDistinctWordsGetDistinctEntries() {
    beginTest("distinct words get distinct entries");
    WordOccurrenceIndex index;
    index.recordOccurrence("\xe6\x9c\xac", "video_a", 1.0);   // 本 (book)
    index.recordOccurrence("\xe6\xb0\xb4", "video_a", 2.0);   // 水 (water)
    index.recordOccurrence("\xe7\x81\xab", "video_b", 3.0);   // 火 (fire)

    check(index.uniqueWordCount() == 3, "three distinct words tracked");
    check(index.occurrenceCount("\xe6\x9c\xac") == 1, "book has one occurrence");
    check(index.occurrenceCount("\xe6\xb0\xb4") == 1, "water has one occurrence");
    check(index.occurrenceCount("\xe7\x81\xab") == 1, "fire has one occurrence");
}

// ---------------------------------------------------------------------
// Test 5: Lookup / counts on a never-seen word behave as documented
// recoverable failures (nullptr / 0), never throw or crash.
// ---------------------------------------------------------------------
void testUnseenWordIsRecoverableFailure() {
    beginTest("unseen word returns nullptr / zero counts, not an exception");
    WordOccurrenceIndex index;
    index.recordOccurrence("\xe6\x9c\xac", "video_a", 1.0);

    const std::string unseenWord = "\xe6\x9c\xaa\xe7\x9f\xa5"; // 未知 (unknown)
    check(index.lookup(unseenWord) == nullptr, "lookup returns nullptr for unseen word");
    check(index.occurrenceCount(unseenWord) == 0, "occurrenceCount is 0 for unseen word");
    check(index.showCount(unseenWord) == 0, "showCount is 0 for unseen word");
}

// ---------------------------------------------------------------------
// Test 6: allWords() reflects exactly the set of recorded words, with no
// duplicates, regardless of how many times each was recorded.
// ---------------------------------------------------------------------
void testAllWordsReflectsUniqueSet() {
    beginTest("allWords() returns exactly the unique tracked words");
    WordOccurrenceIndex index;
    index.recordOccurrence("\xe6\x9c\xac", "video_a", 1.0);
    index.recordOccurrence("\xe6\x9c\xac", "video_b", 2.0);
    index.recordOccurrence("\xe6\xb0\xb4", "video_a", 3.0);

    std::vector<std::string> words = index.allWords();
    check(words.size() == 2, "allWords() returns two distinct words");

    bool hasBook = false;
    bool hasWater = false;
    for (const std::string& w : words) {
        if (w == "\xe6\x9c\xac") hasBook = true;
        if (w == "\xe6\xb0\xb4") hasWater = true;
    }
    check(hasBook, "allWords() includes the book entry");
    check(hasWater, "allWords() includes the water entry");
}

// ---------------------------------------------------------------------
// Test 7: An empty index reports zero for every query without crashing.
// ---------------------------------------------------------------------
void testEmptyIndexIsWellBehaved() {
    beginTest("empty index behaves safely for all queries");
    WordOccurrenceIndex index;
    check(index.uniqueWordCount() == 0, "empty index has zero words");
    check(index.allWords().empty(), "empty index's allWords() is empty");
    check(index.lookup("anything") == nullptr, "lookup on empty index returns nullptr");
    check(index.occurrenceCount("anything") == 0, "occurrenceCount on empty index is 0");
    check(index.showCount("anything") == 0, "showCount on empty index is 0");
}

// ---------------------------------------------------------------------
// Test 8: Demonstration scenario mirroring the deliverable description —
// "saving the same word from two different videos shows both occurrences
// under one entry."
// ---------------------------------------------------------------------
void testDeliverableDemonstrationScenario() {
    beginTest("deliverable demo: same word, two videos, one entry, both occurrences visible");
    WordOccurrenceIndex index;
    const std::string word = "\xe6\x97\xa5\xe6\x9c\xac\xe8\xaa\x9e"; // 日本語 (Japanese language)

    index.recordOccurrence(word, "documentary_kyoto.mp4", 342.1);
    index.recordOccurrence(word, "gaming_stream_ep5.mp4", 90.0);

    const WordEntry* entry = index.lookup(word);
    check(entry != nullptr, "the word resolves to a single, real entry");
    check(entry->occurrences.size() == 2, "both videos' occurrences are visible under it");

    bool sawDocumentary = false;
    bool sawGamingStream = false;
    for (const Occurrence& occ : entry->occurrences) {
        if (occ.show == "documentary_kyoto.mp4") sawDocumentary = true;
        if (occ.show == "gaming_stream_ep5.mp4") sawGamingStream = true;
    }
    check(sawDocumentary, "documentary occurrence is present");
    check(sawGamingStream, "gaming stream occurrence is present");
}

} // namespace

int main() {
    testNewWordCreatesEntry();
    testSameWordAcrossTwoVideosIsUnified();
    testRepeatedOccurrencesWithinSameShow();
    testDistinctWordsGetDistinctEntries();
    testUnseenWordIsRecoverableFailure();
    testAllWordsReflectsUniqueSet();
    testEmptyIndexIsWellBehaved();
    testDeliverableDemonstrationScenario();

    std::cout << "\nAll " << g_testsRun << " tests passed ("
              << g_assertionsRun << " assertions).\n";
    return 0;
}

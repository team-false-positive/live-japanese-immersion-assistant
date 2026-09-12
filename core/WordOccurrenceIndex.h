// WordOccurrenceIndex.h
//
// Module C addition — Cross-Platform Word Unification
//
// Guarantees that the same word seen on different platforms/videos maps to
// exactly one hash-table entry, with every {show, timestamp} occurrence
// recorded against that single entry. This is a standalone component: it
// does not depend on NaryTree.h or WordGraph.h, so it compiles and is
// testable independently of the rest of Module C.
//
// Error-handling convention (matches Module B / WordGraph):
//   Recoverable "not found" conditions return nullptr / 0, never throw.
//
// Complexity:
//   recordOccurrence: O(1) amortized (hash insert/lookup + vector push_back)
//   lookup / occurrenceCount / showCount: O(1) amortized hash lookup
//   uniqueWordCount: O(1)
//   allWords: O(n) over distinct words

#ifndef WORD_OCCURRENCE_INDEX_H
#define WORD_OCCURRENCE_INDEX_H

#include <cstddef>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

// A single sighting of a word: which show/video it came from and when
// (in seconds from the start of that show) it was spoken/seen.
struct Occurrence {
    std::string show;
    double timestampSec;

    Occurrence(std::string showIn, double timestampSecIn)
        : show(std::move(showIn)), timestampSec(timestampSecIn) {}
};

// The single, unified record for one word: the word itself plus every
// occurrence of it across every show/video it has been seen in.
struct WordEntry {
    std::string word;
    std::vector<Occurrence> occurrences;

    explicit WordEntry(std::string wordIn) : word(std::move(wordIn)) {}
};

class WordOccurrenceIndex {
public:
    WordOccurrenceIndex() = default;

    // Records that `word` was seen in `show` at `timestampSec`.
    //
    // If `word` has never been seen before, a new WordEntry is created.
    // If `word` has been seen before (on this show or any other), the new
    // {show, timestamp} occurrence is appended to the SAME entry — this is
    // the cross-platform unification guarantee: no duplicate entries are
    // ever created for a word that already exists in the index.
    void recordOccurrence(const std::string& word, const std::string& show, double timestampSec) {
        auto it = index_.find(word);
        if (it == index_.end()) {
            // emplace constructs the WordEntry in place; iterator from
            // emplace's result is reused below to avoid a second lookup.
            auto result = index_.emplace(word, WordEntry(word));
            it = result.first;
        }
        it->second.occurrences.emplace_back(show, timestampSec);
    }

    // Returns a pointer to the unified entry for `word`, or nullptr if the
    // word has never been recorded. Pointer is valid as long as this index
    // is alive and recordOccurrence() is not called again (hash map
    // rehashing may invalidate it, consistent with unordered_map semantics
    // for references/pointers to VALUES only under rehash — callers should
    // treat the pointer as short-lived, i.e. use-then-discard).
    const WordEntry* lookup(const std::string& word) const {
        auto it = index_.find(word);
        if (it == index_.end()) {
            return nullptr;
        }
        return &(it->second);
    }

    // Total number of {show, timestamp} occurrences recorded for `word`.
    // Returns 0 if the word has never been seen (not an error condition).
    std::size_t occurrenceCount(const std::string& word) const {
        const WordEntry* entry = lookup(word);
        if (entry == nullptr) {
            return 0;
        }
        return entry->occurrences.size();
    }

    // Number of DISTINCT shows/videos `word` has appeared in. This is the
    // number that demonstrates cross-platform unification: a word seen in
    // 2 different videos has showCount() == 2 but is still ONE entry.
    std::size_t showCount(const std::string& word) const {
        const WordEntry* entry = lookup(word);
        if (entry == nullptr) {
            return 0;
        }
        std::unordered_set<std::string> distinctShows;
        for (const Occurrence& occ : entry->occurrences) {
            distinctShows.insert(occ.show);
        }
        return distinctShows.size();
    }

    // Number of distinct words currently tracked by the index.
    std::size_t uniqueWordCount() const {
        return index_.size();
    }

    // All tracked words, in unspecified order (hash map iteration order).
    // Useful for iterating the full index when generating reports.
    std::vector<std::string> allWords() const {
        std::vector<std::string> words;
        words.reserve(index_.size());
        for (const auto& pair : index_) {
            words.push_back(pair.first);
        }
        return words;
    }

private:
    std::unordered_map<std::string, WordEntry> index_;
};

#endif // WORD_OCCURRENCE_INDEX_H

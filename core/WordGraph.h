// WordGraph.h
// Module C — Word-Relationship Graph Construction
//
// Builds a weighted, undirected graph over Japanese words, where an edge
// between two words means "these words are related through kanji/radical
// overlap":
//   - Shared KANJI  -> strong edge  (weight = kanjiWeight_,   default 10)
//   - Shared RADICAL -> weak edge   (weight = radicalWeight_, default 3)
//
// C-to-C++ framing (matching how we built Modules A and B):
//   - In C you'd build this by hand: an array of buckets, each bucket a
//     linked list of word pointers, keyed by hash(kanji). Here,
//     std::unordered_map / std::unordered_set ARE that hash table — no
//     malloc'd buckets, no manual chaining, no manual resize-on-load-factor
//     code. Same idea, compiler-checked, RAII-managed.
//   - Like Module A's insertChild(), lookups that can legitimately miss
//     (a kanji with no radical children, a word never added) return
//     nullptr / false / an empty container rather than throwing. Exceptions
//     are reserved for true programmer-error conditions (see addWord()).
//
// ---------------------------------------------------------------------------
// ASSUMED NaryTree<std::string> INTERFACE (Module A)
// ---------------------------------------------------------------------------
// This file only calls THREE things on your kanji tree. If Module A's real
// header names these differently, these are the only lines you need to
// change (search for "ADAPT:" below):
//
//   struct Node {
//       std::string data;              // the kanji/radical character
//       std::vector<Node*> children;   // its radical decomposition
//   };
//   Node* search(const std::string& value) const;  // nullptr if not found
//   Node* getRoot() const;                          // not used directly here,
//                                                    // kept for completeness
//
// If your real Module A instead exposes e.g. getChildren(Node*) as a method
// rather than a public field, or search() takes a Node* subtree root as a
// second argument, adjust the two call sites marked "ADAPT:" in
// buildRadicalIndex() below.
// ---------------------------------------------------------------------------

#ifndef WORD_GRAPH_H
#define WORD_GRAPH_H

#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <stdexcept>
#include <ostream>
#include <algorithm>

// Forward-declare the Module A tree so this header can compile standalone
// against the stub in the test file, or against the real NaryTree.h once
// it's #included before this header in the .cpp that uses both.
template <typename T>
class NaryTree;

struct Edge {
    std::string neighbor;
    int weight;

    bool operator==(const Edge& other) const {
        return neighbor == other.neighbor && weight == other.weight;
    }
};

class WordGraph {
public:
    // kanjiWeight must be > radicalWeight or the "stronger vs weaker"
    // contract from the spec is violated; enforced in the constructor.
    explicit WordGraph(NaryTree<std::string>* kanjiTree,
                        int kanjiWeight = 10,
                        int radicalWeight = 3)
        : tree_(kanjiTree), kanjiWeight_(kanjiWeight), radicalWeight_(radicalWeight) {
        if (tree_ == nullptr) {
            // Programmer error: a graph with no kanji tree can never resolve
            // radical relationships. This is not a "recoverable, expected"
            // condition like a failed lookup — it's a construction
            // precondition violation, so (unlike insertChild) it throws.
            throw std::invalid_argument("WordGraph: kanjiTree must not be null");
        }
        if (kanjiWeight_ <= radicalWeight_) {
            throw std::invalid_argument(
                "WordGraph: kanjiWeight must be greater than radicalWeight");
        }
    }

    // Registers a word and its kanji decomposition. Each string in
    // kanjiList is one kanji character (as a UTF-8 std::string — Japanese
    // characters are multi-byte, so we keep them as whole strings rather
    // than 'char', the same way you'd keep a wchar_t/UTF-8 codepoint
    // buffer in C rather than indexing byte-by-byte).
    //
    // Calling addWord() twice for the same word overwrites its kanji list
    // and marks the graph dirty (edges will be rebuilt on the next
    // buildEdges() call).
    void addWord(const std::string& word, const std::vector<std::string>& kanjiList) {
        if (word.empty()) {
            throw std::invalid_argument("WordGraph::addWord: word must not be empty");
        }
        wordToKanji_[word] = kanjiList;
        edgesBuilt_ = false;
    }

    // Runs the full index-then-join pipeline. Safe to call multiple times
    // (e.g. after adding more words) — it clears and rebuilds from scratch,
    // same as Module A's approach of not trying to incrementally patch
    // stale derived state.
    void buildEdges() {
        kanjiToWords_.clear();
        radicalToWords_.clear();
        adjacency_.clear();
        sharedKanjiPairs_.clear();

        buildKanjiIndex();
        buildRadicalIndex();

        addEdgesFromIndex(kanjiToWords_, kanjiWeight_, /*isKanjiPass=*/true);
        addEdgesFromIndex(radicalToWords_, radicalWeight_, /*isKanjiPass=*/false);

        edgesBuilt_ = true;
    }

    // Returns the adjacency list for a word, or nullptr if the word was
    // never added or has no edges. Mirrors insertChild()'s "nullptr means
    // legitimately absent, not an error" convention.
    const std::vector<Edge>* getEdges(const std::string& word) const {
        auto it = adjacency_.find(word);
        if (it == adjacency_.end()) {
            return nullptr;
        }
        return &it->second;
    }

    bool hasWord(const std::string& word) const {
        return wordToKanji_.find(word) != wordToKanji_.end();
    }

    size_t wordCount() const { return wordToKanji_.size(); }

    bool edgesBuilt() const { return edgesBuilt_; }

    // Debug/inspection helper — prints the graph in a stable, sorted order
    // so test output (and diffs) are deterministic.
    void printGraph(std::ostream& os) const {
        std::vector<std::string> words;
        words.reserve(adjacency_.size());
        for (const auto& kv : adjacency_) {
            words.push_back(kv.first);
        }
        std::sort(words.begin(), words.end());

        for (const auto& w : words) {
            os << w << ":\n";
            std::vector<Edge> edges = adjacency_.at(w);
            std::sort(edges.begin(), edges.end(),
                      [](const Edge& a, const Edge& b) { return a.neighbor < b.neighbor; });
            for (const auto& e : edges) {
                os << "  -> " << e.neighbor << " (weight " << e.weight << ")\n";
            }
        }
    }

private:
    NaryTree<std::string>* tree_;
    int kanjiWeight_;
    int radicalWeight_;
    bool edgesBuilt_ = false;

    std::unordered_map<std::string, std::vector<std::string>> wordToKanji_;
    std::unordered_map<std::string, std::unordered_set<std::string>> kanjiToWords_;
    std::unordered_map<std::string, std::unordered_set<std::string>> radicalToWords_;
    std::unordered_map<std::string, std::vector<Edge>> adjacency_;

    struct PairHash {
        size_t operator()(const std::pair<std::string, std::string>& p) const {
            std::hash<std::string> h;
            // Combine like boost::hash_combine; fine for a test-scale graph.
            size_t seed = h(p.first);
            seed ^= h(p.second) + 0x9e3779b9U + (seed << 6) + (seed >> 2);
            return seed;
        }
    };
    std::unordered_set<std::pair<std::string, std::string>, PairHash> sharedKanjiPairs_;

    static std::pair<std::string, std::string> normalize(const std::string& a,
                                                           const std::string& b) {
        return (a < b) ? std::make_pair(a, b) : std::make_pair(b, a);
    }

    void buildKanjiIndex() {
        for (const auto& entry : wordToKanji_) {
            const std::string& word = entry.first;
            for (const std::string& kanji : entry.second) {
                kanjiToWords_[kanji].insert(word);
            }
        }
    }

    void buildRadicalIndex() {
        for (const auto& entry : wordToKanji_) {
            const std::string& word = entry.first;
            for (const std::string& kanji : entry.second) {
                // ADAPT: replace this call if Module A's search() has a
                // different name/signature.
                auto* node = tree_->search(kanji);
                if (node == nullptr) {
                    // Kanji not present in the tree yet — legitimately
                    // absent (e.g. tree still being populated by a
                    // teammate), so just skip radical linkage for it.
                    continue;
                }
                // ADAPT: replace `node->children` if children are exposed
                // via a method (e.g. node->getChildren()) rather than a
                // public field.
                for (auto* child : node->children) {
                    if (child == nullptr) continue;
                    radicalToWords_[child->data].insert(word);
                }
            }
        }
    }

    // isKanjiPass=true builds the strong edges AND records which pairs got
    // a kanji-level edge, so the (weaker) radical pass can skip re-scoring
    // a pair that's already linked directly through that same kanji.
    void addEdgesFromIndex(const std::unordered_map<std::string, std::unordered_set<std::string>>& index,
                            int weight,
                            bool isKanjiPass) {
        for (const auto& entry : index) {
            const auto& words = entry.second;
            if (words.size() < 2) continue; // no pair possible

            std::vector<std::string> group(words.begin(), words.end());
            for (size_t i = 0; i < group.size(); ++i) {
                for (size_t j = i + 1; j < group.size(); ++j) {
                    const std::string& a = group[i];
                    const std::string& b = group[j];
                    auto key = normalize(a, b);

                    if (isKanjiPass) {
                        sharedKanjiPairs_.insert(key);
                    } else {
                        // Radical pass: don't add a second, weaker edge for
                        // a pair that already shares this exact kanji —
                        // they've already been credited at full strength.
                        if (sharedKanjiPairs_.count(key) > 0) {
                            continue;
                        }
                    }
                    addOrAccumulateEdge(a, b, weight);
                }
            }
        }
    }

    void addOrAccumulateEdge(const std::string& a, const std::string& b, int weight) {
        addOrAccumulateDirected(a, b, weight);
        addOrAccumulateDirected(b, a, weight);
    }

    void addOrAccumulateDirected(const std::string& from, const std::string& to, int weight) {
        auto& edges = adjacency_[from];
        for (auto& e : edges) {
            if (e.neighbor == to) {
                e.weight += weight;
                return;
            }
        }
        edges.push_back(Edge{to, weight});
    }
};

#endif // WORD_GRAPH_H

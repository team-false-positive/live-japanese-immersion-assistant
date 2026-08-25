#include <emscripten/bind.h>
#include "../hashtable.hpp"
#include <fstream>
#include <sstream>
#include <string>

struct DictionaryEntry {
    std::string reading;
    std::string meaning;
    std::string jlptLevel;
};

ds::HashTable<DictionaryEntry> dictionary;

// Loads the dictionary once when the WASM module starts up.
void loadDictionaryFromFile(const std::string& filepath) {
    std::ifstream file(filepath);
    std::string line;
    while (std::getline(file, line)) {
        if (line.empty()) continue;
        std::stringstream ss(line);
        std::string word, reading, meaning, level;
        std::getline(ss, word, '\t');
        std::getline(ss, reading, '\t');
        std::getline(ss, meaning, '\t');
        std::getline(ss, level, '\t');
        if (word.empty()) continue;
        dictionary.insert(word, DictionaryEntry{reading, meaning, level});
    }
}

// This is what JavaScript will actually call when a word is clicked.
std::string lookupWord(std::string word) {
    if (!dictionary.contains(word)) {
        return "NOT_FOUND";
    }
    DictionaryEntry entry = dictionary.get(word);
    // Pack the three fields into one string, separated by a marker,
    // since embind functions here return a single string most simply.
    return entry.reading + "|||" + entry.meaning + "|||" + entry.jlptLevel;
}

EMSCRIPTEN_BINDINGS(dictionary_module) {
    emscripten::function("loadDictionaryFromFile", &loadDictionaryFromFile);
    emscripten::function("lookupWord", &lookupWord);
}

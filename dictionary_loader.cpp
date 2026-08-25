#include "core/hashtable.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>

struct DictionaryEntry {
    std::string reading;
    std::string meaning;
    std::string jlptLevel;
};

int loadDictionary(const std::string& filepath, ds::HashTable<DictionaryEntry>& table) {
    std::ifstream file(filepath);
    if (!file.is_open()) {
        std::cerr << "Could not open dictionary file: " << filepath << "\n";
        return 0;
    }

    std::string line;
    int loadedCount = 0;

    while (std::getline(file, line)) {
        if (line.empty()) continue;

        std::stringstream ss(line);
        std::string word, reading, meaning, level;

        std::getline(ss, word, '\t');
        std::getline(ss, reading, '\t');
        std::getline(ss, meaning, '\t');
        std::getline(ss, level, '\t');

        if (word.empty()) continue;

        DictionaryEntry entry{reading, meaning, level};
        table.insert(word, entry);
        loadedCount++;
    }

    return loadedCount;
}

int main() {
    ds::HashTable<DictionaryEntry> dictionary;

    int count = loadDictionary("data/dictionary_full.tsv", dictionary);
    std::cout << "Loaded " << count << " dictionary entries.\n\n";

    std::string testWords[] = {"元気", "学校", "食べる", "図書館", "存在しない単語"};

    for (const auto& word : testWords) {
        if (dictionary.contains(word)) {
            DictionaryEntry entry = dictionary.get(word);
            std::cout << word << " (" << entry.reading << ") - "
                      << entry.meaning << " [" << entry.jlptLevel << "]\n";
        } else {
            std::cout << word << " - not found in dictionary\n";
        }
    }

    return 0;
}

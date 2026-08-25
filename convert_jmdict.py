"""
convert_jmdict.py

One-time data prep script. Downloads/reads the real, common-words-only
JMdict-simplified dataset and converts it into the same simple
word / reading / meaning / level TSV format our C++ dictionary_loader.cpp
already reads.

This is NOT part of the C++ "no STL, hand-built" data structure code --
it's a one-time offline data preparation step, same category as a build
script. The C++ ingestion code (dictionary_loader.cpp) does not change
at all -- it just gets pointed at the bigger, real output file this
script produces.

Usage:
    python3 convert_jmdict.py jmdict-eng-common-3.6.1.json dictionary_full.tsv
"""

import json
import sys


def pick_word_and_reading(entry):
    """Pick the primary written form and reading for one dictionary entry."""
    # Prefer a common kanji form if one exists, otherwise fall back to kana-only.
    kanji_list = entry.get("kanji", [])
    kana_list = entry.get("kana", [])

    word = None
    for k in kanji_list:
        if k.get("common"):
            word = k["text"]
            break
    if word is None and kanji_list:
        word = kanji_list[0]["text"]
    if word is None and kana_list:
        word = kana_list[0]["text"]

    reading = None
    for k in kana_list:
        if k.get("common"):
            reading = k["text"]
            break
    if reading is None and kana_list:
        reading = kana_list[0]["text"]
    if reading is None:
        reading = word  # kana-only word: reading is the word itself

    return word, reading


def pick_meaning(entry):
    """Join the first sense's English glosses into one short meaning string."""
    senses = entry.get("sense", [])
    if not senses:
        return ""
    glosses = [g["text"] for g in senses[0].get("gloss", []) if g.get("lang") == "eng"]
    return ", ".join(glosses)


def clean(field):
    """TSV can't contain literal tabs or newlines inside a field -- strip them."""
    return field.replace("\t", " ").replace("\n", " ").strip()


def main():
    if len(sys.argv) != 3:
        print("Usage: python3 convert_jmdict.py <input.json> <output.tsv>")
        sys.exit(1)

    input_path, output_path = sys.argv[1], sys.argv[2]

    with open(input_path, encoding="utf-8") as f:
        data = json.load(f)

    written = 0
    skipped = 0

    with open(output_path, "w", encoding="utf-8") as out:
        for entry in data["words"]:
            word, reading = pick_word_and_reading(entry)
            meaning = pick_meaning(entry)

            if not word or not meaning:
                skipped += 1
                continue

            # NOTE: JMdict itself does not include JLPT level data -- that's
            # a separate dataset. Leaving this column blank for now; a JLPT
            # word list can be merged in later (matched by word) to fill it.
            level = ""

            out.write(f"{clean(word)}\t{clean(reading)}\t{clean(meaning)}\t{level}\n")
            written += 1

    print(f"Wrote {written} entries to {output_path} ({skipped} skipped as incomplete)")


if __name__ == "__main__":
    main()

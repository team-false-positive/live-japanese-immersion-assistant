# Whisper.cpp WASM setup (Week 6 Module A)

Status: working in the browser. Tested with the tiny multilingual model
on a 17.9 s Japanese clip, which produced Japanese text with timestamps.

## Requirements

- Emscripten 3.1.58 (newer versions produce a loader that does not
  expose `Module.init`, so the example page fails)
- CMake 4.x, or CMake below 4.2 for shared-library support (not needed here)
- Chrome (the example page needs WASM SIMD)

## 1. Install Emscripten 3.1.58

    cd ~/emsdk
    ./emsdk install 3.1.58
    ./emsdk activate 3.1.58
    source ./emsdk_env.sh
    emcc -v        # must show 3.1.58

## 2. Get whisper.cpp and download the model

    cd ~/projects
    git clone https://github.com/ggml-org/whisper.cpp
    cd whisper.cpp
    sh ./models/download-ggml-model.sh tiny

Use the multilingual `tiny` model. Names ending in `.en` are English-only
and cannot transcribe Japanese.

## 3. Build the Whisper example

    mkdir build-em && cd build-em
    emcmake cmake .. -DWHISPER_WASM_SINGLE_FILE=OFF
    make -j libmain

Wait for `[100%] Built target libmain`. Do not press keys during the link step.

## 4. Prepare the test folder

    mkdir -p ~/whisper-test
    cp bin/whisper.wasm/* ~/whisper-test/
    cp bin/libmain.js ~/whisper-test/main.js
    cp bin/libmain.wasm ~/whisper-test/
    cp ~/projects/whisper.cpp/models/ggml-tiny.bin ~/whisper-test/
    cp ~/projects/whisper.cpp/examples/coi-serviceworker.js ~/whisper-test/

Note: the example page loads `main.js`, but the build produces `libmain.js`,
so the copy is renamed.

## 5. Serve and test

    cd ~/whisper-test
    python3 -m http.server 8000

Open `http://localhost:8000/index.html` in Chrome, then:

1. Press Ctrl+Shift+R to reload without cache.
2. Under "Whisper models", load `ggml-tiny.bin`.
3. Set Language to Japanese.
4. Under "Audio file", load a 16 kHz (or any) Japanese clip.
5. Click Transcribe. Results appear in the

// Runs inside the sandboxed page, where WebAssembly + embind may use eval.
// It has no chrome.* APIs, so it talks to the offscreen page via messages.

let win = null;
let pipe = null;

// PLACEHOLDER until Week 6 Module A (Whisper) is merged.
// When Whisper lands, replace only the body of this function.
async function transcribe(audio) {
  return `[placeholder: ${(audio.length / 16000).toFixed(1)}s of audio]`;
}

window.addEventListener("message", async (event) => {
  const msg = event.data;

  if (msg.type === "INIT") {
    const M = await createAudioWindowModule();
    win = new M.AudioWindow(msg.windowSamples);
    pipe = new StreamingPipeline({
      audioWindow: win,
      transcribe,
      onText: (text) => parent.postMessage({ type: "TEXT", text }, "*"),
      sampleRate: 16000,
      hopSec: msg.hopSec,
    });
    parent.postMessage({ type: "READY" }, "*");
  }

  if (msg.type === "CHUNK") {
    pipe?.pushAudio(msg.chunk);
  }
});

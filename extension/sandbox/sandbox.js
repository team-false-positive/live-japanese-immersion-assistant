// Runs inside the sandboxed page, where WebAssembly + embind may use eval.
// Loads the real Whisper engine, then transcribes each rolling window.

// Whisper prints each segment as: [00:00:00.000 --> 00:00:12.000]  text
const SEGMENT = /^\[\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\]\s*(.*)$/;

let lineSink = null;         // collects transcript lines during one full_default call
let whisperInstance = null;  // index returned by Module.init()
let markEngineReady;
const engineReady = new Promise((resolve) => (markEngineReady = resolve));

// Must exist before libmain.js runs; the engine reads it at load time.
window.Module = {
  print: (line) => {
    if (!lineSink) return;
    const m = SEGMENT.exec(line);
    if (m && m[1].trim()) lineSink.push(m[1].trim());
  },
  printErr: (line) => console.warn("[whisper]", line),
  onRuntimeInitialized: () => markEngineReady(),
};

// Loads libmain.js with the wasm bytes handed over by the offscreen page.
function loadEngineScript(wasmBytes) {
  window.Module.wasmBinary = wasmBytes;
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "../whisper/libmain.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("could not load libmain.js"));
    document.head.appendChild(s);
  });
}

// Called by the streaming pipeline with a Float32Array of 16 kHz mono samples.
async function transcribe(audio) {
  // Copy the samples into this page's own memory. If the window is a view into
  // another module's memory, the engine could be reading bad data.
  const samples = new Float32Array(audio);

  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > peak) peak = v;
  }
  console.log(
    "[sandbox] transcribe: samples =", samples.length,
    "| seconds =", (samples.length / 16000).toFixed(2),
    "| peak =", peak.toFixed(3),
    "| finite =", samples.every((v) => Number.isFinite(v))
  );

  lineSink = [];
  try {
    window.Module.full_default(whisperInstance, samples, "ja", 4, false);
  } catch (e) {
    console.error(
      "[sandbox] full_default threw:",
      e && e.name, "|", e && e.message, "\n", e && e.stack
    );
    lineSink = null;
    throw e;
  }

  const text = lineSink.join(" ");
  lineSink = null;
  return text;
}

let win = null;
let pipe = null;

window.addEventListener("message", async (event) => {
  const msg = event.data;

  if (msg.type === "INIT") {
    try {
      console.log(
        "[sandbox] SharedArrayBuffer:", typeof SharedArrayBuffer,
        "| crossOriginIsolated:", self.crossOriginIsolated
      );

      await loadEngineScript(msg.wasm);
      await engineReady;

      window.Module.FS_createDataFile("/", "whisper.bin", new Uint8Array(msg.model), true, true);
      whisperInstance = window.Module.init("whisper.bin");
      console.log("[sandbox] whisper instance:", whisperInstance);

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
    } catch (e) {
      parent.postMessage({ type: "ERROR", error: String(e) }, "*");
    }
  }

  if (msg.type === "CHUNK") {
    pipe?.pushAudio(msg.chunk);
  }
});

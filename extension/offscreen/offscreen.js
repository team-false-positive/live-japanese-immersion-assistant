const SAMPLE_RATE = 16000;
const CHUNK_SIZE = 1600;   // 0.1 s at 16 kHz
const WINDOW_SEC = 10;     // rolling window length
const HOP_SEC = 3;         // run the transcriber every 3 s of new audio
const THREADS = 4;

let stream = null, ctx = null, node = null, chunkCount = 0;
let win = null, pipe = null, engine = null, enginePromise = null;

// Fixed-size rolling window of audio samples, in plain JavaScript.
// Provides the methods the streaming pipeline uses: push, size, snapshot.
class RollingWindow {
  constructor(capacity) {
    this.cap = capacity;
    this.buf = new Float32Array(capacity);
    this.head = 0;   // next write position
    this.count = 0;  // samples currently stored
    this.total = 0;  // samples ever pushed
  }
  push(chunk) {
    for (let i = 0; i < chunk.length; i++) {
      this.buf[this.head] = chunk[i];
      this.head = (this.head + 1) % this.cap;
    }
    this.count = Math.min(this.count + chunk.length, this.cap);
    this.total += chunk.length;
  }
  size() { return this.count; }
  capacity() { return this.cap; }
  totalPushed() { return this.total; }
  snapshot() {
    const out = new Float32Array(this.count);
    const start = (this.head - this.count + this.cap) % this.cap;
    for (let i = 0; i < this.count; i++) {
      out[i] = this.buf[(start + i) % this.cap];
    }
    return out;
  }
}

// Loads the tiny model into the engine's file system, once per session.
function loadEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      await window.engineReady;
      const bytes = new Uint8Array(
        await (await fetch(chrome.runtime.getURL("whisper/ggml-tiny.bin"))).arrayBuffer()
      );
      Module.FS_createDataFile("/", "whisper.bin", bytes, true, true);
      if (!Module.ccall("capi_init", "number", ["string"], ["whisper.bin"])) {
        throw new Error("whisper model failed to load");
      }
      console.log("[capture] whisper ready");

      return {
        transcribe: (audio) => {
          const ptr = Module._malloc(audio.length * 4);
          Module.HEAPF32.set(audio, ptr >> 2);
          const text = Module.ccall(
            "capi_transcribe", "string", ["number", "number", "number"],
            [ptr, audio.length, THREADS]
          );
          Module._free(ptr);
          return text;
        },
      };
    })().catch((e) => {
      enginePromise = null; // allow a retry on the next Start
      throw e;
    });
  }
  return enginePromise;
}

async function ensurePipeline() {
  if (pipe) return;
  win = new RollingWindow(WINDOW_SEC * SAMPLE_RATE);
  engine = await loadEngine();
  pipe = new StreamingPipeline({
    audioWindow: win,
    transcribe: (audio) => engine.transcribe(audio),
    onText: (text) => {
      console.log("[capture] text:", text);
      // Send to the background, which forwards it to the captured tab.
      chrome.runtime.sendMessage({ type: "WHISPER_TEXT", text });
    },
    sampleRate: SAMPLE_RATE,
    hopSec: HOP_SEC,
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== "offscreen") return;
  if (msg.type === "START_CAPTURE") start(msg.streamId).catch((e) => console.error("[capture] start failed:", e));
  if (msg.type === "STOP_CAPTURE") stop();
});

async function start(streamId) {
  if (stream) return;

  await ensurePipeline();

  stream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
    video: false,
  });

  ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  await ctx.audioWorklet.addModule("pcm-worklet.js");

  const src = ctx.createMediaStreamSource(stream);
  node = new AudioWorkletNode(ctx, "pcm-chunker", {
    numberOfOutputs: 0,
    channelCount: 1,
    channelCountMode: "explicit",
    processorOptions: { chunkSize: CHUNK_SIZE },
  });
  node.port.onmessage = (e) => onChunk(e.data);

  src.connect(node);
  src.connect(ctx.destination); // without this the tab goes silent
  console.log("[capture] started, rate =", ctx.sampleRate);
}

function stop() {
  stream?.getTracks().forEach((t) => t.stop());
  ctx?.close();
  stream = ctx = node = null;
  chunkCount = 0;
  console.log("[capture] stopped");
}

function onChunk(chunk) {
  chunkCount++;
  if (chunkCount % 10 === 0) { // once per second
    let sum = 0;
    for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
    console.log(`[capture] len=${chunk.length} rms=${Math.sqrt(sum / chunk.length).toFixed(4)}`);
  }
  pipe?.pushAudio(chunk);
}

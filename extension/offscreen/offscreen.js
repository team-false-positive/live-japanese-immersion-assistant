const SAMPLE_RATE = 16000;
const CHUNK_SIZE = 1600;   // 0.1 s at 16 kHz
const WINDOW_SEC = 10;     // rolling window length
const HOP_SEC = 3;         // run the transcriber every 3 s of new audio

let stream = null, ctx = null, node = null, chunkCount = 0;
let sandboxFrame = null, sandboxReady = null;

// Creates the hidden sandboxed page once, and resolves when it reports READY.
function ensureSandbox() {
  if (sandboxReady) return sandboxReady;

  sandboxReady = new Promise((resolve) => {
    sandboxFrame = document.createElement("iframe");
    sandboxFrame.src = "../sandbox/sandbox.html";
    sandboxFrame.style.display = "none";
    document.body.appendChild(sandboxFrame);

    sandboxFrame.addEventListener("load", () => {
      sandboxFrame.contentWindow.postMessage(
        { type: "INIT", windowSamples: WINDOW_SEC * SAMPLE_RATE, hopSec: HOP_SEC },
        "*"
      );
    });

    window.addEventListener("message", function onReady(event) {
      if (event.data && event.data.type === "READY") {
        window.removeEventListener("message", onReady);
        resolve();
      }
    });
  });

  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "TEXT") {
      console.log("[capture] text:", event.data.text);
    }
  });

  return sandboxReady;
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== "offscreen") return;
  if (msg.type === "START_CAPTURE") start(msg.streamId).catch((e) => console.error("[capture] start failed:", e));
  if (msg.type === "STOP_CAPTURE") stop();
});

async function start(streamId) {
  if (stream) return;

  await ensureSandbox();

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
  sandboxFrame?.remove();
  sandboxFrame = sandboxReady = null;
  console.log("[capture] stopped");
}

function onChunk(chunk) {
  chunkCount++;
  if (chunkCount % 10 === 0) { // once per second
    let sum = 0;
    for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
    console.log(`[capture] len=${chunk.length} rms=${Math.sqrt(sum / chunk.length).toFixed(4)}`);
  }
  if (sandboxFrame) {
    sandboxFrame.contentWindow.postMessage({ type: "CHUNK", chunk }, "*", [chunk.buffer]);
  }
}

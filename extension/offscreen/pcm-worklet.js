// Runs on the audio thread. Groups audio into fixed-size chunks.
class PcmChunker extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.size = options.processorOptions.chunkSize;
    this.buf = new Float32Array(this.size);
    this.filled = 0;
  }
  process(inputs) {
    const ch = inputs[0][0];
    if (!ch) return true;
    let i = 0;
    while (i < ch.length) {
      const n = Math.min(this.size - this.filled, ch.length - i);
      this.buf.set(ch.subarray(i, i + n), this.filled);
      this.filled += n;
      i += n;
      if (this.filled === this.size) {
        const out = this.buf;
        this.port.postMessage(out, [out.buffer]);
        this.buf = new Float32Array(this.size);
        this.filled = 0;
      }
    }
    return true;
  }
}
registerProcessor("pcm-chunker", PcmChunker);

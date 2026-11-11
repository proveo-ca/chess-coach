// SPEC: _spec/runtime-protocol.puml
import type {} from "bun";

export async function* jsonLines(stream: ReadableStream<Uint8Array>, maxFrameBytes: number, maxStreamBytes: number,
  clockNs: () => bigint, singleFlight = false): AsyncGenerator<{ json: string; receivedNs: bigint }> {
  if (!Number.isSafeInteger(maxFrameBytes) || maxFrameBytes < 1 || !Number.isSafeInteger(maxStreamBytes) || maxStreamBytes < maxFrameBytes) throw new Error("JSONL: LIMITS");
  const reader = stream.getReader(), decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0, size = 0;
  let buffer = new Uint8Array(Math.min(65536, maxFrameBytes));
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) { if (size) throw new Error("JSONL: PARTIAL_EOF"); return; }
      total += value.byteLength;
      if (total > maxStreamBytes) throw new Error("JSONL: STREAM_BOUND");
      let start = 0;
      while (start < value.byteLength) {
        const end = value.indexOf(10, start), limit = end === -1 ? value.byteLength : end;
        const segment = value.subarray(start, limit);
        const required = size + segment.byteLength;
        if (required > maxFrameBytes) throw new Error("JSONL: FRAME_BOUND");
        if (required > buffer.byteLength) {
          const grown = new Uint8Array(Math.min(maxFrameBytes, Math.max(required, buffer.byteLength * 2)));
          grown.set(buffer.subarray(0, size)); buffer = grown;
        }
        buffer.set(segment, size); size = required;
        if (end === -1) break;
        const receivedNs = clockNs();
        if (!size) throw new Error("JSONL: EMPTY_FRAME");
        if (singleFlight && end + 1 !== value.byteLength) throw new Error("JSONL: UNSOLICITED_TRAILING_BYTES");
        const json = decoder.decode(buffer.subarray(0, size)); size = 0;
        yield { json, receivedNs };
        start = end + 1;
      }
    }
  } finally {
    try { await reader.cancel(); } finally { reader.releaseLock(); }
  }
}

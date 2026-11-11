// SPEC: _spec/runtime-protocol.puml
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";
import { ProcessTransport } from "../src/process-transport";
import { jsonLines } from "../src/framing";

const entrypoint = fileURLToPath(new URL("./fixtures/io-child.ts", import.meta.url));
const open = (mode: string, stderrBytes = 4096) => new ProcessTransport({ executable: process.execPath, entrypoint, arguments: [mode], cwd: process.cwd() },
  { frameBytes: 4096, stdoutBytes: 8192, stderrBytes }, process.hrtime.bigint);

test("owned synthetic process transport requires natural close, both EOFs and actual child exit", async () => {
  const port = open("echo");
  const first = await port.exchange('{"operation":"synthetic"}');
  expect(first.json).toBe('{"operation":"synthetic"}');
  await port.exchange('{"operation":"close"}');
  expect(await port.finish()).toEqual({ stdinClosed: true, stdoutEof: true, stderrEof: true, reaped: true, exitCode: 0, forced: false });
  expect(new TextDecoder().decode(port.stderr())).toContain("synthetic-fixture");
});

for (const mode of ["partial", "stderr", "unsolicited"]) {
  test(`owned synthetic process rejects ${mode} output without treating it as a native proof`, async () => {
    const port = open(mode, 1024);
    try { await expect(port.exchange('{"operation":"synthetic"}')).rejects.toThrow(); }
    finally { await port.terminate(new Error("synthetic cleanup")); }
  });
}

test("a valid reply cannot turn a nonzero process exit into successful lifecycle evidence", async () => {
  const port = open("nonzero");
  try {
    await port.exchange('{"operation":"close"}');
    expect((await port.finish()).exitCode).toBe(7);
  } finally { await port.terminate(new Error("synthetic cleanup")); }
});

test("bounded JSONL handles split UTF-8 and rejects incomplete and oversized frames", async () => {
  const collect = async (chunks: Uint8Array[], limit = 64) => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } });
    const values = [];
    for await (const value of jsonLines(stream, limit, 128, () => 1n)) values.push(value.json);
    return values;
  };
  const bytes = new TextEncoder().encode('{"text":"é"}\n');
  expect(await collect([bytes.subarray(0, 10), bytes.subarray(10)])).toEqual(['{"text":"é"}']);
  await expect(collect([new TextEncoder().encode("{")])).rejects.toThrow("PARTIAL_EOF");
  await expect(collect([new TextEncoder().encode("12345\n")], 4)).rejects.toThrow("FRAME_BOUND");
  await expect(collect([new Uint8Array([255, 10])])).rejects.toThrow();
});

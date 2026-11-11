// SPEC: _spec/match-runtime.puml
import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { MatchProcess } from "../src/match-process";

const entrypoint = fileURLToPath(new URL("./fixtures/io-child.ts", import.meta.url));
function setup(mode: string) {
  const clock = process.hrtime.bigint;
  return new MatchProcess({ executable: process.execPath, entrypoint, arguments: [mode], cwd: process.cwd() }, clock, clock() + 5_000_000_000n);
}
test("supported detached group transport requires natural EOF/reap and no surviving process group", async () => {
  const port = setup("echo");
  try {
    expect((await port.exchange('{"operation":"synthetic"}')).json).toBe('{"operation":"synthetic"}');
    await port.exchange('{"operation":"close"}');
    expect(await port.finish()).toEqual({ stdinClosed: true, stdoutEof: true, stderrEof: true, reaped: true, exitCode: 0, forced: false });
  } finally { await port.terminate(new Error("synthetic fixture cleanup")); }
});
test("supported cutoff records actual owned kill/reap and group absence without a learned classification", async () => {
  const port = setup("echo");
  await port.exchange('{"operation":"synthetic"}');
  const receipt = await port.cutoff(new Error("synthetic cutoff"));
  expect(receipt.groupGone).toBe(true);
  expect(receipt.fault).toBe(false);
  expect(receipt.exit).toMatchObject({ forced: true, stdinClosed: true, stdoutEof: true, stderrEof: true, reaped: true });
});
test("a prior transport integrity failure remains visible after owned cutoff", async () => {
  const port = setup("partial");
  await expect(port.exchange('{"operation":"synthetic"}')).rejects.toThrow();
  const receipt = await port.cutoff(new Error("synthetic cleanup"));
  expect(receipt.fault).toBe(true);
  expect(receipt.groupGone).toBe(true);
});

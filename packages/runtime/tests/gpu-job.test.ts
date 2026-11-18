// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeGpuAttemptProposal, decodeGpuJobReply, gpuJobSha256 } from "../../contracts/src/gpu-job";
import { gpuJobMain, runGpuJobLoop } from "../src/gpu-job";
import { syntheticCorpus } from "./match-fixture";
import { registerGpuOwnerFixture } from "./fixtures/gpu-owner/register";
import type { GpuOwnerFixture } from "./fixtures/gpu-owner/register";
import { gpuOwnerTestRoot, inputStream } from "./fixtures/gpu-owner/support";

function setup() {
  const fixture = registerGpuOwnerFixture(gpuOwnerTestRoot("gpu-loop")), writes: string[] = [];
  let loads = 0;
  const options = { sessionId: fixture.sessionId, layout: fixture.layout, input: inputStream(fixture.startJson + "\n"),
    write: async (json: string) => { writes.push(json); }, clockNs: () => 0n,
    loadCorpus: async () => { loads++; return syntheticCorpus(0); }, loadStrategic: async () => { loads++; return null; } };
  return { fixture, writes, options, loads: () => loads };
}
function inert(f: ReturnType<typeof setup>) {
  expect(f.loads()).toBe(0);
  expect(existsSync(f.fixture.layout.stateRoot)).toBe(false);
  expect(existsSync(f.fixture.layout.factory.scratchRoot)).toBe(false);
  expect(f.writes.map(json => decodeGpuJobReply(json).kind)).toEqual(["boot"]);
}
function changedInput(fixture: GpuOwnerFixture, mutate: (input: Record<string, unknown>) => void): string {
  const input = JSON.parse(fixture.inputJson) as Record<string, unknown>; mutate(input);
  const inputJson = JSON.stringify(input);
  return JSON.stringify({ ...JSON.parse(fixture.startJson), inputJson, inputSha256: gpuJobSha256(inputJson) });
}

describe("GPU job EOF admission", () => {
  test("boot and a complete queued frame remain inert until actual EOF", async () => {
    const f = setup(); let controller!: ReadableStreamDefaultController<Uint8Array>;
    f.options.input = new ReadableStream({ start(value) { controller = value; } });
    const running = runGpuJobLoop(f.options);
    controller.enqueue(Buffer.from(f.fixture.startJson + "\n"));
    await Bun.sleep(5); inert(f);
    controller.close(); await running;
    expect(f.writes.map(json => decodeGpuJobReply(json).kind)).toEqual(["boot", "startup", "attempt-proposal"]);
    const reply = decodeGpuJobReply(f.writes[2]!);
    if (reply.kind !== "attempt-proposal") throw new Error("proposal required");
    expect(decodeGpuAttemptProposal(reply.proposalJson, reply.proposalSha256, reply.descriptorSha256).state.counters.updates).toBe(0);
  });
  test("delayed duplicates and trailing bytes fail before any embedded or model effect", async () => {
    for (const trailing of ["\n", "x", "{}\n"]) {
      const f = setup(); let controller!: ReadableStreamDefaultController<Uint8Array>;
      f.options.input = new ReadableStream({ start(value) { controller = value; } });
      const result = runGpuJobLoop(f.options).then(() => null, error => error);
      controller.enqueue(Buffer.from(f.fixture.startJson + "\n")); await Bun.sleep(2); inert(f);
      controller.enqueue(Buffer.from(trailing)); controller.close();
      expect(await result).toBeInstanceOf(Error); inert(f);
    }
  });
  test("requires one complete LF frame with valid UTF-8 and bounded bytes", async () => {
    for (const bytes of [new Uint8Array(), Buffer.from("{}"), Buffer.from("{}\n{}\n"), Buffer.from([0xc3, 10]),
      Buffer.from("x".repeat(1048577) + "\n"), Buffer.from("\ufeff{}\n")]) {
      const f = setup(); f.options.input = inputStream(bytes);
      await expect(runGpuJobLoop(f.options)).rejects.toThrow(); inert(f);
    }
  });
  test("missing EOF exhausts the boot budget without embedded parsing", async () => {
    const f = setup(); let now = 0n;
    f.options.clockNs = () => now;
    f.options.write = async json => { f.writes.push(json); now = 9_999_000_000n; };
    f.options.input = new ReadableStream({ start(controller) { controller.enqueue(Buffer.from(f.fixture.startJson + "\n")); } });
    await expect(runGpuJobLoop(f.options)).rejects.toThrow("DEADLINE"); inert(f);
  });
  test("rejects hash, model, schema and session corruption before loaders or storage", async () => {
    const changes: ((f: GpuOwnerFixture) => string)[] = [
      f => JSON.stringify({ ...JSON.parse(f.startJson), inputSha256: "0".repeat(64) }),
      f => JSON.stringify({ ...JSON.parse(f.startJson), sessionId: "wrong" }),
      f => JSON.stringify({ ...JSON.parse(f.startJson), inputJson: "{}", inputSha256: gpuJobSha256("{}") }),
      f => changedInput(f, value => { value.initialModelId = "0".repeat(64); }),
      f => changedInput(f, value => { Object.assign(value.modelConfig as object, { recordSha256: "0".repeat(64) }); }),
      f => JSON.stringify({ ...JSON.parse(f.startJson), ownerElapsedNs: "01" }),
      f => JSON.stringify({ ...JSON.parse(f.startJson), operation: "close" }),
      f => JSON.stringify({ ...JSON.parse(f.startJson), layout: f.layout }),
    ];
    for (const change of changes) {
      const f = setup(); f.options.input = inputStream(change(f.fixture) + "\n");
      await expect(runGpuJobLoop(f.options)).rejects.toThrow(); inert(f);
    }
  });
  test("record length/hash and NOFOLLOW reject before corpus or state effects", async () => {
    for (const mode of ["hash", "length", "symlink"] as const) {
      const f = setup(), path = resolve(f.fixture.layout.factory.cwd, "bad-record");
      if (mode === "symlink") symlinkSync(f.fixture.layout.initialRecordPath, path);
      else {
        const bytes = readFileSync(f.fixture.layout.initialRecordPath);
        writeFileSync(path, mode === "hash" ? Buffer.alloc(bytes.length, 0) : Buffer.alloc(bytes.length + 1));
      }
      f.options.layout = { ...f.options.layout, initialRecordPath: path };
      await expect(runGpuJobLoop(f.options)).rejects.toThrow(); inert(f);
    }
  });
  test("initial state and independently derived descriptor reject before factory construction", async () => {
    for (const field of ["initialStateSha256", "expectedDescriptorSha256"]) {
      const f = setup(); f.options.input = inputStream(changedInput(f.fixture, input => { input[field] = "0".repeat(64); }) + "\n");
      await expect(runGpuJobLoop(f.options)).rejects.toThrow(field === "initialStateSha256" ? "INITIAL_STATE" : "DESCRIPTOR");
      expect(f.loads()).toBe(2); expect(existsSync(f.fixture.layout.factory.scratchRoot)).toBe(false);
      expect(f.writes).toHaveLength(1);
    }
  });
  test("keeps owner elapsed plus boot delay and rejects a backwards local clock", async () => {
    const f = setup(); let now = 123n;
    f.options.clockNs = () => now; f.options.write = async json => { f.writes.push(json); now += 8_000_000_000n; };
    f.options.input = inputStream(JSON.stringify({ ...JSON.parse(f.fixture.startJson), ownerElapsedNs: "3000000000" }) + "\n");
    await expect(runGpuJobLoop(f.options)).rejects.toThrow("DEADLINE"); inert(f);
    const b = setup(); let calls = 0; b.options.clockNs = () => calls++ === 0 ? 5n : 4n;
    await expect(runGpuJobLoop(b.options)).rejects.toThrow("CLOCK"); expect(b.writes).toHaveLength(0);
  });
  test("bounds loaders and boot emission before state creation", async () => {
    const f = setup();
    f.options.input = inputStream(JSON.stringify({ ...JSON.parse(f.fixture.startJson), ownerElapsedNs: "9999000000" }) + "\n");
    f.options.loadCorpus = () => new Promise(() => {});
    await expect(runGpuJobLoop(f.options)).rejects.toThrow("DEADLINE");
    expect(existsSync(f.fixture.layout.stateRoot)).toBe(false);
    const b = setup(); let now = 0n; b.options.clockNs = () => now;
    b.options.write = async json => { b.writes.push(json); now = 10_000_000_000n; };
    await expect(runGpuJobLoop(b.options)).rejects.toThrow("DEADLINE"); inert(b);
  });
  test("ordinary exported main and direct source dispatch stay disabled", async () => {
    await expect(gpuJobMain()).rejects.toThrow("SOURCE_ONLY_DISABLED");
    const child = Bun.spawn(["/usr/local/bin/bun", "--no-env-file", "--no-install", resolve(import.meta.dir, "../src/gpu-job.ts"), "fake-session"],
      { stdin: "ignore", stdout: "pipe", stderr: "pipe", env: { PATH: "/usr/local/bin:/usr/bin:/bin", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0" } });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(stdout).toBe(""); expect(stderr).toContain("SOURCE_ONLY_DISABLED"); expect(code).toBe(1);
  });
});

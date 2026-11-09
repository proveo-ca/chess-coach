// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
import { readFileSync } from "node:fs";
import { parseClosedJson } from "../../../../contracts/src/gpu-job";
import { runGpuJobLoop } from "../../../src/gpu-job";
import { syntheticCorpus } from "../../match-fixture";
import type { GpuOwnerFixture } from "./register";

if (import.meta.main) {
  try {
    const registered = parseClosedJson(readFileSync(`${import.meta.path}.layout.json`, "utf8")) as GpuOwnerFixture;
    const [sessionId] = Bun.argv.slice(2);
    if (Bun.argv.length !== 3 || sessionId !== registered.sessionId) throw new Error("GPU fixture driver: SESSION");
    await runGpuJobLoop({ sessionId, layout: registered.layout, input: Bun.stdin.stream(),
      write: async json => { await Bun.write(Bun.stdout, json + "\n"); }, loadCorpus: async () => syntheticCorpus(0), loadStrategic: async () => null });
  } catch (error) { await Bun.write(Bun.stderr, String(error) + "\n"); process.exitCode = 1; }
}

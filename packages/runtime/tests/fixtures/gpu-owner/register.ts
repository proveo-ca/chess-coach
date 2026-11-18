// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
import { chmodSync, lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gpuJobSha256, GPU_JOB_VERSION } from "../../../../contracts/src/gpu-job";
import { initialTrainingState, nextAttempt } from "../../../src/curriculum";
import type { GpuJobLayout } from "../../../src/gpu-job";
import { bindings, syntheticRecord } from "../../training-fixture";

export function registerGpuOwnerFixture(existingExclusivePrivateRoot: string, bunExecutable = "/usr/local/bin/bun") {
  const root = existingExclusivePrivateRoot, stat = lstatSync(root);
  if (!isAbsolute(root) || realpathSync(root) !== root || !stat.isDirectory() || (stat.mode & 0o077) !== 0 || readdirSync(root).length !== 0 ||
    !isAbsolute(bunExecutable) || /[\s\0]/.test(bunExecutable)) throw new Error("GPU fixture: EXCLUSIVE_PRIVATE_ROOT_OR_BUN");
  const here = dirname(fileURLToPath(import.meta.url)), driverPath = join(root, "driver.ts"), layoutPath = `${driverPath}.layout.json`;
  const sessionId = "gpu-owner-fixture", attemptId = "gpu-attempt-0", model = syntheticRecord("gpu-owner-synthetic-initial-not-a-burn-record");
  const initialState = initialTrainingState(101, model.config.recordSha256, bindings()), { descriptor } = nextAttempt(initialState, attemptId);
  const initialModelId = model.config.recordSha256, expectedDescriptorSha256 = gpuJobSha256(JSON.stringify(descriptor));
  const layout: GpuJobLayout = { initialRecordPath: join(root, "initial-model.bpk"), stateRoot: join(root, "state"), factory: {
    scratchRoot: join(root, "scratch-model"), cwd: root, bunExecutable, learnerExecutable: join(root, "learner.ts"), matchEntrypoint: join(root, "match.ts") } };
  const inputJson = JSON.stringify({ version: "chess-coach.gpu-attempt-input.v1", bindings: initialState.bindings, modelConfig: model.config,
    recordRef: { byteLength: model.record.byteLength, sha256: initialModelId }, initialStateSha256: gpuJobSha256(JSON.stringify(initialState)), expectedDescriptorSha256, initialModelId });
  const inputSha256 = gpuJobSha256(inputJson);
  const startJson = JSON.stringify({ version: GPU_JOB_VERSION, sessionId, operation: "run-attempt", attemptId, inputJson, inputSha256, ownerElapsedNs: "0" });
  for (const name of ["driver.ts", "match.ts", "learner.ts"]) {
    const original = readFileSync(join(here, name), "utf8");
    const rewritten = original.replace(/(from\s+")([.][.\w/-]*)(")/g, (_, before: string, path: string, after: string) => `${before}${resolve(here, path)}${after}`);
    const path = join(root, name);
    writeFileSync(path, (name === "learner.ts" ? `#!${bunExecutable}\n` : "") + rewritten, { flag: "wx", mode: 0o600 });
    if (name === "learner.ts") chmodSync(path, 0o700);
  }
  writeFileSync(layout.initialRecordPath, model.record, { flag: "wx", mode: 0o400 });
  const registration = { driverPath, layoutPath, sessionId, attemptId, inputJson, inputSha256, initialModelId, expectedDescriptorSha256,
    layout, initialState, descriptor, startJson };
  writeFileSync(layoutPath, JSON.stringify(registration) + "\n", { flag: "wx", mode: 0o600 });
  return registration;
}
export type GpuOwnerFixture = ReturnType<typeof registerGpuOwnerFixture>;
if (import.meta.main) {
  const [root, bunExecutable] = Bun.argv.slice(2);
  if (!root || Bun.argv.length > 4) throw new Error("GPU fixture: ARGUMENTS");
  console.log(JSON.stringify(registerGpuOwnerFixture(root, bunExecutable)));
}

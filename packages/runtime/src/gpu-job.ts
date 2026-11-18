// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
import type {} from "bun";
import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { isAbsolute } from "node:path";
import { decodeGpuAttemptInput, decodeGpuAttemptProposal, decodeGpuJobReply, decodeGpuJobStart, GPU_JOB_VERSION, gpuJobSha256,
  MAX_GPU_JOB_FRAME_BYTES, MAX_GPU_JOB_OUTPUT_BYTES } from "../../contracts/src/gpu-job";
import type { ByteRef } from "../../contracts/src/training-state";
import { loadCapturedCorpus } from "./corpus";
import type { RecordedCorpus } from "./corpus";
import { FIXED_ATTEMPT_LAYOUT, FixedAttemptFactory } from "./fixed-attempt";
import type { FixedAttemptLayout } from "./fixed-attempt";
import { loadCapturedStrategicApi } from "./strategic";
import type { StrategicApi } from "./strategic";
import { TrainingCoordinator } from "./training-coordinator";
import type { MatchClock } from "./match-session";

export type GpuJobLayout = Readonly<{ initialRecordPath: string; stateRoot: string; factory: FixedAttemptLayout }>;
export const GPU_JOB_LAYOUT: GpuJobLayout = Object.freeze({ initialRecordPath: "/app/inputs/master-101/model.bpk", stateRoot: "/state/run", factory: FIXED_ATTEMPT_LAYOUT });
export type GpuJobOptions = { sessionId: string; input: ReadableStream<Uint8Array>; write: (json: string) => Promise<void>;
  layout?: GpuJobLayout; clockNs?: () => bigint; loadCorpus?: () => Promise<RecordedCorpus>; loadStrategic?: () => Promise<StrategicApi | null> };

function readRecord(path: string, ref: ByteRef): Uint8Array {
  if (!isAbsolute(path) || path.includes("\0")) throw new Error("GPU job: RECORD_PATH");
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile() || before.size !== BigInt(ref.byteLength)) throw new Error("GPU job: RECORD_LENGTH");
    const bytes = Buffer.alloc(ref.byteLength + 1);
    let size = 0;
    while (size < bytes.byteLength) {
      const count = readSync(fd, bytes, size, bytes.byteLength - size, null);
      if (count === 0) break;
      size += count;
    }
    const after = fstatSync(fd, { bigint: true });
    if (size !== ref.byteLength || after.size !== before.size || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs ||
      gpuJobSha256(bytes.subarray(0, size)) !== ref.sha256) throw new Error("GPU job: RECORD_BINDING");
    return bytes.subarray(0, size);
  } finally { closeSync(fd); }
}

export async function runGpuJobLoop(options: GpuJobOptions): Promise<void> {
  const sourceClock = options.clockNs ?? process.hrtime.bigint;
  let previous = sourceClock();
  if (previous < 0n) throw new Error("GPU job: CLOCK");
  const localBoot = previous;
  const localNow = () => {
    const now = sourceClock();
    if (now < previous || now < 0n) throw new Error("GPU job: CLOCK");
    previous = now;
    return now;
  };
  if (!/^[A-Za-z0-9._:-]{1,64}$/.test(options.sessionId)) throw new Error("GPU job: SESSION");
  let clock = () => localNow() - localBoot;
  const check = (deadline: bigint) => { if (clock() >= deadline) throw new Error("GPU job: DEADLINE"); };
  const bounded = async <T>(action: () => Promise<T>, deadline: bigint): Promise<T> => {
    check(deadline);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("GPU job: DEADLINE")), Number((deadline - clock() + 999999n) / 1000000n)); });
      const result = await Promise.race([Promise.resolve().then(action), expired]);
      check(deadline);
      return result;
    } finally { if (timer !== undefined) clearTimeout(timer); }
  };
  let outputBytes = 0;
  const emit = async (value: unknown, deadline: bigint) => {
    check(deadline);
    const json = JSON.stringify(value), bytes = Buffer.byteLength(json);
    if (bytes > MAX_GPU_JOB_FRAME_BYTES || outputBytes + bytes + 1 > MAX_GPU_JOB_OUTPUT_BYTES) throw new Error("GPU job: OUTPUT_BOUND");
    decodeGpuJobReply(json);
    outputBytes += bytes + 1;
    await bounded(() => options.write(json), deadline);
  };
  await emit({ version: GPU_JOB_VERSION, sessionId: options.sessionId, kind: "boot" }, 10_000_000_000n);
  const reader = options.input.getReader(), bytes = Buffer.alloc(MAX_GPU_JOB_FRAME_BYTES + 1);
  let size = 0, ended = false, eof = false;
  try {
    for (;;) {
      const { value, done } = await bounded(() => reader.read(), 10_000_000_000n);
      if (done) { eof = true; break; }
      if (value.byteLength === 0) continue;
      if (ended) throw new Error("GPU job: TRAILING_INPUT");
      if (value.byteLength > bytes.byteLength - size) throw new Error("GPU job: INPUT_BOUND");
      const newline = value.indexOf(10);
      if (newline !== -1) {
        if (newline !== value.byteLength - 1) throw new Error("GPU job: TRAILING_INPUT");
        ended = true;
      }
      bytes.set(value, size); size += value.byteLength;
    }
  } finally {
    if (!eof) void reader.cancel().catch(() => {});
    try { reader.releaseLock(); } catch {}
  }
  if (!ended) throw new Error("GPU job: MISSING_LF");
  const frame = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, size - 1));
  const start = decodeGpuJobStart(frame);
  if (start.sessionId !== options.sessionId) throw new Error("GPU job: SESSION");
  const ownerElapsed = BigInt(start.ownerElapsedNs);
  clock = () => ownerElapsed + (localNow() - localBoot);
  check(10_000_000_000n);
  const input = decodeGpuAttemptInput(start.inputJson, start.inputSha256);
  const selectedLayout = options.layout ?? GPU_JOB_LAYOUT;
  const layout: GpuJobLayout = Object.freeze({ ...selectedLayout, factory: Object.freeze({ ...selectedLayout.factory }) });
  const record = readRecord(layout.initialRecordPath, input.recordRef);
  check(10_000_000_000n);
  const [corpus, strategic] = await bounded(() => Promise.all([(options.loadCorpus ?? loadCapturedCorpus)(),
    (options.loadStrategic ?? loadCapturedStrategicApi)()]), 10_000_000_000n);
  check(10_000_000_000n);
  const coordinator = new TrainingCoordinator(layout.stateRoot, input.bindings);
  let proposal: unknown;
  try {
    const initial = coordinator.initializeMaster(101, { config: input.modelConfig, record });
    if (gpuJobSha256(JSON.stringify(initial)) !== input.initialStateSha256 || initial.modelId !== input.initialModelId) throw new Error("GPU job: INITIAL_STATE");
    check(10_000_000_000n);
    const timing: MatchClock = { clockNs: clock, originNs: 0n, startupDeadlineNs: 10_000_000_000n,
      workDeadlineNs: 297_000_000_000n, cleanupDeadlineNs: 300_000_000_000n };
    let descriptorJson: string | null = null;
    const state = await coordinator.runAttempt(101, start.attemptId, timing, async context => {
      check(timing.startupDeadlineNs);
      descriptorJson = JSON.stringify(context.descriptor);
      if (context.descriptor.master !== 101 || context.descriptor.startedOrdinal !== 0 || context.descriptor.modelId !== input.initialModelId ||
        context.model.config.recordSha256 !== input.initialModelId || gpuJobSha256(descriptorJson) !== input.expectedDescriptorSha256) throw new Error("GPU job: DESCRIPTOR");
      const factory = new FixedAttemptFactory(corpus, strategic, layout.factory);
      const dependencies = await factory.create(context);
      return { ...dependencies, onStarted: () => emit({ version: GPU_JOB_VERSION, sessionId: options.sessionId, kind: "startup", attemptId: start.attemptId,
        inputSha256: start.inputSha256, descriptorSha256: input.expectedDescriptorSha256, initialModelId: input.initialModelId }, timing.startupDeadlineNs) };
    });
    check(timing.workDeadlineNs);
    if (descriptorJson === null) throw new Error("GPU job: MISSING_DESCRIPTOR");
    const proposalJson = `{"version":"chess-coach.gpu-attempt-proposal.v1","descriptor":${descriptorJson},"initialModelId":${JSON.stringify(input.initialModelId)},"state":${JSON.stringify(state)}}`;
    const proposalSha256 = gpuJobSha256(proposalJson);
    decodeGpuAttemptProposal(proposalJson, proposalSha256, input.expectedDescriptorSha256);
    proposal = { version: GPU_JOB_VERSION, sessionId: options.sessionId, kind: "attempt-proposal", attemptId: start.attemptId,
      inputSha256: start.inputSha256, descriptorSha256: input.expectedDescriptorSha256, proposalJson, proposalSha256 };
  } finally { coordinator.close(); }
  await emit(proposal, 297_000_000_000n);
  check(300_000_000_000n);
}

export async function gpuJobMain(): Promise<never> { throw new Error("GPU job: SOURCE_ONLY_DISABLED"); }
if (import.meta.main) {
  try { await gpuJobMain(); }
  catch (error) { await Bun.write(Bun.stderr, String(error) + "\n"); process.exitCode = 1; }
}

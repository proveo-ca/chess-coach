// SPEC: _spec/runtime-protocol.puml
import type {} from "bun";
import { MAX_NATIVE_MESSAGE_BYTES } from "../../contracts/src/native-protocol";
import type { GameDriver } from "./worker";
import { NativeWorker } from "./worker";
import { jsonLines } from "./framing";

export async function runWorker<S>(worker: NativeWorker<S>): Promise<void> {
  for await (const frame of jsonLines(Bun.stdin.stream(), MAX_NATIVE_MESSAGE_BYTES, MAX_NATIVE_MESSAGE_BYTES * 2048, process.hrtime.bigint)) {
    const reply = worker.handle(frame.json);
    await Bun.write(Bun.stdout, reply + "\n");
    if (JSON.parse(reply).kind === "closed") return;
  }
  throw new Error("Native worker: MISSING_CLOSE");
}
export async function workerMain<S>(role: "main" | "reference", driver: GameDriver<S>, mode: "native-proof" | "policy"): Promise<void> {
  const sessionId = process.argv[2];
  if (process.argv.length !== 3 || !sessionId || !/^[A-Za-z0-9._:-]{1,64}$/.test(sessionId)) throw new Error("Native worker: LAUNCH_ARGUMENTS");
  await runWorker(new NativeWorker(role, mode, sessionId, driver));
}

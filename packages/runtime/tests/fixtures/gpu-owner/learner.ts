// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gpuJobSha256, parseClosedJson } from "../../../../contracts/src/gpu-job";
import { learningRequestShape, modelConfigShape } from "../../../../contracts/src/learning-channel";
import { jsonLines } from "../../../src/framing";

if (import.meta.main) {
  try {
    const [configPath, recordPath, sessionId] = Bun.argv.slice(2);
    if (Bun.argv.length !== 5 || !configPath || !recordPath || !sessionId || !/:[ab]$/.test(sessionId)) throw new Error("GPU fixture learner: ARGUMENTS");
    const config = modelConfigShape.parse(parseClosedJson(readFileSync(configPath, "utf8"))), record = readFileSync(recordPath);
    if (gpuJobSha256(record) !== config.recordSha256) throw new Error("GPU fixture learner: RECORD");
    const events: string[] = [], suffix = sessionId.slice(-1), root = dirname(import.meta.path);
    writeFileSync(join(root, `learner-${suffix}.started.json`), JSON.stringify({ pid: process.pid, sessionId, configPath, recordPath }) + "\n", { flag: "wx", mode: 0o600 });
    for await (const frame of jsonLines(Bun.stdin.stream(), 1048576, 3 * 1048577, process.hrtime.bigint, true)) {
      const request = learningRequestShape.parse(parseClosedJson(frame.json)), expected = ["begin", "finish", "close"][events.length];
      if (request.sessionId !== sessionId || request.modelId !== config.recordSha256 || request.ordinal !== events.length || request.command.kind !== expected) throw new Error("GPU fixture learner: SEQUENCE");
      events.push(request.command.kind);
      writeFileSync(join(root, `learner-${suffix}.events.json`), JSON.stringify(events) + "\n", { mode: 0o600 });
      const kind = expected === "begin" ? "begun" : expected === "finish" ? "diagnostic" : "closed";
      await Bun.write(Bun.stdout, JSON.stringify({ version: request.version, sessionId, ordinal: request.ordinal, modelId: request.modelId, result: { kind } }) + "\n");
    }
    if (events.join(",") !== "begin,finish,close") throw new Error("GPU fixture learner: MISSING_CLOSE");
    writeFileSync(join(root, `learner-${suffix}.receipt.json`), JSON.stringify({ pid: process.pid, stdinEof: true, sessionId, configPath, recordPath, events }) + "\n", { flag: "wx", mode: 0o600 });
  } catch (error) { await Bun.write(Bun.stderr, String(error) + "\n"); process.exitCode = 1; }
}

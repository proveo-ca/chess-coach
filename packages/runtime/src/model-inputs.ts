// SPEC: _spec/match-runtime.puml, _spec/checkpoint-runtime.puml
import { mkdirSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { NativeRecord } from "./training-store";
import { STORAGE_BOUNDS } from "./storage-bounds";

export class ModelInputs {
  readonly config: string;
  readonly record: string;
  private readonly directory: string;
  private released = false;
  constructor(root: string, attemptId: string, model: NativeRecord) {
    const config = JSON.stringify(model.config);
    if (!isAbsolute(root) || !/^[A-Za-z0-9._:-]{1,32}$/.test(attemptId) || Buffer.byteLength(config) > STORAGE_BOUNDS.configBytes ||
      model.record.byteLength > STORAGE_BOUNDS.nativeRecordBytes) throw new Error("Model inputs: CONTEXT_OR_BOUND");
    this.directory = join(root, `attempt-${attemptId}`);
    mkdirSync(this.directory, { mode: 0o700 });
    this.config = join(this.directory, "config.json");
    this.record = join(this.directory, "model.bpk");
    writeFileSync(this.config, config, { mode: 0o400, flag: "wx" });
    writeFileSync(this.record, model.record, { mode: 0o400, flag: "wx" });
  }
  readonly release = (): void => {
    if (this.released || readdirSync(this.directory).sort().join("\n") !== "config.json\nmodel.bpk") throw new Error("Model inputs: RELEASE_CONTENTS");
    this.released = true;
    unlinkSync(this.config);
    unlinkSync(this.record);
    rmdirSync(this.directory);
  };
}

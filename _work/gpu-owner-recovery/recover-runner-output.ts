// SPEC: _spec/recovery.md
import { mkdir, readFile, readdir, rmdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const work = resolve(root, "_work/gpu-owner-recovery");
const external = resolve(root, "../_work/gpu-owner-recovery");
const source = resolve(external, "runs/runner-parse-correction");
const receipt = JSON.parse(await readFile(resolve(source, "receipt.json"), "utf8"));
if (receipt.runId !== "runner-parse-correction" || receipt.stage !== "runner" || receipt.status !== "FAIL" || receipt.sourceCount !== 0) throw Error("OWN_RUN_IDENTITY_REQUIRED");
await mkdir(resolve(work, "runs"), { recursive: true, mode: 0o700 });
const destination = resolve(work, "runs/runner-parse-correction");
const names = (await readdir(source)).sort();
if (JSON.stringify(names) !== JSON.stringify(["command.stderr", "command.stdout", "receipt.json", "sources.json"])) throw Error("OWN_RUN_FILES_REQUIRED");
await mkdir(destination, { mode: 0o700 });
for (const name of names) {
  const bytes = await readFile(resolve(source, name));
  await writeFile(resolve(destination, name), bytes, { flag: "wx", mode: 0o600 });
  if (!bytes.equals(await readFile(resolve(destination, name)))) throw Error("OUTPUT_COPY_MISMATCH");
}
for (const name of names) await unlink(resolve(source, name));
await rmdir(source);
const removedEmptyDirectories: string[] = [];
for (const directory of ["scratch/home", "scratch/tmp", "scratch", "runs", "."]) {
  const path = resolve(external, directory);
  if ((await readdir(path)).length === 0) { await rmdir(path); removedEmptyDirectories.push(directory); }
}
await writeFile(resolve(work, "runner-output-recovery.json"), JSON.stringify({ status: "OWN_FAILED_RUN_MOVED_INTO_REPOSITORY", destination: "_work/gpu-owner-recovery/runs/runner-parse-correction", removedEmptyDirectories, originalFailedReceiptPreserved: true, trainingReady: false }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ status: "OWN_FAILED_RUN_MOVED_INTO_REPOSITORY", originalFailedReceiptPreserved: true }));

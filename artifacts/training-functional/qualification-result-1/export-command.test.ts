// SPEC: _spec/runtime-protocol.puml
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { repositoryScratch } from "../../../packages/runtime/tests/repository-scratch";

const command = readFileSync(new URL("./export-command.sh", import.meta.url), "utf8");
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const names = ["training-qualification-1/evidence/operator-report.json", "training-qualification-1/evidence/canonical.json",
  "training-qualification-1/evidence/r4.json", "training-qualification-1/evidence/functional-evidence.json",
  "training-qualification-delivery-1/preparation-receipt.json", "training-qualification-inputs-1/qualification-inputs/input-manifest.json"];
function fixture(options: { large?: boolean; badJson?: boolean; symlink?: boolean; wrongPin?: boolean; bom?: boolean; invalidUtf8?: boolean } = {}) {
  const root = repositoryScratch("qualification-json-export-"), host = join(root, "host checkout"), runs = join(host, "_work/gpu-owner-recovery/runs");
  const bun = join(host, "_work/gpu-owner-recovery/cache/host-gpu-native-build-1/bun");
  mkdirSync(dirname(bun), { recursive: true }); symlinkSync(process.execPath, bun);
  const contents = names.map((_, i) => Buffer.from(JSON.stringify({ fixture: i, digestLabel: `fixture-${i}` }) + "\n"));
  if (options.large) contents[0] = Buffer.alloc(1048577, 32);
  if (options.badJson) contents[0] = Buffer.from("not-json\n");
  if (options.bom) contents[0] = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), contents[0]!]);
  if (options.invalidUtf8) contents[0] = Buffer.concat([Buffer.from('{"bad":"'), Buffer.from([0xff]), Buffer.from('"}\n')]);
  names.forEach((name, i) => {
    const path = join(runs, name); mkdirSync(dirname(path), { recursive: true });
    if (options.symlink && i === 0) { const target = join(root, "outside.json"); writeFileSync(target, contents[i]!); symlinkSync(target, path); }
    else writeFileSync(path, contents[i]!, { flag: "wx", mode: 0o600 });
  });
  const output = join(runs, "training-qualification-json-export-1.json");
  const rendered = command.replace('H="/home/gu1lty/Projects/proveo/chess-coach"', `H=${JSON.stringify(host)}`)
    .replace('4,1921,\\"20f2b4620ef665698a8b7bfffc9fb10ac784491541bc531aa682e7f666a47fd7\\"', `4,${contents[4]!.length},\\"${sha(contents[4]!)}\\"`)
    .replace('5,143938,\\"7bc8885b4ee97be1d4935aa4dcc994275ea41e2e368b144e29be1b598b53ae51\\"',
      `5,${contents[5]!.length},\\"${options.wrongPin ? "a".repeat(64) : sha(contents[5]!)}\\"`);
  const run = () => Bun.spawnSync(["bash", "-c", rendered], { cwd: root, env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: root, BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0" },
    stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 5000 });
  return { output, contents, runs, run };
}
test("literal export command parses and contains only bounded builtin file operations", () => {
  const r = Bun.spawnSync(["bash", "-n"], { stdin: Buffer.from(command), stdout: "pipe", stderr: "pipe", timeout: 5000 });
  expect(r.exitCode).toBe(0); expect(r.stderr.length).toBe(0);
  expect(command.match(/\nbash -c '([\s\S]*)'\s*$/)?.[1]).not.toContain("'");
  expect(command).toContain("20f2b4620ef665698a8b7bfffc9fb10ac784491541bc531aa682e7f666a47fd7");
  expect(command).toContain("7bc8885b4ee97be1d4935aa4dcc994275ea41e2e368b144e29be1b598b53ae51");
  expect(command).not.toMatch(/Bun\.spawn|spawnSync|execSync|fetch\(|curl |docker |nvidia-smi|prepare-worker/);
});
test("synthetic byte pins export six exact texts without changing inputs", () => {
  const f = fixture(), r = f.run(); expect(r.exitCode).toBe(0); expect(r.stderr.length).toBe(0);
  const report = JSON.parse(readFileSync(f.output, "utf8")) as { files: { path: string; byteLength: number; sha256: string; text: string }[]; qualified: boolean; trainingReady: boolean };
  expect(report.files.length).toBe(6); expect(report.qualified).toBe(false); expect(report.trainingReady).toBe(false);
  report.files.forEach((file, i) => { expect(Buffer.from(file.text)).toEqual(f.contents[i]!); expect(file.sha256).toBe(sha(f.contents[i]!));
    expect(file.byteLength).toBe(f.contents[i]!.length); expect(readFileSync(join(f.runs, names[i]!))).toEqual(f.contents[i]!); });
  expect(lstatSync(f.output).mode & 0o777).toBe(0o600);
});
test("an existing export is never overwritten", () => {
  const f = fixture(); writeFileSync(f.output, "PRESERVE_EXISTING_EXPORT", { flag: "wx" });
  expect(f.run().exitCode).not.toBe(0); expect(readFileSync(f.output, "utf8")).toBe("PRESERVE_EXISTING_EXPORT");
});
for (const [name, options] of Object.entries({ "oversized input": { large: true }, "malformed JSON": { badJson: true }, "BOM stripping": { bom: true }, "invalid UTF8": { invalidUtf8: true },
  "symlink input": { symlink: true }, "mismatched reported pin": { wrongPin: true } })) test(`rejects ${name} before writing an export`, () => {
  const f = fixture(options), r = f.run(); expect(r.exitCode).not.toBe(0); expect(existsSync(f.output)).toBe(false);
});

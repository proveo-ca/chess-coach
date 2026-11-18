// SPEC: _spec/gpu-build.puml
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const prefix = "_work/gpu-owner-recovery/";
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  const [label] = Bun.argv.slice(2);
  if (Bun.argv.length !== 3 || !/^gpu-runtime-lookup-local-[1-9][0-9]*$/.test(label ?? "") || process.cwd() + "/" !== repository) {
    throw Error("LOCAL_RUNTIME_LOOKUP_VERIFICATION_CONTEXT_REQUIRED");
  }
  const directory = `${prefix}runs/${label}`;
  await mkdir(directory);
  const paths = ["gpu-runtime-lookup.fish", "tests/gpu-runtime-lookup.test.ts", "tests/verify-runtime-lookup.ts", "tests/tsconfig.json",
    "runs/gpu-container-visibility-host-probe-1/operator-observation.json", "runs/gpu-container-visibility-host-probe-1/operator-paste.txt"].map(path => prefix + path);
  const sources = await Promise.all(paths.map(async path => ({ path, sha256: digest(await readFile(path)) })));
  const stages = [
    { name: "fish-syntax", argv: ["/home/agent/toolchains/linux-amd64/.local/share/mise/installs/github-fish-shell-fish-shell/4.9.3/fish",
      "--no-config", "--no-execute", prefix + "gpu-runtime-lookup.fish"], timeoutSeconds: 10 },
    { name: "static-tests", argv: [process.execPath, "--no-env-file", "--no-install", "test", "./" + prefix + "tests/gpu-runtime-lookup.test.ts"], timeoutSeconds: 30 },
    { name: "test-types", argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "-p", prefix + "tests/tsconfig.json"], timeoutSeconds: 30 },
  ];
  const results = [];
  for (const stage of stages) {
    const executedArgv = ["/usr/bin/timeout", "--kill-after=3s", `${stage.timeoutSeconds}s`, ...stage.argv];
    const result = Bun.spawnSync(executedArgv, { env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: process.env.HOME, NO_COLOR: "1" }, stdout: "pipe", stderr: "pipe" });
    const streams = [];
    for (const [stream, bytes] of [["stdout", result.stdout], ["stderr", result.stderr]] as const) {
      const path = `${directory}/${stage.name}.${stream}`;
      await writeFile(path, bytes, { flag: "wx" });
      streams.push({ path, bytes: bytes.length, sha256: digest(bytes) });
    }
    results.push({ ...stage, executedArgv, exitCode: result.exitCode, signalCode: result.signalCode, streams });
    if (result.exitCode !== 0) break;
  }
  const local3 = JSON.parse(await readFile(prefix + "runs/gpu-functional-local-3/sources.json", "utf8")) as { path: string; sha256: string }[];
  const mismatched = [];
  for (const source of local3) if (digest(await readFile(source.path)) !== source.sha256) mismatched.push(source.path);
  const sourceChanged = (await Promise.all(sources.map(async source => digest(await readFile(source.path)) !== source.sha256))).some(Boolean);
  const status = results.length === stages.length && results.every(result => result.exitCode === 0) && !sourceChanged && mismatched.length === 0 ? "PASS" : "FAIL";
  const receipt = { version: "chess-coach.gpu-runtime-lookup-local.v1", scope: "FISH_SYNTAX_STATIC_TESTS_AND_TEST_TYPES_ONLY", status,
    sources, sourceChanged, results, previousLocal3SourceHashesChecked: local3.length, previousLocal3Mismatches: mismatched,
    lookupPacketExecuted: false, dockerCommandsExecuted: false, cudaGpuCodeExecuted: false, trainingReady: false };
  await writeFile(`${directory}/receipt.json`, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ status, results: results.map(({ name, exitCode }) => ({ name, exitCode })), local3Mismatches: mismatched, receipt: `${directory}/receipt.json` }));
  process.exitCode = status === "PASS" ? 0 : 1;
}

if (import.meta.main) await main();

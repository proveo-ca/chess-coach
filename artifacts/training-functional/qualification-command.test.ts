// SPEC: _spec/qualification-bootstrap.puml
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { repositoryScratch } from "../../packages/runtime/tests/repository-scratch";

const template = readFileSync(new URL("./qualification-delivery-1/command-template.sh", import.meta.url), "utf8");
const commit = "a".repeat(40), payload = 'throw new Error("DOWNLOADED_CODE_MUST_NOT_BE_EVALUATED_IN_COMMAND_TESTS");\n';
const digest = createHash("sha256").update(payload).digest("hex");
const render = (value = digest) => template.replaceAll("@PUBLISHED_COMMIT@", commit).replaceAll("@BOOTSTRAP_SHA256@", value);
type Event = { kind: string; args: string[]; cwd: string };

function fixture(mode = "success") {
  const root = repositoryScratch("qualification-command-"), host = join(root, "host checkout"), bin = join(root, "bin"), trace = join(root, "trace.ndjson");
  const bun = join(host, "_work/gpu-owner-recovery/cache/host-gpu-native-build-1/bun");
  const launcher = join(host, "_work/gpu-owner-recovery/runs/training-qualification-launcher-1.ts");
  const put = (path: string, text: string) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text, { flag: "wx", mode: 0o700 }); };
  mkdirSync(dirname(launcher), { recursive: true });
  const log = 'import{appendFileSync}from"node:fs";const args=Bun.argv.slice(2);const emit=kind=>appendFileSync(process.env.COMMAND_TRACE,JSON.stringify({kind,args,cwd:process.cwd()})+"\\n");';
  put(join(bin, "curl"), `#!/usr/local/bin/bun\n${log}\nemit("curl");process.stdout.write(${JSON.stringify(payload)});if(process.env.COMMAND_MODE==="curl-fail")process.exit(22);\n`);
  put(bun, `#!/usr/local/bin/bun\n${log}
if(args[2]==="-e"){
  emit("hash");if(!args[3].includes("createHash")||!args[3].includes("bootstrap SHA256 mismatch"))throw new Error("UNEXPECTED_EVAL");
  const child=Bun.spawnSync([${JSON.stringify(process.execPath)},...args],{stdin:"ignore",stdout:"pipe",stderr:"pipe",timeout:3000});
  process.stdout.write(child.stdout);process.stderr.write(child.stderr);process.exit(child.exitCode);
}
if(args[3]==="prepare"){emit("prepare");process.exit(process.env.COMMAND_MODE==="prepare-fail"?67:0);}
if(args.at(-1)==="operator"){emit("operator");process.exit(0);}
throw new Error("UNEXPECTED_BUN_INVOCATION");
`);
  for (const name of ["bun", "git", "docker", "nvidia-smi", "policy-initialize", "policy-score", "policy-channel"]) put(join(bin, name), `#!/usr/local/bin/bun\n${log}\nemit("FORBIDDEN_${name}");process.exit(89);\n`);
  const command = (text = render()) => text.replace('H="/home/gu1lty/Projects/proveo/chess-coach"', `H=${JSON.stringify(host)}`);
  const run = (text = render()) => Bun.spawnSync(["bash", "-c", command(text)], { cwd: root, env: { PATH: `${bin}:/usr/local/bin:/usr/bin:/bin`, HOME: host, COMMAND_TRACE: trace, COMMAND_MODE: mode }, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 10000 });
  const events = (): Event[] => existsSync(trace) ? readFileSync(trace, "utf8").trimEnd().split("\n").filter(Boolean).map(line => JSON.parse(line)) : [];
  return { root, host, launcher, bun, run, events };
}

test("template parses as Bash and uses one Fish-compatible quoted command body", () => {
  const parsed = Bun.spawnSync(["bash", "-n"], { stdin: Buffer.from(template), stdout: "pipe", stderr: "pipe", timeout: 5000 });
  expect(parsed.exitCode).toBe(0); expect(parsed.stderr.length).toBe(0);
  const body = template.match(/\nbash -c '([\s\S]*)'\s*$/)?.[1];
  expect(body).toBeDefined(); expect(body).not.toContain("'"); expect(template).not.toContain("<<");
  expect(template).toContain("set -o noclobber"); expect(template).toContain("exec \"$B\"");
});
test("unrendered command fails before download or interpreter evaluation", () => {
  const env = fixture(), result = env.run(template);
  expect(result.exitCode).not.toBe(0); expect(env.events()).toEqual([]); expect(existsSync(env.launcher)).toBe(false);
});
test("rendered command hashes bytes before preparation and separately execs the operator", () => {
  const env = fixture(), result = env.run(), events = env.events();
  expect(result.exitCode).toBe(0); expect(events.map(event => event.kind)).toEqual(["curl", "hash", "prepare", "operator"]);
  expect(events.every(event => event.cwd === env.host)).toBe(true);
  expect(events[0]!.args).toContain("--disable"); expect(events[0]!.args).toContain("--retry");
  expect(events[0]!.args[events[0]!.args.indexOf("--retry") + 1]).toBe("0");
  expect(events[0]!.args[events[0]!.args.indexOf("--max-time") + 1]).toBe("60");
  expect(events[0]!.args.at(-1)).toBe(`https://raw.githubusercontent.com/proveo-ca/chess-coach/${commit}/artifacts/training-functional/qualification-bootstrap.ts`);
  expect(events[1]!.args.slice(-2)).toEqual([env.launcher, digest]);
  expect(events[2]!.args).toEqual(["--no-env-file", "--no-install", env.launcher, "prepare", commit]);
  expect(events[3]!.args).toEqual(["--no-env-file", "--no-install", `${env.host}/_work/gpu-owner-recovery/runs/training-qualification-inputs-1/app/artifacts/training-functional/qualification-operator.ts`, "operator"]);
  expect(readFileSync(env.launcher, "utf8")).toBe(payload);
});
test("hash mismatch retains the download and prevents preparation and operator execution", () => {
  const env = fixture(), result = env.run(render("b".repeat(64)));
  expect(result.exitCode).not.toBe(0); expect(env.events().map(event => event.kind)).toEqual(["curl", "hash"]);
  expect(new TextDecoder().decode(result.stderr)).toContain("bootstrap SHA256 mismatch"); expect(readFileSync(env.launcher, "utf8")).toBe(payload);
});
test("preparation failure prevents operator execution without deleting the launcher", () => {
  const env = fixture("prepare-fail"), result = env.run();
  expect(result.exitCode).toBe(67); expect(env.events().map(event => event.kind)).toEqual(["curl", "hash", "prepare"]); expect(existsSync(env.launcher)).toBe(true);
});
test("download failure prevents evaluation and retains its prefix without retry", () => {
  const env = fixture("curl-fail"), result = env.run();
  expect(result.exitCode).toBe(22); expect(env.events().map(event => event.kind)).toEqual(["curl"]); expect(readFileSync(env.launcher, "utf8")).toBe(payload);
});
test("existing launcher is not overwritten and no download starts", () => {
  const env = fixture(); writeFileSync(env.launcher, "KEEP_EXISTING_LAUNCHER", { flag: "wx" }); const result = env.run();
  expect(result.exitCode).not.toBe(0); expect(env.events()).toEqual([]); expect(readFileSync(env.launcher, "utf8")).toBe("KEEP_EXISTING_LAUNCHER");
});

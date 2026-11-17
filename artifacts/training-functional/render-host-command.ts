// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const sourcePath = "artifacts/training-functional/host-facts.ts";
const commandPath = "artifacts/training-functional/host-facts-1/operator-command-2.sh";
const source = readFileSync(new URL("./host-facts.ts", import.meta.url), "utf8");
if (Buffer.byteLength(source) > 32768 || source.includes("\0")) throw new Error("Operator command: SOURCE_BOUND");
const quote = (text: string) => "'" + text.replaceAll("'", "'\\''") + "'";
const command = "#!/usr/bin/env bash\n# SPEC: _spec/runtime-protocol.puml\nbun --no-env-file --no-install --eval " + quote(source) + " -- --run\n";
const output = new URL("./host-facts-1/operator-command-2.sh", import.meta.url);
writeFileSync(output, command, { flag: "wx", mode: 0o644 });
const syntax = Bun.spawnSync(["bash", "-n", fileURLToPath(output)], { cwd: root, env: { PATH: "/usr/local/bin:/usr/bin:/bin" }, stdout: "pipe", stderr: "pipe", timeout: 5000 });
if (syntax.exitCode !== 0) throw new Error("Operator command: BASH_SYNTAX");
const probe = `function bun() { ${quote(process.execPath)} --no-env-file --no-install --eval 'console.log(JSON.stringify(Bun.argv.slice(1)))' -- "$@"; }; source "$1"`;
const parsed = Bun.spawnSync(["bash", "-c", probe, "host-command-quoting-check", fileURLToPath(output)],
  { cwd: root, env: { PATH: "/usr/local/bin:/usr/bin:/bin" }, stdout: "pipe", stderr: "pipe", timeout: 5000 });
if (parsed.exitCode !== 0 || parsed.stderr.length || parsed.stdout.length > 65536) throw new Error("Operator command: ARGUMENT_PROBE");
const args: unknown = JSON.parse(new TextDecoder().decode(parsed.stdout));
if (JSON.stringify(args) !== JSON.stringify(["--no-env-file", "--no-install", "--eval", source, "--", "--run"])) throw new Error("Operator command: SOURCE_BYTES");
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const receipt = { status: "PASS_BASH_SYNTAX_AND_EXACT_ARGUMENT_BYTES_WITH_STUB_ONLY", shell: "bash", source: { path: sourcePath, bytes: Buffer.byteLength(source), sha256: hash(source) },
  command: { path: commandPath, bytes: Buffer.byteLength(command), sha256: hash(command) },
  syntaxExitCode: syntax.exitCode, stubExitCode: parsed.exitCode, hostFactsEvaluatedDuringProbe: false, hostQueriesExecuted: 0,
  operatorInstructions: "Run the published command once with Bash from the exact HOST root; return its JSON even if the exit code is nonzero", trainingReady: false };
writeFileSync(new URL("./host-facts-1/command-verification-2.json", import.meta.url), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
console.log("Executor: " + JSON.stringify(receipt));

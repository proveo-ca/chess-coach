// SPEC: _spec/runtime-protocol.puml
import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repositoryScratch } from "../../packages/runtime/tests/repository-scratch";

for (const name of ["score", "channel"] as const) {
  test(`local Bun parses the extensionless ${name} adapter and preserves argv without native execution`, () => {
    const source = readFileSync(new URL(`./qualification-policy-${name}.ts`, import.meta.url), "utf8"), guard = source.indexOf("if (import.meta.main)");
    expect(guard).toBeGreaterThan(0);
    const executable = join(repositoryScratch("qualification-adapter-parse-"), `policy-${name}`);
    const text = source.slice(0, guard) + '\nBun.spawn=()=>{throw new Error("FORBIDDEN_NATIVE_SPAWN")};\nconsole.log(JSON.stringify({args:Bun.argv.slice(2),scope:"LOCAL_SYNTAX_AND_ARGV_ONLY"}));\n';
    writeFileSync(executable, text, { flag: "wx", mode: 0o700 });
    const args = ["config with spaces.json", "literal-record.bpk", ...(name === "channel" ? ["qualifier:learner:a"] : [])];
    const child = Bun.spawnSync([executable, ...args], { cwd: repositoryScratch("qualification-adapter-cwd-"), env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent" }, stdout: "pipe", stderr: "pipe", timeout: 5000 });
    expect(child.exitCode).toBe(0); expect(child.stderr.length).toBe(0);
    expect(JSON.parse(new TextDecoder().decode(child.stdout))).toEqual({ args, scope: "LOCAL_SYNTAX_AND_ARGV_ONLY" });
  });
}

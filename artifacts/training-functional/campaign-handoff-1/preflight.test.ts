// SPEC: _spec/runtime-protocol.puml
import { expect, test } from "bun:test";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { inspect, metadataIO } from "./preflight";
import type { MetadataIO } from "./preflight";
import { projectHostPlan, renderHostCommand } from "./render-command";
import { repositoryScratch } from "../../../packages/runtime/tests/repository-scratch";
import type { CampaignPlan } from "../campaign-plan";

const packet = new URL("../full-training-packet-1/", import.meta.url), plan = JSON.parse(readFileSync(new URL("plan.json", packet), "utf8")).plan as CampaignPlan;
const request = readFileSync(new URL("request.json", packet)), requestSha256 = createHash("sha256").update(request).digest("hex");
const frozen = projectHostPlan(plan, requestSha256);
function fixture() {
  const reads: string[] = [], fresh = new Set(frozen.freshRoots); let time = 0;
  const io: MetadataIO = { now: () => time, alarm: () => () => {},
    statfs: async path => { reads.push(`statfs:${path}`); expect(path).toBe(frozen.runsParent); return { usableBytes: BigInt(frozen.minimumUsableBytes), freeEntries: BigInt(frozen.minimumFreeEntries) }; },
    lstat: async path => { reads.push(`lstat:${path}`); if (fresh.has(path)) throw Object.assign(new Error("ABSENT"), { code: "ENOENT" });
      const row = frozen.retained.find(r => r.path === path); if (!row) throw new Error("FORBIDDEN_PATH");
      return { kind: row.kind === "directory" ? "directory" : "file", mode: row.kind === "directory" ? 0o700 : 0o755 }; } };
  return { io, reads, setTime: (value: number) => { time = value; } };
}
test("pure projection retains exact packet thresholds and excludes new unstaged input paths", () => {
  expect(frozen.minimumUsableBytes).toBe("283467841536"); expect(frozen.minimumFreeEntries).toBe("835600");
  expect(frozen.freshRoots).toEqual([plan.delivery, plan.inputs, plan.root]); expect(frozen.retained[0]).toEqual({ path: frozen.runsParent, kind: "directory" });
  expect(frozen.retained.every(r => !r.path.startsWith(plan.inputs + "/"))).toBe(true);
  expect(frozen.retained.filter(r => r.kind === "executable")).toHaveLength(6);
});
test("exact-boundary metadata passes without readiness, preparation, quota, tool-usability or execution claims", async () => {
  const env = fixture(), report = await inspect(env.io, frozen);
  expect(report.status).toBe("PASS_METADATA_PRECONDITIONS"); expect(report.failures).toEqual([]);
  expect(report.freshRoots.every(r => r.observation === "ABSENT")).toBe(true);
  expect(report).toMatchObject({ reservationCreated: false, quotaVerified: false, toolUsabilityVerified: false, payloadContentsRead: false,
    readinessFlagsChanged: false, preparationExecuted: false, nativeGpuDockerCommandsExecuted: false, trainingExecuted: false, trainingExecutionAuthorized: false });
  expect(env.reads.length).toBe(1 + 3 + frozen.retained.length); expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThan(32768);
});
test("insufficient bytes and free entries remain explicit blockers", async () => {
  for (const key of ["usableBytes", "freeEntries"] as const) { const env = fixture();
    env.io.statfs = async () => ({ usableBytes: BigInt(frozen.minimumUsableBytes), freeEntries: BigInt(frozen.minimumFreeEntries), [key]: 1n });
    const report = await inspect(env.io, frozen); expect(report.status).toBe("BLOCKED_METADATA_PRECONDITIONS"); expect(report.failures).toContain(key === "usableBytes" ? "USABLE_BYTES_INSUFFICIENT" : "FREE_ENTRIES_INSUFFICIENT");
  }
});
test("unsupported or negative exposed filesystem counters never pass", async () => {
  for (const value of [null, -1n]) for (const key of ["usableBytes", "freeEntries"] as const) { const env = fixture();
    env.io.statfs = async () => ({ usableBytes: BigInt(frozen.minimumUsableBytes), freeEntries: BigInt(frozen.minimumFreeEntries), [key]: value });
    const report = await inspect(env.io, frozen); expect(report.status).toBe("BLOCKED_METADATA_PRECONDITIONS"); expect(report.capacity[key]).toBeNull();
  }
});
test("large counts serialize losslessly rather than rounding through Number", async () => {
  const env = fixture(), large = 9007199254740993n; env.io.statfs = async () => ({ usableBytes: large, freeEntries: large });
  const report = await inspect(env.io, frozen); expect(report.capacity.usableBytes).toBe(String(large)); expect(report.capacity.freeEntries).toBe(String(large));
});
test("missing, inaccessible or symlink runs parent cannot turn children into absent roots", async () => {
  for (const failure of ["ENOENT", "EACCES", "symlink"]) { const env = fixture(), original = env.io.lstat;
    env.io.lstat = async path => { if (path !== frozen.runsParent) return original(path); if (failure === "symlink") return { kind: "symlink", mode: 0o777 };
      throw Object.assign(new Error(failure), { code: failure }); };
    const report = await inspect(env.io, frozen); expect(report.status).toBe("BLOCKED_METADATA_PRECONDITIONS");
    expect(report.freshRoots.every(r => r.observation === "UNKNOWN")).toBe(true); expect(env.reads.some(r => r.startsWith("statfs:"))).toBe(false);
  }
});
test("only ENOENT means absent; occupied roots and permission errors stay blocked", async () => {
  for (const failure of ["EXISTS", "EACCES", "ENOTDIR"]) { const env = fixture(), original = env.io.lstat;
    env.io.lstat = async path => { if (path !== frozen.freshRoots[0]) return original(path); if (failure === "EXISTS") return { kind: "directory", mode: 0o700 };
      throw Object.assign(new Error(failure), { code: failure }); };
    const report = await inspect(env.io, frozen); expect(report.status).toBe("BLOCKED_METADATA_PRECONDITIONS"); expect(report.freshRoots[0]!.observation).toBe(failure === "EXISTS" ? "EXISTS" : "UNKNOWN");
  }
});
test("wrong retained kinds and missing execute mode never prove tool usability", async () => {
  for (const observed of [{ kind: "symlink" as const, mode: 0o777 }, { kind: "file" as const, mode: 0o644 }]) {
    const env = fixture(), original = env.io.lstat; env.io.lstat = path => path === frozen.cachedBun ? Promise.resolve(observed) : original(path);
    const report = await inspect(env.io, frozen); expect(report.status).toBe("BLOCKED_METADATA_PRECONDITIONS"); expect(report.toolUsabilityVerified).toBe(false);
  }
});
test("malformed plans fail before any metadata operation", async () => {
  for (const patch of [{ minimumUsableBytes: "1" }, { host: "/different" }, { freshRoots: [] }, { retained: [] }, { requestSha256: "x" }]) {
    const env = fixture(); await expect(inspect(env.io, { ...frozen, ...patch })).rejects.toThrow(); expect(env.reads).toHaveLength(0);
  }
});
test("clock failure prevents subsequent metadata calls rather than issuing renewals", async () => {
  const env = fixture(); env.setTime(NaN); await expect(inspect(env.io, frozen)).rejects.toThrow("CLOCK"); expect(env.reads).toHaveLength(0);
});
test("production source exposes metadata only and imports remain inert", () => {
  const source = readFileSync(new URL("./preflight.ts", import.meta.url), "utf8");
  expect(source).not.toMatch(/Bun\.spawn|spawnSync|fetch\(|readFile|openSync|mkdir|writeFile|readdir|unlink|docker|nvidia-smi/);
  expect(source.startsWith("// SPEC: _spec/runtime-protocol.puml\n")).toBe(true);
});
test("retained Bun metadata APIs work on repository-local fixtures without collecting HOST facts", async () => {
  const root = repositoryScratch("campaign-metadata-api-"), io = metadataIO(), node = await io.lstat(root), capacity = await io.statfs(root);
  expect(node.kind).toBe("directory"); expect(typeof capacity.usableBytes).toBe("bigint");
  expect(capacity.freeEntries === null || typeof capacity.freeEntries === "bigint").toBe(true);
});
test("the actual hashed TypeScript payload imports through a data URL before injected-only inspection", async () => {
  const source = readFileSync(new URL("./preflight.ts", import.meta.url), "utf8"), js = new Bun.Transpiler({ loader: "ts" }).transformSync(source);
  const payload = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64")), env = fixture();
  const report = await payload.inspect(env.io, frozen); expect(report.status).toBe("PASS_METADATA_PRECONDITIONS"); expect(env.reads.length).toBe(1 + 3 + frozen.retained.length);
});
const stub = Buffer.from(`export function metadataIO(){return{cwd:process.cwd(),env:Object.keys(process.env).sort()};}\nexport async function inspect(io:unknown,plan:unknown){return{status:"PASS_METADATA_PRECONDITIONS",io,plan};}\n`);
function sandboxCommand(source = stub) { const local = { ...frozen, cachedBun: process.execPath }, command = renderHostCommand(source, local, "a".repeat(40));
  const run = (text = command, extraEnv: Record<string, string> = {}) => Bun.spawnSync(["bash", "--noprofile", "--norc", "-c", text], { cwd: repositoryScratch("campaign-handoff-"), env: { PATH: process.env.PATH, DANGEROUS_TEST_KEY: "MUST_NOT_LEAK", BUN_OPTIONS: "", ...extraEnv }, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 5000 });
  return { command, run, local };
}
test("literal Bash command accepts Fish handoff shape, explicit cached Bun and neutral sanitized startup", () => {
  const env = sandboxCommand(), syntax = Bun.spawnSync(["bash", "-n"], { stdin: Buffer.from(env.command), stdout: "pipe", stderr: "pipe" });
  expect(syntax.exitCode).toBe(0); expect(env.command.match(/bash --noprofile --norc -c '\n([\s\S]*)'\n/)![1]).not.toContain("'");
  const result = env.run(); expect(result.exitCode).toBe(0); expect(result.stderr.length).toBe(0);
  const data = JSON.parse(Buffer.from(result.stdout).toString().slice("Executor: ".length));
  expect(data.publicationCommit).toBe("a".repeat(40)); expect(data.report.io.cwd).toBe("/"); expect(data.report.io.env).not.toContain("DANGEROUS_TEST_KEY");
  expect(data.report.io.env).not.toContain("BUN_OPTIONS"); expect(data.report.plan).toEqual(env.local);
});
test("transport tampering fails before source evaluation or any filesystem payload side effect", () => {
  const root = repositoryScratch("campaign-handoff-hash-"), flag = `${root}/evaluated`;
  const source = Buffer.from(`import{writeFileSync}from"node:fs";writeFileSync(${JSON.stringify(flag)},"EVALUATED");\n` + stub.toString());
  const env = sandboxCommand(source), encoded = Buffer.from(Bun.gzipSync(source)).toString("base64"), tampered = encoded.slice(0, -4) + "AAAA";
  expect(env.command).toContain(encoded); const result = env.run(env.command.replace(encoded, tampered));
  expect(result.exitCode).not.toBe(0); expect(Buffer.from(result.stderr).toString()).toContain("TRANSPORT_HASH"); expect(existsSync(flag)).toBe(false);
});
test("shell executable assignment never evaluates dollar or command substitutions", () => {
  const root = repositoryScratch("campaign-handoff-quote-"), flag = `${root}/expanded`, bad = `${root}/$(touch ${flag})`;
  const command = renderHostCommand(stub, { ...frozen, cachedBun: bad }, "a".repeat(40));
  const result = Bun.spawnSync(["bash", "-c", command], { stdout: "pipe", stderr: "pipe", timeout: 5000 });
  expect(result.exitCode).not.toBe(0); expect(existsSync(flag)).toBe(false);
});
test("the delivered Bash starts with BASH_ENV removed before its command body", () => {
  const root = repositoryScratch("campaign-bash-env-"), startup = `${root}/startup.sh`, flag = `${root}/sourced`;
  writeFileSync(startup, `touch ${JSON.stringify(flag)}\n`);
  const env = sandboxCommand();
  const result = Bun.spawnSync(["/bin/sh", "-c", env.command],
    { cwd: root, env: { PATH: process.env.PATH, BASH_ENV: startup }, stdout: "pipe", stderr: "pipe", timeout: 5000 });
  expect(result.exitCode).toBe(0); expect(existsSync(flag)).toBe(false);
});

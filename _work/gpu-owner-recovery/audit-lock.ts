// SPEC: _spec/recovery.md
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { repository, work } from "./provision";

const baselineCommit = "c04a8da9468f7d443bd27d73a08c0bd7ee0e9d20";
function git(...args: string[]) {
  const result = Bun.spawnSync(["git", "--no-replace-objects", "--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", ...args], {
    cwd: repository, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 10_000,
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", LANG: "C", GIT_CONFIG_NOSYSTEM: "1" },
  });
  if (result.exitCode !== 0 || result.stderr.byteLength || result.stdout.byteLength > 4_194_304) throw Error("BOUNDED_BASELINE_SOURCE_REQUIRED");
  return result.stdout;
}
const source = git("show", `${baselineCommit}:Cargo.lock`);
type Package = { name: string; version: string; source?: string; checksum?: string; dependencies?: string[] };
const baseline = (Bun.TOML.parse(new TextDecoder().decode(source)) as { package: Package[] }).package;
const currentBytes = new Uint8Array(await Bun.file(resolve(repository,"Cargo.lock")).arrayBuffer());
const current = (Bun.TOML.parse(new TextDecoder().decode(currentBytes)) as { package: Package[] }).package;
const expected = structuredClone(baseline);
const additions: Record<string,string[]> = { "burn-linalg":["burn-cubecl"], "burn-signal":["burn-cubecl"], "burn-vision":["burn-cubecl","cubecl"], cubek:["cubek-fft"] };
for (const [name,dependencies] of Object.entries(additions)) {
  const block = expected.find((block:{name:string})=>block.name===name);
  if (!block?.dependencies || dependencies.some(dependency=>block.dependencies!.includes(dependency))) throw Error("BASELINE_DELTA_PRECONDITION");
  block.dependencies.push(...dependencies); block.dependencies.sort();
}
expected.push({name:"cubek-fft",version:"0.3.1",source:"registry+https://github.com/rust-lang/crates.io-index",checksum:"48451902f1d21d3eb88cadc17a8a7aeb3b582f17484a68e650f44efe74688b73",dependencies:["cubecl"]});
expected.push({name:"chess-coach-gpu-owner",version:"0.1.0",dependencies:["rustix 1.1.6","serde","serde_json","sha2","tempfile"]});
const sorted = (blocks:typeof baseline)=>blocks.sort((a:{name:string;version:string},b:{name:string;version:string})=>`${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));
if (JSON.stringify(sorted(expected)) !== JSON.stringify(sorted(current))) throw Error("UNAPPROVED_LOCK_DELTA");
const workspace = Bun.TOML.parse(new TextDecoder().decode(git("show", `${baselineCommit}:Cargo.toml`))) as { workspace: { members: string[] } };
workspace.workspace.members.push("crates/gpu-owner");
if (JSON.stringify(workspace) !== JSON.stringify(Bun.TOML.parse(await Bun.file(resolve(repository, "Cargo.toml")).text()))) throw Error("UNAPPROVED_WORKSPACE_DELTA");
const frozenPaths = new TextDecoder().decode(git("ls-tree", "-r", "--name-only", "-z", baselineCommit, "--", "tooling/runtime", "crates/host-facts", "packages/runtime/src/job.ts", "packages/contracts/src/training-state.ts", "packages/contracts/src/episode.ts", "crates/policy-io/src/bin/policy-initialize.rs", "package.json", "bun.lock")).split("\0").filter(Boolean);
if (!frozenPaths.includes("crates/policy-io/src/bin/policy-initialize.rs")) throw Error("FROZEN_INITIALIZER_REQUIRED");
const frozenSources = await Promise.all(frozenPaths.map(async path => {
  const original = git("show", `${baselineCommit}:${path}`), current = new Uint8Array(await Bun.file(resolve(repository, path)).arrayBuffer());
  if (!Buffer.from(original).equals(current)) throw Error(`FROZEN_SOURCE_CHANGED:${path}`);
  return { path, sha256: new Bun.CryptoHasher("sha256").update(current).digest("hex") };
}));
const label = Bun.argv[2];
if (Bun.argv.length!==3 || !/^[a-z0-9-]{1,48}$/.test(label??"")) throw Error("UNIQUE_AUDIT_LABEL_REQUIRED");
await writeFile(resolve(work,`${label}.json`),JSON.stringify({kind:"EXACT_RECOVERED_LOCK_DELTA_AUDIT",baselineCommit,addedLocalPackage:"chess-coach-gpu-owner",addedRegistryPackage:"cubek-fft@0.3.1",changedDependencyLists:additions,allExistingVersionsAndChecksumsUnchanged:true,allOtherPackageBlocksUnchanged:true,rootWorkspaceDelta:"OWNER_MEMBERSHIP_ONLY",frozenSources,lockSha256:new Bun.CryptoHasher("sha256").update(currentBytes).digest("hex"),trainingReady:false},null,2)+"\n",{flag:"wx",mode:0o600});
console.log(JSON.stringify({approvedLockDeltaOnly:true,trainingReady:false}));

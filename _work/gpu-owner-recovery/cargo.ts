// SPEC: _spec/recovery.md, _spec/gpu-owner.puml
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { environment, prepare, repository, work, cache } from "./provision";
import { runBounded } from "./verify";

const rust = `${cache}/rustup/toolchains/1.95.0-x86_64-unknown-linux-gnu/bin`;
const plans: Record<string, string[]> = {
  "owner-check": ["check", "-p", "chess-coach-gpu-owner", "--all-targets"],
  "owner-test": ["test", "-p", "chess-coach-gpu-owner", "--all-targets"],
  "owner-clippy": ["clippy", "-p", "chess-coach-gpu-owner", "--all-targets"],
  "owner-format": [],
  "cpu-test": ["test", "-p", "chess-coach-learning", "-p", "chess-coach-policy-io"],
  "cpu-clippy": ["clippy", "-p", "chess-coach-learning", "-p", "chess-coach-policy-io", "--all-targets"],
  "acquire-owner": ["test", "-p", "chess-coach-gpu-owner", "--all-targets", "--no-run"],
  "acquire-cpu": ["test", "-p", "chess-coach-learning", "-p", "chess-coach-policy-io", "--no-run"],
  "tree-owner": ["tree", "-p", "chess-coach-gpu-owner", "-e", "normal,build,dev,features"],
  "tree-cpu": ["tree", "-p", "chess-coach-learning", "-p", "chess-coach-policy-io", "-e", "normal,build,features"],
};
const hash = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

async function probe(directory: string, env: Record<string,string>, kind: string) {
  const scratch = resolve(work, "scratch", `lock-probe-${directory.split("/").at(-1)}`);
  await mkdir(scratch, { mode: 0o700 });
  const files = ["Cargo.toml", "Cargo.lock", "crates/learning/Cargo.toml", "crates/policy-io/Cargo.toml", "crates/host-facts/Cargo.toml", "crates/gpu-owner/Cargo.toml"];
  for (const path of files) {
    const target = resolve(scratch,path);
    await mkdir(resolve(target,".."), {recursive:true,mode:0o700});
    await writeFile(target,await readFile(resolve(repository,path)),{flag:"wx",mode:0o600});
  }
  for (const crate of ["learning", "policy-io", "host-facts", "gpu-owner"]) {
    await mkdir(resolve(scratch,`crates/${crate}/src`),{recursive:true,mode:0o700});
    await writeFile(resolve(scratch,`crates/${crate}/src/lib.rs`),"",{flag:"wx",mode:0o600});
    await writeFile(resolve(scratch,`crates/${crate}/src/main.rs`),"fn main() {}\n",{flag:"wx",mode:0o600});
  }
  const argv = kind === "lock-probe-resolve"
    ? [`${rust}/cargo`,"check","--manifest-path",resolve(scratch,"Cargo.toml"),"-p","chess-coach-gpu-owner","--jobs","2"]
    : [`${rust}/cargo`,"metadata","--manifest-path",resolve(scratch,"Cargo.toml"),"--no-deps","--format-version","1",...(kind === "lock-probe-cuda"?["--features","chess-coach-policy-io/gpu-cuda"]:[])];
  const result = await runBounded(argv,directory,300_000,{cwd:repository,environment:env});
  const proposed = await readFile(resolve(scratch,"Cargo.lock"));
  await writeFile(resolve(directory,"proposed-Cargo.lock"),proposed,{flag:"wx",mode:0o600});
  return {argv,result,proposedLockSha256:hash(proposed),rootLockChanged:false};
}

async function main() {
  const [mode,label] = Bun.argv.slice(2);
  if (Bun.argv.length!==4 || (!plans[mode!] && !["lock-probe","lock-probe-cuda","lock-probe-resolve","versions"].includes(mode!)) || !/^[a-z0-9-]{1,48}$/.test(label??"")) throw Error("CLOSED_CARGO_MODE_REQUIRED");
  await prepare();
  for (const path of ["zig-cc.ts", "zig-cxx.ts", "zig-ar.ts"]) await chmod(resolve(work,path),0o700);
  const directory=resolve(work,"runs",label!);
  await mkdir(directory,{mode:0o700});
  const env={...environment,PATH:`${rust}:/usr/local/bin:/usr/bin:/bin`,RUSTC:`${rust}/rustc`,RUSTDOC:`${rust}/rustdoc`,
    CC:resolve(work,"zig-cc.ts"),CXX:resolve(work,"zig-cxx.ts"),AR:resolve(work,"zig-ar.ts"),CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER:resolve(work,"zig-cc.ts"),
    ZIG_GLOBAL_CACHE_DIR:resolve(cache,"zig/global"),ZIG_LOCAL_CACHE_DIR:resolve(cache,"zig/local"),CARGO_TERM_COLOR:"never",CARGO_NET_OFFLINE:mode!.startsWith("acquire-") || mode!.startsWith("lock-probe")?"false":"true"};
  const before=hash(await readFile(resolve(repository,"Cargo.lock")));
  const patterns = ["Cargo.toml", "Cargo.lock", "crates/*/Cargo.toml", "_work/gpu-owner-recovery/*.ts", "_work/gpu-owner-recovery/mise.toml",
    ...(mode!.includes("cpu") ? ["crates/learning/**/*.rs", "crates/policy-io/**/*.rs"] : ["crates/gpu-owner/**/*.rs", "crates/gpu-owner/tests/support/*.ts", "tooling/runtime/fixtures/gpu-policy-traces.json", "packages/*/src/**/*.ts", "packages/runtime/tests/fixtures/gpu-owner/*.ts"])];
  const paths = new Set<string>();
  for (const pattern of patterns) for await (const path of new Bun.Glob(pattern).scan({ cwd: repository, onlyFiles: true })) paths.add(path);
  const sources = await Promise.all([...paths].sort().map(async path => ({ path, sha256: hash(await readFile(resolve(repository, path))) })));
  const sourcesJson = JSON.stringify(sources, null, 2) + "\n";
  await writeFile(resolve(directory, "sources.json"), sourcesJson, { flag: "wx", mode: 0o600 });
  let record;
  if (mode!.startsWith("lock-probe")) record=await probe(directory,env,mode!);
  else {
    const argv=mode==="versions"?[`${rust}/rustc`,"--version","--verbose"]:mode==="owner-format"?[`${rust}/rustfmt`,"--edition","2024","--check",...sources.map(source=>source.path).filter(path=>path.startsWith("crates/gpu-owner/")&&path.endsWith(".rs"))]:[`${rust}/cargo`,...plans[mode!]!,"--locked",...(mode!.startsWith("acquire-")?[]:["--offline"]),
      ...(mode!.startsWith("tree")?[]:["--jobs","2"]),...(mode!.endsWith("clippy")?["--","-D","warnings"]:[])];
    record={argv,result:await runBounded(argv,directory,600_000,{cwd:repository,environment:env})};
  }
  const after=hash(await readFile(resolve(repository,"Cargo.lock")));
  if (before!==after) { record.result.status="FAIL";record.result.failure??="ROOT_LOCK_CHANGED"; }
  const sourceChanged = (await Promise.all(sources.map(async source => hash(await readFile(resolve(repository, source.path))) !== source.sha256))).some(Boolean);
  if (sourceChanged) { record.result.status="FAIL";record.result.failure??="SOURCE_CHANGED_DURING_VERIFICATION"; }
  const streams = await Promise.all(["stdout", "stderr"].map(async stream => {
    const path = resolve(directory, `command.${stream}`), bytes = await readFile(path);
    return { stream, path: relative(repository, path), bytes: bytes.byteLength, sha256: hash(bytes) };
  }));
  const receipt={version:"chess-coach.cargo-recovery.v1",mode,...record,environment:env,lockBefore:before,lockAfter:after,
    sourceCount: sources.length, sourceManifestSha256: hash(Buffer.from(sourcesJson)), sourceChanged, streams,
    actualHostExecuted:false,cudaGpuCodeExecuted:false,trainingReady:false};
  await writeFile(resolve(directory,"receipt.json"),JSON.stringify(receipt,null,2)+"\n",{flag:"wx",mode:0o600});
  console.log(JSON.stringify({receipt:relative(repository,resolve(directory,"receipt.json")),status:record.result.status,trainingReady:false}));
  process.exitCode=record.result.status==="PASS"?0:1;
}

if(import.meta.main)await main();

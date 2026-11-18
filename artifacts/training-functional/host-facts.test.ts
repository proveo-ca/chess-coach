// SPEC: _spec/runtime-protocol.puml
import { expect, test } from "bun:test";
import { acceptsHostContext, CACHE, CACHED_BUN, CHILD_ENV, collectHostFacts, GPU, HOST, IMAGE, isHostFactsEntry, parseZodPackage, QUERIES, runHostFacts, serializeHostFacts } from "./host-facts.ts";
import type { ChildFact, Fact, HostFactsIO, Query } from "./host-facts.ts";

const child = (): ChildFact => ({ spawned: true, exited: true, reaped: true, exitCode: 0, signalCode: null, stdoutEOF: true, stderrEOF: true, killRequested: false, timedOut: false });
const good = (query: Query): Fact => ({ ok: true, data: { injected: query.name }, ...(query.kind === "command" ? { child: child() } : {}), rawBytes: 4, retainedBytes: 4, truncated: false });
function fixture() {
  let now = 100, contexts = 0;
  const queries: { query: Query; deadlineMs: number; cleanupDeadlineMs: number }[] = [], events: string[] = [];
  const alarms: { ms: number; fire: () => void; cancelled: boolean }[] = [];
  const io: HostFactsIO = {
    now: () => { events.push("clock"); return now; },
    alarm(ms, fire) { const entry = { ms, fire, cancelled: false }; alarms.push(entry); return () => { entry.cancelled = true; }; },
    async context() { contexts++; events.push("context"); return { cwd: HOST, realpath: HOST }; },
    async query(query, budget) { events.push(query.name); queries.push({ query, ...budget }); return good(query); },
  };
  return { io, queries, events, alarms, setTime(value: number) { now = value; }, contexts: () => contexts };
}
const source = () => Bun.file(new URL("./host-facts.ts", import.meta.url)).text();
async function evaluate(tail = "", prefix = "", args: string[] = []) {
  const proc = Bun.spawn([process.execPath, "--no-env-file", "--no-install", "--eval", `${prefix}\n${await source()}\n${tail}`, ...args], {
    cwd: new URL("../../", import.meta.url).pathname, env: { ...CHILD_ENV }, stdin: "ignore", stdout: "pipe", stderr: "pipe",
  });
  const [exit, stdout, stderr] = await Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  expect(stderr).toBe(""); expect(exit).toBe(0); return stdout;
}

test("fixed eleven groups bind exact argv, paths, environment and inferred CPU layout", () => {
  expect(QUERIES).toHaveLength(11);
  expect(QUERIES.map(query => query.name)).toEqual(["docker-image", "cached-bun-version", "gpu-memory-snapshot", "cached-bun-metadata", "policy-score-metadata", "policy-channel-metadata", "cpu-initializer-metadata", "llvm-root-metadata", "cuda-root-metadata", "runtime-zod-packages", "runs-disk-snapshot"]);
  expect(QUERIES.slice(0, 3).map(query => query.argv)).toEqual([
    ["docker", "--host=unix:///var/run/docker.sock", "image", "inspect", "--format", "{{json .Id}}", IMAGE],
    [CACHED_BUN, "--version"], ["nvidia-smi", "--id", GPU, "--query-gpu=uuid,memory.free,memory.total", "--format=csv,noheader,nounits"],
  ]);
  expect(QUERIES.slice(3, 9).map(query => query.paths[0])).toEqual([CACHED_BUN,
    `${CACHE}/host-gpu-native-build-1/native/target-gpu/x86_64-unknown-linux-gnu/release/policy-score`,
    `${CACHE}/host-gpu-native-build-1/native/target-gpu/x86_64-unknown-linux-gnu/release/policy-channel`,
    `${CACHE}/host-cpu39-1/native/target-cpu/x86_64-unknown-linux-gnu/release/policy-initialize`,
    `${CACHE}/host-receive-2/context/gpu-build/llvm`, `${CACHE}/host-receive-2/context/gpu-runtime/rootfs/usr/local/cuda`]);
  expect(QUERIES[6]!.layout).toBe("INFERRED_TARGET_LAYOUT_NOT_AN_EXISTENCE_CLAIM");
  expect(QUERIES[9]!.paths).toEqual([`${HOST}/node_modules/zod/package.json`, `${HOST}/packages/contracts/node_modules/zod/package.json`, `${HOST}/node_modules/.pnpm/zod@4.6.7/node_modules/zod/package.json`]);
  expect(QUERIES[10]!.paths).toEqual([`${HOST}/_work/gpu-owner-recovery/runs`]);
  expect(CHILD_ENV).toEqual({ PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", DOCKER_CONFIG: "/nonexistent" });
  expect(Object.isFrozen(QUERIES)).toBe(true); expect(QUERIES.every(query => Object.isFrozen(query) && Object.isFrozen(query.argv) && Object.isFrozen(query.paths))).toBe(true);
});

test("complete mocked observations remain UNKNOWN availability and emit bounded named facts", async () => {
  const env = fixture(), report = await collectHostFacts(env.io), wire = serializeHostFacts(report);
  expect(report.status).toBe("FULL"); expect(report.availability).toBe("UNKNOWN"); expect(report.context).toBe("ACCEPTED");
  expect(report.queryGroups).toBe(11); expect(env.queries.map(call => call.query)).toEqual([...QUERIES]);
  expect(report.results.every(result => result.status === "OK")).toBe(true);
  expect(report.byteCounts).toEqual({ rawObserved: 44, rawRetained: 44, serialized: Buffer.byteLength(wire) });
  expect(report.elapsedMs).toBe(0); expect(wire).not.toContain("trainingReady"); expect(wire).not.toContain("usableGPU");
  expect(env.events[0]).toBe("clock"); expect(env.contexts()).toBe(1); expect(env.alarms.every(alarm => alarm.cancelled)).toBe(true);
  for (const call of env.queries.slice(0, 3)) { expect(call.deadlineMs).toBe(5100); expect(call.cleanupDeadlineMs).toBe(5600); }
});

test("pure HOST context guard rejects integration root, aliases and failed canonicalization", async () => {
  expect(acceptsHostContext({ cwd: HOST, realpath: HOST })).toBe(true);
  for (const context of [{ cwd: `${HOST}-integration`, realpath: `${HOST}-integration` }, { cwd: "/alias", realpath: HOST }, { cwd: HOST, realpath: "/alias" }, { cwd: HOST, realpath: null }]) {
    expect(acceptsHostContext(context)).toBe(false);
    const env = fixture(); env.io.context = async () => context;
    const report = await collectHostFacts(env.io);
    expect(report.status).toBe("PARTIAL"); expect(report.context).toBe("REJECTED"); expect(env.queries).toHaveLength(0);
    expect(report.results).toHaveLength(11); expect(report.results.every(result => result.status === "SKIPPED")).toBe(true);
  }
});

test("missing optional metadata does not suppress independent groups or assert GPU startup failure", async () => {
  const env = fixture(); env.io.query = async (query, budget) => {
    env.queries.push({ query, ...budget }); if (query.name === "cpu-initializer-metadata") throw new Error("ENOENT injected"); return good(query);
  };
  const report = await collectHostFacts(env.io);
  expect(report.status).toBe("PARTIAL"); expect(report.queryGroups).toBe(11); expect(report.results[6]!.error).toContain("ENOENT");
  expect(report.results[6]!.layout).toContain("INFERRED"); expect(report.results[10]!.status).toBe("OK"); expect(report.availability).toBe("UNKNOWN");
});

test("pure bounded zod parsing rejects null, arrays, missing keys, invalid JSON and non-zod objects", () => {
  const encode = (text: string) => new TextEncoder().encode(text);
  expect(parseZodPackage(encode('{"name":"zod","version":"4.6.7","ignored":"not retained"}'))).toEqual({ name: "zod", version: "4.6.7", truncated: false });
  for (const text of ["null", "[]", "{}", "not JSON", '{"name":"other","version":"4"}', '{"name":"zod","version":null}']) expect(() => parseZodPackage(encode(text))).toThrow();
  expect(() => parseZodPackage(new Uint8Array(32769))).toThrow("JSON_FILE_LIMIT");
  const long = parseZodPackage(encode(JSON.stringify({ name: "zod", version: "x".repeat(1000) })));
  expect(long.version.length).toBe(256); expect(long.truncated).toBe(true);
});

test("initial origin includes adapter setup and context instead of renewing the phase", async () => {
  const env = fixture(); env.io.originMs = 10; env.setTime(20000);
  env.io.context = async () => { env.setTime(27010); return { cwd: HOST, realpath: HOST }; };
  const report = await collectHostFacts(env.io);
  expect(report.originMs).toBe(10); expect(report.elapsedMs).toBe(27000); expect(report.status).toBe("DEADLINE"); expect(env.queries).toHaveLength(0);
});

test("new commands use the remaining original phase and cleanup reserve", async () => {
  const env = fixture(); env.io.originMs = 0; env.setTime(26000);
  env.io.query = async (query, budget) => { env.queries.push({ query, ...budget }); env.setTime(27000); return good(query); };
  const report = await collectHostFacts(env.io);
  expect(report.status).toBe("DEADLINE"); expect(env.queries).toHaveLength(1);
  expect(env.queries[0]!.deadlineMs).toBe(27000); expect(env.queries[0]!.cleanupDeadlineMs).toBe(27500);
  expect(report.results.filter(result => result.status === "SKIPPED")).toHaveLength(10);
});

test("unresolved async context cannot indefinitely await the query phase", async () => {
  const env = fixture(); env.io.context = () => new Promise(() => {});
  env.io.alarm = (_ms, fire) => { queueMicrotask(() => { env.setTime(27100); fire(); }); return () => {}; };
  const report = await collectHostFacts(env.io);
  expect(report.status).toBe("DEADLINE"); expect(report.queryGroups).toBe(0); expect(report.elapsedMs).toBe(27000);
});

test("unresolved query cleanup returns uncertainty instead of FULL and permits later groups", async () => {
  const env = fixture(); let queried = 0;
  env.io.query = async query => { queried++; return query.name === "docker-image" ? new Promise<Fact>(() => {}) : good(query); };
  env.io.alarm = (_ms, fire) => { if (queried === 1) queueMicrotask(fire); return () => {}; };
  const report = await collectHostFacts(env.io);
  expect(report.status).toBe("PARTIAL"); expect(report.queryGroups).toBe(11); expect(report.results[0]!.status).toBe("ERROR"); expect(report.results[10]!.status).toBe("OK");
});

test("regressing monotonic clock stops queries and cannot become FULL", async () => {
  const env = fixture(); env.io.query = async query => { env.setTime(99); return good(query); };
  const report = await collectHostFacts(env.io);
  expect(report.status).toBe("PARTIAL"); expect(report.queryGroups).toBe(1); expect(report.errors.join(" ")).toContain("CLOCK_NON_MONOTONIC");
});

test("deadline includes final serialization observation", async () => {
  const env = fixture(); let finalClocks = 0;
  env.io.now = () => { if (env.queries.length === 11 && ++finalClocks >= 3) return 30100; return 100; };
  const report = await collectHostFacts(env.io);
  expect(report.queryGroups).toBe(11); expect(report.status).toBe("DEADLINE"); expect(report.elapsedMs).toBe(30000);
});

test("unreaped, missing EOF, timeout, absent ownership or nonzero exit can never be FULL", async () => {
  for (const patch of [{ reaped: false }, { exited: false }, { stdoutEOF: false }, { stderrEOF: false }, { timedOut: true }, { exitCode: 1 }, { error: "uncertain cleanup" }]) {
    const env = fixture(); env.io.query = async query => ({ ...good(query), ...(query.kind === "command" ? { child: { ...child(), ...patch } } : {}) });
    expect((await collectHostFacts(env.io)).status).toBe("PARTIAL");
  }
  const env = fixture(); env.io.query = async query => ({ ...good(query), child: undefined });
  expect((await collectHostFacts(env.io)).status).toBe("PARTIAL");
});

test("raw truncation makes observations PARTIAL and keeps actual child exit/EOF/reap facts", async () => {
  const env = fixture(); env.io.query = async query => ({ ...good(query), truncated: query.kind === "command", rawBytes: 4096, retainedBytes: 2048 });
  const report = await collectHostFacts(env.io);
  expect(report.status).toBe("PARTIAL"); expect(report.truncated).toBe(true);
  expect(report.results[0]!.child).toEqual(child()); expect(report.byteCounts.rawObserved).toBe(11 * 4096);
});

test("escaped final JSON cap drops data, preserves ownership, counts newline and reports PARTIAL", async () => {
  const env = fixture(); env.io.query = async query => ({ ...good(query), data: { text: "\0".repeat(20000) }, rawBytes: 20000, retainedBytes: 20000 });
  const report = await collectHostFacts(env.io), wire = serializeHostFacts(report);
  expect(Buffer.byteLength(wire)).toBeLessThanOrEqual(131072); expect(report.byteCounts.rawRetained).toBeLessThanOrEqual(131072);
  expect(report.byteCounts.serialized).toBe(Buffer.byteLength(wire)); expect(report.status).toBe("PARTIAL"); expect(report.truncated).toBe(true);
  expect(report.results[0]!.child).toEqual(child()); expect(JSON.parse(wire).results).toHaveLength(11);
});

test("errors are bounded and runner emits exactly one JSON document with nonzero partial exit", async () => {
  const env = fixture(), writes: string[] = []; env.io.query = async () => { throw new Error("x".repeat(10000)); };
  const code = await runHostFacts(env.io, async text => { writes.push(text); });
  expect(code).toBe(1); expect(writes).toHaveLength(1); expect(writes[0]!.trim().split("\n")).toHaveLength(1);
  const report = JSON.parse(writes[0]!); expect(report.status).toBe("PARTIAL"); expect(report.results.every((result: { error: string }) => Buffer.byteLength(result.error) <= 163)).toBe(true);
});

test("FULL runner exits zero and emits a single bounded JSON document", async () => {
  const env = fixture(), writes: string[] = [];
  expect(await runHostFacts(env.io, async text => { writes.push(text); })).toBe(0);
  expect(writes).toHaveLength(1); expect(JSON.parse(writes[0]!).status).toBe("FULL");
});

test("runner bounds blocked output by the original hard deadline without a second emission", async () => {
  const env = fixture(); let writes = 0, outputAlarm = 0;
  env.io.alarm = (ms, fire) => {
    if (writes) { outputAlarm = ms; queueMicrotask(() => { env.setTime(30100); fire(); }); }
    return () => {};
  };
  const code = await runHostFacts(env.io, () => { writes++; return new Promise(() => {}); });
  expect(code).toBe(2); expect(writes).toBe(1); expect(outputAlarm).toBe(30000);
});

test("production JSON facts count every input byte even when parsing rejects the input", async () => {
  const result = JSON.parse(await evaluate(`
    const invalidBytes=Buffer.from("not JSON"), validBytes=Buffer.from(JSON.stringify({name:"zod",version:"4.6.7",ignored:"x".repeat(100)}));
    let selectedBytes=validBytes;
    jsonPackage=async(path)=>{try{return{path,ok:true,bytesRead:selectedBytes.length,...parseZodPackage(selectedBytes)}}catch(error){return{path,ok:false,bytesRead:selectedBytes.length,error:String(error)}}};
    timerIO.now=()=>0;
    const io=productionIO(0), valid=await io.query(QUERIES[9],{deadlineMs:27000,cleanupDeadlineMs:27000});
    selectedBytes=invalidBytes;
    const invalid=await io.query(QUERIES[9],{deadlineMs:27000,cleanupDeadlineMs:27000});
    console.log(JSON.stringify({valid,invalid,validLength:validBytes.length,invalidLength:invalidBytes.length}));`));
  expect(result.valid.rawBytes).toBe(3 * result.validLength);
  expect(result.invalid.rawBytes).toBe(3 * result.invalidLength);
  expect(result.invalid.ok).toBe(false);
  expect(result.invalid.data.every((row: { bytesRead: number }) => row.bytesRead === result.invalidLength)).toBe(true);
});

test("entry guard accepts only explicit eval argv with --run and remains inert for imports", () => {
  expect(isHostFactsEntry(true, ["bun", "--run"])).toBe(true);
  for (const args of [["bun"], ["bun", "--other"], ["bun", "--run", "--other"], ["bun", "host-facts.ts", "--run"]]) expect(isHostFactsEntry(true, args)).toBe(false);
  expect(isHostFactsEntry(false, ["bun", "--run"])).toBe(false);
});

test("literal published source parses as Bun TypeScript eval and stays inert without explicit run", async () => {
  expect(await evaluate()).toBe("");
  expect(await evaluate("", "", ["--run"])).toBe("");
  const probe = JSON.parse(await evaluate('console.log(JSON.stringify({main:import.meta.main,args:Bun.argv.slice(1)}));', "", ["--", "--probe"]));
  expect(probe).toEqual({ main: true, args: ["--probe"] });
});

test("literal eval accepts appended mocked collector without any factual HOST calls", async () => {
  const result = JSON.parse(await evaluate(`
    const mockedIO = { now:()=>1, alarm:()=>()=>{}, context:async()=>({cwd:HOST,realpath:HOST}),
      query:async q=>({ok:true,rawBytes:0,retainedBytes:0,truncated:false,...(q.kind==='command'?{child:{spawned:true,exited:true,reaped:true,exitCode:0,signalCode:null,stdoutEOF:true,stderrEOF:true,killRequested:false,timedOut:false}}:{})}) };
    console.log(JSON.stringify(await collectHostFacts(mockedIO)));`, `Bun.spawn=()=>{throw new Error('NO_REAL_CHILD')}; process.cwd=()=>{throw new Error('NO_REAL_CONTEXT')};`));
  expect(result.status).toBe("FULL"); expect(result.queryGroups).toBe(11); expect(result.availability).toBe("UNKNOWN");
});

test("explicit eval main rejects mocked wrong HOST before spawn and emits one JSON only", async () => {
  const result = JSON.parse(await evaluate("", `
    const writes=[]; let spawns=0; const output=console.log.bind(console);
    process.cwd=()=>'/mock/integration'; Bun.spawn=()=>{spawns++;throw new Error('NO_REAL_CHILD')};
    Bun.write=async(_target,text)=>{writes.push(text);return text.length};
    process.exit=code=>{output(JSON.stringify({code,spawns,writes}));};`, ["--", "--run"]));
  expect(result.code).toBe(1); expect(result.spawns).toBe(0); expect(result.writes).toHaveLength(1);
  const report = JSON.parse(result.writes[0]); expect(report.context).toBe("REJECTED"); expect(report.queryGroups).toBe(0);
});

test("production command adapter captures mocked exact argv/env and distinguishes configuration Id", async () => {
  const result = JSON.parse(await evaluate(`
    const calls=[]; timerIO.now=()=>0; timerIO.alarm=()=>()=>{};
    Bun.spawn=(argv,options)=>{calls.push({argv,options});return {pid:123456,stdout:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(JSON.stringify('sha256:'+'a'.repeat(64))));c.close()}}),stderr:new ReadableStream({start(c){c.close()}}),exited:Promise.resolve(0),signalCode:null,unref(){},kill(){throw new Error('NO_KILL')}}};
    process.kill=()=>{throw new Error('NO_REAL_KILL')};
    const fact=await commandFact(QUERIES[0],{deadlineMs:5000,cleanupDeadlineMs:5500});console.log(JSON.stringify({fact,calls}));`));
  expect(result.calls).toHaveLength(1); expect(result.calls[0].argv).toEqual(QUERIES[0]!.argv);
  expect(result.calls[0].options).toEqual({ env: CHILD_ENV, cwd: HOST, stdin: "ignore", stdout: "pipe", stderr: "pipe", detached: true });
  expect(result.fact.child).toEqual(child()); expect(result.fact.data.requestedRef).toBe(IMAGE);
  expect(result.fact.data.observedConfigId).toBe(`sha256:${"a".repeat(64)}`); expect(result.fact.data.idMeaning).toContain("NOT_REGISTRY_MANIFEST_DIGEST");
});

test("production command adapter bounded mocked stream captures truncation without unbounded text reads", async () => {
  const fact = JSON.parse(await evaluate(`
    timerIO.now=()=>0;timerIO.alarm=()=>()=>{};
    Bun.spawn=()=>({pid:123456,stdout:new ReadableStream({start(c){c.enqueue(new Uint8Array(100000));c.close()}}),stderr:new ReadableStream({start(c){c.close()}}),exited:Promise.resolve(0),signalCode:null,unref(){},kill(){}});
    process.kill=()=>{throw new Error('NO_REAL_KILL')};
    console.log(JSON.stringify(await commandFact(QUERIES[1],{deadlineMs:5000,cleanupDeadlineMs:5500})));`));
  expect(fact.rawBytes).toBe(100000); expect(fact.retainedBytes).toBe(2048); expect(fact.data.stdout.length).toBe(2048); expect(fact.truncated).toBe(true); expect(fact.child.reaped).toBe(true);
});

test("production ordinary watchdog never waits indefinitely for mocked child exit or pipe EOF", async () => {
  const result = JSON.parse(await evaluate(`
    let kills=0;timerIO.now=()=>0;timerIO.alarm=(_ms,fire)=>{queueMicrotask(fire);return()=>{}};
    Bun.spawn=()=>({pid:123456,stdout:new ReadableStream(),stderr:new ReadableStream(),exited:new Promise(()=>{}),signalCode:null,unref(){},kill(){kills++}});
    process.kill=()=>{kills++;return true};
    const fact=await commandFact(QUERIES[1],{deadlineMs:5000,cleanupDeadlineMs:5500});console.log(JSON.stringify({fact,kills}));`));
  expect(result.kills).toBeGreaterThan(0); expect(result.fact.ok).toBe(false); expect(result.fact.child.timedOut).toBe(true);
  expect(result.fact.child.reaped).toBe(false); expect(result.fact.child.exited).toBe(false); expect(result.fact.child.stdoutEOF).toBe(false); expect(result.fact.child.stderrEOF).toBe(false);
});

test("late mocked child exit cannot rewrite an already returned cleanup observation", async () => {
  const result = JSON.parse(await evaluate(`
    let resolveExit;timerIO.now=()=>0;timerIO.alarm=(_ms,fire)=>{queueMicrotask(fire);return()=>{}};
    Bun.spawn=()=>({pid:123456,stdout:new ReadableStream(),stderr:new ReadableStream(),exited:new Promise(resolve=>{resolveExit=resolve}),signalCode:null,unref(){},kill(){}});
    process.kill=()=>true;
    const fact=await commandFact(QUERIES[1],{deadlineMs:5000,cleanupDeadlineMs:5500});resolveExit(0);await Promise.resolve();console.log(JSON.stringify(fact));`));
  expect(result.child.reaped).toBe(false); expect(result.child.exited).toBe(false); expect(result.ok).toBe(false);
});

test("source adapter stays standalone, metadata-only and bounded without environment reads or writes", async () => {
  const text = await source();
  expect(text.split("\n").length).toBeLessThanOrEqual(221);
  expect(text).not.toMatch(/from\s+["']\./); expect(text).not.toMatch(/process\.env|Bun\.env|readFile|writeFile|mkdir|readdir|fetch\(/);
  expect(text).toContain("constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW");
  expect(text).toContain("Buffer.alloc(JSON_FILE + 1)"); expect(text).toContain("Promise.all(selected.paths.map(jsonPackage))");
  expect(text).toContain('reservation: false'); expect(text).toContain('process.kill(-proc.pid, "SIGKILL")');
  expect(text).not.toContain("Bun.file("); expect(text).not.toContain("execSync");
});

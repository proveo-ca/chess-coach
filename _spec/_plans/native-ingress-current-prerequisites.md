# F9 — current-namespace prerequisites: Node-only proposal

**[Unverified] PROPOSAL ONLY / SOURCE IDENTITIES MEASURED / SYNTAX CHECKED WITHOUT EXECUTION / EXACT APPROVAL NONE.**

The current-namespace target choice authorizes no observation or control creation.
The supplied checkpoint is HEAD `455f28a91cdff39602434ba17fa138c0bb6d881d`, PR50 ready/open; this author did not verify it.
This new proposal contains inert source only; no controls, results, receipts, logs or sinks exist from this work.
Historical protected files remain untouched; old M2/proc/receipt/daemon grants are not renewed.
Existing root laws, source `470e540`, BAF `3476/17`, classification, clocks and exclusions remain unchanged.

## 1. Scope and trust boundary

This is ordinary host preflight, not F9 capture or native evidence.
`nativeAuthority=false`, `trainingReady=false`, and `snapshotCandidate`, `captureRootCandidate`, `lArtifact` are always null.
Neither the owner nor controller acquires a native process relationship from this report.
No result qualifies F9C, daemon cohosting, root namespace protection, source binding or target execution.
The fixed names derive from [M2](native-ingress-mise-install.md): ROOT line48, CARGO_HOME line70, postchecks lines231–245.
Those historical names establish no current existence, contents, versions or usability.

Exactly eleven literal targets, in parent-first order; W and M are pathname candidates:

| Index | Target | Expected type |
|---|---|---|
| 0 | `/tmp` | directory |
| 1 | `/tmp/opencode` | directory |
| 2 | `/tmp/opencode/f9-bootstrap-correspondence` (W) | directory |
| 3 | `/tmp/opencode/f9-host-rust-1.95.0-m2` (M) | directory |
| 4 | `/tmp/opencode/f9-host-rust-1.95.0-m2/cargo` | directory |
| 5 | `/tmp/opencode/f9-host-rust-1.95.0-m2/cargo/bin` | directory |
| 6 | `/tmp/opencode/f9-host-rust-1.95.0-m2/cargo/bin/rustup` | regular file |
| 7 | `/tmp/opencode/f9-host-rust-1.95.0-m2/cargo/bin/rustc` | regular file |
| 8 | `/tmp/opencode/f9-host-rust-1.95.0-m2/cargo/bin/cargo` | regular file |
| 9 | `/tmp/opencode/f9-host-rust-1.95.0-m2/cargo/bin/rustfmt` | regular file |
| 10 | `/tmp/opencode/f9-host-rust-1.95.0-m2/cargo/bin/clippy-driver` | regular file |

Each target receives at most one `fs.lstatSync(path,{bigint:true})`; symlinks stop without following.
ENOENT means a missing partial prefix, not global absence; mismatches and other errors mean STOP.
Immediately after W/M passes the directory check, one `fs.statfsSync(path,{bigint:true})` follows.
Full success entails 13 explicit filesystem metadata queries: eleven lstat plus two statfs.
No target directory/file opens occur; Node provides no invented directory-relative openat/dirFd facility here.
Absolute-path ancestors can race despite earlier checks: ordinary trusted-host stable pathnames are an explicit residual.
The lstat/statfs pair is not atomic and does not prove both observations describe the same backing object.
Counts describe explicit source calls, not exact kernel entries or startup filesystem activity.
No PATH/environment discovery, mise, enumeration, readlink, target hashes/execution/versions, proc, daemon, home/cache/log or rustup-tree scanning.

## 2. Output and runtime contract

Protocol `F9_CURRENT_PREREQS_NODE_V1`; phase `ORDINARY_HOST_PREFLIGHT_ONLY`; realm `CURRENT_AGENT_SANDBOX_ONLY`.
The eleven fixed records preserve completed prefixes and `NOT_OBSERVED` suffixes on early failure.
Statuses/exits: OBSERVED_CANDIDATE/0, MISSING_PARTIAL/2, SYMLINK_UNRESOLVED/2, STOP/3.
Reasons form the closed set in the controller; emergency STOP omits detailed observations.
Target mode/uid/gid/size/dev/ino and statfs type/bsize/blocks/bfree/bavail/files/ffree are native BigInts in [0,U64].
They serialize as canonical decimal strings, never via Number; counts alone use bounded Numbers.
`availableBytes=bsize*bavail` must fit U64; it proves neither quota availability nor a space reservation.
Node StatFs has no readonly f_flag/statvfs: `readOnlyIndicator=null`, `readOnlyStatus=API_NOT_AVAILABLE`.
W/M summaries confer no scope or authority; no CurrentCaptureRoot is fabricated.
Reader metadata is bounded self execPath/version/platform/arch, one effective UID and one os.release call.
Self Node version approves no interpreter identity or existing target execution; no hostname or environment dump occurs.
The collector imports only fs/os, has no subprocess API and inspects only ordinary native stat source data.
No unknown caller graphs, reflective getter walks or arbitrary native context are supported.

Collector source-body deadline: 3500ms, with at most64 hrtime samples around observations and encoding.
Synchronous blocked filesystem calls cannot be interrupted by these checks.
Controller child deadline: 3800ms; direct-child cleanup waits at most400ms, ending no later than4200ms from body start.
The requested outer5000ms timeout is not a hard kernel termination guarantee.
Imports, interpreter loading and controller PRE-BODY startup precede body clocks and capture handlers.
**exceptionStartupRisk:** startup output and effects remain outside controller-enforced capture limits.
**ordinaryHostResidual:** trusted runtime/host, stable control loads and pathnames, scheduling and kernel latency.
No process group/session is created: the controlled collector does not spawn.
Only the actual live ChildProcess handle may receive one kill attempt; never raw PID or after observed exit.
Close/EOF uncertainty always prevents success; no process-tree containment is claimed.

## 3. Collector — inert .mjs body

Future fresh path: `/tmp/opencode/f9-current-prereqs-reader-01.mjs`.
The marker-delimited body includes its terminal LF; its measured identity is recorded in §7 without execution or approval.

<!-- BEGIN F9 CURRENT PREREQS COLLECTOR NODE V1 -->
```mjs
import fs from 'node:fs';
import os from 'node:os';
const START = process.hrtime.bigint(), U64 = (1n << 64n) - 1n;
const W = '/tmp/opencode/f9-bootstrap-correspondence';
const M = '/tmp/opencode/f9-host-rust-1.95.0-m2';
const PATHS = ['/tmp', '/tmp/opencode', W, M, M + '/cargo', M + '/cargo/bin',
  M + '/cargo/bin/rustup', M + '/cargo/bin/rustc', M + '/cargo/bin/cargo',
  M + '/cargo/bin/rustfmt', M + '/cargo/bin/clippy-driver'];
const BASE = {protocol:'F9_CURRENT_PREREQS_NODE_V1', phase:'ORDINARY_HOST_PREFLIGHT_ONLY',
  realm:'CURRENT_AGENT_SANDBOX_ONLY', snapshotCandidate:null, captureRootCandidate:null,
  lArtifact:null, nativeAuthority:false, trainingReady:false};
const FALLBACK = {...BASE, status:'STOP', reason:'COLLECTOR_STOP'};
const counts = {lstat:0, statfs:0, euid:0, release:0, clock:1};
class Halt extends Error { constructor(reason, status='STOP') { super(); this.reason=reason; this.status=status; } }
function check(ok, reason) { if (!ok) throw new Halt(reason); }
function clock() {
  check(counts.clock < 64, 'CLOCK_LIMIT'); counts.clock++;
  check(process.hrtime.bigint() - START < 3500000000n, 'COLLECTOR_DEADLINE');
}
function decimal(n) {
  check(typeof n === 'bigint' && n >= 0n && n <= U64, 'INVALID_INTEGER');
  return n.toString(10);
}
function text(s, cap) {
  check(typeof s === 'string' && s.length > 0 && s.length <= cap && /^[\x20-\x7e]+$/.test(s), 'INVALID_TEXT');
  return s;
}
function observe(kind, limit, action) {
  clock(); check(counts[kind] < limit, 'OPERATION_LIMIT'); counts[kind]++;
  try { return action(); } finally { clock(); }
}
function collect() {
  const out = {...BASE, status:'STOP', reason:'COLLECTOR_STOP', reader:null,
    targets:PATHS.map((path,i) => ({path, kind:i<6?'DIRECTORY':'FILE', status:'NOT_OBSERVED', metadata:null})),
    filesystems:{W:null,M:null}, operations:counts};
  try {
    check(typeof fs.statfsSync === 'function' && typeof process.geteuid === 'function', 'UNSUPPORTED_API');
    const uid = observe('euid',1,() => process.geteuid());
    check(Number.isSafeInteger(uid) && uid >= 0, 'INVALID_INTEGER');
    out.reader = {effectiveUid:decimal(BigInt(uid)), execPath:text(process.execPath,512),
      version:text(process.version,64), platform:text(process.platform,32), arch:text(process.arch,32),
      release:text(observe('release',1,() => os.release()),256)};
    for (let i=0; i<PATHS.length; i++) {
      const r=out.targets[i]; let st;
      try { st=observe('lstat',11,() => fs.lstatSync(PATHS[i],{bigint:true})); }
      catch (e) {
        if (!(e instanceof Halt) && e?.code === 'ENOENT') {
          r.status='MISSING'; throw new Halt('TARGET_MISSING','MISSING_PARTIAL');
        }
        r.status='ERROR'; throw e;
      }
      r.metadata={mode:decimal(st.mode),uid:decimal(st.uid),gid:decimal(st.gid),
        size:decimal(st.size),dev:decimal(st.dev),ino:decimal(st.ino)};
      if (st.isSymbolicLink()) {
        r.status='SYMLINK_UNRESOLVED'; throw new Halt('TARGET_SYMLINK','SYMLINK_UNRESOLVED');
      }
      if (!(i<6 ? st.isDirectory() : st.isFile())) {
        r.status='ERROR'; throw new Halt('TYPE_MISMATCH');
      }
      r.status='OBSERVED_CANDIDATE';
      if (i===2 || i===3) {
        const s=observe('statfs',2,() => fs.statfsSync(PATHS[i],{bigint:true}));
        const summary={type:decimal(s.type),bsize:decimal(s.bsize),blocks:decimal(s.blocks),
          bfree:decimal(s.bfree),bavail:decimal(s.bavail),files:decimal(s.files),ffree:decimal(s.ffree),
          availableBytes:decimal(s.bsize*s.bavail),readOnlyIndicator:null,readOnlyStatus:'API_NOT_AVAILABLE'};
        out.filesystems[i===2?'W':'M']=summary;
      }
    }
    out.status='OBSERVED_CANDIDATE'; out.reason='FIXED_METADATA_OBSERVED'; clock();
  } catch (e) {
    out.status=e instanceof Halt?e.status:'STOP';
    out.reason=e instanceof Halt?e.reason:'OBSERVATION_ERROR';
  }
  return out;
}
function output() {
  const out=collect(); clock();
  let payload=Buffer.from(JSON.stringify(out)+'\n','ascii'); clock();
  payload=Buffer.from(JSON.stringify(out)+'\n','ascii');
  check(payload.length<=32768 && /^[\x20-\x7e]*\n$/.test(payload.toString('ascii')), 'OUTPUT_LIMIT');
  return [payload,out.status==='OBSERVED_CANDIDATE'?0:out.status==='STOP'?3:2];
}
let payload, code=3;
try { [payload,code]=output(); }
catch { payload=Buffer.from(JSON.stringify(FALLBACK)+'\n','ascii'); }
try { if (fs.writeSync(1,payload)!==payload.length) code=3; } catch { code=3; }
process.exitCode=code;
```
<!-- END F9 CURRENT PREREQS COLLECTOR NODE V1 -->

One buffered ASCII JSON/LF output, at most32768 bytes inclusive; no console logs or diagnostic stderr.
Encoding/deadline failures use fixed STOP; short/error writes remain exit3 with no retry.
The outer parent must reject partial/absent output rather than treating exit3 as a complete observation.

## 4. Controller — inert .mjs body

Future fresh path: `/tmp/opencode/f9-current-prereqs-controller-01.mjs`.
The observation pair remains **two Node invocations**; §6 adds one administrative invocation, totaling three, without a grant.
`/usr/local/bin/node` is an old repository candidate, not verified current identity or available runtime.
No installation, version probe, flags fallback or alternative interpreter is permitted.
Exactly one spawn attempt uses the literal child argv below, env={}, cwd=W, shell=false and ignore/pipe/pipe.
The empty environments exclude inherited NODE_OPTIONS; no runtime flags are proposed.
Stdout retention is below32768 bytes; stderr retention is zero, within4096; any nonempty stderr means STOP.
Reject stdout reaching32768 before retention; accepted collector output is at most32767 bytes.
Guard processing at64 combined data chunks and256 stream events; check counts/bytes before retaining or concatenating.
These application-retention limits do not bound Node's native stream buffers or startup allocations.
Variable stream fragmentation can cause conservative STOP; these are not exact native-call counts.
The controller emits at most32768 bytes including LF, with a small fixed STOP fallback.

<!-- BEGIN F9 CURRENT PREREQS CONTROLLER NODE V1 -->
```mjs
import fs from 'node:fs';
import {spawn} from 'node:child_process';
const START=process.hrtime.bigint(), U64=(1n<<64n)-1n;
const W='/tmp/opencode/f9-bootstrap-correspondence', M='/tmp/opencode/f9-host-rust-1.95.0-m2';
const PATHS=['/tmp','/tmp/opencode',W,M,M+'/cargo',M+'/cargo/bin',M+'/cargo/bin/rustup',
  M+'/cargo/bin/rustc',M+'/cargo/bin/cargo',M+'/cargo/bin/rustfmt',M+'/cargo/bin/clippy-driver'];
const BASE={protocol:'F9_CURRENT_PREREQS_NODE_V1',phase:'ORDINARY_HOST_PREFLIGHT_ONLY',
  realm:'CURRENT_AGENT_SANDBOX_ONLY',snapshotCandidate:null,captureRootCandidate:null,
  lArtifact:null,nativeAuthority:false,trainingReady:false};
const STOP=Buffer.from(JSON.stringify({...BASE,status:'STOP',reason:'CONTROLLER_STOP'})+'\n','ascii');
const EXIT=new Map([['OBSERVED_CANDIDATE',0],['MISSING_PARTIAL',2],['SYMLINK_UNRESOLVED',2],['STOP',3]]);
const REASONS=new Set(['FIXED_METADATA_OBSERVED','TARGET_MISSING','TARGET_SYMLINK','COLLECTOR_STOP',
  'CLOCK_LIMIT','COLLECTOR_DEADLINE','INVALID_INTEGER','INVALID_TEXT','OPERATION_LIMIT',
  'UNSUPPORTED_API','TYPE_MISMATCH','OBSERVATION_ERROR','OUTPUT_LIMIT']);
function need(ok) { if (!ok) throw new Error(); }
function keys(v, expected) {
  need(v!==null && typeof v==='object' && !Array.isArray(v));
  const actual=Object.getOwnPropertyNames(v); need(actual.length===expected.length);
  for (const k of expected) need(Object.hasOwn(v,k));
}
function dec(v) { need(typeof v==='string' && /^(0|[1-9][0-9]{0,19})$/.test(v)); need(BigInt(v)<=U64); }
function txt(v,n) { need(typeof v==='string' && v.length>0 && v.length<=n && /^[\x20-\x7e]+$/.test(v)); }
function validate(raw,code) {
  need(raw.length>0 && raw.length<32768 && raw[raw.length-1]===10);
  for (let i=0;i<raw.length-1;i++) need(raw[i]>=32 && raw[i]<=126);
  const v=JSON.parse(raw.toString('ascii')), common=Object.keys(BASE).concat(['status','reason']);
  need(v!==null && typeof v==='object');
  for (const k of Object.keys(BASE)) need(Object.hasOwn(v,k) && v[k]===BASE[k]);
  need(EXIT.has(v.status) && EXIT.get(v.status)===code && REASONS.has(v.reason));
  if (v.reason==='COLLECTOR_STOP') { keys(v,common); need(code===3); return; }
  keys(v,common.concat(['reader','targets','filesystems','operations']));
  const expected=new Map([['OBSERVED_CANDIDATE','FIXED_METADATA_OBSERVED'],
    ['MISSING_PARTIAL','TARGET_MISSING'],['SYMLINK_UNRESOLVED','TARGET_SYMLINK']]);
  need(v.status==='STOP' ? !new Set(expected.values()).has(v.reason) : v.reason===expected.get(v.status));
  if (v.reader!==null) {
    keys(v.reader,['effectiveUid','execPath','version','platform','arch','release']); dec(v.reader.effectiveUid);
    for (const [k,n] of [['execPath',512],['version',64],['platform',32],['arch',32],['release',256]]) txt(v.reader[k],n);
  }
  need(Array.isArray(v.targets) && v.targets.length===11);
  let cut=-1;
  for (let i=0;i<11;i++) {
    const r=v.targets[i]; keys(r,['path','kind','status','metadata']);
    need(r.path===PATHS[i] && r.kind===(i<6?'DIRECTORY':'FILE'));
    need(['NOT_OBSERVED','OBSERVED_CANDIDATE','MISSING','SYMLINK_UNRESOLVED','ERROR'].includes(r.status));
    if (cut!==-1) need(r.status==='NOT_OBSERVED');
    if (r.status!=='OBSERVED_CANDIDATE' && cut===-1) cut=i;
    if (r.metadata!==null) {
      keys(r.metadata,['mode','uid','gid','size','dev','ino']);
      for (const k of Object.keys(r.metadata)) dec(r.metadata[k]);
      const type=BigInt(r.metadata.mode)&61440n;
      if (r.status==='OBSERVED_CANDIDATE') need(type===(i<6?16384n:32768n));
      if (r.status==='SYMLINK_UNRESOLVED') need(type===40960n);
    }
    if (['NOT_OBSERVED','MISSING'].includes(r.status)) need(r.metadata===null);
    if (['OBSERVED_CANDIDATE','SYMLINK_UNRESOLVED'].includes(r.status)) need(r.metadata!==null);
  }
  keys(v.filesystems,['W','M']);
  for (const k of ['W','M']) if (v.filesystems[k]!==null) {
    const s=v.filesystems[k]; keys(s,['type','bsize','blocks','bfree','bavail','files','ffree',
      'availableBytes','readOnlyIndicator','readOnlyStatus']);
    for (const f of ['type','bsize','blocks','bfree','bavail','files','ffree','availableBytes']) dec(s[f]);
    need(s.readOnlyIndicator===null && s.readOnlyStatus==='API_NOT_AVAILABLE');
    need(BigInt(s.availableBytes)===BigInt(s.bsize)*BigInt(s.bavail));
  }
  const limits={lstat:11,statfs:2,euid:1,release:1,clock:64}; keys(v.operations,Object.keys(limits));
  for (const k of Object.keys(limits)) need(Number.isSafeInteger(v.operations[k]) && v.operations[k]>=0 && v.operations[k]<=limits[k]);
  if (v.status==='OBSERVED_CANDIDATE') {
    need(cut===-1 && v.reader!==null && v.filesystems.W!==null && v.filesystems.M!==null);
    for (const k of ['lstat','statfs','euid','release']) need(v.operations[k]===limits[k]);
  } else if (v.status!=='STOP') {
    need(cut>=0 && v.operations.lstat===cut+1);
    need(v.targets[cut].status===(v.status==='MISSING_PARTIAL'?'MISSING':'SYMLINK_UNRESOLVED'));
  }
}
let child, alive=false, exited=false, closed=false, killed=false, stopped=false, done=false;
let stdoutEnd=false, stderrEnd=false, bytes=0, stderrBytes=0, chunks=[], dataCount=0, events=0;
let deadline, cleanup;
function left(ms) { return Math.max(0,ms-Number(process.hrtime.bigint()-START)/1e6); }
function finish(raw=STOP,code=3) {
  if (done) return; done=true; clearTimeout(deadline); clearTimeout(cleanup);
  if (raw.length>32768) { raw=STOP; code=3; }
  try { if (fs.writeSync(1,raw)!==raw.length) code=3; } catch { code=3; }
  process.exit(code);
}
function killLive() {
  if (child && alive && !exited && !closed && child.exitCode===null && child.signalCode===null && !killed) {
    killed=true; try { child.kill('SIGKILL'); } catch {}
  }
}
function fail() {
  if (done) return;
  if (!stopped) {
    stopped=true; chunks=[]; clearTimeout(deadline);
    cleanup=setTimeout(() => finish(),Math.min(400,left(4200)));
    for (const s of [child?.stdout,child?.stderr]) { try { s?.destroy(); } catch {} }
  }
  killLive(); if (closed) finish();
}
function event() {
  if (done || stopped) return false;
  if (events>=256 || left(3800)===0) { fail(); return false; }
  events++; return true;
}
try {
  need(left(3800)>0);
  deadline=setTimeout(fail,left(3800));
  child=spawn('/usr/local/bin/node',['/tmp/opencode/f9-current-prereqs-reader-01.mjs'],
    {env:{},cwd:W,stdio:['ignore','pipe','pipe'],shell:false});
  child.on('spawn',() => { alive=true; if (stopped) killLive(); });
  child.on('exit',() => { exited=true; alive=false; });
  child.on('error',fail);
  for (const [stream,isErr] of [[child.stdout,false],[child.stderr,true]]) {
    stream.on('data',chunk => {
      if (!event()) return;
      if (dataCount>=64 || !Buffer.isBuffer(chunk)) { fail(); return; } dataCount++;
      if (isErr) {
        if (chunk.length>4096-stderrBytes) { fail(); return; }
        stderrBytes+=chunk.length; if (chunk.length) fail(); return;
      }
      if (chunk.length>=32768-bytes || chunks.length>=64) { fail(); return; }
      bytes+=chunk.length; chunks.push(chunk);
    });
    stream.on('end',() => { if (event()) { if (isErr) stderrEnd=true; else stdoutEnd=true; } });
    stream.on('error',() => { event(); fail(); });
    stream.on('close',() => { event(); });
  }
  child.on('close',(code,signal) => {
    closed=true; alive=false;
    if (stopped) { finish(); return; }
    try {
      need(left(3800)>0 && exited && stdoutEnd && stderrEnd && signal===null && stderrBytes===0);
      need(dataCount<=64 && chunks.length<=64 && bytes<32768);
      const raw=Buffer.concat(chunks,bytes); validate(raw,code); need(left(3800)>0);
      finish(raw,code);
    } catch { fail(); }
  });
} catch { fail(); }
```
<!-- END F9 CURRENT PREREQS CONTROLLER NODE V1 -->

The controller requires native exit/status agreement plus both EOFs and ChildProcess `close`; `exit` alone never suffices.
Failure is absorbing; deadline failure requests one direct-child kill if still live and awaits close within cleanup bounds.
Cleanup expiry emits STOP, not successful cleanup evidence; timers cannot guarantee kernel termination.
JSON.parse does not reject duplicate keys; this validates the frozen controlled emitter under ordinary-host trust.
Closed own-key checks and Maps avoid prototype merging; this is not a general adversarial graph/parser proof.
Malicious interpreter output/descendants and arbitrary parser depth lie outside this declared runtime trust model.

## 5. Entry and selected trusted-residual capture design

The future parent must supply Bash cwd=W; no new on-disk parent driver is proposed.
<!-- BEGIN F9 CURRENT PREREQS ENTRY NODE V1 -->
```bash
exec -c /usr/local/bin/node /tmp/opencode/f9-current-prereqs-controller-01.mjs
```
<!-- END F9 CURRENT PREREQS ENTRY NODE V1 -->

The human selected `Trusted residual (Recommended)` through the TUI for this current ordinary-metadata packet.
`CAPTURE_BOUNDARY=TRUSTED_RESIDUAL` accepts the design only, not execution, control creation or observation.
External bounded launcher and defer were unselected alternatives, not fallbacks or implied permissions.
Controller body output remains bounded; controller PRE-BODY startup stdout/stderr and effects remain outside its hard caps.
Administrative interpreter/import/PRE-BODY startup likewise remains trusted ordinary-tooling residual, not hard-bounded capture.
Collector startup occurs inside the controller's child-stream handling, but native buffers/allocations remain ordinary-host residuals.
Exact approval must distinguish administration startup/output, controller startup/output, and collector startup/output scopes.
Tool automatic truncation supplies no byte-cap substitute; no hard kernel deadline or malicious-runtime containment is claimed.
This choice grants no helper creation, process group, launcher execution or security-posture change; future grant remains NONE.

## 6. Future materialization, identity gate and exact permission packet

The following inert administrator materializes/verifies only the two fresh controls, only AFTER exact whole-packet approval.
Its closed owner rule is the current administrative effective UID, obtained exactly once and bounded to [0,U32].
The human must approve that policy, not an invented numeric UID; no current UID or foreign-data identity is asserted.
The sole argument is an externally registered whole-proposal SHA-256; the administrator source has its own registration.
One authenticated document snapshot supplies all three old bodies in memory before either exclusive creation attempt.

<!-- BEGIN F9 CURRENT PREREQS ADMINISTRATOR NODE V1 -->
```mjs
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const START=process.hrtime.bigint();
const DOC='/tmp/opencode/f9-bootstrap-correspondence/_spec/_plans/native-ingress-current-prerequisites.md';
const SPECS=[['COLLECTOR','/tmp/opencode/f9-current-prereqs-reader-01.mjs',4473,
  '76a77fe9c9a2276c8a3759f845fcca08b185cde71a9c0187532125d553a739b2'],
  ['CONTROLLER','/tmp/opencode/f9-current-prereqs-controller-01.mjs',7630,
  '1e5cc1f1ba0707c86211ef340a5f4d2f81909f0dd721dc34e39c4cd3374ad6d9']];
const ENTRY='exec -c /usr/local/bin/node /tmp/opencode/f9-current-prereqs-controller-01.mjs\n';
const KEYS=['dev','ino','mode','uid','gid','nlink','size','mtimeNs','ctimeNs'];
const SECURITY=['dev','ino','mode','uid','gid','nlink'];
const LIMIT={fstat:10,read:6,write:2,euid:1};
const counts={open:0,fstat:0,read:0,write:0,close:0,euid:0,clock:1};
function need(ok) { if (!ok) throw new Error(); }
function tick() {
  need(counts.clock<128); counts.clock++;
  need(process.hrtime.bigint()-START<3500000000n);
}
function call(kind,action) {
  tick(); need(counts[kind]<LIMIT[kind]); counts[kind]++;
  try { return action(); } finally { tick(); }
}
function withOpen(path,flags,action) {
  tick(); need(counts.open<5); counts.open++;
  const fd=fs.openSync(path,flags,0o600);
  try { tick(); return action(fd); }
  finally { counts.close++; try { fs.closeSync(fd); } finally { tick(); } }
}
function stat(fd) { return call('fstat',()=>fs.fstatSync(fd,{bigint:true})); }
function same(a,b,keys=KEYS) { need(keys.every(k=>typeof a[k]==='bigint' && a[k]===b[k])); }
function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function readExact(fd,n) {
  const bytes=Buffer.alloc(n), extra=Buffer.alloc(1);
  need(call('read',()=>fs.readSync(fd,bytes,0,n,0))===n);
  need(call('read',()=>fs.readSync(fd,extra,0,1,n))===0);
  return bytes;
}
function extract(text,label,language) {
  const marker=side=>['<!-- ',side,' F9 CURRENT PREREQS ',label,' NODE V1 -->'].join('');
  const begin=marker('BEGIN'), end=marker('END');
  need(text.indexOf(begin)>=0 && text.indexOf(begin)===text.lastIndexOf(begin));
  need(text.indexOf(end)>=0 && text.indexOf(end)===text.lastIndexOf(end));
  const head='\n'+begin+'\n```'+language+'\n', tail='```\n'+end+'\n';
  const start=text.indexOf(head); need(start>=0 && text.indexOf(begin)===start+1);
  const from=start+head.length, to=text.indexOf(tail,from);
  need(to>from && text.indexOf(end)===to+4);
  const body=text.slice(from,to); need(body.endsWith('\n') && /^[\x0a\x20-\x7e]+$/.test(body));
  return Buffer.from(body,'ascii');
}
function owned(s,uid,n) {
  need(s.isFile() && s.uid===uid && (s.mode&0o7777n)===0o600n && s.nlink===1n && s.size===BigInt(n));
}
function prepare() {
  need(process.argv.length===2 && /^[0-9a-f]{64}$/.test(process.argv[1]));
  const C=fs.constants;
  for (const k of ['O_RDONLY','O_WRONLY','O_CREAT','O_EXCL','O_NOFOLLOW','O_NONBLOCK'])
    need(Number.isSafeInteger(C[k]) && (k==='O_RDONLY' ? C[k]===0 : C[k]>0));
  need(typeof process.geteuid==='function');
  const uidNumber=call('euid',()=>process.geteuid());
  need(Number.isSafeInteger(uidNumber) && uidNumber>=0 && uidNumber<=4294967295);
  const uid=BigInt(uidNumber), rd=C.O_RDONLY|C.O_NOFOLLOW|C.O_NONBLOCK;
  const wr=C.O_WRONLY|C.O_CREAT|C.O_EXCL|C.O_NOFOLLOW|C.O_NONBLOCK;
  const document=withOpen(DOC,rd,fd=>{
    const before=stat(fd); need(before.isFile() && before.size>0n && before.size<=65536n);
    const bytes=readExact(fd,Number(before.size)); same(before,stat(fd));
    need(hash(bytes)===process.argv[1]);
    const text=bytes.toString('utf8'); need(Buffer.from(text,'utf8').equals(bytes)); return text;
  });
  const bodies=SPECS.map(([label,,n,digest])=>{
    const bytes=extract(document,label,'mjs'); need(bytes.length===n && hash(bytes)===digest); return bytes;
  });
  const entry=extract(document,'ENTRY','bash');
  need(entry.length===79 && entry.equals(Buffer.from(ENTRY,'ascii')) &&
    hash(entry)==='09da4e47c00946cccf1b14132d5ba65655fd2010e5d445a2d913c3f52cba79c1');
  tick();
  const saved=SPECS.map(([,path,n],i)=>withOpen(path,wr,fd=>{
    const born=stat(fd); owned(born,uid,0);
    need(call('write',()=>fs.writeSync(fd,bodies[i],0,n,0))===n);
    const after=stat(fd); owned(after,uid,n); same(born,after,SECURITY); return after;
  }));
  SPECS.forEach(([,path,n,digest],i)=>withOpen(path,rd,fd=>{
    const before=stat(fd); owned(before,uid,n); same(saved[i],before);
    const bytes=readExact(fd,n); need(hash(bytes)===digest && bytes.equals(bodies[i]));
    same(before,stat(fd));
  }));
  need(counts.open===5 && counts.close===5);
  for (const k of Object.keys(LIMIT)) need(counts[k]===LIMIT[k]);
}
let result='F9_PREPARE_NODE_V1_STOP\n', code=3;
try { prepare(); tick(); result='F9_PREPARE_NODE_V1_OK\n'; code=0; } catch {}
const payload=Buffer.from(result,'ascii');
try { if (fs.writeSync(1,payload)!==payload.length) code=3; } catch { code=3; }
process.exitCode=code;
```
<!-- END F9 CURRENT PREREQS ADMINISTRATOR NODE V1 -->

The administrator is registered literal Node `--eval` source, not another created control or an unauthenticated document extraction.
The separate preparation entry is supplied as the exact literal Bash `-c` argument, never a new on-disk script:
<!-- BEGIN F9 CURRENT PREREQS PREPARATION ENTRY NODE V1 -->
```bash
if (( $# != 2 )); then exit 3; fi
exec -c /usr/local/bin/node --input-type=module --eval "$1" "$2"
```
<!-- END F9 CURRENT PREREQS PREPARATION ENTRY NODE V1 -->

Exact preparation argv: `["/bin/bash","-c",PREPARATION_ENTRY,"admin-proposal",ADMINISTRATOR,PROPOSAL_SHA256]`, env={}, cwd=W.
`PREPARATION_ENTRY` means its registered literal body; `PROPOSAL_SHA256` means the external whole-document digest.
The parent passes the independently registered literal ADMINISTRATOR body as one argument, without source commands,
document extraction, shell evaluation of that body or body duplication here; no other argument or UID parameter is allowed.
The outer tool-shell command uses its Bash builtin `exec -c` to start the specified `/bin/bash` with an empty environment.
The source argument uses single-quote shell encoding with each embedded apostrophe escaped; no heredoc, here-string, pipeline or process substitution is used.
No shell temporary file supplies the administrative source; argument-length/runtime-option errors mean STOP without alternate transport.
The parent constructs and externally registers the full literal command, including the final proposal digest, before seeking approval.
The existing tool shell's own startup is trusted tooling, not a newly claimed bounded environment or Native execution proof.
No runtime identity/availability for Bash or Node is verified or granted by spelling these candidates.

| Administrative source operation | Maximum / successful complete path |
|---|---|
| Opens / fstats / file reads / file writes / closes | 5 /10 /6 /2 /5; 28 explicit filesystem calls |
| Proposal snapshot | 1 nofollow nonblocking read-only open, 2 fstats, one size-bounded read plus one EOF probe |
| Two exclusive fresh controls | 2 write-only opens, 4 fstats, 2 positional whole-body writes, 2 closes |
| Immediate control verification | 2 read-only opens, 4 fstats, 4 reads including two EOF probes, 2 closes |
| Requested file-read bytes / control payload writes | At most77642 /12103 bytes; no short-I/O retries |
| Administrative effective UID / hrtime samples | 1 /at most128, including initial sample; cooperative3500ms body deadline |
| Stdout / stderr from authored body | 1 fixed write, at most128 bytes /none deliberately written |
| Target observations / children | 0 /0; §1's13 target queries belong only to the separate collector |

Node-internal startup opens are not counted as source filesystem calls; the requested outer5000ms timeout is not hard containment.
Every successful open immediately enters try/finally; close is attempted exactly once even after deadline/counter failure.
Close errors mean STOP; cleanup closes owned FDs only, never deletes, repairs, reuses or retries controls.
Existing names stop at exclusive creation without reading them; partial creations/writes remain preserved on failure.
Mode0600 must survive umask exactly; regular type, current administrative UID and link count1 are mandatory.
Write-only creation FDs are not read; verification uses fresh read-only descriptors and exact bytes plus registered hashes.
The snapshot compares dev/ino/mode/uid/gid/nlink/size/mtimeNs/ctimeNs before/after reading; no directory/root stat occurs.
Creation preserves born dev/ino/mode/uid/gid/nlink; immediate verification also matches saved size/mtimeNs/ctimeNs.
The authenticated document is read once; later mutations cannot alter the chosen in-memory bodies, so no second extraction occurs.
Control verification followed by interpreter pathname loads is NOT atomic; trusted ancestors/stable pathnames remain required.
No installed interpreter read/hash, target open, logfile, receipt, disk sink or old control access is proposed.
Success requires native exit0, exact `F9_PREPARE_NODE_V1_OK\n`, empty stderr, both output EOFs and process closure.
Short/error stdout writes cause exit3 without fallback append/retry; PRE-BODY runtime stderr remains trusted and uncapped.
Anything else is absorbing STOP; a future consumed administrative attempt grants no observation entry after failure.
Even preparation success requires separate approved observation entry; nothing in this document currently grants either step.

Exact future approval must include these scopes separately, not inherit an older grant:
- `administration`: registered literal eval source/entry/argv, one effective UID, one proposal snapshot, two fresh controls and six bounded reads.
- `administration_startup_output`: trusted PRE-BODY residual; fixed body stdout above, no authored stderr, EOF/closure gate.
- `controller_startup_output`: trusted PRE-BODY residual, bounded body output and declared cleanup in §4.
- `collector_startup_output`: controller stream limits, collector body limits and native-buffer residuals in §§2–4.
- `three_total_node_invocations`: administrator without children/targets, then the unchanged controller-plus-collector pair.
- `metadata_targets`, `filesystem_summaries`, `reader_metadata`: only §1's11 paths, W/M summaries and §2's reader fields.
- `capture_boundary`: selected trusted-residual DESIGN ONLY; exact transport, caps, cleanup and owner policy still need approval.
No older grant/source-root exception establishes native proof or compensates DIRECT accounting; root budgets remain unchanged.
No Rust build, dependency, target execution, installation, proc/daemon access, training, L artifact or capture-root grant follows.

## 7. Registration and handoff

| Item | State |
|---|---|
| Collector bytes / LF lines / digest | 4473 UTF-8 bytes /87 LF lines; SHA-256 `76a77fe9c9a2276c8a3759f845fcca08b185cde71a9c0187532125d553a739b2`. |
| Controller bytes / LF lines / digest | 7630 UTF-8 bytes /137 LF lines; SHA-256 `1e5cc1f1ba0707c86211ef340a5f4d2f81909f0dd721dc34e39c4cd3374ad6d9`. |
| Entry bytes / LF lines / digest | 79 UTF-8 bytes /1 LF line; SHA-256 `09da4e47c00946cccf1b14132d5ba65655fd2010e5d445a2d913c3f52cba79c1`. |
| Whole-document identity | UNREGISTERED; parent record only |
| Administrator bytes / LF lines / digest | 4967 UTF-8 bytes /93 LF lines; SHA-256 `1c517bcd1c56cd1d7636c3c5062986975c636b9a8d775f35061f811a06f30bdb`. |
| Preparation entry bytes / LF lines / digest | 99 UTF-8 bytes /2 LF lines; SHA-256 `402d29021007c50a3fbf02fe303d4b022e003f93e97707af8d973da44cc0098c`. |
| Parent static syntax / identity checks | All three Node bodies passed stdin-only `--check`; both Bash entries passed stdin-only `bash -n`. Source bodies were NOT executed; no controls were materialized. Scoped preservation/transport checks and new review remain pending. |
| Materializer / immediate verifier / harness source | SUPPLIED INERT; source syntax checked; review and external exact transport registration PENDING |
| Human CAPTURE_BOUNDARY decision | Trusted residual selected for this current packet's DESIGN ONLY; external/defer unselected, not fallbacks |
| Exact packet approval | NONE |

Parent verification remains repository-only: extract unique Node V1 markers preserving terminal LF, check all three mjs bodies
with Node `--check` on stdin ONLY, check the preparation entry with Bash `-n`, and register source identities without body execution.
Register exact preparation eval-source/argv/output handling; keep the whole-document digest in an external parent record to avoid self-reference.
Inspect fixed targets, bigint/string conversions, output/counter guards, absorbing failures and direct-child cleanup statically.
Confirm historical protected bytes and old caps/laws remain unchanged; never hash installed targets for this step.
No commands, tests, hashes, agents, web requests, target observations or runtime execution were performed by this author.
**NOT READY TO EXECUTE:** parent source measurement, static syntax/review, exact registered eval transport and external proposal
identity remain pending; the selected capture design is not final whole-packet approval, which remains NONE.

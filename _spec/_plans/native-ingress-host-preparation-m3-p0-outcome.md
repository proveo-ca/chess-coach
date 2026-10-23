# F9 M3-P0 — metadata candidate, one-shot grant consumed

**[Unverified] 2026-10-23 · SUPPLIED EXECUTION RECORD / DATA ONLY / NOT INSTALLED / GRANT CONSUMED / trainingReady:false.**

## 1. Provenance and frozen approval bindings

This document persists the parent's supplied execution record; the keeper performed repository reads/patches only.
It is not a new independent runtime receipt, source qualification, Native proof or whole-host prerequisite completion.
Parent supplies HEAD `b2c482f6160ad84dc0f16fea9b1d25a3094c9bc0`, branch `docs/f9-private-initializer`, PR50 OPEN/pushed/clean before this operation.
The keeper did not verify Git state, external artifacts, hashes, tests, controls or runtime observations.

| Binding | Supplied identity / scope |
|---|---|
| Fresh actual TUI selection | `Approve P0 once (Recommended)`; one attempt only. |
| Frozen whole [M3 proposal](native-ingress-host-preparation-m3.md) SHA-256 | `fdb740d94663bb5f97031b54362c0019af96428383b43d08f2f845362c480d37` |
| Exact command SHA-256 | `602583c6cc7c583ccd069c3b5956f776e3df701bc815ef01881cd19277327416` |
| P0 source SHA-256 / bytes / LF lines | `dd1e204d6ff9d6377cb630abb5fc2380f2c82dcb1068adb5beaa5bee4a3badec` /5158 /100 |
| External registration paths, not accessed here | `/tmp/opencode/f9-m3-p0-01.command.txt`, `/tmp/opencode/f9-m3-p0-01.approval.json`, `/tmp/opencode/f9-m3-p0-01.checks.json`, `/tmp/opencode/f9-m3-p0-01.review.txt` |
| Exact scope | One Node literal-eval invocation, empty environment, cwd `/tmp/opencode/f9-bootstrap-correspondence`, requested tool timeout5000ms. |

Executor explicitly accepted THIS packet's ordinary startup, pre-clock setup, pathname, cooperative-time and tool-output-capture residuals.
The body imports only `node:fs` and `node:os`; its3500ms cooperative interval begins at the first tick, not setup/imports.
That acceptance grants neither installation nor payload acquisition and renews no Node01/M2 permission.
The frozen proposal's preapproval/not-executed labels remain historical for this completed single attempt only; its whole artifact stays unchanged.

## 2. Supplied tool observation and source-profile limits

Parent reports exactly one execution of the frozen command through `functions.shell`, returning normal tool completion and the JSON below.
The tool printed no explicit native exit-status line; no stderr or timeout was reported.
The registered source sets exit0 only after all candidate checks, a complete stdout write AND the final tick.
Normal tool completion plus candidate JSON supplies no independent native exit, PID, clock, EOF or descriptor receipt.
Do not infer measured elapsed time, physical termination, provenance authentication or final-clock completion from the JSON alone.
Source-generated stdout was the sole explicit write; parent reports no file/root/control creation, network operation or additional program execution.
The observations use ordinary native filesystem metadata APIs; explicit source-call counts are not kernel-entry or implicit-I/O counts.

## 3. Exact copied stdout — one JSON line plus LF

This is source copied from the supplied terminal output, not a newly read or independently authenticated runtime receipt.
The raw line exceeds2000 characters; the summary below preserves navigation when a tool display truncates the line.

```json
{"schema":"M3_HOST_PREPARATION_PREFLIGHT_V1","phase":"HOST_PREPARATION_PREFLIGHT_ONLY","realm":"CURRENT_AGENT_SANDBOX_ONLY","status":"PREREQUISITES_CANDIDATE","reason":"FIXED_METADATA_OBSERVED","provenance":"DATA_ONLY","nativeAuthority":false,"trainingReady":false,"captureRootCandidate":null,"lArtifact":null,"snapshotCandidate":null,"readOnlyIndicator":null,"readOnlyStatus":"API_NOT_AVAILABLE","runtime":{"euid":"1000","release":"7.0.12","execPath":"/usr/local/bin/node","version":"v22.23.2","platform":"linux","arch":"x64"},"targets":[{"path":"/tmp","expected":"DIR","state":"OBSERVED","metadata":{"dev":"28","ino":"77","mode":"17407","nlink":"1","uid":"0","gid":"0","rdev":"0","size":"4096","blksize":"4096","blocks":"8"}},{"path":"/tmp/opencode","expected":"DIR","state":"OBSERVED","metadata":{"dev":"28","ino":"725","mode":"16877","nlink":"3","uid":"1000","gid":"1000","rdev":"0","size":"4096","blksize":"4096","blocks":"8"}},{"path":"/usr","expected":"DIR","state":"OBSERVED","metadata":{"dev":"28","ino":"20","mode":"16877","nlink":"1","uid":"0","gid":"0","rdev":"0","size":"4096","blksize":"4096","blocks":"16"}},{"path":"/usr/local","expected":"DIR","state":"OBSERVED","metadata":{"dev":"28","ino":"21","mode":"16877","nlink":"1","uid":"0","gid":"0","rdev":"0","size":"4096","blksize":"4096","blocks":"16"}},{"path":"/usr/local/bin","expected":"DIR","state":"OBSERVED","metadata":{"dev":"28","ino":"22","mode":"16877","nlink":"1","uid":"1001","gid":"1001","rdev":"0","size":"4096","blksize":"4096","blocks":"8"}},{"path":"/usr/local/bin/node","expected":"FILE","state":"OBSERVED","metadata":{"dev":"56","ino":"384","mode":"33261","nlink":"1","uid":"1001","gid":"1001","rdev":"0","size":"124836408","blksize":"4096","blocks":"243824"}},{"path":"/usr/local/bin/mise","expected":"FILE","state":"OBSERVED","metadata":{"dev":"61","ino":"640","mode":"33261","nlink":"1","uid":"0","gid":"0","rdev":"0","size":"119660224","blksize":"4096","blocks":"233712"}},{"path":"/tmp/opencode/f9-host-rust-1.95.0-m3","expected":"ABSENT","state":"ABSENT_CANDIDATE","metadata":null}],"filesystem":{"type":"2035054128","bsize":"4096","blocks":"5116564","bfree":"4480194","bavail":"4213954","files":"1310720","ffree":"1240058","availableBytes":"17260355584"},"callsAtSerialization":{"lstat":8,"statfs":1,"euid":1,"release":1,"clock":24}}
```

## 4. Derived summary — metadata candidates only

| Item | Copied observation | Boundary |
|---|---|---|
| Result | `PREREQUISITES_CANDIDATE` / `FIXED_METADATA_OBSERVED` / `DATA_ONLY` | Not PASS, INSTALLED, full host prerequisites or capture/readiness completion. |
| Directory targets | `/tmp`, `/tmp/opencode`, `/usr`, `/usr/local`, `/usr/local/bin`: OBSERVED | Source classified nonsymlink directories at those checks; no continuing pathname protection. |
| Node candidate | `/usr/local/bin/node`: dev56/ino384/mode33261/size124836408 | Nonsymlink regular-file candidate, not qualified executor, source-byte identity or CLI qualification. |
| Mise candidate | `/usr/local/bin/mise`: dev61/ino640/mode33261/size119660224 | Nonsymlink regular-file candidate, not actual mise version/help/exec/hash, backend or GNU-toolchain usability. |
| M3 destination | `/tmp/opencode/f9-host-rust-1.95.0-m3`: ABSENT_CANDIDATE/null metadata | ENOENT at the last lstat only; neither reserved nor safe forever. |
| Runtime data | euid1000; release7.0.12; Nodev22.23.2; linux/x64; execPath `/usr/local/bin/node` | Self/runtime data, not actual kernel/configuration, native loading or executable provenance proof. |
| Filesystem geometry | type2035054128; bsize4096; blocks5116564; bfree4480194; bavail4213954 | Point-time statfs indicators, not quota, writable protection or RSS/disk guarantees. |
| Filesystem capacity | files1310720; ffree1240058; availableBytes17260355584 | Above proposed8GiB/100000 indicators, not reservation, extraction or peak-coexistence admission. |
| Read-only indicator | null / `API_NOT_AVAILABLE` | No read-only mount/protection inference. |
| Source-call snapshot | lstat8/statfs1/euid1/release1/clock24 | `callsAtSerialization` only; source performs later clock checks, not final clock-read or kernel-call totals. |
| Authority/artifacts | nativeAuthorityfalse/trainingReadyfalse; captureRootCandidate/lArtifact/snapshotCandidate null | No native/capture/L/snapshot/training proof. |

## 5. Consumed scope and unchanged contracts

P0 EXECUTED ONCE; its one-shot grant is CONSUMED, without retry, fallback, reprobe or retained-control reread.
No old M2 root, proc, daemon, log or receipt query occurred in this supplied P0 record; Node01 controls remain untouched.
The whole approved M3 proposal and whole Node01 proposal (`fdfed77…`)/outcome remain unchanged, including failures, approvals and raw receipts.
Preserve all old M2/Node01 programs, arithmetic model, corpora/configuration caps, source470e540, accepted BAF3476/17 and bf38/D1/B1/O9.
Source Root B, the sole counter, original clocks and Native graph remain unchanged; host metadata resolves none of their open proofs.
Keep ONE BOTH-seat1048576 counter, unchanged F1/charged replay, no extra credit, cold10s/lifecycle300s including reserved3s and separate generator2048.
All five exclusions remain not established: full-training-closure, genuine-native-authority, whole-decision-adequacy, calibration, training-readiness.
Future installer creation must be exclusive at the proposed M3 root; any later collision means STOP, never reuse/repair/removal/alternate-root fallback.

## 6. Next genuine trust fork — unasked and unselected

Host-exception MODE selection did not choose a downstream acquisition branch; choose the design boundary BEFORE installer design.
The next TUI follows documentation publication and chooses DESIGN ONLY, not download or installation permission.

| Design-only proposal | Required meaning / residual |
|---|---|
| 1. Exact payload closure — architect/DevOps recommended | Register ALL payload URLs, exact byte lengths and hashes; stronger explicit byte-verification target, not publisher authentication or availability proof. |
| 2. New bounded rustup distribution-origin trust | Obtain NEW explicit residual acceptance; not full payload pins, a firewall or an exact allowlist, and no reuse of M2 scope. |
| 3. Defer installation | Leave acquisition/installation blocked; create no replacement root or fallback route. |

Resolving exact closure, even fetching a manifest, needs separate fresh access/network approval; documentation research grants no implicit webfetch.
A bounded mise-version/source follow-up packet may be designed separately, but resolves neither branch and permits no actual mise execution without fresh approval.
Installer source/identities/exact network-install exception remain absent; no acquisition or installation grant follows from this outcome.
Later F9 capture/build/runtime retain separately approved offline installed-byte allowlists and no-acquisition-fallback; no model work or readiness follows.
Navigation: [ownership §26](native-ingress-ownership.md#26-m3-p0-metadata-candidate--one-shot-grant-consumed), [implementation §25](native-ingress-implementation.md#25-m3-p0-complete--downstream-acquisition-undecided).
`trainingReady:false`.

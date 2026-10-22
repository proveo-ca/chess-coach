# F9 — current prerequisite attempt: partial metadata, grant consumed

**[Unverified] Supplied execution record / ORDINARY_HOST_PREFLIGHT_ONLY / MISSING_PARTIAL / STOP / trainingReady:false.**

This document persists the parent's reported human choices and terminal output; the keeper performed repository reads and documentation patches only.
It is not an independent native/runtime receipt, target remeasurement, source-closure attestation or new execution authorization.
The supplied pre-execution checkpoint is HEAD `76e489cd85491a436751c7b3db79f8b74a238868`, branch `docs/f9-private-initializer`, PR50 OPEN, pushed and clean; the keeper did not verify that checkpoint.

## 1. Approval artifact and one-shot scope

Executor selected `Trusted residual (Recommended)`, then answered the fresh exact one-shot question with `Approve once (Recommended)`.
That approval bound the whole [frozen proposal](native-ingress-current-prerequisites.md) SHA-256 `fdfed77ba7dbfb397100811bd040146f44d7d3ff76d78a7396e88d57af60d963` and administrative-command SHA-256 `a094b3de7cc5cfb3ac8d0f31dd3f29ffd95d2afadd613ad4cbe9fc6d82c0c0a5`.
Keep that entire proposal byte-for-byte unchanged as the approval artifact, including its historical pending-approval labels and §7 registration table.
This outcome supersedes those labels only for this one approved and completed attempt; it neither edits them nor grants another attempt.
[Proposal §7](native-ingress-current-prerequisites.md#7-registration-and-handoff) retains the administrator, preparation-entry, collector, controller and observation-entry source identities; no new source hashes are inferred here.

The supplied external approval/transport registry consists of these paths; this keeper did not open them:

- `/tmp/opencode/f9-node-prerequisites-trusted-02.command.txt`
- `/tmp/opencode/f9-node-prerequisites-trusted-02.approval.json`
- `/tmp/opencode/f9-node-prerequisites-trusted-02.checks.json`
- `/tmp/opencode/f9-node-prerequisites-trusted-02.review.txt`

Scope covered three Node invocations: administrator, then controller plus its collector, with empty environment and W cwd `/tmp/opencode/f9-bootstrap-correspondence`.
Both outer tool calls requested 5000ms; requested timeouts are not measured elapsed time or hard kernel termination guarantees.
The selected ordinary trusted startup, timing and pathname residuals do not relax any Native admission criterion.

## 2. Sequential execution record — once, not a native PASS

| Step | Supplied tool event | Evidence limit |
|---|---|---|
| 1. Preparation | `functions.shell` ran the exact frozen administrative command, W cwd, timeout5000; stdout was exactly `F9_PREPARE_NODE_V1_OK\n`. The tool returned normally and reported no stderr or timeout. | Ordinary tool completion plus the source's fixed OK profile; no independent exit receipt, PID, native-FD or clock record. |
| 2. Observation | `functions.shell` ran exactly `exec -c /usr/local/bin/node /tmp/opencode/f9-current-prereqs-controller-01.mjs\n`, W cwd, timeout5000; it returned the JSON below and explicitly reported `Exited with code 2`, with no stderr or timeout reported. | Copied terminal output, not independent native/runtime proof; the partial/nonzero result is STOP, not success. |

The administrative source selects code0 only after all verification gates pass; its fixed OK profile supports creation and immediate verification of both controls inside that invocation.
No outside reread, stat or hash followed execution; do not turn that source-profile statement into an independent native exit/EOF/FD proof.
No separate on-disk result, sink or receipt file was created by these runtime programs.

### Copied raw observation stdout

The following fence copies the exact supplied single JSON line; the source writes a terminal LF.

```json
{"protocol":"F9_CURRENT_PREREQS_NODE_V1","phase":"ORDINARY_HOST_PREFLIGHT_ONLY","realm":"CURRENT_AGENT_SANDBOX_ONLY","snapshotCandidate":null,"captureRootCandidate":null,"lArtifact":null,"nativeAuthority":false,"trainingReady":false,"status":"MISSING_PARTIAL","reason":"TARGET_MISSING","reader":{"effectiveUid":"1000","execPath":"/usr/local/bin/node","version":"v22.23.2","platform":"linux","arch":"x64","release":"7.0.12"},"targets":[{"path":"/tmp","kind":"DIRECTORY","status":"OBSERVED_CANDIDATE","metadata":{"mode":"17407","uid":"0","gid":"0","size":"4096","dev":"28","ino":"77"}},{"path":"/tmp/opencode","kind":"DIRECTORY","status":"OBSERVED_CANDIDATE","metadata":{"mode":"16877","uid":"1000","gid":"1000","size":"4096","dev":"28","ino":"725"}},{"path":"/tmp/opencode/f9-bootstrap-correspondence","kind":"DIRECTORY","status":"OBSERVED_CANDIDATE","metadata":{"mode":"16877","uid":"1000","gid":"1000","size":"4096","dev":"28","ino":"9783"}},{"path":"/tmp/opencode/f9-host-rust-1.95.0-m2","kind":"DIRECTORY","status":"MISSING","metadata":null},{"path":"/tmp/opencode/f9-host-rust-1.95.0-m2/cargo","kind":"DIRECTORY","status":"NOT_OBSERVED","metadata":null},{"path":"/tmp/opencode/f9-host-rust-1.95.0-m2/cargo/bin","kind":"DIRECTORY","status":"NOT_OBSERVED","metadata":null},{"path":"/tmp/opencode/f9-host-rust-1.95.0-m2/cargo/bin/rustup","kind":"FILE","status":"NOT_OBSERVED","metadata":null},{"path":"/tmp/opencode/f9-host-rust-1.95.0-m2/cargo/bin/rustc","kind":"FILE","status":"NOT_OBSERVED","metadata":null},{"path":"/tmp/opencode/f9-host-rust-1.95.0-m2/cargo/bin/cargo","kind":"FILE","status":"NOT_OBSERVED","metadata":null},{"path":"/tmp/opencode/f9-host-rust-1.95.0-m2/cargo/bin/rustfmt","kind":"FILE","status":"NOT_OBSERVED","metadata":null},{"path":"/tmp/opencode/f9-host-rust-1.95.0-m2/cargo/bin/clippy-driver","kind":"FILE","status":"NOT_OBSERVED","metadata":null}],"filesystems":{"W":{"type":"2035054128","bsize":"4096","blocks":"5116564","bfree":"4481608","bavail":"4215368","files":"1310720","ffree":"1240117","availableBytes":"17266147328","readOnlyIndicator":null,"readOnlyStatus":"API_NOT_AVAILABLE"},"M":null},"operations":{"lstat":4,"statfs":1,"euid":1,"release":1,"clock":17}}
```

## 3. Derived disposition — ordinary metadata only

| Reported field | Bounded interpretation |
|---|---|
| Three directory prefixes | `/tmp`, `/tmp/opencode` and W were `OBSERVED_CANDIDATE` in this execution. |
| Fourth lstat at M | The attempt reported ENOENT / `MISSING` at `/tmp/opencode/f9-host-rust-1.95.0-m2`; seven later targets remained `NOT_OBSERVED`. |
| W filesystem summary only | `availableBytes="17266147328"` is a space indicator, not quota availability or a reservation. `readOnlyIndicator=null` / `API_NOT_AVAILABLE` proves no read-only state or global immutability; M has no summary. |
| Operation echo | lstat4, statfs1, euid1, release1, clock17 are source-call DATA; maxima remain eleven lstat plus two statfs, not exact native kernel-entry counts. |
| Reader echo | UID1000, `/usr/local/bin/node`, v22.23.2, linux/x64, release7.0.12 describe this reader execution only; identity/source qualification and availability beyond it remain unproved. |
| Native/capture state | `snapshotCandidate=null`, `captureRootCandidate=null`, `lArtifact=null`, `nativeAuthority=false`, `trainingReady=false`; L remains unwritten. |

The missing candidate establishes no global absence, deletion, historical M2 invalidity or proved namespace difference.
It establishes no current-host relationship to C, the daemon, cohosting or a capture root.
No Rust binary was inspected or executed, and the Node version supplies no Rust-usability evidence.
Actual elapsed time, native RSS/CPU, cgroup/isolation, source closure, kernel configuration and exec flags remain unqualified.
Prior source/static syntax checks remain source/static evidence, not an actual Native positive or prerequisite PASS.

## 4. Consumed authority and retained controls

Both exact one-shot PREP and OBS permissions are CONSUMED, including the observation's exit2; no retry, fallback or probe elsewhere follows.
Preserve both retained controls without read, stat, hash, delete or execution absent a fresh grant:

- `/tmp/opencode/f9-current-prereqs-reader-01.mjs`
- `/tmp/opencode/f9-current-prereqs-controller-01.mjs`

No old installed roots, logs, receipts, proc or daemon controls were reopened or changed; this grant renews none of their consumed permissions.
No network, installation, capture, build or F9 runtime permission follows; this documentation changes no source, configuration, corpus, program, test, manifest, diagram or index.
Preserve the accepted BAF3476/17 body, bf38/D1/B1/O9, source `470e540`, ONE BOTH-seat1_048_576, unchanged F1/replay, cold10s/lifecycle300s including reserved3s cleanup and generator2048.
All five exclusions and Native qualification obligations remain; root B numeric/invoice/guard/source/clock gates stay OPEN.

## 5. Next context decision — not yet asked or selected

This failed current-context prerequisite justifies a context fork, not repetition of Fixed L, standard slots or the selected prerequisite direction.

| Option for the parent's later question | Boundary |
|---|---|
| A. Operator context handoff — architect recommended | Request intended host/root/spec from the human; this is no SSH, probe or connectivity grant, and does not automatically recreate anything. |
| B. Fresh current-namespace host-preparation proposal only | Requires a new exception, inputs, allowlist, offline closure and new exact approvals; choosing proposal work grants no installation or network permission. |
| C. Pause prerequisite observations | Retain source-only clock/domain work within its existing scope; no runtime access follows. |

No actual target host or new preparation mechanism is selected.
The parent will ask only after documentation checks, reviews and publication; this document records no answer in advance.
See [ownership §24](native-ingress-ownership.md#24-current-prerequisite-attempt--partial-metadata-and-consumed-grant) and [implementation §23](native-ingress-implementation.md#23-current-prerequisite-stop--host-context-remains-open) for the current continuation.

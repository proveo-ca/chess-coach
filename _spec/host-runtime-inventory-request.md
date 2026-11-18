# Host runtime metadata v2: implemented Rust Unix HTTP API

Status: RUST SOURCE AND LOCAL STATIC ARTIFACT PREPARATION VERIFIED / PREBUILT TASK IMPLEMENTED AND SOURCE REVIEWS ACCEPTED / NO APPROVED RUNNABLE HOST HANDOFF, HOST DEPLOYMENT, PUBLICATION, PROVISIONING OR TRAINING GRANT / `trainingReady:false`.

The architect accepted this source-only successor to the blocked Python CLI proposal.
The existing metadata-to-qualification boundary remains in [host-entrypoint.md](host-entrypoint.md) and its [diagram](host-entrypoint.puml).
Keep the received hardware/filesystem inventory and private provenance in their owning documents; this implementation selects no admitted execution target.

## Source and tooling boundary

The crate is `crates/host-facts`, package `chess-coach-host-facts`, with binary `host-docker-runtime-facts`, using Rust 1.95 and `#![forbid(unsafe_code)]`.
Use safe APIs from locked `rustix` 1.1.6 with `fs`, `net`, `event`, `process` and `time`; use `httparse` 1.10.1 and the already locked `serde`/`serde_json`, with `tempfile` for tests.
Its direct dependencies are separate from model/game dependencies; the standard offline host Cargo tree contains no Burn, learning or policy package.
The root workspace manifest and lock node include this development/control-plane member, not a selected application runtime binary.
Executor explicitly approved installing necessary development tooling inside the coding sandbox through `mise install`; the lead reports Rust 1.95 installed.
That sandbox-tooling grant does not install host tools, authorize host execution or permit implicit installation by the future metadata entrypoint.

The added Python Docker runtime profile/helpers, new test file and mise task have been removed.
The earlier Python preflight/contract/admission tasks remain intact; their restored 74-test baseline passes in the fresh Rust-slice receipt.
The earlier 74-test receipt predates the new mise options/task; a fresh 74-test post-handoff-configuration pass is now retained separately.
The old 97/98-test receipts are historical Python evidence, never Rust verification.

Executor selected `Static HTTPS artifact (Recommended)` for preparation only.
The Rust mise entry now adds `llvm-tools` and target `x86_64-unknown-linux-musl`; Rust remains 1.95.0 with the minimal profile, rustfmt and Clippy.
Both auto-install settings remain false, and the original three Python task bodies are unchanged.
The lead reports that the explicitly approved sandbox `mise install core:rust@1.95.0` installed the additional components and that rustup's component list confirms the tool/target names.
The unchanged reviewed Rust source retains its GNU-target 72-test acceptance; the prepared musl release separately passes the same 72 tests.
The handoff phase adds four persisted Bun task tests, passes the 26-test combined partition/task set and full TypeScript checking, and reruns the 74 Python tests; both targeted handoff-file reviews accept the source preparation.

## Socket identity spike — prove before HTTP

Require real UID, effective UID, real GID and effective GID all to equal numeric 1000 before any socket metadata or cgroup read.
The only endpoint candidates are `/run/docker.sock` and `/run/user/1000/docker.sock`; accept no override, environment-derived endpoint or alternate user path.
Open parents descriptor-relatively with `O_PATH | O_NOFOLLOW | O_DIRECTORY`.
Open the leaf with `O_PATH | O_NOFOLLOW`, check its socket kind using `fstat`, and retain its `OwnedFd`.
Exactly one safely pinned accessible socket and the other confirmed absent permits subsequent metadata requests.
Unsafe, inaccessible or wrong-kind components, two sockets, or neither socket block without fallback or contact.

Connect only through `/proc/self/fd/<owned-socket-fd>` for the retained leaf descriptor, never by reopening the original socket pathname.
That exact self-owned descriptor path permits no `/proc` tree or other-process inspection.
Retain the same leaf `OwnedFd` for both later connections.
Do not replace descriptor identity with path metadata, an inode string or a Docker executable hash.

The socket-first spike passes four tests in `src/socket.rs` using real temporary Unix listeners.
Leaf replacement, parent replacement and unlink/replacement cases reach the original pinned listener while the replacement receives nothing; the fourth test checks symlink/wrong-kind/absence refusal.
This proves the tested coding-sandbox socket behavior, not actual-host admission or deployment compatibility.
If the supported kernel/API cannot provide this behavior, retain the failed evidence and stop; do not switch to path-based connection or a CLI.

## Fixed HTTP exchange

After the socket proof, permit exactly two requests in order: `GET /version`, then `GET /info`.
Use separate nonblocking Unix connections through the same retained socket descriptor.
Each fixed HTTP/1.0 request contains only these headers, with ordinary CRLF framing:

```text
Host: localhost
Accept: application/json
Accept-Encoding: identity
Connection: close
```

Send no request body and accept no caller-controlled method, path, header or payload.
Perform no ping, Docker CLI execution, child process, plugin loading, API negotiation, redirect, retry or endpoint fallback.
The direct API avoids the rejected CLI plugin/help execution path; it is not proof of runtime qualification.

Each request captures its `CLOCK_BOOTTIME` origin and absolute 10-second end before timer creation.
Validate checked addition/time conversion and reject zero, expired or out-of-range setup before any connection.
After validation, create one `CLOCK_BOOTTIME` timerfd with `NONBLOCK | CLOEXEC` and arm it once using `TFD_TIMER_ABSTIME`, the captured end and a zero interval.
Every blocking wait for nonblocking connect/send/receive polls both the socket and this owned timer descriptor.
Timer expiry wins over simultaneous socket readiness; timer `ERR`, `HUP` or `NVAL` blocks rather than admitting socket progress.
Retain BOOTTIME checks before I/O, after poll and after parsing/projection; partial progress never renews the deadline.
Creation/arming failures return an initialized fixed-error receipt before connection, with zero response bytes and elapsed time measured from the original origin.
There is no relative-wait-only fallback, timer rearming or timer read in production.
Owned descriptors drop on every return path.

BOOTTIME timer expiry remains observable when execution resumes after suspend or delayed scheduling.
This backstop rejects expired work when the collector runs again; it cannot guarantee the socket closes at the exact deadline while execution is suspended or unscheduled.
Do not use `CLOCK_BOOTTIME_ALARM`, request wake capabilities or infer actual-host suspend/clock qualification from synthetic tests.

### Required deadline syscall surface

These are required owned-resource calls, not an installed seccomp policy or additional host-operation grant:

| Call / surface | Restriction |
|---|---|
| `clock_gettime(CLOCK_BOOTTIME)` | Original origin/end plus pre-I/O, post-poll and post-projection checks |
| `timerfd_create(CLOCK_BOOTTIME, TFD_NONBLOCK | TFD_CLOEXEC)` | One owned timer per valid request setup |
| `timerfd_settime(..., TFD_TIMER_ABSTIME, ...)` | One absolute arm at the original end; zero interval; no production rearm |
| `poll`/`ppoll` through rustix | Wait on the request's socket and timer together; expiry/error refuses socket progress |
| Owned-FD close/drop | All paths; no timer read is required |

The tests alone may inspect their own timer fdinfo/flags and simulate timer expiry.
Production adds no `/proc/self/fdinfo` read and retains only the four fixed cgroup reads below.

### Response bounds

Bound the complete response, headers plus body, to 65,536 bytes, allowing only one additional byte for oversize detection.
Allow at most 64 response headers and parse their grammar with `httparse`.

Accept HTTP/1.0 or HTTP/1.1 responses with status 200 and exactly one `Content-Type: application/json` header, allowing media-type parameters.
Allow at most one Content-Encoding header, and only with value `identity`.
Reject `Transfer-Encoding`, compression, duplicate or ambiguous framing, truncation, malformed headers, trailing bytes and unsupported framing rather than attempting recovery.
Support only the strict Content-Length/connection-close subset: require EOF and an exact body-length match when Content-Length is present, with no extra bytes.
Unsupported server behavior blocks the attempt; it does not authorize negotiation or a more permissive parser.

## Typed transient projection

Use typed Serde visitors to validate and project only these response fields:

| Response | Projected Docker fields |
|---|---|
| `/version` | `Version`, `ApiVersion`, `MinAPIVersion`, `Os`, `Arch`, `KernelVersion` |
| `/info` | `OSType`, `Architecture`, `KernelVersion`, `NCPU`, `MemTotal`, `CgroupDriver`, `CgroupVersion`, `DefaultRuntime`, `SecurityOptions`, keys of `Runtimes` |

Before Serde, validate UTF-8 and enforce lexical object/array nesting depth strictly below 128, respecting quoted strings and escapes.
This preflight bounds deeply nested `IgnoredAny` values; it is not a general JSON parser or a custom codec, and Serde still validates the complete JSON grammar.
Version strings are nonempty, at most 128 UTF-8 bytes, and contain no ASCII controls; info strings and security options use the same checks with a 256-byte ceiling.
Require integer CPU count 1–8,192 and memory bytes 1–2^63−1.
Allow at most 32 security options and 32 runtime names.
Reject duplicate projected fields, duplicate runtime keys, invalid types and exceeded bounds; never invent missing values or truncate them into success.
Skip unknown fields and runtime definitions with `IgnoredAny`; retain runtime keys only, never their configuration objects or paths.
Runtime names are unique, sorted, at most 128 ASCII bytes and match `[A-Za-z0-9][A-Za-z0-9_.-]*`.
All additional response bytes remain transient parsing input, not report evidence.

Never retain raw response headers/bodies, daemon error text or Serde error strings in stdout, stderr or evidence receipts.
For each attempted exchange retain only fixed request/method identity, status code if observed, byte count, duration and fixed error code, plus successfully validated projections.
Stop on the first failure and preserve earlier receipts/projections; do not issue `/info` after `/version` fails.

## Fixed self-cgroup observation

Pin the fixed `/sys/fs/cgroup` observation directory descriptor-relatively before binding its mount row.
Open and retain its parents and leaf with `O_PATH | O_NOFOLLOW | O_DIRECTORY | O_CLOEXEC`.
Call `statx` on that owned directory FD with an empty path, `AT_EMPTY_PATH | AT_NO_AUTOMOUNT` and ordinary `STATX_MNT_ID`, not `STATX_MNT_ID_UNIQUE`.
Require the returned MNT_ID mask bit and a nonzero mount ID.
Select exactly one `/proc/self/mountinfo` row whose mount ID matches that descriptor-derived ID, never the last or longest-looking pathname row.
Decode only the four standard kernel escapes (`\040`, `\011`, `\012`, `\134`) before validating the matched mountpoint as an absolute component ancestor of `/sys/fs/cgroup`.
Reject unsupported statx, absent mask/ID, missing or duplicate matches, malformed rows and inconsistent ancestry; keep the view unknown and block before Docker RPC.

Keep the observation directory and parent guard alive through the whole collector, including both HTTP requests or any abort.
Open only `cgroup.controllers` and `cgroup.subtree_control` relative to that same held directory FD, with read-only/no-follow descriptors.
A replacement of the global directory pathname must not redirect either controller read.
The mount ID is internal correlation data and is never added to the published report schema.
Under C1's trusted-kernel premise, this binds the pinned directory to its reported mount row without `fstatfs` or a general mount-topology resolver.
It is not an atomic snapshot or a promise of continuous visibility at the global pathname.
`exposesCgroupV2` describes the pinned observation directory's matched row, not effective enforcement or an independently qualified daemon-host view.

| Logical file contents, read once | Retained-byte ceiling |
|---|---:|
| `/proc/self/cgroup` | 64 KiB |
| `/proc/self/mountinfo` | 256 KiB |
| `/sys/fs/cgroup/cgroup.controllers` | 64 KiB |
| `/sys/fs/cgroup/cgroup.subtree_control` | 64 KiB |

The bounded reader may use one additional byte to detect excess and must reject it.
Project only the matched mount metadata, omitting sources, superoptions and the internal mount ID.
Read no other file contents, PID data, ancestor tree or cgroup tree, and perform no controller writes.
Missing/v1/unsupported views remain unknown or blocked, not a qualified daemon-host observation binding.

### Required read-only observation metadata surface

The future exact packet must allow fixed-parent directory opens/read-only metadata and `statx(owned_fd, "", AT_EMPTY_PATH | AT_NO_AUTOMOUNT, STATX_MNT_ID)`.
Controller content opens use `openat` on that same owned directory and only the two fixed names above.
These metadata calls add no file-content allowlist entry, published host identifier, filesystem mutation or current host-execution grant.
Unsupported metadata does not authorize a pathname/topology/fstatfs fallback.

## Report, proof and delivery boundary

The report schema is `chess-coach.host-docker-runtime-facts.v2`, with execution realm `OPERATOR_ASSERTED_HOST_UNQUALIFIED` and scope `FIXED_LOCAL_DOCKER_API_AND_SELF_CGROUP_METADATA_ONLY`.
Keep report-schema version separate from observed Docker version fields.
The report retains `caller`, `endpointCandidates`, the fixed selected socket path in `queryEndpoint`, `queries`, `daemonVersion`, `info`, `cgroupObservation` and a fixed `error` code; absent projections remain null.
Request receipts contain only `method`, `path`, `statusCode`, `responseBytes`, `elapsedNanos` and fixed `error`; no response text is copied into them.
Retain the operator-asserted, unqualified execution realm and all runtime/GPU qualification and provisioning/training authorization/readiness gates false.
`PASS_METADATA_ONLY` remains metadata success only; failures return a bounded blocked result with earlier validated observations preserved.
Bound the complete encoded JSON stdout, including its final newline, to 128 KiB; read no stdin.
If serialization exceeds that bound, emit no report bytes to stdout, print only `HOST_FACTS_REPORT_BOUND` to stderr and exit 1.
This is an output-encoding failure, not permission to leak partial JSON or daemon payload in a fallback diagnostic.
Create no configuration, state or report directory and perform no container/image, workload, GPU, provisioning or training operation.

The implemented `host:docker-runtime-facts` task invokes only the exact prebuilt relative path specified below.
It must not use `cargo run`, build implicitly, install/download/stage inputs, add dependencies/environment settings or append confirmation automatically.
The loader strategy is verified static-musl preparation; GNU loader-bundle and actual-host build routes were not selected.
The task exists, but NO APPROVED RUNNABLE HOST HANDOFF exists until source/asset publication or approved HTTPS transfer, independent expectation acceptance, exclusive operator staging and the exact query grant are supplied.
The proposed relative host-store path is not an accepted/deployed actual-host path, and target compatibility/qualification remain false.
Production/host registration, deployment selection, publication/transfer and the exact operator invocation require their applicable separate approvals.
`HTTPS operator packets` still grants transport preference only, not publication, credentials or host action.

The supplied mount-binding phase passes 72 Rust tests: 69 unit tests, one CLI parser test and two native-recipe partition tests.
The preceding 62-test timerfd phase remains historical; its five timer tests still cover owned timer clock/absolute/FD flags, timer-only expiry, expiry over readable socket, setup refusal without RPC and late-projection discard.
The fdinfo check and simulated timer rearm are `cfg(test)` only; they neither expand production reads nor permit production rearming.
Eight new cgroup cases cover descriptor-derived mount-row selection, hidden parent overmounts/reordered rows, escapes, binding refusal, unsupported/missing mask/ID, directory replacement and no-follow guards.
The coverage combines real statx on synthetic fixture FDs, independently obtained fixture IDs and parser-level mountinfo cases; synthetic cgroup2-labelled rows do not prove a real cgroup filesystem or enforcement.
An added collector test blocks mount-binding failure before RPC, and an added HTTP fixture test proves a zero-duration client cannot leave a server join waiting for a connection.
Both formerly blocking HTTP fixture accept sites now use nonblocking BOOTTIME-bounded one-second loops.
The 150 ms client deadlines and 300 ms EOF hold are synthetic fixture controls only; production requests retain their original 10-second deadline.
The retained source-phase receipts pass 74 Python tests, 22 Bun partition tests and formatting/Clippy; the new handoff phase separately passes 74 Python tests, 26 combined Bun tests and full TypeScript checks.
Only synthetic Unix listeners/fixed fixtures and child `--help`/invalid-argument paths ran; the real collector was not launched against an actual host daemon.
No actual suspend or host-clock test ran.
Security marked the timer/privacy state READY at the earlier 62-test checkpoint.
The lead now supplied both 72-test source verdicts: adversarial READY for mount/fixture corrections and security READY for privacy/timerfd plus targeted statx changes.
Those accept the reviewed Rust source only; later independent adversarial and security verdicts also accept the task/artifact-metadata/test preparation files.
See [verification.md](verification.md#rust-host-facts-v2-implemented-source-evidence) for exact test paths, receipts and the retained application offline-tree failure.

## Verified local static artifact — not distribution approval

The first Zig-musl recipe failed with duplicate `_start` startup objects supplied by both Zig and Rust; `/tmp/opencode/chess-coach-host-facts-static-1cCOX8/` remains unchanged evidence of that failed preparation.
A read-only stable-Rust probe rejected `-C linker-flavor=gnu-lld` as requiring unstable options.
The fresh successful receipt is `/tmp/opencode/chess-coach-host-facts-static-lld-6OVK2f/`, with private `build-recipe.json`, build logs and artifact inspection records.
Keep raw recipes/inspection files private because they contain builder paths.
The successful package-only release uses stable Rust 1.95.0, bundled Rust LLD with stable linker flavor `ld.lld`, and Rust's self-contained musl CRT, with locked/offline resolution and two jobs.
Existing per-invocation Zig 0.15.2 native drivers remain outside the repository; no nightly, `RUSTC_BOOTSTRAP`, handwritten CRT, application GNU-target/recipe change or CUDA/model feature change was introduced.

| Prepared asset expectation | Actual local preparation result |
|---|---|
| Filename | `host-docker-runtime-facts-linux-x86_64-musl` |
| Target / mode | `x86_64-unknown-linux-musl`; 0555 |
| Bytes | 674,400 |
| SHA-256 | `67541b7b2fb0388cd7bfefedfb69fcc74a7cca2e34cdf7f937fea15d2880538a` |
| ELF | ELF64 x86_64; no `PT_INTERP`, `DT_NEEDED`, `RPATH` or `RUNPATH` |

The actual artifact is static PIE: `ET_DYN` and `PT_DYNAMIC` are allowed and do not alone imply an external interpreter/library dependency.
Private standard-LLVM inspection and its verifier reject five unsafe ELF reports, pass four help/invalid-argument smokes, and pass the private-builder-path scan after path remapping/symbol stripping.
These are bounded local preparation results, not arbitrary-data confidentiality, actual-host compatibility, runtime/GPU qualification or production artifact registration.
No real `--confirm-host` collection ran.

## Implemented prebuilt task and proposed host store

The architect accepted the source handoff plan, and `mise.toml` now defines `host:docker-runtime-facts` with exactly `description`, `raw_args:true`, `raw:true`, `quiet:true` and this fixed run value:

```text
./target/host-facts/67541b7b2fb0388cd7bfefedfb69fcc74a7cca2e34cdf7f937fea15d2880538a/host-docker-runtime-facts-linux-x86_64-musl
```

The operator must explicitly supply `--help` or `--confirm-host`; the binary still accepts exactly one supported argument and rejects arbitrary overrides.
The task adds no automatic confirmation, env, dependencies, build, download, installation or staging.
Missing bytes fail without creating a replacement or switching to another path.
Both auto-install settings remain false and all three original Python task bodies remain unchanged.

`tooling/runtime/host-facts-artifact.json` is a closed expectation record for the actual bytes and ELF properties, not self-issued acceptance.
It retains deployment/runtime admission/host execution/provisioning/training/readiness false and GPU `NOT_QUALIFIED`.
Before any fresh approved HTTPS transfer, exclusive placement or query, Executor must independently retain and accept the expected hash/size outside this record.
The digest in a pathname is not a runtime hash check or strong immutability guarantee.
The exact actual-host absolute deployment/source root is still unselected; the relative store path above is only proposed and must remain operator-controlled, private from jobs and never mounted into a workload.
Mode 0555 is neither confidentiality nor strong immutability when ancestors remain writable.
Refuse an existing placement path; do not overwrite it, and do not treat cleanup or `cargo clean` loss of the staged bytes as permission to rebuild/download/fallback.

`packages/runtime/tests/host-facts-task.test.ts` persists four literal expectation/task tests, including real mise with a fake prebuilt executable, empty tool/Cargo/Rustup stores, literal metacharacter argument forwarding and missing-artifact failure.
Those fixtures do not run the actual collector or stage an approved host artifact.
Both targeted mise/metadata/test reviews returned `READY TO MERGE: yes`; source review and preparation/task-plan acceptance grant no publication, HTTPS distribution, actual-host placement or invocation.

## Failed proposal history

The superseded Python CLI proposal passed 97/98 synthetic tests but failed adversarial review over unregistered plugin execution, help's possible daemon contact/hidden failure, and socket/executable metadata-to-use races.
Its public-bound inventory was also redacted after a security CWE-200 finding; the private operator report remains unchanged.
The original CLI draft and verification receipts remain private at `/tmp/opencode/chess-coach-docker-runtime-verification-pYJinp/`.
See [verification.md](verification.md#blocked-docker-metadata-proposal-python-verification) for that failed-review chronology; none of it verifies the Rust successor or authorizes its execution.

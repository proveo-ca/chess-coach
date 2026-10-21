# F9 — bounded feasibility-metadata contract proposal

**2026-10-21 · APPROVED ONCE / EXECUTED: OBSERVED_METADATA / GRANT CONSUMED · runtime feasibility: UNVERIFIED · trainingReady:false.**

Current outcome: Executor approved the exact frozen single-query packet; parent completed the immediate C/T/E identity precheck and executed its registered entry once. [§14](#14-recorded-metadata-observation--one-query--grant-consumed) records the supplied filtered result, consumed authority and limits. No repeat or automatic next operation is authorized; R-OUT/R-IN remain unselected.

Sections1–13 preserve the prior proposal, preparation and presentation-review history. Their future-only, NOT APPROVED / NOT RUN and pending-approval wording describes that earlier stage, not current permission or an invitation to present the frozen packet again. The previous reviews did not review this new outcome record. The collector, mock and entry fences remain the authorized, once-executed packet; no code changed after authorization. Prior181 mocks retain MOCK ONLY scope.

## 1. Selected priority and unchanged authority

Executor selected **`Plan feasibility (Recommended)`** in the PLANNING ONLY question. This closes the investigation-priority decision only; it approves no daemon contact, probe, root inspection, authority realm, implementation or execution.
The lead selected one literal `GET /info` over a fixed Unix socket. Collector and persisted network-free mock source are now measured and tested below; no operational permission follows from those preparation checks.
The [mechanism proposal](native-ingress-mechanisms.md#9-definite-next-design-work--not-an-operations-packet) remains current for R-OUT/R-IN custody, loading, policy, init, shared-meter and clock gaps. No realm is selected.
Directory A, `tooling/native-ingress/`, stays selected for design only. R-NONE remains evidence-only, with neither Native controls nor diagnostic execution permission.
Accepted [N1–N10/bf38](native-ingress-authority.md), [implementation history](native-ingress-implementation.md#11-mechanism-contract-continuation--proposal-only), M1/M2 commands/raw records and consumed grants remain unchanged. Publication provenance stays in the [existing checkpoint record](native-ingress-mechanisms.md#1-scope-authority-and-publication-checkpoint); no new publication event or timestamp is asserted.
The [historical H02 socket observation](native-ingress-retry.md#recorded-metadata-result), table row at source line143, records only then-present `/var/run/docker.sock`, not connection permission, current accessibility, daemon identity or enforcement.
Parent supplies upstream source findings and read-only Architect `ses_ea073c0aaffen2hONzZNguuxx1` / DevOps `ses_ea073c05affeb3GoGOA6TUy953` fields/effects advice. This pass conducts no new consultation, network research or measurement.

## 2. Exact candidate request scope — future only

| Surface | Proposed closed contract |
|---|---|
| Client | Existing trusted Node; built-in `node:http` and `node:os`, plus built-in runtime facilities for monotonic timing, bounded buffers and fatal UTF-8 decoding. No CLI/SDK, shell, subprocess or additional dependency. |
| Destination | Fixed Unix socket `/var/run/docker.sock`; at most one connection attempt and one literal unversioned `GET /info`. Preflight failure/deadline can produce zero requests; reaching request creation permits exactly one. No TCP, alternate socket/path, query, request body, redirect, retry or API negotiation. |
| Request options | Exactly `socketPath:'/var/run/docker.sock', path:'/info', method:'GET', agent:false, maxHeaderSize:8192, insecureHTTPParser:false, setHost:false, headers:{Host:'localhost', Connection:'close', Accept:'application/json', 'Accept-Encoding':'identity'}`. Call empty `req.end()` once; no request body, Content-Length or Transfer-Encoding is intended. Mocks compare the complete options and end arguments, not actual Node wire bytes. |
| Excluded calls | No `/version`: selected `ServerVersion` plus optional `Api-Version` response header supply the proposed version metadata. No container/image enumeration, create/build/pull, mount or daemon-configuration mutation. |
| Client reads/writes | No credential/config/context/environment inspection, installed-root/log/PATH/control/receipt access, current proc-filesystem collection, file writes, logs, receipts or mkdir. Select only the parent getters and response fields below. |

Unversioned `/info` selects the server's default API behavior; this is not a frozen known response schema. Unsupported responses STOP without negotiating another version or deriving an endpoint from returned fields/header values.
Existing trusted Node/harness startup and selected getters have normal file/OS activity. Trusted startup/harness and no hostile preload or built-in mutation are premises; explicit Host with `setHost:false` removes implicit Host selection from the candidate. This proposal promises neither zero effects nor captured native/public authority from that trusted-host premise.

## 3. Daemon-side effects and sensitive transient inputs

Parent's reviewed **Moby v28.5.1** source shows that `/info` and `/version` can reach `SystemInfo`/`SystemVersion` paths that collect runtime/init/containerd versions through **daemon-side subprocesses**.
The info path can also invoke plugin/storage/registry/device callbacks, read configuration and log. This reviewed version is not a binding to installed daemon bytes or behavior.
No client child-exec means only that the proposed client starts no child; it does NOT mean the server avoids helper execution, plugin work, configuration collection or metadata I/O.
Client abort/destruction cannot guarantee cancellation of server work or server children. Client deadlines/body caps do not bound downstream daemon CPU, memory, filesystem activity, logging or process lifetimes.
Unix socket access exposes the daemon's broader administrative authority, often host-root-equivalent for a rootful daemon; this proposal does not establish whether the daemon is rootless. A source restriction to this one GET is not a kernel-enforced GET-only capability or a new security-posture grant.
If Executor requires **no server helper execution or configuration collection**, this packet does not meet that condition: STOP/revise before presenting any execution approval.

`/info` offers no field-selection API. The collector transiently receives the broader response, potentially including sensitive unselected proxy, registry, swarm and runtime-configuration metadata.
Whitelisted output does NOT mean no secrets were received; bounded parsing does NOT provide memory zeroization. The future exact approval must disclose broad transient input and downstream server-work risks.
Never print/log/persist raw body, raw headers, error messages, stacks or unselected fields. Forward no credentials and read no client context/configuration; exclude daemon ID/name/hostname, proxies, registries, swarm, labels, components, warnings and runtime maps from output.

## 4. Proposed client bounds and cleanup

| Boundary | Proposed numeric rule | Limit of the claim |
|---|---|---|
| Whole collector | One absolute monotonic **5s**, beginning before selected parent getters and connection, not before Node startup or module import; covers request, parse, filtering and output callback. | Node timers cannot preempt synchronous work or stalled kernel/event-loop execution. Check elapsed time across phases; no hard process-tree/kernel deadline is claimed. A future outer tool limit is8000ms, not a hard kernel/tree promise. |
| Headers | Absolute **1s from request creation** to complete headers. | Not an inactivity-reset timer; no deadline renewal on partial progress. |
| Complete response body | Absolute **2s from request creation**, including connection and headers. | Not two seconds after headers and not a per-chunk timeout. The earlier applicable deadline wins. |
| Header parser | `maxHeaderSize:8192`; additionally rawHeaders must be an even array≤4096 elements, with Latin-1 string pairs whose total `name.length+value.length+4`≤8192. | The additional bound is mock-checkable. Neither bound caps all internal buffers or daemon response generation. |
| Body | At most **131072 bytes** into one bounded buffer. Count each chunk before copying; no unbounded chunk array or concatenation chain. | Node socket/parser/native/OS buffers can overshoot transiently; this is not a hard RSS or server-memory bound. |
| Content-Length | If present, require one valid numeric length no greater than131072 and exact equality to bytes received at completion. | Absent length still requires complete bounded response framing; no truncation or coercion. |
| Output | One ASCII-escaped JSON record, including its terminal LF, **≤16384 bytes**. | Check escaping expansion before emission; overflow produces fixed STOP, never truncated success. No raw companion streams/files. |

On a transport decision latch terminal state before destroying request, responses and all captured sockets, including upgrade/connect sockets. Keep error listeners installed, guard late objects before destroying them, cancel header/body timers and retain only the original whole timer through pending output. Three fixed timer slots rearm against their original deadlines after early delivery; `now>=deadline` expires. There is no inactivity timeout or renewed body period. Accepting response end ends the body clock; parsing/output use the whole clock.
Submit at most one stdout write with one LF. Exit0 requires an OBSERVED/PARTIAL candidate and its successful callback strictly before the whole deadline; STOP exits3. A false write return can still succeed through its timely callback; backpressure without timely completion, error events, callback error or synchronous throw exits3 and destroys stdout when needed. Never append a corrective record after submission. External consumers must reject nonzero exit, missing/truncated records or failed delivery; submitted bytes cannot be retracted.
These cleanup duties do not guarantee immediate kernel cleanup, server cancellation or reap of daemon-side helpers. The registered entry and collector have exact-byte presentation reviews; fresh operational approval remains pending.

## 5. Strict response acceptance and parser limitation

- Require a complete **200** response and exactly one Content-Type matching `/^[ \t]*application\/json[ \t]*(?:;[ \t]*charset[ \t]*=[ \t]*utf-8[ \t]*)?$/i`; no quoted charset or other parameter. Content-Encoding is absent or OWS-trimmed case-insensitive identity; never decompress. Transfer-Encoding is absent or exactly one OWS-trimmed case-insensitive chunked. Reject duplicate Content-Type, Content-Encoding, Content-Length, Transfer-Encoding or Api-Version, CL+TE, and any Upgrade/Trailer declaration, including empty declarations. Content-Length is digits only; Api-Version is exact digits-dot-digits without trimming/coercion.
- Reject redirects, protocol upgrades, informational responses, unexpected trailers, malformed/ambiguous framing, incomplete/truncated bodies, header/body overflow, timeouts and I/O failure.
- Decode the complete bounded body with `new TextDecoder('utf-8',{fatal:true,ignoreBOM:true})`; preserving an initial BOM lets JSON.parse reject it. Reject malformed UTF-8, malformed JSON and a top-level null/array/non-object. Require Buffer chunks, complete framing, exact declared length and an empty rawTrailers array at end.
- Require every mandatory selected field to have its exact type, nonempty value and byte bound. Optional missing/null becomes explicit UNKNOWN; optional wrong type, controls or overflow is STOP, not UNKNOWN.
- No selected-field truncation, coercion, endpoint/version selection from returned content or fallback request is allowed.
- The smallest candidate uses **`JSON.parse` last-key-wins semantics**. It does NOT verify duplicate JSON keys; this is an explicit non-authority metadata limitation, not a strict native decoder.

Do not reuse this parser for native wire frames, independent expected inputs or authority construction. Host-only output is not a new native protocol, Configuration/Versions/O9 field or F9 check substitute.

## 6. Closed output whitelist and statuses

Success-shaped output contains only `status`, `parent`, `info`, `apiVersion` and `rootlessReported`. The two nested objects contain only the fields listed below; no response object is spread/copied into output.
STOP-shaped output contains only `status:STOP` and one fixed enum `reason`; never include an exception string, raw body/header or stack. The collector freezes six codes: `IO`, `DEADLINE`, `HTTP_FRAMING`, `UTF8_JSON`, `SCHEMA`, `BOUNDS`. `ENTRY` is reserved for a future separately reviewed entry and is not a collector code. These diagnostic codes do not constitute an accepted native protocol.

| Output field/source | Proposed validation / representation |
|---|---|
| `parent.uid` / `process.getuid()` | Nonnegative safe integer; getter unavailable, failure or invalid result STOP. No PID, username or hostname. |
| `parent.platform`, `parent.arch` / built-in process properties | Nonempty control-free ordinary strings, each≤256 UTF-8 bytes; no environment inspection. |
| `parent.kernel` / `os.release()` | Nonempty control-free ordinary string≤256 UTF-8 bytes; no proc/namespace reads. |
| `info.ServerVersion`, `info.OSType`, `info.Architecture` | Mandatory nonempty control-free strings, each≤256 UTF-8 bytes. Missing/null/wrong type/overflow STOP. |
| `info.KernelVersion`, `info.CgroupDriver`, `info.CgroupVersion` | Optional nonempty control-free strings, each≤256 UTF-8 bytes; missing/null→UNKNOWN. |
| `info.DockerRootDir` | Optional nonempty control-free string≤4096 UTF-8 bytes; missing/null→UNKNOWN. This is the only reported directory path; never resolve/stat/open it. |
| `info.SecurityOptions` | Optional array≤32 control-free nonempty strings, each≤256 UTF-8 bytes; missing/null→UNKNOWN. No stringification/coercion of entries. |
| `info.NCPU`, `info.MemTotal` | Optional nonnegative safe integers; missing/null→UNKNOWN. Zero remains a reported zero indicating unknown/unusable resources, never available capacity. |
| `apiVersion` / selected `Api-Version` response header | Optional single bounded string matching digits-dot-digits,≤256 UTF-8 bytes; missing→UNKNOWN. Present invalid/ambiguous values STOP; never negotiate or derive paths. |
| `rootlessReported` / selected SecurityOptions | `true` ONLY when an entry equals exactly `name=rootless`; otherwise UNKNOWN, never false or inferred rootful. |

Reject C0 U+0000–001F, DEL/C1 U+007F–009F and unpaired surrogates in all selected strings. First bound JavaScript string length by the byte cap, scan, then enforce UTF-8 byte length; preserve valid Unicode, including paired surrogates, without normalization or truncation. Output escapes every U+007F–FFFF code unit as `\uXXXX`. Validate only own whitelist properties and construct fresh literal output with all ten info keys; never spread parsed data.
`OBSERVED_METADATA` means mandatory and all optional source fields/header were reported and valid. `PARTIAL_METADATA` means mandatory fields are valid but at least one optional source field/header is missing/null; it does not trigger another query.
UNKNOWN `rootlessReported` alone does not force PARTIAL_METADATA when SecurityOptions was reported valid: absence of the marker cannot establish rootful operation. Valid reported zero resource values likewise remain metadata, not admission.
All validation/transport failures yield STOP with a fixed category such as socket/I/O, deadline, HTTP/framing, UTF-8/JSON, schema or bounds. No PASS, verified flag or `feasible:true` is emitted.

## 7. Interpretation for R-OUT versus R-IN

| Possible observation | Planning value | Claim expressly excluded |
|---|---|---|
| Fixed socket returns bounded selected metadata | Narrow reported platform/server/cgroup/security clues for comparing candidate contracts. | Authenticated actual daemon identity, same host, same UID/user/PID/mount/time namespace or approved native execution. |
| Client and server kernel/architecture strings match | Record reported strings without extrapolation. | Matching host/namespace identity or proc reachability. |
| DockerRootDir reported | Opaque server-reported string only. | Local store path, permission to inspect it, quota, effective headroom or peak coexistence. |
| Rootless marker/cgroup/resource fields reported | Identify topics needing later safe audited mechanisms. | UID10001 proc/maps readability, actual init bytes, full policy/effective aggregate enforcement, loaded closure or read-only proof. |
| Missing/inaccessible socket, connection failure or unsupported response | Fixed bounded STOP; preserve unresolved candidate status. | Retry/fallback permission, tool installation, posture changes or selecting R-IN/R-OUT by default. |

Even OBSERVED_METADATA establishes none of the outer→inner causal gate, immutable host Rust loading, one-meter precharge ownership or cross-realm absolute-clock bridge.
N3/current R4 stops, full unchanged F9 policy, BOTH-recipient1048576, cold10s, lifecycle300s including3s cleanup and separate generator2048 remain unchanged. M2 supplies no new observation permission.
After one future separately approved result, perform no automatic next operation. Further design/approval remains separate; R-NONE is no positive fallback or waiver.

## 8. Static/mock review matrix —181 isolated cases passed

| Future review/test family | Proposed checks / scope limit |
|---|---|
| Fixed request surface | Mock counter checks at most one request, exactly one when preflight reaches request creation, with fixed socket and GET route; it does not observe physical connections. Reject source POST/mutator substitutions. No CLI/SDK/shell/child exec, credentials/config/env reads, fallback, negotiation or dynamic endpoint. |
| Absolute deadlines/cleanup | Headers/body stalls and trickle progress cannot renew timers; selected getters/parse/output count against whole deadline; cleanup destroys transport and cancels timers on every exit. Mocks do not prove hard kernel/server deadlines. |
| HTTP/framing | Non200, redirects, upgrades/informational responses, unexpected trailers, malformed length, length mismatch, truncation, header/body overflow and I/O failures STOP. |
| Parsing/schema | Fatal UTF-8, malformed JSON/top-level type, mandatory fields, optional UNKNOWN, wrong types, safe integers, zero interpretation, string byte/control bounds and SecurityOptions limits. |
| Duplicate policy | Explicitly exercise/document JSON.parse last-key-wins behavior; do not claim duplicate-key verification or native-wire suitability. Reject ambiguous selected version header/framing. |
| Output filtering | Spy confirms no proxy/registry/swarm/runtime-map/secrets/raw body/header/error/stack fields reach output; ASCII escaping expansion overflow yields bounded STOP, not truncation. Filtering is not no-secrets-received/zeroization proof. |
| Effects and authority | Source excludes client child exec/mutators; review preserves daemon-helper/config/logging disclosures, no realm selection and no positive F9/native authority. Mocks cannot prove installed-daemon trust or effects. |

Before asking for exact execution approval: freeze collector bytes, trusted Node entry and environment assumptions, monotonic timing/cleanup/output contract, all bounds and explicit downstream/transient-sensitive-input risks; complete parse/static/mock and scoped reviews.
Then obtain fresh human approval for that exact finite collector/entry and residual scope. Collector/entry parsing and181 isolated VM cases passed without operational execution; exact-byte reviews are complete and operational approval remains pending. Prior contract-only reviews remain separate from those final byte reviews. Do not request generic planning-direction reapproval.
Preparation completed without network/daemon contact. Mock success is not local daemon behavior, actual Node HTTP wire/parser verification or operational permission.

Lead's four-document scope, published-history preservation, accepted bf38/M1/M2 program identities,24 local links/anchors and whitespace checks passed. Runtime tests and all daemon/installed-root probes were not run. Read-only Adversarial `ses_ea060df5bffeS6ypJslTrwcdVH` and Security `ses_ea060df55ffebEUkYELHcyU2hn` reported no findings and DOCS READY for CONTRACT ONLY; both explicitly denied execution readiness. These subsequent planning drafts remain uncommitted after publication `83d416e7`.

## 9. Supplied upstream references — not installed-capability evidence

- [Node v22 HTTP request](https://nodejs.org/docs/latest-v22.x/api/http.html#httprequestoptions-callback): request options and client behavior; not proof of trusted local entry identity or daemon cancellation.
- Moby v28.5.1 [server routing](https://github.com/moby/moby/blob/v28.5.1/api/server/server.go), [version middleware](https://github.com/moby/moby/blob/v28.5.1/api/server/middleware/version.go), [info response types](https://github.com/moby/moby/blob/v28.5.1/api/types/system/info.go).
- Moby v28.5.1 [daemon info](https://github.com/moby/moby/blob/v28.5.1/daemon/info.go) and [Unix info](https://github.com/moby/moby/blob/v28.5.1/daemon/info_unix.go): supplied reviewed-version server-side collection/effects findings, not installed-daemon identity.

```text
notEstablished:
  full-training-closure
  genuine-native-authority
  whole-decision-adequacy
  calibration
  training-readiness
trainingReady: false
```

No collection/fitting/calibration/training/activation/deployment grant, production-source/configuration/index/diagram change, installed-root/log/PATH/receipt/control access or daemon/network probe follows. Lead preparation checks operate on repository document bytes and network-free mocks only.

## 10. Exact inert HOST DIAGNOSTIC collector candidate

Parent measured exact UTF-8 fence bodies, including their final LF; no trimming or newline normalization applies:

| Artifact | SHA-256 | UTF-8 bytes / LF-terminated lines |
|---|---|---:|
| Collector | `9232109d36f2c9040f76e344c3e9eacde3fcf0f8511c1a83a092d454c492f2e4` |14068 /406 |
| Persisted VM mocks | `05052e080f4d531566122dfc8bfcbb16a05e37717e374fb0e3b408a773fdd0b6` |29794 /570 |
| Exact entry | `a2a7f94b8316c072b8019385cd3324c966af577b649ceeb2342ec53e56b808c5` |1405 /32 |

All three JavaScript bodies and the entry's Bash envelope passed parse-only checks. The persisted mock controller passed181 cases through synthetic imports and fake process/clock/transport/output; neither the operational entry nor actual HTTP collector was executed. These checks are not live Node wire/parser tests, daemon authentication, permission proof or execution approval.

The source below is self-contained ESM with top-level await and only default `node:http` / `node:os` imports. It has no exports, caller dependencies, endpoint selector, environment reads, test mode or filesystem/child-process access. Parent getters may fail before any request. The six private fault categories sanitize exceptions; parse failures use UTF8_JSON and other unexpected failures use IO. JSON.parse retains its disclosed last-key-wins limitation. All operations remain proposed, not authorized.

Parent supplied lifecycle advice from Architect `ses_ea04badfaffe2MsACz5wXsGh8z` and DevOps `ses_ea04badf3ffeQNbUofWkzqvw9s`. This pass authors source against that advice without new consultation or claiming review of these exact bytes.

<!-- BEGIN F9 FEASIBILITY COLLECTOR -->
```js
import http from 'node:http';
import os from 'node:os';

await new Promise((resolve) => {
  const wholeDeadline = performance.now() + 5000;
  const codes = new Set(['IO', 'DEADLINE', 'HTTP_FRAMING', 'UTF8_JSON', 'SCHEMA', 'BOUNDS']);
  class Fault {
    constructor(reason) { this.reason = reason; }
  }
  const timers = { whole: null, header: null, body: null };
  const responses = new Set();
  const sockets = new Set();
  let req;
  let stdout;
  let storage;
  let used = 0;
  let declaredLength = null;
  let apiVersion = 'UNKNOWN';
  let parent;
  let headerDeadline = null;
  let bodyCompleteDeadline = null;
  let headersAccepted = false;
  let bodyEnded = false;
  let terminal = false;
  let phase = 'collecting';

  function fault(reason) { throw new Fault(reason); }
  function category(error) {
    return error instanceof Fault && codes.has(error.reason) ? error.reason : 'IO';
  }
  function wholeCheck() {
    if (performance.now() >= wholeDeadline) fault('DEADLINE');
  }
  function check() {
    wholeCheck();
    const now = performance.now();
    if ((!headersAccepted && headerDeadline !== null && now >= headerDeadline) ||
        (!bodyEnded && bodyCompleteDeadline !== null && now >= bodyCompleteDeadline)) {
      fault('DEADLINE');
    }
  }
  function cancel(slot) {
    if (timers[slot] !== null) clearTimeout(timers[slot]);
    timers[slot] = null;
  }
  function destroy(object) {
    try { if (object && typeof object.destroy === 'function') object.destroy(); } catch {}
  }
  function settle(ok, destroyOutput = false) {
    if (phase === 'done') return;
    phase = 'done';
    terminal = true;
    process.exitCode = ok ? 0 : 3;
    cancel('whole');
    cancel('header');
    cancel('body');
    if (destroyOutput) destroy(stdout);
    resolve();
  }
  function arm(slot, deadline, expire) {
    cancel(slot);
    timers[slot] = setTimeout(() => {
      timers[slot] = null;
      try {
        if (phase === 'done') return;
        if (performance.now() < deadline) {
          arm(slot, deadline, expire);
          return;
        }
        expire();
      } catch (error) {
        if (!terminal) finish({ status: 'STOP', reason: category(error) });
        else if (phase === 'writing') settle(false, true);
      }
    }, Math.max(0, deadline - performance.now()));
  }
  function guarded(handler) {
    return (...args) => {
      try { handler(...args); }
      catch (error) {
        if (!terminal) finish({ status: 'STOP', reason: category(error) });
      }
    };
  }
  function stopLine(reason) { return '{"status":"STOP","reason":"' + reason + '"}\n'; }
  function finish(record) {
    if (terminal) return;
    terminal = true;
    cancel('header');
    cancel('body');
    destroy(req);
    for (const response of responses) destroy(response);
    for (const socket of sockets) destroy(socket);
    let candidate = record.status === 'OBSERVED_METADATA' || record.status === 'PARTIAL_METADATA';
    let line;
    try {
      wholeCheck();
      line = JSON.stringify(record).replace(/[\u007f-\uffff]/g,
        (unit) => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
      wholeCheck();
      if (Buffer.byteLength(line, 'utf8') > 16384) fault('BOUNDS');
    } catch (error) {
      candidate = false;
      line = stopLine(category(error));
    }
    try { wholeCheck(); }
    catch { candidate = false; line = stopLine('DEADLINE'); }
    phase = 'writing';
    process.exitCode = 3;
    if (!stdout) { settle(false); return; }
    try {
      stdout.write(line, (error) => {
        try {
          if (phase !== 'writing') return;
          if (error || performance.now() >= wholeDeadline) { settle(false, true); return; }
          settle(candidate);
        } catch { settle(false, true); }
      });
      if (phase === 'writing' && performance.now() >= wholeDeadline) settle(false, true);
    } catch {
      process.exitCode = 3;
      settle(false, true);
      destroy(stdout);
    }
  }
  function watchSocket(socket) {
    if (!socket) fault('HTTP_FRAMING');
    if (sockets.has(socket)) {
      if (terminal) destroy(socket);
      return;
    }
    sockets.add(socket);
    socket.on('error', guarded(() => {
      if (terminal) return;
      check();
      fault('IO');
    }));
    if (terminal) { destroy(socket); return; }
    socket.on('close', guarded(() => {
      if (terminal || bodyEnded) return;
      check();
      fault('HTTP_FRAMING');
    }));
    check();
  }
  function string(value, cap) {
    check();
    if (typeof value !== 'string' || value.length === 0) fault('SCHEMA');
    if (value.length > cap) fault('BOUNDS');
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) fault('SCHEMA');
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(++i);
        if (!(next >= 0xdc00 && next <= 0xdfff)) fault('SCHEMA');
      } else if (code >= 0xdc00 && code <= 0xdfff) fault('SCHEMA');
    }
    if (Buffer.byteLength(value, 'utf8') > cap) fault('BOUNDS');
    check();
    return value;
  }
  function integer(value) {
    check();
    if (!Number.isSafeInteger(value) || value < 0) fault('SCHEMA');
    return value;
  }
  function read(getter) {
    check();
    const value = getter();
    check();
    return value;
  }
  function headers(response) {
    check();
    if (read(() => response.statusCode) !== 200) fault('HTTP_FRAMING');
    const raw = read(() => response.rawHeaders);
    if (!Array.isArray(raw) || raw.length % 2 !== 0) fault('HTTP_FRAMING');
    if (raw.length > 4096) fault('BOUNDS');
    const selected = Object.create(null);
    let size = 0;
    for (let i = 0; i < raw.length; i += 2) {
      check();
      const name = raw[i];
      const value = raw[i + 1];
      if (typeof name !== 'string' || typeof value !== 'string') fault('HTTP_FRAMING');
      size += name.length + value.length + 4;
      if (size > 8192) fault('BOUNDS');
      if (/[^\x00-\xff]/.test(name) || /[^\x00-\xff]/.test(value) ||
          !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) ||
          /[\x00-\x08\x0a-\x1f\x7f]/.test(value)) fault('HTTP_FRAMING');
      const key = name.toLowerCase();
      if (key === 'upgrade' || key === 'trailer') fault('HTTP_FRAMING');
      if (key === 'content-type' || key === 'content-encoding' ||
          key === 'content-length' || key === 'transfer-encoding' || key === 'api-version') {
        if (Object.hasOwn(selected, key)) fault('HTTP_FRAMING');
        selected[key] = value;
      }
    }
    if (!Object.hasOwn(selected, 'content-type') ||
        !/^[ \t]*application\/json[ \t]*(?:;[ \t]*charset[ \t]*=[ \t]*utf-8[ \t]*)?$/i.test(selected['content-type'])) {
      fault('HTTP_FRAMING');
    }
    if (Object.hasOwn(selected, 'content-encoding') &&
        !/^[ \t]*identity[ \t]*$/i.test(selected['content-encoding'])) fault('HTTP_FRAMING');
    if (Object.hasOwn(selected, 'transfer-encoding') &&
        !/^[ \t]*chunked[ \t]*$/i.test(selected['transfer-encoding'])) fault('HTTP_FRAMING');
    if (Object.hasOwn(selected, 'content-length')) {
      if (Object.hasOwn(selected, 'transfer-encoding') || !/^[0-9]+$/.test(selected['content-length'])) {
        fault('HTTP_FRAMING');
      }
      declaredLength = Number(selected['content-length']);
      if (!Number.isSafeInteger(declaredLength) || declaredLength > 131072) fault('BOUNDS');
    }
    if (Object.hasOwn(selected, 'api-version')) {
      apiVersion = string(selected['api-version'], 256);
      if (!/^[0-9]+\.[0-9]+$/.test(apiVersion)) fault('HTTP_FRAMING');
    }
    check();
  }
  function select(parsed) {
    check();
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) fault('SCHEMA');
    let partial = apiVersion === 'UNKNOWN';
    const mandatory = (key) => {
      check();
      if (!Object.hasOwn(parsed, key)) fault('SCHEMA');
      return string(parsed[key], 256);
    };
    const optional = (key, validate) => {
      check();
      if (!Object.hasOwn(parsed, key) || parsed[key] === null) {
        partial = true;
        return 'UNKNOWN';
      }
      return validate(parsed[key]);
    };
    const security = (value) => {
      if (!Array.isArray(value)) fault('SCHEMA');
      if (value.length > 32) fault('BOUNDS');
      const result = [];
      for (const item of value) result.push(string(item, 256));
      check();
      return result;
    };
    const info = {
      ServerVersion: mandatory('ServerVersion'),
      OSType: mandatory('OSType'),
      Architecture: mandatory('Architecture'),
      KernelVersion: optional('KernelVersion', (v) => string(v, 256)),
      CgroupDriver: optional('CgroupDriver', (v) => string(v, 256)),
      CgroupVersion: optional('CgroupVersion', (v) => string(v, 256)),
      DockerRootDir: optional('DockerRootDir', (v) => string(v, 4096)),
      SecurityOptions: optional('SecurityOptions', security),
      NCPU: optional('NCPU', integer),
      MemTotal: optional('MemTotal', integer)
    };
    const rootlessReported = Array.isArray(info.SecurityOptions) &&
      info.SecurityOptions.includes('name=rootless') ? true : 'UNKNOWN';
    check();
    return {
      status: partial ? 'PARTIAL_METADATA' : 'OBSERVED_METADATA',
      parent,
      info,
      apiVersion,
      rootlessReported
    };
  }
  function responseArrived(response) {
    response.on('error', guarded(() => {
      if (terminal) return;
      check();
      fault('IO');
    }));
    if (!terminal) responses.add(response);
    try {
      const socket = terminal ? response.socket : read(() => response.socket);
      if (socket) watchSocket(socket);
    } finally {
      if (terminal) destroy(response);
    }
    if (terminal) return;
    if (headersAccepted) fault('HTTP_FRAMING');
    response.on('aborted', guarded(() => {
      if (terminal) return;
      check();
      fault('HTTP_FRAMING');
    }));
    response.on('close', guarded(() => {
      if (terminal || bodyEnded) return;
      check();
      fault('HTTP_FRAMING');
    }));
    response.on('data', guarded((chunk) => {
      if (terminal) return;
      check();
      if (!Buffer.isBuffer(chunk)) fault('HTTP_FRAMING');
      if (chunk.length > 131072 - used) fault('BOUNDS');
      chunk.copy(storage, used);
      used += chunk.length;
      check();
    }));
    response.on('end', guarded(() => {
      if (terminal) return;
      check();
      const complete = read(() => response.complete);
      const trailers = read(() => response.rawTrailers);
      if (complete !== true ||
          (declaredLength !== null && declaredLength !== used) ||
          !Array.isArray(trailers) || trailers.length !== 0) fault('HTTP_FRAMING');
      check();
      bodyEnded = true;
      cancel('body');
      let text;
      let parsed;
      wholeCheck();
      try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(storage.subarray(0, used)); }
      catch { fault('UTF8_JSON'); }
      wholeCheck();
      try { parsed = JSON.parse(text); }
      catch { fault('UTF8_JSON'); }
      wholeCheck();
      const record = select(parsed);
      wholeCheck();
      finish(record);
    }));
    headers(response);
    headersAccepted = true;
    cancel('header');
    check();
  }
  function rejectedProtocol(response, socket) {
    if (response) {
      response.on('error', guarded(() => { if (!terminal) { check(); fault('IO'); } }));
      if (!terminal) responses.add(response);
    }
    if (socket) watchSocket(socket);
    try {
      if (response) {
        const responseSocket = terminal ? response.socket : read(() => response.socket);
        if (responseSocket) watchSocket(responseSocket);
      }
    } finally {
      if (terminal) { destroy(response); destroy(socket); }
    }
    if (terminal) return;
    check();
    fault('HTTP_FRAMING');
  }

  try {
    process.exitCode = 3;
    stdout = process.stdout;
    stdout.on('error', () => {
      try {
        process.exitCode = 3;
        if (!terminal) finish({ status: 'STOP', reason: 'IO' });
        else if (phase === 'writing') settle(false, true);
        else destroy(stdout);
      } catch { settle(false, true); }
    });
    arm('whole', wholeDeadline, () => {
      if (!terminal) finish({ status: 'STOP', reason: 'DEADLINE' });
      else if (phase === 'writing') settle(false, true);
    });
    storage = Buffer.alloc(131072);
    const getuid = read(() => process.getuid);
    if (typeof getuid !== 'function') fault('SCHEMA');
    parent = {
      uid: integer(read(() => getuid.call(process))),
      platform: string(read(() => process.platform), 256),
      arch: string(read(() => process.arch), 256),
      kernel: string(read(() => os.release()), 256)
    };
    check();
    const requestStart = performance.now();
    headerDeadline = requestStart + 1000;
    bodyCompleteDeadline = requestStart + 2000;
    arm('header', headerDeadline, () => finish({ status: 'STOP', reason: 'DEADLINE' }));
    arm('body', bodyCompleteDeadline, () => finish({ status: 'STOP', reason: 'DEADLINE' }));
    check();
    req = http.request({
      socketPath: '/var/run/docker.sock',
      path: '/info',
      method: 'GET',
      agent: false,
      maxHeaderSize: 8192,
      insecureHTTPParser: false,
      setHost: false,
      headers: { Host: 'localhost', Connection: 'close', Accept: 'application/json', 'Accept-Encoding': 'identity' }
    });
    req.on('error', guarded(() => { if (!terminal) { check(); fault('IO'); } }));
    req.on('socket', guarded(watchSocket));
    req.on('response', guarded(responseArrived));
    req.on('information', guarded(() => { if (!terminal) { check(); fault('HTTP_FRAMING'); } }));
    req.on('upgrade', guarded(rejectedProtocol));
    req.on('connect', guarded(rejectedProtocol));
    req.on('close', guarded(() => {
      if (!terminal && !bodyEnded) { check(); fault('HTTP_FRAMING'); }
    }));
    check();
    req.end();
    check();
  } catch (error) {
    if (!terminal) finish({ status: 'STOP', reason: category(error) });
  }
});
```
<!-- END F9 FEASIBILITY COLLECTOR -->

## 11. Persisted network-free VM mock controller —181 PASS

This controller reads this document only and extracts unchanged collector bytes between the exact opening fence and closing fence, including final LF. EXPECTED_SHA binds collector SHA-256 `9232109d36f2c9040f76e344c3e9eacde3fcf0f8511c1a83a092d454c492f2e4`,14068 UTF-8 bytes/406 LF-terminated lines. Parent reran all parse checks and181 network-free cases after the idempotent socket-watcher correction; all passed, including single error-listener assertions for normal, protocol and late sockets. No operational HTTP request, daemon contact or installed-root access occurred. Do not bypass the digest or transform source before evaluation. Earlier results retain their older collector-identity scope.

Every case links only synthetic default `node:http` and `node:os` modules. The collector receives fake process/stdout, monotonic time and three-slot timers, plus real Buffer/TextDecoder. JSON instrumentation advances fake time while delegating actual parsing/stringifying to the VM's built-ins. No real process, filesystem, HTTP, OS, network, client, real timers or caller dependency is passed to the collector. The controller's filesystem read is the single fixed document read; crypto hashes only its extracted source. VM isolation is a trusted test arrangement, not a hostile-code sandbox.

The event queue and microtask drains are deterministic and finite. Destruction deliberately emits synchronous close/error, and late objects must acquire error listeners before destruction. Cases compare full request options and empty end arguments, selected output, exit/delivery behavior, timer cleanup and module closure. They do not exercise Node's HTTP parser, capture wire headers, contact a daemon, prove installed bytes or bound physical/kernel/server work. A parent-controlled external test timeout remains necessary if VM execution itself stalls.

<!-- BEGIN F9 FEASIBILITY MOCK TESTS -->
```js
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';

const EXPECTED_SHA = '9232109d36f2c9040f76e344c3e9eacde3fcf0f8511c1a83a092d454c492f2e4';
const document = fs.readFileSync('_spec/_plans/native-ingress-feasibility.md', 'utf8');
const opening = ['<!-- BEGIN F9 FEASIBILITY ', 'COLLECTOR -->', '\n```js\n'].join('');
const closing = ['```\n<!-- END F9 FEASIBILITY ', 'COLLECTOR -->'].join('');
assert.equal(document.split(opening).length, 2, 'one exact collector opening');
assert.equal(document.split(closing).length, 2, 'one exact collector closing');
const begin = document.indexOf(opening) + opening.length;
const end = document.indexOf(closing);
assert.ok(end > begin);
const source = document.slice(begin, end);
assert.ok(source.endsWith('\n'), 'digest includes final source LF');
assert.match(EXPECTED_SHA, /^[a-f0-9]{64}$/, 'parent must freeze collector SHA before running mocks');
assert.equal(crypto.createHash('sha256').update(source, 'utf8').digest('hex'), EXPECTED_SHA);

const SECRET = 'NEVER_EMIT_proxy_registry_body_error_stack_secret';
const expectedOptions = {
  socketPath: '/var/run/docker.sock', path: '/info', method: 'GET', agent: false,
  maxHeaderSize: 8192, insecureHTTPParser: false, setHost: false,
  headers: { Host: 'localhost', Connection: 'close', Accept: 'application/json', 'Accept-Encoding': 'identity' }
};
const infoKeys = ['ServerVersion', 'OSType', 'Architecture', 'KernelVersion', 'CgroupDriver',
  'CgroupVersion', 'DockerRootDir', 'SecurityOptions', 'NCPU', 'MemTotal'];
const optionalKeys = infoKeys.slice(3);
const reasons = ['IO', 'DEADLINE', 'HTTP_FRAMING', 'UTF8_JSON', 'SCHEMA', 'BOUNDS'];
const cases = [];
function add(name, settings = {}) { cases.push({ name, ...settings }); }
function metadata() {
  return {
    ServerVersion: '28.5.1', OSType: 'linux', Architecture: 'x86_64', KernelVersion: '6.1',
    CgroupDriver: 'systemd', CgroupVersion: '2', DockerRootDir: '/opaque/server/store',
    SecurityOptions: ['name=rootless'], NCPU: 4, MemTotal: 1073741824
  };
}
function rawHeaders(bytes) {
  return ['Content-Type', 'application/json', 'Api-Version', '1.47', 'Content-Length', String(bytes.length)];
}
function noLength() { return ['Content-Type', 'application/json', 'Api-Version', '1.47']; }
function expectedRecord(info) {
  return {
    status: 'OBSERVED_METADATA',
    parent: { uid: 1000, platform: 'linux', arch: 'x64', kernel: 'mock-kernel' },
    info, apiVersion: '1.47',
    rootlessReported: info.SecurityOptions.includes('name=rootless') ? true : 'UNKNOWN'
  };
}
function asciiLine(value) {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g,
    (unit) => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0')) + '\n';
}
function outputEdge(target) {
  const info = metadata();
  info.DockerRootDir = 'd'.repeat(4096);
  info.SecurityOptions = Array.from({ length: 32 }, () => 's'.repeat(256));
  const delta = target - asciiLine(expectedRecord(info)).length;
  assert.ok(delta > 0);
  let pairs = Math.ceil(delta / 4);
  const extra = pairs * 4 - delta;
  for (let i = 0; i < 32 && pairs > 0; i++) {
    const count = Math.min(128, pairs);
    info.SecurityOptions[i] = 'Ā'.repeat(count) + 's'.repeat(256 - count * 2);
    pairs -= count;
  }
  assert.equal(pairs, 0);
  info.DockerRootDir = info.DockerRootDir.slice(extra);
  assert.equal(asciiLine(expectedRecord(info)).length, target);
  return info;
}

add('nominal all metadata', { verify: (r) => assert.deepEqual(r, expectedRecord(metadata())) });
add('all optional missing', {
  edit: (i) => { for (const key of optionalKeys) delete i[key]; },
  status: 'PARTIAL_METADATA',
  verify: (r) => { for (const key of optionalKeys) assert.equal(r.info[key], 'UNKNOWN'); }
});
add('all optional null', {
  edit: (i) => { for (const key of optionalKeys) i[key] = null; }, status: 'PARTIAL_METADATA',
  verify: (r) => { for (const key of optionalKeys) assert.equal(r.info[key], 'UNKNOWN'); }
});
add('missing API header alone partial', {
  headers: (b) => ['Content-Type', 'application/json', 'Content-Length', String(b.length)],
  status: 'PARTIAL_METADATA', verify: (r) => assert.equal(r.apiVersion, 'UNKNOWN')
});
add('empty security array observed rootless unknown', {
  edit: (i) => { i.SecurityOptions = []; }, verify: (r) => assert.equal(r.rootlessReported, 'UNKNOWN')
});
add('rootless marker exactness', {
  edit: (i) => { i.SecurityOptions = ['name=rootlessx', 'Name=rootless', ' name=rootless', 'name=rootless ']; },
  verify: (r) => assert.equal(r.rootlessReported, 'UNKNOWN')
});
add('zero resources preserved without partial', {
  edit: (i) => { i.NCPU = 0; i.MemTotal = 0; },
  verify: (r) => { assert.equal(r.info.NCPU, 0); assert.equal(r.info.MemTotal, 0); }
});
for (const key of infoKeys.slice(0, 3)) {
  add(`missing mandatory ${key}`, { edit: (i) => { delete i[key]; }, reason: 'SCHEMA' });
  add(`null mandatory ${key}`, { edit: (i) => { i[key] = null; }, reason: 'SCHEMA' });
}
for (const [key, value] of [
  ['KernelVersion', 7], ['CgroupDriver', {}], ['CgroupVersion', []], ['DockerRootDir', false],
  ['SecurityOptions', 'name=rootless'], ['SecurityOptions', [7]], ['NCPU', '4'], ['MemTotal', {}],
  ['ServerVersion', ''], ['KernelVersion', ''], ['SecurityOptions', ['']]
]) add(`wrong selected type/value ${key} ${JSON.stringify(value)}`, { edit: (i) => { i[key] = value; }, reason: 'SCHEMA' });
for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
  for (const key of ['NCPU', 'MemTotal']) {
    add(`invalid resource ${key} ${value}`, { edit: (i) => { i[key] = value; }, reason: 'SCHEMA' });
  }
}
for (const [label, value] of [['C0', 'x\u0000y'], ['C1', 'x\u0085y'], ['DEL', 'x\u007fy'],
  ['high surrogate', '\ud800'], ['low surrogate', '\udc00']]) {
  add(`selected text rejects ${label}`, { edit: (i) => { i.ServerVersion = value; }, reason: 'SCHEMA' });
}
add('valid Unicode preserves values with ASCII output', {
  edit: (i) => { i.KernelVersion = 'éĀ😀'; }, verify: (r, line) => {
    assert.equal(r.info.KernelVersion, 'éĀ😀');
    assert.ok(line.includes('\\u00e9\\u0100\\ud83d\\ude00'));
  }
});
for (const [key, cap] of [['ServerVersion', 256], ['KernelVersion', 256], ['DockerRootDir', 4096]]) {
  for (const offset of [-1, 0, 1]) {
    add(`string byte cap ${key} ${offset}`, {
      edit: (i) => { i[key] = 'x'.repeat(cap + offset); }, ...(offset > 0 ? { reason: 'BOUNDS' } : {})
    });
  }
}
add('UTF8 bytes exceed bound despite shorter JS length', {
  edit: (i) => { i.ServerVersion = 'é'.repeat(129); }, reason: 'BOUNDS'
});
for (const count of [31, 32, 33]) add(`security count ${count}`, {
  edit: (i) => { i.SecurityOptions = Array.from({ length: count }, () => 'safe'); },
  ...(count > 32 ? { reason: 'BOUNDS' } : {})
});
for (const length of [255, 256, 257]) add(`security string length ${length}`, {
  edit: (i) => { i.SecurityOptions = ['x'.repeat(length)]; }, ...(length > 256 ? { reason: 'BOUNDS' } : {})
});
for (const length of [16383, 16384, 16385]) add(`ASCII output cap ${length}`, {
  replaceInfo: () => outputEdge(length), ...(length > 16384 ? { reason: 'BOUNDS' } : {}),
  ...(length <= 16384 ? { verify: (r, line) => assert.equal(line.length, length) } : {})
});
add('duplicate JSON last wins actually accepted', {
  bytes: (i) => Buffer.from('{"ServerVersion":"discarded",' + JSON.stringify(i).slice(1)),
  verify: (r) => assert.equal(r.info.ServerVersion, '28.5.1')
});
add('JSON numeric overflow is not a safe integer', {
  bytes: (i) => Buffer.from(JSON.stringify(i).replace('"NCPU":4', '"NCPU":1e999')), reason: 'SCHEMA'
});
add('unselected secrets proxies registries and body error ignored', {
  edit: (i) => Object.assign(i, {
    HttpProxy: SECRET, RegistryConfig: { secret: SECRET }, Swarm: { secret: SECRET },
    Name: SECRET, ID: SECRET, Warnings: [SECRET], error: SECRET, stack: SECRET
  })
});
add('proto property does not supply own mandatory', {
  bytes: () => Buffer.from('{"__proto__":{"ServerVersion":"fake"},"OSType":"linux","Architecture":"x64"}'), reason: 'SCHEMA'
});
for (const [label, bytes, reason] of [
  ['malformed UTF8', Buffer.from([0xc3, 0x28]), 'UTF8_JSON'],
  ['initial BOM preserved and rejected', Buffer.from('\ufeff{}'), 'UTF8_JSON'],
  ['malformed JSON secret', Buffer.from('{"secret":"' + SECRET), 'UTF8_JSON'],
  ['top null', Buffer.from('null'), 'SCHEMA'], ['top array', Buffer.from('[]'), 'SCHEMA'],
  ['top number', Buffer.from('7'), 'SCHEMA']
]) add(label, { bytes: () => Buffer.from(bytes), reason });
for (const statusCode of [201, 301, 302, 401, 500]) add(`non200 ${statusCode}`, { statusCode, reason: 'HTTP_FRAMING' });
for (const [name, value] of [['Content-Length', '1'], ['Content-Type', 'application/json'],
  ['Content-Encoding', 'identity'], ['Api-Version', '1.47'], ['Transfer-Encoding', 'chunked']]) {
  add(`duplicate raw critical header ${name}`, {
    headers: () => [...noLength(), ...(name === 'Content-Type' || name === 'Api-Version' ? [] : [name, value]), name.toLowerCase(), value],
    reason: 'HTTP_FRAMING'
  });
}
add('CL plus TE rejected', { headers: (b) => [...rawHeaders(b), 'Transfer-Encoding', 'chunked'], reason: 'HTTP_FRAMING' });
for (const value of ['text/plain', 'application/json; charset="utf-8"', 'application/json; charset=latin1',
  'application/json; other=x', 'application/json, application/json']) {
  add(`wrong content type ${value}`, { headers: () => ['Content-Type', value], reason: 'HTTP_FRAMING' });
}
add('content type UTF8 OWS casing accepted', {
  headers: (b) => ['Content-Type', '\tApplication/JSON ; charset = UTF-8\t', 'Api-Version', '1.47', 'Content-Length', String(b.length)]
});
add('missing CT rejected', { headers: () => ['Api-Version', '1.47'], reason: 'HTTP_FRAMING' });
for (const value of ['gzip', '', 'identity, identity']) add(`wrong encoding ${value}`, {
  headers: () => [...noLength(), 'Content-Encoding', value], reason: 'HTTP_FRAMING'
});
add('identity and chunked OWS casing accepted', {
  headers: () => [...noLength(), 'Content-Encoding', ' Identity\t', 'Transfer-Encoding', '\tCHUNKED ']
});
for (const value of ['gzip', 'chunked, chunked', '']) add(`wrong transfer encoding ${value}`, {
  headers: () => [...noLength(), 'Transfer-Encoding', value], reason: 'HTTP_FRAMING'
});
for (const name of ['Trailer', 'Upgrade']) for (const value of ['', 'x']) add(`forbidden declaration ${name} ${value}`, {
  headers: () => [...noLength(), name, value], reason: 'HTTP_FRAMING'
});
for (const value of ['', ' 1.47', '1.47 ', '1.2.3']) add(`invalid API exact value ${JSON.stringify(value)}`, {
  headers: () => ['Content-Type', 'application/json', 'Api-Version', value],
  reason: value === '' ? 'SCHEMA' : 'HTTP_FRAMING'
});
for (const length of [255, 256, 257]) add(`API byte bound ${length}`, {
  headers: () => ['Content-Type', 'application/json', 'Api-Version', '1'.repeat(length - 2) + '.1'],
  ...(length > 256 ? { reason: 'BOUNDS' } : {})
});
add('raw headers not array', { headers: () => ({}), reason: 'HTTP_FRAMING' });
add('raw headers odd', { headers: () => ['Content-Type'], reason: 'HTTP_FRAMING' });
add('raw headers nonstring', { headers: () => ['Content-Type', 7], reason: 'HTTP_FRAMING' });
add('raw headers nonLatin1', { headers: () => [...noLength(), 'X-Test', 'Ā'], reason: 'HTTP_FRAMING' });
add('raw headers invalid control', { headers: () => [...noLength(), 'X-Test', 'x\ry'], reason: 'HTTP_FRAMING' });
add('raw header element cap overflow', { headers: () => Array(4098).fill('x'), reason: 'BOUNDS' });
for (const total of [8191, 8192, 8193]) add(`raw header aggregate ${total}`, {
  headers: () => {
    const h = noLength();
    let size = 0;
    for (let i = 0; i < h.length; i += 2) size += h[i].length + h[i + 1].length + 4;
    return [...h, 'X', 'a'.repeat(total - size - 5)];
  }, ...(total > 8192 ? { reason: 'BOUNDS' } : {})
});
for (const value of ['-1', '+1', '1.0', ' 1', '1,1', '']) add(`invalid CL ${JSON.stringify(value)}`, {
  headers: () => [...noLength(), 'Content-Length', value], reason: 'HTTP_FRAMING'
});
add('declared length over cap', { headers: () => [...noLength(), 'Content-Length', '131073'], reason: 'BOUNDS' });
add('leading zero digit length accepted without coercive grammar', {
  headers: (b) => [...noLength(), 'Content-Length', '000' + String(b.length)]
});
add('declared actual short', { headers: (b) => [...noLength(), 'Content-Length', String(b.length + 1)], reason: 'HTTP_FRAMING' });
add('declared actual long', { headers: (b) => [...noLength(), 'Content-Length', String(b.length - 1)], reason: 'HTTP_FRAMING' });
add('incomplete body end', { complete: false, reason: 'HTTP_FRAMING' });
add('empty complete body is not JSON', { bytes: () => Buffer.alloc(0), reason: 'UTF8_JSON' });
add('end trailers rejected', { trailers: ['X-Trailer', 'value'], reason: 'HTTP_FRAMING' });
add('end trailers malformed rejected', { trailers: {}, reason: 'HTTP_FRAMING' });
add('nonBuffer chunk', { chunks: [{ at: 20, data: 'not a buffer' }], reason: 'HTTP_FRAMING' });
for (const length of [131071, 131072, 131073]) add(`bounded body bytes ${length}`, {
  bytes: (i) => {
    const json = Buffer.from(JSON.stringify(i));
    return Buffer.concat([json, Buffer.alloc(length - json.length, 0x20)]);
  }, headers: noLength, ...(length > 131072 ? { reason: 'BOUNDS' } : {})
});
add('body accumulated overflow guarded before copy', {
  headers: noLength,
  chunks: [{ at: 20, data: Buffer.alloc(131072, 0x20) }, { at: 21, data: Buffer.from('x') }], reason: 'BOUNDS'
});
for (const [target, event, reason] of [
  ['req', 'information', 'HTTP_FRAMING'], ['req', 'upgrade', 'HTTP_FRAMING'],
  ['req', 'connect', 'HTTP_FRAMING'], ['res', 'aborted', 'HTTP_FRAMING'],
  ['res', 'error', 'IO'], ['req', 'error', 'IO'], ['socket', 'error', 'IO'],
  ['res', 'close', 'HTTP_FRAMING'], ['socket', 'close', 'HTTP_FRAMING'], ['req', 'close', 'HTTP_FRAMING']
]) add(`transport ${target} ${event}`, { inject: { target, event, at: 15 }, reason });
add('late upgrade socket also guarded and destroyed', {
  inject: { target: 'req', event: 'upgrade', at: 40 }, verify: (r) => assert.equal(r.status, 'OBSERVED_METADATA')
});
add('request synchronous exception sanitized', { requestThrow: true, reason: 'IO', ends: 0 });
add('response getter exception sanitized', { headerGetterThrow: true, reason: 'IO' });
add('response header getter cannot outrun header deadline', { headerCost: 990, reason: 'DEADLINE' });
add('complete getter cannot outrun body deadline', { completeCost: 1970, reason: 'DEADLINE' });
add('header timeout absent response', { noResponse: true, reason: 'DEADLINE' });
add('header at exact 1s boundary expired', { headerAt: 1000, endAt: 1100, reason: 'DEADLINE' });
add('body at exact 2s boundary expired', { endAt: 2000, reason: 'DEADLINE' });
add('body just before 2s accepted then parse under whole', { endAt: 1999 });
add('accepted end cancels body clock before parsing', { endAt: 1999, parseCost: 1000 });
add('body period never renewed after late headers', {
  headerAt: 900, chunks: [{ at: 1900, body: true }], endAt: 2001, reason: 'DEADLINE'
});
add('trickle cannot renew body clock', {
  headers: noLength,
  chunks: Array.from({ length: 21 }, (_, i) => ({ at: 100 + i * 99, data: Buffer.from(' ') })),
  endAt: 2200, reason: 'DEADLINE'
});
add('early timers rearm original deadlines', { earlyTimers: true, noResponse: true, reason: 'DEADLINE' });
add('early body timer rearm original deadline', {
  earlyTimers: true, earlyRearm: 2000, endAt: 2001, reason: 'DEADLINE'
});
add('early whole timer rearm pending output', { earlyTimers: true, writeNever: true, exit: 3 });
add('whole includes uid getter boundary before requests', { uidCost: 5000, reason: 'DEADLINE', requests: 0 });
add('whole includes kernel getter boundary before requests', { releaseCost: 5000, reason: 'DEADLINE', requests: 0 });
add('request clocks begin after parent getter', { uidCost: 3000 });
add('whole includes actual parse phase', { parseCost: 4970, reason: 'DEADLINE' });
add('whole includes output serialization phase', { stringifyCost: 4970, reason: 'DEADLINE' });
add('parse exception never emits secret error', { parseThrow: true, reason: 'UTF8_JSON' });
add('serialization exception never emits secret error', { stringifyThrow: true, reason: 'IO' });
for (const [name, settings, reason] of [
  ['missing getuid', { noUid: true }, 'SCHEMA'], ['throwing uid getter', { uidThrow: true }, 'IO'],
  ['negative uid', { uid: -1 }, 'SCHEMA'], ['unsafe uid', { uid: Number.MAX_SAFE_INTEGER + 1 }, 'SCHEMA'],
  ['fractional uid', { uid: 0.25 }, 'SCHEMA'], ['throwing platform getter', { platformThrow: true }, 'IO'],
  ['invalid platform', { platform: 'x\u0085' }, 'SCHEMA'], ['invalid arch', { arch: '' }, 'SCHEMA'],
  ['throwing release getter', { releaseThrow: true }, 'IO'], ['invalid kernel', { kernel: '\ud800' }, 'SCHEMA'],
  ['parent byte cap', { kernel: 'x'.repeat(257) }, 'BOUNDS']
]) add(name, { ...settings, reason, requests: 0 });
add('success late response socket and errors no second record', { lateObjects: true });
add('stdout synchronous throw after submission', { writeThrow: true, exit: 3 });
add('stdout callback error', { writeCallbackError: true, exit: 3 });
add('stdout error event guarded', { writeErrorEvent: true, exit: 3 });
add('stdout never callback bounded by whole', { writeNever: true, exit: 3 });
add('stdout exact whole boundary callback', { writeDelay: 4970, exit: 3 });
add('stdout delayed callback past whole ignored', { writeDelay: 6000, exit: 3 });
add('stdout false return timely callback succeeds', { backpressure: true });
add('stdout false return without callback fails bounded', { backpressure: true, writeNever: true, exit: 3 });

async function runCase(c) {
  let now = 0;
  let sequence = 0;
  let nextTimer = 0;
  let requestCount = 0;
  let endCount = 0;
  let maximumTimers = 0;
  let done = false;
  let evaluationError;
  let timersAtSettlement;
  const jobs = [];
  const timers = new Map();
  const timerHistory = [];
  const earlySlots = new Set();
  const objects = [];
  const writes = [];
  const links = [];
  const optionSnapshots = [];
  const endArguments = [];
  const guardFailures = [];
  const missingEndListeners = [];
  const results = {};
  function at(when, callback) { jobs.push({ due: when, order: ++sequence, callback }); }
  function timer(callback, delay) {
    assert.ok(Number.isFinite(delay) && delay >= 0);
    const id = ++nextTimer;
    const deadline = now + delay;
    let due = deadline;
    const initial = delay === 5000 ? 'whole' : delay === 1000 ? 'header' : delay === 2000 ? 'body' : null;
    if (c.earlyTimers && initial && !earlySlots.has(initial)) {
      earlySlots.add(initial);
      due = deadline - 1;
    }
    timers.set(id, { due, deadline, order: ++sequence, callback });
    timerHistory.push({ now, delay, deadline, due });
    maximumTimers = Math.max(maximumTimers, timers.size);
    assert.ok(maximumTimers <= 3, 'three fixed collector timer slots');
    return id;
  }
  function object(kind) {
    const emitter = new EventEmitter();
    emitter.kind = kind;
    emitter.destroyed = false;
    emitter.destroy = () => {
      if (emitter.destroyed) return;
      emitter.destroyed = true;
      if (emitter.listenerCount('error') === 0) guardFailures.push(kind);
      emitter.emit('close');
      emitter.emit('error', new Error(SECRET));
    };
    objects.push(emitter);
    return emitter;
  }
  const stdout = object('stdout');
  stdout.write = (line, callback) => {
    writes.push(line);
    assert.equal(writes.length, 1, 'one stdout submission');
    if (c.writeThrow) throw new Error(SECRET);
    if (c.writeErrorEvent) at(now + 1, () => stdout.emit('error', new Error(SECRET)));
    if (!c.writeNever) at(now + (c.writeDelay ?? (c.writeErrorEvent ? 2 : 0)),
      () => callback(c.writeCallbackError ? new Error(SECRET) : undefined));
    return !c.backpressure;
  };
  const fakeProcess = { exitCode: undefined, stdout };
  Object.defineProperties(fakeProcess, {
    getuid: { get() {
      if (c.uidThrow) throw new Error(SECRET);
      if (c.noUid) return undefined;
      return () => { now += c.uidCost ?? 0; return c.uid ?? 1000; };
    } },
    platform: { get() { if (c.platformThrow) throw new Error(SECRET); return c.platform ?? 'linux'; } },
    arch: { get() { return c.arch ?? 'x64'; } }
  });
  const fakeOs = { release() {
    now += c.releaseCost ?? 0;
    if (c.releaseThrow) throw new Error(SECRET);
    return c.kernel ?? 'mock-kernel';
  } };
  const fakeHttp = { request(options) {
    requestCount++;
    assert.equal(requestCount, 1, 'no retry/fallback');
    optionSnapshots.push(Object.fromEntries(Reflect.ownKeys(options).map((key) => [key,
      key === 'headers' && options.headers && typeof options.headers === 'object'
        ? Object.fromEntries(Reflect.ownKeys(options.headers).map((name) => [name, options.headers[name]]))
        : options[key]
    ])));
    if (c.requestThrow) throw new Error(SECRET);
    const req = object('request');
    const res = object('response');
    const socket = object('socket');
    const start = now;
    let info = c.replaceInfo ? c.replaceInfo() : metadata();
    if (c.edit) c.edit(info);
    const bytes = c.bytes ? c.bytes(info) : Buffer.from(JSON.stringify(info));
    res.socket = socket;
    res.statusCode = c.statusCode ?? 200;
    const raw = c.headers ? c.headers(bytes) : rawHeaders(bytes);
    Object.defineProperty(res, 'rawHeaders', { get() {
      now += c.headerCost ?? 0;
      if (c.headerGetterThrow) throw new Error(SECRET);
      return raw;
    } });
    res.rawTrailers = c.trailers ?? [];
    let complete = false;
    Object.defineProperty(res, 'complete', { get() { now += c.completeCost ?? 0; return complete; } });
    req.end = (...args) => {
      endCount++;
      endArguments.push(args);
      assert.equal(endCount, 1, 'one end call');
      assert.deepEqual(args, [], 'empty request end, no body');
      for (const event of ['error', 'socket', 'response', 'information', 'upgrade', 'connect', 'close']) {
        if (req.listenerCount(event) === 0) missingEndListeners.push(event);
      }
      at(start + 1, () => req.emit('socket', socket));
      if (!c.noResponse) {
        at(start + (c.headerAt ?? 10), () => req.emit('response', res));
        for (const chunk of c.chunks ?? [{ at: 20, body: true }]) {
          at(start + chunk.at, () => res.emit('data', chunk.body ? bytes : chunk.data));
        }
        at(start + (c.endAt ?? 30), () => {
          complete = c.complete ?? true;
          res.emit('end');
        });
      } else {
        at(start + 1100, () => req.emit('response', res));
      }
      if (c.inject) at(start + c.inject.at, () => {
        const target = c.inject.target === 'req' ? req : c.inject.target === 'res' ? res : socket;
        if (c.inject.event === 'upgrade' || c.inject.event === 'connect') {
          const specialRes = object('protocol-response');
          const specialSocket = object('protocol-socket');
          specialRes.socket = specialSocket;
          req.emit(c.inject.event, specialRes, specialSocket, Buffer.alloc(0));
        } else if (c.inject.event === 'information') req.emit('information', { statusCode: 100 });
        else target.emit(c.inject.event, new Error(SECRET));
      });
      if (c.lateObjects) {
        at(start + 40, () => {
          const lateRes = object('late-response');
          const lateSocket = object('late-socket');
          lateRes.socket = lateSocket;
          req.emit('response', lateRes);
          assert.ok(lateRes.destroyed && lateSocket.destroyed);
          lateRes.emit('error', new Error(SECRET));
          lateSocket.emit('error', new Error(SECRET));
          req.emit('error', new Error(SECRET));
        });
      }
    };
    return req;
  } };
  const context = vm.createContext({
    process: fakeProcess, performance: { now: () => now }, Buffer, TextDecoder,
    setTimeout: timer, clearTimeout: (id) => timers.delete(id),
    console: undefined, require: undefined, fetch: undefined
  });
  const actualJSON = vm.runInContext('JSON', context);
  context.JSON = {
    parse(text) {
      now += c.parseCost ?? 0;
      if (c.parseThrow) throw new Error(SECRET);
      return actualJSON.parse(text);
    },
    stringify(value) {
      if (value.status !== 'STOP') {
        now += c.stringifyCost ?? 0;
        if (c.stringifyThrow) throw new Error(SECRET);
      }
      return actualJSON.stringify(value);
    }
  };
  const allowed = new Map([
    ['node:http', new vm.SyntheticModule(['default'], function () { this.setExport('default', fakeHttp); }, { context })],
    ['node:os', new vm.SyntheticModule(['default'], function () { this.setExport('default', fakeOs); }, { context })]
  ]);
  const module = new vm.SourceTextModule(source, {
    context,
    importModuleDynamically: async () => { throw new Error('all dynamic imports forbidden'); }
  });
  await module.link((specifier) => {
    links.push(specifier);
    if (!allowed.has(specifier)) throw new Error('unexpected collector import');
    return allowed.get(specifier);
  });
  const evaluation = module.evaluate();
  evaluation.then(() => { timersAtSettlement = timers.size; done = true; },
    (error) => { evaluationError = error; done = true; });
  for (let turn = 0; turn < 1000; turn++) {
    for (let drain = 0; drain < 16; drain++) await Promise.resolve();
    if (done && jobs.length === 0 && timers.size === 0) break;
    let selected;
    let timerId;
    let jobIndex = -1;
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      if (!selected || job.due < selected.due || (job.due === selected.due && job.order < selected.order)) {
        selected = job; jobIndex = i; timerId = undefined;
      }
    }
    for (const [id, job] of timers) {
      if (!selected || job.due < selected.due || (job.due === selected.due && job.order < selected.order)) {
        selected = job; timerId = id; jobIndex = -1;
      }
    }
    assert.ok(selected, `${c.name}: evaluation must settle without hidden real work`);
    if (timerId !== undefined) timers.delete(timerId);
    else jobs.splice(jobIndex, 1);
    now = Math.max(now, selected.due);
    selected.callback();
    assert.ok(turn < 999, `${c.name}: finite driver bound`);
  }
  assert.ok(done, `${c.name}: awaited VM evaluation`);
  if (evaluationError) throw evaluationError;
  await evaluation;
  assert.deepEqual(links.sort(), ['node:http', 'node:os']);
  assert.equal(vm.runInContext('typeof require + ":" + typeof fetch + ":" + typeof process.env', context),
    'undefined:undefined:undefined');
  assert.equal(timers.size, 0, 'no remaining collector timers');
  assert.equal(timersAtSettlement, 0, 'cleanup cancels timers before evaluation resolves');
  assert.ok(maximumTimers <= 3, 'three fixed timer slots throughout');
  assert.equal(jobs.length, 0, 'all scripted late events drained');
  assert.equal(requestCount, c.requests ?? 1);
  assert.equal(endCount, c.ends ?? (requestCount ? 1 : 0));
  for (const options of optionSnapshots) assert.deepEqual(options, expectedOptions, 'complete closed request options');
  for (const args of endArguments) assert.deepEqual(args, [], 'empty request end, no body');
  assert.deepEqual(guardFailures, [], 'error guards precede every destruction');
  assert.deepEqual(missingEndListeners, [], 'request listeners precede end');
  assert.equal(writes.length, 1, 'exactly one attempted record, including delivery failures');
  const line = writes[0];
  assert.equal(typeof line, 'string');
  assert.ok(/^[\x00-\x7f]*\n$/.test(line));
  assert.equal(line.split('\n').length, 2, 'one LF, terminal only');
  assert.ok(Buffer.byteLength(line, 'utf8') <= 16384);
  assert.ok(!line.includes(SECRET), 'no raw/unselected/exception secret');
  const record = JSON.parse(line);
  if (c.reason) {
    assert.deepEqual(Object.keys(record), ['status', 'reason']);
    assert.equal(record.status, 'STOP');
    assert.ok(reasons.includes(record.reason));
    assert.equal(record.reason, c.reason);
  } else {
    assert.deepEqual(Object.keys(record), ['status', 'parent', 'info', 'apiVersion', 'rootlessReported']);
    assert.deepEqual(Object.keys(record.parent), ['uid', 'platform', 'arch', 'kernel']);
    assert.deepEqual(Object.keys(record.info), infoKeys);
    assert.equal(record.status, c.status ?? 'OBSERVED_METADATA');
    assert.ok(record.rootlessReported === true || record.rootlessReported === 'UNKNOWN');
  }
  assert.equal(fakeProcess.exitCode, c.exit ?? (c.reason ? 3 : 0));
  for (const item of objects) {
    if (item.kind === 'stdout') continue;
    assert.ok(item.destroyed, `${item.kind} closed even on late events`);
    assert.ok(item.listenerCount('error') > 0, `${item.kind} persistent error guard`);
    if (item.kind.endsWith('socket')) assert.equal(item.listenerCount('error'), 1, 'socket watcher is idempotent');
  }
  assert.ok(stdout.listenerCount('error') > 0, 'persistent stdout guard');
  if (c.exit === 3) assert.ok(stdout.destroyed, 'failed delivery closes stdout');
  if (c.earlyTimers) {
    assert.ok(timerHistory.some((t) => t.due < t.deadline));
    assert.ok(timerHistory.some((t) => t.delay === 1), 'early callback rearms original deadline');
    const original = c.earlyRearm ?? (c.noResponse ? 1000 : 5000);
    assert.ok(timerHistory.some((t) => t.now === original - 1 && t.deadline === original));
  }
  if (c.verify) c.verify(record, line);
  results.name = c.name;
  results.result = 'MOCK_PASS';
  return results;
}

assert.ok(cases.length >= 35);
const results = [];
for (const scenario of cases) results.push(await runCase(scenario));
console.log(JSON.stringify({ scope: 'NETWORK_FREE_VM_MOCK_ONLY', count: results.length, results }));
```
<!-- END F9 FEASIBILITY MOCK TESTS -->

## 12. Exact proposed entry — NOT APPROVED / NOT RUN

The entry uses the existing trusted Node/harness with no hostile preload, runtime/built-in mutation or tracing as a premise, not a new measurement. Outer-tool timeout is8000ms; it does not promise hard kernel/process-tree completion. The collector's5s clock starts after trusted startup/import, before selected getters and request creation.

The source-control entry reads this fixed repository document only, bounded131072 bytes plus one overflow byte, requires a regular nonsymlink file and unique collector markers, and verifies the registered collector size/SHA. It imports a data URL from those SAME checked bytes, without a private snapshot or different second read. This is preparation integrity, not Native immutable loading or authority.

Before collector import begins, entry failure emits fixed STOP/ENTRY. Once import starts, the entry never submits a fallback record, so an unexpected failure cannot append a second record after collector output. An absent/malformed/truncated/multiple record, nonzero exit or outer timeout always means STOP; even a success-shaped submitted record is invalid when exit/delivery failed. Controller-startup stderr is closed; missing output never becomes success.

<!-- BEGIN F9 FEASIBILITY ENTRY -->
```bash
(
  node --input-type=module <<'NODE'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
let started = false;
try {
  const fd = fs.openSync('_spec/_plans/native-ingress-feasibility.md', fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  const input = Buffer.alloc(131073);
  let used = 0;
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error('STOP');
    while (used < input.length) {
      const count = fs.readSync(fd, input, used, input.length - used, null);
      if (count === 0) break;
      used += count;
    }
  } finally { fs.closeSync(fd); }
  if (used > 131072) throw new Error('STOP');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(input.subarray(0, used));
  const a = '<!-- BEGIN F9 FEASIBILITY COLLECTOR -->\n```js\n';
  const b = '```\n<!-- END F9 FEASIBILITY COLLECTOR -->';
  if (text.split(a).length !== 2 || text.split(b).length !== 2) throw new Error('STOP');
  const code = Buffer.from(text.slice(text.indexOf(a) + a.length, text.indexOf(b)));
  if (code.length !== 14068 || createHash('sha256').update(code).digest('hex') !== '9232109d36f2c9040f76e344c3e9eacde3fcf0f8511c1a83a092d454c492f2e4') throw new Error('STOP');
  started = true;
  await import('data:text/javascript;base64,' + code.toString('base64'));
} catch {
  process.exitCode = 3;
  if (!started) process.stdout.write('{"status":"STOP","reason":"ENTRY"}\n');
}
NODE
) 2>&-
```
<!-- END F9 FEASIBILITY ENTRY -->

Collector, mock-controller and entry identities must match their final reviewed registration immediately before any future separately approved entry. A mismatch stops without repair, a changed digest, retry, alternative socket or follow-up operation. Neither this entry nor the disclosed daemon/helper/configuration/sensitive-input effects has operational approval. Full raw daemon bodies/headers/errors must never be emitted or persisted.

The publication/history, accepted bf38 and M1/M2 programs/records remain untouched. The isolated mocks establish no OS/physical daemon bound, authority realm/native permission, installed-root identity, DockerRootDir path reachability or F9 admission.

## 13. Final byte-review disposition — no operational grant

Final reviews cover the registered collector `9232109d`, mocks `05052e08` and entry `a2a7f94b`, not the superseded pre-correction identities. DevOps's sole LOW duplicate socket-watcher registration finding is resolved by idempotent registration and persisted single-error-listener assertions. Parent reran all parse checks and181 mocks on the corrected bytes; all passed without real HTTP or installed-root access.

| Read-only reviewer | Final scope / verdict |
|---|---|
| DevOps `ses_ea04badf3ffeQNbUofWkzqvw9s` |LOW resolved; no blocking findings; READY TO PRESENT exact single-GET residual-risk approval yes. No operational approval. |
| Adversarial `ses_ea02ce6a0ffeJAA0qf2l6g0NAN` |No findings in final delta; DOCS READY yes / READY TO PRESENT exact one-GET explicit-risk approval yes. Execution remains unapproved. |
| Security `ses_ea02ce638ffey239B5OCBBbTmZ` |No new security findings; DOCS READY yes / READY TO PRESENT exact single-GET informed-risk approval yes. Residual risk medium; hashes/tests were not independently rerun. |

Any execution request must identify full collector/entry SHA-256 values, byte counts, the one fixed socket/GET/selected parent getters, immediate repository artifact verification,8s outer bound and all client/server/sensitive-input/trusted-runtime residuals. Approval would grant one entry only, with no retry, follow-up query, installed-root read, container operation, source implementation or model/training authority. No daemon contact has occurred.

## 14. Recorded metadata observation — one query / grant consumed

**2026-10-21 · APPROVED ONCE / EXECUTED: OBSERVED_METADATA / GRANT CONSUMED.** This section records parent-supplied approval and execution facts; this documentation pass performs no execution, tests, hashes, daemon access or independent runtime verification. Runtime feasibility remains UNVERIFIED; `trainingReady:false` remains unchanged.

### Approval and exact consumed scope

Executor selected **`Approve one metadata query`** for the exact C/T/E packet registered in §10 and the full residual-risk scope. Approval covered the immediate repository-artifact identity check followed by one execution of the fixed32-line entry, selected parent getters and at most one literal unversioned Unix-socket `GET /info` at `/var/run/docker.sock`. The output whitelist remained §6; no additional endpoint, version negotiation, retry or follow-up was approved.

The approved bounds were body131072 bytes, headers8192 bytes, output16384 bytes including LF, whole collector5s, headers1s and complete body2s from request creation, with an outer tool limit8000ms. Existing trusted Node/harness startup and built-in module/source behavior remained premises. Approval did not establish namespace, identity or capability proof.

The approval explicitly disclosed the socket's broader administrative power, including host-root-equivalent power for a rootful daemon without determining whether this daemon was rootful. It disclosed possible daemon helper execution, callbacks, configuration collection and logging, plus transient receipt of sensitive unselected response fields. It promised no memory zeroization, hard kernel/process-tree deadline, hard RSS cap or global daemon-work bound. The client source restrictions were not a kernel-enforced GET-only capability.

The grant excluded container enumeration, create, exec, build, pull, source acquisition or implementation, captures, DockerRootDir filesystem access, installed Rust root/log reads, PATH/control/receipt access, configuration changes, tool acquisition, training and further operations. M1's STOP remains failed. M2's earlier success remains scoped to its own consumed grant; neither history nor its command/raw record changed.

### Immediate precheck and one entry execution

Parent immediately checked the frozen repository-document C/T/E identities against the §10 registrations and reported `F9_FEASIBILITY_BYTES_OK`. Parent then executed the exact32-line entry **once**, with working directory `/home/gu1lty/Projects/proveo/chess-coach` and outer timeout8000ms. The mock controller was not part of that actual query.

The tool completed with exit0; it reported neither outer timeout nor truncation. No UTC timestamp, measured duration, raw response byte count or observed server-helper execution is asserted. These are the supplied execution facts, not new verification by this documentation pass. The following is the exact already-whitelisted filtered tool result, not the raw daemon response:

```json
{"status":"OBSERVED_METADATA","parent":{"uid":1000,"platform":"linux","arch":"x64","kernel":"7.0.12"},"info":{"ServerVersion":"29.7.2","OSType":"linux","Architecture":"x86_64","KernelVersion":"7.0.12","CgroupDriver":"cgroupfs","CgroupVersion":"2","DockerRootDir":"/var/lib/docker","SecurityOptions":["name=seccomp,profile=builtin","name=cgroupns"],"NCPU":16,"MemTotal":20447125504},"apiVersion":"1.55","rootlessReported":"UNKNOWN"}
```

### What the observation does not establish

| Recorded clue | Interpretation boundary |
|---|---|
| Parent and daemon kernel strings both `7.0.12` | Matching reported strings only; not shared host/user/PID/mount/time namespace identity or proc readability. Parent uid1000 is a selected getter result, not daemon-user or native-authority proof. |
| `ServerVersion:29.7.2`, `apiVersion:1.55` | Reported metadata, not authenticated daemon binary identity. The earlier Moby v28.5.1 source discussion remains an effects example, not identification of the current daemon version or bytes. |
| `rootlessReported:UNKNOWN` | Absence of the exact rootless marker does not establish rootful operation. |
| `NCPU:16`, `MemTotal:20447125504` | Daemon-reported resource indicators, not effective quota, available headroom or admission for a future2CPU/4GB workload. |
| `DockerRootDir:/var/lib/docker` | Opaque text only; no resolve/stat/open, source-host store identity or filesystem authority follows. |
| Reported `SecurityOptions` | Not the full runtime policy for a selected container; the client requested no container create/list/inspect endpoint. |
| `CgroupDriver:cgroupfs`, `CgroupVersion:2` | Reported metadata, not actual controller enforcement, proc availability, init bytes, libraries or loaded-closure proof. |
| Fixed source-control bounds and exit0 | The checked actual program ran under trusted-runtime premises; this is not a physical wire-count measurement or a hard kernel/RSS/global daemon bound. |

The collector did not record or log raw unselected body fields, raw headers or errors. It created no receipt files, private control files or new logs and performed no installed Rust root access or post-root operation. Broader input was received transiently; filtering does not establish no secrets received, zeroization or absence of daemon-side effects. Possible helper execution, callbacks, configuration collection and logging remain disclosed risks, not newly observed events or observed absences.

The prior181 source-preparation mocks remain network-free MOCK ONLY evidence. This single actual observation does not convert them into actual-server integration coverage or prove all failure paths, wire behavior, daemon trust or downstream effects.

### Consumed authority and current design priority

The operational grant covered the immediate precheck and **one** entry execution; it is now **CONSUMED**. Do not query again, read another endpoint, inspect/stat the reported root directory, read proc, capture, build, change configuration, acquire tools/source or begin training. No automatic next operation follows this result. A new operation would require separate scope and authority; this record does not request renewed approval of the frozen packet.

The priority is now **scoped metadata collected once**, not a pending first metadata query. Future design may use these reported clues, but the [mechanism contracts](native-ingress-mechanisms.md#9-definite-next-design-work--not-an-operations-packet) and [implementation §11 continuation](native-ingress-implementation.md#11-mechanism-contract-continuation--proposal-only) retain their unresolved gates. Next design work concerns actual checked binding contracts, not automatic new probes. No authority realm is chosen, and no outer→inner causal gate, immutable host Rust loading, shared-meter ownership or absolute-clock bridge is proved.

This is not an F9-positive result, native execution authority, R-OUT/R-IN selection or R-NONE waiver. N3/current R4 stops, full F9 policy, BOTH-recipient1048576, cold10s, lifecycle300s including3s cleanup and separate generator2048 remain unchanged. The published83d implementation prefix, accepted bf38 and all M1/M2 raw history remain untouched. PLAN and the other mechanism/implementation documents are outside this edit; parent owns their current-status continuation.

The §13 verdicts cover C/T/E preparation and presentation only. Final read-only outcome/navigation reviews by Adversarial `ses_ea02ce6a0ffeJAA0qf2l6g0NAN` and Security `ses_ea02ce638ffey239B5OCBBbTmZ` reported no findings and DOCS READY yes, with no further operation or inspection authorized. Lead's four-document scope, published-history/frozen-program preservation, exact filtered-result comparison,28 local links/anchors and whitespace checks passed. No query or project-suite rerun accompanied those document checks; no new publication or Native implementation/test completion is claimed.

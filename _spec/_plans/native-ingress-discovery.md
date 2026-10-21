# F9 — historical fixed-path discovery wrapper prototypes

**2026-10-21 · HISTORICAL / DEPRECATED PROTOTYPE / UNAPPROVED / NEVER RUN · NOT THE CURRENT OPERATIONAL PROPOSAL.**

This file retains earlier433/830 wrapper history/payload without deleting user work; those prototypes remain HISTORICAL/UNAPPROVED/NEVER RUN. The [H01 failed-transcription incident](native-ingress-receipt.md) remains distinct from the later [exact H02 scoped PARTIAL result](native-ingress-retry.md#recorded-metadata-result). H02 entry/conditional read/separately approved formatting reread are complete; all grants are consumed. All older envelope/next-step wording below is historical, not permission for further01/02 access, metadata observations, retries or cleanup.

## Historical prototype command — not the current packet

Historical revision note, not a current candidate: the retained command is an unapproved revised prototype; its identity excludes delimiters/fences/framing. Earlier `f70f90909513a24c84316c99f452a3ada0fa8770adb9a304d0e0d7fe270b3346` was not ready for presentation because of inherited stdout-mode restoration/caller retention. The retained edit added mode restoration but conferred no execution approval. All433/830 prototype revisions remain NEVER RUN. Their static path counting is not a Python syntax test or execution proof; current receipt-command bytes live only in the linked packet, not this payload.

<!-- BEGIN F9 DISCOVERY COMMAND -->
```sh
/usr/bin/timeout --signal=TERM --kill-after=1s 20s /usr/bin/python3 -I -S -B - <<'PY'
import time
START = time.monotonic()

import json
import os
import resource
import selectors
import signal
import subprocess
import sys

CAPTURE_LIMIT = 32768
FINAL_LIMIT = 65536
WORK_DEADLINE = START + 15.0
CLEANUP_DEADLINE = START + 18.0
OUTPUT_DEADLINE = START + 19.0
interrupted = 0


def on_signal(signum, frame):
    global interrupted
    if not interrupted:
        interrupted = signum


def tighten(which, requested):
    soft, hard = resource.getrlimit(which)
    values = [requested]
    if soft != resource.RLIM_INFINITY:
        values.append(soft)
    if hard != resource.RLIM_INFINITY:
        values.append(hard)
    value = min(values)
    resource.setrlimit(which, (value, value))


FIXED_CHILD = r'''
import json
import os
import resource
import stat
import sys


def tighten(which, requested):
    soft, hard = resource.getrlimit(which)
    values = [requested]
    if soft != resource.RLIM_INFINITY:
        values.append(soft)
    if hard != resource.RLIM_INFINITY:
        values.append(hard)
    value = min(values)
    resource.setrlimit(which, (value, value))


for which, value in (
    (resource.RLIMIT_CPU, 10),
    (resource.RLIMIT_AS, 192 * 1024 * 1024),
    (resource.RLIMIT_NOFILE, 16),
    (resource.RLIMIT_FSIZE, 0),
    (resource.RLIMIT_CORE, 0),
):
    tighten(which, value)

PATHS = (
    "/home/gu1lty/Projects/proveo/chess-coach",
    "/tmp/opencode",
    "/var/lib/docker",
    "/usr/bin/python3",
    "/usr/bin/timeout",
    "/usr/bin/node",
    "/usr/bin/cargo",
    "/usr/bin/rustc",
    "/usr/bin/readelf",
    "/usr/bin/prlimit",
    "/usr/bin/docker",
    "/usr/bin/dockerd",
    "/usr/bin/containerd",
    "/usr/bin/runc",
    "/usr/bin/docker-init",
    "/usr/local/bin/node",
    "/usr/libexec/docker/docker-init",
    "/usr/lib/docker-init",
    "/var/run/docker.sock",
    "/usr/bin",
    "/usr/local/bin",
    "/usr/libexec/docker",
    "/usr/lib/docker",
    "/home/gu1lty/.rustup/toolchains",
    "/home/gu1lty/.local/share/mise/installs/node",
    "/home/gu1lty/.local/share/mise/installs/rust",
    "/home/gu1lty/Projects/proveo/chess-coach/node_modules",
    "/home/gu1lty/Projects/proveo/chess-coach/apps/starchess/node_modules",
)

VFS_PATHS = (
    "/home/gu1lty/Projects/proveo/chess-coach",
    "/tmp/opencode",
    "/var/lib/docker",
)

KINDS = {
    stat.S_IFREG: "file",
    stat.S_IFDIR: "directory",
    stat.S_IFLNK: "symlink",
    stat.S_IFSOCK: "socket",
    stat.S_IFIFO: "fifo",
    stat.S_IFCHR: "character_device",
    stat.S_IFBLK: "block_device",
}

records = []
partial = False

for path in PATHS:
    record = {
        "operation": "lstat",
        "path": path,
        "kind": None,
        "mode": None,
        "size": None,
        "device": None,
        "inode": None,
        "errno": None,
    }
    try:
        result = os.lstat(path)
        record.update(
            kind=KINDS.get(stat.S_IFMT(result.st_mode), "other"),
            mode=result.st_mode,
            size=result.st_size,
            device=result.st_dev,
            inode=result.st_ino,
        )
    except OSError as error:
        record["errno"] = error.errno
        partial = True
    records.append(record)

for path in VFS_PATHS:
    record = {
        "operation": "statvfs",
        "path": path,
        "availableBytes": None,
        "freeInodes": None,
        "errno": None,
    }
    try:
        result = os.statvfs(path)
        record.update(
            availableBytes=result.f_bavail * result.f_frsize,
            freeInodes=result.f_ffree,
        )
    except OSError as error:
        record["errno"] = error.errno
        partial = True
    records.append(record)

report = {
    "status": "PARTIAL" if partial else "COMPLETE",
    "scope": "fixed_path_metadata_only",
    "configuredCallsFinished": True,
    "expectedCalls": len(PATHS) + len(VFS_PATHS),
    "callsFinished": len(records),
    "records": records,
}

payload = (
    json.dumps(report, ensure_ascii=True, separators=(",", ":")) + "\n"
).encode("ascii")

if len(payload) > 24576:
    payload = b'{"status":"STOP","reason":"CHILD_OUTPUT_LIMIT"}\n'
    exit_code = 3
else:
    exit_code = 0

offset = 0
while offset < len(payload):
    written = os.write(1, payload[offset:])
    if written <= 0:
        raise RuntimeError("output failure")
    offset += written

sys.exit(exit_code)
'''


def emit(report):
    previous_blocking = None
    try:
        payload = (
            json.dumps(report, ensure_ascii=True, separators=(",", ":")) + "\n"
        ).encode("ascii")

        if len(payload) > FINAL_LIMIT:
            payload = b'{"status":"STOP","reason":"FINAL_OUTPUT_LIMIT"}\n'
            success_status = False
        else:
            success_status = True

        previous_blocking = os.get_blocking(1)
        os.set_blocking(1, False)
        offset = 0
        while offset < len(payload):
            if interrupted or time.monotonic() >= OUTPUT_DEADLINE:
                return False
            try:
                written = os.write(1, payload[offset:])
            except BlockingIOError:
                time.sleep(0.01)
                continue
            except InterruptedError:
                continue
            if written <= 0:
                return False
            offset += written
        return success_status
    except Exception:
        return False
    finally:
        if previous_blocking is not None:
            try:
                os.set_blocking(1, previous_blocking)
            except Exception:
                return False


def main():
    proc = None
    selector = None
    streams = {}
    buffers = {"stdout": bytearray(), "stderr": bytearray()}
    bytes_read = {"stdout": 0, "stderr": 0}
    eof = {"stdout": False, "stderr": False}
    retained = 0
    overflow = False
    reason = None
    cleanup = "NOT_SPAWNED"
    return_code = None
    observations = None

    try:
        for signum in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
            signal.signal(signum, on_signal)

        for which, value in (
            (resource.RLIMIT_CPU, 12),
            (resource.RLIMIT_AS, 256 * 1024 * 1024),
            (resource.RLIMIT_NOFILE, 32),
            (resource.RLIMIT_FSIZE, 0),
            (resource.RLIMIT_CORE, 0),
        ):
            tighten(which, value)

        for name in (
            "get_blocking", "set_blocking", "waitid", "P_PID",
            "WEXITED", "WNOHANG", "WNOWAIT", "killpg",
        ):
            if not hasattr(os, name):
                raise RuntimeError("required supervisor API absent")

        if interrupted:
            reason = "SIGNAL"
        elif time.monotonic() >= WORK_DEADLINE:
            reason = "DEADLINE_BEFORE_SPAWN"
        else:
            selector = selectors.DefaultSelector()
            proc = subprocess.Popen(
                ["/usr/bin/python3", "-I", "-S", "-B", "-c", FIXED_CHILD],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd="/",
                env={"PATH": "/usr/bin:/bin", "LANG": "C"},
                close_fds=True,
                start_new_session=True,
                bufsize=0,
            )
            proc.stdin.close()

            streams = {"stdout": proc.stdout, "stderr": proc.stderr}
            for name, stream in streams.items():
                os.set_blocking(stream.fileno(), False)
                selector.register(stream, selectors.EVENT_READ, name)

            while reason is None:
                if interrupted:
                    reason = "SIGNAL"
                    break

                now = time.monotonic()
                if now >= WORK_DEADLINE:
                    reason = "DEADLINE"
                    break

                exited = os.waitid(
                    os.P_PID,
                    proc.pid,
                    os.WEXITED | os.WNOHANG | os.WNOWAIT,
                )

                if all(eof.values()) and exited is not None:
                    break

                events = selector.select(min(0.1, WORK_DEADLINE - now))
                for key, unused_mask in events:
                    name = key.data
                    remaining = CAPTURE_LIMIT - retained
                    request = min(4096, remaining + 1)

                    try:
                        data = os.read(key.fileobj.fileno(), request)
                    except (BlockingIOError, InterruptedError):
                        continue

                    if not data:
                        eof[name] = True
                        selector.unregister(key.fileobj)
                        continue

                    bytes_read[name] += len(data)
                    if len(data) > remaining:
                        overflow = True
                        reason = "CAPTURE_OVERFLOW"
                        break

                    buffers[name].extend(data)
                    retained += len(data)

    except Exception:
        if reason is None:
            reason = "SUPERVISOR_ERROR"

    finally:
        if proc is not None:
            kill_error = False

            # Keep the leader unreaped until after the owned-group signal.
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            except OSError:
                kill_error = True

            for stream in (proc.stdin, proc.stdout, proc.stderr):
                if stream is not None:
                    try:
                        stream.close()
                    except Exception:
                        pass

            reap_deadline = min(
                CLEANUP_DEADLINE,
                time.monotonic() + 3.0,
            )
            try:
                return_code = proc.wait(
                    timeout=max(0.0, reap_deadline - time.monotonic())
                )
                cleanup = "KILL_ERROR_REAPED" if kill_error else "REAPED"
                if kill_error and reason is None:
                    reason = "CLEANUP_ERROR"
            except subprocess.TimeoutExpired:
                cleanup = "REAP_TIMEOUT"
                reason = "CLEANUP_TIMEOUT"
            except Exception:
                cleanup = "REAP_ERROR"
                reason = "CLEANUP_ERROR"

        if selector is not None:
            try:
                selector.close()
            except Exception:
                if reason is None:
                    reason = "SUPERVISOR_ERROR"

    if interrupted:
        reason = "SIGNAL"

    capture_complete = all(eof.values()) and not overflow

    if reason is None:
        if return_code != 0:
            reason = "CHILD_EXIT"
        elif not capture_complete:
            reason = "INCOMPLETE_CAPTURE"
        elif bytes_read["stderr"]:
            reason = "CHILD_STDERR"
        else:
            try:
                candidate = json.loads(bytes(buffers["stdout"]))
                valid = (
                    isinstance(candidate, dict)
                    and candidate.get("status") in ("COMPLETE", "PARTIAL")
                    and candidate.get("configuredCallsFinished") is True
                    and candidate.get("expectedCalls") == 31
                    and candidate.get("callsFinished") == 31
                    and isinstance(candidate.get("records"), list)
                    and len(candidate["records"]) == 31
                )
                if not valid:
                    raise ValueError("invalid child report")
                observations = candidate
            except Exception:
                reason = "INVALID_CHILD_REPORT"

    if reason is not None:
        status = "STOP"
    else:
        status = observations["status"]

    report = {
        "status": status,
        "reason": reason,
        "receivedSignal": interrupted or None,
        "childReturnCode": return_code,
        "cleanup": cleanup,
        "capture": {
            "combinedRetentionLimitBytes": CAPTURE_LIMIT,
            "stdoutBytesRead": bytes_read["stdout"],
            "stderrBytesRead": bytes_read["stderr"],
            "retainedBytes": retained,
            "stdoutEOF": eof["stdout"],
            "stderrEOF": eof["stderr"],
            "overflow": overflow,
            "complete": capture_complete,
            "rawStreamsEmitted": False,
        },
        "observations": observations,
    }

    if not emit(report):
        return 3
    return {"COMPLETE": 0, "PARTIAL": 2, "STOP": 3}[status]


sys.exit(main())
PY
```
<!-- END F9 DISCOVERY COMMAND -->

## Historical prototype envelope and acceptance criteria

| Boundary | Configured behavior / limitation |
|---|---|
| Collection |Exactly28 fixed `lstat` calls and3 fixed `statvfs` calls. No enumeration, recursion, content reads, hashing, `readlink`, resource-file opens, socket connections, tool versions or Docker API contact in the collection logic. |
| Processes |Launching shell → absolute timeout → parent Python → one absolute child Python. Discovered tools are not executed. Missing prerequisites STOP without installation or fallback. |
| Child environment |Only fixed PATH and LANG; working directory `/`; no environment inspection/dump. |
| Post-bootstrap limits |Parent CPU12s/address space256MiB/descriptors32; child CPU10s/address space192MiB/descriptors16; file-growth/core limits0. Existing stricter limits remain stricter. These do not cover all interpreter startup/import/loader activity or prohibit every possible filesystem effect. |
| Work and cleanup |Parent collection deadline15s from its first timestamp; cleanup attempts owned child-group signal then reap for at most3s and parent elapsed18s; final emission through elapsed19s. Outer timeout20s plus1s kill grace. Scheduling, blocked process creation, uninterruptible kernel work or parent SIGKILL can defeat timely cleanup; no absolute orphan-prevention or wall-clock guarantee is claimed. |
| Captured streams |Combined child stdout/stderr retention32768 bytes. Overflow detection may read one additional byte without retaining it. Unexpected stderr or overflow STOP; raw streams are not emitted. |
| Final output |Serialized before emission, at most65536 bytes including LF. Timeout/shell/parent-bootstrap diagnostics lie outside the parent capture counter; the invoking harness must retain them under its own bounded channel. This command alone does not enforce caller retention policy. |
| Inherited stdout mode |Record its blocking mode before changing it; restore it in `finally` on every return/exception. Restoration failure produces a nonzero launcher status even if JSON was emitted. This revision still requires rereview; caller retention remains a separate unresolved prerequisite. |
| Outcomes |Require intact final JSON AND launcher exit status. Exit0/COMPLETE means configured metadata calls finished without observation errors only; exit2/PARTIAL records explicit observation errors; exit3/nonzero/timeout/incomplete JSON is STOP. None proves a component usable or F9 ready. |

`lstat` does not follow the final symlink, but intermediate pathname resolution may follow symlinks. `statvfs` resolves its supplied path. Neither proves canonical identity, a stable cross-call snapshot, mount ownership or the daemon's storage location. `availableBytes=f_bavail*f_frsize` and `freeInodes=f_ffree` are indicators, not effective quota/workload/Docker capacity.

Interpreter startup, imports, dynamic loading and supervision require runtime OS activity beyond the31 collection calls. Filesystem lookups can trigger automount or remote-filesystem activity, so this packet does not promise zero underlying network I/O. The program intentionally writes only pipes/stdout; `-B` disables Python bytecode-cache writes. Atime, runtime filesystem effects, host accounting and logging remain outside that statement. No intentional capture, repository writes, installation, build, container operation, credential access or security-posture change is included.

## Historical planning ledger — no current operational grant

### Selected sink design — security prerequisite unresolved

The architect's proposed small sink uses the already-running trusted harness Bash, not another Python wrapper. In an isolated subshell it would pin an existing approved base, lower inherited soft/hard `RLIMIT_FSIZE` before any external execution, and route stdout/stderr through one exclusively created receipt descriptor. Proposed single-use leaf: `/tmp/opencode/f9-preflight-bf38-sink-01.receipt`; no existing leaf may be reused, overwritten or appended. No such file has been created.

The proposed Bash POSIX-mode limit is `U=min(128, inherited finite soft units, inherited finite hard units)`, with512-byte units and `0<U`; thus proposed receipt extent `C=512*U<=65536` bytes. Existing stricter limits would remain stricter. This is a design, not a measured host fact or implemented enforcement. Python must not lower its file-size limit to zero when writing that receipt. A regular redirect alone is insufficient. The later reader must reject length at or above the effective cap, malformed/multiple JSON, exit-status disagreement and unconfirmed supervision; raw diagnostic output is never forwarded as successful discovery.

**Unresolved security boundary:** Bash pathname/ownership tests and noclobber alone do not unconditionally establish race-free intermediate-component handling, exact ACL/creation permissions or safety against concurrent same-UID mutation. The small design therefore requires an independently established secure/stable owner-controlled base and suitable ACL policy. Those prerequisites are NOT established here.

The alternative is separately planned strict descriptor-relative resolution and exclusive no-symlink leaf creation, with verified ownership/mode and independent tests. No suitable existing trusted opening helper has been identified; no helper implementation or execution follows from sink-design selection. The accepted F9 mapping and its native verification/resource obligations remain unchanged.

- Mapping: accepted separately at body SHA-256 `bf38a0fa226d6f1cb7141742a39c6961b484e629f375365636ac7a2854c7d5df`.
- Output-boundary choice: user selected **Design bounded sink (Recommended)** on2026-10-21. This authorizes design only; no sink creation, receipt writes or discovery execution is approved. The exact sink/file/time/cleanup command packet still needs review and separate approval.
- Receipt-security choice: user selected **Establish trusted base (Recommended)** on2026-10-21, initially authorizing planning only. A later separate approval authorized the one BASECHECK execution below, not the31-observation discovery or sink creation.
- Exact prerequisite packet: [exit-status-only BASECHECK](native-ingress-base-check.md), command SHA-256 `1b9e67aa5af10778722d8004c24c2aeaed382f4612c97c047c9fcd7e16f066ff`. Both static reviews found no issues; user approved one execution, now consumed. It created no receipt and retained no external-process stdout/stderr.
- Prerequisite execution: after both static reviews and explicit one-run approval, lead ran that exact BASECHECK once and received `F9_BASECHECK_OK`. This is a point-in-time directory-predicate result, not future stability, same-UID-adversary absence, receipt-creation permission or approval of the31-observation packet. The earlier wrapper prototypes above remain unapproved/unexecuted.
- This command packet: NOT APPROVED / NOT EXECUTED.
- Historical wrapper review blockers: the original stdout-mode issue had a proposed fix awaiting rereview; the exact numeric caller-retention mechanism remained OPEN. Previous presentation reviews approve neither this prototype nor the new capped-receipt packet.
- An integrated outer/inner proposal was drafted as an external review artifact, without execution. It bounds post-bootstrap launcher capture but explicitly leaves the outer interpreter/shell bootstrap diagnostics outside that counter. Adding another interpreter does not close this boundary. The current repository payload is not replaced or approved by that external artifact.
- Current component/capacity facts: UNKNOWN; this document supplies no observations.
- Source implementation/file routing/invoice/recipe/mixed audits/immutable loading/actual daemon-init identity/capture/build/container permissions remain separately blocked.

### Historical next-step note — superseded, not current permission

The selected next step is planning checks that establish trusted-base prerequisites for a fixed owned size-bounded evidence sink. This is not permission to create a sink or run those checks/discovery, and it does not assert that trusted-base prerequisites already hold. Any added file-write scope, exact paths, ownership/no-symlink handling, numeric limits and retention/cleanup policy require an explicit later command packet and approval. The existing wrapper payload above remains unapproved and is not the selected sink implementation.

Only after this blocker, static review and exact command hashing may a discovery-only execution packet be presented. Changed command bytes require a new approval. No broader traversal, version probes, audits, implementation or operations follow automatically from a discovery result.

## Recorded scoped H02 result — no remaining operational/read grant

Original8cf and all prototype/code bodies remain untouched. After separate exact H02 approval parent freshly ran the frozen verifier, received `F9_RETRY_CONTROL_BYTES_OK`, then immediately submitted ONLY the exact71-byte entry under30000ms. Tool output was PARTIAL/VALIDATED/cap65536/exit2. Initial conditional read clipped the JSON line; a subsequent separately approved ONE formatting-only reread displayed all31 records. That is21 successful metadata observations/10 ENOENT at exact checked paths, not another collector bug or global tool absence. [Full point-time results/limits](native-ingress-retry.md#recorded-metadata-result) preserve exact missing paths/candidate sizes/VFS indicators.
All BASECHECK/H01 diagnostic/H02 entry/conditional-read/formatter grants are consumed;01 stays untouched since diagnostic and both receipts stay retained. No further receipt read/stat/hash/retry/cleanup, native/capture/source operation or automatic next step is approved. Bounded selected-PATH lookup/readlink is only the next proposal under new static DevOps design, not an approved command. Full recipe/invoice/audit/loading/enforcement/native-context/implementation gates remain open; this doc update uses only supplied facts and accesses neither actual receipt.

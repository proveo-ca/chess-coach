# F9 — capped-receipt operational proposal

**2026-10-21 · HISTORICAL H01 FAILED-TRANSCRIPTION INCIDENT RETAINED · STOP / VALIDATION / EXIT3 ·01 DIAGNOSTIC READ CONSUMED · LATER H02 SCOPED PARTIAL/VALIDATED RESULT RECORDED SEPARATELY · ALL GRANTS CONSUMED / NO FURTHER OPERATIONS APPROVED.**

## Execution incident — outside the approved command

The user selected **Approve packet (Recommended)** for one exact `8cf659a6` run, including creation/retention and a read ONLY after validated COMPLETE/PARTIAL. Lead then submitted a command containing an extra leading space before the collector's top-level `def main():`. The submitted text therefore did NOT match the approved command bytes. This was a lead transcription error, not a discovered defect in the unchanged reviewed command below.

The tool returned exactly:

```text
F9_RECEIPT status=STOP reason=VALIDATION cap=65536 path=/tmp/opencode/f9-preflight-bf38-sink-01.receipt
Exited with code 3
```

No COMPLETE/PARTIAL result or successful metadata collection is claimed. At the STOP, the receipt was retained unread because the conditional read authorization had not activated. Diagnostic contents were not inspected until the separate approval recorded below. No automatic retry, alternate filename, overwrite, deletion or correction-and-rerun is authorized. The approved `8cf659a6` bytes below remain unchanged; this incident is not proof that they executed exactly.

After that STOP, the user separately selected **Inspect failure only (Recommended)**, authorizing one dedicated-tool read of the unchanged retained receipt within its64KiB cap, and no commands or retry. Lead performed exactly one `read` call of that path. It returned:

```text
  File "<string>", line 3
    def main():
IndentationError: unexpected indent
```

This confirms the H01 submitted collector parse error, not execution of the approved original bytes or successful metadata collection in that attempt. Its diagnostic-read grant is consumed;01 remains retained without overwrite/deletion and has been untouched since that read. No retry followed under those grants; the later separately approved H02 run is recorded independently below.

Any diagnostic read needs new explicit permission. Any corrected run needs a separately reviewed exact packet and launcher that transfers verified bytes mechanically rather than manually retranscribing the multi-line program; any new receipt path must be explicitly approved. All F9 implementation/capture/container/native-authority gates remain blocked.

After the diagnostic read, the user selected **Prepare verified retry (Recommended)**: preparation only, not execution. The failed `sink-01` receipt must remain untouched. A replacement path and mechanical verified-byte launcher require a new complete proposal, static review and exact operational approval. The unchanged approved body below is not a retry grant.

The [verified-artifact retry result](native-ingress-retry.md#recorded-metadata-result) records a later SEPARATE exact H02/entry approval. After approval lead freshly verified fixed H02/equality/metadata, immediately ran only the frozen71-byte entry with30000ms timeout, and obtained PARTIAL/VALIDATED/exit2/cap65536. Initial conditional read was clipped; a subsequent separately approved ONE formatting-only reread displayed the full31 records. Those grants are now consumed; preparation alone authorized none of them. Original H01 code remains the mechanical template, never the failed submitted argument.

This retained original H01 proposal is the authoritative mechanical template, not the current retry entry or a new execution grant. Parent verified its command identity as `8cf659a69f5b61993f7b7080501c13f2bc4e5c2dd54975b95bea87c0c445996f`,13,000 UTF-8 bytes/309 LF-terminated lines, against the reviewed external snapshot. That static identity does not prove the later submitted, mistranscribed text executed these bytes exactly. The [CURRENT prepared retry](native-ingress-retry.md) derives H02 by exactly five01→02 leaf substitutions; every other original byte remains unchanged. No original command/fence/marker is edited here, and no manual309-line retranscription is proposed.

Accepted bf38 mapping and implementation gates remain unchanged. The1b9 BASECHECK, H01 failed-attempt/01 diagnostic, later exact H02 entry/conditional02 read and separate formatting-only reread grants are ALL CONSUMED. No current permission remains for further source/execute/retry/receipt reads/stats/hashes/cleanup or01/02 access. H02 PARTIAL represents21 successful metadata observations and10 ENOENT at exact checked paths, not another collector bug or global tool absence. Earlier433/830 prototypes remain historical/unapproved/never run; no Native F9 result follows.

## Exact approval scope and required assumptions

The proposed **single-use** scope is: repeat the unchanged BASECHECK predicate → exclusively create ONE literal `/tmp/opencode/f9-preflight-bf38-sink-01.receipt` → attempt the fixed28 `lstat` plus three `statvfs` observations → close the writer → boundedly validate only the newly created receipt → retain it on every outcome. This is NEW CREATE+RETAIN scope, not an already approved read-only discovery operation.
The proposed new approval would authorize this repeat BASECHECK; it would not reuse the consumed approval. No existing receipt may be read, overwritten, appended, deleted or retried. An occupied leaf requires STOP and a new decision, not another filename or version. This persistence does not inspect whether that leaf currently exists.

**Execution precondition:** the packet must enter an already-running trusted, noninteractive, nontracing harness Bash.
That Bash must have trusted builtin resolution, no aliases/functions overriding command resolution, no active traps/startup hooks/debug instrumentation, ordinary signal handling, and no inherited caller descriptors beyond standard input/output/error.
The harness must not echo or trace the packet.
The trusted `/`, `/tmp`, `/tmp/opencode` pathname/ownership/ACL predicates must remain stable from the repeat guard through creation, collection, validation and any separately authorized bounded read.
**No concurrent same-UID mutation is an explicit precondition, not an observed fact.**
Trusted executables, loader, Python standard library and GNU timeout semantics are prerequisites, not attested by this packet.
The pathname opening design relies on these assumptions; it is not unconditional atomic-path security against hostile same-UID actors.

The packet changes resource limits only inside its isolated Bash subshell and descendants.
Bash establishes POSIX512-byte FSIZE units, queries both inherited limits with builtins, rejects zero/invalid values, clamps decimal strings before arithmetic, lowers soft then hard limits and verifies both.
`U = min(128, every finite inherited soft/hard FSIZE)` and `C = 512*U`, so `512 ≤ C ≤ 65536` after establishment.
The initial `cap=0` means no validated cap has yet been established.
Core limits become zero before external execution.
No heredoc, runtime control file, saved caller FD, stdout flag mutation, Python subprocess wrapper or Python fork appears below.

## Complete proposed command

Only the bytes inside this single fence constitute the command. The markers, Markdown, assumptions, identity and approval envelope are not executable bytes. Preserve the following markers/fence/command without quote, whitespace or reflow edits. All Python string literals use double quotes inside Bash single-quoted `-c` arguments.

<!-- BEGIN F9 CAPPED RECEIPT PROPOSED COMMAND -->
```bash
(
  exec 2>&-
  set +e +u
  set +o pipefail
  set +m
  set -o posix
  C=0
  finish() {
    printf 'F9_RECEIPT status=%s reason=%s cap=%s path=/tmp/opencode/f9-preflight-bf38-sink-01.receipt\n' "$1" "$2" "$C" || exit 3
    exit "$3"
  }
  umask 077 || finish STOP SETUP 3
  shopt -u varredir_close || finish STOP SETUP 3
  soft=$(ulimit -S -f) || finish STOP LIMIT_QUERY 3
  hard=$(ulimit -H -f) || finish STOP LIMIT_QUERY 3
  U=128
  for value in "$soft" "$hard"; do
    case "$value" in
      unlimited) continue ;;
      ''|*[!0123456789]*) finish STOP LIMIT_VALUE 3 ;;
    esac
    while [[ ${#value} -gt 1 && ${value:0:1} == 0 ]]; do value=${value:1}; done
    if [[ ${#value} -gt 3 ]]; then value=128
    elif (( 10#$value > 128 )); then value=128
    else value=$((10#$value)); fi
    (( value > 0 )) || finish STOP LIMIT_ZERO 3
    (( value >= U )) || U=$value
  done
  ulimit -S -f "$U" || finish STOP LIMIT_SET 3
  ulimit -H -f "$U" || finish STOP LIMIT_SET 3
  soft=$(ulimit -S -f) || finish STOP LIMIT_QUERY 3
  hard=$(ulimit -H -f) || finish STOP LIMIT_QUERY 3
  [[ $soft == "$U" && $hard == "$U" ]] || finish STOP LIMIT_VERIFY 3
  C=$((512 * U))
  ulimit -S -c 0 || finish STOP CORE_LIMIT 3
  ulimit -H -c 0 || finish STOP CORE_LIMIT 3
  if (
    exec 0<&- 1>&- 2>&-
    exec -c /usr/bin/timeout --signal=TERM --kill-after=1s 10s /usr/bin/python3 -I -S -B -c '
import errno, os, resource, stat, sys

class Stop(Exception):
    pass

fds = []
result = 22
try:
    for which, requested in (
        (resource.RLIMIT_CPU, 3),
        (resource.RLIMIT_AS, 128 * 1024 * 1024),
        (resource.RLIMIT_NOFILE, 16),
        (resource.RLIMIT_FSIZE, 0),
        (resource.RLIMIT_CORE, 0),
    ):
        soft, hard = resource.getrlimit(which)
        limit = min([requested] + [
            value for value in (soft, hard)
            if value != resource.RLIM_INFINITY
        ])
        resource.setrlimit(which, (limit, limit))

    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
    euid = os.geteuid()
    for index, component in enumerate(("/", "tmp", "opencode")):
        try:
            fd = os.open(
                component, flags,
                dir_fd=fds[-1] if fds else None,
            )
        except OSError as error:
            raise Stop(
                20 if error.errno == errno.ENOENT else
                21 if error.errno in (errno.ELOOP, errno.ENOTDIR) else 22
            )
        fds.append(fd)
        info = os.fstat(fd)
        if not stat.S_ISDIR(info.st_mode):
            raise Stop(21)
        if index < 2:
            if info.st_uid != 0:
                raise Stop(21)
            if info.st_mode & 0o022:
                if index == 0 or not info.st_mode & stat.S_ISVTX:
                    raise Stop(21)
        elif info.st_uid != euid or info.st_mode & 0o022:
            raise Stop(21)

        for attribute in (
            "system.posix_acl_access",
            "system.posix_acl_default",
        ):
            try:
                value = os.getxattr(fd, attribute)
            except OSError as error:
                if error.errno != errno.ENODATA:
                    raise Stop(22)
            else:
                if value:
                    raise Stop(21)
    result = 0
except Stop as error:
    result = error.args[0]
except Exception:
    result = 22
finally:
    for fd in reversed(fds):
        try:
            os.close(fd)
        except OSError:
            result = 22
sys.exit(result)
'
  ); then :; else finish STOP BASECHECK 3; fi
  cd -P -- /tmp/opencode || finish STOP BASE_DIRECTORY 3
  physical=$(pwd -P) || finish STOP BASE_DIRECTORY 3
  [[ $physical == /tmp/opencode && -O . ]] || finish STOP BASE_DIRECTORY 3
  [[ ! -e ./f9-preflight-bf38-sink-01.receipt && ! -L ./f9-preflight-bf38-sink-01.receipt ]] || finish STOP EXISTING_LEAF 3
  set -C
  if command exec {receipt_fd}>./f9-preflight-bf38-sink-01.receipt; then :; else finish STOP CREATE 3; fi
  if (
    exec 0<&- 1>&"$receipt_fd" 2>&1
    command exec {receipt_fd}>&- || exit 3
    exec -c /usr/bin/timeout --signal=TERM --kill-after=1s 10s /usr/bin/python3 -I -S -B -c '
import json, os, resource, stat, sys
def main():
    cap = int(sys.argv[1])
    if not 1 <= cap <= 65536 or resource.getrlimit(resource.RLIMIT_FSIZE) != (cap, cap):
        return 3
    for which, requested in ((resource.RLIMIT_CPU, 3), (resource.RLIMIT_AS, 128 * 1024 * 1024), (resource.RLIMIT_NOFILE, 16), (resource.RLIMIT_CORE, 0)):
        soft, hard = resource.getrlimit(which)
        limit = min([requested] + [v for v in (soft, hard) if v != resource.RLIM_INFINITY])
        resource.setrlimit(which, (limit, limit))
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
    VFS_PATHS = ("/home/gu1lty/Projects/proveo/chess-coach", "/tmp/opencode", "/var/lib/docker")
    kinds = {stat.S_IFREG: "file", stat.S_IFDIR: "directory", stat.S_IFLNK: "symlink", stat.S_IFSOCK: "socket", stat.S_IFIFO: "fifo", stat.S_IFCHR: "character_device", stat.S_IFBLK: "block_device"}
    records = []
    for path in PATHS:
        record = dict(operation="lstat", path=path, kind=None, mode=None, size=None, device=None, inode=None, errno=None)
        try:
            info = os.lstat(path)
            record.update(kind=kinds.get(stat.S_IFMT(info.st_mode), "other"), mode=info.st_mode, size=info.st_size, device=info.st_dev, inode=info.st_ino)
        except OSError as error:
            if type(error.errno) is not int or error.errno <= 0: return 3
            record["errno"] = error.errno
        records.append(record)
    for path in VFS_PATHS:
        record = dict(operation="statvfs", path=path, availableBytes=None, freeInodes=None, errno=None)
        try:
            info = os.statvfs(path)
            record.update(availableBytes=info.f_bavail * info.f_frsize, freeInodes=info.f_ffree)
        except OSError as error:
            if type(error.errno) is not int or error.errno <= 0: return 3
            record["errno"] = error.errno
        records.append(record)
    partial = any(r["errno"] is not None for r in records)
    report = dict(status="PARTIAL" if partial else "COMPLETE", scope="fixed_path_metadata_only", configuredCallsFinished=True, expectedCalls=31, callsFinished=len(records), records=records)
    payload = (json.dumps(report, ensure_ascii=True, separators=(",", ":")) + "\n").encode("ascii")
    if len(payload) > 24576 or len(payload) >= cap: return 3
    offset = 0
    while offset < len(payload):
        written = os.write(1, payload[offset:])
        if written <= 0: return 3
        offset += written
    return 2 if partial else 0
try:
    result = main()
except Exception:
    result = 3
sys.exit(result)
' "$C"
  ); then collector_rc=0; else collector_rc=$?; fi
  command exec {receipt_fd}>&- || finish STOP CLOSE_WRITER 3
  if (
    exec 0<&- 1>&- 2>&-
    exec -c /usr/bin/timeout --signal=TERM --kill-after=1s 5s /usr/bin/python3 -I -S -B -c '
import json, os, resource, stat, sys
fds = []
result = 3
def require(value):
    if not value: raise ValueError("invalid")
def integer(value):
    return type(value) is int and value >= 0
def unique(pairs):
    out = {}
    for key, value in pairs:
        require(key not in out)
        out[key] = value
    return out
def signature(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mode, info.st_uid, info.st_nlink, info.st_mtime_ns, info.st_ctime_ns)
try:
    cap, child = int(sys.argv[1]), int(sys.argv[2])
    require(1 <= cap <= 65536 and child in (0, 2))
    for which, requested in ((resource.RLIMIT_CPU, 3), (resource.RLIMIT_AS, 128 * 1024 * 1024), (resource.RLIMIT_NOFILE, 16), (resource.RLIMIT_FSIZE, 0), (resource.RLIMIT_CORE, 0)):
        soft, hard = resource.getrlimit(which)
        limit = min([requested] + [v for v in (soft, hard) if v != resource.RLIM_INFINITY])
        resource.setrlimit(which, (limit, limit))
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
    for component in ("/", "tmp", "opencode"):
        fds.append(os.open(component, flags, dir_fd=fds[-1] if fds else None))
    fd = os.open("f9-preflight-bf38-sink-01.receipt", os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK, dir_fd=fds[-1])
    fds.append(fd)
    before = os.fstat(fd)
    require(stat.S_ISREG(before.st_mode) and before.st_uid == os.geteuid() and stat.S_IMODE(before.st_mode) == 0o600 and before.st_nlink == 1)
    require(0 < before.st_size < cap and before.st_size <= 24576)
    data = bytearray()
    while len(data) < before.st_size:
        block = os.read(fd, before.st_size - len(data))
        require(bool(block))
        data.extend(block)
    require(signature(before) == signature(os.fstat(fd)))
    report = json.loads(data.decode("ascii"), object_pairs_hook=unique)
    require(type(report) is dict and tuple(report) == ("status", "scope", "configuredCallsFinished", "expectedCalls", "callsFinished", "records"))
    require((json.dumps(report, ensure_ascii=True, separators=(",", ":")) + "\n").encode("ascii") == bytes(data))
    require(report["scope"] == "fixed_path_metadata_only" and report["configuredCallsFinished"] is True)
    require(type(report["expectedCalls"]) is int and report["expectedCalls"] == 31 and type(report["callsFinished"]) is int and report["callsFinished"] == 31)
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
    VFS_PATHS = ("/home/gu1lty/Projects/proveo/chess-coach", "/tmp/opencode", "/var/lib/docker")
    expected = [("lstat", p) for p in PATHS] + [("statvfs", p) for p in VFS_PATHS]
    kinds = {stat.S_IFREG: "file", stat.S_IFDIR: "directory", stat.S_IFLNK: "symlink", stat.S_IFSOCK: "socket", stat.S_IFIFO: "fifo", stat.S_IFCHR: "character_device", stat.S_IFBLK: "block_device"}
    records = report["records"]
    require(type(records) is list and len(records) == 31)
    partial = False
    for record, (operation, path) in zip(records, expected):
        fields = ("kind", "mode", "size", "device", "inode") if operation == "lstat" else ("availableBytes", "freeInodes")
        require(type(record) is dict and tuple(record) == ("operation", "path") + fields + ("errno",))
        require(record["operation"] == operation and record["path"] == path)
        error = record["errno"]
        if error is not None:
            require(type(error) is int and error > 0 and all(record[f] is None for f in fields))
            partial = True
        else:
            require(all(integer(record[f]) for f in fields if f != "kind"))
            if operation == "lstat": require(record["kind"] == kinds.get(stat.S_IFMT(record["mode"]), "other"))
    require(report["status"] == ("PARTIAL" if partial else "COMPLETE") and child == (2 if partial else 0))
    result = 2 if partial else 0
except Exception:
    result = 3
finally:
    for fd in reversed(fds):
        try: os.close(fd)
        except OSError: result = 3
sys.exit(result)
' "$C" "$collector_rc"
  ); then validator_rc=0; else validator_rc=$?; fi
  case "$collector_rc:$validator_rc" in
    0:0) finish COMPLETE VALIDATED 0 ;;
    2:2) finish PARTIAL VALIDATED 2 ;;
    *) finish STOP VALIDATION 3 ;;
  esac
)
```
<!-- END F9 CAPPED RECEIPT PROPOSED COMMAND -->

## Static envelope, STOP gates and retention

| Boundary | Proposed behavior; runtime verification remains pending |
|---|---|
| Bootstrap channels | The trusted Bash subshell closes outer stderr as its first action. Each guard/validator child closes all standard descriptors before external execution. The collector closes stdin and duplicates the one owned receipt description onto stdout and stderr before external execution; it then closes its extra receipt FD. No saved harness output descriptor passes to external programs. |
| Guard | The Python predicate body is copied unchanged from the approved BASECHECK document/snapshot. It opens `/` → `tmp` → `opencode` descriptor-relatively with NOFOLLOW; checks directory ownership/mode/sticky rules; and inspects six fixed ACL attributes on the success path. Unsupported ACL queries, unsafe predicates and cleanup errors refuse. These declared control metadata operations are additional to the31 discovery observations. The guard child setting FSIZE0 does not lower the parent cap. |
| Physical base / creation | Bash performs builtin physical `cd`, checks `pwd -P` and current-directory ownership, refuses both existing leaves and dangling symlinks, enables noclobber, and attempts one exclusive leaf creation. `command exec` avoids POSIX special-builtin fatal-redirection treatment for the guarded creation/close operations. Failure emits only a fixed STOP reason; it launches no collector or reader and never reads a preexisting leaf. Umask077 plus the stable absent-default-ACL guard supplies private mode0600 without chmod. |
| Collector | One literal Python program under GNU timeout attempts only the unchanged literal28 PATHS `lstat` and three VFS_PATHS `statvfs` discovery calls. It checks inherited soft/hard FSIZE exactly equal validated numeric `C`. It lowers CPU3s/AS128MiB/NOFILE16/CORE0 to the minimum of requested and inherited finite limits. It does NOT set FSIZE0. It serializes compact ASCII JSON plus LF before writing, requires at most24576 bytes and strictly less than `C`, and returns0/COMPLETE or2/PARTIAL according to positive observation errno values. Other failures STOP. |
| File bound | The shared open-description offset combines collector bootstrap stdout/stderr and receipt bytes into one regular-file extent. The inherited kernel soft/hard FSIZE cap bounds that extent by `C ≤65536`, including timeout/Python bootstrap diagnostics. This is not an aggregate-I/O or all-OS-writes bound. Diagnostic prefixes/suffixes, partial writes, exactly-at-cap output, malformed data and smaller inherited caps cannot earn COMPLETE. No fallback/refund/retry occurs. |
| Writer handoff | Root Bash closes its own receipt FD after the collector attempt and before launching the validator. A failed close STOPs without a reader. It never reopens the receipt for writing, appending or truncation. The collector attempt returns before validation. |
| Validator | One separately timed Python program has closed stdio and clean environment. Its only variable arguments are numeric `C` and collector status; its leaf and directory components are literals. It lowers CPU3s/AS128MiB/NOFILE16/FSIZE0/CORE0, opens descriptor-relative NOFOLLOW directories and a NOFOLLOW/CLOEXEC/NONBLOCK read-only leaf, requires regular/euid-owned/exact0600/nlink1/`0<size<C`/size≤24576 before reading, and reads exactly the initial size with no overflow byte. Short reads refuse. Before/after fstat signatures match dev/inode/size/mode/uid/nlink/mtime_ns/ctime_ns, excluding atime. All descriptors close in finally; close failure STOPs. |
| Data validation | Duplicate keys refuse. One ASCII JSON document must reencode canonically plus LF to identical bytes. Exact ordered top/record keys and all31 fixed ordered operation/path pairs are required. Counts use strict integers, not booleans; configuredCallsFinished is literal true. Successful numbers are nonnegative strict integers; lstat kind matches mode. Failed records require positive strict errno and all result fields null. COMPLETE iff no observation error; PARTIAL otherwise. Only matching collector/validator0 or2 can succeed. An abnormal collector status causes validator refusal before receipt opening. JSON supplies observations, not source authority or native proof. |
| Supervision | Each `exec -c` supplies an empty environment to the absolute GNU timeout/Python pair. No Python process forks or launches another process. Normal GNU timeout owns its process group and waits for its direct child; no `--foreground` or stale-PG signaling appears. Guard10+1, collector10+1 and validator5+1 total28 configured seconds. A separate harness30s limit is proposed. These are not absolute OS scheduling, kernel-stall, cancellation, successful-reaping or cleanup guarantees. |
| Final channel | Bash emits only one fixed-format ASCII line, at most256 bytes, containing known status/reason enums, validated numeric cap (or0 before establishment), and the literal receipt path. COMPLETE exits0; PARTIAL exits2; STOP exits3. The path is not a creation claim. No raw diagnostics or metadata appear on this channel. Missing/truncated final output, failed final write or nonmatching exit status must be treated as STOP, not repaired or retried. Uncatchable termination can prevent a final record. No output-channel nonblocking change occurs. |
| Retention | Every newly created receipt remains in place on COMPLETE, PARTIAL or STOP. No automatic delete, append, version bump, diagnostic read or next operation follows. A guard/creation STOP may leave no new receipt; an existing leaf remains untouched. |

Fixed reason enum: `SETUP`, `LIMIT_QUERY`, `LIMIT_VALUE`, `LIMIT_ZERO`, `LIMIT_SET`, `LIMIT_VERIFY`, `CORE_LIMIT`, `BASECHECK`, `BASE_DIRECTORY`, `EXISTING_LEAF`, `CREATE`, `CLOSE_WRITER`, `VALIDATION`, `VALIDATED`.

**Optional scope to include explicitly in the later exact human approval:** after a matching COMPLETE/0 or PARTIAL/2 final record only, authorize the lead to use the dedicated read tool for ONE bounded read of only this newly owned literal receipt, whose validated size is less than the reported `C` and at most24576 bytes.
Keep the no-concurrent-mutation assumption through that read.
Do not interpret a line-count setting as a byte cap; the validated stable file extent supplies the byte bound.
The command itself never forwards receipt bytes.
A STOP receipt stays retained and unread unless a new approval includes safe checks and bounded diagnostic-read scope.

## Scope honesty and unchanged blocks

Intentional regular-file writes target only the one receipt, apart from the requested fixed final stdout record going to its existing caller channel.
No directory creation, chmod/chown/ACL change, deletion, append, retry, alternate version, network request, Docker contact or installed-byte capture belongs to this packet.
No collector installed-content hashes, listings, `readlink`, resource-file contents, environment dump or tool-version probes occur.
Python `-B` suppresses bytecode cache writes.
Ordinary executable loading, imports, atime updates, host logging/accounting and filesystem automount activity remain possible.
Post-bootstrap Python resource limits do not establish a runtime capture graph, aggregate process envelope, native permission or hostile same-UID security.
Metadata COMPLETE means only that all configured observations finished without reported observation errors.
It proves neither tool usability, effective workload capacity, daemon store identity, mixed-audit closure nor Native F9 READY.
The accepted cold Native10s/public1048576/lifecycle300s caps remain unchanged.
Full F9 recipe, actual immutable loading/enforcement, mixed audits, preservation routing, invoice and implementation gates remain blocked.
No known next operation receives automatic authorization.

## Historical H01 static-review handoff — not current retry approval

Parent verified STATIC extraction/identity, unchanged approved BASECHECK Python predicate and identical collector/validator28-path lists, with no Popen/heredoc/stdout-flag changes. No receipt-command execution or syntax test occurred.

| Historical H01 packet reviewer | Static verdict / boundary |
|---|---|
| Security `ses_ea314aba3ffe3z1TPWTXunQHjS` |Findings NONE under stated preconditions; READY TO PRESENT EXACT RECEIPT+DISCOVERY-ONLY APPROVAL yes. No operational grant. |
| Adversarial `ses_ea31461d9ffevCwEgskj1L7DmW` |Findings NONE; READY TO PRESENT EXACT ONE-RECEIPT DISCOVERY APPROVAL yes; READY TO MERGE no. No runtime verification or operational grant. |
| DevOps `ses_ea314145effeFz0uWs47xrxlZ5` |Findings NONE under explicit preconditions; READY TO PRESENT EXACT ONE-RECEIPT METADATA APPROVAL yes. No execution/test or Native F9 readiness proof. |

H01 presentation/failed-attempt/diagnostic history grants no reusable retry. Later H02 reviews, exact one-run approval, fresh AFTER-approval verifier/immediate71-byte entry, conditional clipped read and separately approved formatting-only full read are preserved in the [retry result](native-ingress-retry.md#recorded-metadata-result). All grants are consumed; no next read/retry/cleanup/native operation is approved. The later metadata facts do not retroactively make the failed H01 submission byte-correct or erase its incident.
The failed01 receipt remains untouched since its diagnostic; both retained receipts receive no access in this doc update. Keeper uses only supplied main-grant/tool-output facts, with no receipt read/stat/hash, commands/tests/render/agents/Git or code/fence/snapshot/bf38 edit. Source-control checks are not a Native D1 seal; point-time metadata is not actual immutable-loading/native authority or full F9 closure.

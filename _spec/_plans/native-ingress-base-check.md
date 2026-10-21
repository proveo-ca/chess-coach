# F9 — exit-status-only trusted-base prerequisite check

**2026-10-21 · EXACT BASECHECK-ONLY RUN APPROVED AND COMPLETED · RETURNED F9_BASECHECK_OK · POINT-IN-TIME PREREQUISITES ONLY · NO RECEIPT CREATION.**

After planning and both static reviews, the user explicitly selected **Approve base check (Recommended)** for one execution of the exact command below, SHA-256 `1b9e67aa5af10778722d8004c24c2aeaed382f4612c97c047c9fcd7e16f066ff`, with10-second timeout plus1-second kill grace and15-second secondary harness timeout. Lead executed that packet once; it returned `F9_BASECHECK_OK`. This records only the stated predicates at that check time. The [accepted mapping](native-ingress-authority.md) remains unchanged; implementation, receipt creation, the31-observation discovery, capture, builds and containers remain unapproved.

## Exact approved one-run command

The payload between the following markers, excluding code-fence lines, is the approved one-run scope: SHA-256 `1b9e67aa5af10778722d8004c24c2aeaed382f4612c97c047c9fcd7e16f066ff`,2,815 UTF-8 bytes /93 LF-terminated lines. Lead confirmed unchanged reviewed bytes before requesting approval, then ran those bytes once. No retry, weakened predicate, tool installation or automatic permission change occurred.

<!-- BEGIN F9 BASECHECK COMMAND -->
```bash
(
  if (
    exec 0<&- 1>&- 2>&-
    exec /usr/bin/timeout --signal=TERM --kill-after=1s 10s \
      /usr/bin/python3 -I -S -B -c '
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
  ); then rc=0; else rc=$?; fi

  case "$rc" in
    0)   label=F9_BASECHECK_OK;                 rc=0 ;;
    20)  label=F9_BASECHECK_MISSING;            rc=20 ;;
    21)  label=F9_BASECHECK_UNSAFE;             rc=21 ;;
    22)  label=F9_BASECHECK_UNKNOWN;            rc=22 ;;
    124) label=F9_BASECHECK_STOP_TIMEOUT;       rc=23 ;;
    137) label=F9_BASECHECK_STOP_KILLED;        rc=25 ;;
    127) label=F9_BASECHECK_STOP_PREREQUISITE;  rc=24 ;;
    *)   label=F9_BASECHECK_STOP_UNKNOWN;       rc=22 ;;
  esac
  printf "%s\n" "$label" 2>&- || exit 22
  exit "$rc"
)
```
<!-- END F9 BASECHECK COMMAND -->

## Read scope and predicates

The descriptor-relative walk opens only `/`, then `tmp` relative to that descriptor, then `opencode` relative to the held `/tmp` descriptor. Every open uses `O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC`. There is no enumeration or final/intermediate symlink following by this walk.

| Directory | Conservative required predicate |
|---|---|
| `/` |Directory; UID0; no group/other write bits. |
| `/tmp` |Directory; UID0; sticky bit whenever group/other write bits exist. |
| `/tmp/opencode` |Directory; owner equals the process effective UID; no group/other write bits. |
| All three |The fixed `system.posix_acl_access` and `system.posix_acl_default` attributes must be absent (`ENODATA`) or explicitly empty. Nonempty attributes reject; unsupported/unreadable metadata is UNKNOWN, not assumed absent. |

The complete successful path performs three directory opens, three `fstat` calls and six fixed ACL-attribute reads. Earlier refusal performs fewer operations. Linux bounds an individual xattr value to65536 bytes; there is no attribute enumeration. These are control metadata, not the separate31 discovery observations. No target-file contents, directory entries, hashes, `readlink`, versions, Docker API, environment dump, permissions change, receipt creation or installed-byte capture is requested.

## Output, limits and result semantics

- The already-running trusted harness Bash closes child stdin/stdout/stderr before external execution. Bash saves no caller-output descriptor. Interpreter/timeout diagnostics are not retained or forwarded.
- Bash changes no stdout blocking flags. Its result is one fixed ASCII enum plus LF, at most31 bytes. The invoking harness must retain that enum together with the command exit status; neither alone is successful validation.
- GNU timeout is configured for10seconds plus1second KILL grace; proposed secondary harness timeout15seconds. Python never forks. Scheduling/uninterruptible kernel work can defeat absolute completion guarantees.
- Python post-bootstrap limits are CPU3seconds, address space128MiB, descriptors16, file size/core0, preserving inherited stricter limits. These do not attest/bootstrap-limit the executable loader or every OS activity. Missing executables, APIs or limit-setting capability stop without installation or fallback.
- Exit0/`F9_BASECHECK_OK` means only the specified point-in-time predicates passed. Missing/unsafe/unknown/launch/supervision failures are nonzero outcomes. Exit137 does not identify timeout as its cause. No failure authorizes `chmod`, ACL mutation, path substitution or retries under a weaker policy.

This packet trusts the existing harness Bash and its non-logging control execution without output-producing tracing/traps. It does not attest compromised host/bootstrap code. Normal executable loading, Python imports and OS activity remain unavoidable; bytecode caching is disabled. The program intentionally creates or writes no regular file.

A passing check cannot establish absence of a hostile same-UID actor or future pathname stability. Human-controlled same-UID activity remains an explicit trust assumption. Later sink approval must recheck prerequisites; this result is not reusable inode authority, a receipt-creation/capacity guarantee, an audit PASS or genuine F9 native authority.

## Approval ledger

- Accepted F9 mapping: unchanged body SHA-256 `bf38a0fa226d6f1cb7141742a39c6961b484e629f375365636ac7a2854c7d5df`.
- Trusted-base approach: planning selected; user then approved this exact BASECHECK packet once and lead executed it once, returning `F9_BASECHECK_OK`.
- Current command identity: `1b9e67aa5af10778722d8004c24c2aeaed382f4612c97c047c9fcd7e16f066ff`; static reviews completed with no findings.
- Security `ses_ea3336348ffeeo06bkKGeWV91s`: READY TO PRESENT EXACT BASECHECK-ONLY EXECUTION APPROVAL yes; no execution authorized by review.
- Adversarial `ses_ea3331cafffevMGb0Aa3o82N6F`: READY TO PRESENT EXACT BASECHECK-ONLY APPROVAL yes; READY TO MERGE no. No merge or implementation is requested by this packet.
- Sink creation,31-observation discovery, implementation, capture/build/container/model operations: NOT APPROVED.

The one-run approval is consumed. It is not blanket permission for retries or other probes. Later receipt creation/discovery needs its own exact reviewed packet and approval, with prerequisites rechecked and the same-UID trust assumption explicit. No numeric ownership, inode, mode or ACL values were returned; no facts beyond the code's point-in-time predicate result are claimed. Accepted native cold10seconds/shared1048576 work/legacy caps remain unchanged; these host-preflight checks supply no live native permission or readiness result.

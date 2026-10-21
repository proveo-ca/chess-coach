# F9 — bounded candidate tool-location lookup

**2026-10-21 · PROPOSED / NOT APPROVED / NOT RUN · NO OPERATIONAL FILE WRITES.**

The [recorded full31-observation PARTIAL result](native-ingress-retry.md#recorded-metadata-result) supplies21 successful metadata observations and10 ENOENT records at exact checked paths, not global tool absence or current PATH observations. Its entry/conditional-read/formatting-read grants are all consumed. This proposal does not access either retained receipt or refresh free-space/daemon facts.

## Scope and meaning

Search only the inherited PATH scalar for these fixed names: `cargo rustc readelf node tsc zig mise rustup`. Do not dump PATH or any other environment value. Validate the entire PATH before filesystem tests: at most8192 bytes under `LC_ALL=C`, at most32 nonempty absolute components, each at most1000 bytes.

For each name, construct at most32 candidate pathnames and select the first passing Bash `-f` and `-x` tests. The whole run constructs at most256 candidate pathnames and invokes at most512 source-level file tests. These are NOT bounds on underlying kernel syscalls, symlink resolution, automount activity or physical I/O. A configured five-second harness deadline is not an absolute kernel-termination guarantee.

The earlier black-box `type -P` approach was discarded. This explicit source-level search count is not a waiver of the accepted mapping, Native caps or unclosed full D1 work/closure requirements.

`FOUND_CANDIDATE` means only that the operator's file tests passed at that time. It proves neither actual Bash command resolution, canonical target identity, usability, version, native-runtime permission nor future UID10001 access. `NOT_FOUND` means no tested candidate passed; Bash tests do not expose reasons, so this is not proven global absence or ENOENT.

## Exact proposed payload

Only the command inside the following fence is executable payload. The private prepared snapshot/payload identity and fixed one-line entry are recorded below; no multi-line manual transcription is permitted. Their existence and preparatory source-control verification do not approve lookup execution.

<!-- BEGIN F9 TOOL LOCATION PAYLOAD -->
```bash
(
  builtin set +eu
  LC_ALL=C
  cc_rest=${PATH-}
  cc_dirs=()
  cc_stop=
  cc_missing=0
  cc_out=$'PATH_CANDIDATES_V1\n'

  if (( ${#cc_rest} > 8192 )); then
    cc_stop=PATH_BYTES
  else
    while [[ -z $cc_stop ]]; do
      cc_dir=${cc_rest%%:*}
      if [[ $cc_dir != /* ]] ||
         (( ${#cc_dir} > 1000 || ${#cc_dirs[@]} >= 32 )); then
        cc_stop=PATH_COMPONENT
        break
      fi
      cc_dirs+=("$cc_dir")
      [[ $cc_rest == *:* ]] || break
      cc_rest=${cc_rest#*:}
    done
  fi

  if [[ -z $cc_stop ]]; then
    for cc_name in cargo rustc readelf node tsc zig mise rustup; do
      cc_status=NOT_FOUND
      cc_escaped="''"
      for cc_dir in "${cc_dirs[@]}"; do
        cc_candidate=$cc_dir/$cc_name
        if (( ${#cc_candidate} > 1024 )); then
          cc_stop=RAW_PATH_BYTES
          break
        fi
        if [[ -f "$cc_candidate" ]] && [[ -x "$cc_candidate" ]]; then
          if ! builtin printf -v cc_escaped '%q' "$cc_candidate"; then
            cc_stop=ESCAPE_ERROR
            break
          fi
          if (( ${#cc_escaped} > 1536 )); then
            cc_stop=ESCAPED_PATH_BYTES
            break
          fi
          cc_status=FOUND_CANDIDATE
          break
        fi
      done
      [[ -z $cc_stop ]] || break
      if [[ $cc_status == NOT_FOUND ]]; then cc_missing=1; fi
      if ! builtin printf -v cc_line '%s\t%s\t%s\n' \
          "$cc_name" "$cc_status" "$cc_escaped"; then
        cc_stop=RECORD_FORMAT
        break
      fi
      if (( ${#cc_line} > 1800 )); then
        cc_stop=RECORD_BYTES
        break
      fi
      cc_out+=$cc_line
    done
  fi

  if [[ -z $cc_stop ]]; then
    if (( cc_missing )); then
      cc_out+=$'END\tPARTIAL\n'
      cc_rc=2
    else
      cc_out+=$'END\tCOMPLETE\n'
      cc_rc=0
    fi
    if (( ${#cc_out} > 16384 )); then cc_stop=OUTPUT_BYTES; fi
  fi

  if [[ -n $cc_stop ]]; then
    builtin printf 'PATH_CANDIDATES_V1\nSTOP\t%s\nEND\tSTOP\n' "$cc_stop"
    builtin exit 3
  fi
  builtin printf '%s' "$cc_out" || builtin exit 3
  builtin exit "$cc_rc"
) 2>&-
```
<!-- END F9 TOOL LOCATION PAYLOAD -->

## Output and trust conditions

The script uses only the existing trusted Bash and its ordinary builtins/file tests; no discovered executable or foreign program is launched. It performs no directory enumeration, target-content read, `readlink`, hash of installed files, version probe, Docker contact, acquisition, receipt access or intentional regular-file write. File tests follow symlinks and can trigger filesystem/automount activity; no zero-underlying-network or absolute timing guarantee is claimed.

All eight records are buffered before emission. Raw returned path length is at most1024 bytes, `%q` ASCII-escaped length at most1536, each record at most1800, and total output at most16384. Rejection stops rather than truncating. Escaped paths are DATA: never evaluate them as shell code or automatically execute a reported candidate.

Require header `PATH_CANDIDATES_V1`, all eight records plus a complete footer and the matching exit status: COMPLETE/0 if every name had a candidate, PARTIAL/2 if any did not, STOP/3 for detected input/format/size/output failures. Missing or truncated output and harness timeout are STOP, never repaired into a complete result. A successful listing is not Native F9 PASS.

The operation requires a trusted nontracing/nonlogging Bash with ordinary builtin resolution, no interfering traps or readonly-variable collisions, stable control artifact and no adversarial identity/path mutation. It does not attest a compromised host. Shell-variable changes remain in the payload subshell. Snapshot preparation is separate from operational execution.

## Approval state

- User has approved no execution of this lookup.
- Prepared control snapshot: `/tmp/opencode/f9-tool-locations-03.bash`, created exclusively as a private euid-owned regular mode0600/one-link control artifact. This is preparation, not lookup execution or installed-file capture.
- Payload SHA-256: `7042b341fea4da8864b49584b03373918a26c05c3f4289a3c25854442bbca1b3`;2062 UTF-8 bytes /81 LF-terminated lines.
- Entry SHA-256: `0590be5eb5c9beda7636f6c4a3e86b6f4de3456eee584dea4bfebc5515a7548a`;73 UTF-8 bytes /one terminating LF.
- Parent reports SOURCE-CONTROL preparation verification printed `F9_TOOL_LOCATION_CONTROL_BYTES_OK`; no actual PATH-scalar lookup or selected-name file tests ran. This is control-artifact checking, not Native D1 immutable loading or operational permission. Fresh fixed-payload equality/hash/metadata verification remains mandatory immediately before a future separately approved entry; prep PASS cannot substitute for it.
- Fresh current security review `ses_ea27eaf78ffe4kLg7iIdO6fA7B`: DONE/findings NONE/READY TO PRESENT yes. Current adversarial review `ses_ea27e3c51ffeGma4KL8wWNU11r`: DONE/findings NONE/READY TO PRESENT yes/READY TO MERGE yes for this LOOKUP PROPOSAL SCOPE ONLY. Neither verdict grants lookup execution or whole-F9/runtime authority. DevOps supplied the current pure-Bash candidate; no additional unreported operational approval is asserted.
- Proposed secondary harness deadline: five seconds.
- Python/timeout symlink targets and versions remain uninspected; no other lookup, capture, installation, build, container or implementation follows automatically.
- Accepted bf38/N1–N10, F8 e540, native cold/public/lifecycle caps, existing preservation guards and remaining full F9 recipe/audit/loading/invoice gates are unchanged.

The exact lookup operational approval remains PENDING/NOT RUN. Any later lookup-only TUI must identify the fixed payload+entry hashes/control path, PATH scalar/selected-name metadata/source-level bounds/five-second harness/trust-stability assumptions and fresh immediate pre-entry controller checks. No new metadata receipt is planned; the prepared code snapshot is not captured installed bytes. No receipt01/02 access/version/readlink/Native/model operation follows from review or publication permission.

The user now requested **commit & push, then /compact** for the planning Markdown ONLY, not lookup execution. Lead owns the explicit12-path Markdown inventory/preservation+identity/link/whitespace/static-doc checks, complete captured HEAD diff including new files, fresh adversarial+security WHOLE-DOC diff reviews, commit/NON-FORCE push/actual remote+clean verification, then queued compaction. These whole-doc reviews/publication are not yet claimed complete; lookup-only verdicts do not substitute for them. Keeper writes are FROZEN after this bounded framing handoff; no next task or operational step starts here.

## Exact proposed entry and fresh parent verification

Do not manually transcribe the81-line program into a tool call. The entry mechanically loads the reviewed control snapshot under the same stable-owned-file/trusted-harness/no-concurrent-mutation condition used by the earlier successful retry. This is not atomic Native D1 immutable loading or a new authority seal.

<!-- BEGIN F9 TOOL LOCATION ENTRY -->
```bash
( exec 2>&-; builtin source -- /tmp/opencode/f9-tool-locations-03.bash )
```
<!-- END F9 TOOL LOCATION ENTRY -->

Immediately before a separately approved entry, run this read-only source-control check. It accesses this proposal and its prepared code snapshot only—not the receipts, installed target tools or PATH. A mismatch stops without executing, repairing, changing the expected digest or selecting another path.

```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const text=fs.readFileSync('_spec/_plans/native-ingress-tool-locations.md','utf8');
const a='<!-- BEGIN F9 TOOL LOCATION PAYLOAD -->\n```bash\n',b='```\n<!-- END F9 TOOL LOCATION PAYLOAD -->';
if(text.split(a).length!==2||text.split(b).length!==2)throw Error('Payload delimiter drift');
const expected=Buffer.from(text.slice(text.indexOf(a)+a.length,text.indexOf(b)));
if(expected.length!==2062||sha(expected)!=='7042b341fea4da8864b49584b03373918a26c05c3f4289a3c25854442bbca1b3')throw Error('Registered payload drift');
const fd=fs.openSync('/tmp/opencode/f9-tool-locations-03.bash',fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
try{
  const before=fs.fstatSync(fd);
  if(!before.isFile()||before.uid!==process.geteuid()||(before.mode&0o7777)!==0o600||before.nlink!==1||before.size!==2062)throw Error('Snapshot metadata drift');
  const data=Buffer.alloc(2063);
  let used=0;
  while(used<data.length){const n=fs.readSync(fd,data,used,data.length-used,null);if(n===0)break;used+=n;}
  const actual=data.subarray(0,used),after=fs.fstatSync(fd);
  if(before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mode!==after.mode||before.uid!==after.uid||before.nlink!==after.nlink||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)throw Error('Snapshot changed during check');
  if(!actual.equals(expected)||sha(actual)!=='7042b341fea4da8864b49584b03373918a26c05c3f4289a3c25854442bbca1b3')throw Error('Snapshot byte drift');
  console.log('F9_TOOL_LOCATION_CONTROL_BYTES_OK');
}finally{fs.closeSync(fd);}
NODE
```

This verifier is a control-artifact preparation/checking operation using the trusted parent tooling. It does not run the lookup or prove a Native execution graph. Hashing and sourcing are separate reads; maintain the stated stability precondition through the approved call. The operational grant, if later given, covers the fixed entry/payload, these control reads/checks and the bounded PATH lookup only—not execution of any found tool or an automatic next probe.

# F9 — verified-artifact retry and recorded scoped metadata result

**2026-10-21 · ONE VERIFIED RETRY APPROVED/EXECUTED · PARTIAL / VALIDATED / EXIT2 · FULL31-RECORD REPORT DISPLAYED AFTER SEPARATE FORMATTING-ONLY APPROVAL · ALL ENTRY/READ GRANTS CONSUMED · NO FURTHER OPERATIONS APPROVED.**

## Recorded execution and separately approved full presentation

The user selected **Approve verified retry (Recommended)** for this fixed H02 and entry, including immediate control-file verification, one capped new receipt,31 observations/validation, and one read only after validated COMPLETE/PARTIAL. Lead reran the exact verifier below and received `F9_RETRY_CONTROL_BYTES_OK`, then immediately submitted ONLY the frozen one-line entry. The309-line payload was not manually retranscribed.

The tool returned:

```text
F9_RECEIPT status=PARTIAL reason=VALIDATED cap=65536 path=/tmp/opencode/f9-preflight-bf38-sink-02.receipt
Exited with code 2
```

This is validated PARTIAL metadata, not another collector bug or F9 readiness. All31 configured records are now reported as fully displayed:21 successful metadata observations and10 ENOENT results at the exact checked paths. The initial ONE conditional dedicated-tool read activated after PARTIAL/VALIDATED/exit2; its single long JSON line was clipped at2000 characters. That preview was incomplete, not the final extent of the subsequently authorized inspection.

The user then SEPARATELY approved ONE formatting-only reread. Lead ran exactly `( exec 0<&- 2>&-; exec -c /usr/bin/timeout --signal=TERM --kill-after=1s 5s /usr/bin/python3 -I -S -B -m json.tool /tmp/opencode/f9-preflight-bf38-sink-02.receipt )` plus terminating LF once, with8000ms tool timeout. The complete pretty JSON/31 records were displayed. This performed no new discovery or target write. The results below come from the main grant/observed tool output supplied to this doc update; keeper did NOT access, stat, hash or reread either actual receipt.

The one entry approval, initial conditional read and separate formatting-only reread grants are ALL CONSUMED. Both receipts remain retained; `sink-01` has stayed untouched since its earlier diagnostic read. No further receipt read/stat/hash/retry/cleanup, new discovery, alternate name, installation, capture/build/container/native context or F9 implementation is approved. Recording the supplied facts is not a new measurement or permission.

The user selected **Prepare verified retry (Recommended)** after the [failed transcription attempt](native-ingress-receipt.md#execution-incident--outside-the-approved-command). That authorizes preparation, not execution. The failed `sink-01` receipt remains untouched; its one diagnostic-read grant is consumed. No read, stat, hash, overwrite or deletion of that receipt occurs in this preparation.

## 1. Mechanical derivation and current identities

The authoritative original is the fenced command in [the reviewed receipt proposal](native-ingress-receipt.md), not the failed submitted tool argument.

```text
H01 = 8cf659a69f5b61993f7b7080501c13f2bc4e5c2dd54975b95bea87c0c445996f
old = f9-preflight-bf38-sink-01.receipt
new = f9-preflight-bf38-sink-02.receipt

require SHA256(original) == H01
require UTF8 bytes ==13000; LF-terminated lines ==309
require old occurs exactly5 times and new occurs0 times
expected = original.replaceAll(old,new)
require old occurs0 times and new occurs5 times
require snapshotBytes == UTF8(expected)
```

Lead performed that mechanical preparation. Every other byte is preserved, including the correct unindented collector `def main():`. The private regular snapshot was created exclusively at the fixed path below and checked for effective-UID ownership, mode0600, one link and exact byte equality. These are control-artifact checks, not a new native execution proof or metadata-receipt validation.

| Item | Fixed current identity / scope |
|---|---|
| Control snapshot |`/tmp/opencode/f9-retry-02-packet.bash` |
| Snapshot SHA-256, H02 |`f6be4035d2300631951fc449bf01f5956bc124ffdcbcd83f3fb58f251a7fa6f4` |
| Snapshot size |13000 UTF-8 bytes /309 LF-terminated lines |
| Retained metadata receipt |`/tmp/opencode/f9-preflight-bf38-sink-02.receipt` — PARTIAL/VALIDATED/exit2; initial clipped conditional read followed by separately approved formatting-only full31-record display; all grants consumed |
| Entry SHA-256 |`558802b6e4a3075a332c9342c3a08e0f77b0e18b7e8398cf81a7ba0f09285ee3` |
| Entry size |71 UTF-8 bytes /one terminating LF |

No separate launcher file or execution manifest is introduced. The snapshot is executable control text prepared for review, not an installed-component capture or a metadata receipt. It is not approved merely because it exists.

## 2. Exact entry used for the one approved retry

Use the existing trusted harness Bash to load the reviewed snapshot mechanically. Do not recopy the309-line program into a tool argument.

<!-- BEGIN F9 RETRY ENTRY -->
```bash
( exec 2>&-; builtin source -- /tmp/opencode/f9-retry-02-packet.bash )
```
<!-- END F9 RETRY ENTRY -->

This entry deliberately reads one fixed reviewed control artifact. It is not a discovered-tool/module selector and does not read installed-component contents. The sourced payload remains the entire reviewed packet with only the five approved-shape path substitutions. A missing, changed, incorrectly owned or otherwise invalid snapshot must stop the process; there is no alternate source path, repair or retry.

## 3. Exact read-only parent verification before any future execution

The parent must run this control-artifact check immediately before a separately approved entry call. It reads the original repository template and the fixed prepared snapshot only; it performs no metadata-receipt read, writes, subprocess launch, discovery or source mutation. Expected H02 is fixed above: never replace it with whatever a later file happens to hash to.

```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const text=fs.readFileSync('_spec/_plans/native-ingress-receipt.md','utf8');
const begin='<!-- BEGIN F9 CAPPED RECEIPT PROPOSED COMMAND -->\n```bash\n';
const end='```\n<!-- END F9 CAPPED RECEIPT PROPOSED COMMAND -->';
if(text.split(begin).length!==2||text.split(end).length!==2)throw Error('Template delimiter drift');
const original=text.slice(text.indexOf(begin)+begin.length,text.indexOf(end));
const oldLeaf='f9-preflight-bf38-sink-01.receipt';
const newLeaf='f9-preflight-bf38-sink-02.receipt';
if(sha(original)!=='8cf659a69f5b61993f7b7080501c13f2bc4e5c2dd54975b95bea87c0c445996f'||Buffer.byteLength(original)!==13000||original.split('\n').length-1!==309||original.split(oldLeaf).length-1!==5||original.includes(newLeaf))throw Error('Template drift');
const expected=Buffer.from(original.replaceAll(oldLeaf,newLeaf));
const fd=fs.openSync('/tmp/opencode/f9-retry-02-packet.bash',fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
try{
  const before=fs.fstatSync(fd);
  if(!before.isFile()||before.uid!==process.geteuid()||(before.mode&0o7777)!==0o600||before.nlink!==1||before.size!==13000)throw Error('Snapshot metadata drift');
  const data=Buffer.alloc(13001);
  let used=0;
  while(used<data.length){const n=fs.readSync(fd,data,used,data.length-used,null);if(n===0)break;used+=n;}
  const actual=data.subarray(0,used),after=fs.fstatSync(fd);
  if(before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mode!==after.mode||before.uid!==after.uid||before.nlink!==after.nlink||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)throw Error('Snapshot changed during verification');
  if(!actual.equals(expected)||sha(actual)!=='f6be4035d2300631951fc449bf01f5956bc124ffdcbcd83f3fb58f251a7fa6f4')throw Error('Snapshot byte drift');
  console.log('F9_RETRY_CONTROL_BYTES_OK');
}finally{fs.closeSync(fd);}
NODE
```

This check is preparatory control-file verification using the existing trusted parent tooling, not a new runtime hash helper or a Native D1 seal. Hashing and Bash sourcing are separate reads. The same stable owned-path/no-concurrent-same-UID-mutation condition must hold through both. If that condition cannot be maintained, do not execute: this proposal does not promise atomic byte binding against an adversarial mutator or close F9's actual immutable-loading gate.

## 4. Historical one-run approval scope and unchanged limits — consumed

The consumed exact approval covered the entry, fixed H02, both literal paths, source-control reads/metadata/hash checks and the scope below. Lead freshly ran the frozen verifier AFTER approval, received `F9_RETRY_CONTROL_BYTES_OK`, then immediately used only the exact71-byte entry with30000ms tool timeout. This records that one completed scope and authorizes no repetition:

1. Repeat the guarded base check within the new packet, not under the consumed prior grant.
2. Exclusively create and retain ONE `sink-02` receipt. Any existing leaf, symlink, abnormal object or occupied name stops without reading it, overwriting, appending, deleting, choosing another name or retrying.
3. Establish the unchanged inherited kernel soft/hard FSIZE cap `C<=65536` before the payload's external stages, capture collector stdout/stderr through the same receipt description, and perform the fixed28 `lstat`+three `statvfs` observations.
4. Close the writer and run the unchanged closed-stdio strict validator with regular-file/owner0600/link1/`0<size<C`/size<=24576/stable-fstat/canonical JSON/31 ordered records/errno/status-pair checks.
5. Retain the new receipt on ALL outcomes. Only matching validated COMPLETE/0 or PARTIAL/2 may activate ONE explicitly included dedicated-tool read of this `sink-02` file, at most24576 bytes and less than C. STOP activates no read.

Use the unchanged configured stage envelopes11+11+6 seconds and a30-second secondary harness timeout for the entry. No raw output forwarding or automatic cleanup follows. The trusted nontracing harness, ordinary trusted executables, stable owned base/control paths and no concurrent same-UID mutation are explicit preconditions—not observed facts or guarantees against a compromised host. No stronger OS scheduling/reaping guarantee is added.

No other intentional file write, installed-byte capture, arbitrary content read, directory enumeration, version probe, Docker API, image acquisition, permission mutation, model work or native execution context is included. The previous `sink-01` remains untouched. The metadata result cannot establish tool usability, effective capacity, immutable loading, mixed audits, Native F9 authority or training readiness.

## 5. Approval and review state

- User initially selected preparation, then separately approved one exact verified retry and its conditional read, now consumed as recorded above.
- Snapshot preparation/equality/hash/mode checks completed; the exact verifier freshly passed AFTER approval and immediately BEFORE the exact71-byte entry, not by reusing preparation permission. These are control-artifact checks, not a Native D1 seal. One operational run, initial clipped conditional read and separately approved formatting-only full reread are recorded above; no further entry or receipt access is authorized.
- Fresh static reviews of this replacement plus entry found no issues under the declared trusted-harness/stable-file preconditions and permit presentation for exact operational approval. They grant no execution permission or runtime proof.
- One exact operational entry completed with PARTIAL/VALIDATED/exit2; the initial conditional read was clipped and a later separately approved formatting-only reread displayed all31 records. All grants are consumed, including the formatter grant. PARTIAL reflects10 checked-path ENOENT observations, not another collector bug; no further operational permission remains.
- Accepted bf38/N1–N10, F8 e540, native cold/public/lifecycle caps and remaining full F9 plan/invoice/recipe/closure/capture gates are unchanged.

| Current retry reviewer | Presentation verdict / boundary |
|---|---|
| Security `ses_ea2b0ddcbffer70NHgwOYLXAVg` |Findings NONE under declared trust/stability preconditions; READY TO PRESENT EXACT SNAPSHOT RETRY APPROVAL yes. Require fresh fixed-H02/equality verification immediately before a separately approved entry. |
| Adversarial `ses_ea2b08bbdffee0WPmm7y8ATHIa` |Findings NONE in snapshot/entry under stated assumptions; READY TO PRESENT EXACT VERIFIED RETRY APPROVAL yes; READY TO MERGE no. |
| DevOps `ses_ea2b0367affeFtuiALOR0LdiXt` |Static findings NONE under trusted-harness/stable-file premises; READY TO PRESENT EXACT SNAPSHOT RETRY APPROVAL yes. No operational or Native/runtime proof. |

Historical preparation checks covered repository entry identity/mechanical H02/bf38/document scope/whitespace without operational retry or receipt access at that preparation stage. The later approved run DID freshly verify fixed H02/equality/metadata immediately before its exact entry. Neither preparation nor that consumed one-run result supplies future execution permission, immutable native authority or a reusable source-control seal.

The successful exact TUI identified BOTH fixed H02 and entry hash, control snapshot,02 creation/retention, ONE conditional validated read,30-second harness and stable-host assumptions. A later separate approval covered ONLY ONE exact formatting reread, now also consumed. No repeated mapping acceptance, automatic retry/read or cleanup is allowed. A future bounded selected-PATH/readlink proposal is only the next logical planning work, with static DevOps packet design being assigned, NOT approved to run. Full F9 recipe/invoice/audit/loading/capture/implementation/native-authority gates remain blocked.

<a id="recorded-metadata-result"></a>
## Full recorded31 observations — point-in-time only

These are supplied main-session observations from the approved H02 run and separately approved full formatting display, NOT keeper receipt access or fresh measurements.21 successes comprise18 successful `lstat` observations and three `statvfs` indicators; all10 reported observation errors were ENOENT/errno2 at the exact paths listed below. No global tool absence, tool usability, resolved loader graph, daemon access or capacity admission follows.

| Result category | Recorded point-in-time facts | Limit |
|---|---|---|
| Exact outcome |PARTIAL / VALIDATED / exit2 /cap65536 /31 records /21 successes /10 ENOENT |Configured fixed-path metadata only; not Native F9 completion. |
| Present file candidates (path,size bytes) |`/usr/local/bin/node`124836408; `/usr/libexec/docker/docker-init`810480; `/usr/bin/prlimit`27616; `/usr/bin/docker`45570321; `/usr/bin/dockerd`108779480; `/usr/bin/containerd`43147704; `/usr/bin/runc`11364024 |No content read/hash/version/capability/license/library-closure or actual daemon-used init-byte identity established. |
| Symlinks |`/usr/bin/python3` size10; `/usr/bin/timeout` size34 |Targets NOT read/resolved. Prior execution does not identify their approved capture bytes/closure. |
| Socket |`/var/run/docker.sock` present as socket |NO connect/API query/access/enforcement proof. |
| Directories |Project root; `/tmp/opencode`; `/var/lib/docker`; `/usr/bin`; `/usr/local/bin`; `/usr/libexec/docker`; project `node_modules`; project `apps/starchess/node_modules` |Metadata existence only; no enumeration/file counts/installed closure/RSS or effective capacity. |

Exact checked paths with ENOENT/errno2:
- `/usr/bin/node`
- `/usr/bin/cargo`
- `/usr/bin/rustc`
- `/usr/bin/readelf`
- `/usr/bin/docker-init`
- `/usr/lib/docker-init`
- `/usr/lib/docker`
- `/home/gu1lty/.rustup/toolchains`
- `/home/gu1lty/.local/share/mise/installs/node`
- `/home/gu1lty/.local/share/mise/installs/rust`

| `statvfs` checked path | Recorded availableBytes | Recorded freeInodes |
|---|---:|---:|
| `/home/gu1lty/Projects/proveo/chess-coach` |48973070336 |3239849 |
| `/tmp/opencode` |17822371840 |1261938 |
| `/var/lib/docker` |23877332992 |1572810 |

These are point-in-time filesystem indicators only, not effective quota, daemon-store identity, storage peak-coexistence headroom or capture admission; recording them does not refresh them. No inode/source authority comes from metadata. Rust/readelf locations, versions/capabilities, Python/timeout resolved targets, licenses/native libraries, capture graph, mixed audits, actual loading/enforcement/daemon-init bytes, recipe/public invoice and genuine native contexts all remain OPEN. No further01/02 access or next operational packet is approved.

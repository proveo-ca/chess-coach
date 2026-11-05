# R1 GNU source research — build declarations, applicability and compiler retries

**2026-11-04 · Research Complete for this bounded public-text pass; qualification OPEN.**
**[Unverified] Candidate applicability, source-to-binary derivation and enforcement remain unproved.**
This supporting research addendum is neither a qualified input record nor an acceptance ledger.
The [canonical packet](native-ingress-rust-first-full-plan-packet.md) §8 remains the sole acceptance ledger.
Preserve the historical [metadata candidate](native-ingress-gnu-provider-candidate.json) and separate [reference-member summary](native-ingress-gnu-reference-inventory.json) unchanged.
No publisher/build key, input, security waiver, mechanism, effect class, tariff, numerical limit, source assignment or operation is accepted here.
**R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`.**

## 1 · Exact-version build declarations, not authenticated derivation

The devops research pass compared the three amd64 records below with the frozen candidate's package names, lengths and SHA-256 declarations.
The declarations match **25/25 selected packages in these source families: GCC 16, binutils 6, glibc 3**.
The lead also read all three published amd64 records.
These comparisons concern public metadata, not an independently authenticated build or a fresh payload inspection.

| Published amd64 `.buildinfo` | Declared Build-Date, UTC | Selected packages covered | Examples of declared installed build inputs |
|---|---|---:|---|
| [gcc-14 14.2.0-19](https://buildinfos.debian.net/buildinfo-pool/g/gcc-14/gcc-14_14.2.0-19_amd64.buildinfo) | 2025-03-15 13:57:39 | 16 | `gcc-14=14.2.0-18`, `binutils=2.44-3`, `libc6-dev=2.41-6`, `linux-libc-dev=6.12.17-1` |
| [binutils 2.44-3](https://buildinfos.debian.net/buildinfo-pool/b/binutils/binutils_2.44-3_amd64.buildinfo) | 2025-03-04 00:19:53 | 6 | `gcc-14=14.2.0-17`, `binutils=2.44-2`, `libc6-dev=2.41-3`, `linux-libc-dev=6.12.17-1` |
| [glibc 2.41-12+deb13u4](https://buildinfos.debian.net/buildinfo-pool/g/glibc/glibc_2.41-12+deb13u4_amd64.buildinfo) | 2026-07-11 17:42:40 | 3 | `gcc-14=14.2.0-19`, `binutils=2.44-3`, `libc6-dev=2.41-12+deb13u3`, `linux-libc-dev=6.12.86-1` |

All three texts contain OpenPGP signature armor; **no signature was verified**.
The [service README](https://buildinfos.debian.net/README.txt) describes a temporary mirror of buildd/maintainer records stored by ftp-master, not another independently accepted archive trust anchor.
The direct ftp-master buildinfo directory returned 404 during the devops pass.
Build dates and build dependencies are declarations, not observations of a reproduced build.
Do not replace historical build dependencies with the later runtime/development package selection.
The other **11 selected packages / 10 source families** have no build-record comparison in this pass.

The declared environments contain `DEB_BUILD_OPTIONS="parallel=6"` and `LANG`, `LC_COLLATE`, `LC_CTYPE` set to `C.UTF-8`.
GCC, binutils and glibc respectively declare `SOURCE_DATE_EPOCH` values `1742003262`, `1741035682`, `1782769072`.
The [buildinfo specification](https://manpages.debian.org/trixie/dpkg-dev/deb-buildinfo.5.en.html) defines dependency/environment fields; the environment field is not necessarily a complete environment capture.
No exact command stream, generated configuration, driver specs, member-level derivation or reproducibility result follows.

### Source records and upload records remain distinct

The source-only [GCC](https://buildinfos.debian.net/buildinfo-pool/g/gcc-14/gcc-14_14.2.0-19_source.buildinfo), [binutils](https://buildinfos.debian.net/buildinfo-pool/b/binutils/binutils_2.44-3_source.buildinfo) and [glibc](https://buildinfos.debian.net/buildinfo-pool/g/glibc/glibc_2.41-12+deb13u4_source.buildinfo) build records declare the corresponding frozen `.dsc` identities.
The three amd64 records above contain no `.dsc` checksum entry.
The devops pass read fixed-snapshot [GCC `.dsc`](https://snapshot.debian.org/archive/debian-security/20261104T000000Z/pool/updates/main/g/gcc-14/gcc-14_14.2.0-19.dsc), [binutils `.dsc`](https://snapshot.debian.org/archive/debian/20261104T000000Z/pool/main/b/binutils/binutils_2.44-3.dsc) and [glibc `.dsc`](https://snapshot.debian.org/archive/debian/20261104T000000Z/pool/main/g/glibc/glibc_2.41-12+deb13u4.dsc) **text metadata**, not source archive payloads.
Their declarations match the six corresponding upstream/Debian source-archive pins.
The [binutils source-upload announcement](https://lists.debian.org/debian-devel-changes/2025/03/msg00722.html) and [glibc source-upload announcement](https://tracker.debian.org/news/1773909/accepted-glibc-241-12deb13u4-source-into-proposed-updates/) bind source-upload declarations only.
**No exact amd64 `.changes` record was located in this pass.**

Keep these evidence chains separate:

```text
archive Release/InRelease -> Packages -> .deb declaration
archive Release/InRelease -> Sources -> .dsc/source declarations
build/upload signer       -> .buildinfo/.changes declarations
independent derivation    -> still unproved
```

[APT authentication](https://manpages.debian.org/trixie/apt/apt-secure.8.en.html), [`dsc(5)`](https://manpages.debian.org/trixie/dpkg-dev/dsc.5.en.html), [`deb-changes(5)`](https://manpages.debian.org/trixie/dpkg-dev/deb-changes.5.en.html) and [`debsign(1)`](https://manpages.debian.org/trixie/devscripts/debsign.1.en.html) document different links and signing roles.
[Debian's key page](https://ftp-master.debian.org/keys.html) requires independent verification of its informational key details.
Neither HTTPS nor matching declarations independently accepts a key or proves correct binary derivation.

## 2 · Packaging-source explanations are not inspected member formats

The devops pass reported these exact-version source-text observations.
The lead's later read of the math Makefile returned **“I Challenge Thee”** instead of source; no challenge was executed.
Treat the source observations separately from byte-level member qualification.

| Published text | Source-described behavior | Remaining byte/configuration gap |
|---|---|---|
| glibc [Makeconfig](https://sources.debian.org/data/main/g/glibc/2.41-12%2Bdeb13u4/Makeconfig), lines 366–381; [csu/Makefile](https://sources.debian.org/data/main/g/glibc/2.41-12%2Bdeb13u4/csu/Makefile), lines 86–108, 189–194 | Names ordinary `crt1.o`, shared/PIE `Scrt1.o` and static-PIE `rcrt1.o` startup branches | No generated configuration or source-to-inspected-CRT derivation |
| glibc [configure.ac](https://sources.debian.org/data/main/g/glibc/2.41-12%2Bdeb13u4/configure.ac), lines 2054–2075 | Gates static PIE on support checks and default-PIE configuration | No qualified generated configuration or `config.log` |
| glibc [amd64.mk](https://sources.debian.org/data/main/g/glibc/2.41-12%2Bdeb13u4/debian/sysdeps/amd64.mk), lines 1–8; [math/Makefile](https://sources.debian.org/data/main/g/glibc/2.41-12%2Bdeb13u4/math/Makefile), lines 471–506 | amd64 packaging selects mathvec; the mathvec installation branch generates `libm.a` as a GNU ld script grouping versioned libm and libmvec archives | A source-rule explanation does not identify the actual 132-byte member's format or contents |
| GCC [rules.defs](https://sources.debian.org/data/main/g/gcc-14/14.2.0-19/debian/rules.defs), lines 1426–1455; [rules2](https://sources.debian.org/data/main/g/gcc-14/14.2.0-19/debian/rules2), lines 414–417 | amd64 packaging selects PIE-by-default and conditionally adds `--enable-default-pie` | No actual driver specs, helper selection or static-PIE output proof |
| binutils [debian/rules](https://sources.debian.org/data/main/b/binutils/2.44-3/debian/rules), lines 501–535 | Describes default ld, conditional gold and `--with-sysroot=/` | No selected R1 linker or sealed search closure |

The reference inventory records equal hashes for `Scrt1.o` and `rcrt1.o` in this publication.
That equality identifies observed bytes, not the reason for equality or proof of either startup behavior.
Do not identify `.a`/`.o` formats from names, sizes, modes or these source rules.
Further retained-payload format inspection needs its own exact operation approval; consumed B authorizes no rerun.

[GCC copyright](https://metadata.ftp-master.debian.org/changelogs/main/g/gcc-14/gcc-14_14.2.0-19_copyright), [binutils copyright](https://metadata.ftp-master.debian.org/changelogs/main/b/binutils/binutils_2.44-3_copyright) and [glibc copyright](https://sources.debian.org/data/main/g/glibc/2.41-12%2Bdeb13u4/debian/copyright) supply package/file-specific licensing statements.
GCC documents specified runtime libraries, including libgcc, under Runtime Library Exception 3.1; this is not an exception for every tool or every file.
glibc's LGPL defaults coexist with file-specific exceptions and other licenses.
Exact linked-member attribution, applicable static-link obligations and compliance acceptance remain OPEN.

## 3 · Six initial security-tracker rows — no waiver

The security research pass inspected exactly **six** of the candidate's **96** vulnerable-status rows.
These are initial component/trigger descriptions, not closure-complete applicability decisions.
The remaining **90 rows are untriaged in this addendum**.
The historical candidate's statuses and NOT_ELIGIBLE disposition remain unchanged.

| Official tracker row | Published component / trigger | Selected source-version status / rationale | Applicability boundary |
|---|---|---|---|
| [CVE-2019-1010022](https://security-tracker.debian.org/tracker/CVE-2019-1010022) | NPTL stack-guard mitigation bypass requiring a separate stack-buffer overflow; exact function UNKNOWN | glibc `2.41-12+deb13u4`: vulnerable; unimportant; upstream does not treat it as a security issue | Native runtime mitigation and build-process exposure remain unproved |
| [CVE-2018-20796](https://security-tracker.debian.org/tracker/CVE-2018-20796) | Regex `check_dst_limits_calc_pos_1()` recursion/stack exhaustion on crafted expressions | Same glibc version: vulnerable; unimportant; tracker cites glibc security exceptions | Regex implementation/input reachability across runtime and build helpers remains unproved |
| [CVE-2026-97399](https://security-tracker.debian.org/tracker/CVE-2026-97399) | Power8 `strncasecmp()` page-boundary overread/crash | Same glibc version: vulnerable; trixie no-DSA “Minor issue”; tracker records `2.43-7` fixed | [Inference] x86_64 offers an architecture-exclusion hypothesis, not demonstrated closure-wide exclusion |
| [CVE-2026-115455](https://security-tracker.debian.org/tracker/CVE-2026-115455) | libstdc++ wide-stream `operator>>` into `std::bitset`; stack allocation size/alignment error | GCC `14.2.0-19`: vulnerable; trixie no-DSA “Minor issue” | Template/library usage, not automatically a compiler-parser flaw; instantiation in any selected process remains unproved |
| [CVE-2025-69652](https://security-tracker.debian.org/tracker/CVE-2025-69652) | readelf malformed ELF/DWARF: `process_debug_info()` cleanup and `byte_get_little_endian()` abort | binutils `2.44-3`: vulnerable; unimportant; tracker fixed version `2.46-1`; binutils lacks security support | Inspection-tool BUILD exposure; description “thru 2.46” versus fixed-version declaration remains unreconciled |
| [CVE-2026-91782](https://security-tracker.debian.org/tracker/CVE-2026-91782) | BFD `elf_x86_allocate_dynrelocs()` null dereference; exact malformed relocation prerequisites UNKNOWN | binutils `2.44-3`: vulnerable; unimportant; binutils lacks security support | Static output alone does not establish exclusion of this BUILD linker path |

The [GNU regex report](https://lists.gnu.org/archive/html/bug-gnulib/2019-01/msg00108.html) and [tracker-linked GCC fix via its mirror](https://github.com/gcc-mirror/gcc/commit/5d419c69ce2e6b86d7da75f18736904885674219) supplied additional component detail.
Several Sourceware/upstream bug pages returned 429 or bot challenges; their unavailable trigger details remain UNKNOWN.
The lead independently read the GCC bitset and readelf tracker rows.
No current-program exploit, severity determination or demonstrated vulnerability is asserted.
No row receives an applicability exclusion or risk waiver here.
Parsing untrusted source/object/debug data creates a BUILD boundary even if the emitted program is static.
Archive/member identity, package labels, panic-abort or the absence of an obvious application call do not establish native-function nonreachability.

## 4 · Rust 1.95 compiler retries invalidate a flag-only refusal claim

The lead read the published Rust commit `59807616e1fa2540724bfbac14d7976d7e4a3860`; no installed compiler or compiled output was inspected.
Immutable [`link.rs:735–851`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/link.rs#L735-L851) contains diagnostic-triggered retry branches:

| Branch | Compiler behavior on the matching failed link |
|---|---|
| GNU CC, unknown `-no-pie` | Removes the argument and invokes the linker again |
| GNU CC + LLD, unknown `-fuse-ld=lld` | Removes the argument and invokes the linker again |
| GNU CC, unknown `-static-pie` or `--no-dynamic-linker`, with `-static-pie` present | Replaces `-static-pie` with `-static`, changes applicable CRT arguments and invokes the linker again |

[`exec_linker:1575–1640`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/link.rs#L1575-L1640) also selects a response-file route heuristically or after an `E2BIG` spawn failure.
It can write `linker-arguments` before that invocation.
An `E2BIG` failure is not a first successfully executing driver, but its preparation and alternate invocation still require a specified bounded policy.
The immutable [codegen documentation](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/src/doc/rustc/src/codegen-options/index.md#linker-features) describes `-Clinker-features=-lld` and `-Clink-self-contained=-linker` opt-outs for this target.
Those controls do **not** disable the displayed static-PIE retry branch.

R1 therefore cannot claim “no fallback/no retry” from its present flags or a post-build ELF rejection alone.
A second linker guard invocation is also too late to prevent the compiler's preceding fallback CRT lookup or response-file write.
Before freeze, source-prove those paths unreachable under the exact defended recipe or define an adequate earlier refusal boundary.
No such boundary is implemented or accepted.

**[Unverified] Conditional diagnostic-channel isolation lemma, not an accepted adapter:** a driver adapter could retain bounded vendor diagnostics separately and expose only empty output with exit 0 on qualified success, or fixed nonzero refusal text `F9_LINK_TERMINAL_REFUSAL` on every handled failure.
Let `R(d)` denote the inspected unknown-argument regex over combined compiler-visible stdout/stderr.
Because `R(fixed_refusal)=false`, each displayed nonzero-status compatibility branch would remain false **if every compiler-visible completion obeyed this protocol**.
Admission and atomic one-attempt consumption must remain independent of vendor text; this is not a diagnostic filter that grants execution authority.
Startup/interpreter failure, panic reporting or unhandled errors can violate that premise before normal adapter handling.
For example, a pre-entry interpreter emitting `unknown option '-static-pie'` can re-enable the compiler's fallback preparation before a second invocation is denied.
Exact adapter/interpreter identities, complete startup/error channels, no diagnostic leakage, successful bounded retention/controller reporting and vendor-internal helper behavior therefore remain qualification obligations.
The lemma does not remove pre-entry E2BIG/heuristic response-file effects or prove positive cleanup.

### Investigation proposals — guarded direction selected for source-only research

1. **Guarded GNU driver:** investigate an authenticated controller/role-bound, atomic one-use admission mechanism before vendor execution, with exact arguments/environment/roots and terminal failure retention.
   This remains conditional on proving refusal before earlier fallback preparation, every helper edge and any guard bypass.
   PID/env tokens, diagnostic-string filtering and an asynchronous kill are not that proof.
2. **Direct GNU ld:** investigate explicit CRT/archive/native order instead of the GNU CC route.
   The displayed GNU-CC diagnostic branches would not apply to a proved non-CC flavor; response-file handling and complete replacement of driver/specs behavior remain unresolved.
3. **Keep R1 unfreezeable:** preserve the selected static-PIE constraints until a complete method survives independent review.

Executor selected **Guarded protocol (Recommended)** for **SOURCE-ONLY investigation** of the guarded GNU-driver direction; the other two directions remain unselected. Bun vs Rust adapter, production method and all guard mechanisms remain **UNSELECTED / NOT IMPLEMENTED / NOT ACCEPTED**. This selects a research direction only, not a mechanism, input, trust, API/format, source assignment or operation; the canonical packet §8 records the actual choice receipt.
No compiler patch, additional compilation root, dependency, unsafe/FFI, manifest change, source assignment or execution follows.
Future approved verification should reuse the packet's existing candidate `gnu-recipe.test.mjs` / `gnu-registration.test.mjs` obligations.
Cases must distinguish diagnostic-triggered retries, E2BIG/heuristic response files, malformed/nested/mutated response input, concurrent/replayed roles, failed spawn and retained failure.
Assert pre-effect order and vendor-execution counts, not only output rejection.
No test file was created or run for this addendum.

### Guarded-protocol audit · compiler side

**2026-11-04 · Source-only follow-up to Executor's investigation selection; no adapter form or production method accepted.**
The lead read additional files at the same published Rust commit and the published Linux v6.16 commit `038d61fd642278bab63ee8ef722c50d10ab01e8f`.
These are source coordinates, not installed executable/kernel identities.

| Audit record | Published source fact | Conditional result / remaining obligation |
|---|---|---|
| C1 · Executable selection | [`command.rs:102–124`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/command.rs#L102-L124) constructs `std::process::Command::new(p)` for a normal program, then adds arguments separately | `-Clinker` is not an interpreter-plus-argv command string; no shell splitting supplies Bun flags |
| C2 · Actual child environment | [`linker.rs::get_linker`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/linker.rs) constructs PATH from sysroot tool-search paths and inherited PATH; `disable_localization` sets `LC_ALL=C` and `VSLANG=1033` | A sealed parent environment alone does not describe every constructed child value; register the compiler's transformations too |
| C3 · Observed completion | [`link.rs:735–851`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/link.rs#L735-L851) breaks on `Err` or `Output.status.success()`; otherwise it matches diagnostics from **stderr followed by stdout**, decoded with `String::from_utf8_lossy` | Signals need not produce an exit code; all unsuccessful `Output` outcomes require the diagnostic predicate to remain false, not merely a promise of a particular exit code |
| C4 · Pre-entry response selection | [`command.rs:139–173`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/command.rs#L139-L173) estimates argument and **explicit** environment additions against `_SC_ARG_MAX`; it does not count the complete inherited environment | This heuristic is not a defended complete exec-size bound; exact argv/env/counts, kernel limits, chosen route and earlier writes remain OPEN |
| C5 · E2BIG is not only an oversized argv | Linux [`exec.c:143–168`](https://github.com/torvalds/linux/blob/038d61fd642278bab63ee8ef722c50d10ab01e8f/fs/exec.c#L143-L168) can fail argument-page acquisition; [`541–568`](https://github.com/torvalds/linux/blob/038d61fd642278bab63ee8ef722c50d10ab01e8f/fs/exec.c#L541-L568) returns `-E2BIG` when `get_arg_page` fails; [`1831–1840`](https://github.com/torvalds/linux/blob/038d61fd642278bab63ee8ef722c50d10ab01e8f/fs/exec.c#L1831-L1840) copies the filename before environment/argv | A small fixed argv does not alone prove the compiler's E2BIG response-file fallback unreachable on resource-failure prefixes |
| C6 · Compiler-side capture | [`process.rs:2366–2387`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/src/process.rs#L2366-L2387) reads captured pipes into growable vectors before waiting; the initial linker route calls this `wait_with_output` | This path supplies no application byte/deadline cap; pipe-read errors can panic through `unwrap`. Adapter-after-entry caps alone do not bound startup/error output, inherited writers or compiler completion |
| C7 · Native launch/cleanup | Published [`unix.rs::spawn`, `do_exec`, `posix_spawn`, `Process::wait`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/src/sys/process/unix/unix.rs) and [`common.rs::read_output`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/src/sys/process/unix/common.rs) retain native spawn choices, interrupted-call loops and EOF/wait dependencies | Rust safe APIs and a direct-child handle establish neither whole-build-tree termination nor bounded draining/reaping; no application unsafe/FFI waiver follows |

**[Unverified] Refined conditional compiler-channel obligation:** for each inspected `exec_linker` completion, `Err` leaves the compatibility loop; successful `Output` also leaves it; every other `Output` must satisfy `!R(String::from_utf8_lossy(stderr || stdout))`.
The adapter's handled fixed-result protocol can address the last condition only after entry.
It does not bound or prevent compiler-side preparation, response-file writes, native spawn alternatives or pre-entry diagnostics.
Success in this local predicate is not qualified build success or output registration.

**Refusal cut:** until route, entry, production method and full failure/resource policy are complete and independently reviewed, **deny before starting any compiler invocation capable of entering the uncontrolled link path**.
Refusing at adapter entry or rejecting the final ELF cannot undo earlier effects.

Executor selected **Controller link (Recommended)** for **SOURCE-ONLY proposal work** on candidate 2 below within the guarded-protocol investigation; candidate 1 (initial response file) and candidate 3 (compiler variant) remain unselected. This accepts no actual recipe, adapter form or production method:

1. Prove an independently preregistered **initial** response-file route and its bounded file/grammar/native effects; do not inject padding or adapt the recipe to force an observed heuristic result.
2. Investigate **compile-only followed by one controller-issued GNU-driver link**, with the entire Rust/native object/metadata/CRT/archive order specified; this is not direct `ld`, and host build-script/proc-macro link jobs still need their own contracts.
3. Investigate an explicitly approved pinned compiler variant; a patch creates a different compiler input/provenance record and cannot silently inherit the published compiler identity.

A preplanned initial route is distinct from a failed-spawn automatic retry, but its compatibility with the frozen requirements still needs independent review.
A native Rust adapter would add a fourth standalone compilation-crate candidate and needs a noncircular trusted production method; a Bun adapter needs an exact executable-entry/startup contract.
Neither form, extra compilation root, compiler patch nor changed recipe is accepted or assigned.
Missing or circular adapter production means **no build**; actual qualified adapter output identities still belong after approved production, not invented pre-freeze values.

### Guarded-protocol audit · Bun entry and startup

The devops source pass resolved the official [`bun-v1.4.0` reference](https://api.github.com/repos/oven-sh/bun/git/ref/tags/bun-v1.4.0) to commit **`34cbb9a40b4bd1bd767d134a7065e66c2432a676`**.
The lead independently read that reference.
The [release metadata](https://api.github.com/repos/oven-sh/bun/releases/tags/bun-v1.4.0) declares publication **2026-08-20 14:07:21 UTC**.
These observations authenticate neither the installed Bun executable/native closure nor its derivation from that source.

| Audit record | Published source finding | Conditional result / remaining obligation |
|---|---|---|
| B1 · Shebang framing | Linux [`binfmt_script.c:81–124`](https://github.com/torvalds/linux/blob/038d61fd642278bab63ee8ef722c50d10ab01e8f/fs/binfmt_script.c#L81-L124) supplies remaining shebang argument text as **one** argument before the script pathname | An absolute interpreter plus single `--no-env-file` argument is a candidate relation; `--no-env-file --no-install` is not two shebang arguments |
| B2 · Explicit no-install setting | Bun [`util.rs:3798–3807`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/bun_core/util.rs#L3798-L3807), [`3943–4009`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/bun_core/util.rs#L3943-L4009) parses `BUN_OPTIONS` and inserts tokens after argv[0] | Exact externally fixed `BUN_OPTIONS=--no-install` could precede that shebang flag/script, not inherit or concatenate an ambient value; this is not filesystem/network enforcement |
| B3 · Argument passthrough | [`Arguments.rs:778–804`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/runtime/cli/Arguments.rs#L778-L804), [`comptime.rs:549–568`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/clap/comptime.rs#L549-L568) stop AutoCommand parsing after one positional | [Inference] Under ordinary invocation classification and the exact valid absolute script relation, subsequent compiler flags pass through; an immediately following `--` is removed and must be excluded or explicitly modeled |
| B4 · Mode/configuration | [`cli/mod.rs:833–948`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/runtime/cli/mod.rs#L833-L948) has argv[0] mode classification; [`Arguments.rs:916–984`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/runtime/cli/Arguments.rs#L916-L984) loads configuration before applying no-env-file | Registered interpreter naming must not select node/bunx emulation; cwd `bunfig.toml` contents or enforced absence remain startup inputs |
| B5 · Preloads/home scope | [`bunfig.rs:381–391`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/bunfig/bunfig.rs#L381-L391) parses preloads; [`command_tag.rs:93–110`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/options_types/command_tag.rs#L93-L110) does not enable the global bunfig branch for AutoCommand/RunCommand | Do not claim all home/cache reads disappear; seal applicable local config/preload inputs before startup |
| B6 · Further startup reads | [`transpiler.rs:727–799`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/bundler/transpiler.rs#L727-L799) imports environment and traverses directory/tsconfig inputs; [`env_loader.rs:633–658`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/dotenv/env_loader.rs#L633-L658) still loads explicit env-file lists; [`resolver.rs:6371–6473`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/resolver/resolver.rs#L6371-L6473) probes package/tsconfig/jsconfig inputs | No complete read allowlist or zero-startup-effects proof follows from `--no-env-file` or builtin-only adapter imports |
| B7 · Pre-entry output | [`bunfig/arguments.rs:124–133`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/bunfig/arguments.rs#L124-L133) reports configuration errors; [`run_command.rs:1703–1721`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/runtime/cli/run_command.rs#L1703-L1721) reports boot errors; [`bun_bin/lib.rs:153–199`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/bun_bin/lib.rs#L153-L199) installs crash handling before CLI dispatch | Adapter exception handling cannot normalize failures before entry; complete channel bounds and `!R(d)` coverage remain OPEN |

[`Arguments.rs:979–993`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/runtime/cli/Arguments.rs#L979-L993), [`1178–1197`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/runtime/cli/Arguments.rs#L1178-L1197), [`run_command.rs:789–807`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/runtime/cli/run_command.rs#L789-L807) and [`global_cache.rs:31–63`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/options_types/global_cache.rs#L31-L63) describe no-default-dotenv and global-cache-disable settings, not kernel enforcement.
The examined [`streaming.rs:157–174`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/clap/streaming.rs#L157-L174) unrecognized-flag branch can warn and continue; do not claim a universal Bun unknown-option fatal path or equate its text with rustc's exact retry regex.
[`crash_handler/lib.rs:1730–1801`](https://github.com/oven-sh/bun/blob/34cbb9a40b4bd1bd767d134a7065e66c2432a676/src/crash_handler/lib.rs#L1730-L1801) also supplies stderr/metadata output paths outside adapter handling.
The source pass has not proved all those outputs satisfy `!R(d)`; failure to prove that is not a claim that a particular inspected Bun error demonstrably triggers a retry.

`BUN_ABS` and `ADAPTER_ABS` remain unqualified absolute-path metavariables; no script, shebang, environment, executable entry or read allowlist is assigned or created.
The candidate argument-safe relation does **not** close the compiler-dispatch/response-file gap above.
Both a Bun form and a fourth-root native Rust form still require independently reviewed startup, production, closure, admission, resource and surviving-cleanup contracts.

## 5 · Controller-owned linking — source-only proposal work

**[Unverified] Partial design/obligation map, not a complete link recipe or feasibility proof.**
Executor selected **Controller link (Recommended)** after the guarded startup audit.
Executor subsequently selected **Direct build DAG** as the production-method proposal; the Cargo-wrapper investigation below remains source evidence/history, not the current proposed execution driver.
The proposed separation is compile/archive-only Rust production followed by an independently controlled GNU-driver link, not direct `ld`, a compiler patch or Bun as rustc's selected linker.
No compiler/link command, adapter form, wrapper entry, API, input record, production method or source assignment is accepted.
Reuse only the existing **proposed, unassigned** `gnu-recipe.mjs` / `gnu-registration.mjs` responsibilities; create no wrapper module or fourth Rust root by implication.

### Role graph and observation cut

Before any compiler-capable dispatch, independently fix the source/configuration/feature graph and each query, compile, archive, native-helper and final-link role.
A role record must bind package/source identity, host versus target, crate/artifact kind, exact cfg/features/profile, inputs, ordered arguments, environment/CWD/roots, constrained intermediate bindings, output constraints, operation/resource quantities, failure owner and approval provenance.
Do not let Cargo's observed arguments, a build script or a newly found file nominate a role or its expected inputs.
Distinct legitimate build units require distinct preregistered roles; a changed unit identity does not rearm a failed attempt.

| Role | Proposed contract / unresolved source obligation |
|---|---|
| Three target executable roots | Investigate object-only emission while retaining `crate-type=bin` and the compiler-generated entry shim; no application-authored `extern "C" main`, staticlib substitution or application FFI |
| Arena/dependency Rust libraries | Preserve Rust metadata/object/archive behavior and the exact matching arena/dependency graph; do not equate an object or `libarena.rlib` alone with the full link closure |
| Host build-script executables | Complete host compilation/linkage and validation before Cargo executes the script; include generated cfg/env/native-link effects in the fixed producer graph |
| Host proc-macro shared libraries | Complete Rust metadata, exports, ABI and loader contract before a dependent compiler can load them; target static-PIE flags are not a host-DSO policy |
| Selected native producers/helpers | Fix their own source/tool/configuration, outputs, child graph and counts; first-party controller admission does not suppress dependency-owned native helpers |
| Compiler/Cargo queries and startup | Bound and classify required version/target/artifact queries and startup reads separately; neither a query label nor missing final output makes them effect-free |

The proposed per-role state is:

```text
PLANNED -> INPUTS_BOUND -> ATTEMPT_CONSUMED -> RESULT_RECORDED
        -> VALIDATED -> RELEASED_TO_BUILD_CONSUMER
any failure or ambiguity -> TERMINAL; retain evidence; never rearm
```

Consume each named phase's permission **before** its spawn; a failed spawn, including E2BIG, cannot choose another representation/path or retry.
Release a build-script executable or proc-macro DSO only after its required manual link and validation, before reporting successful completion to Cargo.
Release here means build-consumer visibility, not F9 Native authority or final independent output registration.
Controller startup failure before a job dispatch cannot authorize an unguarded compiler fallback; it remains a terminal bounded-failure/cleanup obligation.
Do not infer boundedness or custody merely because the controller starts before the compiler.

### Local manifest/lock observations — selected external graph incomplete

The backend pass read repository files only; it ran no Cargo command and inspected no installed dependency/cache.
[`Cargo.toml`](../../Cargo.toml) declares the training, arena and xtask members with resolver 3; [`rust-toolchain.toml`](../../rust-toolchain.toml) pins 1.95.0.
[`apps/arena/Cargo.toml`](../../apps/arena/Cargo.toml) selects path dependency `training-native`, Serde `=1.0.229` with derive and serde_json `=1.0.151` with float_roundtrip.
[`packages/training/Cargo.toml`](../../packages/training/Cargo.toml) selects Burn `=0.22.0`, `default-features=false`, with **std/flex/optim/store**; preserve those features and the existing Serde/JSON defaults.
The two manifests declare no first-party build dependencies, custom `build`/`links`, proc-macro or explicit crate type; the pass found no first-party `build.rs` in those package trees.
That observation establishes no absence of external build scripts.

Serde derives in both library roots and Burn's Module derive in [`model.rs`](../../packages/training/src/model.rs) require host macro work.
[`Cargo.lock`](../../Cargo.lock) records candidates including `serde_derive 1.0.229`, `burn-derive 0.22.0`, `libc 0.2.191`, `cc 1.8.0` and `pkg-config 0.3.33`.
Lock-wide presence or a dependency on syn/quote/proc-macro2 does not identify every selected build script, proc-macro crate type, native tool invocation or feature/target branch.
Other backend/GPU/native packages in the lockfile are not automatically selected by this R1 library build.
The repository [Cargo configuration](../../.cargo/config.toml) declares the xtask alias only; no ancestor/host configuration was inspected or implicitly accepted.
Arena's [`bridge.rs`](../../apps/arena/src/bridge.rs) and [`worker_transport.rs`](../../apps/arena/src/worker_transport.rs) embed `CARGO_MANIFEST_DIR`; manual production must preserve registered compile-time inputs rather than invent a replacement path.

### GNU-driver subprocesses remain separate roles

The lead read GCC's [14.2 collect2 documentation](https://gcc.gnu.org/onlinedocs/gcc-14.2.0/gccint/Collect2.html), [directory-search rules](https://gcc.gnu.org/onlinedocs/gcc-14.2.0/gcc/Directory-Options.html) and [overall/response-file options](https://gcc.gnu.org/onlinedocs/gcc-14.2.0/gcc/Overall-Options.html).
`-B` affects executable **and** library/include search; it is not an exact executable allowlist.
GCC response files permit recursive `@file` expansion; a controller's proposed bounded grammar must reject or explicitly fix every nested edge before vendor execution, not assume the driver does so.
No `gcc -###` or other vendor command was executed; documentation that it prints commands is not permission to use it as a registration oracle.

The observed mirror [release tag](https://api.github.com/repos/gcc-mirror/gcc/git/tags/c035a7c30c310ff928988cbcf445f3f21be10aa1) identifies upstream GCC 14.2.0 commit `04696df09633baf97cdbbdd6e9929b9d472161d3`.
This is an unaccepted upstream coordinate, not the exact Debian patched build/configuration or verified signer provenance.
Its [`collect2.cc:146–150`](https://github.com/gcc-mirror/gcc/blob/04696df09633baf97cdbbdd6e9929b9d472161d3/gcc/collect2.cc#L146-L150) makes collection configuration-dependent; [`1621–1649`](https://github.com/gcc-mirror/gcc/blob/04696df09633baf97cdbbdd6e9929b9d472161d3/gcc/collect2.cc#L1621-L1649), [`1680–1700`](https://github.com/gcc-mirror/gcc/blob/04696df09633baf97cdbbdd6e9929b9d472161d3/gcc/collect2.cc#L1680-L1700) and [`1791–1809`](https://github.com/gcc-mirror/gcc/blob/04696df09633baf97cdbbdd6e9929b9d472161d3/gcc/collect2.cc#L1791-L1809) contain distinct link, scan, generated-code and LTO/relink branches.
Do **not** infer that this selected amd64 binary necessarily links twice, or that one driver invocation proves one linker execution.
The actual provider's configuration/specs, permitted internal phases, normal cleanup and failure/retry branches remain to qualify.
No legitimate multi-phase branch becomes an automatic failure retry or a fee exemption by naming it a helper.

### Pinned compiler/Cargo artifact handoff — material source constraints

The devops pass read the same Rust source and its [Cargo submodule coordinate](https://api.github.com/repos/rust-lang/rust/contents/src/tools/cargo?ref=59807616e1fa2540724bfbac14d7976d7e4a3860), commit **`f2d3ce0bd7f24a49f8f72d9000448f8838c4e850`**.
That Cargo source [declares package version `0.96.0`](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/Cargo.toml#L140-L145); do not infer an installed Cargo identity or silently call the coordinate Cargo 1.95.

| Constraint | Published source evidence | Disposition for the proposal |
|---|---|---|
| Entry shim without final link | Rust [`entry.rs:23–41`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_passes/src/entry.rs#L23-L41), [`base.rs:469–568`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/base.rs#L469-L568) select/create the wrapper from the bin crate type; [`queries.rs:89–115`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_interface/src/queries.rs#L89-L115) gates backend linking on requested outputs | Source supports a bin/object-only direction; it does not supply the full final link closure |
| Emit options accumulate | [`config.rs:2139–2168`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_session/src/config.rs#L2139-L2168) accumulates requested output types | Appending `--emit=obj` to Cargo's existing link request does **not** disable linking; replace/validate the complete emission specification and preserve required non-link outputs |
| Object naming and kind | [`write.rs:550–611`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/write.rs#L550-L611) distinguishes one regular module from multiple per-CGU files; [`134–149`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/write.rs#L134-L149) permits bitcode objects in applicable modes | No single-object/newest-glob or native-machine-code assumption; naming/cardinality, CGU, backend and LTO policy remain to freeze |
| Allocator module | [`base.rs:627–644`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/base.rs#L627-L644) can require a separate module; [`write.rs:134–209`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/write.rs#L134-L209) emits its object only with the internal `Exe`/link output kind | Plain obj emission does not supply every required allocator artifact; refuse a unit requiring a missing shim |
| Possible allocator retention | The same ModuleConfig uses `emit_bc=save_temps` for the allocator; [`1821–1825`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/write.rs#L1821-L1825) runs its non-LTO codegen; [`629–675`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/write.rs#L629-L675) guards cleanup with `!save_temps` | Proposed stable save-temporaries can expose allocator bitcode on this path, but no accepted translation method/tool exists; this prevents a claim of impossibility, not the missing-artifact STOP |
| Dynamic metadata/export requirements | [`link.rs:2098–2119`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/link.rs#L2098-L2119) adds a metadata object during native linking; [`linker.rs:1789–1819`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/linker.rs#L1789-L1819) computes exports | Object-only emission is not a complete proc-macro/dylib production method |
| Distinct metadata representations | [`metadata.rs:510–525`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/metadata.rs#L510-L525) marks the ELF rlib wrapper SHF_EXCLUDE; [`575–620`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/metadata.rs#L575-L620) constructs the dylib `.rustc` header/length/symbol payload | Raw `.rmeta`, an rlib member and a loadable macro DSO are not interchangeable; no private-format converter or stable ABI is accepted |
| Wrapper and host roles | Cargo [wrapper documentation](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/doc/src/reference/environment-variables.md#L34-L48) passes the actual rustc path first and allows workspace-wrapper nesting; [`rustc.rs:62–67`](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/cargo/util/rustc.rs#L62-L67) wraps version probes too | Wrapper invocation is not authenticated role authority; admit queries and every selected unit explicitly |
| Cargo artifact reporting | [`compiler/mod.rs:1268–1294`](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/cargo/core/compiler/mod.rs#L1268-L1294) requests output kinds; [`659–677`](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/cargo/core/compiler/mod.rs#L659-L677) can skip nonexistent output paths | Cargo success does not validate required artifacts; withhold success and consumer release until independent role-specific validation |
| Retry before wrapper entry | Cargo [`rustc.rs:119–132`](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/cargo/util/rustc.rs#L119-L132) enables argfile spawn retry; [`process_builder.rs:359–368`](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/crates/cargo-util/src/process_builder.rs#L359-L368) can prepare that fallback before wrapper entry | A wrapper's later @file refusal is too late; where this path is uncontrolled, **deny before Cargo dispatch**, not merely before rustc or the GNU driver |

Adding regular-module assembly/IR/bitcode output alone does **not** enable a separate allocator module's object/assembly/textual IR.
Proposed `-C save-temps=yes`, forced CGU=1, non-LTO restrictions and vendor LLVM code generation are **unselected/unaccepted configuration or input-method extensions**, not current recipe facts.
GNU assembly cannot consume LLVM bitcode without a qualified preceding translation.
A possible vendor translation of compiler-generated allocator code is not application-authored FFI, but LLVM compatibility, target/layout/CPU/relocation settings, provenance, extra input closure and finite resource/attempt limits still require independent qualification.
No LLVM tool, command, installation or producer is nominated here.

The source pass identified no blanket gate rejecting proc-macro `obj,metadata`; it did not exhaustively prove support or execute such a job.
[`creader.rs:907–931`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/creader.rs#L907-L931) loads proc-macro declarations from a dylib: compile-only is **not** a guarantee of no dependency-code execution.
No `-Z no-link`, private `.rlink` format, `RUSTC_BOOTSTRAP`, dummy linker or compiler patch supplies an accepted shortcut.
The full selected graph therefore remains **incomplete / feasibility unproved**, not disproved solely by the plain-object allocator gap.

### Missing proof and future verification

Object-only emission and the complete native link derivation must be source-proven for **every admitted artifact type**, including host binaries/DSOs.
Do not assume `--emit=obj` preserves every final-link metadata/export requirement or emits a complete native-link argument plan.
Stable `--print=link-args` is not a nonexecuting oracle; the inspected compiler prints before native execution.
Unknown object/metadata semantics, unsupported LTO/backend, missing native input, extra/crossed/stale intermediate, premature consumer observation, unregistered helper or ambiguous completion means **deny dispatch/release**, not invent an ABI or run the original unguarded command.
Actual internal artifact bindings may arise in approved 5b only under a preaccepted constrained production/registration method; they cannot redefine source/input/recipe expectations from observed output.
Future approved `gnu-recipe.test.mjs` / `gnu-registration.test.mjs` scenarios must check no illicit native-link dispatch, preserved entry and host metadata, consumer release order, one-attempt role admission, all helper phases, response-file mutation/nesting and retained failure.
Those paths remain candidates; no test or implementation file was created or run.
Exact quantities, whole-build-tree enforcement, nonzero tariffs, disjoint invoice, native-closure audit, failure ownership and physical fit remain OPEN.
This partial proposal closes none of those records and grants no compilation, acquisition or build.

### Direct build DAG · finite contract, not an executable recipe

**[Unverified] Source-described partial contract only; selected units, producer methods and enforceability remain incomplete.**
The proposal removes **Cargo execution**, not Cargo manifests, lockfile or required package/feature/build semantics.
It selects neither the no-retry compiler/Cargo-variant direction nor direct `ld`.
The three target roots remain safe Rust/std with compiler-generated entry shims and GNU-driver static-PIE constraints.
No fourth Rust root, application FFI/unsafe, Cargo/dependency edit, installed-byte identity or source assignment follows.

The candidate logical node record is **not an accepted API, wire format or frozen RecipeRef**:

```text
NodeSpec {
  contract_version, node_identity, kind, unit_identity,
  source_inputs, predecessor_bindings, host_target,
  crate_artifact_kinds, features, cfg, profile, compiler_options,
  environment, cwd, read_write_roots,
  production_method, output_constraints,
  supervisor, bounds, failure_owner, release_predicate
}
```

Independently preregister each unit's package/source/version, platform/role, complete feature set, cfg/profile and compiler configuration.
The manifests/lock, public package metadata and observed build-script output are **different inputs**, not interchangeable authorities for this registration.
The source graph must distinguish host build dependencies/macros from target libraries and feature-unification scopes.
Do not choose units merely because they occur in Cargo.lock or appear in a compiler's observed arguments.
Compiler/Cargo queries may inform a separately approved observation, but no query or metadata command is run or implied here.

The proposed dependency flow is:

```text
frozen source/configuration + independently reviewed unit table
  -> host compile/archive + auxiliary producers
  -> validated build-script executables / macro DSOs
  -> separately admitted script runs / macro loads
  -> constrained generated source, cfg, env and native inputs
  -> target objects/archives + auxiliary producers
  -> controller-owned GNU-driver roles
  -> independent output/property/lineage registration
```

| Node kind | Required pre-dispatch production contract | Required before dependent release |
|---|---|---|
| Query | Exact source-proved query and input/native effects; never speculative Cargo/native linking | Bounded result checked against independently fixed constraints |
| Compile/archive | Complete emission replacement, crate kind, CGU/naming/cardinality, metadata and bundled-native policy | Correct unit/role/configuration, object formats and exact constrained inventory |
| Allocator | Pinned compiler's required allocator generation/retention, qualified compatible translation and nonrecursive tool production | Required symbols, visibility, architecture/layout, relocation and lineage; no missing shim |
| Metadata | Pinned dynamic `.rustc` representation plus symbol/export and reader/loader compatibility method | Correct header/length/section flags/alignment/export identities; no rlib-wrapper substitution |
| Native | Every selected native producer, script/helper phase and ordered input closure | Each output belongs to its preregistered producer and role; no ambient library/tool discovery |
| Host build-script | Validated host executable, then its separately admitted execution with fixed environment/roots | Ordered output grammar, cfg/env/native-link/generated bindings checked against independent constraints |
| Macro DSO | Complete host DSO production and validated loader/ABI/metadata closure | Permit compiler load only after validation; account for macro execution effects |
| Target executable | Complete object/archive/CRT/native order and one fixed GNU-driver invocation representation | All static-PIE/closure/lineage constraints, not exit status or ET_DYN alone |
| Registration | Independent source/input/recipe expectations and preapproved production-binding method | Actual approved-5b intermediate/final identities cannot redefine their expectations |

Each named phase uses the earlier atomic consume-once state model; it cannot repeat or rearm after failed spawn, E2BIG, partial output or ambiguous completion.
Dependencies remain unavailable until their producer validates and releases them.
An exit-0 producer or a controller-generated digest alone grants neither dependent execution nor final registration.
Any admitted normal multi-phase native operation needs explicit child roles and finite counts; it is not a failure-retry allowance.

**Manual build-semantic obligations:** reproduce all selected Cargo-derived compile/runtime inputs, including package metadata, manifest paths, feature variables, HOST/TARGET, profile values, OUT_DIR, applicable dependency metadata and ordered build-script directives.
Preserve existing `CARGO_MANIFEST_DIR` uses and unchanged dependency/default-feature choices.
A build script or macro may populate only independently preregistered constrained bindings; it cannot nominate another source, tool, node, search root, cfg or native link input.
Unknown directives, contradictory/ambiguous ordering, unregistered generated paths or unproved required package semantics reject the graph **before execution**, not after accepting a different build.
This addendum supplies no complete resolver implementation or selected unit inventory.

**Whole-tree no-Cargo obligation:** exclude Cargo not just from the top-level controller, but from every admitted build script, macro, compiler/helper spawn and failure path.
Neither environment variables, a wrapper pathname nor an allowlist claim proves descendant enforcement.
The selected source graph, exact executable/native closure and effective whole-build-tree execution/filesystem/network controls must establish that boundary before dispatch.
Controller Bun startup/configuration, compiler proc-macro loads, dependency-owned native tools and surviving supervisor/drain/disposal/reap remain in the physical and effect accounting.
Use Bun/Rust for first-party tooling; dependency-owned Python remains conditional on a selected audited producer and independently registered interpreter/closure, never a first-party fallback.

**Latest refusal cut:** missing unit graph, producer functionality/provenance, authenticated admission, effective bounds or surviving failure ownership means **deny before any DAG dispatch**.
Missing required artifact/metadata semantics never permits fallback to Cargo, rustc native final linking, another compiler, direct `ld`, a new meter or a changed origin.
Actual output identities remain post-production evidence after separately approved 5a **and** 5b, before 5c; no actual runtime proof is demanded before Gate0.
Current prerequisite design/audit/acceptance obligations remain OPEN; calling this a finite contract does not freeze the recipe or prove feasibility.

#### Direct-DAG auxiliary producers · pinned source facts

The devops pass traced both producer branches below; the lead independently read the LLVM gitlink/version defaults, Rust's LLVM tool list, metadata header/wrapper and GNU-property-note construction.
These are **conditional production contracts**, not implemented producers or accepted tool/format identities.

**Allocator translation coordinate.** Rust's [LLVM gitlink](https://api.github.com/repos/rust-lang/rust/contents/src/llvm-project?ref=59807616e1fa2540724bfbac14d7976d7e4a3860) identifies `1cb4e3833c1919c2e6fb579a23ac0e2b22587b7e`.
Its [LLVMVersion.cmake](https://github.com/rust-lang/llvm-project/blob/1cb4e3833c1919c2e6fb579a23ac0e2b22587b7e/cmake/Modules/LLVMVersion.cmake#L3-L13) supplies conditional source defaults **22.1.2**, not an executable build identity.
Pinned [`llc` documentation](https://github.com/rust-lang/llvm-project/blob/1cb4e3833c1919c2e6fb579a23ac0e2b22587b7e/llvm/docs/CommandGuide/llc.rst#L14-L100) describes LLVM bitcode/IR input and assembly/native-object output subject to target support.
Its [target-machine construction](https://github.com/rust-lang/llvm-project/blob/1cb4e3833c1919c2e6fb579a23ac0e2b22587b7e/llvm/tools/llc/llc.cpp#L592-L647) and [emission call](https://github.com/rust-lang/llvm-project/blob/1cb4e3833c1919c2e6fb579a23ac0e2b22587b7e/llvm/tools/llc/llc.cpp#L831-L835) provide source seams for a proposed translator.
This documents capability, **not selection of llc** or compatibility of an arbitrary system LLVM.
LLVM's [backward-bitcode policy](https://github.com/rust-lang/llvm-project/blob/1cb4e3833c1919c2e6fb579a23ac0e2b22587b7e/llvm/docs/DeveloperPolicy.rst#L774-L797) proves neither older-tool/newer-input compatibility nor arbitrary Rust-fork/upstream interchangeability.

Rust's pinned [`LLVM_TOOLS` list](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/src/bootstrap/src/lib.rs#L62-L77) **includes llc**, llvm-as/dis/link and opt.
The [distribution builder](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/src/bootstrap/src/core/build_steps/dist.rs#L2624-L2665) has conditional packaging/missing-tool handling; the list is not an inspected component inventory.
The lead read the official [dated 1.95.0 manifest](https://static.rust-lang.org/dist/2026-04-16/channel-rust-1.95.0.toml), observing `pkg.llvm-tools-preview`'s Rust commit match and `available=true` for x86_64 GNU:

| Public component declaration; not acquired or accepted | Declared SHA-256 |
|---|---|
| [llvm-tools-1.95.0-x86_64-unknown-linux-gnu.tar.xz](https://static.rust-lang.org/dist/2026-04-16/llvm-tools-1.95.0-x86_64-unknown-linux-gnu.tar.xz) | `037d534bb21bf1d833bb9ef6e2304878ecc5cc04176b6674a90a73fa7a4ac0b1` |
| [gzip declaration](https://static.rust-lang.org/dist/2026-04-16/llvm-tools-1.95.0-x86_64-unknown-linux-gnu.tar.gz) | `55b57b2aff59cff2acffa1319513e7c74b0a09ef5a58e1d5f4beba4c8d911f7a` |

These are alternative publication coordinates, **not an authorized fallback or download list**.
No component payload was acquired; member inclusion, executable lengths/digests, actual source/binary lineage, licensing, installed availability and full native closure remain unqualified.
Publisher signatures remain NOT RUN and no key/input is accepted.

The candidate allocator method must bind the producing compiler invocation and source-derived allocator identity/path, retained non-LTO bitcode, exact translator/build provenance, bitcode dialect, triple/data layout, CPU/features, relocation/code model and remaining codegen settings.
Validate generated allocator symbols, visibility and relocations in the native object before dependent release.
An optional assembly stage requires its own registered producer/assembler; GNU assembly alone is not a bitcode converter.
Actual generated allocator bytes are constrained 5b intermediates, not invented pre-freeze input identities.

**Dynamic metadata transformation.** Pinned [`metadata.rs:575–620`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/metadata.rs#L575-L620) constructs:

```text
M = admitted metadata.stub_or_full() bytes
H = 72 75 73 74 00 00 00 0a
P = H || u64le(length(M)) || M
```

The [metadata header source](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/rmeta/mod.rs#L55-L69) supplies encoding version10.
Preserve M unchanged, including its own header; this wrapper function performs no additional compression despite its name.
Proc-macro's [metadata production path](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/fs.rs#L36-L109) skips the stub branch; ordinary dylib `stub_or_full()` must not be assumed identical to every emitted full `.rmeta`.

For a separately qualified narrow x86_64 GNU writer contract, source describes ELF64/little-endian/EM_X86_64 ET_REL, OSABI_NONE, ABI version0, e_flags0; `.rustc` is SHT_PROGBITS with **flags0/alignment1**, not the rlib wrapper's SHF_EXCLUDE.
The metadata symbol is defined data, nonweak dynamic scope, section-relative payload offset and payload size; the [compiler-dependency object serializer](https://github.com/gimli-rs/object/blob/5b66b69298f6198f9d5b5bb2a0b284b4d920a92c/src/write/elf/object.rs#L450-L841) maps that to STB_GLOBAL/STT_OBJECT/STV_DEFAULT.
The source also adds [`.note.gnu.property`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/metadata.rs#L128-L174), alignment8, target-endian u32 header `(4,16,NT_GNU_PROPERTY_TYPE_0)`, `GNU\0`, and x86 property words `(GNU_PROPERTY_X86_FEATURE_1_AND,4,3,0)`.
Do not omit that source-described note or infer runtime protection from it.
Deterministic section/string/symbol table serialization, all object attributes and consumer compatibility still require their own independently reviewed method; structural agreement is not whole-file equivalence.

The source formats [metadata symbols](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_middle/src/middle/exported_symbols.rs#L86-L91) as `rust_metadata_<crate-name>_<stable-crate-id:08x>` and [proc-macro declarations](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_session/src/session.rs#L394-L395) as `__rustc_proc_macro_decls_<id.as_u64():08x>__`.
Width8 is a minimum formatting width, not permission to truncate an identifier or choose a symbol from arbitrary observed output.
The independent metadata/identity decoder and join to genuine compiler-generated declaration definitions remain OPEN.
Pinned [metadata extraction](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/locator.rs#L879-L929), [compiler-version checks](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/rmeta/decoder.rs#L699-L717) and [export selection](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/linker.rs#L1789-L1861) remain separate producer/consumer obligations.
Encoding version10 and two symbol names are not a universal dylib ABI/export contract.

**[Inference]** A narrow data-only Bun producer can be specified without application FFI/unsafe, another Rust crate, manifest or dependency; none is implemented, assigned or accepted here.
It must validate lineage-bound M, reproduce the reviewed target-specific payload/object properties, reject malformed/over-limit/substituted data and record input/contract/compiler/output hash lineage without treating hashes as semantic authority.
No arbitrary shared-library rewriting, fabricated declaration data, private `.rlink` or compiler-version substitution follows.
Complete ordered Rust/native inputs, archives/indexing/grouping, std/panic/compiler-builtins/CRT selection and later macro-load qualification remain OPEN.

#### Direct-DAG graph semantics · three-manifest public research sample

The backend pass read pinned Cargo [resolver](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/doc/src/reference/resolver.md), [features](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/doc/src/reference/features.md), [build-script](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/doc/src/reference/build-scripts.md), [environment](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/doc/src/reference/environment-variables.md), [registry-index](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/doc/src/reference/registry-index.md) and [`UnitInner`/`UnitInterner::intern`](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/cargo/core/compiler/unit.rs) text.
It also read exactly these three version-specific public manifests and registry API metadata records, with no nearest-version fallback:

| Public source coordinate | Reported declarations relevant to the fixed graph | Remaining join |
|---|---|---|
| [serde 1.0.229 manifest](https://docs.rs/crate/serde/1.0.229/source/Cargo.toml), [API](https://crates.io/api/v1/crates/serde/1.0.229) | `build="build.rs"`; ordinary serde library; default std, derive activates optional serde_derive; exact serde_core `=1.0.229` uses result with defaults disabled | Build-script source/effects, complete unit edges and archive-byte-to-rendered-text join remain UNKNOWN |
| [burn 0.22.0 manifest](https://docs.rs/crate/burn/0.22.0/source/Cargo.toml), [API](https://crates.io/api/v1/crates/burn/0.22.0) | `build=false`; ordinary library; mandatory burn-core/burn-nn/burn-std; requested optim activates burn-optim/autodiff, store activates burn-store, flex forwards to burn-core/flex; relevant defaults disabled | Transitive feature/host/target closure remains UNKNOWN; docs.rs doc features are not project features |
| [burn-derive 0.22.0 manifest](https://docs.rs/crate/burn-derive/0.22.0/source/Cargo.toml), [API](https://crates.io/api/v1/crates/burn-derive/0.22.0) | `build=false`, `proc-macro=true`, library name burn_derive; dependencies include burn-einsum, derive-new, proc-macro2, quote and syn with full/extra-traits/visit | Selected incoming edge, host dependency-unit closure and source-byte join remain UNKNOWN |

The reported registry crate/name/version/checksum fields agree with those three existing Cargo.lock entries.
The lead independently read the three API metadata records and lock entries, observing the same archive-checksum declarations:

| Candidate archive coordinate | Declared SHA-256; not an accepted input |
|---|---|
| serde 1.0.229 | `4148590afebada386688f18773da617792bf2ef03ffc1e4cbd2b1d45b023e0ba` |
| burn 0.22.0 | `1327eaa7aca0e3e80bd14641e6396bb81571a17a7fea7f7e3baf6e82ca07c8bd` |
| burn-derive 0.22.0 | `0763caa670c432a87e15a88cd1914241870ebf714bc28855bf6c6f5ea38ec0d6` |

The index checksum identifies the **`.crate` archive**, not docs.rs's rendered manifest bytes.
Matching metadata therefore selects no new approved SOURCE snapshot and proves no authenticated manifest extraction.
These three records are a sample, **not whole-graph coverage or a source-audit PASS**.
Serde's build declaration makes a host executable/producer dependency concrete; Burn's own `build=false` does not eliminate descendant build scripts.

For pre-freeze graph review, preserve resolver-3 feature separation inherited from resolver 2, including host/build/macro versus normal-target scopes even when triples coincide.
Resolver-3's incompatible-Rust-version fallback preference does **not** authorize replacing locked versions.
Handle default/optional features, `dep:` and weak `dependency?/feature` edges rather than treating every lock dependency as enabled.
The unit identity must distinguish Cargo target kind/name/root/crate types, compilation kind/mode/profile, sorted features, cfg/flags and **dependency-unit identity**.
The pinned Cargo unit structure uses `dep_hash` to distinguish units that otherwise match but link against different dependencies.
Production may consume an independently frozen **fixed unit table**; this does not authorize implementing a general resolver or discovering additional units during build.

The manual build-script contract must preserve:

- Distinct compilation and script-execution environments; script `cfg!` describes its host build, whereas applicable `CARGO_CFG_*` describes the associated package configuration.
- Package and manifest fields, HOST/TARGET, CARGO_FEATURE_*, CARGO_CFG_*, OUT_DIR, OPT_LEVEL/DEBUG and applicable immediate DEP_* values; PROFILE alone does not specify the effective profile.
- Explicit handling of the documented CARGO executable-path field without permitting nested Cargo execution.
- Declared initial OUT_DIR state; Cargo documentation does not promise it starts empty.
- Ordered and target-scoped `rustc-link-lib`, `rustc-link-search`, restricted `rustc-flags` and `rustc-link-arg*`; never sort away link order or broadcast binary-only arguments into library units.
- Separate `rustc-env`, `rustc-cfg` and `rustc-check-cfg`; check-cfg does not enable a cfg, and build-script cfg does not activate Cargo dependencies/features.
- `links` uniqueness and immediate-dependent `metadata=KEY=VALUE` to `DEP_<LINKS>_<KEY>` routing; no invented transitive propagation.

Every producer's source/entry, input relation, tools/subprocesses, output paths, ordered directive grammar and consumer scope must be independently fixed.
Returned stdout/generated files are observations against that contract, not authority to choose expected inputs, cfg, tools or new producer identities.
Still require checksum-joined source trees, remaining manifests/target declarations, aliases/dependency kinds, exact feature/cfg/profile inputs and script/generated-output relations before the graph can freeze.

#### Concrete host producers · Serde / serde_core 1.0.229

The backend read exactly the public Serde [manifest](https://docs.rs/crate/serde/1.0.229/source/Cargo.toml)/[build.rs](https://docs.rs/crate/serde/1.0.229/source/build.rs) and serde_core [manifest](https://docs.rs/crate/serde_core/1.0.229/source/Cargo.toml)/[build.rs](https://docs.rs/crate/serde_core/1.0.229/source/build.rs).
These rendered texts remain unjoined to checksum-verified archive bytes.
Both packages declare `build="build.rs"`; neither sampled manifest declares build dependencies, links or proc-macro library status.
Their explicit source behavior is:

| Producer element | Published relation; no execution observed | Required independent preregistration/refusal |
|---|---|---|
| Generated source | Each script writes `OUT_DIR/private.rs` using its embedded PRIVATE string with every `$$` replaced by `CARGO_PKG_VERSION_PATCH`; Serde additionally refers to serde_core's matching private module | Bind exact source template, patch `229`, destination relation and UTF-8/trailing-newline bytes; no generated file or digest is invented as an observed 5b output |
| Ordering | Initial stdout directives and generated-file write precede the version query | Preclassify/defend these prefixes and cleanup liability; a failed later query does not erase prior effects |
| Version query | `Command::new(env::var_os("RUSTC"))` with only `--version`, `.output()`, no explicit environment/CWD override | Register the genuine compiler identity, inherited context and bounded query role; differing contexts require separate roles |
| Query parser | Scripts require UTF-8 stdout, first dot-separated segment `rustc 1`, then parse minor as u32; they do not verify exit status, stderr, patch or remaining version segments | Independent successful-status/exact-1.95.0 evidence must exceed this permissive parser; correct stdout with failed status is not valid query evidence |
| Error prefix | Missing RUSTC, spawn/read/parse failure yields None and main returns without error after earlier output/write | Script exit0 is not complete producer evidence; missing required query evidence or predicted outputs rejects release |
| Environment | Both explicitly read OUT_DIR, CARGO_PKG_VERSION_PATCH and RUSTC; serde_core also reads TARGET after query success | Fix those values/context before effects; no source branch reads CARGO_FEATURE_* or CARGO_CFG_TARGET_* directly |
| Output directory | Scripts do not create OUT_DIR or validate its existing contents; `fs::write` may replace/follow an existing destination | Establish protected initial state and absence/identity/mutator policy before writing; post-write checks cannot repair an earlier alias/overwrite |

These are logical source operations, **not kernel-call counts, native-closure completeness or bounded std I/O proof**.
Neither sampled script explicitly invokes Cargo, performs a compile probe or launches a C/native tool.
That fact proves no absence of such work elsewhere in the selected graph.

Serde's ordered prefix is `cargo:rerun-if-changed=build.rs`, then `cargo:rustc-cfg=if_docsrs_then_no_serde_core`.
serde_core's prefix contains only the rerun-if-changed line.
Under independently qualified Rust minor95, Serde's additional `cargo:rustc-check-cfg=cfg(feature, values("result"))` precedes this exact shared check-cfg order:

```text
if_docsrs_then_no_serde_core
no_core_cstr
no_core_error
no_core_net
no_core_num_saturating
no_diagnostic_namespace
no_serde_derive
no_std_atomic
no_std_atomic64
no_target_has_atomic
```

**Conditional source prediction, not runtime output or an accepted limit:** with the fixed patch input229 and qualified minor95, Serde emits **13 ordered directive lines** and serde_core emits **11**, with no legacy-gate cfg lines.
The versions' lower-minor branches and serde_core's old target-atomic branches remain source cases, not permission to downgrade Rust or select another target.
Neither script emits link directives, rustc-env or links metadata in this source audit.
The named check-cfg expectations do not enable their listed cfgs.

The proposed query/producer check must preserve independent status/context evidence, expected directive sequence and generated-file relation, without letting returned stdout/files nominate EXPECTED.
The required trusted descendant-query observer/admission interface is **not implemented or qualified**; no extra preflight query or reuse of one context's result is approved here.
If query failure cannot be distinguished from permissive script success, or OUT_DIR/native failure bounds remain unproved, deny dispatch/release under the earlier cut.
No Serde edit, generated source, query, compiler invocation or test ran in this audit.

#### Burn frontier · exact-version public manifests, not a resolved unit graph

After Executor selected public-text continuation, the backend read the four exact manifests/API records below.
The lead independently compared the four API checksum declarations with the existing lock entries and read the store/optim manifests.
All four manifest texts declare edition2024, `build=false` and an ordinary explicit `src/lib.rs` library, with no proc-macro, links or build-dependency declaration.
That observation concerns these packages only, not their descendants.

| Package/version · public manifest / API | Declared archive SHA-256 matching Cargo.lock; not an accepted input |
|---|---|
| burn-core 0.22.0 · [manifest](https://docs.rs/crate/burn-core/0.22.0/source/Cargo.toml) / [API](https://crates.io/api/v1/crates/burn-core/0.22.0) | `f0bbcad963536f69e90a81e41afcbe831376c43a978039d40a06c8c7909d8201` |
| burn-flex 0.22.0 · [manifest](https://docs.rs/crate/burn-flex/0.22.0/source/Cargo.toml) / [API](https://crates.io/api/v1/crates/burn-flex/0.22.0) | `e5b982416cb773274e44666f8682cd7e5fde3c294cd4206ffc080e73c545ef2e` |
| burn-optim 0.22.0 · [manifest](https://docs.rs/crate/burn-optim/0.22.0/source/Cargo.toml) / [API](https://crates.io/api/v1/crates/burn-optim/0.22.0) | `325ad6f093312957997fca3218e879d5d4aadfc1af902934b86fc577f9d90b54` |
| burn-store 0.22.0 · [manifest](https://docs.rs/crate/burn-store/0.22.0/source/Cargo.toml) / [API](https://crates.io/api/v1/crates/burn-store/0.22.0) | `958636e1e23cb5b3312228e70f91448ccf84e2f5173059160fcd4e374f36c631` |

The registry checksum declares the `.crate` archive identity, not an authenticated extraction of docs.rs-rendered text.
Source-byte joins remain OPEN; neither a matching declaration nor these four `build=false` fields establishes complete graph/producer coverage.
Preserve the root Burn `default-features=false` plus **std/flex/optim/store** and the existing Serde/JSON defaults, not docs.rs's documentation feature set.

| Local feature/dependency relation | Source-derived consequence under the stated incoming request | Boundary still requiring registration |
|---|---|---|
| burn-optim's mandatory burn-core dependency requests `autodiff,extension` with defaults disabled | This edge exists independently of optim's own default feature; core/extension activates optional burn-backend-extension, burn-dispatch and burn-backend | Dispatch/backend implementation and macro roles need their own manifests/units; this does not select every hardware backend |
| core `flex → burn-tensor/flex`; core `autodiff → burn-tensor/autodiff` | Those feature names forward through tensor rather than directly selecting core's optional CPU/CUDA/ROCm/WGPU packages | The follow-up below resolves these local tensor/dispatch edges; the globally unified unit set remains incomplete |
| core/std weak `burn-{cpu,cuda,rocm,wgpu}?/std` forwarding | Weak forwarding does not itself activate an absent optional backend | Preserve other genuine incoming feature edges; do not infer backend exclusion solely from this row |
| core and optim have mandatory burn-derive dependencies | The previously observed proc-macro declaration has concrete incoming package edges | Genuine host unit/features/dependency closure and load contract remain incomplete |
| burn-store/std explicitly names `dep:memmap2`, `dep:regex`, and strong `safetensors/std` | Unlike weak `safetensors?/std`, the strong forwarding activates that optional dependency; parent defaults disabled does not erase these std effects | Register selected external/native subtrees and their features; memmap2 has its own defaults enabled |
| burn-store's declared default is `std,pytorch,safetensors,memmap`; pytorch separately names pytorch-reader | This declared default set does not activate merely because the parent requests store/std with store defaults disabled | Do not assume pytorch or all store defaults are selected; account for any separate enabling edge |
| Flex declares default `std,simd,rayon`; std forwards into gemm/backend/std/ir/half/num-traits; gemm dependency defaults are disabled with f16 requested | Declared defaults alone do not prove incoming SIMD/Rayon selection; simd/rayon/critical-section have distinct dependency/forwarding effects | The audited dispatch edge below disables Flex defaults; still register any other incoming edges and gemm/optional subtree roles rather than substituting a smaller configuration |

Core's `target_has_atomic="ptr"` regex declaration and store's opposite-predicate bytes/extra-platforms declaration remain separate cfg-conditioned edges; no predicate was evaluated here.
Core's Serde derive/alloc and JSON alloc requests with dependency defaults disabled do not cancel the preserved root requests/defaults.
The first four records leave tensor/dispatch selecting edges for the follow-up below; the fixed graph still needs complete backend/extension/ir/std/pack/nn and enabled external subtrees.
Names or lock-wide GPU/native packages are not selected-role evidence.
No hardware probe, feature-resolver execution, build-script execution, generated artifact or whole-graph PASS follows.

**Tensor/dispatch follow-up.** The backend read exactly two additional manifests/API records; the lead independently matched their API checksum declarations to the existing lock entries:

| Package/version · public manifest / API | Declared archive SHA-256 matching Cargo.lock; not an accepted input | Producer declaration |
|---|---|---|
| burn-tensor 0.22.0 · [manifest](https://docs.rs/crate/burn-tensor/0.22.0/source/Cargo.toml) / [API](https://crates.io/api/v1/crates/burn-tensor/0.22.0) | `63c5477debe70a9f68ab2e296274db8dddd7e6d0fd10b9c7d09a550302e8f295` | Ordinary library; `build=false` |
| burn-dispatch 0.22.0 · [manifest](https://docs.rs/crate/burn-dispatch/0.22.0/source/Cargo.toml) / [API](https://crates.io/api/v1/crates/burn-dispatch/0.22.0) | `febbab200fc7ade5a7cef046729beaa42ed751325514372732de33634ff9f5c5` | Ordinary library; **`build="build.rs"`**, requiring a host producer |

Neither manifest declares proc-macro/links/build-dependencies; **all six source-byte joins remain OPEN**.
Tensor's mandatory dispatch dependency disables defaults; tensor has no direct Flex dependency/alias.
Tensor forwards flex/autodiff/std to the corresponding dispatch features; tensor/extension is empty.
Dispatch/flex activates optional burn-flex with **defaults disabled**, while dispatch/std weakly forwards burn-flex?/std.
Thus these audited incoming edges request Flex std, **not its declared default/simd/rayon**.
This is a local feature closure, not a globally final feature assignment or permission to alter the root request.
Dispatch's `cfg(not(target_has_atomic="ptr"))` declaration can additionally request Flex critical-section and a nonoptional portable-atomic dependency under that predicate; no predicate was evaluated here.

The known local dispatch requests are std/flex/autodiff, with optional burn-autodiff defaults disabled and conditional std forwarding.
Tensor's dispatch dependency exists independently of the additional core/extension edge.
Dispatch's explicit cpu/cuda/rocm/wgpu activators route through CubeCL, while ndarray/tch have distinct activators; weak std/default forwarding does not enable every backend.
The feature name cpu here denotes the CubeCL CPU route, not Flex selection.
These audited edges do not request those activators, but the complete incoming graph remains unqualified.
Tensor's mandatory burn-derive edge confirms another host macro use; dispatch's mandatory backend-extension and paste dependencies require independent target/producer inspection rather than inference from names.

**Dispatch host producer.** Both backend and lead read [burn-dispatch 0.22.0/build.rs](https://docs.rs/crate/burn-dispatch/0.22.0/source/build.rs), lines1–39.
Its explicit source operations contain no runtime environment reads, subprocesses, file reads/writes, helper inclusion, OUT_DIR generation, Python reference or compiler/hardware probe.
This is not a zero-syscall/native-startup or physical-effect claim.
Its inputs are the **compiled build-script unit's** twelve feature cfgs; runtime CARGO_FEATURE_* values alone do not set those `cfg!` expressions.

```text
cube      = cuda || rocm || cpu || metal || vulkan || webgpu || wgpu
local     = cube || flex || ndarray || tch
executing = local || remote
```

It prints, in order, three unconditional `cargo::rustc-check-cfg=cfg(...)` lines for cube_backend, executing_backend and backend_enabled.
It then conditionally prints, in this exact order:

| Condition from the preregistered compiled feature assignment | Directive |
|---|---|
| executing OR capture | `cargo::rustc-cfg=backend_enabled` |
| cube | `cargo::rustc-cfg=cube_backend` |
| executing | `cargo::rustc-cfg=executing_backend` |

Each emitted line ends with a newline; absent branches contribute no line.
Capture alone contributes backend_enabled, not executing_backend.
The source contains no link/rustc-env/metadata/rerun directives or additional output formats.
Independently bind source, host compilation/configuration and the twelve feature inputs before deriving the expected ordered stdout relation; observed stdout cannot choose its own feature assignment.
Register no script-originated file/subprocess production, without pretending that declaration enforces or bounds the runtime's native effects.
Missing/reordered/extra directives, unexpected effects or an unresolved compile-time feature assignment require refusal/review before consumer release.
No script, query, generated artifact or test was executed.

**Additional Burn/library/macro frontier.** The backend read these eight exact manifests/API records after first locating their versions in Cargo.lock.
The lead independently matched all eight API checksum declarations to the lock and read the burn-std/burn-nn manifests plus paste's build script.
All explicit library paths are src/lib.rs; none of these eight manifests declares links or build dependencies.
Declared defaults are not automatically activated by parent std forwarding, and this sample supplies no global feature-resolution or source-byte admission result.

| Package/version · manifest / API | Library / build declaration | Archive-checksum declaration matching Cargo.lock; not admitted source |
|---|---|---|
| burn-backend 0.22.0 · [M](https://docs.rs/crate/burn-backend/0.22.0/source/Cargo.toml) / [A](https://crates.io/api/v1/crates/burn-backend/0.22.0) | ordinary; build=false | `cab8511ddfe6e2219518091530ef2c57e4bbef77b3b941d1c0d7a2362531df0b` |
| burn-backend-extension 0.22.0 · [M](https://docs.rs/crate/burn-backend-extension/0.22.0/source/Cargo.toml) / [A](https://crates.io/api/v1/crates/burn-backend-extension/0.22.0) | **proc-macro**; build=false | `8cd738a84693ee48727305bbccf79fc9775d742569320457153b02d4d72b11b2` |
| burn-ir 0.22.0 · [M](https://docs.rs/crate/burn-ir/0.22.0/source/Cargo.toml) / [A](https://crates.io/api/v1/crates/burn-ir/0.22.0) | ordinary; build=false | `14d55eb2c776d465e221413b61a33070e3f3d6d0f3845bd65b58bf128c85207d` |
| burn-std 0.22.0 · [M](https://docs.rs/crate/burn-std/0.22.0/source/Cargo.toml) / [A](https://crates.io/api/v1/crates/burn-std/0.22.0) | ordinary; build=false | `9b0c6461bfc275a2b1da6fa669ba9f08f3edadee5633a85621684007f5428d64` |
| burn-pack 0.22.0 · [M](https://docs.rs/crate/burn-pack/0.22.0/source/Cargo.toml) / [A](https://crates.io/api/v1/crates/burn-pack/0.22.0) | ordinary; build=false | `49f4f8af98c3ec2328cb977805eb2095b8e213e67d54d344567e901b88fe8802` |
| burn-nn 0.22.0 · [M](https://docs.rs/crate/burn-nn/0.22.0/source/Cargo.toml) / [A](https://crates.io/api/v1/crates/burn-nn/0.22.0) | ordinary; build=false | `f5e5a9b1193bf10e6a9d9adf097b9b75cb5685a7e5a3c4a5657512416889d9b1` |
| burn-autodiff 0.22.0 · [M](https://docs.rs/crate/burn-autodiff/0.22.0/source/Cargo.toml) / [A](https://crates.io/api/v1/crates/burn-autodiff/0.22.0) | ordinary; build=false | `1db9c1868928b1c33b176f9004c38c8a782e905aab6e89bad7f91eab8ea455ae` |
| paste 1.0.15 · [M](https://docs.rs/crate/paste/1.0.15/source/Cargo.toml) / [A](https://crates.io/api/v1/crates/paste/1.0.15) | **proc-macro; build="build.rs"** | `57c0d7b74b563b49d38dae00a0c37d4d6de9b432382b2892f0574ddcae73fd0a` |

These remain public metadata joins; all eight rendered-manifest-to-archive byte joins remain OPEN.
Backend-extension and paste now have confirmed proc-macro declarations, not merely suggestive names.
Their genuine host units, metadata/DSO production, loading and custody still require registration.
The backend-extension manifest's syn requirement does not override the existing lock's syn3.0.9 resolution.

| Audited local relation | Source-derived graph obligation |
|---|---|
| burn-backend/std weakly forwards cubecl?/std; explicit `cubecl` / `cubecl-device` features activate the optional CubeCL dependency | Std alone does not activate that optional dependency, but no blanket CubeCL exclusion follows |
| burn-ir/std forwards backend/std and burn-std/std; burn-pack/std forwards burn-std/byteorder/ciborium std | Preserve actual incoming defaults and Serde derive/alloc requests, not an assumed universal std expansion |
| burn-std has mandatory cubecl-common/environment/zspace `0.11.0` dependencies with defaults disabled, even without burn-std/default | CubeCL utility nodes remain required boundaries; their names do not prove hardware-backend activation or native producer absence |
| Common receives serde/shared-bytes/fp8; environment receives shared-bytes; burn-std/std forwards common/environment std | Register these exact local feature requests and preserve parent default suppression; common/environment defaults require a separate genuine incoming default edge |
| burn-std/network separately activates indicatif/reqwest/tokio | Std alone is not a request for that feature; no claim that the full graph is network-capable or network-free follows |
| burn-nn mandatorily depends on burn-linalg with defaults disabled, and std forwards linalg/std | Root linalg feature absence does not eliminate the nn → linalg path |
| burn-autodiff/std activates optional parking_lot with defaults disabled, without itself forwarding backend/std or burn-std/std | Other incoming edges may still enable those features; freeze role-scoped unification rather than infer it from feature spelling |
| burn-std's not-atomic-ptr bytes and autodiff's not-atomic64 portable-atomic declarations | Preserve cfg-conditioned edges; no target predicate or hardware probe was evaluated |

Other enabled external subtrees and default-enabled dependencies remain to inventory; none of these build=false declarations excludes descendant producers.
The newly exposed frontier includes burn-linalg0.22.0, CubeCL utilities0.11.0, oneshot, parking_lot and remaining macro-support units.
No version/default-feature change, dependency addition or backend replacement is proposed.

**Paste host producer.** Both backend and lead read [paste 1.0.15/build.rs](https://docs.rs/crate/paste/1.0.15/source/build.rs), lines1–38.
It first prints `cargo:rerun-if-changed=build.rs`, then queries RUSTC with only `--version` through std Command::output.
Like the sampled Serde scripts, it accepts UTF-8 stdout whose dot-separated prefix is rustc1 and numeric minor, without checking child status/stderr, patch or suffix.
Missing input/spawn/parse evidence can return None and main returns after the already emitted prefix.
For parsed minor≥80 it then prints, in order, `cargo:rustc-check-cfg=cfg(no_literal_fromstr)` and `cargo:rustc-check-cfg=cfg(feature, values("protocol_feature_paste"))`; for minor<54 it prints `cargo:rustc-cfg=no_literal_fromstr`.
The explicit script contains no file writes, OUT_DIR generation, native compilation or helper inclusion; this is no zero-native-effect or bounded std-output claim.
Preregister a genuine compiler/query context, independent successful response/version relation and ordered script-output relation before any execution; neither script exit0 nor returned stdout nominates those expectations.
No query/script was executed, and the still-unqualified descendant-query observer cannot be replaced by another unapproved preflight query.

**Mandatory utility follow-up.** The backend read four exact manifests, two declared scripts and one invoked helper; the lead independently read the scripts and matched these five API checksum declarations to existing lock entries.
The four package manifests declare ordinary src/lib.rs libraries, edition2024, no proc-macro and no links.
The helper receipt below is source/API research, not a completed helper-manifest/unit audit.

| Exact coordinate · manifest or helper source / API | Build declaration | Archive-checksum declaration matching Cargo.lock; not admitted source |
|---|---|---|
| burn-linalg 0.22.0 · [M](https://docs.rs/crate/burn-linalg/0.22.0/source/Cargo.toml) / [A](https://crates.io/api/v1/crates/burn-linalg/0.22.0) | build=false | `86fde5be8d8273c6a8ecb240c0c74de1c15a277ef69691b88b8289cbafe00768` |
| cubecl-common 0.11.0 · [M](https://docs.rs/crate/cubecl-common/0.11.0/source/Cargo.toml) / [A](https://crates.io/api/v1/crates/cubecl-common/0.11.0) | build="build.rs"; cfg_aliases build dependency | `002a1629f31d76dc3b640ab18e543c641236adebe119cc4c6af245320f420d4b` |
| cubecl-environment 0.11.0 · [M](https://docs.rs/crate/cubecl-environment/0.11.0/source/Cargo.toml) / [A](https://crates.io/api/v1/crates/cubecl-environment/0.11.0) | build="build.rs"; cfg_aliases build dependency | `4b70895e79bd37e08e1430a7e97e2cd2a6e646114e1280b0c600112d5ace19ce` |
| cubecl-zspace 0.11.0 · [M](https://docs.rs/crate/cubecl-zspace/0.11.0/source/Cargo.toml) / [A](https://crates.io/api/v1/crates/cubecl-zspace/0.11.0) | build=false | `10d26cd6330cb5edb54e81ed744d2a9b320f3db917593eb366e068dbea1d805c` |
| cfg_aliases 0.2.2 · [helper](https://docs.rs/crate/cfg_aliases/0.2.2/source/src/lib.rs) / [A](https://crates.io/api/v1/crates/cfg_aliases/0.2.2) | Invoked macro_rules helper; remaining package/unit fields unqualified | `f079e83a288787bcd14a6aea84cee5c87a67c5a3e660c30f557a3d24761b3527` |

All source-byte joins remain OPEN; utility-package resolver2 declarations do not replace the workspace resolver3.
The nn edge disables linalg defaults and requests std; linalg's mandatory core edge requests extension independently of its own default feature.
Its std only weakly forwards burn-fusion?/std, so the audited incoming path does not request the declared default/fusion set by implication.
Common's incoming serde/shared-bytes/fp8/std requests activate the local float8 relation with defaults disabled and forward shared-bytes/std to environment; serde=[] does not remove its mandatory Serde dependency.
Environment/std forwards rand/std **and thread_rng**, JSON/std, ciborium/std, oneshot/std and async-channel/std, and activates optional futures-lite, parking_lot, backtrace, etcetera and toml.
Its persistence/tokio/tracing feature names remain separate activators; their lock-wide dependencies do not establish selection.
Zspace's incoming defaults are disabled, with no requested feature; its empty default/std lists do not remove mandatory derive-new/Serde/smallvec dependencies.
The two utility manifests' hashbrown0.17 requirements resolve to the existing lock's0.17.1 edges, not Burn's separate0.16.1 package.
Atomic/wasm/none/non-wasm target tables remain cfg-conditioned and unevaluated; this record neither enables a hardware backend nor proves native/host producer absence below these packages.

**Utility host-script relations.** [Common build.rs](https://docs.rs/crate/cubecl-common/0.11.0/source/build.rs), lines1–13, first emits `cargo:rustc-cfg=portable_atomic_unsafe_assume_single_core` only when its whole UTF-8 CARGO_CFG_TARGET_FAMILY value equals exactly wasm.
It then declares multi_threading through cfg_aliases as std AND NOT target_family(wasm).
[Environment build.rs](https://docs.rs/crate/cubecl-environment/0.11.0/source/build.rs), lines1–20, declares aliases in this order:

```text
multi_threading = std && !wasm
stream_local    = std
std_io          = std && OS in {windows, linux, macos, android}
native_cache    = persistence && std_io
browser_cache   = wasm && persistence
tokio_rt        = tokio && !wasm
backtrace       = test && std
```

The inspected helper expands **macro_rules**, not a source-level proc-macro callback.
For each alias in declaration order it prints cargo:rustc-check-cfg=cfg(alias), followed immediately by cargo:rustc-cfg=alias only if that alias expression holds.
Its feature checks require CARGO_FEATURE_* to equal1; value checks split CARGO_CFG_* on commas and compare exact members; bare cfg checks require successful UTF-8 environment lookup.
Common's initial whole-string wasm test is therefore **not equivalent** to the helper's comma-membership test.
The helper's PROFILE fallback for DEBUG_ASSERTIONS is not referenced by these scripts' expressions.
Preregister relevant source identities and CARGO_FEATURE_STD/PERSISTENCE/TOKIO plus CARGO_CFG_TARGET_FAMILY/TARGET_OS/TEST values/absence, preserving alias dependencies and output order.
The expected stdout relation must precede execution; returned cfg lines cannot nominate their own environment or feature inputs.
Neither sampled script/helper explicitly invokes Python/compiler/subprocesses, writes files/OUT_DIR, or emits native-link/rerun directives; this is no whole-native-effect or descendant-closure proof.
Two host executables and their helper dependency are concrete additional graph obligations, not implemented/qualified nodes or permission to run them.

#### Metadata identity decoder · raw envelope and schema obligations

**[Unverified] Source-describable partial decoder contract; no decoder implementation or complete identity join exists.**
The devops audit followed pinned Rust `59807616e1fa2540724bfbac14d7976d7e4a3860`'s metadata and primitive serialization sources.
The lead independently read the raw envelope, root/header declarations and stable-ID construction.
All offsets below refer to **raw M byte zero**, not the outer `.rustc` wrapper P, an ELF offset or a member filename.

| Source coordinate | Published representation / behavior | Required bounded interpretation; not accepted code |
|---|---|---|
| [`decoder.rs:698–737`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/rmeta/decoder.rs#L698-L737) | M[0,8) is the metadata header; M[8,16) is absolute root position as fixed u64 little-endian; a serialized compiler-version String begins at16 | Register exact expected compiler-version bytes, check positions before narrowing/indexing and follow the pointed-to root; version10/release-number agreement alone is insufficient |
| [`opaque.rs::FileEncoder::finish`, `MemDecoder::new`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_serialize/src/opaque.rs#L188-L299) | Encoder appends `rust-end-file`; decoder strips that suffix to define its readable extent | Treat E=raw_length−suffix_length as the checked read boundary; this footer is neither checksum nor root index and validates no complete body/schema |
| [`rmeta/mod.rs:205–257`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/rmeta/mod.rs#L205-L257) | Header fields are triple, Svh hash, Symbol name, proc-macro bool and stub bool; full root then stores extra_filename, stable_crate_id, panic-policy/edition/allocator fields and lazy descriptors | Decode declaration order under the pinned derive machinery, not constructor-expression order; a stub cannot supply an unrepresented full-root identity |
| [`encoder.rs:719–780`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/rmeta/encoder.rs#L719-L780), [`def_id.rs:142–199`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_span/src/def_id.rs#L142-L199) | StableCrateId is actually serialized inline in the root; encoder obtains it from the local definition-path identity | It is not an unavailable linker-print-only query; still join the decoded field to admitted producing invocation/artifacts and independent expectations |
| [`opaque.rs:220–249,347–409`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_serialize/src/opaque.rs#L220-L409), [`serialize.rs`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_serialize/src/serialize.rs), [`fingerprint.rs:179–193`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_data_structures/src/fingerprint.rs#L179-L193) | Ordinary unsigned integers use unsigned LEB128; Hash64/StableCrateId uses eight raw little-endian bytes; Svh/Fingerprint uses16 raw bytes as two little-endian u64 halves; Strings use usize length, UTF-8 bytes and sentinel0xC1 | Pin each actual field codec and producer-host width; neither “all u64le” nor “all LEB128” describes the format |
| [`leb128.rs:53–85`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_serialize/src/leb128.rs#L53-L85) | The examined unsigned reader continuation loop has no explicit type-width byte ceiling; exhaustion can panic | A proposed validator needs checked canonical encoder-output-subset rules: at most ceil(width/7) bytes, terminal/overflow checks, strict UTF-8 and bounded arithmetic. These stricter rules are **not** equivalence with every byte sequence rustc's reader accepts |
| [`Symbol` decoder:366–386](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/rmeta/decoder.rs#L366-L386), [`TargetTuple` codec:3560–3590](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_target/src/spec/mod.rs#L3560-L3590) | Symbols have inline-string, absolute-string-offset and predefined-index forms; TargetTuple has its own custom codec | Close tags, dictionary/generation and target forms before claiming header extraction; a bounds-valid offset is not proof of a genuine encoder-produced string boundary |
| [`lazy decoder:188–202`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/rmeta/decoder.rs#L188-L202), [`666–687`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/rmeta/decoder.rs#L666-L687), [`lazy encoder:428–483`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/rmeta/encoder.rs#L428-L483) | Lazy descriptors use node-relative/backward initial distance and subsequent previous-position distance; empty arrays omit distance; tables add width/length/distance | Check subtraction/addition/multiplication, cap counts/bytes/traversal and pin every intervening enum/Option field; do not locate dependencies or flags by byte scanning |

Pin the declaration-order derive implementation in [`rustc_macros/src/serialize.rs`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_macros/src/serialize.rs#L58-L326).
The root pointer plus envelope can support an **envelope/prefix observation only**, never a claim that all referenced metadata is valid or bounded.
Unparsed fields remain unvalidated; proposed subset restrictions and numerical limits require independent review rather than inheriting rustc's reader trust.

[`CrateDep`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/rmeta/mod.rs#L328-L336) records name, compiler hash, optional host hash, dependency kind, extra filename and privacy, **not its own target or stable ID**.
Those hashes are compiler identity values, not artifact SHA-256s or source-byte authentication.
Each dependency requires a joined admitted root/artifact and host/target context; absent fields cannot be inferred from filename patterns or matching hash text.
Proc-macro metadata intentionally omits substantial dependency/body data, so even correct prefix extraction does not establish the macro DSO's native closure.

StableCrateId construction hashes crate-name text, sorted/deduplicated `-Cmetadata` values, executable-versus-library role and compiler-version input.
The published source also reads runtime **RUSTC_FORCE_RUSTC_VERSION**, which can replace that hashed version input.
Register exact invocation/environment expectations, including absence or independently fixed handling of such overrides; a decoded ID cannot recover/certify the entire invocation or executable identity.
An actually joined stable ID can derive the expected proc-macro declaration symbol under the earlier pinned name format without a linker-print oracle.
It still proves neither the symbol's genuine definition/export nor acceptable loading/execution.

**Prefix-codec follow-up.** The devops source pass resolved the following wire dependencies, without closing the decoder/join:

```text
S(x) = ULEB128_usize(UTF8_byte_length(x)) || UTF8(x) || c1
TargetTuple ordinary = u8(0) || S(tuple)
TargetJson            = u8(1) || S(tuple) || S(contents)
Symbol inline        = u8(0) || S(name)
Symbol offset        = u8(1) || ULEB128_usize(absolute_string_record_position)
Symbol predefined    = u8(2) || ULEB128_u32(predefined_index)
```

These forms follow the pinned [TargetTuple codec](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_target/src/spec/mod.rs#L3560-L3590), [Symbol tag definitions](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/rmeta/mod.rs#L584-L586), [encoder](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/rmeta/encoder.rs#L485-L510) and [decoder](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/rmeta/decoder.rs#L366-L386).
TargetJson omits its rustdoc path; reading the serialized JSON String does not validate JSON or resolved target/codegen semantics.
The Symbol-offset address points at the **String length prefix after an earlier inline tag**, not another Symbol tag; referenced reads must preserve the main cursor.
Unknown tags need explicit bounded refusal, not a guessed native enum layout or a copied panic path.

The [symbol generator](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_macros/src/symbols.rs#L154-L319) assigns zero-based indices in this order: keywords in invocation order, ordinary Symbols in invocation order, strings0–9, then environment-valued Symbols in invocation order.
It uses actual literal/name values; ordinary duplicates error, while environment values can reuse a matching existing index.
Do not substitute lexical sorting or HashMap iteration.
The pinned [symbol invocation](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_span/src/symbol.rs#L883) includes compiler-build `env!("CFG_RELEASE")`.
The generated-prefix count, not arbitrary driver-added interner entries, defines predefined eligibility under [`is_predefined`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_span/src/symbol.rs#L2855-L2860).
Source revision alone therefore does not fully instantiate the dictionary; bind the compiler-build environment and generated values independently.

**Keep three version inputs distinct:** [`rmeta::rustc_version`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/rmeta/mod.rs#L55-L57) simply formats `rustc {cfg_version}` and has **no runtime environment lookup** at this revision.
The standard interface obtains cfg_version from compiler-build [`CFG_VERSION`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_interface/src/util.rs#L672-L680), with an unknown fallback; that is separate from compiler-build dictionary `CFG_RELEASE` and runtime StableCrateId's `RUSTC_FORCE_RUSTC_VERSION` branch above.
Matching metadata version text certifies none of the executable/build identities.

The sequential identity prefix is TargetTuple → Svh → Symbol name → proc/stub booleans → extra_filename String → StableCrateId; variable components prevent fixed byte offsets.
Boolean encoding emits0/1, while the examined Rust reader treats nonzero as true; a proposed canonical-boolean validator is again a stricter encoder-output subset, not full reader-acceptance equivalence.
The integer domain follows the **producer host's** usize width, not merely the crate target's pointer width.
Range-valid String parsing at a Symbol offset still does not prove an encoder-produced record start; scans for tag0 or sentinel0xC1 cannot establish that provenance.
A prefix-only decoder can reference unparsed earlier body data, so the required record-boundary/schema or supplementary independently reviewed provenance method remains OPEN.

The complete identity decoder/join remains **STOP / OPEN** pending field-schema closure, bounded integer/string/reference handling, independent expectations and writer/reader compatibility.
No raw metadata was acquired or decoded; no Bun decoder, ABI, metadata writer, compiler query, tool input or production method was selected, implemented or accepted.

#### Rust std/panic native declarations · proposed GNU branch only

**[Unverified] Published conditional declarations, not selected-distribution metadata or a qualified native closure.**
The devops pass attempted eight pinned Rust paths: seven returned source text and library/unwind/build.rs returned404.
The lead independently read unwind's manifest, relevant GNU native-link attributes and panic_abort's std callback.
The pinned [unwind directory index](https://api.github.com/repos/rust-lang/rust/contents/library/unwind?ref=59807616e1fa2540724bfbac14d7976d7e4a3860) contains Cargo.toml and src; its [manifest](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/unwind/Cargo.toml) declares no package build script.
The 404 is therefore **not evidence of a missing required unwind/build.rs producer**; any selected native LLVM-unwind build needs its actual external/bootstrap producer record.

| Exact published source / condition | Declared operation or interface | Manual-plan boundary |
|---|---|---|
| [`std Unix PAL link block`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/src/sys/pal/unix/mod.rs#L340-L437) | This block's Linux dl branch requires uclibc, not GNU; no GNU-specific native-library set is supplied here | Do not copy other-platform declarations into the GNU plan or infer final-library absence from this block |
| [`unwind/lib.rs:135–142`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/unwind/src/lib.rs#L135-L142), Linux GNU/uclibc, neither LLVM-unwind feature | gcc_s link attribute has native cfg `not(target_feature="crt-static")`; kind/modifiers omitted | Its native predicate is inactive for proposed crt-static=true, not proof of an empty unwind/native closure |
| [`unwind/lib.rs:144–151`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/unwind/src/lib.rs#L144-L151), system-llvm-libunwind but not llvm-libunwind | unwind link attribute also has native cfg not-crt-static, with kind/modifiers omitted | Do not invent a static GNU declaration from the feature description; establish the actual producer configuration |
| [`libunwind.rs:103–164`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/unwind/src/libunwind.rs#L103-L164), applicable Linux llvm-libunwind branch | Interfaces carry unwind/static/`-bundle` attributes without that crt-static predicate | Qualify the selected feature, archive producer, path and metadata; a feature description is not an admitted archive |
| [`unwind/lib.rs:132–134`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/unwind/src/lib.rs#L132-L134) | A source **comment** attributes static-CRT gcc_eh to libc and says it must occur later | This is an ordering research pointer, not a native declaration or complete LinkPlan; see the conditional libc follow-up below, whose source-to-artifact join remains OPEN |
| [`std/build.rs`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/build.rs) | Reads target ARCH/OS/VENDOR/ENV inputs, emits check-cfg and backtrace_in_libstd, sets STD_ENV_ARCH; no native-library compilation/link-lib/link-search emission appears | Historical producer inputs/outputs and artifact lineage remain unknown; no script ran here and check-cfg alone enables nothing |
| [`panic_abort/lib.rs:25–51`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/panic_abort/src/lib.rs#L25-L51) | Panic cleanup/start interfaces lead to internal Rust callback __rust_abort, identified as std::rt-defined; no GNU c link attribute here | Retain the actual std abort implementation as a required source/closure relation; no application-authored FFI replacement |
| [`panic_unwind/lib.rs:35–114`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/panic_unwind/src/lib.rs#L35-L114), Linux/Unix branch | Selects gcc.rs and std callbacks __rust_drop_panic / __rust_foreign_exception | Module selection, runtime injection and actual linked code remain distinct obligations; gcc.rs was outside this first eight-path pass |

The sampled [unwind manifest](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/unwind/Cargo.toml#L19-L34) requests libc with rustc-dep-of-std and defaults disabled outside Windows/MSVC.
Its libc version requirement is **not the resolved version**, and the project's separately locked libc0.2.191 must not be substituted for the distribution's compiler/std dependency.
The llvm-libunwind and system-llvm-libunwind features are declared alternatives, not observations of a selected artifact build.
The first eight-path sample alone did not establish c/m/rt/pthread/dl/util origins or attributes; the follow-up below identifies conditional declarations, not actual artifact contents.

Outer cfg/feature selection belongs to the library's producing build, while a retained native `#[link(...cfg(...))]` condition has its own metadata/link treatment.
Pinned [`link.rs::relevant_lib`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/link.rs#L3101-L3105) evaluates a present native cfg against the final-link session.
Manual production must preserve both layers rather than recompile supplied std implicitly or assume a root flag rewrites its historical inputs.
Application panic=abort does not by itself prove every unwind declaration, reference or native dependency absent; those declarations also do not prove live code survived archive selection/dead-code elimination.
The independently reviewed graph still needs actual std/core/alloc, panic-runtime, unwind/compiler-builtins metadata relationships, CRT/native input order, search/grouping and source-to-artifact lineage.
Static-PIE, crt-static and panic flags alone prove neither ET_DYN/no-PT_INTERP/no-DT_NEEDED nor self-contained CRT/static-library selection.
No source-built std, compiler/runtime query, native compilation, archive inspection, FFI implementation or input/feature/provider acceptance follows.

**Resolved std-workspace libc, not project libc.** The devops follow-up and lead read pinned [library/Cargo.lock:147–154](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/Cargo.lock#L147-L154).
It records registry libc **0.2.178**, SHA-256 declaration **`37c93d8daa9d8a012fd8ab92f088405fb202ea0b6ab73ee2482ae66af4f42091`**, also declared by the [exact API record](https://crates.io/api/v1/crates/libc/0.2.178).
This is public metadata agreement, not a checksum-verified archive, authenticated source extraction or selected Rust-distribution lineage.
Do not replace this std-workspace dependency with the application's distinct libc0.2.191 or change either lockfile.

Both lead and devops read [libc0.2.178 unix/mod.rs:404–487](https://docs.rs/libc/0.2.178/src/libc/unix/mod.rs.html#404-487).
Its first-matching outer cfg_if chain reaches the following Linux/GNU rustc-dep-of-std branch **only after earlier platform/std branches do not match**:

| Retained native predicate | Attribute names in source order | Declared kind/modifiers |
|---|---|---|
| crt-static | util, rt, pthread, m, dl, c, gcc_eh, gcc, c | Each is static with `-bundle` |
| not-crt-static | util, rt, pthread, m, dl, c | Kind/modifiers omitted |

The repeated c is an actual declaration, not proof of repeated final-link arguments after all compiler/metadata processing.
Preserve outer library-producing features, native predicates and ordering as separate inputs.
Neither the source list nor its cfg conditions selects archive paths, actual bytes, a search policy or a completed native closure.
The already inspected compiler relevant_lib function supplies a source seam for consumer-session filtering, not an observed resulting argument sequence.

**Abort and unwind interface follow-up.** The lead closed the previously unread sys re-export pointer through [`sys/mod.rs:33`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/src/sys/mod.rs#L33) and the Unix branch of [`sys/pal/mod.rs:6–10`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/src/sys/pal/mod.rs#L6-L10).
Together with [`rt::__rust_abort`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/src/rt.rs#L29-L34), [`process::abort`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/src/process.rs#L2528-L2534), [`Unix abort_internal`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/src/sys/pal/unix/mod.rs#L304-L306) and libc's C abort declaration, source describes the non-test Unix path:

```text
panic_abort::__rust_start_panic -> internal Rust __rust_abort
 -> std::rt::__rust_abort -> std::process::abort
 -> sys::abort_internal (Unix PAL) -> libc::abort
```

This closes a **source interface pointer**, not the libc implementation, admitted machine-code path, bounded termination or whole-tree quiescence proof.
Vendor std's unsafe/FFI implementation supplies no permission for application-authored unsafe/FFI or an extra root.
The devops follow-up read [`panic_unwind/src/gcc.rs`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/library/panic_unwind/src/gcc.rs): its implementation uses unwind interfaces including _Unwind_RaiseException/_Unwind_DeleteException and std panic callbacks.
Those relationships identify additional conditional source interfaces, not actual selected panic runtime, surviving references or native archive membership.

**Conditional bootstrap Libunwind producer.** The attempted bootstrap native.rs path also returned404; the same-revision source index identifies the actual [`llvm.rs::Libunwind` step:1650–1808](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/src/bootstrap/src/core/build_steps/llvm.rs#L1650-L1808).
The devops audit read that step; the lead confirmed its declaration/run entry.
It requires the LLVM submodule and uses separate cc::Build C/C++ configurations, target/host and compiler/archiver inputs, optimized/unwind-table/visibility settings and libunwind headers/defines.
Its source lists C/assembly files Unwind-sjlj.c, UnwindLevel1-gcc-ext.c, UnwindLevel1.c, UnwindRegistersRestore.S and UnwindRegistersSave.S, plus C++ files Unwind-EHABI.cpp, Unwind-seh.cpp and libunwind.cpp.
It builds unwind-cpp, selects C++ objects from sorted directory entries and includes them in final unwind archive production; it also has an up-to-date shortcut.
Those source-described directory/freshness decisions are **not an accepted admission or reuse method**.
Qualify source/header contents, effective configuration, every native tool/phase, protected initial outputs, exact constrained object inventory and archive lineage before adopting any such producer.
Caller/feature wiring and installation into the independently selected distribution remain uninspected, so this is a conditional producer obligation, not evidence that LLVM unwind is selected or built.
No native producer, compiler, library, source-byte join, output identity or production method is accepted; no build/query/archive operation ran.

#### Cargo unit hashes are not complete invocation identities

**[Unverified] Source-described naming/input distinction; no Cargo execution or new naming method is accepted.**
The lead read pinned Cargo `f2d3ce0bd7f24a49f8f72d9000448f8838c4e850`'s [`Metadata` accessors](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/cargo/core/compiler/build_runner/compilation_files.rs#L91-L118), [`compute_metadata`](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/cargo/core/compiler/build_runner/compilation_files.rs#L689-L836) and [compiler argument construction](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/cargo/core/compiler/mod.rs#L1394-L1407).
These are additional Cargo semantics to distinguish from Rust's serialized StableCrateId, not permission to restore Cargo as executor.

| Identity or source input | Published behavior | Required independent binding |
|---|---|---|
| Cargo `c_metadata` | Used in rustc `-Cmetadata`; derived from shared package/unit inputs and sorted dependency c_metadata hashes | Not an artifact SHA-256, the Rust StableCrateId itself or a complete invocation record |
| Cargo `unit_id` | Uses the shared inputs plus sorted dependency unit_id hashes and additional argument/flag treatment | Not interchangeable with c_metadata; extra-filename uses unit_id only where the source enables it |
| Shared metadata inputs | Include metadata schema version, stable package identity, features, profile/mode/LTO, compile kind, Cargo target name/kind, compiler-version treatment, std-unit distinction and applicable wrapper/channel/host-config inputs | Register each effective value/absence; package name/version alone does not distinguish all units |
| Flags | Direct RUSTFLAGS hashing is excluded from c_metadata; unit_id includes applicable flags/extra arguments only under the source's remap-prefix conditions | Matching names or symbol-disambiguator values cannot certify identical flags, effective configuration or complete build inputs |
| Compiler-version treatment | [`hash_rustc_version`](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/cargo/core/compiler/build_runner/compilation_files.rs#L853-L881) distinguishes stable/separate-nightly handling and host-versus-target treatment of verbose-version lines | Metadata hash equality neither replaces the independently accepted compiler identity nor authenticates a returned query |
| Environment | `__CARGO_DEFAULT_LIB_METADATA` can contribute to the shared hash; an applicable workspace-wrapper path can also contribute | Bind those inputs explicitly where reproducing this scheme; no ambient value or observed wrapper invocation becomes role authority |

The source's [`has_remap_path_prefix`](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/cargo/core/compiler/build_runner/compilation_files.rs#L839-L850) is a string-prefix heuristic; it is not complete contextual CLI parsing.
The documented separation serves Cargo naming/caching/reproducibility, **not security attestation or full content identity**.
Cargo's own metadata schema version is also distinct from Rust metadata encoding version10.
The current direct-DAG proposal accepts neither reproduction of these private Cargo hashes nor a replacement canonical node-hash algorithm.
Its complete expected unit/configuration/dependency/environment bindings must remain independent of filenames, compiler-reported fields and observed output digests.

Pinned [base arguments](https://github.com/rust-lang/cargo/blob/f2d3ce0bd7f24a49f8f72d9000448f8838c4e850/src/cargo/core/compiler/mod.rs#L1297-L1300) also add prefer-dynamic for the displayed host/non-custom-build or applicable dylib conditions.
That flag is another role-specific compiler input, **not proof of actual dynamic dependency selection**, and target static-PIE constraints must not be broadcast into every host DSO role.
The separately cited pinned Rust dependency-format rules still determine the meaning of those inputs.
No queried version, computed Cargo hash, standalone-unit disambiguator, actual output filename or link role was produced in this pass.

#### Object-only emission does not validate a final link plan

**[Unverified] Public-source follow-up after Executor selected Continue public-text research instead of A_LLVM verification.**
The prepared LLVM files remain byte-frozen; **A_LLVM and B_LLVM remain NOT APPROVED / NOT RUN**, with no controller/suite import, test, archive operation or tool execution in this pass.
The lead read these exact Rust-source branches at `59807616e1fa2540724bfbac14d7976d7e4a3860`:

| Source coordinate | Published behavior | Required manual-plan obligation |
|---|---|---|
| [`dependency_format.rs:73–90`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/dependency_format.rs#L73-L90), [`404–414`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/dependency_format.rs#L404-L414) | `calculate_type` returns an empty dependency list when `should_link()` is false; `verify_ok` returns for that empty list | Object-only success does **not** supply these final-link dependency/panic validations; other compiler checks are not claimed absent |
| [`dependency_format.rs:92–160`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/dependency_format.rs#L92-L160), [`330–400`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/dependency_format.rs#L330-L400) | Normal final-link selection depends on crate kind, static/dynamic preference, available dependency formats, macro-only/conditional roles and injected panic runtime | Fix a per-output linkage table from the independently reviewed graph and metadata, not a list of every available rlib or a successful object emission |
| [`dependency_format.rs:404–513`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_metadata/src/dependency_format.rs#L404-L513) | Final-link checks distinguish panic-runtime uniqueness, desired/required strategy and applicable dependency panic-in-drop strategy | Reproduce the relevant checks before releasing a manually linked output; `panic=abort` is not blanket permission to omit runtime/native dependencies or accept a mismatch |
| [`base.rs:892–942`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/base.rs#L892-L942) | CrateInfo derives used crates from reverse postorder, filters macro-only dependencies and places compiler_builtins last | Preserve genuine dependency-unit identities and the pinned ordering relation; Cargo.lock order or alphabetical sorting does not supply it |
| [`link.rs:2360–2411`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/link.rs#L2360-L2411) | Native-link preparation adds local regular/metadata/allocator objects, sets as-needed state, then local native libraries, upstream Rust/static-native inputs and upstream dynamic-native inputs | Preserve all selected stage/state boundaries, including host-DSO differences; a flat bag of object/rlib filenames is not a LinkPlan |
| [`link.rs:2712–2809`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/link.rs#L2712-L2809) | Native handling evaluates cfg, suppresses only consecutive identical name/kind/verbatim tuples, distinguishes bundle/whole-archive/as-needed/link-arg kinds and may unpack bundled upstream archives | Inventory nested native members, modifiers, conditions, output paths and producer effects explicitly; never globally deduplicate or silently drop a native/link-arg input |
| [`link.rs:2838–2967`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/link.rs#L2838-L2967) | Dependency linkage controls whether an upstream Rust archive is added; builtins/profiler roles have special treatment; static-native and dynamic-native passes differ | Maintain separate host/target linkage and native-role contracts; no declaration that every transitive library is already contained in arena or std |
| [`link.rs:3020–3117`](https://github.com/rust-lang/rust/blob/59807616e1fa2540724bfbac14d7976d7e4a3860/compiler/rustc_codegen_ssa/src/back/link.rs#L3020-L3117) | The non-LTO fast path can use the rlib directly; applicable LTO paths construct filtered archives, removing metadata, selected Rust objects and bundled-library entries under source conditions | Freeze the actual LTO mode and archive-membership/indexing method; neither reusing every member nor removing every Rust object is generally valid |

This is a source-derived **additional obligation**, not evidence that any current program has duplicate crates, an incompatible panic runtime or a bad link.
The source's static/dynamic dependency-selection branches are calculations, not permission to execute a fallback process or choose a different provider.
The current static-PIE constraint does not authorize silently replacing an explicit native-library kind, deleting a link argument or accepting an unregistered DSO.
Resolve those relations under the exact reviewed output role or reject the graph before dispatch; final ELF rejection cannot repair earlier unregistered effects.

The prerequisite record must bind each output's dependency-unit table, genuine crate identities/hashes and macro-only/conditional/injected roles; chosen source/metadata/archive inputs; effective panic/LTO settings; native cfg/modifiers and ordered state changes; permitted nested-archive transformation; and independent pre-release checks.
A candidate LinkPlan is a constrained derivation from those independently fixed expectations and genuine joined metadata, not authority supplied by its producer.
Filtering macros-only dependencies from a target runtime link does not remove their host compilation/loading/execution or resource obligations.
Neither linker exit0 nor absence of DT_NEEDED establishes the missing dependency/panic checks.
The metadata decoder and complete selected unit graph remain unresolved, so none of those inputs or checks is supplied merely by writing this record shape.
No compiler query, `--print=link-args`, Cargo execution, native archive extraction, registration implementation or verification test follows.
Future approved checks should reject missing/duplicated or misordered roles, panic-policy mismatch, unsupported LTO/member filtering, lost native modifiers and illicit dynamic dependencies without falling back to ordinary rustc linking.

Future approved verification should distinguish wrong unit/features/role, missing allocator or macro metadata, illicit Cargo/native-link execution, unregistered script output, early dependent release, helper-count overflow, failed-spawn retry and ambiguous retained failures.
Persist those tests only after their applicable exact source/test approvals; no implementation, test or operation is authorized here.

## 6 · Current research cut

**Historical public-text-only cut:** this paragraph records the earlier pass; §7 records the later separately approved source operations and retained-text audit.

No inspector invocation, archive decoding/extraction, installation, package-code execution, key-verification command, installed-root/proc/VM/daemon operation, F9 capture/build or training occurred in this pass.
The earlier A/B operation grants remain spent.
Public text reads do not authorize expanded retained-payload analysis.
Agents retain the remaining public research work; Executor owns independent exact-record acceptance rather than public-fact assembly.
Actual output identities still follow separately approved **5a AND 5b**, before **5c**; actual **5c/5d** runtime evidence is not a Gate0 pre-freeze result.

## 7 · Checksum-joined reference texts · bounded semantic audit

**Historical C32 audit cut:** this section covers its original 32 copies; §8 records the later separately captured libc build script and its named semantic-read decision.

**[Unverified] Producer execution, compiler configuration, artifact derivation and complete admission remain unqualified.**
This section records source-field observations, not accepted inputs, a resolved unit graph or Gate0 closure.
Executor separately approved A_SOURCE, B_SOURCE and then **Audit 32 texts (Recommended)**.
Both source-operation grants are spent; the later semantic-read scope covers only the retained 32 texts and research/ledger updates, not another archive/member read or operation.
The five preparation files, source archives, copied bytes and A/B receipts remain unchanged.

### Evidence binding and coverage

`D` denotes `/tmp/opencode/gate0-source-reference-IlR7s5`; `T` denotes `D/texts`; `R` denotes `D/reference-completion.json`.
These absolute paths are retained local locators, not a portable evidence bundle or protected-backing proof.
R is **18,306 bytes**, SHA-256 **`eb71cf3485807ef91b911ebf86271282ff82672bd075bcb54a0c0896b911aa95`**.
Its per-copy records bind exact coordinate/member, slot, byte length and SHA-256 to the externally checked archive/inventory joins.
The lead rechecked all 32 named copy hashes under the new read scope; reviewers/semantic readers did not independently recompute those digests.

| B_SOURCE checked reference observation | Result |
|---|---:|
| Frozen coordinates / controller GET calls | 24 / 24 |
| Retained compressed bytes / decoded tar bytes | 3,115,132 / 16,520,704 |
| Inventory bytes / records | 454,662 / 1,213 |
| Observed inventory kinds | 1,213 regular files |
| Selected text copies / bytes | 32 / 171,310 |
| Assigned manifest / nonmanifest text bytes | 77,418 / 93,892 |

These are bounded reference observations, not physical request/containment counts or whole-dependency coverage.
A_SOURCE supplied **40 pass / 0 fail / 146 assertions** for the research controller, not production qualification.
The original B report remains `SOURCE_BYTES_STREAMS_AND_TEXT_COPIES_CHECKED_FINALIZATION_PENDING`, with provisional copy flags; the separate external receipt records post-exit byte checks without rewriting it.
Publisher signatures remain NOT_RUN; no key, trust premise, source input, native closure or production method is accepted.

For the following comparisons, `MATCH` means statement-level agreement with the preceding public-source research.
It does **not** mean docs.rs byte equivalence: exact prior rendered-page bytes were not pinned.
`OBSERVED_IN_CHECKSUM_JOINED_REFERENCE_SOURCE` applies only to the cited captured field/member.
`NOT_ESTABLISHED` preserves missing producer, configuration, consumer and artifact obligations.

### Twenty-four manifest declarations

Backend read only the following 24 manifest copies; devops read the eight disjoint nonmanifest copies below.
All observed library paths are src/lib.rs; every sampled manifest explicitly sets build.
`L` denotes an ordinary library, `P` an explicit proc-macro, `F` build=false and `S` build="build.rs".
R's cited spans supply each full captured-member digest and mapping.

| T copy / captured declaration spans | Coordinate | Kind/build | Bytes / R span |
|---|---|---|---|
| 01.txt:12–21,73–84 | serde1.0.229 | L/S | 1,969 / 280–286 |
| 03.txt:12–21,76–87 | serde_core1.0.229 | L/S | 1,950 / 298–304 |
| 05.txt:12–18,238–240 | burn0.22.0 | L/F | 6,322 / 316–322 |
| 06.txt:12–17,30–55 | burn-derive0.22.0 | P/F | 1,441 / 325–331 |
| 07.txt:12–17,187–189 | burn-core0.22.0 | L/F | 7,515 / 334–340 |
| 08.txt:12–17,92–94 | burn-flex0.22.0 | L/F | 3,006 / 343–349 |
| 09.txt:12–17,67–69 | burn-optim0.22.0 | L/F | 2,388 / 352–358 |
| 10.txt:12–17,74–76 | burn-store0.22.0 | L/F | 3,939 / 361–367 |
| 11.txt:12–17,149–151 | burn-tensor0.22.0 | L/F | 4,828 / 370–376 |
| 12.txt:12–20,145–147 | burn-dispatch0.22.0 | L/S | 4,307 / 379–385 |
| 14.txt:12–17,91–93 | burn-backend0.22.0 | L/F | 3,089 / 397–403 |
| 15.txt:12–17,28–44 | burn-backend-extension0.22.0 | P/F | 1,278 / 406–412 |
| 16.txt:12–20,54–75 | burn-ir0.22.0 | L/F | 1,777 / 415–421 |
| 17.txt:12–17,61–63 | burn-std0.22.0 | L/F | 3,964 / 424–430 |
| 18.txt:12–17,50–52 | burn-pack0.22.0 | L/F | 2,084 / 433–439 |
| 19.txt:12–17,68–70 | burn-nn0.22.0 | L/F | 2,066 / 442–448 |
| 20.txt:12–17,52–54 | burn-autodiff0.22.0 | L/F | 2,248 / 451–457 |
| 21.txt:12–17,115–117 | burn-linalg0.22.0 | L/F | 2,974 / 460–466 |
| 22.txt:12–18,39–42 | paste1.0.15 | P/S | 1,619 / 469–475 |
| 24.txt:12–20,52–54 | cubecl-common0.11.0 | L/S | 3,745 / 487–493 |
| 26.txt:12–20,71–73 | cubecl-environment0.11.0 | L/S | 6,429 / 505–511 |
| 28.txt:12–23,44–58 | cubecl-zspace0.11.0 | L/F | 1,591 / 523–529 |
| 29.txt:12–17,48–57 | cfg_aliases0.2.2 | L/F | 1,399 / 532–538 |
| 31.txt:12–18,179–189 | libc0.2.178 | L/S | 5,490 / 550–556 |

All 24 omit package.links; only common/environment declare build dependencies, each naming cfg_aliases0.2.2 (T/24.txt:158–159; T/26.txt:204–205).
No dependency package-renaming alias appears in this sample.
Those observations neither exclude native link attributes nor establish descendant producer absence.

**CONFLICT — transcription corrected:** the earlier burn-backend row used backend-device shorthand.
T/14.txt:43–75 declares **cubecl-device**, not backend-device; the row now names explicit cubecl / cubecl-device features.
An exact-name projection using the old spelling must stop until corrected; no dependency, feature setting or historical B byte join changes.

| Prior relation compared with captured source | Comparison / captured span |
|---|---|
| Serde default std / derive→serde_derive; serde_core exact =1.0.229 with result requested and defaults disabled; core std/result defaults and separate cfg(any()) declaration | MATCH · T/01.txt:65–84; T/03.txt:65–87 |
| Root Burn optim→optim/autodiff, store activation, weak std/flex forwarding and relevant parent default suppression | MATCH · T/05.txt:54–57,109–114,139–142,181–189,266–316 |
| Optim's mandatory core/autodiff+extension and core's backend-extension/dispatch/backend activation | MATCH · T/09.txt:75–85; T/07.txt:99–104 |
| Tensor→dispatch defaults disabled, empty extension and flex forwarding; dispatch→Flex defaults disabled, weak std and conditional critical-section | MATCH · T/11.txt:88–90,118–124,189–191; T/12.txt:77,114–121,172–175,196–204 |
| Flex declared std/simd/rayon defaults remain distinct from incoming requests | MATCH · T/08.txt:52–84 |
| Store/std strongly forwards safetensors/std and activates memmap2/regex, not its entire default set | MATCH · T/10.txt:44–70,160–180 |
| Mandatory nn→linalg defaults disabled/std; linalg independently requests core/extension and weakly forwards fusion/std | MATCH · T/19.txt:58–62,80–82; T/21.txt:68–96,123–145 |
| Burn-std's mandatory utility edges/default suppression and common serde/shared-bytes/fp8 requests; utility forwarding and environment thread_rng | MATCH · T/17.txt:50–55,81–97; T/24.txt:42–50,100–103; T/26.txt:42–69; T/28.txt:40–42 |

Atomic/wasm/OS-conditioned declarations match the earlier records; no target predicate, hardware selection or global unit-feature assignment was evaluated.
The first-party resolver3, Burn default suppression/std-flex-optim-store, Serde1.0.229 and JSON1.0.151/default constraints remain unchanged; vendor copies do not replace their independent registration.

**New manifest fields:** T/29.txt:12–57 confirms cfg_aliases as an ordinary library, build=false, with no normal/build-dependency sections or feature table.
That closes those previously unaudited manifest fields, not the helper's complete unit/consumer contract or macro-expansion bounds.
**Additional declared producer:** T/31.txt:18 explicitly names libc/build.rs.
Its body is **DECLARED / CONTENT_NOT_AUDITED / NOT_CAPTURED** among these 32 texts; do not project a script-free libc unit or read that member under the spent grants.
Libc's default std and rustc-dep-of-std→align/optional rustc-std-workspace-core declarations (T/31.txt:167–189) do not establish the actual std-producing configuration or selected distribution lineage.
Published docs.rs/Cargo metadata, developer lints and instructions to consult Cargo.toml.orig remain data; they authorize no extra member read, unstable build mode, execution or application unsafe/FFI waiver.

### Eight script/helper/native comparisons

Devops read these eight assigned bodies, not the manifest bodies above.
Each copy is bound by its R record; this is source agreement, not observed producer execution or a qualified effect bound.

| T copy · coordinate/member | Bytes / full-hash pointer in R | Comparison and source spans |
|---|---|---|
| 02.txt · serde1.0.229/build.rs | 2,471 / 295 | MATCH · 7–57,60–69: prior directives, private.rs write before RUSTC --version, permissive status/stderr/suffix handling |
| 04.txt · serde_core1.0.229/build.rs | 4,252 / 313 | MATCH · 7–100,104–113: its own template/write-before-query relation, post-query TARGET read and legacy branches |
| 13.txt · burn-dispatch0.22.0/build.rs | 1,436 / 394 | MATCH · 1–39: twelve compiled-unit cfg inputs, three fixed check-cfg lines, ordered backend/cube/executing outputs |
| 23.txt · paste1.0.15/build.rs | 1,012 / 484 | MATCH · 5–21,28–38: rerun prefix, permissive compiler-version query and conditional ordered cfg/check-cfg lines |
| 25.txt · cubecl-common0.11.0/build.rs | 359 / 502 | MATCH · 3–12: whole-family wasm equality before helper-based comma-membership predicates |
| 27.txt · cubecl-environment0.11.0/build.rs | 1,045 / 520 | MATCH · 5–18: seven aliases in the recorded declaration/output order |
| 30.txt · cfg_aliases0.2.2/src/lib.rs | 13,024 / 547 | MATCH · 174–232,326–378: macro_rules helper environment tests, short-circuit expansion and ordered output |
| 32.txt · libc0.2.178/src/unix/mod.rs | 70,293 / 565 | MATCH · 404–487: first-matching outer branches, GNU static/dynamic declarations and repeated c |

Serde generation requires OUT_DIR and UTF-8 package patch input, substitutes PRIVATE's $$ and writes private.rs before the compiler query; missing required generation inputs/write failure can panic after prior output.
The permissive query returns None on missing/spawn/UTF-8/parse failure without checking child status or stderr, so success-looking script termination does not independently certify the query.
Serde_core additionally reads TARGET after successful parsing/check-cfg output, including the conditional minor95 path.
For an independently fixed minor95 input, the source relations predict 13 Serde and 11 core directives; these are **conditional predictions, not observed stdout or chosen EXPECTED inputs**.
Generated consumer inclusion/private exports, actual generated bytes and resulting artifacts remain NOT_ESTABLISHED; fs::write supplies no exclusive/no-follow policy.

Dispatch's cfg! values belong to its compiled host unit, unlike cfg_aliases' runtime environment lookups.
The helper requires feature values equal1; key/value tests use comma membership and an empty-string lookup fallback; bare cfg tests require successful UTF-8 lookup even for empty or zero-valued strings.
Its DEBUG_ASSERTIONS/PROFILE fallback is not referenced by these callers; alias references expand expressions rather than reading back emitted cfgs.
Common's literal family-equals-wasm test cannot be replaced by the helper's different comma-membership test.
Preserve independently fixed compile-time assignments, environment values/absence, alias dependencies and stdout order before release; observed output cannot nominate its own inputs.
No explicit subprocess/file-generation/native-link output appears in the sampled common/environment/helper bodies, but this excludes neither native startup effects nor descendant producers.
No explicit cargo:warning or cargo:error appears in these sampled script/helper bodies; compiler diagnostics, panic output and std I/O remain unbounded/unqualified here.

The libc GNU branch conditionally declares static `-bundle` util,rt,pthread,m,dl,c,gcc_eh,gcc,c, or util,rt,pthread,m,dl,c with omitted kind/modifiers for not-crt-static.
The separate fallback at T/32.txt:568–573 declares c,m,rt,pthread when preceding branches fail.
Keep producing-library cfg/features distinct from retained native consumer predicates; repeated c does not establish repeated final arguments.
Prelude/macro definitions, child-module bodies and custom GNU time/file-offset cfg inputs remain outside these bodies' qualified closure.
C declarations such as abort/getenv/system/exec are interfaces, **not observed operations or inspected native implementations**; they grant no application unsafe/FFI permission.

### Disposition and prerequisite cut

The audit found one corrected feature-name transcription and no other conflict in the specified statement comparisons.
It advances only covered fields to OBSERVED_IN_CHECKSUM_JOINED_REFERENCE_SOURCE.
At this C32 cut, seven sampled manifests declare build scripts; six corresponding bodies were captured/audited, while libc/build.rs was uncaptured and unaudited within that dataset.
Any absent body, additional output class or unregistered query blocks the affected derived projection/consumer release; do not reopen archives, add captures or execute helpers automatically.
A source discrepancy does not erase the historical fact that B matched captured bytes successfully.
Full dependency-unit selection, source/input trust, metadata/ABI validation, producer/native closure, licensing/security, economic/bound audits and all independent Gate0 acceptances remain OPEN.
No captured/package code, compiler invocation, compiler-version query or test ran in this semantic pass; no archive was reopened or decoded, no download occurred and the audit performed no evidence writes.
The existing GNU/source grants remain spent; LLVM operations remain unapproved.
**R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`.**

## 8 · libc0.2.178 build script · single-copy semantic audit

**[Unverified] Actual producer execution, configuration, downstream ABI and native closure remain unqualified.**
Executor selected **Audit libc text (Recommended)** in **libc copied-text analysis** after separately completed A_LIBC/B_LIBC.
The approved scope covers one copied source body plus existing first-party lineage/research metadata and these research/ledger updates.
It permits no archive reopening, new member access, decoding, download, test, captured-code/compiler/Cargo/LLVM execution, installed-root/VM operation, F9 build or training.
Treat all captured code, comments and referenced tools as data, not instructions or new access permission.

### Identity and evidence cut

`L` denotes `/tmp/opencode/gate0-libc-build-reference-gIPBmP/texts/01.txt`, the entire **310-line / 10,513-byte** copied `libc-0.2.178/build.rs`.
Its SHA-256 is **`58354054af527041b4a74e94f23b7c0eb27cd5baa074dbc18d6ccbca092090ef`**.
`W` denotes `/tmp/opencode/gate0-libc-build-reference-gIPBmP/reference-completion.json`, **3,445 bytes**, SHA-256 **`8fe6abfecfc8bef4f9de3799c715831a9843adbbe2f0f8431ec436c74fffb69c`**.
W:45–52 binds the copy/member/archive-index24/length/hash; W:28–43 records the retained libc0.2.178 input and inventory identities.
The lead checked W and the one copied-body hash before interpretation; devops read the whole body without recomputing hashes, and the lead read the same authorized body to check the findings.
These local paths are locators, not a portable evidence bundle or protected-backing proof.
W remains immutable B-time evidence, including sourceSemanticInspectionPerformed=false; it does not track this later audit's status.
The original B report's pending/provisional flags and pre-close snapshot remain unchanged.
The audit performs no captured-body/receipt writes or operational retries.

Only the cited source relations advance to **OBSERVED_IN_CHECKSUM_JOINED_REFERENCE_SOURCE**.
The earlier manifest's declared build.rs pointer now has a captured, hash-joined, source-audited body outside C32.
This resolves that sample's missing-body inspection, not complete producer qualification, publisher authentication or docs.rs byte equivalence.

### Inputs and branch semantics · L:51–167,172–302

For env::var, missing or non-Unicode values yield Err; is_ok means readable-string presence, not parsed truth.
An empty, zero or false string therefore enables each presence switch below.
No actual environment value or query result was read from the host in this pass.

| Explicit input | Source span | Source handling |
|---|---|---|
| RUSTC | L:172–199 | var_os required; absence panics; no source executable-identity validation |
| RUSTC_WRAPPER | L:175–187 | var_os absent/empty → direct RUSTC; nonempty → wrapper with RUSTC as first argument |
| LIBC_CI | L:56,69–77,152–155 | Readable presence enables the conditional FreeBSD probe and later libc_deny_warnings |
| CARGO_CFG_TARGET_ENV / OS / POINTER_WIDTH / ARCH | L:57–60,104,115–119 | Each env::var defaults to empty; comparisons use exact strings |
| RUST_LIBC_UNSTABLE_FREEBSD_VERSION | L:67–87 | Readable override parses i32 via unwrap before warning; otherwise CI query/fallback12, otherwise12 |
| RUST_LIBC_UNSTABLE_MUSL_V1_2_3 | L:101–107 | Readable presence OR arch=loongarch64 OR env=ohos activates musl_v1_2_3 |
| RUST_LIBC_UNSTABLE_LINUX_TIME_BITS64 | L:108–112 | Readable presence activates linux_time_bits64 independently of the GNU branch |
| RUST_LIBC_UNSTABLE_GNU_TIME_BITS / GNU_FILE_OFFSET_BITS | L:113–149 | Both invalidations print; values are read only inside the GNU guard below |
| WIND_RELEASE_ID | L:293–301 | Missing/non-Unicode → None; trim/split periods; first two u32 pieces default individually to0; ignore remainder |
| Producer compilation's target_os cfg | L:265–272 | Compile-time cfg!(target_os="windows") chooses emcc.bat versus emcc; distinct from runtime CARGO_CFG_TARGET_OS |
| Query exit status/stdout/stderr and inherited execution context | L:172–288 | See query table; environment, cwd, resolution/native startup/descendants remain unqualified |

No feature variable, OUT_DIR or RUSTC_WORKSPACE_WRAPPER read appears in this body.
No explicit PATH read appears, but bare tool resolution is not thereby excluded.
The script emits five rerun-if-env-changed directives, not one for every environment input; this does not establish implicit Cargo/controller tracking.

### Ordered effects and directive vocabulary

All outputs below are **conditional on reaching the statement**, not observed stdout or independently chosen EXPECTED values.

| Source order | Span | Source relation |
|---|---|---|
| 1 | L:53–60 | Print cargo:rerun-if-changed=build.rs; perform Rust query/parsing; then read CI and four target variables |
| 2 | L:67–87 | Print FreeBSD override invalidation; parse override and warn, else query only for CI, else default12; <10 panics, 10–14 select matching cfg, >=15 selects freebsd15 |
| 3 | L:89–99 | Attempt Emscripten query; code<30142 activates emscripten_old_stat_abi; read VxWorks version; tuple<(25,9) activates vxworks_lt_25_09 |
| 4 | L:101–114 | Read/print musl invalidation then conditional cfg; read/print Linux time invalidation then conditional cfg; print GNU file-offset then GNU time invalidations |
| 5 | L:115–150 | Under the GNU guard, parse the time/file matrix and emit time cfgs before file-offset cfg |
| 6 | L:152–155 | LIBC_CI readable presence activates libc_deny_warnings |
| 7 | L:159–167 | Parsed Rust minor>=80 prints all ALLOWED_CFGS check-cfg declarations in order, then the three extra-value declarations |

The FreeBSD selection, Emscripten query and VxWorks environment read have **no target-OS guard**.
A GNU target alone therefore cannot exclude the Emscripten attempt or the conditional CI FreeBSD attempt.
The GNU value-reading guard is exactly env=gnu AND os=linux AND pointer-width=32 AND arch!=riscv32 AND arch!=x86_64.
For a separately fixed pointer-width64, that guard is false, but the earlier unguarded probes still remain in the source flow.

| GNU inputs inside that guard | Constructed (timebits,filebits) or refusal |
|---|---|
| Neither readable | (32,32) |
| Time64 only | (64,64) |
| Time32 only | (32,32) |
| File32 or File64 only | (32,supplied file value) |
| Both readable, regardless of contents | Panic |
| Any other readable sole value | Panic |

Err includes missing and non-Unicode values.
The following valid-bits/compatibility assertions accept all tuples constructed by that match; they do not replace independent input registration.
Time64 emits linux_time_bits64 **then** gnu_time_bits64; file64 then emits gnu_file_offset_bits64.
The earlier independent Linux switch can produce a duplicate linux_time_bits64 line; do not silently deduplicate or reorder a future projection.

Exact emitted directive families use **cargo:**, not cargo:::

- L:53: cargo:rerun-if-changed=build.rs.
- L:67,102,109,113–114: cargo:rerun-if-env-changed= followed, in order, by RUST_LIBC_UNSTABLE_FREEBSD_VERSION, RUST_LIBC_UNSTABLE_MUSL_V1_2_3, RUST_LIBC_UNSTABLE_LINUX_TIME_BITS64, RUST_LIBC_UNSTABLE_GNU_FILE_OFFSET_BITS, RUST_LIBC_UNSTABLE_GNU_TIME_BITS.
- L:71: cargo:warning=setting FreeBSD version to {vers}, only after a successfully parsed readable override, even before an ensuing <10 panic.
- L:304–310: cargo:rustc-cfg={cfg}, after membership assertion against ALLOWED_CFGS.
- L:159–165: cargo:rustc-check-cfg=cfg({cfg}) for each allowed name, followed by cfg(name,values(...)) for each extra-value row.

ALLOWED_CFGS declaration/output order (L:13–31):

```text
emscripten_old_stat_abi, espidf_time32,
freebsd10, freebsd11, freebsd12, freebsd13, freebsd14, freebsd15,
gnu_file_offset_bits64, gnu_time_bits64, libc_deny_warnings,
linux_time_bits64, musl_v1_2_3, vxworks_lt_25_09
```

espidf_time32 receives a check-cfg declaration but is never activated by this body.
The extra declarations (L:34–49,163–165) are exactly:

```text
cargo:rustc-check-cfg=cfg(target_os,values("switch","aix","ohos","hurd","rtems","visionos","nuttx","cygwin"))
cargo:rustc-check-cfg=cfg(target_env,values("illumos","wasi","aix","ohos","nto71_iosock","nto80"))
cargo:rustc-check-cfg=cfg(target_arch,values("loongarch64","mips32r6","mips64r6","csky"))
```

These declarations do not activate cfgs, set a target or establish a downstream ABI.
For an independently fixed Rust minor95 that reaches the final block, the source predicts **17 check-cfg lines** there:14 names+3 value rows.
It does not establish a complete directive count without the other independently fixed inputs/results.

### Query graph and failure paths · no execution

| Query role | Span | Invocation and handling described by the source |
|---|---|---|
| Compiler/version, initial | L:172–199,214–216 | Direct RUSTC --version; nonempty wrapper selects WRAPPER RUSTC --version; require successful status and strict UTF-8 stdout |
| Compiler/version, conditional second query | L:175–189,216–220 | Initial UTF-8 stdout starts exactly clippy → query again; only nonempty-wrapper form adds --rustc before --version; absent/empty wrapper repeats the direct command |
| FreeBSD native version | L:69–77,246–263 | Only readable LIBC_CI with unreadable override calls bare freebsd-version, no args; spawn/status/UTF-8/unmatched prefix failure returns None then fallback12 |
| Emscripten version | L:89–93,265–288 | After earlier stages succeed, attempt bare emcc or emcc.bat -dumpversion without runtime target guard; spawn/status/UTF-8 failure returns None |

The conditional second compiler query is a vendor source edge, **not approval to retry any harness operation**.
Each compiler query rereads RUSTC/RUSTC_WRAPPER; both invocation identities/contexts need independent binding if that edge becomes applicable.
Compiler parsing requires the first period-separated component exactly rustc 1, a numeric u32 second component and an existing third component (L:222–243).
It does not validate a numeric patch or complete build/commit identity.
The third component's first hyphen suffix yields a dev/nightly-prefix flag; main discards that flag.
Rust-query absence/spawn/status/UTF-8/shape/minor failures panic after at least the initial rerun line; unsuccessful status includes lossily decoded stderr, while successful stderr is ignored.

FreeBSD parsing matches untrimmed prefixes10 through15; for example100 also starts with10 (L:254–261).
It is not an exact native-release identity parser or proof that FreeBSD code executes only on FreeBSD.
Emscripten parsing trims, splits on period/hyphen, parses the first three u64 pieces with per-piece zero defaults and ignores the rest (L:277–287).
Successful malformed output can therefore become Some(0) and select the old-stat-ABI cfg.
The version-code arithmetic has no explicit overflow guard; behavior depends on the producer's independently fixed compilation settings.
VxWorks similarly accepts malformed readable version components as zero, potentially selecting the older-version cfg; it runs no subprocess itself (L:293–301).

Invalid FreeBSD override parsing panics via unwrap; parsed values<10 warn before the unsupported-version panic (L:69–80).
GNU both-readable/invalid-value branches panic; valid_bits and time/file compatibility use asserts (L:126–142).
set_cfg rejects names outside ALLOWED_CFGS before printing (L:304–309).
Later failures retain prior emitted prefixes and prevent subsequent directives; successful consumer admission is not established by a prefix or source control flow.
No explicit cargo:error, generated-file, native-link directive or direct filesystem API operation appears in the body.
That observation does not bound child executable loading/startup, wrapper behavior, native libraries, inherited descriptors, filesystem/network effects or descendants.
Command.output captures stdout/stderr without a source-level timeout or output-size limit (L:191,247,272).
The source sets no env_clear, cwd or executable-qualification policy for those commands; FreeBSD/Emscripten stderr is ignored even on unsuccessful status.

### Disposition and remaining qualification

**CAPTURED / HASH_JOIN_CHECKED / SOURCE_SEMANTICS_AUDITED_ONLY** replaces the one-copy audit's in-progress state, not any historical receipt or production acceptance.
Across the earlier 24 sampled manifests, all seven declared build-script bodies now have bounded source inspection; this statement does not cover every selected/transitive unit or qualify any producer execution.
The old C32 dataset remains unchanged at24 manifests+6 scripts+helper+native text; this libc body is one additional copy.
The earlier libc native-declaration audit left GNU time/file-offset cfgs as independently supplied inputs; this body now describes their possible producer relation, not actual production cfg values or ABI joins.
Producer compilation/host cfg, requested library target/features, env values and absence, executable resolution/wrapper/query identities, outputs/statuses, directive ordering/consumption and all native child effects remain NOT_ESTABLISHED.
Do not model this body as a query-free GNU cfg translator or omit emcc/freebsd-version roles solely from a target triple.
Preregister expected inputs and permitted effects independently before any projection/release; observed query stdout must never nominate its own EXPECTED values.
Downstream cfg consumers, metadata records, generated/native effects, compiler ABI and whole-unit closure remain outside this source-only scope.
Any further captured-body/member/archive access, execution or acquisition requires its fresh named decision; this pass supplies no automatic next operation.
All GNU/Source/libc A/B grants remain spent; LLVM preparation remains frozen/unapproved/unrun.
No captured code, compiler/query/test, archive read/decode, download, installed-root/VM operation, F9 build or training ran during this semantic pass.
Preserve Burn, Rust learner tests, full policy, frozen N1–N10, the inclusive1,048,576-unit BOTH-seat DIRECT meter, S0+10s and S0+300s including final3s cleanup.
Production identities still require separately approved5a AND5b before5c; actual runtime evidence still requires separately approved5c/5d.
No input/key/trust/class/tariff/numerical limit/production method/RecipeRef or Gate0 record is accepted.
**R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`.**

## 9 · Three public manifests · unjoined text frontier

**Historical three-page cut:** BODY_NOT_INSPECTED and its one-attempt limits below describe that cut; §10 records the later JSON public-body observation under the separate continuing public-text permission, without changing captured-byte evidence.

**2026-11-05 · PUBLIC_TEXT_OBSERVED / ARCHIVE_JOIN_NOT_ESTABLISHED / UNIT_SELECTION_NOT_RESOLVED · scoped DOCS/METADATA-consistency READY, no remaining findings; public fields remain lead-reported, not independent source/byte verification.**
**[Unverified] Source-byte joins, complete selected units, producer execution and native/ABI qualification remain unestablished.**

### Actual choice, read order and evidence boundary

In **Manifest frontier research**, Executor selected **Research 3 manifests (Recommended)** for one read attempt per exact page, comparing manifest targets/build/proc-macro/features/dependency kinds and updating research/closure/canonical documentation only.
The lead reports exactly three successful functions.webfetch calls, format=markdown and timeout=30, in the following order; each returned page heading and package.name/version matched its requested coordinate.
Architect context advice and devops comparison of the lead-provided rendered fields are complete; devops made no independent additional HTTP read.
This documentation author reads first-party documents only and neither refetches pages nor computes response hashes.

| Order / exact public page | Reported rendered line-number rail | Provided exact package/build span |
|---|---:|---|
| 1 · [serde_json 1.0.151](https://docs.rs/crate/serde_json/1.0.151/source/Cargo.toml) | 162 lines | package fields:12–21; build="build.rs":21. |
| 2 · [serde_derive 1.0.229](https://docs.rs/crate/serde_derive/1.0.229/source/Cargo.toml) | 87 lines | build=false:21; exclude=[build.rs]:22. |
| 3 · [tempfile 3.27.0](https://docs.rs/crate/tempfile/3.27.0/source/Cargo.toml) | 105 lines | build=false:23. |

These are single tool-call/read-attempt counts, **not physical GET/redirect counts, native-process observations or containment proof**.
Timeout30 is a per-tool setting, not an accepted numerical Gate0/security bound or F9 clock; the HTTP tool remains an unqualified research assumption.
The displayed line rails are not raw response byte lengths; no raw-response or transcribed-Markdown hash, archive-to-copy join or publisher authentication was measured.
Classification is **PUBLIC_TEXT_OBSERVED**, never OBSERVED_IN_CHECKSUM_JOINED_REFERENCE_SOURCE or inherited C32/libc source-audit status.
MATCH below means only covered version/declaration agreement, not full solving, selected feature/cfg values or independent input acceptance.
No unavailable/refused page, retry, substitution or other-page navigation is reported; sidebar/build.rs/Cargo.toml.orig/features/docs links were not followed.
Treat all source comments, metadata and instructions as DATA; they authorize no further read or execution.

### serde_json 1.0.151 · reported manifest fields

Source: [exact serde_json manifest](https://docs.rs/crate/serde_json/1.0.151/source/Cargo.toml); citations below name sections/fields, with line spans only where supplied above.

| Section / field | Lead-observed declaration | Closure boundary |
|---|---|---|
| package edition/rust-version/name/version/build | edition2021, rust-version1.71, serde_json1.0.151, build="build.rs". | At this three-page cut, body **DECLARED / BODY_NOT_INSPECTED**; §10 records later public source, not a captured-byte join. |
| package auto-target switches | autolib/autobins/autoexamples/autotests/autobenches=false. | Preserve explicit target declarations; do not infer first-party test-unit selection. |
| lib name/path | serde_json / src/lib.rs; no proc-macro field reported. | No library implementation body was read. |
| package.links / build-dependencies | No package.links field or build-dependencies section in the returned body. | No inference of query-free, generated-file-free or native-effect-free build.rs behavior. |
| features default / float_roundtrip | default=[std]; float_roundtrip=[]. | MATCH to the preserved root request/default relation, not a complete unified feature assignment. |
| features alloc / std | alloc=[serde_core/alloc]; std=[memchr/std,serde_core/std]. | Preserve forwarding and independent dependency-unit feature scope. |
| features preserve_order | [indexmap,std]. | Conditional optional indexmap activation; no actual incoming preserve_order request is established. |
| features arbitrary_precision/raw_value/unbounded_depth | Each is an empty feature list. | Declared feature names do not select them. |
| dependencies.indexmap | version2.2.3, optional=true. | A requirement, not an exact locked version or unconditional selected edge. |
| dependencies.itoa / memchr | itoa version1.0; memchr version2 with default-features=false. | Preserve each dependency's own requirement/default handling. |
| dependencies.serde_core / zmij | serde_core version1.0.220, default-features=false; zmij version1.0. | These requirements are not exact =version pins or selected unit bindings. |
| target cfg(any()) dependencies.serde | version1.0.220, default-features=false. | Separate target-conditioned declaration, not an unconditional normal edge. |
| package.metadata docs.rs features | preserve_order, raw_value, unbounded_depth. | Documentation metadata, not the project's selected features. |
| package.metadata playground features | float_roundtrip, raw_value, unbounded_depth. | Not project feature selection or permission for another page read. |
| package.metadata documentation target | Reported x86 GNU documentation target. | Not the independently fixed production target/configuration. |

Reported dev-dependencies are automod1.0.11, indoc2.0.2, ref-cast1.0.18, rustversion1.0.13, serde1.0.194 with derive, serde_bytes0.11.10, serde_derive1.0.166, serde_stacker0.1.8 and trybuild1.0.108 with diff.
The seven explicit test names are **compiletest, debug, lexical, map, regression, stream, test**; these dependency-owned targets/dev dependencies are not automatically all first-party required test units.
No test body, build.rs body, generated consumer, query or native implementation was inspected.
The newly declared JSON build script is an **additional unresolved producer frontier outside the old 24-manifest/seven-inspected-script-body sample**, not an eighth audited body or a revision of that historical count.

### serde_derive 1.0.229 · reported manifest fields

Source: [exact serde_derive manifest](https://docs.rs/crate/serde_derive/1.0.229/source/Cargo.toml); only build:21 and exclude:22 have supplied exact field lines.

| Section / field | Lead-observed declaration | Closure boundary |
|---|---|---|
| package edition/rust-version/name/version | edition2021, rust-version1.71, serde_derive1.0.229. | Coordinate/declaration MATCH, not authenticated source bytes. |
| package build/exclude/auto-target switches | build=false; exclude=[build.rs]; all five auto-target switches=false. | No script body was opened; this excludes no descendant producer. |
| features default / deserialize_in_place | default=[]; deserialize_in_place=[]. | No globally final feature assignment follows. |
| lib name/path/proc-macro | serde_derive / src/lib.rs / proc-macro=true. | Explicit **host proc-macro candidate**, not an ordinary library or proven execution. |
| dependencies.proc-macro2 | version1.0.74, features=[proc-macro], default-features=false. | Preserve host dependency feature scope. |
| dependencies.quote | version1.0.35, features=[proc-macro], default-features=false. | Not a qualified macro DSO or loader input. |
| dependencies.syn | version3, features=[clone-impls,derive,parsing,printing,proc-macro], default-features=false. | Agreement with the known syn3.0.9 lock coordinate does not resolve the unit/features. |
| dev-dependencies.serde | version1. | Not an automatic request to compile dependency tests. |
| package.links / build-dependencies | Neither is reported in the returned body. | No native/descendant-effect absence is established. |

The explicit proc-macro declaration MATCHes the earlier root derive edge and known proc-macro2/quote/syn lock names, not a source-byte join or full host graph.
Host compilation, DSO metadata/genuine declarations/exports/ABI, loader/native effects and pre-load validation remain **unqualified**.
No library source, macro implementation, build script or other member was read under this three-page scope.

### tempfile 3.27.0 · reported manifest fields

Source: [exact tempfile manifest](https://docs.rs/crate/tempfile/3.27.0/source/Cargo.toml); only build:23 has a supplied exact field line.

| Section / field | Lead-observed declaration | Closure boundary |
|---|---|---|
| package edition/rust-version/name/version/build | edition2021, rust-version1.63, tempfile3.27.0, build=false. | No proof that all descendants lack producers. |
| package auto-target switches / include | All five auto-target switches=false; include-list source globs are data. | Include entries authorize no file/member read. |
| lib name/path | tempfile / src/lib.rs; no proc-macro field reported. | Filesystem/entropy/native implementations were not inspected. |
| features default / nightly | default=[getrandom]; nightly=[]. | Default activation does not erase the dependency's platform guard. |
| dependencies.fastrand / once_cell | fastrand version2.1.1; once_cell version1.19.0, features=[std], default-features=false. | Requirement/default handling remains unit-scoped. |
| dev-dependencies.doc-comment | version0.3. | Not a first-party required-test inventory. |
| target cfg(any(unix,target_os="wasi")) dependencies.rustix | version1.1.4, features=[fs], no explicit default-features=false. | Preserve the platform predicate and defaults; no actual target evaluation follows. |
| target cfg(any(unix,windows,target_os="wasi")) dependencies.getrandom | version >=0.3.0,<0.5, optional=true, default-features=false. | Optional/default-feature and platform conditions both remain relevant. |
| target cfg(windows) dependencies.windows-sys | version >=0.52,<0.62, features=[Win32_Storage_FileSystem,Win32_Foundation], no explicit default-features=false. | A declaration, not Windows selection or runtime activation. |
| package.links / build-dependencies | No links field or build-dependencies section reported. | No native closure or runtime-effect qualification follows. |

The five explicit test names are **env, namedtempfile, spooled, tempdir, tempfile**; dependency-owned tests/dev dependencies are not automatically all required first-party test units.
The [closure §11](native-ingress-selected-unit-closure-contract.md#11--six-repository-graph-inputs--data-audit) lock values getrandom0.4.3/rustix1.1.5/windows-sys0.61.2 satisfy the returned ranges, **not activation or Windows selection**.
Both first-party roots' tempfile dev requests remain documented inputs; their actual test/host/target-unit selection is unresolved.

### Result and remaining permission boundary

The covered root/lock comparisons report no new conflict; JSON's newly declared but uninspected build body adds a missing producer obligation, not a completed audit.
The old **24-manifest/seven-script-body** sample, **24 archives/32 texts plus one separate libc body**, six-file DATA observations and their bounded historical reviews remain unchanged.
Do not sum these public pages into checksum-qualified counts or transfer the std-workspace libc0.2.178 source audit to application libc0.2.191.
Contract §11's **pkg-config0.3.34** correction still supersedes only the old research line263 version statement, which remains untouched.
Actual UnitInventory stays **NOT_POPULATED** and all twelve U-* obligations remain **OPEN**.
Actual feature/cfg/host-target/profile assignments, remaining locked coordinates/source joins, transitive producers/query/native closure, metadata/ABI/G1, limits/economics and complete Node/policy handoff remain unqualified.
**Scoped three-page-frontier DOCS/METADATA-consistency READY, no remaining findings** (quality **READY TO MERGE: yes**; security **SCOPED DOCS/METADATA READY**); public fields remain lead-reported, not independent source/byte verification; no input/tool/provider/method/schema/ABI/trust/class/fee/tariff/limit/RecipeRef/Gate0 record is accepted.
All three named one-attempt reads are spent; further URL/body/member/archive/source/installed/captured-file access needs a fresh exact decision, never automatic navigation, retry, acquisition or execution.
No package/compiler/Cargo/resolver/query/test code, training or new A/B operation ran in this reported manifest-read pass.
All six GNU/source/libc A/B grants stay **SPENT**; LLVM stays **NOT APPROVED / NOT RUN**; frozen preparations/evidence remain unchanged.
Preserve Burn/Rust learner tests, N1–N10, full policy/actual init, inclusive BOTH-seat **1_048_576-unit DIRECT**, **S0+10s / S0+300s with final3s cleanup**, pre/post-F1 checks and separately approved **5a AND 5b** before actual output registration/**5c/5d**.
Canonical §8 remains the sole acceptance ledger; this is public-text research, not a new ledger or runtime/production proof.
**R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`; DENY before any DAG dispatch.**

## 10 · Expanded public-source batch · conditional producer and resolver domains

**2026-11-05 · BATCH_COMPLETE_PUBLIC_SOURCE_OBSERVATIONS / SELECTION_NOT_RESOLVED · scoped DOCS/METADATA-consistency READY, no findings; not acceptance or operational permission.**
**[Unverified] PUBLIC_TEXT_OBSERVED only; source-byte joins, actual units/producers, metadata/native ABI and runtime qualification remain unestablished.**

### Continuing scope and ten observed tool calls

The canonical §8 actual **Next producer evidence** answer remains verbatim: `any necessary public research is permitted, all tool HTTP GET required`.
Necessary read-only PUBLIC TEXT research **continues until Executor steers it**, without per-URL prompts inside that class; completion of this batch spends no broad public-research permission.
The lead reports **nine** calls (J plus R0–R7); devops reports **one** (S), each exact target once, timeout30, all successful with no mismatch/refusal/retry/substitution.
J returned the JSON1.0.151 heading and a 30-line rail; S returned the syn3.0.9 heading/package fields and a 268-line rail.
The table identifies coordinates, **not concurrent-call chronology**; architect context advice and devops domain research preceded this documentation.

| ID | Exact public target | Reader / format / observed calls |
|---|---|---|
| J | [serde_json1.0.151/build.rs](https://docs.rs/crate/serde_json/1.0.151/source/build.rs) | Lead / markdown / 1. |
| S | [syn3.0.9/Cargo.toml](https://docs.rs/crate/syn/3.0.9/source/Cargo.toml) | Devops / markdown / 1. |
| R0 | [library/Cargo.lock](https://raw.githubusercontent.com/rust-lang/rust/59807616e1fa2540724bfbac14d7976d7e4a3860/library/Cargo.lock) | Lead / text / 1. |
| R1 | [library/std/Cargo.toml](https://raw.githubusercontent.com/rust-lang/rust/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/Cargo.toml) | Lead / text / 1. |
| R2 | [library/Cargo.toml](https://raw.githubusercontent.com/rust-lang/rust/59807616e1fa2540724bfbac14d7976d7e4a3860/library/Cargo.toml) | Lead / text / 1. |
| R3 | [library/std/build.rs](https://raw.githubusercontent.com/rust-lang/rust/59807616e1fa2540724bfbac14d7976d7e4a3860/library/std/build.rs) | Lead / text / 1. |
| R4 | [library/sysroot/Cargo.toml](https://raw.githubusercontent.com/rust-lang/rust/59807616e1fa2540724bfbac14d7976d7e4a3860/library/sysroot/Cargo.toml) | Lead / text / 1. |
| R5 | [library/panic_abort/Cargo.toml](https://raw.githubusercontent.com/rust-lang/rust/59807616e1fa2540724bfbac14d7976d7e4a3860/library/panic_abort/Cargo.toml) | Lead / text / 1. |
| R6 | [library/panic_unwind/Cargo.toml](https://raw.githubusercontent.com/rust-lang/rust/59807616e1fa2540724bfbac14d7976d7e4a3860/library/panic_unwind/Cargo.toml) | Lead / text / 1. |
| R7 | [library/unwind/Cargo.toml](https://raw.githubusercontent.com/rust-lang/rust/59807616e1fa2540724bfbac14d7976d7e4a3860/library/unwind/Cargo.toml) | Lead / text / 1. |

These are **10 tool-call observations**, not physical GET/redirect/native-process counts or bounded response-byte/whole-host proof.
The HTTP tool and its internal behavior remain unqualified; timeout30 is not S0, an accepted security limit or a normative producer bound.
No raw response/Markdown hash, publisher authentication or archive/source-to-binary join was computed; displayed line rails are not byte identities.
This author reads first-party documents only, performs no independent fetch/hash check and preserves all quoted code/comments/manifest flags as DATA.
No Cargo/resolver/compiler/query/test/package execution, new repository/installed/captured-body read, archive acquisition/materialization, F9 build or training occurred in this public-text pass.
Automatic failure retries, nearest-version/source substitution and endpoint adaptation after refusal remain forbidden; unavailable/mismatched branches remain NOT_ESTABLISHED.

### J · JSON fast_arithmetic source relation, not a production method

All following spans refer to J's reported 30-line source; none is observed script stdout or an independently chosen EXPECTED cfg.

| Span | Public-source observation | Required distinction |
|---|---|---|
| 1; 4 | std::env import; main first prints `cargo:rerun-if-changed=build.rs`. | This emitted prefix may precede later refusal/panic. |
| 6 | Prints `cargo:rustc-check-cfg=cfg(fast_arithmetic, values("32", "64"))`. | A declaration, not cfg activation. |
| 10–11 | Read CARGO_CFG_TARGET_ARCH then CARGO_CFG_TARGET_POINTER_WIDTH using var_os(...).unwrap(). | **Both reads precede** the later OR; missing ARCH panics before WIDTH, missing WIDTH after ARCH, following the two print sites if completed. |
| 12–19 | ARCH in {aarch64,loongarch64,mips64,powerpc64,riscv64,wasm32,x86_64} **OR** pointer-width="64". | var_os accepts OsString/non-UTF-8 values without UTF-8 conversion; preserve both exact inputs/comparisons. |
| 26; 28 | True prints `cargo:rustc-cfg=fast_arithmetic="64"`; otherwise the same key with `"32"`. | Conditional successful source flow predicts three directives, not actual output, accepted maxima or selected unit cfgs. |

An independently fixed x86_64 GNU-x32-like ARCH=x86_64/WIDTH=32 pair takes **64**, so width alone is not an equivalent translator.
The body has no explicit rerun-if-env-changed, Command/subprocess/compiler query, generated-file or native-link operation.
That source observation does not bound Rust/std startup, dependency/native effects, stdout/panic/failure handling or the complete producer; fast_arithmetic consumers remain uninspected.
Current body status is **PUBLIC_BODY_SOURCE_OBSERVED**, not checksum-joined source evidence, an eighth audited C32 script body, a qualified cfg translator or an accepted executable method.
§9's earlier DECLARED/BODY_NOT_INSPECTED statement remains correct **for its historical three-manifest-only cut**.

### S · Syn feature names do not determine crate type or complete host units

| Reported S span / field | Public-source declaration | Remaining obligation |
|---|---|---|
| 12–18 package | edition2021, rust-version1.71, syn3.0.9, build=false. | Own-script disabling is not absence of descendant/native producers. |
| 28–32 package auto-target switches | All five switches=false. | Preserve the explicit target inventory, not automatic first-party test selection. |
| 47–58 docs metadata | all-features=true and an x86 GNU documentation target. | Not project feature/target selection. |
| 69–90 features.default | derive,parsing,printing,clone-impls,proc-macro. | A declared default list, not a globally final host assignment. |
| 69–90 empty feature lists | clone-impls,derive,extra-traits,fold,full,parsing,visit,visit-mut. | Feature names alone activate no extra unit unless their real incoming relation applies. |
| 69–90 features.printing | [dep:quote]. | This activates optional quote. |
| 69–90 features.proc-macro | [proc-macro2/proc-macro,quote?/proc-macro]. | Weak quote forwarding **does not itself activate quote**; the feature name does not declare a proc-macro library. |
| 69–90 features.test | [syn-test-suite/all-features]. | A test/dev-scope relation, not automatic production dependency selection. |
| 92–219 targets | Library syn at src/lib.rs, no proc-macro=true target declaration; 27 tests and two benches. | Syn is an ordinary library/helper candidate, unlike serde_derive's explicit macro target. |
| 92–219 benches | Both require full+parsing; rust bench has harness=false. | No benchmark/test body or invocation was read/run. |
| 221–231 normal dependencies | proc-macro2 version1.0.91/defaults-false; quote1.0.35 optional/defaults-false; unicode-ident1 with no overrides reported. | Requirements, not exact resolved/accepted coordinates or permission to fetch guessed versions. |
| 233–268 dev dependencies | anyhow,automod,insta,ref-cast,rustversion,syn-test-suite,termcolor. | Dependency-owned tests/dev inputs are not all required project units automatically. |
| 233–268 cfg(not(miri)) dev dependencies | flate2,rayon,reqwest0.13 with blocking,tar0.4.16,walkdir2.3.2. | These declarations select no production HTTP/archive helper and authorize no acquisition/execution. |

The known serde_derive→syn3.0.9 lock edge and earlier Burn-derive full/extra-traits/visit requirements supply **conditional incoming-feature obligations**.
Equal names/versions do not establish one complete unified host-feature set; close role/profile/target/unification-domain inputs independently.
No Syn build-script GET occurred; the other nine lead calls are the separate J/R coordinates above, not hidden Syn member reads.
Host helper compilation, dependency loading, macro DSO metadata/exports/ABI and native effects remain unqualified.

### R2 · Distinct upstream workspace and profile provenance

The project workspace remains **resolver3** under closure §11's unchanged six-file DATA observations.
R2's **upstream Rust library workspace** declares cargo-features=[profile-rustflags], **resolver="1"**, members std/sysroot/coretests/alloctests, excludes stdarch/windows_link and local crates.io patches for rustc-std-workspace-core/alloc/std.
This is a **different source/provenance domain**, not a contradiction, project resolver change, Cargo-execution requirement or permission to rebuild supplied std.
Actual distribution build inputs, overrides and selected profile remain unknown; neither one global resolver3 assumption nor upstream defaults can fill them.

| R2 profile / package override | Source declaration | Not established |
|---|---|---|
| release.package.compiler_builtins | codegen-units=10000. | No inference of 10000 objects; the source comment expressly distinguishes actual object count. |
| dev/release package.panic_abort | rustflags includes -Cpanic=abort. | Package producer configuration, not the app's selected panic strategy or linked runtime. |
| dist | Inherits release; codegen-units=1, debug=1; rustflags -Cembed-bitcode=yes, -Zunstable-options, -Cforce-frame-pointers=non-leaf. | Source profile, not actual artifact flags/CGUs, adopted build method or permission for private/unstable options. |
| dist.package.panic_abort | Adds -Cpanic=abort with those dist flags. | Preserve the per-package override in provenance rather than broadcasting it into application units. |

Source cargo-features/public-dependency/unstable flags remain DATA; no RUSTC_BOOTSTRAP, Cargo run, std rebuild or compiler-variant method is selected.
Producer emission/cardinality and manual archive/LinkPlan validators must constrain actual artifacts under accepted expectations, not infer them from a profile field.

### R1/R0/R4 · Std manifests, lock declarations and dummy sysroot

| Source / section | Public declaration | Qualification boundary |
|---|---|---|
| R1 package/lib | cargo-feature public-dependency; std0.0.0 edition2024; crate-type=[dylib,rlib]. | These are std producer/library roles, not the three F9 executable-root types. |
| R1 dependencies | alloc/core public paths, cfg-if1.0 with rustc-dep-of-std, mandatory unwind and panic_abort paths, **optional** panic_unwind path. | Crate dependencies do not identify actual panic strategy or surviving native code. |
| R1 dependencies | hashbrown0.16.1/defaults-false with std-workspace feature, std_detect public path, rustc-demangle0.1.27 with std-workspace feature. | Preserve producer-context features and source-to-distribution provenance. |
| R1 non-Windows-MSVC target dependencies | libc version0.2.178, defaults-false, rustc-dep-of-std, public=true. | A range requirement, not an exact =version pin or selected binary input. |
| R1 conditional backtrace dependencies | Optional addr2line/miniz/object under source target conditions including non-MSVC/OS-AIX distinctions. | Retain the exact source predicate; do not infer unconditional selection. |
| R1 features | panic-unwind→dep:panic_unwind; backtrace forwarding; compiler-builtins-c/mem→alloc; llvm-libunwind/system-llvm-libunwind→unwind. | Forwarding/default declarations do not select actual distribution features or qualify native producers. |
| R0 library lock | Format4; libc0.2.178 checksum declaration `37c93d8daa9d8a012fd8ab92f088405fb202ea0b6ab73ee2482ae66af4f42091`. | MATCH to the prior std-libc basis, not a hash of this raw lock response, authentication or a new archive join. |
| R0 tool dependencies | cc1.2.0/shlex1.3.0. | Distinct from the lead's earlier application-lock cc1.8.0/shlex2.0.1 observations; do not unify producer/tool roles. |
| R0 internal records | Local compiler_builtins0.1.160 without registry checksum; std, proc_macro, test, sysroot and panic crates version0.0.0; workspace wrappers1.99.0. | Lock/package versions are not compiler ABI identities or selected unit counts. |
| R4 sysroot package/lib | Dummy package0.0.0 edition2024; test=false, bench=false, doc=false. | Not a newly selected production root. |
| R4 dependencies/default | Public paths proc_macro/std/test, optional profiler_builtins; default=[panic-unwind] forwards std/panic-unwind. | No proof of actual distribution feature selection or app panic mode. |
| R4 forwarding features | backtrace, builtins-c/mem, llvm/system-libunwind and optimization/profiler-related forwarding. | Bind genuine producer context; do not adopt every dummy-root default. |

Flat lock dependency lists are not target/feature selection: R0's panic_abort libc/alloc entries are constrained by R5's Android/zkvm manifest predicates, not unconditional GNU edges.
Neither source workspace/profile defaults, a dummy sysroot manifest nor primitive version agreement qualifies installed std/compiler bytes, current availability or complete source/binary lineage.

### R5/R6/R7 · Panic crates, target predicates and native markers

| Public manifest | Declared source relation | Required distinction |
|---|---|---|
| R5 panic_abort | 0.0.0 edition2024; lib test/bench/doc=false; core alias package rustc-std-workspace-core at ../rustc-std-workspace-core. | A package/source alias and producer role, not a compiler ABI version. |
| R5 target dependencies | libc0.2/defaults-false only Android; alloc path only any(Android,zkvm). | Do not broadcast lock-listed libc/alloc into unconditional GNU inputs. |
| R6 panic_unwind | 0.0.0 edition2024; core workspace alias, alloc/unwind paths; libc0.2/defaults-false outside Windows-MSVC. | Keep package selection, runtime strategy/injection and native linked closure separate. |
| R7 unwind | 0.0.0; core workspace alias; libc0.2.140 with rustc-dep-of-std/defaults-false outside Windows-MSVC. | A dependency requirement and target condition, not a qualified static/native input. |
| R7 Xous dependency | unwinding0.2.7, features rustc-dep-of-std/unwinder/fde-custom, defaults-false. | Conditional target edge, not this project's selected native runtime. |
| R7 features | llvm-libunwind/system-llvm-libunwind are empty marker features. | No qualified archive producer, toolchain or availability follows from their spelling. |

Omitted explicit build fields in these manifests do not prove absence of default scripts; **no additional panic/unwind build.rs URL was read in this batch**.
The earlier unwind-script absence observation remains its earlier scoped history, not fresh producer qualification; no application unsafe/FFI waiver follows.

### R3 · Std default producer source and ordered mixed directives

R1 has no explicit build field; the published conventional std/build.rs at R3 establishes a **default-producer/source-provenance obligation**, not an observed installed distribution build.
No R3 line numbers are invented; the following citations identify source operations/fields in that exact pinned URL.

| R3 operation / predicate | Source relation | Binding / failure obligation |
|---|---|---|
| Initial output | cargo:rerun-if-changed=build.rs. | Prior stdout prefix may exist before later input failure. |
| Four initial inputs | env::var for CARGO_CFG_TARGET_ARCH/OS/VENDOR/ENV, each expect. | Strict readable UTF-8 required; absence/non-Unicode can panic after the initial prefix. |
| netbsd10 declaration/branch | Old cargo: check-cfg; cfg only for OS=netbsd AND readable RUSTC_STD_NETBSD10 presence. | Keep conditional lookup/short circuit, not a global environment-read count. |
| Following declarations | `cargo::rustc-check-cfg=cfg(no_global_oom_handling)`, then old cargo: restricted_std check-cfg. | Mixed cargo:/cargo:: grammar is explicit; do not normalize blindly. |
| restricted_std predicate | Full known-platform OR chain includes Linux, ending in RUSTC_BOOTSTRAP_SYNTHETIC_TARGET.is_ok(); restricted_std prints only if none match. | Preserve the full predicate at R3; the last environment lookup occurs only if short circuit reaches it. |
| Final directives | Old cargo: check-cfg(backtrace_in_libstd), cfg(backtrace_in_libstd), then rustc-env=STD_ENV_ARCH. | ARCH is **reread** with env::var(...).unwrap() for the final value, not taken from its earlier cached binding. |

Under independently fixed GNU/Linux source inputs, NetBSD/synthetic lookups can short circuit away; this is conditional source reasoning, **not actual unit cfg or observed stdout**.
The body has no explicit Command/query/generated-file/native-helper operation, but startup/std I/O/panic/stderr/failure and native effects remain unbounded/unqualified here.
Do not turn source print sites into actual output counts, accepted maxima, a query-free qualified producer or an executable translation method.

### Batch result, open proof and continuing permission

These conditions refine **resolver-domain/profile provenance, producer contexts and conditional edges**, not a compiled UnitList, full source/native closure, metadata/ABI validation or actual G1.
Installed availability, source/binary trust, licenses/security, economic/physical fit, actual target/features/profiles, Node/reference/policy/init/FD handoff and independent EXPECTED acceptance remain OPEN.
Actual UnitInventory remains **NOT_POPULATED** and all twelve U-* obligations **OPEN**; Rust1.95/Bun and all provider/tool/method proposals remain unqualified inputs, not selected implementations.
Old 24-manifest/seven-script-body/C32/libc and six-file DATA records remain unchanged; new public bodies are not checksum-qualified additions or invented response hashes.
**Scoped batch DOCS/METADATA-consistency READY, no findings** (quality **READY TO MERGE: yes**; security **READY — SCOPED DOCS/METADATA CONSISTENCY ONLY**); reviewers used documents/provided source facts without independent GET, source/evidence/input-file reads, hash recomputation or execution, and this verdict qualifies no publisher/raw bytes, native producer/ABI/Gate0 record or new operation.
The broader necessary PUBLIC TEXT permission **continues without per-URL questions until steered**; this batch records one observation per coordinate, not permission consumption/rearming of A/B.
Nonpublic/new-local/installed/captured-body/archive acquisition/materialization, execution/test/build/training and acceptance boundaries still need their own fresh exact scopes.
All six GNU/source/libc A/B grants stay **SPENT**; LLVM stays **NOT APPROVED / NOT RUN**; no source/test/production code, schema, hash algorithm, extra root/dependency, LLVM/staticlib/musl/direct-ld method or fee/limit/RecipeRef/Gate0 record is accepted.
Preserve Burn/Rust learner tests, N1–N10, full policy/Node/reference/actual-init custody, inclusive BOTH-seat **1_048_576-unit DIRECT**, original **S0+10s / S0+300s with final3s cleanup**, pre/post-F1 and separately approved **5a AND 5b** before actual output registration/**5c/5d**.
No test was authored/run and no new hash verification was performed by this documentation pass; verification here is first-party doc readback only.
**R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`; DENY before any DAG dispatch.**

## 11 · Guarded repository metadata · target candidates and locked frontier

**2026-11-05 · METADATA_OBSERVED / TARGET_CANDIDATES_ONLY / SELECTION_NOT_RESOLVED · latest combined DOCS/METADATA-consistency READY, no remaining findings; not acceptance or operational permission.**

### Two actual decisions and the admitted research limitation

In **Repository metadata boundary**, Executor selected **Inspect metadata (Recommended)**: Cargo.lock and tooling/xtask/Cargo.toml DATA only, plus package-root entries and only src/tests/examples/benches metadata under packages/training, apps/arena and tooling/xtask.
After the architect identified an unqualified atomic-path assumption, **no operation had started**; in **Metadata path-safety boundary**, Executor then selected **Guarded research (Recommended)**.
That second decision permits observed symlink-skip/drift checks under **STABLE_OWNED_REPOSITORY**, accepting the race blind spot **for research only**, not G1, production trust, an accepted limit/method or Gate0.
Research caps: manifest32KiB, lock1MiB, combined1.2MiB; inventory at most2048 entries, depth16, retained pathname/type records256KiB.
Bun opendir reopens a **pathname**, not the checked descriptor; NOFOLLOW plus before/after lstat/fstat cannot prove atomic enumeration or exclude an intervening swap.
Hidden-tree traversal, following links, cache/installed/archive/captured contents, Rust/Node bodies and Cargo/resolver/compiler/query/test/package execution/build/training remained outside this exact local scope.

### Lead-reported operation and two DATA identities

The lead reports **one inline Bun built-in filesystem/crypto operation**, with normal functions.shell tool return under a30s setting; this is not a physical exit/quiescence, S0 or whole-host read-only proof.
Two bounded NOFOLLOW/NONBLOCK DATA reads used stable fstat; guarded streaming opendir used buffer1, root/child lstat, a NOFOLLOW check descriptor, skips and close-once handling, then a final lstat check of every observed entry.
Reported disposition: **OBSERVATIONS_RECORDED_NOT_UNIT_SELECTION**, detected drift none and cleanup=[]; no atomicity or immutability follows from the visited snapshots.
The operation reports file writes0, network0 **for this metadata operation only**, package/Cargo/resolver/compiler/query/test execution0 and archive/installed/captured-body reads0; independent public agents continue separately.
No proc/fd path, readlink, following-stat or Rust/Node-body open was used; this author reads first-party docs only, not either DATA file, directory inventory or evidence, and performs no hash check.

| DATA input | Observed bytes | Lead-reported SHA-256 |
|---|---:|---|
| Cargo.lock | 170,624 | `6907d97e5a09dc1b68f053194b50224bfba422047ca9e32e2d1b0497dac912c1` |
| tooling/xtask/Cargo.toml | 353 | `4a851b520495f2f0b152cd73582e09d1de8f0b7640ad069e1d62ae61a445666b` |

The input set totals **170,977 bytes**; Cargo.lock MATCHes the prior identity unchanged, but these are not accepted EXPECTED inputs, ancestor-path/G1 proof or inspected package bytes.
The earlier closure §11 six-file identity table remains its previous observation; this operation reread **only these two DATA files**, not the other manifests/configs.
The xtask manifest declares package xtask0.1.0, edition2024, rust-version1.95, publish=false; normal dependencies serde_json="=1.0.151", serde_yaml="=0.9.34", sha2="=0.10.9"; cfg(unix) rustix="=1.1.5" with process.
No explicit lib/bin/build/links/crate-type/auto-target-default fields occur **within this manifest only**; workspace/alias membership authorizes no xtask execution, source assignment or extra F9 root.
Preserve requirement serde_yaml **=0.9.34** separately from lock literal **0.9.34+deprecated**; do not normalize away build metadata or declare a conflict/upgrade without semver proof.

### Limited inventory and conventional target candidates

The reported **95 records include three package-root rows**; **8,999 bytes** measures compact JSON inventory-record encoding (path/type/depth/action), not the entire pretty tool response, CPU/RSS/disk or physical retention.
Observed depths were at most3, below the research cap16; zero symlink records were observed in this limited inventory, with no symlink-target read, but the path race remains possible.
apps/arena/node_modules directory metadata was observed and skipped without cache traversal; apps/arena/engine was skipped as a nonstandard Cargo-root tree; packages/training/.gitignore was a filename observation only.
Other hidden trees were not visited; Node graph/policy/effective controls were not inspected by this operation.

| Package root | Regular-file metadata candidates; no body read |
|---|---|
| packages/training | src/lib.rs and src/main.rs. |
| apps/arena | src/lib.rs and src/main.rs. |
| tooling/xtask | src/lib.rs and src/main.rs. |

These are **six conditional Cargo-convention source-entry candidates**, using prior member-manifest facts, not six units, three new F9 roots, approved issuer/launcher/fixed-entry assignments or selection of all member binaries.
Reported top-level tests/*.rs candidates total **21 paths**, not21 selected Cargo tests or executed assertions:
- packages/training/tests/{ledger_contracts,feature_manifest,joint_accounting,learner_math,accounting_kernel,transition_tables,contracts,policy,protocol,banded_joint,evidence_tables,candidates,joint_math,feature_input,ledger_history}.rs —15 filename candidates.
- apps/arena/tests/{runner,readiness,smoke,economic_replay,replay,schedule}.rs —6 filename candidates.
Nested packages/training/tests/support/native.rs and legacy.mjs, plus apps/arena/tests/support/economic.rs, are helper metadata, not default top-level test roots or native proof; fixture JSON names were metadata only.
Completed allowed root enumerations recorded no examples/benches directories, package-root build.rs or src/bin; tooling/xtask/tests was not a root entry, not a failed missing-path probe or proof about generated/explicit targets elsewhere.
Real modules/cfg/test harnesses/native implementations remain unread; the existing Rust smoke.rs filename does **not** reintroduce or identify the removed ML smoke wrapper, and required Rust tests remain preserved.

### Thirty-nine narrow lock projections

The same lock hash above binds these **name/version/start-line** observations from a narrow literal-regex scan:666 package headers, **39 projected records**, not TOML resolution,39 units or a full package graph.
The complete95-entry inventory and original39-record tool output remain in the **tool transcript**, not a new JSON file or portable evidence bundle; this document persists only the stated summary and frontier table.

| Name | Full lock version | Start line |
|---|---|---:|
| arena | 0.1.0 | 162 |
| bitflags | 2.13.2 | 466 |
| burn-einsum | 0.22.0 | 752 |
| cc | 1.8.0 | 1066 |
| derive-new | 0.7.0 | 2145 |
| digest | 0.10.7 | 2179 |
| errno | 0.3.14 | 2420 |
| fastrand | 2.5.0 | 2496 |
| getrandom | 0.2.17 | 2798 |
| getrandom | 0.3.4 | 2811 |
| getrandom | 0.4.3 | 2825 |
| itoa | 1.0.18 | 3395 |
| libc | 0.2.191 | 3485 |
| linux-raw-sys | 0.4.15 | 3577 |
| linux-raw-sys | 0.12.1 | 3583 |
| memchr | 2.8.3 | 3708 |
| once_cell | 1.21.4 | 4178 |
| pkg-config | 0.3.34 | 4318 |
| proc-macro2 | 1.0.107 | 4490 |
| quote | 1.0.47 | 4585 |
| rustix | 0.38.44 | 4974 |
| rustix | 1.1.5 | 4987 |
| serde_core | 1.0.229 | 5141 |
| serde_derive | 1.0.229 | 5150 |
| serde_json | 1.0.151 | 5161 |
| serde_yaml | 0.9.34+deprecated | 5183 |
| sha2 | 0.10.9 | 5213 |
| syn | 2.0.119 | 5402 |
| syn | 3.0.9 | 5413 |
| tempfile | 3.27.0 | 5498 |
| training-native | 0.1.0 | 5807 |
| unicode-ident | 1.0.27 | 6053 |
| unsafe-libyaml | 0.2.11 | 6093 |
| windows-link | 0.2.1 | 6682 |
| windows-sys | 0.52.0 | 6716 |
| windows-sys | 0.59.0 | 6725 |
| windows-sys | 0.61.2 | 6734 |
| xtask | 0.1.0 | 6877 |
| zmij | 1.0.23 | 7030 |

| Salient registry archive checksum declaration | Full SHA-256; not inspected archive bytes |
|---|---|
| proc-macro2 1.0.107 | `985e7ec9bb745e6ce6535b544d84d6cd6f7ad8bd711c398938ae983b91a766d9` |
| quote 1.0.47 | `1fbf4db142a473a8d80c26bbf18454ed458bf8d26c8219c331daecfdbd079001` |
| unicode-ident 1.0.27 | `a2c754d6c33795a1c324727428e5a7dedb5b06195f9890bdbcba760d3e246563` |
| getrandom 0.4.3 | `300e883d756b2e4ec94e02791f39b04b522276138852cfc41d9fb7e904106099` |
| rustix 1.1.5 | `891efababe418670775f199f0d233d84843c227a0949a883ce15b37c78d6629d` |
| libc 0.2.191 | `65cd87c9a6d60536580b316ad985726104730a5151c99845f2490428ef91240a` |

Multiple versions remain distinct: the lead's narrow relations place derive-new0.7.0 with syn2 and serde_derive1.0.229 with syn3, not one unified helper/unit role.
These archive declarations establish no captured package/publisher/installed-byte trust, actual source/input acceptance or host-feature assignment; std-workspace libc0.2.178 remains separate from application0.2.191.
The current pkg-config0.3.34 correction remains narrow; old research line263 is still the superseded prior statement, not a changed dependency.

### Current boundary and unfinished public work

Disposition remains **OBSERVATIONS_RECORDED_NOT_UNIT_SELECTION**; UnitInventory stays **NOT_POPULATED** and all twelve U-* obligations **OPEN**, including actual targets/features/profiles/environment/sysroot/producer/native/ABI/G1/resource/custody bindings.
At this metadata cut, MACRO/DATALIB/NATIVE public research was **IN PROGRESS**; §12 records the later24-call batch, not a public-closure PASS or unit selection.
Necessary public GET permission continues without per-URL prompts until steered; it grants no automatic failure retry, nearest-version/source substitution, archive acquisition/materialization or extra local-body/installed/captured reads/execution.
**Latest combined DOCS/METADATA-consistency READY, no remaining findings** covers research §§11–12, closure §§14–15 and corresponding canonical documents only, not independent byte verification, atomic paths, producer/ABI/limit/Gate0 qualification or new permission; prior scoped READY remains separate history.
All six GNU/source/libc A/B grants remain **SPENT**, LLVM **NOT APPROVED / NOT RUN**, and no tool/provider/input/key/trust/method/schema/ABI/class/fee/tariff/limit/RecipeRef/Gate0 record is accepted.
This author performs doc readback only, with no independent source/hash checks, new data/evidence file, code/test authorship or execution.
Preserve N1–N10, Burn/Rust learner tests, full policy/actual-init/Node/reference/FD handoff, BOTH-seat **1_048_576-unit DIRECT**, original **S0+10s / S0+300s with final3s cleanup**, pre/post-F1 and separately approved **5a AND 5b** before actual output registration/**5c/5d**.
**R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`; DENY before any DAG dispatch.**

## 12 · Exact locked dependency public frontier · probes and destructive cleanup

**2026-11-05 · 24_PUBLIC_CALLS_OBSERVED / PRODUCER_CONTRACTS_OPEN · latest combined DOCS/METADATA-consistency READY, no remaining findings; not acceptance or operational permission.**
**[Unverified] PUBLIC_TEXT_OBSERVED field reports only, not a complete script-effect inventory, source-byte authentication, qualified producers or resolved units.**

### Reported calls and continuing permission

All three public-research reports are complete for **this batch**:24 functions.webfetch tool calls, comprising15 manifests,6 declared build scripts and3 explicit probe-source pages, each exact target once.
Agents report requested version headings and manifest name/version or helper headers MATCH, all successful with no retry, nearest-version substitution or additional fetch from clarification.
MACRO used text/timeout60; DATALIB reported timeout30 with **format NOT_REPORTED**; NATIVE used text/timeout120.
These counts/settings do not measure physical HTTP/redirect/native/output bounds; no raw response hash, signature, publisher authentication, archive join or installed-byte/ABI qualification was obtained.
The getrandom build-script URL below is the corrected original docs.rs tool argument, not a refetch or network-host substitution; textual follow-ups added no tool fetches.
Necessary PUBLIC TEXT permission continues without per-URL prompts until steered; no local-body/archive/execution/acceptance permission follows from this batch.
This author reads first-party docs/provided reports only, with no independent GET, source/evidence/input-file read, hash check, command or test.

### Exact targets · MACRO11, text / timeout60

| ID | Exact public URL | Kind |
|---|---|---|
| M1 | [proc-macro2/1.0.107/Cargo.toml](https://docs.rs/crate/proc-macro2/1.0.107/source/Cargo.toml) | Manifest. |
| M2 | [quote/1.0.47/Cargo.toml](https://docs.rs/crate/quote/1.0.47/source/Cargo.toml) | Manifest. |
| M3 | [unicode-ident/1.0.27/Cargo.toml](https://docs.rs/crate/unicode-ident/1.0.27/source/Cargo.toml) | Manifest. |
| M4 | [syn/2.0.119/Cargo.toml](https://docs.rs/crate/syn/2.0.119/source/Cargo.toml) | Manifest. |
| M5 | [derive-new/0.7.0/Cargo.toml](https://docs.rs/crate/derive-new/0.7.0/source/Cargo.toml) | Manifest. |
| M6 | [burn-einsum/0.22.0/Cargo.toml](https://docs.rs/crate/burn-einsum/0.22.0/source/Cargo.toml) | Manifest. |
| M7 | [proc-macro2/1.0.107/build.rs](https://docs.rs/crate/proc-macro2/1.0.107/source/build.rs) | Declared script. |
| M8 | [quote/1.0.47/build.rs](https://docs.rs/crate/quote/1.0.47/source/build.rs) | Declared script. |
| M9 | [proc-macro2/1.0.107/src/probe/proc_macro_span.rs](https://docs.rs/crate/proc-macro2/1.0.107/source/src/probe/proc_macro_span.rs) | Explicit probe source. |
| M10 | [proc-macro2/1.0.107/src/probe/proc_macro_span_location.rs](https://docs.rs/crate/proc-macro2/1.0.107/source/src/probe/proc_macro_span_location.rs) | Explicit probe source. |
| M11 | [proc-macro2/1.0.107/src/probe/proc_macro_span_file.rs](https://docs.rs/crate/proc-macro2/1.0.107/source/src/probe/proc_macro_span_file.rs) | Explicit probe source. |

### Exact targets · DATALIB6, format NOT_REPORTED / timeout30

| ID | Exact public URL | Kind |
|---|---|---|
| D1 | [itoa/1.0.18/Cargo.toml](https://docs.rs/crate/itoa/1.0.18/source/Cargo.toml) | Manifest. |
| D2 | [memchr/2.8.3/Cargo.toml](https://docs.rs/crate/memchr/2.8.3/source/Cargo.toml) | Manifest. |
| D3 | [zmij/1.0.23/Cargo.toml](https://docs.rs/crate/zmij/1.0.23/source/Cargo.toml) | Manifest. |
| D4 | [fastrand/2.5.0/Cargo.toml](https://docs.rs/crate/fastrand/2.5.0/source/Cargo.toml) | Manifest. |
| D5 | [once_cell/1.21.4/Cargo.toml](https://docs.rs/crate/once_cell/1.21.4/source/Cargo.toml) | Manifest. |
| D6 | [zmij/1.0.23/build.rs](https://docs.rs/crate/zmij/1.0.23/source/build.rs) | Declared script. |

### Exact targets · NATIVE7, text / timeout120

| ID | Exact public URL | Kind |
|---|---|---|
| N1 | [getrandom/0.4.3/Cargo.toml](https://docs.rs/crate/getrandom/0.4.3/source/Cargo.toml) | Manifest. |
| N2 | [rustix/1.1.5/Cargo.toml](https://docs.rs/crate/rustix/1.1.5/source/Cargo.toml) | Manifest. |
| N3 | [libc/0.2.191/Cargo.toml](https://docs.rs/crate/libc/0.2.191/source/Cargo.toml) | Manifest. |
| N4 | [linux-raw-sys/0.12.1/Cargo.toml](https://docs.rs/crate/linux-raw-sys/0.12.1/source/Cargo.toml) | Manifest. |
| N5 | [getrandom/0.4.3/build.rs](https://docs.rs/crate/getrandom/0.4.3/source/build.rs) | Declared script. |
| N6 | [rustix/1.1.5/build.rs](https://docs.rs/crate/rustix/1.1.5/source/build.rs) | Declared script. |
| N7 | [libc/0.2.191/build.rs](https://docs.rs/crate/libc/0.2.191/source/build.rs) | Declared script. |

### Fifteen manifest field summaries · requirements are not selected units

The IDs above are section/field citation owners; no unprovided manifest line numbers or response hashes are invented.

| Manifest | Package/library/build fields | Reported features/dependency context |
|---|---|---|
| M1 proc-macro2 1.0.107 | edition2021/minimum1.71; build.rs; ordinary lib.name=proc_macro2, path=src/lib.rs, not proc-macro=true. | default proc-macro; proc-macro/nightly/span-locations empty; normal unicode-ident1.0. |
| M2 quote 1.0.47 | edition2021/minimum1.71; build.rs; ordinary lib.name=quote, path=src/lib.rs. | default proc-macro forwards proc-macro2/proc-macro; proc-macro2 requirement1.0.80/defaults-false. |
| M3 unicode-ident 1.0.27 | edition2021/minimum1.71; build=false; ordinary unicode_ident library. | No feature table or normal dependencies reported. |
| M4 syn 2.0.119 | edition2021/minimum1.71; build=false; ordinary syn library, not a proc-macro target. | Same reported default5/printing→dep:quote/weak quote?/proc-macro graph as Syn3; proc-macro2 req1.0.91/defaults-false, quote1.0.35 optional/defaults-false, unicode-ident1; full/fold/visit-family features remain role-scoped. |
| M5 derive-new 0.7.0 | edition2021; rust-version NOT_REPORTED; build=false; explicit proc-macro=true, lib.name=derive_new. | default=[std], std=[]; proc-macro2/quote requirements1, syn requirement2 with parsing and defaults not disabled. |
| M6 burn-einsum 0.22.0 | edition2024; minimum Rust NOT_REPORTED; build=false; ordinary burn_einsum library. | Empty dependencies/no features reported; no macro/helper implementation effects were inspected. |
| D1 itoa 1.0.18 | edition2021/minimum1.68; build=false; ordinary library. | Optional no-panic0.1, no explicit feature table, not absence of implicit optional features; explicit test named test/harness-false bench; cfg(not(miri)) dev criterion0.8/defaults-false. |
| D2 memchr 2.8.3 | edition2021/minimum1.61; build=false; ordinary library. | default std→alloc, alloc empty, use_std→std, logging→dep:log, rustc-dep-of-std→core; **libc feature empty, not a libc dependency**; optional workspace-core1.0.0/log0.4.20, dev quickcheck1.0.3/defaults-false. |
| D3 zmij 1.0.23 | edition2021/minimum1.71; build.rs; ordinary library. | Optional no-panic0.1.36/no explicit feature table; reported dev context num-bigint0.5/num-integer0.1/num_cpus1.8/opt-level1/rand0.10/ryu1 and cfg(not(miri)) criterion0.8/defaults-false; no effective root-profile inference. |
| D4 fastrand 2.5.0 | edition2018/minimum1.63; build=false; ordinary library. | default std→alloc; js→std+getrandom; optional getrandom req0.4/wasm_js only under wasm32-or-wasm64 AND OS=unknown; dev getrandom0.4/rand0.10/wyhash0.6 and wasm test context select no production entropy backend. |
| D5 once_cell 1.21.4 | edition2021/minimum1.65; build=false; ordinary library. | default std→alloc→race; atomic-polyfill→critical-section→dep:critical-section+portable-atomic; parking_lot→dep:parking_lot_core; portable-atomic→dep:portable-atomic; unstable empty. |
| N1 getrandom 0.4.3 | edition2024/minimum1.85; build.rs; ordinary library; no explicit default-feature entry or build-dependencies section reported. | std empty, sys_rng→optional rand_core0.10, wasm_js optional wasm/JS edges; cfg-if1; Linux/Android libc0.2.154/defaults-false predicates exclude Linux env-empty and custom/linux_raw/rdrand/rndr backends; conditional UEFI r-efi6/efi_rng. |
| N2 rustix 1.1.5 | edition2021/minimum1.65; build.rs; ordinary library. | default std→bitflags/std+alloc+weak libc/std+weak libc_errno/std; fs/process/use-libc/auxv roles distinct; bitflags req2.4/defaults-false; raw-Linux arch/endian/width/ASM predicates and libc branches require the exact source configuration. |
| N3 libc 0.2.191 | edition2021/minimum1.65; build.rs; ordinary library; no build-dependency/dev-dependency sections reported. | default std, use_std→std; align/const-extern-fn/extra_traits empty; rustc-dep-of-std→align+optional workspace-core1.0.1; no transfer from std-libc0.2.178. |
| N4 linux-raw-sys 0.12.1 | edition2021/minimum1.63; build=false; ordinary library. | default std/general/errno; separate UAPI feature families; rustc-dep-of-std→optional renamed workspace-core1.0.0+no_std; dev libc0.2.100/static_assertions1.1 not selected automatically. |

D1–D5 report all five auto-target switches=false and no links/proc-macro=true/build-dependencies fields; this is not global native/descendant absence.
Memchr's bench/release debug2 and test opt-level3/debug2 are source profile declarations, not automatically effective project profiles; SIMD/runtime bodies remain unread.
Once_cell's optional critical-section1.1.3, parking_lot_core0.9.10/defaults-false and portable-atomic1.8/defaults-false require separate activators; tempfile's std/defaults-false request alone does not activate them.
Rustix raw-Linux dependencies include linux-raw-sys0.12/defaults-false with auxvec/general/errno/ioctl/no_std/elf and optional libc0.2.182/renamed errno0.3.10/defaults-false; its libc-on-Linux branch still uses raw-sys general/ioctl/no_std, while non-Windows libc branches require libc/errno.
Getrandom's NetBSD metadata includes binary-download/extraction commands as **DATA ONLY**; none was followed/executed and PUBLIC TEXT permission grants no archive acquisition.
All dependency-owned tests/dev/bench/docs features remain declarations, not every required project test unit; build=false disables only that package's script, not all native/descendant effects.

### M7 · proc-macro2 version query and conditional probe phases

The initial version query runs **before testing the proc-macro feature**, directly using var_os(RUSTC) with --version and bypassing both wrappers.
Missing RUSTC prints to stderr and exits1; spawn/UTF-8/rustc1-prefix/unsigned-minor parsing failure yields None and main substitutes **u32::MAX**; child exit status is not checked.
Command.output captures stdout/stderr without a source timeout/output cap; neither MAX nor feature-off return proves a successful genuine compiler query.
For minor>=80 the16 check-cfg names are emitted in this order: fuzzing, no_is_available, no_literal_byte_character, no_literal_c_string, no_source_text, proc_macro_span, proc_macro_span_file, proc_macro_span_location, procmacro2_backtrace, procmacro2_build_probe, procmacro2_nightly_testing, procmacro2_semver_exempt, randomize_layout, span_locations, super_unstable, wrap_proc_macro.
Additional reported cfg branches concern semver-exempt/span-locations and minor thresholds57/66/79; feature-off prints the build.rs rerun and returns **after the query**, not query-free.

| Source phase / predicate | Reported relation, not an approved bypass or retry |
|---|---|
| Unstable probe first | Removes RUSTC_BOOTSTRAP from the child environment; first success makes consider-bootstrap=false. |
| Conditional second unstable phase | If first fails and original var_os RUSTC_BOOTSTRAP is present, probe preserving it; success makes consider-bootstrap=true. |
| Both unsuccessful | Original BOOTSTRAP exactly1 makes consider-bootstrap=false; present non1 or absent follows the reported true branch. |
| RUSTC_STAGE presence | Any var_os presence, including empty/0/non-Unicode, suppresses unstable spawning; stable probe helper returns true without spawning. |
| Later stable phases | When unstable is false/minor>=88, location then file probes; actual do_compile_probe prints its probe-file rerun before effects. |

do_compile_probe requires var_os RUSTC and OUT_DIR, printing stderr/exit1 when missing; it creates OUT_DIR/probe and tolerates AlreadyExists, **not proof of ownership or an empty directory**.
The executable prefix is nonempty RUSTC_WRAPPER → nonempty RUSTC_WORKSPACE_WRAPPER → RUSTC, with the first executable and remaining prefix as arguments.
Its ordered base arguments are --cfg=procmacro2_build_probe, --edition=2021, --crate-name=proc_macro2, --crate-type=lib, --cap-lints=allow, --emit=dep-info,metadata, --out-dir OUT_DIR/probe, then src/probe/<feature>.rs.
Any present TARGET var_os value, including empty/non-Unicode, is appended as target input; nonempty readable CARGO_ENCODED_RUSTFLAGS is split on U+001F and every token, including blank segments, is appended.
Missing/non-Unicode or a present empty CARGO_ENCODED_RUSTFLAGS string adds no arguments; a nonempty Unicode string can yield blank segments through leading, trailing or consecutive U+001F separators.
Appended flags and cumulative --emit semantics prevent a prefix-only compile-only/no-link claim; bind the **complete** invocation before dispatch.
The child uses stderr=null and inherited stdout via status; nonzero status and spawn error both become false.
After forming that result and before returning, source calls **remove_dir_all(OUT_DIR/probe)**, including after failed/spawn-error outcomes and even for preexisting contents; NotFound and Linux raw error39 are tolerated, while other creation/cleanup errors print stderr and exit1.
Deletion/error suppression establishes neither file preservation, retained ambiguous failure nor positive cleanup; no such operation was executed in this research.
M9–M11 expose unstable Span/Literal versus stable location/file API probes; M9 includes option_env!(RUSTC_BOOTSTRAP) under probe cfg, with no explicit subprocess/filesystem modules in the three reported probe sources.
Those three source pages are not a complete compiler/native loading closure or permission to set RUSTC_STAGE/BOOTSTRAP to skip qualification.

### M8 / D6 / N5 · Distinct smaller script relations

**Quote M8:** initial build.rs rerun, then direct var_os RUSTC --version without wrappers; missing RUSTC or spawn/UTF-8/rustc1-prefix/minor failure returns only the prefix, and child exit status is ignored; an empty RUSTC value still reaches attempted spawn.
Minor>=77 declares check-cfg(no_diagnostic_namespace); minor<78 sets that cfg; no feature guard excludes the body, no explicit direct file write appears and source time/output bounds remain unqualified.

**Zmij D6:1–45:** initial rerun, direct var_os RUSTC --version without wrappers; missing RUSTC prints stderr/exits1, other query/parse failure substitutes MAX without checking child status.
Minor>=80 declares exhaustive, opt_level values("s") and zmij_no_select_unpredictable checks; minor<88 sets zmij_no_select_unpredictable; var_os OPT_LEVEL equal s or z emits opt_level="s".
No direct file write/helper/raw compile/native-link/rustc-env operation is reported in this body; unbounded captured query output, child/native startup and failure effects remain unqualified.

**Getrandom N5:11 lines:** prints build.rs rerun; env::var(CARGO_CFG_SANITIZE).unwrap_or_default() maps missing/non-Unicode to empty; **substring contains("memory")**, not comma membership, sets getrandom_msan.
No backend choice/subprocess/generated file appears in that body; backend RUSTFLAGS/cfg consumers and native entropy implementations remain unread/unqualified.

### N6 · Rustix metadata-dependent backend, compiler probes and ignored deletion

N6:1–281 first emits the rerun line, unwraps readable ARCH/ENV/OS/WIDTH/ENDIAN target variables and retains ABI as a Result; missing/non-Unicode inputs and individual helper sites require separate binding.
std::fs::metadata on relative src/backend/linux_raw/arch/<arch>.rs **follows** metadata and tests is_ok, not source contents, NOFOLLOW or readability; cwd/file/source identity and failure-to-fallback are producer inputs, not absence proof.
Readable-presence is_ok switches for libc/experimental/std/Miri treat empty/0/false as present; this is not libc191's different env_flag rule.
Source selects libc for requested/non-Linux/arch-metadata-failure/unsupported-ABI/Miri/experimental cases, including x32/aarch64-ilp32 and specified big-endian PowerPC/MIPS cases; exact predicates stay anchored at N6, not a selected backend here.

can_compile requires readable RUSTC and uses a nonempty readable RUSTC_WRAPPER prefix with RUSTC first argument, otherwise direct RUSTC; **no workspace wrapper** is applied.
Base arguments are --crate-type=rlib, --emit=metadata, --target TARGET, -o OUT_DIR/rustix_test_can_compile, then encoded flags split on U+001F, then `-`; stdin is piped with writeln probe source and stdout/stderr are null.
Appended flags again require complete emission analysis; the fixed output path can be reused/overwritten and has no exclusive/NOFOLLOW guarantee, while this body does not create OUT_DIR.
Input/spawn/missing-stdin/write/wait unwrap failures panic; wait success=false is not the same outcome as those failures or proof of compiler identity/unsupported semantics.
Reported probe order is conditional core_intrinsics → conditional no-std core_c_str/core_ffi_c/alloc_c_string/alloc_ffi/error_in_core → unconditional NonZeroLowerExp → unconditional diagnostic_attr → conditional WASI probes → backend → ARM/thumb relations.
Libc output branches include conditional linux_raw_dep then libc; raw branches include linux_raw_dep/linux_raw/conditional experimental-ASM cfgs, followed by OS/kernel/thumb/fix_y2038 relations; these are not observed stdout or all effective cfg inputs.
Final rerun-env order is CARGO_CFG_RUSTIX_USE_EXPERIMENTAL_ASM, CARGO_CFG_RUSTIX_USE_LIBC, CARGO_FEATURE_USE_LIBC, CARGO_FEATURE_RUSTC_DEP_OF_STD, CARGO_CFG_MIRI.
The final **let _ = std::fs::remove_file(probe_file())** ignores removal errors; it proves no retained-failure safety or confirmed cleanup and authorizes no local removal.

### N7 · Application libc191 differs from the earlier std-libc178 audit

N7:1–630 starts with the build rerun and LIBC_BUILD_VERBOSE rerun/flag, then mandatory RUSTC version query before CI/target/ABI handling and the removed legacy FreeBSD-override warning.
The reported helper **env_flag(key)** means absent=false, readable exact "0"=false, non-Unicode=panic, every other readable string—including empty/false/FALSE—true; **do not generalize it to every environment read**, whose full call-site bindings remain unenumerated here.
Version handling requires var_os RUSTC, optional nonempty RUSTC_WRAPPER (empty means direct RUSTC), --version and the conditional clippy wrapped query's --rustc before --version; successful status and strict UTF-8/rustc1/minor parsing are required, unlike MAX/permissive-status scripts above.
FreeBSD native query requires target_os=freebsd, no readable CARGO_CFG_LIBC_UNSTABLE_FREEBSD_VERSION override and enabled CI; unavailable/unmatched native version falls back12, values<10 panic and >=15 selects freebsd15.
The emcc/emcc.bat -dumpversion attempt is now **guarded by target_os=emscripten**, unlike178's unguarded path; host Windows chooses the batch filename, failures can yield None and malformed parsing can produce code0.
Reported thresholds30142/40012/50005/60001 affect old-stat-ABI/fsblkcnt-width/sigset-size/nfds-type flags; WIND_RELEASE_ID/VxWorks handling is only partially described, so178 predicates are not transferred.
GNU time parsing of gnu_tb_env occurs **before** the later GNU32 guard: Err defaults32, only32/64 are accepted and other readable values panic even before that guard.
The CARGO_CFG_LIBC_UNSTABLE_TIME64/legacy switch relations differ from178 presence tests; the reported legacy !=0 test must not become generic readable-presence logic, and complete environment/consumer bindings remain OPEN.
For minor>=80 allowed check-cfg names/extra values are declared; collected cfgs are **enum-order sorted, deduplicated, validated/asserted, then emitted**, not178's literal duplicate-preserving sequence or permission to reorder all stdout.
Verbose cargo:warning=info... emission is source output, not observed diagnostics or a whole stderr/native-effect bound; consumers/native #[link] and actual production cfgs remain uninspected.

### Admission challenge · source branches do not waive preservation policy

The public bodies expose **conditional compiler queries/probes, metadata writes, relative following-metadata reads and automatic deletion**; the reported subsets do not close the full effect/call-site/native/ancestor/ABI inventory.
Our **no automatic removal / no retry-rearm / retained ambiguous-prefix** policy remains unchanged: proc-macro2's recursive cleanup and Rustix's ignored deletion are **hard unresolved producer-contract obligations**, not newly admitted behavior.
Legitimate future preaccepted conditional phases must bind their inputs/effects/finite counts/status/error classes/cleanup evidence individually; they never rearm a failed unit or convert a failed spawn into permission to try another representation.
Before any dispatch, a complete independently accepted method must reconcile these branches with protected initial OUT_DIR, exact output/source namespaces, pre-effect debit/liability, whole-tree custody and surviving failure ownership; none is supplied here.
No RUSTC_STAGE/BOOTSTRAP bypass, execution/removal, patch, translator, private/fee-exempt classification, additional root/dependency/schema/hash algorithm, provider/tool/LLVM/staticlib/musl/direct-ld method, tariff/limit/RecipeRef or Gate0 record is selected or accepted.
Host macro DSOs still require genuine metadata/declaration/export/ABI/native-loader validation **before compiler load**; compile-only is not dependency-code-free, and source base flags are not a complete emission contract.
Actual UnitInventory stays **NOT_POPULATED** and all twelve U-* obligations **OPEN**; actual selected contexts, installed availability, licenses/security/economics/physical bounds and full Node/policy/init/FD/original-S0 ingress remain unqualified.
**Latest combined DOCS/METADATA-consistency READY, no remaining findings** (quality **READY TO MERGE: yes**; security **COMBINED DOCS/METADATA CONSISTENCY ONLY**); quality withdrew its supplied-evidence MEDIUM after the already-returned agent-provided nonempty guard was supplied, without refetch or execution. Public fields remain unverified against underlying bytes; no producer/unit/ABI/Gate0 qualification, production readiness, record acceptance or new operation follows.
Necessary PUBLIC TEXT permission continues without per-URL prompts until steered, but grants no further local/body/hash inventory, archive acquisition/materialization, probe/compiler/Cargo/resolver/query/test/package execution, removal, F9 build or training.
All six GNU/source/libc A/B grants remain **SPENT** and LLVM **NOT APPROVED / NOT RUN**; prior C32/libc/metadata records, std178 versus app191 and pkg-config0.3.34's narrow correction remain unchanged.
Preserve N1–N10, Burn/Rust learner tests, full policy/actual-init/Node/reference/FD custody, BOTH-seat **1_048_576-unit DIRECT**, **S0+10s / S0+300s with final3s cleanup**, pre/post-F1 and separately approved **5a AND 5b** before actual output registration/**5c/5d**.
No production/test/probe implementation or evidence/data file was authored, and no captured/package/compiler/probe code was executed in the public-source work; this documentation pass computed no new hash and verified by first-party readback only.
**R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`; DENY before any DAG dispatch.**

## 13 · Optional tooling manifest frontier · digest and YAML provenance

**2026-11-05 · FOUR_PUBLIC_MANIFEST_CALLS_OBSERVED / PRODUCER_CONTRACTS_OPEN · new-delta scoped DOCS/METADATA-consistency READY, no findings; not acceptance or operational permission.**
**[Unverified] Devops-provided PUBLIC_TEXT_OBSERVED fields only; no independent source-byte verification, authenticated hash join or producer/unit acceptance.**

### Bounded batch and exact field-citation targets

Architect `ses_e55bc76b2ffeK7zs71JeNm840B` was consulted before research; devops `ses_e55ba6051ffeSEKpbHhco8rwVC` reports four functions.webfetch TOOL calls, each ONCE, format=text, timeout60.
All returned headings and manifest package.name/version MATCH; no failed branch, retry, substitution or additional tool fetch occurred in this batch.
These are tool-call observations, not physical request/redirect/internal/native counts or accepted caps; no archive/local/binary/authenticated-hash join was established.
The four coordinates already occur in §11's39 authorized lock projections; manifest requirements below are not newly resolved coordinates or selected dependency units.

| ID | Exact initial URL argument | Kind |
|---|---|---|
| T1 | https://docs.rs/crate/sha2/0.10.9/source/Cargo.toml | Manifest. |
| T2 | https://docs.rs/crate/digest/0.10.7/source/Cargo.toml | Manifest. |
| T3 | https://docs.rs/crate/serde_yaml/0.9.34%2Bdeprecated/source/Cargo.toml | Manifest. |
| T4 | https://docs.rs/crate/unsafe-libyaml/0.2.11/source/Cargo.toml | Manifest. |

These IDs cite reported manifest fields, without invented source lines or source-byte hashes.
The research concerns optional tooling/root-context provenance from xtask's sha2="=0.10.9" and serde_yaml="=0.9.34" requirements; workspace membership admits no maintenance crate as an F9/learner root.
No explicit build-script path/helper reference surfaced to justify another fetch within this bounded batch; conventional build.rs paths were not probed.

### T1 · sha2 0.10.9

edition2018; no rust-version field; build=false; autolib/autobins/autoexamples/autotests/autobenches=false.
[lib] declares name=sha2/path=src/lib.rs, with no crate-type or links field; declared tests/mod.rs and benches/mod.rs bodies remain UNREAD.
Normal requirements: cfg-if1.0 and digest0.10.7; the reported aarch64/x86_64/x86 target predicate has cpufeatures0.2 and optional sha2-asm0.6.1.
Dev requirements: digest0.10.7/features=[dev] and hex-literal0.2.2; no build-dependencies table.
Features: default→std→digest/std; oid→digest/oid; asm→implicit optional sha2-asm; asm-aarch64→asm; compress/force-soft/force-soft-compact/loongarch64_asm are empty.
Forwarding is strong, not weak; docs.rs all-features is not project selection. Empty features/build=false prove neither pure Rust nor absence of native/CPU helpers or descendants; no production digest/hash algorithm is selected or changed.

### T2 · digest 0.10.7

edition2018; no rust-version field; package build, [lib], crate-type, auto-target switches and links are MISSING; no explicit exclusion, script read or target scan establishes absence, so script status is **UNKNOWN**, not false.
Normal optional requirements: blobby0.3, block-buffer0.10, const-oid0.9 and subtle2.4/default-features=false; required crypto-common0.1.3. No build/dev/target-dependency tables occur in the reported manifest.
Features: default→core-api→block-buffer; dev→blobby; mac→subtle; oid→const-oid; rand_core→crypto-common/rand_core; std→alloc+crypto-common/std; alloc is empty.
Implicit optional features and strong forwarding are not weak forwarding; docs.rs all-features remains unselected. The exact digest coordinate comes independently from the authorized lock projection, not resolution of T1's requirement.

### T3 · serde_yaml 0.9.34+deprecated

The literal heading/package version MATCH; %2B encodes the plus, not another version. Keep xtask requirement **=0.9.34** distinct from lock/public literal **0.9.34+deprecated**, without normalization, conflict or upgrade inference.
edition2021/rust-version1.64; [lib] contains only doc-scrape-examples=false, with no explicit library name/path/crate-type; build/auto-target switches/links are MISSING and script status is **UNKNOWN**.
Normal requirements: indexmap2.2.1, itoa1.0, ryu1.0, serde1.0.195 and unsafe-libyaml0.2.11; none declares optional=true, default-features=false or explicit dependency feature lists.
Dev requirements: anyhow1.0.79, indoc2.0 and serde_derive1.0.195; no build/target-dependency or features table.

### T4 · unsafe-libyaml 0.2.11

edition2021/rust-version1.56; [lib] contains only doc-scrape-examples=false, without explicit library name/path/crate-type; build/auto-target switches/links are MISSING and script status is **UNKNOWN**.
Only dev pretty_assertions1.0 is declared; no normal/build/target-dependency or features table.
Description `libyaml transpiled to rust by c2rust` is publisher metadata, not inspected C/Rust bodies, native linkage, ABI/FFI proof or an application unsafe/FFI waiver; [lib] alone does not bind a whole library unit without source inventory.
T3/T4 docs.rs GNU-target and --generate-link-to-definition metadata do not establish effective root configuration.

### Unresolved producer boundary and review scope

All four library/test/native/backend/consumer bodies remain UNREAD; T2–T4 missing build declarations leave script environment/query/wrapper/flags/streams/writes/removal/order/failure behavior **UNKNOWN**, not audited negative facts.
T1 build=false disables only its own script; optional assembly/CPU helpers and descendants remain unresolved. Requirements establish no new locked coordinates for cpufeatures/sha2-asm/crypto-common/block-buffer/indexmap/ryu; guessed recursion stopped.
Stop a branch at unknown explicit versions, mismatch or scope boundary, not with a claim that the source graph is closed; architect next-prerequisite suggestions remain advisory, with no human selection or new ledger choice.

[Closure §16](native-ingress-selected-unit-closure-contract.md#16--optional-tooling-provenance-and-unknown-script-contracts) retains the OPEN contracts; canonical §8 remains the sole acceptance ledger and records a RESULT ONLY pointer, not an owed/private/fee-class or method acceptance.
The combined mandatory review is **READY, no findings — SCOPED DOCS/METADATA CONSISTENCY ONLY** for research §13/closure §16/the corresponding canonical delta and narrow earlier-cut chronology/check metadata corrections; prior §§11–12/§§14–15/canonical READY scopes and completed DOC-only checks remain separate.
Source facts remain reported, not independently verified; this verdict provides no independent byte/package/producer/unit/ABI/trust/limit/Gate0 qualification, hash-algorithm selection, acceptance or new authority.

Necessary PUBLIC TEXT permission continues without per-URL prompts; no further local/body/hash/archive/installed/captured read, execution/test, implementation, retry/removal, patch or STAGE/BOOTSTRAP bypass follows.
Proc-macro2's recursive deletion of potentially preexisting outputs and Rustix's ignored remove_file remain hard dispatch blockers under unchanged no-auto-removal/no-retry/retained-prefix policy.
Actual UnitInventory remains **NOT_POPULATED**, all twelve U-* **OPEN**; no selected unit/feature/cfg/profile/source join, full producer, G1/native/ABI/physical/economic or execution-trust qualification is closed.
All §12 protected N1–N10/Burn/Rust/full-policy/Node/init/FD/BOTH-seat DIRECT/original-S0/F1/cleanup/5a AND 5b cuts remain unchanged; all six A/B grants stay SPENT and LLVM unapproved/unrun, without publishing authority.
**R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`; DENY before any DAG dispatch.**

## 14 · Preservation prerequisite · source-deletion challenge

**2026-11-05 · DOC PREPARATION ONLY / PROPOSED / INCOMPLETE / NOT ACCEPTED · scoped DOCS-consistency READY, no findings; not acceptance or operational permission.**
**[Unverified] PUBLIC_TEXT_REPORTED source fields remain reported, not authenticated bytes or qualified producer behavior.**

[Closure §17](native-ingress-selected-unit-closure-contract.md#17--preservation-compatible-producer-obligations) owns the proposed phase/output/failure obligations under the existing logical records, not a replacement method or implementation.
[Canonical §8](native-ingress-rust-first-full-plan-packet.md#8--explicit-acceptance-checklist-preflight-05d--all-open) records the actual **Producer draft (Recommended)** scope choice as document preparation only, not method/record acceptance.
proc-macro2's post-status recursive deletion can precede controller observation and remove preexisting output; late refusal, a fresh directory, external custody or a post-hoc copy alone does not reconcile that conflict.
Rustix's ignored reached-tail removal is not retention/quiescence proof; an earlier panic does not prove the tail ran or cleanup skipped cleanly.
Retain proc-macro2's exact missing/non-Unicode/empty encoded-flags guard; Rustix's unlisted empty-string behavior remains UNKNOWN, not a transplanted guard.
Qualified semantic negatives would require an independently accepted pre-dispatch classifier and distinct preregistered phase; vendor false/spawn failure grants no successor or retry.

The completed mandatory review is **READY, no findings — SCOPED DOCS CONSISTENCY ONLY** for this §14/closure §17/summary223/current canonical delta, including the reviewed per-effect payment/GFM clarifications; source facts remain reported, not independently verified, and deletion/terminal-prefix/paid-custody obligations remain unresolved. Previous four-manifest and24-call READY scopes/checks remain separate and their URL sets unchanged.
This draft adds **new URL calls0 / new local bodies0 / new tests0**; broad necessary PUBLIC TEXT permission continues independently, without a new local/archive/execution/patch/bypass/translator grant.
All twelve U-* remain OPEN and UnitInventory NOT_POPULATED; all prior protected constraints, six SPENT A/B grants and unapproved/unrun LLVM remain unchanged. **R1 NOT FREEZEABLE / Gate0 OPEN / `trainingReady:false`; DENY before any DAG dispatch.**

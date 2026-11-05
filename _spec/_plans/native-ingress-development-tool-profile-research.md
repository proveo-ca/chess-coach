# Development tool profile · prebuilt-artifact research and proposed envelope

**2026-11-05 · AUTHORING + OFFLINE_VERIFICATION_COMPLETE (lead-reported) / QUALITY_SECURITY_REVIEW_READY (code scope only) / REAL_PROVISIONING_NOT_RUN / ACQUISITION_NOT_APPROVED / OPERATIONS_NOT_RUN.**
**[Unverified] Guest observations and public fields below are supplied reports, not independent F9 identity, authenticated package bytes, installed compatibility or qualified methods.**

## 1 · Actual choices and scope

**Historical source-read authoring cut:** This spec pass reads the completed first-party four modules, their four persisted suites, host runner/tests and mise wiring as source text only; no command, import, test/static check, rendering, HTTP, archive/package/installed/cache/evidence/captured read or publication occurred here. The later explicit approval and lead-reported offline results are separate in §2.3; this spec author runs no commands or evidence reads in either pass.
Architect `ses_e534e3b8effeg2aAI0wkjJBuNu` advised before code; DevOps also advised. The contracts below describe authored source, not verified execution or production acceptance.
First-party Bun tooling and minimal guest bootstrap are now integrated for development provisioning, not a private F9 implementation, completed upgrade or selected F9 source assignment.

| Actual question | Exact selected option | Exact option description |
|---|---|---|
| Complete guest toolset | Upgrade provisioning (Recommended) | Implement complete development-tool provisioning and explicit guest PATH handling in the mise workflow, with persisted tests and separate operational approvals. |
| Development tool acquisition | Prebuilt binaries (Recommended) | Research exact upstream binary artifacts and implement approved host acquisition plus offline guest provisioning. No source builds or guest network access. |
| Development storage envelope | Separate larger envelope (Recommended) | Propose 2 GiB per archive, 4 GiB total compressed input, 16 GiB expanded and 200,000 members. Require capacity preflight and retained-artifact accounting; leave legacy limits unchanged. |

These chronological choices authorize CODE/software-proposal preparation, not archive acquisition, installation, VM changes, test execution, accepted physical bounds or package-operation permissions; each later operation still needs its own fresh exact approval.
The primary f9:gate0 checker/finalizer and independently accepted protocol remain OUTSTANDING/unselected; earlier host-helper review and the user-reported previous33b6 cut do not close them or review this delta.

## 2 · User-reported guest gap and authored isolated workflow

The user selected candidate `devrust-19b6330ee5f5e08ad90fcb30` from a reported six-name inventory; only that candidate's read-only metadata is used here, without inventing the other names or a controller/service identity.
Nine reported PATH names PRESENT: tar, sha256sum, timeout, gpgv, patch, make, ld.bfd, readelf, node.
Six reported PATH names MISSING: clang, rustc, cargo, zig, mise, bun; MISSING does not mean uninstalled, and old fixed seeded Rust paths remain uninspected.
These user observations prove no F9-owned process, identity or protected root; the agents' controller still is not on PATH and agents made no actual service calls.

Five authored profile IDs target six executable names: Bun→bun, Rust→rustc/cargo, Zig→zig, Mise→mise, LLVM→clang; the remaining nine baseline prerequisites are not reinstalled by this profile.
The new complete-tools workflow isolates state and private attempts rather than branching the legacy seven-state APIs; legacy receipts/targets, Rust1.95.0/Bun1.4.0 root pins, limits and no-overwrite obligations remain unchanged.
Guest PATH handling must stay scoped to the explicit `/home/agent/workspace/devtools-<16lowerhex>` namespace, not .profile or global PATH; no namespace has been created or inspected by this author.
Authoring is INTEGRATED, not validated provisioning, actual layout extraction, executed Rust assembly or guest execution. The [preparation sequence](../tooling/sbx-dev/preparation-workflow.puml) owns the isolated flow; the [diagnostic sequence](../tooling/native-ingress/f9-diagnostic.puml) owns optional host-runner context. Both coverage/index projections updated at the source-read cut, when rendering remained NOT_APPROVED / NOT_RUN; §2.3 records the subsequent approval/results and pending final status-label recheck.

### 2.1 · Source contracts · AUTHORED, not execution evidence

`mise run dev:sbx:prepare-tools` runs `bun --no-env-file --no-install tooling/sbx-dev/complete-tools.mjs` directly with `raw=true`, `raw_args=true` and no dependencies; the legacy Rust-only task remains unchanged. Initial mode accepts `--name NAME [--sbx ABS]`; explicit next-stage mode accepts `--state ABS/attempt.json --stage STAGE`. Either accepts `--plan`; no yes/force/reset/retry mode exists.
Preview performs lexical parsing only: no explicit source-binding/executable inspection, controller resolution, attempt/state reads or allocation, queries, subprocesses, writes or downloads. Mise loads configuration outside this helper contract; lexical preview is not permission or proof of safe configuration startup.

| Ordered stage | Authored effect / boundary |
|---|---|
| 1 policy | One named `policy ls --wide`; host10s/64KiB; retain private policy text/digest without terminal disclosure. |
| 2 preflight | One guest exec: Linux/x86_64, glibc>=2.18 for the known Mise startup baseline only; nine base names, writable workspace, executable `/usr/bin/xz` and GNU `/usr/bin/tar`, reported free>=24GiB. Guest15s+kill1s; host25s/16KiB. No complete CPU/ABI/runtime qualification. |
| 3 accept-policy | Fresh acknowledgement after reviewing retained policy/preflight; rehash before/after prompt; no provider call, reusable enforcement proof or F9 permission. |
| 4 reserve | One guest exec; guest20s+kill1s, host30s/16KiB. Atomic0700 `mkdir /home/agent/workspace/.complete-dev-tools-v1`, then fresh0700 tool root/inputs and root0400 `.reservation`; refuse an existing marker/root. The fixed marker is irreversible in this workflow; no removal/rearm/overwrite. Exec may start a stopped VM. |
| 5 host-capacity | One `/usr/bin/df -Pk RUN_DIR`,10s/16KiB; reported free>=10GiB. A floor is not a quota or physical-fit guarantee. |
| 6 acquire | Host-only streamed GET of the five declared URLs/digests/sizes below; Rust size stays UNKNOWN but finite. Manual redirects<=3 to the initial host or `release-assets.githubusercontent.com` / `objects.githubusercontent.com`, default HTTPS port; request/body<=120s and whole acquisition<=600s. No retry, source build, host install or guest-network enablement. |
| 7 copy | Exactly nine sequential `sbx cp`, each180s/64KiB: five original archives, Bun bootstrap and profile/archive/guest modules, via exclusive0400 stable-descriptor/hash-bound host snapshots. No checkout, report or import-closure staging. |
| 8 inspect | Hash guest modules and opened bootstrap FD3; chmod0500 and execute that same descriptor. One guest helper invocation; guest1200s+kill2s, host1210s/64KiB/grace1s. Hash all five archives and inspect all before extraction. |
| 9 install | Same separate approval/helper bounds; rehash and reinspect every archive against the prior inspection before the first extraction. Write Bun ZIP data, extract four tar archives to fresh roots, then assemble Rust data-only. |
| 10 verify | Same separate approval/helper bounds; create root-local HOME/mise/Zig directories, check static resource trees, run six genuine version/startup queries and one exact fifteen-name presence query, each10s/16KiB. No compilation/workload or explainer invocation. |

Execution requires stdin AND stderr TTY. Allocate a fresh private0700 `/tmp/opencode/dev-sbx-tools-*` directory and exclusive0600 bound master before the first prompt; each of the ten stage prompts then requires the exact `approve` line before its own intent/effect. Bind name/controller/profile SHA/four source SHAs; recheck state/source/controller/pins after consent. Each stage records exclusive intent before work and completion only after a validated result with unchanged bindings. Same-UID private files remain mutable; stable-descriptor/hash checks do not establish protected backing or G1.
An intent without completion makes failure/timeout/interruption/malformed or ambiguous results terminal **RECONCILE**; neither that stage nor later stages can run. An unattempted next stage is not a retry and needs its own fresh prompt. Retain partial artifacts/reservations/events; no overwrite, fallback, rollback, cleanup, reset, automatic resume or retry.

Host `bunBootstrap()` uses the actual `inspectZipArchive` flat limits and `entries[].path/content` interface, selects exactly root/bun regular ELF content and stores an unexecuted0400 bootstrap. Host and guest currently enforce Bun ZIP **128MiB aggregate AND per entry**, stricter than the general16GiB expanded envelope. ZIP supports store/deflate with CRC and validates-but-ignores UT0x5455/UID0x7875 extras; unknown extras/ZIP64/unsafe metadata fail closed.
Guest tar inspection streams `/usr/bin/xz` output into `TarInspector`, accepting supported USTAR/GNU/local PAX and confined acyclic internal links while refusing sparse/special/privileged/conflicting entries. Native decoding/extraction remains unexecuted. Each artifact must contain a regular notice within its declared root and expected executable/resource layout; **real Bun notice presence is NOT_ESTABLISHED**, and no real archive layout has been inspected.
Install retains `rust-dist` and assembles `rust` from data-only `manifest.in` for rustc, cargo, rust-std-x86_64-unknown-linux-gnu, rustfmt-preview and clippy-preview. Merge directories or byte-identical files only, count additional copies and refuse unsafe/colliding entries; never execute vendor `install.sh`, source builds or compiler workloads.
Guest reports use `profileSha256`, not `profileSha`; require exact schema/action/root/profile and false F9/training authority. `verify` emits `allToolsAvailable:true` only after all six version queries and exact fifteen presence rows pass. Host parsing keeps only narrow safe data and requires that true field for verification. Static tool resources and startup do not qualify licenses, publisher trust, native closure or F9 inputs; guest licensing stays `NOT_QUALIFIED`.

Successful completion would seal0400 `receipt.json`, return **DEV_TOOLS_READY / exit0**, `developmentToolsPrepared:true`, `explanation:NOT_RUN`, `gate0:OPEN`, `f9Qualified:false`, `trainingReady:false`. That is an authored development-only success contract, not an observed result or Gate0 acceptance. No guest checkout/config/import closure/report is staged and the explainer remains NOT_RUN.
Optional host `f9:verify-sbx --tool-root /home/agent/workspace/devtools-<16lowerhex>` selects invocation-only PATH/HOME/mise/Zig context; absent option preserves the legacy script. It performs no trust/global export/.profile edit/auto-install/provisioning. Any actual invocation still requires a separately approved named guest, already staged approved checkout/imports/config/report and accepted startup effects; installed Mise configuration behavior is not confined by these environment settings.

### 2.2 · Persisted verification coverage · final post-fix synthetic suite PASS

| First-party persisted file | Coverage within the lead-reported final731-pass synthetic suite (§2.4), not real package/guest proof |
|---|---|
| `tooling/sbx-dev/tests/complete-profile.test.mjs` | Immutable pins/URLs/digests/limits, unknown Rust size, strict root/context/tool order/version argv and profile mutation/accessor negatives. |
| `tooling/sbx-dev/tests/complete-archive.test.mjs` | Tiny synthetic TAR/ZIP streams, actual returned metadataBytes including ignored ZIP extras, limits, CRC/deflate, paths/links and unsupported-format negatives. |
| `tooling/sbx-dev/tests/complete-tools.test.mjs` | Lexical plan, raw independent task wiring, approval/intent ordering, source drift, capacity, bounded streamed-download fixtures, retained failures, exact copy/helper/report/receipt boundaries. |
| `tooling/sbx-dev/tests/complete-guest.test.mjs` | Guest contracts and mocked-native integration; real-parser aggregate metadata overflow/summed five-archive metadata, implicit-parent union/dedup/Bun-bin counts, aggregate member boundary and1,002-entry/depth200 early rejection at the unchanged200,000 cap. No real upstream archives or new cross-module test file. |
| `tooling/native-ingress/tests/f9-verify-sbx.test.mjs` | New optional exact tool-root parsing, positional scoped context/fake script execution and unchanged legacy mode. Its prior118-test receipt does not cover these additions. |

The integrated tests retain production profile validation and use local synthetic fixture metadata rather than weakening built-in pins/caps. The source-read NOT_RUN cut, §2.3's PRE-BUDGET-FIX pass and §2.4's findings→corrections→final731-pass→fresh READY results are distinct chronological cuts. Earlier commit `33b6ae4483771aa50acb50c909e80f41758391dc` — 118 tests / READY — covers ONLY the prior host-helper scope; publication remains separately unapproved.

### 2.3 · Actual offline approval and lead-reported verification receipt

In **Offline verification approval**, Executor selected **Run offline checks (Recommended)** for synthetic repository Bun tooling suites under120s timeout/+2s kill grace, `check:no-python`, `git diff --check`, renderer help/version discovery and validation/render of the two changed diagrams in fresh `/tmp/opencode` output directories, followed by mandatory read-only quality/security reviews. This is a NEW approval, not retroactive permission from the earlier CODE-only choices; it grants no package download/install, real-archive operation, live SBX, build/training or commit/push.
The lead reports `/usr/bin/timeout --kill-after=2s 120s /usr/local/bin/bun --no-env-file --no-install test scripts/assert-no-python.test.mjs tooling/sbx-dev/tests tooling/sbx-smoke/tests tooling/native-ingress/tests`: first **727 PASS / 1 FAIL / 6,920 expectations / 728 total / 16 files / 40.03s**. The synthetic UTF-8 manifest BOM case exposed default TextDecoder stripping the BOM before the explicit rejection. The lead changed only `parseComponentManifest`'s decoder to `{ fatal:true, ignoreBOM:true }`, preserving the BOM for rejection; the SAME scoped command then returned **exit0 / 728 PASS / 0 FAIL / 6,920 expectations / 16 files / 40.05s**, Bun1.4.0(34cbb9a40). Framework timing is not an F9/native clock; this software correction/rerun rearms no production or A/B grant.
The separately approved bounded `/usr/bin/timeout --kill-after=2s 120s /usr/local/bin/bun --no-env-file --no-install run check:no-python` returned **exit0 / NO_PYTHON=PASS / FIRST_PARTY scope / dependencies allowed / 2,136 files**; `git diff --check` returned **exit0**. These are repository checks, not native-closure, runtime, producer or input qualification.
Renderer discovery reported PlantUML1.2026.6 and `--check-syntax`, `--format svg`, `--output-dir`. Initial two-diagram syntax checking returned200; output in `/tmp/opencode/devtools-verification-9jCzWQts` identified preparation line295 `alt --plan`. The lead changed that label ONLY to `alt lexical plan mode`. Bounded120s `plantuml --check-syntax _spec/tooling/sbx-dev/preparation-workflow.puml _spec/tooling/native-ingress/f9-diagnostic.puml` then returned **exit0**; rendering the SAME two files with `plantuml --format svg --output-dir /tmp/opencode/devtools-verification-jtIuzX4r` returned **exit0**, and the lead's glob confirmed `sbx-preparation.svg` and `f9-diagnostic.svg`. Failed-attempt SVGs remain retained. The renderer fetched the proveo theme under standing public-text permission, not package/native-closure permission; inherited JAVA_TOOL_OPTIONS proxy settings establish no provider identity or accepted F9 clock.
**Final status-label syntax/render recheck REQUIRED:** this receipt pass changes both diagram group labels after those successful renders; the lead must recheck/render the final files in a fresh directory. No runtime/test source is changed by this spec pass. At this verification receipt's original cut both mandatory reviews were running with results **PENDING**: quality `ses_e52bfc5edffegjpJS3Qc6bAS4v`, security `ses_e52bfc5e1ffe1My5mtH2mGnAEQ`; §2.4 records the subsequent security result separately. The new scope remains uncommitted/unpublished with no publication permission, no actual guest DEV_TOOLS_READY and no Upgrade Complete claim.

### 2.4 · Budget review chronology · corrections verified and both code reviews READY

Original security `ses_e52bfc5e1ffe1My5mtH2mGnAEQ` returned **READY TO MERGE: no** with two MEDIUM/CWE-770 findings: reviewed guest line560 charged JSON inventory lengths instead of parser-encoded metadata across archives, and line564 omitted implicit materialized parents. Original quality `ses_e52bfc5edffegjpJS3Qc6bAS4v` also returned **READY TO MERGE: no**, grading implicit members HIGH and metadata MEDIUM. The earlier728-pass/render receipt and the correction-PENDING cut remain dated history, not acceptance or current post-fix status.
The lead completed the source corrections within unchanged production pins/caps. `TarInspector.finish()` and `inspectZipArchive()` now return actual `metadataBytes` counters; pure `accountMetadataBytes(current, added, cap=256MiB)` validates safe integers/cap and debits each parser result once, while each next parser receives the remaining SHARED budget. `validateArtifactLayout` counts max(encoded members, unique materialized destinations), including explicit/implicit parents, each fresh package root and Bun relocation/bin. Destination-union and stripped-link-directory guards reject over200,000 entries early; all five inspections and aggregate accounting precede ANY extraction, preserving extra Rust/control accounting. These interfaces and guards were source-read in this spec pass; no source/tests were changed here.
New synthetic regressions cover actual TAR/ZIP counters including ignored extras; individually fitting parser metadata whose sum exceeds a small shared cap; five actual synthetic guest inspections reporting the exact sum; implicit-directory union, explicit dedup, Bun/bin, aggregate member boundary and1,002 encoded entries at depth200 rejected before materialization at the real200,000 cap. Small pure-helper/test caps do not override built-in production validation or establish actual upstream/native guest behavior.
Under the SAME approved120s/+2s command recorded in §2.3, the lead reports post-fix **exit0 / 730 PASS / 0 FAIL / 6,940 expectations / 16 files / 40.08s**, then after early guards/deep-directory regression **final exit0 / 731 PASS / 0 FAIL / 6,942 expectations / 16 files / 40.19s / Bun1.4.0(34cbb9a40)**. No runtime/test source changed after731. Final-code/docs `check:no-python` passed2136 first-party files and `git diff --check` passed; two-diagram syntax checking after the previous budget labels returned0. Framework times are not F9 clocks; no production/A/B grant is rearmed.
Fresh quality states **“Both findings are closed; no new development-code findings. READY TO MERGE: yes”**. Fresh security states both findings closed by static inspection, no remaining code-scope security findings, **“READY TO MERGE: yes — code scope only.”** Security did not execute tests; test results are lead-reported. Security retains a **LOW follow-up** for actual disk/inode enforcement at the guest filesystem boundary; software limits/df floors prove no hard quota, native closure, publisher trust, accepted F9 input/method/limit or provisioning permission.
**Current: AUTHORING + OFFLINE_VERIFICATION_COMPLETE / QUALITY_SECURITY_REVIEW_READY (code scope only) / REAL_PROVISIONING_NOT_RUN.** The lead's final bounded120s `plantuml --check-syntax` of both named diagrams returned0. Final SVG rendering with `--format svg --output-dir /tmp/opencode/devtools-verification-tou3VF68` returned0; glob confirmed both `sbx-preparation.svg` and `f9-diagnostic.svg`. Final `git diff --check` returned0. No runtime/test or diagram source changed afterward; only these outcome records changed. Retain every previous failed/successful output directory unchanged. The development-code upgrade loop is complete; actual guest DEV_TOOLS_READY, Gate0 closure, real-package/guest operations and publication remain unapproved/unobserved. The delta remains uncommitted/unpublished; this result accepts no F9 record or operational grant.

**New publication-choice follow-up:** After the final731-pass checks/render/diff and both code-scope READY reviews, Executor explicitly instructed **`commit & push`** for this current task's exact18-file envelope; this NEW authorization supersedes ONLY earlier publication-unapproved statements at their pre-choice cuts, without reusing the old33b6 grant. [Canonical §8](native-ingress-rust-first-full-plan-packet.md#8--explicit-acceptance-checklist-preflight-05d--all-open) records the target/scoped normal HTTPS publication plan and exclusions; publication-scope security `ses_e52bfc5e1ffe1My5mtH2mGnAEQ` returned **READY PUBLICATION: yes — listed18 files only**, with no publication-blocking findings. No commit/push has run at this receipt cut, and no package/guest/live build/training permission or F9-record acceptance follows; actual publication outcome belongs to Git history and the lead's response.

## 3 · Exact prebuilt candidates · metadata declarations, not accepted inputs

| Tool/version | Exact candidate artifact URL | Declared compressed bytes | Declared SHA-256 | Proposed root; not observed members |
|---|---|---:|---|---|
| Bun1.4.0, unchanged | https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-linux-x64-baseline.zip | 36,697,583 | `184fb4595f0d401a217cf7c78c1bc430ba83314dab7a8b94805babbf7fa7097f` | ASSERTION: bun-linux-x64-baseline |
| Rust1.95.0, unchanged GNU x64 full bundle | https://static.rust-lang.org/dist/2026-04-16/rust-1.95.0-x86_64-unknown-linux-gnu.tar.xz | UNKNOWN; manifest has no size | `2e0338f18ecbaa4a0f631b9e80e8b8e26bb6fe77dd5454fba8a70cf96c1e84a1` | ASSERTION: rust-1.95.0-x86_64-unknown-linux-gnu |
| Zig0.17.1 | https://ziglang.org/download/0.17.1/zig-x86_64-linux-0.17.1.tar.xz | 57,411,036 | `3581863e3cbcfd0fce0efc682ce7e9e93da96668a977791d356a26d2a7e9b17a` | ASSERTION: zig-x86_64-linux-0.17.1 |
| Mise2026.11.2 / tag v2026.11.2 | https://github.com/jdx/mise/releases/download/v2026.11.2/mise-v2026.11.2-linux-x64.tar.xz | 35,899,236 | `9a1fedb31299e896d833dc49e6d6cfcb44aba138c6fc3562d8ee63ea6ab888c5` | SOURCE-PACKAGING declaration: mise |
| LLVM23.1.5 / tag llvmorg-23.1.5 | https://github.com/llvm/llvm-project/releases/download/llvmorg-23.1.5/LLVM-23.1.5-Linux-X64.tar.xz | 2,014,093,084 | `f72edb0b36580ece7f52e23858f00c18fad4e87395ea7ad05d7e55c39f8fc78a` | ASSERTION: LLVM-23.1.5-Linux-X64 |

The lead reports pure64-lowercase-hex shape checks PASSED for all five digest strings only; no package-byte hashing, signature/publisher authentication or independently accepted EXPECTED input follows.
Bun's GitHub API asset digest is metadata, not source-byte authentication; reported old tag commit34cbb9a40b4bd1bd767d134a7065e66c2432a676/published2026-08-20 preserves the unchanged version. GNU baseline CPU/kernel/libc compatibility remains UNKNOWN; no musl fallback is selected.
Rust pkg.rust reports available=true for the full bundle; its source components/merged sysroot/member layout remain uninspected, and vendor install.sh execution is not selected. The HISTORICAL manifest-only observation is848,342 bytes/SHA-256 `821ff14e4c4a1cbe1e8915f35aff0a3fbbdf8d293ad48ab8f31e3b0440c581f9`, not the archive size or archive digest above; no component-hash substitution is needed or admitted.

Zig's fresh JSON supplies exact bytes/digest; HTML55MiB is rounded and minisig is not a SHA value. Actual GNU baseline, DSO/runtime requirements and notices remain unqualified.
Mise's tagged source packaging declares bin/mise, README/LICENSE/man/fish entries, not observed archive contents; installing documentation states GNU dynamic glibc>=2.18, without a host-version query. Packaging's ET_EXEC check is source text, not inspected binary evidence or an F9 static-PIE output; API publication2026-11-05T12:19:06Z is non-draft/non-prerelease.
LLVM's source workflow declares Linux/X64 basename and Ubuntu22.04 build host, not minimum runtime libc/CPU compatibility; release CMake reports clang/compiler-rt/libcxx/openmp/flangrt/libcxxabi/unwind. Actual resource/member trees and archive notices remain uninspected; Apache with LLVM exceptions/NCSA/third-party provisions are source prose, not legal qualification. API publication2026-11-03T21:35:47Z is non-draft/non-prerelease.

## 4 · Separate proposed software envelope · no physical fit established

The selected proposal is2GiB per archive/4GiB total compressed input/16GiB expanded/200,000 members, with capacity preflight and retained-artifact accounting; legacy limits remain unchanged.
Authored256MiB encoded-inventory metadata is not RSS; Bun ZIP128MiB total/per-entry is another software control, not an accepted F9 numerical ceiling.
The known four non-Rust compressed sizes total2,144,100,939 bytes, leaving3,382,709 bytes below the old shared2GiB BEFORE unknown Rust; neither old-envelope fit nor the new proposal's full fit is established.
The authored16GiB/200,000-member accounting includes bootstrap/source/control reserve and retained `rust-dist` plus additional assembled Rust copies. Retain compressed originals and snapshots separately; snapshots add at most4GiB+128MiB+768KiB beyond originals. Guest retains compressed inputs as well as counted expanded data. Host10GiB/guest24GiB df-reported floors are not quotas, RSS bounds, allocated-capacity/overlap guarantees or full-fit proof; no physical maximum, debit, invoice or tariff is accepted.

## 5 · Separate public-source receipts · no aggregate request count

These are supplied request/field observations; archive URLs above are candidates, not artifact GET receipts. Public source code is DATA, not installation instructions; no unprovided field spans, retries, clocks or authentication are invented.
A–D retain different tool/GET counts and fetch settings; none measures physical requests/redirect/native effects or accepted output bounds, and no explicit HTTP deadline was reported.

### A · Devops advisory · ten requested URLs

Agent `ses_e534e3b83ffeoMhbieGMJEoJuz`: ten requested URL GETs, each once, CodeMode fetch/redirect=manual/no explicit HTTP timeout; GitHub API Accept=JSON.

| Exact requested URL | Result at this cut |
|---|---|
| https://raw.githubusercontent.com/jdx/mise/main/registry.toml | 404 STOP. |
| https://raw.githubusercontent.com/jdx/mise/main/src/plugins/core/bun.rs | 200, inspected reported source. |
| https://raw.githubusercontent.com/jdx/mise/main/src/plugins/core/rust.rs | 200, OUTPUT_TRUNCATED; not qualified. |
| https://raw.githubusercontent.com/jdx/mise/main/src/plugins/core/zig.rs | REQUESTED; result NOT_VISIBLE. |
| https://ziglang.org/download/index.json | REQUESTED; result NOT_VISIBLE at this cut. |
| https://mise.jdx.dev/registry.html | 200; registry declarations observed. |
| https://api.github.com/repos/mise-plugins/mise-llvm/contents/bin | 200. |
| https://raw.githubusercontent.com/mise-plugins/mise-llvm/main/bin/install | 200. |
| https://raw.githubusercontent.com/mise-plugins/mise-llvm/main/lib/utils.bash | 200; source-build/deletion relations reported. |
| https://mise.jdx.dev/dev-tools/tool-versions.html | 404 STOP. |

Registry text reports core bun/rust/zig and clang conda/asdf mise-llvm/vfox choices, not an aqua-qualified backend. The mise-llvm source uses CMake/Ninja/strip and deletes downloads; that backend is NOT SELECTED for this prebuilt/no-source-build direction.

### B · LLVM source frontier · four tool calls, five GETs

Agent `ses_e533a292bffeFA2TkXRAEHuuqN`: four TOOL calls/five GETs, all200; explicit GET/redirect=error/no explicit HTTP deadline, API Accept=JSON; latest discovery fixed the reported tag before its four raw-source requests.

| Exact URL | Reported field basis |
|---|---|
| https://api.github.com/repos/llvm/llvm-project/releases/latest | Discovery then llvmorg-23.1.5 metadata/asset declarations. |
| https://raw.githubusercontent.com/llvm/llvm-project/llvmorg-23.1.5/.github/workflows/release-binaries.yml | Linux/X64 naming and build-host relation. |
| https://raw.githubusercontent.com/llvm/llvm-project/llvmorg-23.1.5/clang/cmake/caches/Release.cmake | Reported enabled projects/runtimes. |
| https://raw.githubusercontent.com/llvm/llvm-project/llvmorg-23.1.5/llvm/CMakeLists.txt | Source build context only. |
| https://raw.githubusercontent.com/llvm/llvm-project/llvmorg-23.1.5/llvm/LICENSE.TXT | Source license prose only. |

### C · Portable-tool source frontier · six GETs

Agent `ses_e5339b118ffeTVvOwJzed01TBL`: six GETs/all200, explicit GET/credentials=omit/redirect=error/no explicit HTTP deadline; selected fields before tool return are not a native/response-output bound.

| Exact URL | Reported field basis |
|---|---|
| https://ziglang.org/download/ | Release page; rounded HTML size, not exact bytes. |
| https://api.github.com/repos/jdx/mise/releases/latest | Discovery then v2026.11.2 metadata/asset declarations. |
| https://api.github.com/repos/jdx/mise/git/trees/v2026.11.2?recursive=1 | Tagged source-tree metadata, not artifact members. |
| https://ziglang.org/documentation/0.17.1/ | Documentation, not inspected native linkage. |
| https://raw.githubusercontent.com/jdx/mise/v2026.11.2/scripts/build-tarball.sh | Source177–207 packaging;166–173 ET_EXEC check. |
| https://raw.githubusercontent.com/jdx/mise/v2026.11.2/docs/installing-mise.md | Source142–148 glibc statement. |

### D · Fresh exact metadata fields · three GETs

The same portable agent reports three GETs/all200, explicit GET/redirect=error/credentials=omit/no explicit HTTP deadline, without retry or substitution.

| Exact URL | New field result |
|---|---|
| https://api.github.com/repos/oven-sh/bun/releases/tags/bun-v1.4.0 | Exact baseline ZIP bytes/API digest and tag metadata. |
| https://static.rust-lang.org/dist/channel-rust-1.95.0.toml | Full-bundle available/URL/hash; no size field. |
| https://ziglang.org/download/index.json | Exact0.17.1 x86_64-linux bytes/hash/URL. |

Bun/Rust were deliberate new source-field passes of previously successful metadata under broad public permission, not failed-operation retries; A's unobserved Zig history stays unchanged while D adds a new visible result. Known404 STOP URLs were never refetched.

## 6 · Open qualification and current disposition

No real archive payload/checksum-sidecar GET, member inspection, package-byte authentication, install or guest change is approved or performed in this new scope; archive/runtime/layout/license compatibility remains NOT_INSPECTED / UNQUALIFIED. Only the separately approved synthetic offline checks/results in §2.3 advance verification status.
Unknown formats/roots, unsafe entries, capacity or version failures must be TERMINAL; no automatic fallback, nearest-source substitution, source build, guest network enablement, cleanup or retry is selected.
No publisher key/trust/ABI/method/class/tariff/Gate0 source assignment is accepted; assertions about roots and members require later separately approved inspection, not promotion from these metadata fields.
Current status is AUTHORING + OFFLINE_VERIFICATION_COMPLETE / QUALITY_SECURITY_REVIEW_READY (code scope only): §2.4 records final731-pass results and both fresh READY verdicts after the original findings/corrections. Final two-diagram syntax/render and diff checking remain required after these spec edits. Acquisition, real package/guest operations and publication still need separate exact approvals; software/df checks establish no actual hard quota or F9 acceptance.
Broad necessary PUBLIC TEXT permission continues independently; this pass grants no new local/archive/cache/installed/captured access or publication, and it authorizes no package operation by describing its future approval boundary.

[Canonical §8](native-ingress-rust-first-full-plan-packet.md#8--explicit-acceptance-checklist-preflight-05d--all-open) remains the sole acceptance ledger; this research is a result pointer, not a second ledger or ACQUISITION_APPROVED profile. All twelve U-* remain OPEN and UnitInventory NOT_POPULATED.
All six GNU/source/libc A/B grants stay SPENT; the older LLVM-reference operations remain NOT APPROVED / NOT RUN and are separate from this development LLVM23 candidate, not rearmed or silently replaced.
Preserve N1–N10, Burn/Rust learner tests, full policy/Node/reference/actual-init/FD contracts, inclusive BOTH-seat **1_048_576-unit DIRECT**, original **S0+10s / S0+300s with final3s cleanup**, pre/post-F1 and separately approved **5a AND 5b** before actual output registration/**5c/5d**.
**AUTHORING + OFFLINE_VERIFICATION_COMPLETE / QUALITY_SECURITY_REVIEW_READY (code scope only) / REAL_PROVISIONING_NOT_RUN / ACQUISITION_NOT_APPROVED / OPERATIONS_NOT_RUN · R1 NOT FREEZEABLE / Gate0 OPEN / `f9Qualified:false` / `trainingReady:false`; not Upgrade Complete, no F9 closure or package/guest operational grant.**

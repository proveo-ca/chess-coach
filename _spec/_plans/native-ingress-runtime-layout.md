# Unified SDK runtime — selected planning boundary

**Planning only.** The user selected the unified SDK runtime proposal.
This selection authorizes no copying, provider probe, image import, container job, compiler execution or change to the frozen verification harness.
Step2 and training readiness remain incomplete.

## Identity and placement

Use only accepted GNU evidence `_spec/tooling/native-ingress/gnu-evidence-collection-v1.result.json`,2829942 bytes/SHA-256 `01c24e73a65148b8a70c3c1d4034f86dcac8040859bc206b5cf40b784776cc22`, as the source of the following candidate identities.
All eight records currently have domain:TARGET.
Propose separate additional HOST-role records with qualificationStatus:UNRESOLVED, candidateOnly:true, allowedForExecution:false and hostTargetPromotion:false.
Preserve every existing TARGET identity/status and all seven earlier HOST observations unchanged.
Exclude the earlier HOST candidates from this proposed compiler-image runtime, not from their separately scoped historical decoder evidence.

The SDK's79-byte sdk-location text/SHA-256 `e4df82547e211e82635d37dc97cd4bce2f5d941aebb24717a32b242811ea052f` declares the image-internal prefix:

`/builds/buildroot.org/toolchains-builder/build/x86-64--glibc--stable-2026.08-1`

The terminating LF belongs to the text, not the pathname.
Preserve GNU payload bytes at that proposed prefix without relocation scripts or binary patching.
This is not a host-path mount and proves no wrapper/search/sysroot behavior.

## Runtime candidates

Source paths below are relative to `x86-64--glibc--stable-2026.08-1/x86_64-buildroot-linux-gnu/sysroot/`.
Proposed root-image destinations preserve those relative paths beneath `/`.
The same bodies also remain identified at their original SDK sysroot paths.
No destination is created or qualified by this table.

| Index | Source/destination-relative path | Body offset | Bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| 5971 | lib/libm.so.6 | 389391872 | 1412648 | `081d4d2362dc9324ada7f235369952de1a5960377ee9f0af073a12e8cd21d1b6` |
| 5972 | lib/libdl.so.2 | 390805504 | 15784 | `d0d9666f6da59ad3fa643b00095b318d77fc4271ca4772a3062c51887fe749dd` |
| 5973 | lib/libmvec.so.1 | 390821888 | 1080688 | `9e2da73418d729805dbf935a0308d509344a99a66cae93f9ab0fd2fb885ccb15` |
| 5977 | lib/libpthread.so.0 | 392000000 | 16640 | `dd72cec0862705dc8557377be5d9325d26b3dabd14da43226725191b39171061` |
| 5980 | lib/librt.so.1 | 392103936 | 16480 | `111147dfa6713dec4fa0e588baf8c6d3613f8262d69e0edaed7e1dc683401fdd` |
| 5982 | lib/libc.so.6 | 392137216 | 2465144 | `2f28657b863c21d453a38041a1dcca5da52509eec9e3c85011fdd7c9c5059bcd` |
| 5983 | lib/ld-linux-x86-64.so.2 | 394603008 | 271544 | `ed2a1c25c4eee13da89c22883b47e4641b9e4dc1b6227a490fbc4d1f12429bac` |
| 5993 | lib/libgcc_s.so.1 | 395318784 | 904616 | `c9423c69c09459abfb446a83392f6a2461fd46e392d738f0f08af5e161e344aa` |

The eight bodies total6183544 bytes.
Their presence and primary version declarations prove neither HOST usability nor symbol/private-ABI/loading compatibility.
The libgcc candidate is not glibc; retain its separate identity and obligations.

## Inert alias proposal

The accepted namespace records sysroot/lib64 at index516 as a relative symlink to `lib`, and sysroot/usr/lib64 at index4121 as a relative symlink to `lib`.
Neither link was followed during collection.
Propose the corresponding image-root `/lib64 -> lib` and `/usr/lib64 -> lib` aliases only through a separately approved bounded namespace map.
The intended default interpreter `/lib64/ld-linux-x86-64.so.2` would resolve to the recorded loader candidate through that map; no actual resolution is asserted.
Do not invent Debian multiarch destinations or copy ambient host-library directories.

## Required closure before materialization and execution

1. Freeze explicit role-specific candidate/member/alias maps, provenance and source/license context, including GNU-private headers, sysroot/linker inputs, Rust components and required helper paths.
2. Keep old provider records intact; independently qualify additional HOST use of the exact eight SDK bodies without treating TARGET membership or matching version names as authority.
3. Close the full rootfs/executable/data/NoPython graph and active Cargo sources/checksums/licenses/build-script/proc-macro graph; no runtime acquisition fallback is permitted.
4. Admit exact fresh staging roots and immutable image content, daemon-host path mapping, numeric identity, explicit memory/CPU/PID/swap limits, filesystem/socket/network/exec policy and independent original-clock/descendant-cleanup controls.
5. Under separately admitted containment and fixture scopes, verify actual HOST tools/driver/LLVM, symbol/private-ABI loading, wrapper/helper/sysroot searches and TARGET execution through the default interpreter.
6. Run the unchanged frozen/offline verification harness with shipped Rust LLD and unchanged compiler flags, Rust1.95/Burn0.22/defaults-off/std-flex-optim-store/Flex CPU-f64.

No full reproducible GCC rebuild becomes an invented prerequisite for ordinary Step2.
Actual observed context does not establish full source authentication or legal compliance.
Keep sourceAuthenticated, publisherAuthenticated, copyAuthorized, hostProvidersQualified, symbolBindingsVerified, abiVerified, pythonFreeSubsetVerified, imagePrepared, nativeQualified, rustReady and trainingReady false until their own applicable gates pass.

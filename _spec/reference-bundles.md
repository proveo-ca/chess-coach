# C14: standard pinned Bun reference bundles

Status: PINNED BUN BUNDLES SELECTED / DEVELOPMENT BUILD AND FIXTURE CHECKS / NO FINAL CAPTURE OR IMAGE BUILD.

Executor selected `Pinned Bun bundles` in C14.
Keep the original reference read-only.
`tooling/reference-entrypoints.json` selects six exact source entrypoints from the pinned reference.
`tooling/build-reference.ts` invokes the installed pinned Bun CLI with no environment-file loading, no automatic installation and unresolved dynamic imports rejected.
It uses standard bundler metadata, filesystem APIs and SHA-256 to inventory selected source/package bytes and built outputs separately.
It implements no replacement module resolver, compiler or authorization registry.

Produce JavaScript modules at the existing six fixed `/app/reference/.../*.ts` paths.
The `.ts` suffix preserves the adapter paths; the registered content is a standard Bun-generated JavaScript module, not claimed to be the original source bytes.
Preserve the corpus manifest/source at their existing fixed reference-root paths.
Keep the native/reference proof adapter and all current game code outside the old-source bundle input graph.
Register build inputs and physical output bytes independently before qualification.

The old workspace's `pnpm-lock.yaml` remains provenance for its selected third-party packages.
It is not the current workspace's Bun lockfile.
The selected old-source/package input tree must be captured and registered explicitly under a separate capture grant.
Do not copy a broad development cache, rewrite the old lockfile or silently run a new online installation.
No pnpm tool or dependency cache ships in the final runtime.
The offline Bun build must fail on any absent selected package or unresolved import.

The development fixture builds six temporary bundles from the read-only reference and checks named exports, original init/open/pass fingerprints, both frozen strategic opening fingerprints and the existing corpus audit.
Those bounded in-process checks establish neither final-base loading nor a cold confined F9 proof.
Final strategic behavior, runtime loading and source/output expectations remain independently checked qualification obligations.

# Tooling language policy

Write first-party automation and tests in Bun or Rust; existing shell entrypoints remain supported. Do not add first-party Python scripts, bytecode, interpreter calls or Python project manifests.

Python inside dependencies is allowed, including Burn dependencies and the LC0/Meson Docker build. The policy does not uninstall host tools or prohibit upstream build systems.

```fish
bun run check:no-python
bun run test:tooling
```

`check:no-python` scans tracked and untracked first-party files, including hidden source and ignored scratch source. It rejects Python file extensions, dependency declarations and static interpreter/package commands. Docker package-install declarations may list Python as a dependency; direct Python commands still fail. The check excludes installed dependencies, vendored third-party directories (`vendor`, `third_party`, `third-party`), generated output/cache directories, Git internals and historical prose. It does not inspect secret files or prove the behavior of arbitrary external executables or dynamically constructed commands.

CI runs the policy check before its existing checks. The offline tooling tests use fake provider executables; they do not invoke a real sandbox, build the Rust learner or establish F9/training readiness.

## Live F9 diagnostic

[`f9:diagnose`](native-ingress/F9-DIAGNOSTIC.md) reports live development-sandbox observations alongside the full F9 blocker ledger. Its fresh-box workflow requires separate creation and diagnostic approvals. Diagnostic completion never grants F9 or training readiness.

[`dev:sbx:prepare`](sbx-dev/README.md) composes mise-pinned online **host** acquisition, validation, creation, policy review, provisioning, offline **guest** installation and diagnosis. It generates the archive/checksum and box name automatically and pauses for fresh approval at each stage.

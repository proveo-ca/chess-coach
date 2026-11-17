# Operator HOST facts — publication candidate

Run **only `operator-command-2.sh`**, once, after the lead confirms this candidate's publication to PR #51.
Generation one is historical and must not run.

Use **Bash**, not direct Fish single-quote expansion.
The complete command embeds the exact standalone TypeScript source and requires no project-source imports or package installation.

From exactly `/home/gu1lty/Projects/proveo/chess-coach`, paste the complete published `operator-command-2.sh` command into Bash.
If that published file is already available locally, run:

```bash
bash /absolute/path/to/operator-command-2.sh
```

Return its single JSON result, including `PARTIAL` or `DEADLINE` results and nonzero exit codes.
Exit code 2 means output could not finish within the original controlled-main budget.
Do not rerun automatically.

The query uses 11 fixed groups, a 30-second controlled-main budget, and a 128-KiB final-output cap.
It makes read-only image, named-path, cached Bun-version, selected GPU-memory, and disk observations.
It launches no containers, project-native binaries, GPU kernels, or training.
The assistant has not executed it against the HOST.

`FULL` means the named observations completed.
It establishes neither runtime compatibility nor `trainingReady: true`.

// SPEC: _spec/gpu-input-transfer.puml
const bootstrapDirectory = "_work/gpu-owner-recovery/runs/host-input-bootstrap-1";
const receiptPath = "_work/gpu-owner-recovery/runs/host-input-receive-1/receipt.json";
export const quoteFish = (value: string) => `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
const quote = quoteFish;

function renderReceive(commit: string, helperSha256: string, run2: boolean): string {
  if (typeof commit !== "string" || commit.length !== 40 || !/^[0-9a-f]{40}$/.test(commit)) throw Error("INVALID_SOURCE_COMMIT");
  if (typeof helperSha256 !== "string" || helperSha256.length !== 64 || !/^[0-9a-f]{64}$/.test(helperSha256)) throw Error("INVALID_HELPER_SHA256");

  const outputDirectory = run2 ? "_work/gpu-owner-recovery/runs/host-input-bootstrap-2" : bootstrapDirectory;
  const outputReceipt = run2 ? "_work/gpu-owner-recovery/runs/host-input-receive-2/receipt.json" : receiptPath;
  const grant = run2 ? "--approved-host-receive-2" : "--approved-host-receive-1";
  const body = [
    "set -gx MISE_AUTO_INSTALL false",
    "set -gx MISE_TASK_RUN_AUTO_INSTALL false",
    "set -gx GH_PROMPT_DISABLED 1",
    "set -gx GH_DEBUG ''",
    `set -g bootstrap ${quote(outputDirectory)}`,
    'printf \'\' > "$bootstrap/bootstrap.stdout" 2> "$bootstrap/bootstrap.stderr"; or begin; printf \'%s\\n\' \'BOOTSTRAP_LOG_FAILED\' >&2; exit 1; end',
    'function bootstrap_fail; printf \'%s\\n\' "$argv[1]" >&2; printf \'%s\\n\' "$argv[1]" >> "$bootstrap/bootstrap.stderr"; exit 1; end',
    'function bootstrap_note; printf \'%s\\n\' "$argv[1]"; printf \'%s\\n\' "$argv[1]" >> "$bootstrap/bootstrap.stdout"; or bootstrap_fail \'BOOTSTRAP_LOG_FAILED\'; end',
    "bootstrap_note 'BOOTSTRAP_STARTED'",
    'for tool in bun gh tar sha256sum timeout fish wc mkdir cat; command -sq "$tool"; or bootstrap_fail \'HOST_TOOL_MISSING\'; end',
    'command bun --version > "$bootstrap/bun-version.stdout" 2> "$bootstrap/bun-version.stderr"',
    "set -l bun_status $status",
    'printf \'%s\\n\' $bun_status > "$bootstrap/bun-version.exit"; or bootstrap_fail \'BUN_EXIT_RECEIPT_FAILED\'',
    "test $bun_status -eq 0; or bootstrap_fail 'BUN_VERSION_FAILED'",
    'set -l bun_version (string collect < "$bootstrap/bun-version.stdout")',
    'test "$bun_version" = \'1.4.0\'; or bootstrap_fail \'BUN_VERSION_MISMATCH\'',
    `command timeout --signal=TERM --kill-after=5s 55s gh api --hostname github.com --method GET --header ${quote("Accept: application/vnd.github.raw+json")} ${quote(`repos/proveo-ca/chess-coach/contents/_work/gpu-owner-recovery/qualification/host-receive/receive.ts?ref=${commit}`)} > "$bootstrap/receive.ts" 2> "$bootstrap/gh-fetch.stderr"`,
    "set -l fetch_status $status",
    'printf \'%s\\n\' $fetch_status > "$bootstrap/fetch.exit"; or bootstrap_fail \'FETCH_EXIT_RECEIPT_FAILED\'',
    'bootstrap_note "FETCH_EXIT=$fetch_status"',
    "test $fetch_status -eq 0; or bootstrap_fail 'FETCH_FAILED'",
    'test (command wc -c < "$bootstrap/receive.ts" 2> "$bootstrap/helper-size.stderr") -le 131072; or bootstrap_fail \'HELPER_SIZE_LIMIT\'',
    `printf '%s  %s\\n' ${quote(helperSha256)} "$bootstrap/receive.ts" | command sha256sum --check --status > "$bootstrap/helper-hash.stdout" 2> "$bootstrap/helper-hash.stderr"`,
    "set -l hash_status $pipestatus",
    'printf \'%s\\n\' $hash_status[2] > "$bootstrap/helper-hash.exit"; or bootstrap_fail \'HASH_EXIT_RECEIPT_FAILED\'',
    "test $hash_status[1] -eq 0; or bootstrap_fail 'HELPER_HASH_INPUT_FAILED'",
    "test $hash_status[2] -eq 0; or bootstrap_fail 'HELPER_HASH_MISMATCH'",
    "bootstrap_note 'HELPER_HASH_VERIFIED'",
    `command bun --no-env-file --no-install "$bootstrap/receive.ts" ${grant} ${quote(commit)} > "$bootstrap/receive.stdout" 2> "$bootstrap/receive.stderr"`,
    "set -l receive_status $status",
    'printf \'%s\\n\' $receive_status > "$bootstrap/receive.exit"; or bootstrap_fail \'RECEIVE_EXIT_RECEIPT_FAILED\'',
    'bootstrap_note "RECEIVE_EXIT=$receive_status"',
    'command cat -- "$bootstrap/receive.stdout"; command cat -- "$bootstrap/receive.stderr" >&2',
    `if test -f ${quote(outputReceipt)}; command cat -- ${quote(outputReceipt)}; or bootstrap_fail 'RECEIVER_RECEIPT_READ_FAILED'; end`,
    "exit $receive_status",
  ].join("; ");
  const checked = run2
    ? `set -gx MISE_AUTO_INSTALL false; set -gx MISE_EXEC_AUTO_INSTALL false; set -gx MISE_TASK_RUN_AUTO_INSTALL false; command -sq mise; or exit 1; set -l program ${quote(body)}; fish --no-config -n -c "$program"; or exit $status; mise exec core:bun@1.4.0 core:rust@1.95.0 -- fish --no-config -c "$program" < /dev/null`
    : `set -l program ${quote(body)}; fish --no-config -n -c "$program"; or exit $status; fish --no-config -c "$program"`;
  const parent = `set -l bootstrap ${quote(outputDirectory)}; command mkdir -- "$bootstrap"; or begin; printf '%s\\n' 'BOOTSTRAP_DIRECTORY_NOT_CREATED' >&2; exit 1; end; timeout --signal=TERM --kill-after=5s 895s fish --no-config -c ${quote(checked)}${run2 ? ' > "$bootstrap/worker.stdout" 2> "$bootstrap/worker.stderr"' : ""}; set -l host_status $status; printf '%s\\n' $host_status > "$bootstrap/command.exit"; or exit 1; ${run2 ? 'command cat -- "$bootstrap/worker.stdout"; command cat -- "$bootstrap/worker.stderr" >&2; ' : ""}printf 'HOST_COMMAND_EXIT=%s\\n' $host_status; exit $host_status`;
  return `fish --no-config -c ${quote(parent)}`;
}

export function renderHostReceive(commit: string, helperSha256: string): string { return renderReceive(commit, helperSha256, false); }
export function renderHostReceive2(commit: string, helperSha256: string): string { return renderReceive(commit, helperSha256, true); }

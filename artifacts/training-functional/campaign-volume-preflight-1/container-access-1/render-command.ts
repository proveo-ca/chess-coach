// SPEC: _spec/training-container-access.puml
import { HOST_BUN } from "./probe";

export function renderCommand(source: string, commit: string) {
  if (!/^[a-f0-9]{40}$/.test(commit) || Buffer.byteLength(source) > 16384 || !source.endsWith("\n") || /[\r\0]/.test(source)) {
    throw new Error("PROBE_COMMAND_ENVELOPE");
  }
  const payload = Buffer.from(source).toString("base64");
  return `/usr/bin/env -i PATH=/usr/bin:/bin HOME=/ LC_ALL=C BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 /usr/bin/bash --noprofile --norc -c '` +
    `set -euo pipefail; cd /; printf "%s" "$2" | /usr/bin/base64 -d | /usr/bin/timeout -k 2s 75s ${HOST_BUN} --config=/dev/null --no-env-file --no-install - "$1"' _ ${commit} '${payload}'\n`;
}

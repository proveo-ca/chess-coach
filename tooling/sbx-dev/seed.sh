#!/usr/bin/env bash
set -euo pipefail

stop() { printf 'STOP: %s\n' "$*" >&2; exit 2; }
[[ $# == 8 && $1 == --sbx && $3 == --name && $5 == --bundle && $7 == --sha256 ]] || stop 'usage: seed.sh --sbx ABSOLUTE_EXECUTABLE --name DEVRUST_NAME --bundle ABSOLUTE_TAR --sha256 SHA256_LOWERCASE'
sbx=$2 name=$4 bundle=$6 digest=$8
[[ $sbx == /* && -f $sbx && -x $sbx && ! -L $sbx ]] || stop 'sbx path must be an existing absolute, regular, executable file (not a symlink)'
[[ $name =~ ^devrust-[0-9a-f]{24}$ && $bundle == /* && -f $bundle && ! -L $bundle && $digest =~ ^[0-9a-f]{64}$ ]] || stop 'invalid seed inputs'
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
entrypoint="$script_dir/install-rust.sh"
[[ -f $entrypoint && ! -L $entrypoint ]] || stop 'guest entrypoint unavailable'
/usr/bin/python3 "$script_dir/check-bundle.py" "$bundle" "$digest" || stop 'bundle validation failed'

output=$(/usr/bin/timeout --kill-after=2s 10s "$sbx" ls -q | /usr/bin/head -c 65537) || stop 'sandbox listing unavailable'
(( ${#output} <= 65536 )) || stop 'sandbox listing incomplete'
count=0
while IFS= read -r line; do
  [[ $line == "$name" ]] && (( ++count ))
done <<< "$output"
(( count == 1 )) || stop 'sandbox name absent or ambiguous'

printf 'SEED_ATTEMPT_NAME=%s\n' "$name"
/usr/bin/timeout --kill-after=2s 60s "$sbx" cp "$bundle" "$name:/home/agent/workspace/devrust-tools.tar" || stop 'bundle transfer unconfirmed; reconcile before retry'
/usr/bin/timeout --kill-after=2s 30s "$sbx" cp "$entrypoint" "$name:/home/agent/workspace/install-rust.sh" || stop 'entrypoint transfer unconfirmed; reconcile before retry'
/usr/bin/timeout --kill-after=2s 120s "$sbx" exec "$name" /bin/sh /home/agent/workspace/install-rust.sh "$digest" || stop 'guest seed unconfirmed; reconcile before retry'
printf 'RESULT=DEV_ONLY_SEEDED\n'

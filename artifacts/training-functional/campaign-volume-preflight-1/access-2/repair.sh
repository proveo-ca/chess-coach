# SPEC: _spec/runtime-protocol.puml
env -i PATH=/usr/bin:/bin LC_ALL=C /usr/bin/bash --noprofile --norc -c '
set -euo pipefail
[[ "$(id -u)" == 1000 && "$(id -g)" == 1000 ]] || { echo "Run as the HOST user 1000:1000, without an outer sudo." >&2; exit 1; }
sudo -- /usr/bin/env -i PATH=/usr/bin:/bin LC_ALL=C /usr/bin/bash --noprofile --norc -s <<"ROOT"
set -euo pipefail
v=/var/lib/chess-coach/training-volume-1
[[ "$(realpath -e -- "$v")" == "$v" ]] || { echo "Volume path is not canonical." >&2; exit 1; }
[[ "$(stat --format="%F:%u:%g:%a" -- /var/lib/chess-coach)" == "directory:0:0:755" ]] || { echo "Parent metadata changed; no repair applied." >&2; exit 1; }
before=$(stat --format="%d:%i" -- "$v")
cd -P -- "$v"
inside=$(stat --format="%d:%i" -- .)
[[ "$PWD" == "$v" && "$before" == "$inside" && "$(stat --format="%F:%u:%g:%a" -- .)" == "directory:0:0:644" ]] || { echo "Volume metadata changed; no repair applied." >&2; exit 1; }
if ! chmod 0700 -- . || ! chown --no-dereference --from=0:0 1000:1000 -- .; then
  echo "Repair failed; the volume may be partially changed. Stop; do not retry." >&2
  exit 1
fi
if ! result=$(stat --format="%F:%u:%g:%a:%d:%i" -- "$v") || [[ "$result" != "directory:1000:1000:700:$inside" ]]; then
  echo "Post-repair verification failed; the volume may have changed. Stop; do not retry." >&2
  exit 1
fi
echo "Executor: volume owner/mode repaired; no campaign roots created."
ROOT
'

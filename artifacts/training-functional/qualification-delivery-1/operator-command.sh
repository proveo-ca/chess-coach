# SPEC: _spec/qualification-bootstrap.puml
bash -c '
set -euo pipefail
set -o noclobber
umask 077
H="/home/gu1lty/Projects/proveo/chess-coach"
B="$H/_work/gpu-owner-recovery/cache/host-gpu-native-build-1/bun"
L="$H/_work/gpu-owner-recovery/runs/training-qualification-launcher-1.ts"
PUBLISHED_COMMIT="e821b5169f29b191b8418763508bd54292774aef"
BOOTSTRAP_SHA256="e22505c5e3c492c25a6068089116a69dd70b398f3536629c8e8433a6eefbb968"
[[ "$PUBLISHED_COMMIT" =~ ^[a-f0-9]{40}$ ]]
[[ "$BOOTSTRAP_SHA256" =~ ^[a-f0-9]{64}$ ]]
test -x "$B"
cd "$H"
curl --disable --fail --silent --show-error --retry 0 --connect-timeout 10 --max-time 60 --max-filesize 1048576 --proto "=https" \
  "https://raw.githubusercontent.com/proveo-ca/chess-coach/$PUBLISHED_COMMIT/artifacts/training-functional/qualification-bootstrap.ts" > "$L"
"$B" --no-env-file --no-install -e "
const fs=require(\"node:fs\"),{createHash}=require(\"node:crypto\");
const [path,expected]=Bun.argv.slice(-2),info=fs.lstatSync(path);
if(!info.isFile()||info.size>1048576)throw new Error(\"bootstrap file bound\");
if(createHash(\"sha256\").update(fs.readFileSync(path)).digest(\"hex\")!==expected)throw new Error(\"bootstrap SHA256 mismatch\");
" -- "$L" "$BOOTSTRAP_SHA256"
"$B" --no-env-file --no-install "$L" prepare "$PUBLISHED_COMMIT"
exec "$B" --no-env-file --no-install "$H/_work/gpu-owner-recovery/runs/training-qualification-inputs-1/app/artifacts/training-functional/qualification-operator.ts" operator
'

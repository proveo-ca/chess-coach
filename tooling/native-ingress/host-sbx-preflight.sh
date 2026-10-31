#!/usr/bin/env bash
set -euo pipefail

# Host-only, read-only preflight. No sandbox is created here.
die() { printf 'STOP: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing $1"; }
require_file() { [[ -f "$1" && ! -L "$1" ]] || die "missing or symlinked input: $1"; }
hash() {
  local actual
  actual=$(sha256sum "$2") || die "cannot hash $2"
  [[ ${actual%% *} == "$1" ]] || die "SHA-256 mismatch: $2"
}

[[ $# == 1 ]] || die 'usage: host-sbx-preflight.sh ABSOLUTE_INPUT_DIRECTORY'
[[ $1 == /* && -d $1 && ! -L $1 ]] || die 'use an existing absolute input directory (not a symlink)'
inputs=$(realpath -e -- "$1")
for command in sbx sha256sum gpgv xz realpath awk; do need "$command"; done

for file in linux-6.16.tar.xz linux-6.16.tar.sign llvm-20.1.8-x86_64.tar.xz llvm-20.1.8-x86_64.tar.sign linux-kernel.gpg llvm-kernel.gpg linux-6.16-original-custody.patch tools.tar zig; do
  require_file "$inputs/$file"
done

hash 1a4be2fe6b5246aa4ac8987a8a4af34c42a8dd7d08b46ab48516bcc1befbcd83 "$inputs/linux-6.16.tar.xz"
hash 107e13529d11710bb8d8dc5005aea42f286c7cb23099d72d0e993bbab1bf6400 "$inputs/llvm-20.1.8-x86_64.tar.xz"

for var in F9_PATCH_SHA256 F9_TOOLS_SHA256 F9_ZIG_SHA256; do
  [[ ${!var:-} =~ ^[[:xdigit:]]{64}$ ]] || die "set independently registered $var"
done
hash "$F9_PATCH_SHA256" "$inputs/linux-6.16-original-custody.patch"
hash "$F9_TOOLS_SHA256" "$inputs/tools.tar"
hash "$F9_ZIG_SHA256" "$inputs/zig"

for var in F9_LINUX_KEYRING_SHA256 F9_LLVM_KEYRING_SHA256; do
  [[ ${!var:-} =~ ^[[:xdigit:]]{64}$ ]] || die "set independently registered $var"
done
hash "$F9_LINUX_KEYRING_SHA256" "$inputs/linux-kernel.gpg"
hash "$F9_LLVM_KEYRING_SHA256" "$inputs/llvm-kernel.gpg"

linux_signer=$(xz -dc -- "$inputs/linux-6.16.tar.xz" | gpgv --status-fd 1 --keyring "$inputs/linux-kernel.gpg" "$inputs/linux-6.16.tar.sign" - 2>/dev/null | awk '$2=="VALIDSIG" {print $3}') || die 'Linux signature failed'
llvm_signer=$(xz -dc -- "$inputs/llvm-20.1.8-x86_64.tar.xz" | gpgv --status-fd 1 --keyring "$inputs/llvm-kernel.gpg" "$inputs/llvm-20.1.8-x86_64.tar.sign" - 2>/dev/null | awk '$2=="VALIDSIG" {print $3}') || die 'LLVM signature failed'
[[ $linux_signer == 647F28654894E3BD457199BE38DBBDC86092693E ]] || die 'unexpected Linux signer'
[[ $llvm_signer == 7BE325C731319CCD01D8CA921D6B269171C01A96 ]] || die 'unexpected LLVM signer'

printf 'Dedicated-service guard must verify the scoped sbx version, daemon routing and effective policy.\n'
printf 'Verified archives/signatures and operator-pinned patch/tools/Zig hashes in %s\n' "$inputs"
printf 'Archive preflight passed; dependency provenance and resource enforcement require separate reviewed providers.\n'

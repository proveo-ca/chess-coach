// SPEC: _spec/packages/starchess-training/owned-economic-foundations.puml, _spec/packages/starchess-training/r4-host-verification.puml
import { closeSync, constants, fchmodSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, realpathSync, type Stats } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";

const ownedScratch = new Map<string, Pick<Stats, "dev" | "ino">>();
const requireName = (name: string): void => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) throw new Error("PRIVATE_SCRATCH_NAME");
};
const requireCanonicalDirectory = (directory: string): Stats => {
  const stat = lstatSync(directory);
  if (!isAbsolute(directory) || !stat.isDirectory() || realpathSync(directory) !== directory) {
    throw new Error("PRIVATE_SCRATCH_DIRECTORY");
  }
  return stat;
};
const sameDirectory = (left: Pick<Stats, "dev" | "ino">, right: Stats): boolean => left.dev === right.dev && left.ino === right.ino;
const setFreshDirectoryMode = (directory: string, mode: number): Stats => {
  const before = requireCanonicalDirectory(directory);
  if (process.getuid && before.uid !== process.getuid()) throw new Error("PRIVATE_SCRATCH_OWNER");
  const fd = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const opened = fstatSync(fd);
    if (!opened.isDirectory() || !sameDirectory(before, opened)) throw new Error("PRIVATE_SCRATCH_DIRECTORY");
    fchmodSync(fd, mode);
    const after = requireCanonicalDirectory(directory);
    if (!sameDirectory(opened, after) || (after.mode & 0o7777) !== mode) throw new Error("PRIVATE_SCRATCH_DIRECTORY");
    return after;
  } finally { closeSync(fd); }
};

export const createPrivateScratch = (prefix: string): string => {
  requireName(prefix);
  const selected = tmpdir();
  if (!isAbsolute(selected) || selected.includes("\0")) throw new Error("PRIVATE_SCRATCH_DIRECTORY");
  const temporary = realpathSync(selected);
  requireCanonicalDirectory(temporary);
  const directory = mkdtempSync(join(temporary, prefix));
  ownedScratch.set(directory, setFreshDirectoryMode(directory, 0o700));
  return directory;
};

export const createScratchSourceRoot = (directory: string, name: string): string => {
  requireName(name);
  const owner = ownedScratch.get(directory);
  if (!owner) throw new Error("PRIVATE_SCRATCH_OWNER");
  const stat = requireCanonicalDirectory(directory);
  if (!sameDirectory(owner, stat) || (stat.mode & 0o7777) !== 0o700) throw new Error("PRIVATE_SCRATCH_OWNER");
  const root = join(directory, name);
  mkdirSync(root, { mode: 0o755 });
  setFreshDirectoryMode(root, 0o755);
  return root;
};

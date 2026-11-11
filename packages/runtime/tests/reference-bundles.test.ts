// SPEC: _spec/runtime-protocol.puml, _spec/gate-closure.puml
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, symlinkSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { expect, test } from "bun:test";
import { buildReferenceBundles } from "../../../tooling/build-reference";
import { referenceProofDriver } from "../src/reference-driver";
import { auditPinnedCorpus } from "../src/corpus";
import fixture from "./fixtures/native-reference-proof.json";
import expected from "./fixtures/reference-sources.json";
import { StrategicDriver } from "../src/strategic";
import { deriveStream } from "../src/rng";
import { initializeGame, openGame } from "../../contracts/src/game-session";
import selected from "../../../tooling/reference-entrypoints.json";

const workspace = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const referenceObjectBound = 4 * 1024 * 1024, referenceEntryBound = 16_384;
function temporary(label: string) {
  const root = resolve(workspace, "_work/gpu-owner-recovery/scratch");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  return mkdtempSync(resolve(root, label));
}
function git(root: string, ...args: string[]) {
  return gitCommand(root, args);
}
function gitCommand(root: string, args: string[], input?: Uint8Array, timeout = 10_000) {
  return Bun.spawnSync(["git", "--no-replace-objects", "--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", ...args], {
    cwd: root, stdin: input ?? "ignore", stdout: "pipe", stderr: "pipe", timeout, maxBuffer: referenceObjectBound,
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", LANG: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0" },
  });
}
function referenceObjectId(type: "commit" | "tree" | "blob", bytes: Uint8Array) {
  return createHash("sha1").update(`${type} ${bytes.byteLength}\0`).update(bytes).digest("hex");
}
function referenceCommitTree(oid: string, bytes: Uint8Array) {
  if (bytes.byteLength > referenceObjectBound || !/^[0-9a-f]{40}$/.test(oid)) throw new Error("Reference source: PINNED_COMMIT_REQUIRED");
  if (referenceObjectId("commit", bytes) !== oid) throw new Error("Reference source: COMMIT_HASH_MISMATCH");
  const match = /^tree ([0-9a-f]{40})\n$/.exec(Buffer.from(bytes.subarray(0, 46)).toString("utf8"));
  if (!match) throw new Error("Reference source: PINNED_COMMIT_REQUIRED");
  return match[1]!;
}
function referenceTreeBatch(oids: string[], response: Uint8Array) {
  if (!oids.length || oids.length > 4096 || new Set(oids).size !== oids.length || oids.some(oid => !/^[0-9a-f]{40}$/.test(oid))) throw new Error("Reference source: PINNED_TREE_REQUIRED");
  if (response.byteLength > referenceObjectBound) throw new Error("Reference source: PINNED_TREE_BOUND");
  const bytes = Buffer.from(response.buffer, response.byteOffset, response.byteLength), bodies = new Map<string, Buffer>();
  let offset = 0;
  for (const oid of oids) {
    const newline = bytes.indexOf(10, offset);
    if (newline < 0) throw new Error("Reference source: PINNED_TREE_REQUIRED");
    const match = /^([0-9a-f]{40}) tree (0|[1-9][0-9]*)$/.exec(bytes.subarray(offset, newline).toString("utf8"));
    if (!match || match[1] !== oid) throw new Error("Reference source: PINNED_TREE_REQUIRED");
    const size = Number(match[2]), end = newline + 1 + size;
    if (!Number.isSafeInteger(size) || size > referenceObjectBound || end >= bytes.byteLength || bytes[end] !== 10) throw new Error("Reference source: PINNED_TREE_REQUIRED");
    const body = bytes.subarray(newline + 1, end);
    if (referenceObjectId("tree", body) !== oid) throw new Error("Reference source: TREE_HASH_MISMATCH");
    bodies.set(oid, body);
    offset = end + 1;
  }
  if (offset !== bytes.byteLength) throw new Error("Reference source: PINNED_TREE_REQUIRED");
  return bodies;
}
function referenceTreeEntries(body: Uint8Array) {
  if (body.byteLength > referenceObjectBound) throw new Error("Reference source: PINNED_TREE_BOUND");
  const bytes = Buffer.from(body.buffer, body.byteOffset, body.byteLength), names = new Set<string>();
  const entries: { mode: string; name: string; oid: string }[] = [];
  let offset = 0;
  while (offset < bytes.byteLength) {
    const space = bytes.indexOf(32, offset), nul = bytes.indexOf(0, space + 1);
    if (space <= offset || nul < space + 1 || nul + 21 > bytes.byteLength) throw new Error("Reference source: PINNED_TREE_REQUIRED");
    const rawMode = bytes.subarray(offset, space).toString("utf8");
    if (!["40000", "100644", "100755", "160000"].includes(rawMode)) throw new Error("Reference source: PINNED_TREE_REQUIRED");
    let name: string;
    try { name = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(space + 1, nul)); }
    catch { throw new Error("Reference source: PINNED_TREE_REQUIRED"); }
    if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\") || names.has(name)) throw new Error("Reference source: PINNED_TREE_REQUIRED");
    names.add(name);
    entries.push({ mode: rawMode === "40000" ? "040000" : rawMode, name, oid: bytes.subarray(nul + 1, nul + 21).toString("hex") });
    if (entries.length > referenceEntryBound) throw new Error("Reference source: PINNED_TREE_BOUND");
    offset = nul + 21;
  }
  return entries;
}
function authenticatedReferenceTrees(root: string, tree: string, deadline: number) {
  if (!/^[0-9a-f]{40}$/.test(tree)) throw new Error("Reference source: PINNED_TREE_REQUIRED");
  const cache = new Map<string, { body: Buffer; entries: ReturnType<typeof referenceTreeEntries> }>();
  const inventory: { mode: string; oid: string; path: string }[] = [];
  let pending = [{ oid: tree, path: "", depth: 0 }], workBytes = 0, pathBytes = 0;
  while (pending.length) {
    if (performance.now() >= deadline || pending.some(parent => parent.depth > 32)) throw new Error("Reference source: PINNED_TREE_BOUND");
    const oids = [...new Set(pending.map(parent => parent.oid).filter(oid => !cache.has(oid)))];
    if (cache.size + oids.length > 4096) throw new Error("Reference source: PINNED_TREE_BOUND");
    if (oids.length) {
      if (oids.some(oid => !/^[0-9a-f]{40}$/.test(oid))) throw new Error("Reference source: PINNED_TREE_REQUIRED");
      const input = Buffer.from(oids.join("\n") + "\n");
      if (input.byteLength > referenceObjectBound || workBytes + input.byteLength > referenceObjectBound) throw new Error("Reference source: PINNED_TREE_BOUND");
      const result = gitCommand(root, ["cat-file", "--batch"], input, Math.max(1, Math.min(10_000, Math.ceil(deadline - performance.now()))));
      if (result.exitCode !== 0) throw new Error("Reference source: PINNED_TREE_REQUIRED");
      workBytes += input.byteLength + result.stdout.byteLength;
      if (workBytes > referenceObjectBound || performance.now() >= deadline) throw new Error("Reference source: PINNED_TREE_BOUND");
      for (const [oid, body] of referenceTreeBatch(oids, result.stdout)) cache.set(oid, { body, entries: referenceTreeEntries(body) });
    }
    const next: typeof pending = [];
    for (const parent of pending) {
      for (const entry of cache.get(parent.oid)!.entries) {
        const path = parent.path ? `${parent.path}/${entry.name}` : entry.name;
        pathBytes += Buffer.byteLength(path);
        if (inventory.length >= referenceEntryBound || pathBytes > referenceObjectBound || Buffer.byteLength(path) > 4096 || performance.now() >= deadline) throw new Error("Reference source: PINNED_TREE_BOUND");
        inventory.push({ mode: entry.mode, oid: entry.oid, path });
        if (entry.mode === "040000") next.push({ oid: entry.oid, path, depth: parent.depth + 1 });
      }
    }
    pending = next;
  }
  if (performance.now() >= deadline) throw new Error("Reference source: PINNED_TREE_BOUND");
  return inventory;
}
function authenticatedReferenceInventory(root: string) {
  const deadline = performance.now() + 20_000, commit = gitCommand(root, ["cat-file", "commit", selected.reference]);
  if (commit.exitCode !== 0) throw new Error("Reference source: PINNED_COMMIT_REQUIRED");
  return authenticatedReferenceTrees(root, referenceCommitTree(selected.reference, commit.stdout), deadline);
}
function pinnedReferenceSource(value: string | undefined) {
  if (!value || !isAbsolute(value)) throw new Error("Reference source: EXPLICIT_ABSOLUTE_ROOT_REQUIRED");
  const root = realpathSync(value);
  if (root !== value) throw new Error("Reference source: CANONICAL_ROOT_REQUIRED");
  const top = git(root, "rev-parse", "--show-toplevel"), topPath = new TextDecoder().decode(top.stdout).trim();
  if (top.exitCode !== 0 || topPath !== root || realpathSync(topPath) !== root) throw new Error("Reference source: WORKSPACE_ROOT_REQUIRED");
  const format = git(root, "rev-parse", "--show-object-format");
  if (format.exitCode !== 0 || new TextDecoder().decode(format.stdout).trim() !== "sha1" || !/^[0-9a-f]{40}$/.test(selected.reference)) throw new Error("Reference source: SHA1_OBJECT_FORMAT_REQUIRED");
  const head = git(root, "rev-parse", "HEAD");
  if (selected.reference !== expected.reference || head.exitCode !== 0 || new TextDecoder().decode(head.stdout).trim() !== selected.reference) throw new Error("Reference source: PIN_MISMATCH");
  const index = git(root, "ls-files", "-v", "-z", "--"), files = new TextDecoder().decode(index.stdout).split("\0");
  if (index.exitCode !== 0 || files.pop() !== "" || files.length === 0 || files.some(file => !file.startsWith("H ") || file.length <= 2)) throw new Error("Reference source: TRACKED_SOURCE_CHANGED");
  const staged = git(root, "ls-files", "--stage", "-z", "--"), indexRecords = new TextDecoder("utf-8", { fatal: true }).decode(staged.stdout).split("\0");
  if (staged.exitCode !== 0 || indexRecords.pop() !== "") throw new Error("Reference source: TRACKED_SOURCE_CHANGED");
  const indexEntries = new Map<string, { mode: string; oid: string }>();
  for (const record of indexRecords) {
    const match = /^([0-7]{6}) ([0-9a-f]{40}) 0\t([\s\S]+)$/.exec(record);
    if (!match || indexEntries.has(match[3]!)) throw new Error("Reference source: TRACKED_SOURCE_CHANGED");
    indexEntries.set(match[3]!, { mode: match[1]!, oid: match[2]! });
  }
  const inventory = authenticatedReferenceInventory(root);
  const directories = new Set([root]), tracked = new Map<string, { byteLength: number; sha256: string }>();
  let physicalBytes = 0;
  for (const { mode, oid, path } of inventory) {
    if (mode !== "040000") {
      const indexed = indexEntries.get(path);
      if (!indexed || indexed.mode !== mode || indexed.oid !== oid) throw new Error("Reference source: TRACKED_SOURCE_CHANGED");
      indexEntries.delete(path);
    }
    const actual = resolve(root, path);
    if (isAbsolute(path) || path.split("/").some(component => !component || component === "." || component === "..") || !actual.startsWith(root + "/") || !directories.has(dirname(actual))) throw new Error("Reference source: TRACKED_SOURCE_CHANGED");
    const stat = lstatSync(actual);
    if (stat.isSymbolicLink() || realpathSync(actual) !== actual) throw new Error("Reference source: TRACKED_SOURCE_CHANGED");
    if (mode === "040000") {
      if (!stat.isDirectory()) throw new Error("Reference source: TRACKED_SOURCE_CHANGED");
      directories.add(actual);
    } else if (mode === "160000") {
      if (!stat.isDirectory() || readdirSync(actual).length !== 0) throw new Error("Reference source: SUBMODULE_SOURCE_REJECTED");
    } else {
      physicalBytes += stat.size;
      if ((mode !== "100644" && mode !== "100755") || !stat.isFile() || stat.size > 16 * 1024 * 1024 || physicalBytes > 128 * 1024 * 1024 || Boolean(stat.mode & 0o111) !== (mode === "100755")) throw new Error("Reference source: TRACKED_SOURCE_CHANGED");
      const bytes = readFileSync(actual);
      if (bytes.byteLength !== stat.size || referenceObjectId("blob", bytes) !== oid) throw new Error("Reference source: TRACKED_SOURCE_CHANGED");
      tracked.set(path, { byteLength: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
    }
  }
  if (indexEntries.size !== 0) throw new Error("Reference source: TRACKED_SOURCE_CHANGED");
  return { root, tracked };
}
function pinnedReferenceRoot(value: string | undefined): string {
  return pinnedReferenceSource(value).root;
}
function auditReferenceInputs(root: string, outputs: Pick<ReturnType<typeof buildReferenceBundles>[number], "entry" | "inputs">[]) {
  const { tracked } = pinnedReferenceSource(root), entries = new Set(selected.entries);
  for (const output of outputs) {
    if (!entries.delete(output.entry) || !output.inputs.some(input => input.path === output.entry)) throw new Error("Reference source: BUNDLE_INPUT_NOT_PINNED");
    for (const input of output.inputs) {
      const original = tracked.get(input.path);
      if (!original || input.byteLength !== original.byteLength || input.sha256 !== original.sha256) throw new Error("Reference source: BUNDLE_INPUT_NOT_PINNED");
    }
  }
  if (entries.size !== 0) throw new Error("Reference source: BUNDLE_INPUT_NOT_PINNED");
}
function syntheticReferenceInputs(root: string) {
  return selected.entries.map(entry => {
    const bytes = readFileSync(resolve(root, entry));
    return { entry, inputs: [{ path: entry, byteLength: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") }] };
  });
}
function referenceClone() {
  const root = temporary("reference-guard-");
  expect(git(workspace, "clone", "--shared", "--no-checkout", "--", workspace, root).exitCode).toBe(0);
  expect(git(root, "checkout", "--detach", selected.reference).exitCode).toBe(0);
  expect(pinnedReferenceRoot(root)).toBe(root);
  return root;
}
function syntheticTreeEntry(mode: string, name: string | Uint8Array, oid = "1".repeat(40)) {
  return Buffer.concat([Buffer.from(mode + " "), typeof name === "string" ? Buffer.from(name) : name, Buffer.from([0]), Buffer.from(oid, "hex")]);
}
function storeSyntheticTree(root: string, body: Uint8Array) {
  const stored = gitCommand(root, ["hash-object", "-w", "-t", "tree", "--no-filters", "--stdin"], body);
  const oid = new TextDecoder().decode(stored.stdout).trim();
  if (stored.exitCode !== 0 || oid !== referenceObjectId("tree", body)) throw new Error("Synthetic object: TREE_WRITE_FAILED");
  return oid;
}
function shadowSyntheticObject(root: string, oid: string, type: "tree" | "commit", body: Uint8Array) {
  if (!/^[0-9a-f]{40}$/.test(oid)) throw new Error("Synthetic object: OID_REQUIRED");
  const path = resolve(root, ".git/objects", oid.slice(0, 2), oid.slice(2));
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, deflateSync(Buffer.concat([Buffer.from(`${type} ${body.byteLength}\0`), body])), { flag: "wx", mode: 0o600 });
}

test("reference source guard requires an explicit absolute exact-pin root", () => {
  for (const value of [undefined, "", "."]) expect(() => pinnedReferenceRoot(value)).toThrow("EXPLICIT_ABSOLUTE_ROOT_REQUIRED");
  expect(() => pinnedReferenceRoot(workspace)).toThrow("PIN_MISMATCH");
});

test("reference source guard rejects a canonical tracked subdirectory with untracked entrypoints before building", () => {
  const root = referenceClone(), nested = realpathSync(resolve(root, "packages")), entry = resolve(nested, selected.entries[0]!);
  mkdirSync(dirname(entry), { recursive: true, mode: 0o700 });
  writeFileSync(entry, 'throw new Error("UNTRACKED_REFERENCE_ENTRY_EXECUTED");\n', { flag: "wx", mode: 0o600 });
  expect(new TextDecoder().decode(git(nested, "rev-parse", "HEAD").stdout).trim()).toBe(selected.reference);
  expect(git(nested, "diff", "--no-ext-diff", "--no-textconv", "--quiet", "--").exitCode).toBe(0);
  expect(git(nested, "diff", "--cached", "--no-ext-diff", "--no-textconv", "--quiet", "HEAD", "--").exitCode).toBe(0);
  let reachedBuild = false;
  const build = () => {
    const source = pinnedReferenceRoot(nested);
    reachedBuild = true;
    return buildReferenceBundles(source, resolve(root, "unbuilt-reference"));
  };
  expect(build).toThrow("WORKSPACE_ROOT_REQUIRED");
  expect(reachedBuild).toBe(false);
});

test("reference source guard rejects tracked modifications before and after staging", () => {
  const root = referenceClone(), path = resolve(root, "package.json");
  writeFileSync(path, readFileSync(path, "utf8") + "\n");
  expect(() => pinnedReferenceRoot(root)).toThrow("TRACKED_SOURCE_CHANGED");
  expect(git(root, "add", "--", "package.json").exitCode).toBe(0);
  expect(() => pinnedReferenceRoot(root)).toThrow("TRACKED_SOURCE_CHANGED");
});

test("reference source guard rejects a staged change after original physical bytes are restored", () => {
  const root = referenceClone(), path = resolve(root, "package.json"), original = readFileSync(path);
  writeFileSync(path, Buffer.concat([original, Buffer.from("\n")]));
  expect(git(root, "add", "--", "package.json").exitCode).toBe(0);
  writeFileSync(path, original);
  expect(() => pinnedReferenceRoot(root)).toThrow("TRACKED_SOURCE_CHANGED");
});

test("reference source guard rejects extra staged inputs absent from the original pinned tree", () => {
  const root = referenceClone(), path = "packages/reference-guard-staged.ts";
  writeFileSync(resolve(root, path), "export const synthetic = true;\n", { flag: "wx", mode: 0o600 });
  expect(git(root, "add", "--", path).exitCode).toBe(0);
  expect(() => pinnedReferenceRoot(root)).toThrow("TRACKED_SOURCE_CHANGED");
});

for (const flag of ["--assume-unchanged", "--skip-worktree"]) {
  test(`reference source guard rejects tracked modifications hidden by ${flag}`, () => {
    const root = referenceClone(), path = resolve(root, "package.json");
    expect(git(root, "update-index", flag, "--", "package.json").exitCode).toBe(0);
    writeFileSync(path, readFileSync(path, "utf8") + "\n");
    expect(git(root, "diff", "--no-ext-diff", "--no-textconv", "--quiet", "--").exitCode).toBe(0);
    expect(git(root, "diff", "--cached", "--no-ext-diff", "--no-textconv", "--quiet", "HEAD", "--").exitCode).toBe(0);
    expect(() => pinnedReferenceRoot(root)).toThrow("TRACKED_SOURCE_CHANGED");
  });
}

test("reference source guard rejects source substitutions hidden by Git replacement refs", () => {
  const root = referenceClone(), path = resolve(root, "package.json"), text = (bytes: Uint8Array) => new TextDecoder().decode(bytes).trim();
  writeFileSync(path, readFileSync(path, "utf8") + "\n");
  expect(git(root, "add", "--", "package.json").exitCode).toBe(0);
  const tree = git(root, "write-tree");
  expect(tree.exitCode).toBe(0);
  const replacement = git(root, "-c", "user.name=Synthetic fixture", "-c", "user.email=fixture@example.invalid", "commit-tree", text(tree.stdout), "-p", selected.reference, "-m", "synthetic reference replacement");
  expect(replacement.exitCode).toBe(0);
  expect(git(root, "replace", selected.reference, text(replacement.stdout)).exitCode).toBe(0);
  expect(text(git(root, "rev-parse", "HEAD").stdout)).toBe(selected.reference);
  const previousCheck = Bun.spawnSync(["git", "--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "diff", "--cached", "--no-ext-diff", "--no-textconv", "--quiet", "HEAD", "--"], {
    cwd: root, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 10_000,
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", LANG: "C", GIT_CONFIG_NOSYSTEM: "1" },
  });
  expect(previousCheck.exitCode).toBe(0);
  expect(() => pinnedReferenceRoot(root)).toThrow("TRACKED_SOURCE_CHANGED");
});

test("reference source guard authenticates physical bytes hidden by a synthetic clean filter", () => {
  const root = referenceClone(), path = resolve(root, "package.json"), original = readFileSync(path);
  const filter = resolve(temporary("reference-clean-filter-"), "clean-filter.ts");
  writeFileSync(filter, `process.stdout.write(Buffer.from(${JSON.stringify(original.toString("base64"))}, "base64"));\n`, { flag: "wx", mode: 0o700 });
  expect(git(root, "config", "--local", "filter.reference-guard-fixture.clean", `${JSON.stringify(process.execPath)} --no-env-file --no-install ${JSON.stringify(filter)}`).exitCode).toBe(0);
  expect(git(root, "config", "--local", "filter.reference-guard-fixture.required", "true").exitCode).toBe(0);
  writeFileSync(resolve(root, ".git/info/attributes"), "/package.json filter=reference-guard-fixture\n", { flag: "wx", mode: 0o600 });
  const modified = Buffer.from(original.toString("utf8").replace('"name": "chess-coach"', '"name": "chess-Coach"'));
  expect(modified.byteLength).toBe(original.byteLength);
  expect(modified.equals(original)).toBe(false);
  writeFileSync(path, modified);
  expect(git(root, "diff", "--no-ext-diff", "--no-textconv", "--quiet", "--").exitCode).toBe(0);
  expect(git(root, "diff", "--cached", "--no-ext-diff", "--no-textconv", "--quiet", "HEAD", "--").exitCode).toBe(0);
  const index = git(root, "ls-files", "-v", "-z", "--"), files = new TextDecoder().decode(index.stdout).split("\0");
  expect(index.exitCode).toBe(0);
  expect(files.pop()).toBe("");
  expect(files.length).toBeGreaterThan(0);
  expect(files.every(file => file.startsWith("H ") && file.length > 2)).toBe(true);
  expect(() => pinnedReferenceRoot(root)).toThrow("TRACKED_SOURCE_CHANGED");
});

test("reference source guard never executes clean filters for byte-identical tracked files", () => {
  const root = referenceClone(), path = resolve(root, "package.json"), original = readFileSync(path);
  const directory = temporary("reference-filter-execution-"), filter = resolve(directory, "echo-with-marker.ts"), marker = resolve(directory, "executed");
  writeFileSync(filter, `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "executed\\n"); await Bun.write(Bun.stdout, await new Response(Bun.stdin.stream()).arrayBuffer());\n`, { flag: "wx", mode: 0o700 });
  expect(git(root, "config", "--local", "filter.reference-guard-execution.clean", `${JSON.stringify(process.execPath)} --no-env-file --no-install ${JSON.stringify(filter)}`).exitCode).toBe(0);
  expect(git(root, "config", "--local", "filter.reference-guard-execution.required", "true").exitCode).toBe(0);
  writeFileSync(resolve(root, ".git/info/attributes"), "/package.json filter=reference-guard-execution\n", { flag: "wx", mode: 0o600 });
  utimesSync(path, new Date(1000), new Date(1000));
  expect(git(root, "diff", "--no-ext-diff", "--no-textconv", "--quiet", "--").exitCode).toBe(0);
  expect(existsSync(marker)).toBe(true);
  expect(readFileSync(path).equals(original)).toBe(true);
  unlinkSync(marker);
  utimesSync(path, new Date(3000), new Date(3000));
  expect(pinnedReferenceRoot(root)).toBe(root);
  expect(existsSync(marker)).toBe(false);
});

test("reference source guard rejects missing pinned objects without invoking a promisor remote", () => {
  const root = referenceClone(), directory = temporary("reference-promisor-"), marker = resolve(directory, "executed"), helper = resolve(directory, "promisor.ts");
  const commit = git(root, "cat-file", "commit", selected.reference);
  expect(commit.exitCode).toBe(0);
  const commitPath = resolve(directory, "commit"), emptyObjects = resolve(directory, "empty-objects");
  writeFileSync(commitPath, commit.stdout, { flag: "wx", mode: 0o600 });
  mkdirSync(emptyObjects, { mode: 0o700 });
  writeFileSync(resolve(root, ".git/objects/info/alternates"), emptyObjects + "\n");
  const stored = git(root, "hash-object", "-w", "-t", "commit", "--no-filters", "--", commitPath);
  expect(stored.exitCode).toBe(0);
  expect(new TextDecoder().decode(stored.stdout).trim()).toBe(selected.reference);
  writeFileSync(helper, `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "invoked\\n"); process.exit(1);\n`, { flag: "wx", mode: 0o700 });
  for (const [key, value] of [["core.repositoryformatversion", "1"], ["extensions.partialClone", "origin"], ["remote.origin.promisor", "true"],
    ["protocol.ext.allow", "always"], ["remote.origin.url", `ext::${process.execPath} --no-env-file --no-install ${helper}`]]) {
    expect(git(root, "config", "--local", key!, value!).exitCode).toBe(0);
  }
  const previousRead = Bun.spawnSync(["git", "--no-replace-objects", "--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "ls-tree", "-r", selected.reference, "--"], {
    cwd: root, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 10_000, maxBuffer: 4 * 1024 * 1024,
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: "/nonexistent", LANG: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0" },
  });
  expect(previousRead.exitCode).not.toBe(0);
  expect(existsSync(marker)).toBe(true);
  unlinkSync(marker);
  expect(() => pinnedReferenceRoot(root)).toThrow("PINNED_TREE_REQUIRED");
  expect(existsSync(marker)).toBe(false);
});

test("reference source guard rejects a forged raw tree stored under an original subtree OID", () => {
  const root = referenceClone(), entry = selected.entries[0]!, path = resolve(root, entry);
  const treeId = git(root, "rev-parse", `${selected.reference}:${dirname(entry)}`);
  expect(treeId.exitCode).toBe(0);
  const oid = new TextDecoder().decode(treeId.stdout).trim(), original = git(root, "cat-file", "tree", oid);
  expect(original.exitCode).toBe(0);
  writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from("\n")]));
  expect(git(root, "add", "--", entry).exitCode).toBe(0);
  const blob = git(root, "hash-object", "-w", "--no-filters", "--", entry);
  expect(blob.exitCode).toBe(0);
  const blobId = new TextDecoder().decode(blob.stdout).trim(), forged = Buffer.from(original.stdout), prefix = Buffer.from(`100644 ${basename(entry)}\0`);
  const offset = forged.indexOf(prefix);
  expect(offset).toBeGreaterThanOrEqual(0);
  Buffer.from(blobId, "hex").copy(forged, offset + prefix.byteLength);
  expect(referenceObjectId("tree", forged)).not.toBe(oid);
  shadowSyntheticObject(root, oid, "tree", forged);
  const advertised = git(root, "ls-tree", "-r", selected.reference, "--", entry);
  expect(advertised.exitCode).toBe(0);
  expect(new TextDecoder().decode(advertised.stdout)).toContain(`${blobId}\t${entry}`);
  expect(new TextDecoder().decode(git(root, "rev-parse", "HEAD").stdout).trim()).toBe(selected.reference);
  expect(() => pinnedReferenceRoot(root)).toThrow("TREE_HASH_MISMATCH");
});

test("reference source guard rejects a forged raw commit stored under the selected pin OID", () => {
  const root = referenceClone(), path = resolve(root, "package.json"), original = git(root, "cat-file", "commit", selected.reference);
  expect(original.exitCode).toBe(0);
  writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from("\n")]));
  expect(git(root, "add", "--", "package.json").exitCode).toBe(0);
  const tree = git(root, "write-tree"), indexed = git(root, "ls-files", "--stage", "--", "package.json");
  expect(tree.exitCode).toBe(0);
  expect(indexed.exitCode).toBe(0);
  const treeId = new TextDecoder().decode(tree.stdout).trim(), blobId = new TextDecoder().decode(indexed.stdout).split(" ")[1]!;
  const forged = Buffer.concat([Buffer.from(`tree ${treeId}\n`), original.stdout.subarray(46)]);
  expect(referenceObjectId("commit", forged)).not.toBe(selected.reference);
  shadowSyntheticObject(root, selected.reference, "commit", forged);
  const raw = git(root, "cat-file", "commit", selected.reference), advertised = git(root, "ls-tree", "-r", treeId, "--", "package.json");
  expect(raw.exitCode).toBe(0);
  expect(Buffer.from(raw.stdout).equals(forged)).toBe(true);
  expect(advertised.exitCode).toBe(0);
  expect(new TextDecoder().decode(advertised.stdout)).toContain(`${blobId}\tpackage.json`);
  expect(new TextDecoder().decode(git(root, "rev-parse", "HEAD").stdout).trim()).toBe(selected.reference);
  expect(() => pinnedReferenceRoot(root)).toThrow("COMMIT_HASH_MISMATCH");
});

test("reference source guard authenticates commit bytes before parsing the root tree header", () => {
  const tree = "a".repeat(40), valid = Buffer.from(`tree ${tree}\nauthor Synthetic fixture\n\nfixture\n`);
  expect(referenceCommitTree(referenceObjectId("commit", valid), valid)).toBe(tree);
  expect(() => referenceCommitTree("0".repeat(40), valid)).toThrow("COMMIT_HASH_MISMATCH");
  for (const body of [Buffer.from(`tree ${tree}`), Buffer.from(`tree ${tree.toUpperCase()}\n`), Buffer.from(`parent ${tree}\n`)]) {
    expect(() => referenceCommitTree(referenceObjectId("commit", body), body)).toThrow("PINNED_COMMIT_REQUIRED");
  }
});

test("reference source guard strictly frames and hashes tree batch responses", () => {
  const body = syntheticTreeEntry("100644", "file"), oid = referenceObjectId("tree", body), other = "2".repeat(40);
  const frame = Buffer.concat([Buffer.from(`${oid} tree ${body.byteLength}\n`), body, Buffer.from("\n")]);
  expect(referenceTreeBatch([oid], frame).get(oid)?.equals(body)).toBe(true);
  const malformed = [Buffer.from(`${oid} tree ${body.byteLength}`),
    Buffer.concat([Buffer.from(`${other} tree ${body.byteLength}\n`), body, Buffer.from("\n")]),
    Buffer.concat([Buffer.from(`${oid} blob ${body.byteLength}\n`), body, Buffer.from("\n")]),
    Buffer.concat([Buffer.from(`${oid} tree 0${body.byteLength}\n`), body, Buffer.from("\n")]),
    Buffer.from(`${oid} tree 9007199254740992\n`), frame.subarray(0, frame.byteLength - 2),
    Buffer.concat([frame, Buffer.from("extra")]), Buffer.from(`${oid} missing\n`)];
  for (const response of malformed) expect(() => referenceTreeBatch([oid], response)).toThrow("PINNED_TREE_REQUIRED");
  expect(() => referenceTreeBatch([oid, other], frame)).toThrow("PINNED_TREE_REQUIRED");
  expect(() => referenceTreeBatch([oid, oid], Buffer.concat([frame, frame]))).toThrow("PINNED_TREE_REQUIRED");
  expect(() => referenceTreeBatch([oid + "\n"], frame)).toThrow("PINNED_TREE_REQUIRED");
  const corrupted = Buffer.from(frame);
  corrupted[corrupted.byteLength - 2] ^= 1;
  expect(() => referenceTreeBatch([oid], corrupted)).toThrow("TREE_HASH_MISMATCH");
});

test("reference source guard rejects malformed binary tree names, modes, and records", () => {
  const valid = Buffer.concat([syntheticTreeEntry("40000", "directory"), syntheticTreeEntry("100644", "file"),
    syntheticTreeEntry("100755", "program"), syntheticTreeEntry("160000", "submodule")]);
  expect(referenceTreeEntries(valid).map(entry => entry.mode)).toEqual(["040000", "100644", "100755", "160000"]);
  const invalid = [syntheticTreeEntry("040000", "directory"), syntheticTreeEntry("120000", "link"), syntheticTreeEntry("100664", "file"),
    ...["", ".", "..", "nested/file", "nested\\file"].map(name => syntheticTreeEntry("100644", name)),
    syntheticTreeEntry("100644", Buffer.from([0xc3, 0x28])),
    Buffer.concat([syntheticTreeEntry("100644", "same"), syntheticTreeEntry("40000", "same")]),
    syntheticTreeEntry("100644", "file").subarray(0, -1), Buffer.from("100644 unterminated")];
  for (const body of invalid) expect(() => referenceTreeEntries(body)).toThrow("PINNED_TREE_REQUIRED");
});

test("reference source guard instantiates reused authenticated trees at every path without cross-validation caching", () => {
  const root = referenceClone(), leaf = storeSyntheticTree(root, syntheticTreeEntry("100644", "file"));
  const wrapper = storeSyntheticTree(root, syntheticTreeEntry("40000", "nested", leaf));
  const tree = storeSyntheticTree(root, Buffer.concat([syntheticTreeEntry("40000", "a", leaf), syntheticTreeEntry("40000", "b", leaf), syntheticTreeEntry("40000", "c", wrapper)]));
  expect(authenticatedReferenceTrees(root, tree, performance.now() + 20_000).map(entry => entry.path)).toEqual(["a", "b", "c", "a/file", "b/file", "c/nested", "c/nested/file"]);
  unlinkSync(resolve(root, ".git/objects", leaf.slice(0, 2), leaf.slice(2)));
  expect(() => authenticatedReferenceTrees(root, tree, performance.now() + 20_000)).toThrow("PINNED_TREE_REQUIRED");
});

test("reference source guard bounds batch bytes, binary entry counts, and expired graph reads", () => {
  expect(() => referenceTreeBatch(["1".repeat(40)], Buffer.alloc(referenceObjectBound + 1))).toThrow("PINNED_TREE_BOUND");
  const entries = Buffer.concat(Array.from({ length: referenceEntryBound + 1 }, (_, index) => syntheticTreeEntry("100644", `file-${index}`)));
  expect(() => referenceTreeEntries(entries)).toThrow("PINNED_TREE_BOUND");
  expect(() => authenticatedReferenceTrees(workspace, "1".repeat(40), performance.now() - 1)).toThrow("PINNED_TREE_BOUND");
});

test("reference source guard bounds reused-tree expansion and authenticated graph depth", () => {
  const root = referenceClone(), empty = storeSyntheticTree(root, Buffer.alloc(0));
  let expanded = empty, deep = empty;
  for (let level = 0; level < 14; level++) expanded = storeSyntheticTree(root, Buffer.concat([syntheticTreeEntry("40000", "a", expanded), syntheticTreeEntry("40000", "b", expanded)]));
  expect(() => authenticatedReferenceTrees(root, expanded, performance.now() + 20_000)).toThrow("PINNED_TREE_BOUND");
  for (let level = 0; level < 34; level++) deep = storeSyntheticTree(root, syntheticTreeEntry("40000", "nested", deep));
  expect(() => authenticatedReferenceTrees(root, deep, performance.now() + 20_000)).toThrow("PINNED_TREE_BOUND");
}, 30_000);

for (const path of ["package.json", "packages"]) {
  test(`reference source guard rejects a physical symlink replacing tracked ${path}`, () => {
    const root = referenceClone(), original = resolve(root, path), moved = resolve(temporary("reference-symlink-target-"), path);
    renameSync(original, moved);
    symlinkSync(moved, original);
    expect(() => pinnedReferenceRoot(root)).toThrow("TRACKED_SOURCE_CHANGED");
  });
}

test("reference source guard rejects populated submodule source", () => {
  const root = referenceClone();
  writeFileSync(resolve(root, "orrery/untracked.ts"), 'throw new Error("SUBMODULE_SOURCE_EXECUTED");\n', { flag: "wx", mode: 0o600 });
  expect(() => pinnedReferenceRoot(root)).toThrow("SUBMODULE_SOURCE_REJECTED");
});

test("reference source guard rejects untracked bundle input metadata even with identical tracked bytes", () => {
  const root = referenceClone(), outputs = syntheticReferenceInputs(root), original = outputs[0]!.inputs[0]!;
  expect(() => auditReferenceInputs(root, outputs)).not.toThrow();
  const path = "packages/reference-guard-untracked.ts";
  writeFileSync(resolve(root, path), readFileSync(resolve(root, original.path)), { flag: "wx", mode: 0o600 });
  expect(pinnedReferenceRoot(root)).toBe(root);
  outputs[0]!.inputs.push({ ...original, path });
  expect(() => auditReferenceInputs(root, outputs)).toThrow("BUNDLE_INPUT_NOT_PINNED");
});

test("reference source guard requires original bundle input size, digest, paths, and selected entry coverage", () => {
  const root = referenceClone(), valid = syntheticReferenceInputs(root), input = valid[0]!.inputs[0]!;
  for (const changed of [{ ...input, byteLength: input.byteLength + 1 }, { ...input, sha256: "0".repeat(64) },
    { ...input, path: `../${input.path}` }, { ...input, path: resolve(root, input.path) }]) {
    const outputs = syntheticReferenceInputs(root);
    outputs[0]!.inputs.push(changed);
    expect(() => auditReferenceInputs(root, outputs)).toThrow("BUNDLE_INPUT_NOT_PINNED");
  }
  expect(() => auditReferenceInputs(root, valid.slice(1))).toThrow("BUNDLE_INPUT_NOT_PINNED");
  expect(() => auditReferenceInputs(root, [...valid, valid[0]!])).toThrow("BUNDLE_INPUT_NOT_PINNED");
  const outputs = syntheticReferenceInputs(root);
  outputs[0]!.inputs = [];
  expect(() => auditReferenceInputs(root, outputs)).toThrow("BUNDLE_INPUT_NOT_PINNED");
}, 30_000);

test("reference source guard reauthenticates physical inputs after inventory capture", () => {
  const root = referenceClone(), outputs = syntheticReferenceInputs(root), path = resolve(root, outputs[0]!.entry), original = readFileSync(path);
  const modified = Buffer.from(original);
  modified[0] = modified[0]! ^ 1;
  writeFileSync(path, modified);
  expect(() => auditReferenceInputs(root, outputs)).toThrow("TRACKED_SOURCE_CHANGED");
});

test("C14 standard Bun bundles retain six pinned source APIs and bounded in-process reference fingerprints", async () => {
  const source = pinnedReferenceRoot(process.env.CHESS_COACH_REFERENCE_ROOT), root = `${temporary("reference-bundles-")}/reference`;
  const outputs = buildReferenceBundles(source, root);
  auditReferenceInputs(source, outputs);
  expect(outputs).toHaveLength(6);
  expect(outputs.every(output => output.inputs.every(input => !input.path.includes("packages/game-core") && !input.path.startsWith("../")))).toBe(true);
  const load = (path: string) => import(`${root}/${path}`);
  const [core, session, admission, bank, strategic, corpus] = await Promise.all([
    load("packages/starchess-core/src/index.ts"), load("packages/starchess-arena/src/challenge/r3Session.ts"), load("packages/starchess-arena/src/challenge/admission.ts"),
    load("packages/starchess-arena/src/run/bank.ts"), load("packages/starchess-arena/src/players/strategic.ts"), load("packages/starchess-arena/src/challenge/corpus.ts"),
  ]);
  expect(typeof strategic.strategicScript).toBe("function");
  for (const side of ["w", "b"] as const) {
    const initial = initializeGame(), opened = openGame(initial), rng = deriveStream(101, "opponent");
    const driver = new StrategicDriver("synthetic", side, initial.snapshot, rng, { strategicScript: strategic.strategicScript,
      seedKvsForOpening: core.seedKvsForOpening, seedCcIntelForOpening: core.seedCcIntelForOpening, seedRunnerMemory: core.seedRunnerMemory, seedAttackerMemory: core.seedAttackerMemory,
      updateKvsForSnap: core.updateKvsForSnap, updateCcIntelForSnap: core.updateCcIntelForSnap, updateRunnersForSnap: core.updateRunnersForSnap,
      updateAttackersForSnap: core.updateAttackersForSnap, witnessFromEndTurn: core.witnessFromEndTurn }, () => 0n, 100_000_000_000n);
    driver.advance(opened);
    const journal = await driver.plan(JSON.stringify({ version: "chess-coach.plan-permit.v1", attemptId: "synthetic", permitId: `synthetic:plan:0:${side}`,
      planningOrdinal: 0, turn: 0, side, role: "strategic", issuedNs: "0", deadlineNs: "10000000000" }));
    expect(createHash("sha256").update(journal).digest("hex")).toBe(expected.strategic.find(entry => entry.side === side)!.digest);
  }
  const driver = referenceProofDriver({ parseScFen: core.parseScFen, initializeR3Session: session.initializeR3Session, stageR3Begin: session.stageR3Begin,
    stageR3Settlement: session.stageR3Settlement, verifyAndCommitR3: session.verifyAndCommitR3, stageQueue: admission.stageQueue, grantStoredIncome: bank.grantStoredIncome });
  const initialized = driver.initialize(), opened = driver.open(driver.commit!(initialized.state)), settled = driver.settle(driver.commit!(opened.state), { w: [], b: [] });
  driver.commit!(settled.state);
  for (const [index, result] of [initialized, opened, settled].entries()) {
    const bytes = Buffer.from(JSON.stringify(result.boundary));
    expect(bytes.byteLength).toBe(fixture.stages[index]!.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(fixture.stages[index]!.sha256);
  }
  const audited = await auditPinnedCorpus(readFileSync(`${source}/_spec/corpora/ml-adjutant-corpus.manifest.json`),
    readFileSync(`${source}/starchess-match-history-20260929-203446.json`), corpus.auditCorpus);
  expect(audited.window(0, 0)?.planningOrdinal).toBe(0);
  expect(() => buildReferenceBundles(source, root)).toThrow();
}, 30_000);

// SPEC: _spec/gpu-qualification.puml
import { expect, test } from "bun:test";
import { inventoryMetadata } from "./input-inventory";
import type { MetadataIO } from "./input-inventory";

const metadata = (kind: "directory" | "file" | "symlink" | "other", bytes = 0) => ({ kind, bytes, mode: 0o755, uid: 1000, gid: 1000, links: 1 });
function fixture() {
  const rows: Record<string, ReturnType<typeof metadata>> = { "/fixture": metadata("directory"), "/fixture/bin": metadata("directory"),
    "/fixture/bin/llvm-config": metadata("file", 123), "/fixture/library.a": metadata("file", 456), "/fixture/external": metadata("symlink", 10) };
  const emitted: string[] = [], inspected: string[] = [], opened: string[] = [];
  const io: MetadataIO = { root: async () => "/fixture", stat: async path => { inspected.push(path); if (!rows[path]) throw Error("MISSING"); return rows[path]!; },
    entries: async function* (path) { opened.push(path); for (const key of Object.keys(rows)) if (key !== path && key.startsWith(path + "/") && !key.slice(path.length + 1).includes("/")) yield key.slice(path.length + 1); },
    link: async () => "/outside/never-follow", emit: async line => { emitted.push(line); } };
  return { io, emitted, inspected, opened, rows };
}

test("the bounded walker records metadata and apparent bytes without following links", async () => {
  const { io, emitted, inspected, opened } = fixture();
  const result = await inventoryMetadata(io, { entries: 20, bytes: 10000 });
  expect(result.complete).toBe(true);
  expect(result.entries).toBe(5);
  expect(result.apparentRegularFileBytes).toBe(579);
  expect(result.counts).toEqual({ directory: 2, file: 2, symlink: 1, other: 0 });
  expect(opened).toEqual(["/fixture", "/fixture/bin"]);
  expect(inspected).not.toContain("/outside/never-follow");
  expect(emitted.map(line => JSON.parse(line)).find(row => row.kind === "symlink").target).toBe("/outside/never-follow");
  expect(result.payloadsRead).toBe(false);
});

test("entry and output exhaustion preserve bounded incomplete observations", async () => {
  const first = fixture();
  const limited = await inventoryMetadata(first.io, { entries: 2, bytes: 10000 });
  expect(limited.complete).toBe(false);
  expect(limited.entries).toBe(2);
  expect(limited.failure).toContain("METADATA_ENTRY_LIMIT");
  const second = fixture();
  const bytes = await inventoryMetadata(second.io, { entries: 20, bytes: 1 });
  expect(bytes.complete).toBe(false);
  expect(bytes.metadataBytes).toBe(0);
  expect(second.emitted).toEqual([]);
});

test("metadata failures preserve prior records without declaring broken LLVM", async () => {
  const { io, emitted } = fixture();
  const stat = io.stat;
  io.stat = async path => { if (path.endsWith("library.a")) throw Error("METADATA_UNREADABLE"); return stat(path); };
  const result = await inventoryMetadata(io, { entries: 20, bytes: 10000 });
  expect(result.complete).toBe(false);
  expect(result.failure).toContain("METADATA_UNREADABLE");
  expect(emitted.length).toBeGreaterThan(0);
  expect(result.payloadsRead).toBe(false);
});

test("invalid sizes and non-direct entries cannot escape the accounting boundary", async () => {
  const sizes = fixture(); sizes.rows["/fixture/library.a"]!.bytes = NaN;
  expect((await inventoryMetadata(sizes.io, { entries: 20, bytes: 10000 })).failure).toContain("INVALID_METADATA_SIZE");
  const names = fixture(); names.io.entries = async function* () { yield "../outside"; };
  expect((await inventoryMetadata(names.io, { entries: 20, bytes: 10000 })).failure).toContain("DIRECT_ENTRY_NAME_REQUIRED");
});

test("the fixed request separates lead metadata permission from operator host permission", async () => {
  const request = await Bun.file(new URL("./input-request.json", import.meta.url)).json();
  expect(request.llvm.maximumEntries).toBe(20000);
  expect(request.llvm.maximumRetainedOutputBytes).toBe(10 * 1024 * 1024);
  expect(request.llvm.metadataStreamLimitBytes).toBe(4 * 1024 * 1024 - 65536);
  expect(request.llvm.payloadReadsAuthorized).toBe(false);
  expect(request.operatorHost.agentMayExecuteHostPacket).toBe(false);
  expect(request.operatorHost.maximumPullInvocations).toBe(1);
  expect(request.operatorHost.combinedImageAndContainerInspectionDeadlineSeconds).toBe(60);
  for (const field of ["automaticRetryAuthorized", "copyingOrStagingAuthorized", "compilationAuthorized", "gpuExecutionAuthorized", "trainingAuthorized", "haltedArchivePipelineRenewed"]) expect(request[field]).toBe(false);
});

test("host inspection uses one pull and one combined bounded image/container worker", async () => {
  const script = await Bun.file(new URL("./inspect-builder.fish", import.meta.url)).text();
  expect(script.match(/\bdocker pull\b/g)).toHaveLength(1);
  expect(script.match(/\bdocker run\b/g)).toHaveLength(1);
  expect(script.match(/\bdocker rm\b/g)).toHaveLength(1);
  expect(script).toContain('timeout --signal=KILL 600s docker pull "$image"');
  expect(script).toContain('timeout --signal=KILL 60s (status fish-path) --no-config (status filename) --inspect');
  expect(script).toContain('timeout --signal=KILL 30s docker rm --force -- "$cid"');
  expect(script).toContain("docker run --pull=never --cpus=1 --memory=1g");
  expect(script).toContain('if test "$pull_status" -eq 0');
  expect(script).toContain('set cleanup_status $status');
  expect(script).toContain('set inspection_status $status');
  for (const forbidden of ["--gpus", "--privileged", "nvidia-smi", "cargo build", "cargo test", "apt-get", "sudo ", "--rm "]) expect(script).not.toContain(forbidden);
});

test("host tool inspection reports each failure, unresolved C++ libraries and cleanup separately", async () => {
  const script = await Bun.file(new URL("./inspect-builder.fish", import.meta.url)).text();
  expect(script).toContain('printf "COMMAND_EXIT=%s\\n" "$code"');
  expect(script).not.toContain("set -e");
  expect(script).toContain('[ "$library" = libstdc++.so ]');
  expect(script).toContain('if test "$run_attempted" -eq 1');
  expect(script).toContain("set -l cleanup_status 125");
  expect(script).toContain("remaining_container_invocations=0");
  expect(script).toContain("trainingReady=false");
  expect(script).toContain("OPERATOR_HOST_ONLY");
});

test("host receipt failures cannot turn into success and syntax attempts track launched stages", async () => {
  const script = await Bun.file(new URL("./inspect-builder.fish", import.meta.url)).text();
  expect(script).toContain("if not printf 'status=%s");
  expect(script).toContain('if not cat "$evidence/receipt.txt"\n        return 1');
  expect(script).toContain("FAIL_RECEIPT_WRITE");
  const verifier = await Bun.file(new URL("./verify-inputs.ts", import.meta.url)).text();
  expect(verifier).toContain('fishSyntaxAttempted: attemptedStages.includes("fish-syntax")');
  expect(verifier.indexOf("attemptedStages.push(command.name)")).toBeLessThan(verifier.indexOf("await runBounded(command.argv"));
});

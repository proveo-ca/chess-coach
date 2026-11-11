// SPEC: _spec/recovery.md
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { repository } from "./provision";
import { artifactIdentities, sha256 } from "./cuda-continuation";
import type { ArtifactId, ArtifactIdentity } from "./cuda-continuation";
import { acquireCLI, acquireExactArtifact, acquisitionFailureCode, acquisitionTestOnly, validateArtifactURL } from "./cuda-acquire";
import type { ArtifactReader, ArtifactResponse, ArtifactVerdict, FileIdentity, FileSnapshot, OperationState, TrustedArtifactIO } from "./cuda-acquire";
import { continuationFixture, jsonBytes } from "./cuda-continuation.test";

const fixtureBytes = new TextEncoder().encode("abc");
const fixtureIdentity = (artifact: ArtifactId): ArtifactIdentity => ({ ...artifactIdentities[artifact], byteLength: 3,
  sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" });
const fileIdentity = (data: Uint8Array): FileIdentity => ({ device: "1", inode: "2", byteLength: data.byteLength, mode: 0o100400, mtime: "1", ctime: "1" });
function fakeReader(data: Uint8Array, snapshot?: (call: number) => FileSnapshot): ArtifactReader {
  let calls = 0;
  return { snapshot: async () => snapshot ? snapshot(++calls) : { descriptor: fileIdentity(data), path: fileIdentity(data) },
    async *chunks() { for (let i = 0; i < data.byteLength; i++) yield data.subarray(i, i + 1); }, close: async () => {} };
}
const response = (chunks: Uint8Array[] = [fixtureBytes.subarray(0, 1), fixtureBytes.subarray(1)],
  status = 200, location: string | null = null, contentLength: string | null = "3"): ArtifactResponse => ({
  status, location, contentLength, async *chunks() { for (const chunk of chunks) yield chunk; }, cancel: async () => {},
});
const pass = (artifact: ArtifactId): ArtifactVerdict => ({ version: "chess-coach.cuda-artifact-acquisition.v1", artifact, status: "PASS",
  code: "VERIFIED_EXACT_ARTIFACT", bytes: 3, sha256: fixtureIdentity(artifact).sha256, cache: "PUBLISHED", trainingReady: false });

function fakeIO() {
  const events: string[] = [], urls: string[] = [], cache = new Map<ArtifactId, Uint8Array>(), states = new Map<ArtifactId, OperationState>();
  let staged = new Uint8Array(), publicationCount = 0, fetcher = async (_url: string): Promise<ArtifactResponse> => response();
  const io: TrustedArtifactIO = {
    readContinuation: async () => { events.push("continuation"); return continuationFixture(); },
    inspectOperation: async artifact => { events.push(`inspect:${artifact}`); return states.get(artifact) ?? null; },
    claimOperation: async artifact => { events.push(`claim:${artifact}`); if (states.has(artifact)) throw Error("EEXIST"); states.set(artifact, { claimed: true, verdict: null }); },
    finishOperation: async (artifact, verdict) => {
      events.push(`finish:${artifact}:${verdict.status}`);
      if (states.get(artifact)?.verdict) throw Error("EEXIST");
      states.set(artifact, { claimed: true, verdict });
    },
    openCache: async artifact => { events.push(`cache:${artifact}`); const bytes = cache.get(artifact); return bytes ? fakeReader(bytes) : null; },
    createStage: async artifact => {
      events.push(`stage:${artifact}`);
      return {
        async write(bytes) { const next = new Uint8Array(staged.byteLength + bytes.byteLength); next.set(staged); next.set(bytes, staged.byteLength); staged = next; },
        seal: async () => { events.push("seal"); }, reader: async () => fakeReader(staged), close: async () => { events.push("close"); },
      };
    },
    publish: async artifact => { events.push("publish"); publicationCount++; if (cache.has(artifact)) return "REUSED"; cache.set(artifact, new Uint8Array(staged)); return "PUBLISHED"; },
    fetch: async url => { events.push("fetch"); urls.push(url); return fetcher(url); },
  };
  return { io, events, urls, cache, states, get staged() { return staged; }, get publicationCount() { return publicationCount; },
    setFetch: (fetch: (url: string) => Promise<ArtifactResponse>) => { fetcher = fetch; } };
}
type Fake = ReturnType<typeof fakeIO>;
const run = (fake: Fake, artifact: ArtifactId = "llvm-archive", overrides: Partial<TrustedArtifactIO> = {}) =>
  acquisitionTestOnly.run(artifact, fixtureIdentity(artifact), { ...fake.io, ...overrides });

test("production identities close both exact public URLs, destinations, sizes and independent digests", () => {
  expect(artifactIdentities).toEqual({
    "llvm-archive": { name: "tracel-llvm-23.1.0-4-linux-x64.tar.xz",
      url: "https://github.com/tracel-ai/tracel-llvm/releases/download/v23.1.0-4/linux-x64.tar.xz", byteLength: 45439652,
      sha256: "c394bb1b10ac785f16d3d92d688a9343ba869f720e9cf9ca3f1abf2f401f165f",
      destination: "_work/gpu-owner-recovery/cache/home/.cache/tracel/tracel-llvm-23.1.0-4-linux-x64.tar.xz" },
    "llvm-checksums": { name: "tracel-llvm-23.1.0-4-linux-x64.checksums.json",
      url: "https://github.com/tracel-ai/tracel-llvm/releases/download/v23.1.0-4/linux-x64.checksums.json", byteLength: 297,
      sha256: "57780b96c702d2ac595c52da61961549450648b8d18f5b81b7a1d06afa83682d",
      destination: "_work/gpu-owner-recovery/cache/home/.cache/tracel/tracel-llvm-23.1.0-4-linux-x64.checksums.json" },
  });
  expect(Object.isFrozen(artifactIdentities)).toBe(true);
  expect(Object.isFrozen(artifactIdentities["llvm-archive"])).toBe(true);
});

test("unknown CLI, URL, path, flags and multi-artifact arguments fail before even a continuation read", async () => {
  const fake = fakeIO();
  for (const args of [[], ["download"], ["--help"], ["llvm-archive", "llvm-checksums"], ["llvm-archive", "--url", "https://evil.test"],
    ["https://github.com/x"], ["../archive"], ["LLVM-ARCHIVE"]]) {
    await expect(acquireCLI(args, fake.io)).rejects.toThrow("CLOSED_ACQUISITION_CLI_REQUIRED");
  }
  await expect(acquireExactArtifact("other" as ArtifactId, fake.io)).rejects.toThrow("CLOSED_ARTIFACT_REQUIRED");
  expect(fake.events).toEqual([]);
});

test("main awaits closed continuation validation before marker, filesystem and fetch effects", async () => {
  const fake = fakeIO();
  await expect(run(fake, "llvm-archive", { readContinuation: async () => { throw Error("MISSING_BINDING"); } })).rejects.toThrow();
  const input = continuationFixture();
  await expect(run(fake, "llvm-archive", { readContinuation: async () => ({ ...input, binding: undefined }) })).rejects.toThrow();
  expect(fake.events).toEqual([]);
  let release!: () => void;
  const pending = run(fake, "llvm-archive", { readContinuation: async () => { await new Promise<void>(resolve => { release = resolve; }); return input; } });
  await Promise.resolve(); expect(fake.events).toEqual([]); release();
  expect((await pending).status).toBe("PASS");
  expect(fake.events.slice(0, 4)).toEqual(["inspect:llvm-archive", "inspect:llvm-checksums", "claim:llvm-archive", "cache:llvm-archive"]);
});

test("small streaming vectors acquire both fixed IDs independently with one operation and no no-run qualification", async () => {
  for (const artifact of ["llvm-archive", "llvm-checksums"] as const) {
    const fake = fakeIO();
    if (artifact === "llvm-checksums") fake.states.set("llvm-archive", { claimed: true, verdict: pass("llvm-archive") });
    expect(await run(fake, artifact)).toEqual(pass(artifact));
    expect(fake.urls).toEqual([artifactIdentities[artifact].url]);
    expect(fake.cache.get(artifact)).toEqual(fixtureBytes);
    expect(fake.staged).toEqual(fixtureBytes);
    expect(fake.publicationCount).toBe(1);
    expect(fake.events.indexOf("seal")).toBeLessThan(fake.events.indexOf("publish"));
    expect([...fake.states.values()].every(state => state.verdict?.trainingReady === false)).toBe(true);
  }
});

test("production entry never consumes the injectable small identity", async () => {
  for (const artifact of ["llvm-archive", "llvm-checksums"] as const) {
    const fake = fakeIO();
    if (artifact === "llvm-checksums") fake.states.set("llvm-archive", { claimed: true, verdict: pass("llvm-archive") });
    const result = await acquireCLI([artifact], fake.io);
    expect(result.status).toBe("FAIL"); expect(result.code).toBe("CONTENT_LENGTH_MISMATCH");
    expect(fake.urls).toEqual([artifactIdentities[artifact].url]);
    expect(fake.publicationCount).toBe(0);
  }
});

test("wrong length, oversize and digest retain bounded partial bytes without publishing or retrying", async () => {
  for (const [chunks, code, bytes] of [
    [[new Uint8Array([97, 98])], "ARTIFACT_LENGTH_MISMATCH", 2],
    [[new Uint8Array([97, 98, 99, 100])], "ARTIFACT_BYTE_LIMIT", 3],
    [[new Uint8Array([97]), new Uint8Array([98, 99]), new Uint8Array([100])], "ARTIFACT_BYTE_LIMIT", 3],
    [[new Uint8Array([120, 121, 122])], "ARTIFACT_DIGEST_MISMATCH", 3],
  ] as const) {
    const fake = fakeIO(); fake.setFetch(async () => response([...chunks], 200, null, null));
    const result = await run(fake);
    expect(result.status).toBe("FAIL"); expect(result.code).toBe(code); expect(result.bytes).toBe(bytes);
    expect(fake.staged.byteLength).toBe(bytes); expect(fake.cache.size).toBe(0); expect(fake.publicationCount).toBe(0); expect(fake.urls).toHaveLength(1);
  }
  for (const length of ["0", "2", "4", "03", "3x", "99999999999999999999999999999"]) {
    const fake = fakeIO(); fake.setFetch(async () => response([], 200, null, length));
    expect((await run(fake)).code).toBe("CONTENT_LENGTH_MISMATCH"); expect(fake.staged.byteLength).toBe(0);
  }
});

test("manual GET redirect accepts only exact HTTPS hosts and at most three hops without retry budgets", async () => {
  const fake = fakeIO();
  fake.setFetch(async () => fake.urls.length <= 3 ? response([], 302,
    `https://release-assets.githubusercontent.com/fixed${fake.urls.length}?signed=secret${fake.urls.length}`) : response());
  const result = await run(fake);
  expect(result.status).toBe("PASS"); expect(fake.urls).toHaveLength(4); expect(JSON.stringify(result)).not.toContain("secret");
  const tooMany = fakeIO(); tooMany.setFetch(async () => response([], 307, `https://github.com/${tooMany.urls.length}`));
  expect((await run(tooMany)).code).toBe("REDIRECT_LIMIT"); expect(tooMany.urls).toHaveLength(4);
  const loop = fakeIO(); loop.setFetch(async () => response([], 301, artifactIdentities["llvm-archive"].url));
  expect((await run(loop)).code).toBe("REDIRECT_LOOP"); expect(loop.urls).toHaveLength(1);
});

test("unknown host, lookalike, scheme, credentials, non-443 port and downgrade redirect never reach a second fetch", async () => {
  for (const target of ["https://evil.test/a?token=hidden", "https://github.com.evil.test/a", "https://release-assets.githubusercontent.com.evil.test/a",
    "http://github.com/a", "file:///etc/passwd", "ftp://github.com/a", "https://user:secret@github.com/a", "https://github.com:444/a",
    "https://github.com/a#fragment", "https://github.com./a", "data:text/plain,secret"]) {
    const fake = fakeIO(); fake.setFetch(async () => response([], 302, target));
    const result = await run(fake);
    expect(result.code).toBe("REDIRECT_URL_REJECTED"); expect(fake.urls).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("secret"); expect(JSON.stringify(result)).not.toContain("hidden");
  }
  expect(validateArtifactURL("https://github.com:443/a?signature=allowed").hostname).toBe("github.com");
});

test("network, signed URL, body and HTTP failures expose sanitized codes only", async () => {
  const raw = "https://release-assets.githubusercontent.com/a?X-Amz-Credential=secret Location: private response-body";
  const network = fakeIO(); network.setFetch(async () => { throw Error(raw); });
  const result = await run(network);
  expect(result.code).toBe("FETCH_FAILED"); expect(JSON.stringify(result)).not.toContain(raw); expect(network.urls).toHaveLength(1);
  const body = fakeIO(); body.setFetch(async () => ({ ...response(), async *chunks() { yield new Uint8Array([97]); throw Error(raw); } }));
  const bodyResult = await run(body); expect(bodyResult.code).toBe("FETCH_BODY_FAILED"); expect(bodyResult.bytes).toBe(1);
  expect(JSON.stringify(bodyResult)).not.toContain("secret"); expect(acquisitionFailureCode(Error(raw))).toBe("ACQUISITION_FAILED");
  for (const status of [204, 206, 400, 404, 429, 500, 503]) {
    const fake = fakeIO(); fake.setFetch(async () => response([], status, raw));
    expect((await run(fake)).code).toBe(`HTTP_STATUS_${status}`); expect(fake.urls).toHaveLength(1);
  }
  const missingLocation = fakeIO(); missingLocation.setFetch(async () => response([], 302));
  expect((await run(missingLocation)).code).toBe("REDIRECT_LOCATION_REQUIRED");
});

test("preexisting cache reuse requires fresh regular-file identity, exact length and digest without network", async () => {
  const fake = fakeIO(); fake.cache.set("llvm-archive", fixtureBytes);
  const result = await run(fake); expect(result.status).toBe("PASS"); expect(result.cache).toBe("REUSED");
  expect(fake.urls).toEqual([]); expect(fake.publicationCount).toBe(0);
  for (const bytes of [new Uint8Array([1, 2, 3]), new Uint8Array([97, 98]), new Uint8Array([97, 98, 99, 100])]) {
    const conflict = fakeIO(); conflict.cache.set("llvm-archive", bytes);
    expect((await run(conflict)).status).toBe("FAIL"); expect(conflict.cache.get("llvm-archive")).toEqual(bytes);
    expect(conflict.urls).toHaveLength(0); expect(conflict.publicationCount).toBe(0);
  }
});

test("symlink, path/descriptor mismatch and identity drift reject cache entries without overwrite", async () => {
  const fake = fakeIO();
  const symlink = await run(fake, "llvm-archive", { openCache: async () => { throw Error("ELOOP symlink"); } });
  expect(symlink.status).toBe("FAIL"); expect(fake.urls).toEqual([]);
  for (const snapshot of [
    () => ({ descriptor: fileIdentity(fixtureBytes), path: { ...fileIdentity(fixtureBytes), inode: "99" } }),
    () => ({ descriptor: { ...fileIdentity(fixtureBytes), mode: 0o120777 }, path: { ...fileIdentity(fixtureBytes), mode: 0o120777 } }),
    (call: number) => ({ descriptor: { ...fileIdentity(fixtureBytes), mtime: String(call) }, path: { ...fileIdentity(fixtureBytes), mtime: String(call) } }),
  ]) {
    const changed = fakeIO();
    const verdict = await run(changed, "llvm-archive", { openCache: async () => fakeReader(fixtureBytes, snapshot) });
    expect(verdict.status).toBe("FAIL"); expect(changed.urls).toEqual([]); expect(changed.publicationCount).toBe(0);
  }
});

test("exclusive publication races reuse only verified identical bytes and never overwrite a conflicting winner", async () => {
  for (const identical of [true, false]) {
    const fake = fakeIO(), winner = identical ? fixtureBytes : new Uint8Array([1, 2, 3]);
    const result = await run(fake, "llvm-archive", { publish: async () => { fake.cache.set("llvm-archive", winner); return "REUSED"; } });
    expect(result.status).toBe(identical ? "PASS" : "FAIL"); expect(fake.cache.get("llvm-archive")).toEqual(winner);
    if (identical) expect(result.cache).toBe("REUSED");
    else expect(result.code).toBe("CACHE_DIGEST_MISMATCH");
  }
  const fake = fakeIO();
  const failed = await run(fake, "llvm-archive", { publish: async () => { throw Error("ENOSPC"); } });
  expect(failed.status).toBe("FAIL"); expect(fake.staged).toEqual(fixtureBytes);
});

test("completed operations cannot replay, and missing markers or incomplete operations halt the sequence", async () => {
  const fake = fakeIO(); expect((await run(fake)).status).toBe("PASS");
  const events = fake.events.length;
  await expect(run(fake)).rejects.toThrow("ARTIFACT_OPERATION_ALREADY_CONSUMED");
  expect(fake.events.slice(events)).toEqual(["continuation", "inspect:llvm-archive", "inspect:llvm-checksums"]);
  for (const state of [{ claimed: true, verdict: null }, { claimed: false, verdict: pass("llvm-archive") }]) {
    const incomplete = fakeIO(); incomplete.states.set("llvm-archive", state);
    await expect(run(incomplete, "llvm-checksums")).rejects.toThrow("SEQUENCE_HALTED_OR_INCOMPLETE");
    expect(incomplete.urls).toEqual([]);
  }
  await expect(run(fakeIO(), "llvm-checksums")).rejects.toThrow("ARCHIVE_OPERATION_REQUIRED_FIRST");
});

test("first actual artifact failure blocks the second artifact and creates no automatic retry", async () => {
  const fake = fakeIO(); fake.setFetch(async () => { throw Error("NETWORK_FAILURE"); });
  expect((await run(fake)).status).toBe("FAIL");
  await expect(run(fake, "llvm-checksums")).rejects.toThrow("SEQUENCE_HALTED_OR_INCOMPLETE");
  await expect(run(fake)).rejects.toThrow("SEQUENCE_HALTED_OR_INCOMPLETE");
  expect(fake.urls).toHaveLength(1); expect(fake.states.has("llvm-checksums")).toBe(false);
});

test("a lost or failed verdict write leaves the claimed operation fail-closed", async () => {
  const fake = fakeIO();
  await expect(run(fake, "llvm-archive", { finishOperation: async () => { throw Error("RECEIPT_WRITE_FAILED"); } })).rejects.toThrow();
  await expect(run(fake, "llvm-checksums")).rejects.toThrow("SEQUENCE_HALTED_OR_INCOMPLETE");
});

test("PASS bytes remain non-consumable until write, sync and close all succeed", async () => {
  for (const fault of ["write", "sync", "close"] as const) {
    const fake = fakeIO(), pending = new Map<string, Uint8Array>(), events: string[] = [];
    const result = await run(fake, "llvm-archive", { finishOperation: (artifact, verdict) => acquisitionTestOnly.commitVerdict(artifact, verdict, {
      async openStage(_artifact, status) {
        events.push(`open:${status}`);
        return {
          async write(bytes) { pending.set(status, bytes); events.push(`write:${status}`); if (status === "PASS" && fault === "write") throw Error("after visible PASS bytes"); },
          async sync() { events.push(`sync:${status}`); if (status === "PASS" && fault === "sync") throw Error("sync failed"); },
          async close() { events.push(`close:${status}`); if (status === "PASS" && fault === "close") throw Error("close failed"); },
        };
      },
      async publish(selected, status) {
        events.push(`publish:${status}`);
        const committed = JSON.parse(new TextDecoder().decode(pending.get(status)!)) as ArtifactVerdict;
        fake.states.set(selected, { claimed: true, verdict: committed });
      },
    }) });
    expect(JSON.parse(new TextDecoder().decode(pending.get("PASS")!)).status).toBe("PASS");
    expect(events).not.toContain("publish:PASS");
    expect(events).toContain("close:PASS");
    expect(result.status).toBe("FAIL");
    expect(result.code).toBe(`VERDICT_${fault.toUpperCase()}_FAILED`);
    expect(fake.states.get("llvm-archive")?.verdict?.status).toBe("FAIL");
    await expect(run(fake, "llvm-checksums")).rejects.toThrow("SEQUENCE_HALTED_OR_INCOMPLETE");
    expect(fake.urls).toHaveLength(1);
  }
});

test("verdict publication is the last commit action and close failure retains the first failure", async () => {
  const events: string[] = [];
  const io = {
    async openStage() { return { write: async () => { events.push("write"); }, sync: async () => { events.push("sync"); }, close: async () => { events.push("close"); } }; },
    publish: async () => { events.push("publish"); },
  };
  await acquisitionTestOnly.commitVerdict("llvm-archive", pass("llvm-archive"), io);
  expect(events).toEqual(["write", "sync", "close", "publish"]);
  await expect(acquisitionTestOnly.commitVerdict("llvm-archive", pass("llvm-archive"), { ...io,
    openStage: async () => ({ write: async () => { throw Error("first"); }, sync: async () => { throw Error("must not sync"); }, close: async () => { throw Error("second"); } }),
  })).rejects.toThrow("VERDICT_WRITE_FAILED");
});

test("production source uses manual credential-free GET, no-follow exclusive files, fixed receipts and no native operations", async () => {
  const source = await readFile(resolve(repository, "_work/gpu-owner-recovery/cuda-acquire.ts"), "utf8");
  for (const text of ['method: "GET"', 'credentials: "omit"', 'redirect: "manual"', '"AMBIENT_PROXY_FORBIDDEN"', 'decompress: false', '"Accept-Encoding": "identity"', "constants.O_NOFOLLOW", "constants.O_EXCL",
    '"artifact.json"', '".operation"', '"artifact.partial"']) expect(source).toContain(text);
  for (const pattern of [/Bun\.(?:spawn|\$)/, /\b(?:exec|execFile|spawn|spawnSync|execSync|execFileSync)\s*\(/, /\brunBounded\s*\(/,
    /\bset(?:Timeout|Interval)\s*\(/, /AbortSignal\.timeout/, /\b(?:unlink|rm|rename)\s*\(/, /process\.env\.(?:HOME|PATH)/,
    /\.\/cuda-isolation["']/]) expect(source).not.toMatch(pattern);
  expect(source.match(/await fetch\(/g)).toHaveLength(1);
  expect(sha256(fixtureBytes)).toBe(fixtureIdentity("llvm-archive").sha256);
  expect(jsonBytes(pass("llvm-archive")).byteLength).toBeLessThan(4096);
});

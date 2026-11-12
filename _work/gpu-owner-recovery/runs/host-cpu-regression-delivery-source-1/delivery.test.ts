// SPEC: _spec/gpu-qualification.puml
import { expect, test } from "bun:test";
import { bindAcceptedCanonical, blobBinding, handoff, renderDelivery, sourceBytesChanged, verifyFetched } from "./delivery";

const bytes = Buffer.from("fish --no-config -c 'exit 0'\n"), expected = blobBinding(bytes);
test("delivery binds canonical bytes to the accepted CPU proof rather than a later edited file", () => {
  const path = "canonical-host-command.fish", programs = [{ path, sha256: expected.sha256 }];
  expect(bindAcceptedCanonical(bytes, path, programs)).toEqual(expected);
  for (const rows of [[], [{ ...programs[0]!, path: "other.fish" }], [programs[0]!, programs[0]!]]) expect(() => bindAcceptedCanonical(bytes, path, rows)).toThrow("CPU_PROOF_CANONICAL_PROGRAM_BINDING_REQUIRED");
  expect(() => bindAcceptedCanonical(Buffer.alloc(bytes.length), path, programs)).toThrow("CPU_PROOF_CANONICAL_PROGRAM_BINDING_REQUIRED");
});
test("a canonical edit after the bound snapshot remains source drift instead of a new baseline", async () => {
  const sources = [{ path: "canonical-host-command.fish", sha256: expected.sha256 }];
  expect(await sourceBytesChanged(sources, async () => bytes)).toBe(false);
  expect(await sourceBytesChanged(sources, async () => Buffer.alloc(bytes.length))).toBe(true);
  expect(sources[0]!.sha256).toBe(expected.sha256);
});
test("fixed Git blob identity includes the Git length header and exact SHA-256", () => {
  expect(expected.bytes).toBe(bytes.length); expect(expected.gitBlobSha).toMatch(/^[a-f0-9]{40}$/); expect(expected.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(blobBinding(Buffer.concat([bytes, Buffer.from("\n")]))).not.toEqual(expected);
  expect(() => blobBinding(Buffer.alloc(131072))).toThrow("BOUNDED_CANONICAL_FISH_BYTES_REQUIRED");
});
test("all three pipeline statuses, exact length and exact digest gate launch", () => {
  expect(() => verifyFetched(bytes, expected, [0, 0, 0])).not.toThrow();
  for (const statuses of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0], [0, 0, 0, 0]]) expect(() => verifyFetched(bytes, expected, statuses)).toThrow("FETCH_DECODE_AND_BOUND_PIPELINE_REQUIRED");
  for (const value of [bytes.subarray(1), Buffer.concat([bytes, Buffer.from("x")]), Buffer.alloc(bytes.length)]) expect(() => verifyFetched(value, expected, [0, 0, 0])).toThrow("EXACT_PUBLISHED_SCRIPT_BYTES_REQUIRED");
});
test("Fish delivery uses one immutable HTTPS blob fetch with overflow detection and no fallback", () => {
  const { body, command } = renderDelivery(expected);
  expect(body.match(/command gh api/g)).toHaveLength(1);
  expect(body).toContain("--hostname github.com repos/proveo-ca/chess-coach/git/blobs/" + expected.gitBlobSha + " --jq .content");
  expect(body).toContain("head --bytes=" + (expected.bytes + 1)); expect(body).toContain("set -l codes $pipestatus");
  expect(body).toContain("test $code -eq 0; or exit 1"); expect(body).toContain("-eq " + expected.bytes);
  expect(body).toContain(expected.sha256 + "  " + handoff + "/canonical-host-command.fish");
  expect(command.indexOf("30s fish --no-config -c")).toBeLessThan(command.lastIndexOf("command fish --no-config"));
  expect(command).toContain("--kill-after=2s"); expect(body).toContain("command mkdir -- '");
  for (const forbidden of ["mkdir -p", "git checkout", "git fetch", "curl", "wget", "mise install", "rm ", "--paginate", "--retry"]) expect(command).not.toContain(forbidden);
});
test("renderer rejects malformed literal identities rather than interpolating commands", () => {
  for (const binding of [{ ...expected, gitBlobSha: ";touch bad" }, { ...expected, sha256: "0".repeat(63) }, { ...expected, bytes: NaN }, { ...expected, bytes: 131072 }]) expect(() => renderDelivery(binding)).toThrow("LITERAL_BLOB_BINDING_REQUIRED");
});

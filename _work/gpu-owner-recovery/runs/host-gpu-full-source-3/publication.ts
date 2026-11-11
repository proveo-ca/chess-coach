// SPEC: _spec/gpu-full-qualification.puml
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runBounded } from "../../verify";

export const root = "_work/gpu-owner-recovery/runs/host-gpu-full-source-3/";
const parent = "250d438685d2fc7560b0e31439f282bb2c145888", branch = "feat-ml-adjuntant-ii", destination = "https://github.com/proveo-ca/chess-coach.git";
const documents = [".spec-index.json", "gate-closure.md", "gpu-build.puml", "gpu-feasibility.puml", "gpu-full-qualification.puml", "gpu-host-build-inventory.puml", "gpu-host-build-reuse.puml", "gpu-host-build.puml", "gpu-host-receive.puml", "gpu-input-transfer.puml", "gpu-qualification.puml", "gpu-readiness.md"].map(path => "_spec/" + path);
const roots = ["_work/gpu-owner-recovery/qualification/host-full/", ...["host-full-plan-source-1", "host-full-regression-source-1", "host-gpu-feasibility-observation-1", "host-gpu-full-source-1", "host-gpu-full-source-2", "host-gpu-full-source-3"].map(name => "_work/gpu-owner-recovery/runs/" + name + "/"), "_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/publication-actions/"];
const oldPost = ["publication-attempt.json", "publication-result.json", "publication-staging.json", "push-attempt.json"].map(path => "_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/" + path);
export const post = (path: string) => path.startsWith(root + "publication-actions/") || ["publication-attempt.json", "publication-result.json", "publication-staging.json", "push-attempt.json"].some(name => path === root + name);
const control = (path: string) => path.startsWith(root + "publication");
const json = async (path: string) => JSON.parse(await readFile(path, "utf8"));
export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export const blob = (bytes: Uint8Array) => createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
export function allowed(path: string) {
  return /^[A-Za-z0-9_./-]+$/.test(path) && !path.split("/").includes("..") && !/(?:^|\/)(?:home|tmp|cache|node_modules|target|target-gpu|dist|scratch)(?:\/|$)/.test(path)
    && /\.(?:json|ts|puml|md|mjs|fish|stdout|stderr|txt|ndjson)$/.test(path) && (documents.includes(path) || roots.some(prefix => path.startsWith(prefix)) || oldPost.includes(path));
}
type Row = { path: string; bytes: number; sha256: string; blob: string; mode: string };
async function row(path: string): Promise<Row> {
  assert.ok(allowed(path), "PUBLICATION_SCOPE:" + path);
  const metadata = await lstat(path); assert.ok(metadata.isFile() && !metadata.isSymbolicLink() && metadata.size <= 4194304, "REGULAR_BOUNDED_TEXT_REQUIRED:" + path);
  const bytes = await readFile(path); assert.ok(!bytes.includes(0), "NUL_NOT_ALLOWED:" + path); new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return { path, bytes: bytes.length, sha256: sha256(bytes), blob: blob(bytes), mode: metadata.mode & 0o111 ? "100755" : "100644" };
}
const save = async (path: string, data: unknown) => writeFile(path, JSON.stringify(data, null, 2) + "\n", { flag: "wx" });
const lines = (text: string) => text.trimEnd().split("\n").filter(Boolean);
const sorted = (paths: string[]) => [...new Set(paths)].sort();
export const publicationRef = async (path: string) => ({ path, sha256: sha256(await readFile(path)), mode: (await lstat(path)).mode & 0o111 ? "100755" : "100644" });
const ref = publicationRef;
export function reviewedMode(expected: string, actual: number) { assert.equal(actual & 0o111 ? "100755" : "100644", expected, "REVIEWED_MODE_CHANGED"); }
export function validateReviewBinding(review: { status: string; check: { path: string; sha256: string; mode: string } }, expected: { path: string; sha256: string; mode: string }) {
  assert.equal(review.status, "READY_TO_PUBLISH_EXACT_BOUNDED_TEXT_GENERATION"); assert.deepEqual(review.check, expected, "CURRENT_REVIEW_CHECK_BINDING_REQUIRED");
}
async function unchanged(value: { path: string; sha256: string; mode?: string }) {
  assert.equal(sha256(await readFile(value.path)), value.sha256, value.path);
  if (value.mode !== undefined) reviewedMode(value.mode, (await lstat(value.path)).mode);
}
function commands(directory: string) {
  const results: any[] = [], environment = { ...Object.fromEntries(Object.entries(process.env).filter((r): r is [string, string] => r[1] !== undefined)), GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never", GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1" };
  return { results, async run(id: string, argv: string[], expected = [0], timeout = 30000) {
    const path = directory + "/" + id; await mkdir(path, { recursive: true });
    const result = await runBounded(argv, resolve(path), timeout, { cwd: process.cwd(), environment });
    const streams = await Promise.all(["stdout", "stderr"].map(async stream => { const file = path + "/command." + stream, bytes = await readFile(file); return { path: file, bytes: bytes.length, sha256: sha256(bytes) }; }));
    results.push({ id, argv, ...result, expectedExitCodes: expected, streams });
    assert.ok(expected.includes(result.exitCode) && result.failure === null, "PUBLICATION_COMMAND_FAILED:" + id);
    return await readFile(path + "/command.stdout", "utf8");
  } };
}
async function transport(directory: string) {
  const io = commands(directory); let failure: string | null = null;
  try {
    assert.equal((await io.run("head", ["git", "rev-parse", "--verify", "HEAD"])).trim(), parent);
    assert.equal((await io.run("branch", ["git", "symbolic-ref", "-q", "HEAD"])).trim(), "refs/heads/" + branch);
    assert.equal((await io.run("staged", ["git", "diff", "--cached", "--name-only"])).trim(), "");
    const fallback = (await io.run("hooks", ["git", "rev-parse", "--git-path", "hooks"])).trim();
    const configured = (await io.run("hook-config", ["git", "config", "--path", "--get", "core.hooksPath"], [0, 1])).trim(), hooks = resolve(configured || fallback);
    const active: string[] = [];
    for (const name of await readdir(hooks).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return []; throw error; })) {
      if (name.endsWith(".sample")) continue;
      const entry = await lstat(resolve(hooks, name)); if (entry.isSymbolicLink() || (entry.mode & 0o111) !== 0) active.push(name);
    }
    assert.equal(active.length, 0, "ACTIVE_HOOK_REQUIRES_OPERATOR_DECISION");
    const rewrites = lines(await io.run("rewrites", ["git", "config", "--get-regexp", "^url\\..*\\.(insteadof|pushinsteadof)$"], [0, 1]));
    assert.ok(rewrites.every(line => { const match = line.match(/^\S+\s+(.*)$/); return match && !destination.startsWith(match[1]!); }), "APPLICABLE_URL_REWRITE_REQUIRES_OPERATOR_DECISION");
  } catch (error) { failure = String(error); }
  return { status: failure === null ? "PASS_READ_ONLY_PUBLICATION_PREFLIGHT" : "FAIL_READ_ONLY_PUBLICATION_PREFLIGHT", failure, parent, branch, destination, transportPolicy: "EXISTING_FIXED_HTTPS_POLICY_UNCHANGED", identityAndAuthentication: "EXISTING_INHERITED_ONLY_NOT_PRINTED_OR_CHANGED", results: io.results, commitInvocations: 0, pushInvocations: 0, trainingReady: false };
}
async function names(io: ReturnType<typeof commands>) {
  const paths = sorted([...lines(await io.run("tracked", ["git", "diff", "--name-only"])), ...lines(await io.run("untracked", ["git", "ls-files", "--others", "--exclude-standard"]))]).filter(path => !post(path));
  assert.ok(paths.length > 0 && paths.length <= 1500 && paths.every(allowed), "EXACT_BOUNDED_PUBLICATION_SCOPE_REQUIRED");
  return paths;
}
async function prepare() {
  assert.equal((await json(root + "publication-preflight-2.json")).status, "PASS_READ_ONLY_PUBLICATION_PREFLIGHT");
  const request = await json(root + "publication-request.json"), proof = await json(root + "receipt.json");
  assert.equal(request.parentCommit, parent); assert.equal(request.destination, destination); assert.equal(request.branch, branch);
  await unchanged(request.sourceProof); await unchanged(request.command); await unchanged(request.hostApproval);
  for (const source of proof.sources) await unchanged(source);
  assert.equal(proof.sources.length, 347); assert.equal(proof.status, "PASS_GPU_FULL_SOURCE_ONLY");
  const io = commands(root + "publication-prepare-2"), paths = await names(io), data = await Promise.all(paths.filter(path => !control(path)).map(row));
  assert.ok(data.reduce((sum, value) => sum + value.bytes, 0) <= 33554432, "BOUNDED_TEXT_PACKET_REQUIRED");
  const attrs = await io.run("attributes", ["git", "--literal-pathspecs", "check-attr", "--all", "--", ...paths]);
  assert.ok(!/^.*: (?:filter|working-tree-encoding|eol): (?!unset$|unspecified$).+$/m.test(attrs), "BYTE_TRANSFORMING_ATTRIBUTES_REQUIRE_OPERATOR_DECISION");
  const index = await json("_spec/.spec-index.json");
  for (const path of documents.filter(path => path.endsWith(".puml"))) {
    const covers = [...(await readFile(path, "utf8")).matchAll(/^' covers: (.+)$/gm)].map(match => match[1]!);
    assert.deepEqual(index.specs.find((value: { spec: string }) => value.spec === path).covers, covers, path);
  }
  const payloadPath = root + "publication-payload-2.json", checkPath = root + "publication-check-2.json";
  await save(payloadPath, { status: "FROZEN_BOUNDED_TEXT_PAYLOAD", request: await ref(root + "publication-request.json"), files: data });
  const controls = await Promise.all(sorted([...paths.filter(control), ...io.results.flatMap(value => value.streams.map((stream: { path: string }) => stream.path))]).map(row));
  await save(checkPath, { status: "PASS_CURRENT_PUBLICATION_PAYLOAD_AND_BINDINGS_ONLY", payload: await ref(payloadPath), controls,
    expectedControls: sorted([...controls.map(value => value.path), payloadPath, checkPath, root + "publication-review-2.json", root + "publication-envelope.json"]),
    results: io.results, sourceHashesChecked: 347, protectedFeasibilitySourcesChecked: 327, orderedDiagramIndexMatches: 9, currentDocHashes: 12,
    hostAllowance: "ISSUED_ONE_OPERATOR_ATTEMPT_UNOBSERVED_NOT_RENEWED", actualHostOperations: 0, trainingReady: false });
}
async function freeze() {
  const checkPath = root + "publication-check-2.json", reviewPath = root + "publication-review-2.json";
  const check = await json(checkPath), review = await json(reviewPath), payload = await json(check.payload.path);
  assert.equal(check.status, "PASS_CURRENT_PUBLICATION_PAYLOAD_AND_BINDINGS_ONLY"); validateReviewBinding(review, await ref(checkPath));
  assert.equal((await ref(reviewPath)).mode, "100644");
  await unchanged(review.check); await unchanged(check.payload);
  for (const value of [...payload.files, ...check.controls]) await unchanged(value);
  const io = commands(root + "publication-freeze"), actual = await names(io);
  const anticipated = sorted([...payload.files.map((value: Row) => value.path), ...check.expectedControls]);
  const generated = io.results.flatMap(value => value.streams.map((stream: { path: string }) => stream.path));
  const members = sorted([...anticipated, ...generated]);
  assert.deepEqual(sorted([...actual, root + "publication-envelope.json", ...generated]), members);
  const files = await Promise.all(members.filter(path => path !== root + "publication-envelope.json").map(row));
  await save(root + "publication-envelope.json", { status: "FROZEN_REVIEWED_TEXT_PUBLICATION_ENVELOPE", parent, branch, destination,
    request: await ref(root + "publication-request.json"), payload: await ref(check.payload.path), check: await ref(checkPath), review: await ref(reviewPath),
    members, files, selfReference: "PATH_ONLY_NO_SELF_HASH_OR_FUTURE_COMMIT_ID", postActionRecordsExcluded: true });
}
export const pushArgv = (commit: string) => ["git", "push", "--porcelain", "--no-follow-tags", "--recurse-submodules=no", destination, commit + ":refs/heads/" + branch];
async function publish() {
  assert.equal(Bun.argv[3], "--approved-publication-source-3");
  const request = await json(root + "publication-request.json"), envelopePath = root + "publication-envelope.json", envelope = await json(envelopePath);
  assert.equal(request.status, "APPROVED_ONE_NORMAL_COMMIT_AND_FIXED_HTTPS_PUSH_PENDING");
  assert.equal(request.normalCommitInvocationsAuthorized, 1); assert.equal(request.fixedHttpsPushInvocationsAuthorized, 1);
  assert.equal(envelope.parent, parent); assert.equal(envelope.branch, branch); assert.equal(envelope.destination, destination);
  for (const value of envelope.files) await unchanged(value);
  const envelopeRow = await row(envelopePath); assert.equal(envelopeRow.mode, "100644");
  const expected: Row[] = [...envelope.files, envelopeRow].sort((a, b) => a.path.localeCompare(b.path));
  assert.deepEqual(sorted(expected.map(value => value.path)), envelope.members);
  const preflight = await transport(root + "publication-actions/preflight"); assert.equal(preflight.status, "PASS_READ_ONLY_PUBLICATION_PREFLIGHT");
  const io = commands(root + "publication-actions"); let commit: string | null = null, committed = 0, pushed = 0, failure: string | null = null;
  try {
    const current = await names(io); assert.deepEqual(current, envelope.members);
    const argv = ["git", "--literal-pathspecs", "add", "--", ...envelope.members]; assert.ok(argv.join("\0").length < 120000);
    await io.run("stage", argv);
    assert.deepEqual(sorted(lines(await io.run("staged-members", ["git", "diff", "--cached", "--name-only"]))), envelope.members);
    const blobs = lines(await io.run("staged-blobs", ["git", "--literal-pathspecs", "ls-files", "--stage", "--", ...envelope.members]));
    const actual = blobs.map(line => { const [metadata, path] = line.split("\t"), [mode, oid, stage] = metadata!.split(" "); assert.equal(stage, "0"); return { path, mode, blob: oid }; }).sort((a, b) => a.path!.localeCompare(b.path!));
    assert.deepEqual(actual, expected.map(({ path, mode, blob }) => ({ path, mode, blob })));
    const tree = (await io.run("staged-tree", ["git", "write-tree"])).trim();
    await save(root + "publication-staging.json", { status: "PASS_EXACT_REVIEWED_TEXT_PACKET_STAGED", envelope: await ref(envelopePath), tree, expected, preflight, results: [...io.results] });
    assert.equal((await io.run("head-before-commit", ["git", "rev-parse", "HEAD"])).trim(), parent);
    await save(root + "publication-attempt.json", { status: "NORMAL_COMMIT_ATTEMPT_REGISTERED", request: root + "publication-request.json", parentCommit: parent, normalCommitInvocationsConsumed: 1, automaticRetryAuthorized: false }); committed = 1;
    await io.run("commit", ["git", "commit", "-m", "Prepare full-six F64 GPU HOST qualification handoff"], [0], 120000);
    commit = (await io.run("committed-head", ["git", "rev-parse", "HEAD"])).trim(); assert.match(commit, /^[a-f0-9]{40}$/); assert.notEqual(commit, parent);
    assert.equal((await io.run("committed-parent", ["git", "rev-list", "--parents", "-n", "1", commit])).trim(), commit + " " + parent);
    assert.equal((await io.run("committed-tree", ["git", "rev-parse", commit + "^{tree}"])).trim(), tree);
    assert.deepEqual(sorted(lines(await io.run("committed-members", ["git", "diff-tree", "--no-commit-id", "--name-only", "-r", commit]))), envelope.members);
    const entries = lines(await io.run("committed-blobs", ["git", "--literal-pathspecs", "ls-tree", "-r", commit, "--", ...envelope.members])).map(line => { const [metadata, path] = line.split("\t"), [mode, kind, oid] = metadata!.split(" "); assert.equal(kind, "blob"); return { path, mode, blob: oid }; }).sort((a, b) => a.path!.localeCompare(b.path!));
    assert.deepEqual(entries, expected.map(({ path, mode, blob }) => ({ path, mode, blob })));
    await unchanged(request.command); await unchanged(request.sourceProof); await unchanged(request.hostApproval);
    await save(root + "push-attempt.json", { status: "FIXED_HTTPS_PUSH_ATTEMPT_REGISTERED", commit, branch, destination, fixedHttpsPushInvocationsConsumed: 1, automaticRetryAuthorized: false }); pushed = 1;
    await io.run("push", pushArgv(commit), [0], 120000);
  } catch (error) { failure = String(error); }
  const result = { status: failure === null ? "PASS_SOURCE_THREE_NORMAL_COMMIT_AND_FIXED_HTTPS_PUSH" : "FAIL_SOURCE_THREE_PUBLICATION", failure, request: root + "publication-request.json", parentCommit: parent,
    commit, branch, destination, normalCommitInvocationsConsumed: committed, fixedHttpsPushInvocationsConsumed: pushed, remainingNormalCommits: 1 - committed, remainingHttpsPushes: 1 - pushed,
    automaticRetryAuthorized: false, stagedMembers: expected.length, results: io.results, hostAllowanceUnchanged: true, hostInvocationObserved: false, codingHostOperationsPerformed: false, trainingReady: false };
  await save(root + "publication-result.json", result); console.log(JSON.stringify(result)); assert.equal(failure, null);
}
async function main() {
  const mode = Bun.argv[2]; assert.equal(Bun.version, "1.4.0");
  if (mode === "preflight") { const result = await transport(root + "publication-preflight-2"); await save(root + "publication-preflight-2.json", result); assert.equal(result.failure, null); }
  else if (mode === "prepare") await prepare(); else if (mode === "freeze") await freeze(); else if (mode === "publish") await publish();
  else throw Error("CLOSED_PUBLICATION_PHASE_REQUIRED");
  if (mode !== "publish") console.log(JSON.stringify({ status: "PASS_PUBLICATION_" + mode.toUpperCase(), codingHostOperationsPerformed: false, trainingReady: false }));
}
if (import.meta.main) await main();

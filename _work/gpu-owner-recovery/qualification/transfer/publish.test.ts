// SPEC: _spec/gpu-input-transfer.puml
import { expect, test } from "bun:test";
import { identityFields, inspectOriginOutput, inspectRewriteOutput, publication, publicationEnvironment, publishDraft } from "./publish";
import { requireUnchangedNative } from "./publish-https";
import type { PublicationAsset, PublicationCommandResult, PublicationIO, PublicationPlan } from "./publish";

const commit = "a".repeat(40), bundleHash = "b".repeat(64), manifestHash = "c".repeat(64);

function fixture() {
  const directory = "/fixture/_work/gpu-owner-recovery/cache/host-feasibility-inputs-1";
  const bundle: PublicationAsset = { path: `${directory}/${publication.bundleName}`, bytes: 123, sha256: bundleHash };
  const manifest: PublicationAsset = { path: `${directory}/${publication.manifestName}`, bytes: 456, sha256: manifestHash };
  const plan: PublicationPlan = { repositoryDirectory: "/fixture", bundle };
  const calls: { argv: readonly string[]; timeoutMs: number }[] = [];
  const freezes: { sourceCommit: string | null; timeoutMs: number }[] = [];
  const manifests: { sourceCommit: string; timeoutMs: number }[] = [];
  const state = {
    now: 0, cost: 10, branch: publication.branch as string, origin: "https://github.com/proveo-ca/chess-coach.git", pushOrigin: "https://github.com/proveo-ca/chess-coach.git",
    permission: { full_name: publication.repository, private: false, permissions: { push: true } }, index: "_work/source.ts\n",
    fail: "", throw: "", uploads: 0, reads: 0, draft: true, tag: publication.tag as string, target: commit,
    id: 71, readId: 71, digest: true, wrongSize: false, wrongDigest: false, extraAsset: false, head: commit,
    tagRefs: "",
    afterCommand: (_argv: readonly string[]) => {},
  };
  const release = (assets: PublicationAsset[]) => JSON.stringify({ id: state.id, draft: state.draft, tag_name: state.tag, target_commitish: state.target,
    assets: [...assets.map(asset => ({ name: asset.path.slice(asset.path.lastIndexOf("/") + 1), size: asset.bytes + (state.wrongSize ? 1 : 0),
      ...(state.digest ? { digest: `sha256:${state.wrongDigest ? "0".repeat(64) : asset.sha256}` } : {}) })), ...(state.extraAsset ? [{ name: "unexpected.txt", size: 1 }] : [])] });
  const io: PublicationIO = {
    now: () => state.now,
    checkTransport: async () => ({ allowed: true, rules: 0, failure: null }),
    checkOrigin: async push => { state.now += state.cost; return inspectOriginOutput(0, push ? state.pushOrigin : state.origin, ""); },
    checkIdentity: async () => true,
    run: async (argv, timeoutMs) => {
      calls.push({ argv: [...argv], timeoutMs });
      state.now += state.cost;
      const label = argv[0] === "/usr/bin/git" ? argv[1]! : argv.includes("POST") ? "create" : argv[1] === "release" ? `upload-${state.uploads + 1}` : argv.includes("--jq") ? "permission" : "release-read";
      if (state.throw === label) throw Error("sensitive-exception-must-not-escape");
      if (state.fail === label) return { exitCode: 1, stdout: "sensitive-output-must-not-escape", failure: "sensitive-failure-must-not-escape" };
      let stdout: string;
      if (argv[1] === "branch") stdout = state.branch + "\n";
      else if (argv[1] === "remote") stdout = argv.includes("--push") ? state.pushOrigin : state.origin;
      else if (label === "permission") stdout = JSON.stringify(state.permission);
      else if (argv[1] === "diff") stdout = state.index;
      else if (argv[1] === "rev-parse") stdout = state.head;
      else if (argv[1] === "ls-remote") stdout = state.tagRefs;
      else if (label === "create") stdout = release([]);
      else if (label === "release-read") {
        state.reads++;
        stdout = JSON.stringify({ ...JSON.parse(release([bundle, manifest].slice(0, state.uploads))), id: state.readId });
      } else {
        if (label.startsWith("upload-")) state.uploads++;
        stdout = "";
      }
      state.afterCommand(argv);
      return { exitCode: 0, stdout };
    },
    validateFrozen: async (sourceCommit, timeoutMs) => { freezes.push({ sourceCommit, timeoutMs }); state.now += state.cost; return true; },
    commitManifest: async (sourceCommit, timeoutMs) => { manifests.push({ sourceCommit, timeoutMs }); state.now += state.cost; return { bundle, manifest }; },
  };
  return { plan, io, state, calls, freezes, manifests, bundle, manifest };
}

const mutations = (calls: ReturnType<typeof fixture>["calls"]) => calls.filter(call => ["commit", "push", "release"].includes(call.argv[1]!) || call.argv.includes("POST"));

test("publishes exactly one commit, push, draft, and two assets on one shrinking budget", async () => {
  const f = fixture();
  const result = await publishDraft(f.io, f.plan);
  expect(result.status).toBe("PASS");
  expect(result.attempts).toEqual({ commit: 1, push: 1, createRelease: 1, upload: 2, validateFrozen: 3, commitManifest: 1, checkTransport: 4, checkOrigin: 6, checkIdentity: 1 });
  expect(result.sourceCommit).toBe(commit);
  expect(result.pushedCommit).toBe(commit);
  expect(result.releaseId).toBe(71);
  expect(result.releaseDraft).toBe(true);
  expect(result.uploadedAssets).toEqual([publication.bundleName, publication.manifestName]);
  expect(result.verifiedAssets).toEqual([{ name: publication.bundleName, bytes: 123, sha256: bundleHash }, { name: publication.manifestName, bytes: 456, sha256: manifestHash }]);
  expect(f.freezes.map(value => value.sourceCommit)).toEqual([null, commit, commit]);
  expect(f.manifests).toEqual([{ sourceCommit: commit, timeoutMs: publication.deadlineMs - 180 }]);
  expect(f.calls[0]!.timeoutMs).toBe(publication.deadlineMs);
  expect(f.calls.every((call, index) => index === 0 || call.timeoutMs < f.calls[index - 1]!.timeoutMs)).toBe(true);
  const commands = mutations(f.calls).map(call => call.argv);
  expect(commands).toEqual([
    ["/usr/bin/git", "commit", "-m", "chore: prepare host feasibility inputs"],
    ["/usr/bin/git", "push", publication.httpsUrl, `${commit}:refs/heads/${publication.branch}`],
    ["/usr/bin/gh", "api", "--method", "POST", `repos/${publication.repository}/releases`, "-f", `tag_name=${publication.tag}`, "-f", `target_commitish=${commit}`, "-F", "draft=true", "-f", `name=${publication.tag}`],
    ["/usr/bin/gh", "release", "upload", publication.tag, f.bundle.path, "--repo", publication.repository],
    ["/usr/bin/gh", "release", "upload", publication.tag, f.manifest.path, "--repo", publication.repository],
  ]);
  expect(result.actualHostExecuted).toBe(false);
  expect(result.cudaGpuCodeExecuted).toBe(false);
  expect(result.trainingReady).toBe(false);
});

test("source-only handoffs perform one commit/push without assets, manifests or releases", async () => {
  const f = fixture(); f.plan.sourceOnly = true; f.plan.bundle.path = "";
  f.io.commitManifest = async () => { throw Error("ASSET_CALLBACK_NOT_AUTHORIZED"); };
  const result = await publishDraft(f.io, f.plan);
  expect(result.status).toBe("PASS");
  expect(result.publicationScope).toBe("SOURCE_ONLY");
  expect(result.attempts.commit).toBe(1); expect(result.attempts.push).toBe(1);
  expect(result.attempts.createRelease).toBe(0); expect(result.attempts.upload).toBe(0); expect(result.attempts.commitManifest).toBe(0);
  expect(result.assets).toEqual([]); expect(result.releaseId).toBeNull();
  expect(f.calls.some(call => call.argv.includes("POST") || call.argv.includes("upload") || call.argv.includes("ls-remote"))).toBe(false);
});

test("source-only failure after commit never creates or repairs remote assets", async () => {
  const f = fixture(); f.plan.sourceOnly = true; f.state.fail = "push";
  const result = await publishDraft(f.io, f.plan);
  expect(result.status).toBe("FAIL"); expect(result.commitSucceeded).toBe(true);
  expect(result.attempts.push).toBe(1); expect(result.attempts.createRelease).toBe(0); expect(result.attempts.upload).toBe(0);
});

test("either repository visibility permits the approved draft", async () => {
  for (const visibility of [true, false]) {
    const f = fixture(); f.state.permission.private = visibility;
    expect((await publishDraft(f.io, f.plan)).status).toBe("PASS");
  }
});

test("directory URLs with a trailing slash preserve the fixed asset root", async () => {
  const f = fixture(); f.plan.repositoryDirectory += "/";
  expect((await publishDraft(f.io, f.plan)).status).toBe("PASS");
});

test("auth failure and missing push permission stop before commit without auth setup", async () => {
  for (const failure of ["auth", "permission", "repository"]) {
    const f = fixture();
    if (failure === "auth") f.state.fail = "permission";
    if (failure === "permission") f.state.permission.permissions.push = false;
    if (failure === "repository") f.state.permission.full_name = "other/repository" as typeof publication.repository;
    const result = await publishDraft(f.io, f.plan);
    expect(result.status).toBe("FAIL");
    expect(result.failedStep).toBe("permission");
    expect(result.attempts.commit).toBe(0);
    expect(mutations(f.calls)).toEqual([]);
    expect(f.calls.at(-1)!.argv).toEqual(["/usr/bin/gh", "api", `repos/${publication.repository}`, "--jq", "{full_name,private,permissions}"]);
    expect(JSON.stringify(result)).not.toContain("sensitive-");
  }
});

test("branch, fetch origin, push origin, and multiple URLs fail closed", async () => {
  const cases: ["branch" | "origin" | "pushOrigin", string][] = [
    ["branch", "main"], ["origin", "https://github.com/other/chess-coach.git"],
    ["origin", "https://token@github.com/proveo-ca/chess-coach.git"], ["origin", "https://github.com/proveo-ca/chess-coach.git.evil"],
    ["pushOrigin", "https://github.com/other/chess-coach.git"], ["pushOrigin", "https://github.com/proveo-ca/chess-coach.git\nhttps://github.com/other/chess-coach.git"],
  ];
  for (const [key, value] of cases) {
    const f = fixture(); f.state[key] = value;
    const result = await publishDraft(f.io, f.plan);
    expect(result.status).toBe("FAIL");
    expect(result.attempts.commit).toBe(0);
    expect(mutations(f.calls)).toEqual([]);
  }
});

test("SSH repository metadata never selects SSH network transport", async () => {
  const f = fixture(); f.state.origin = f.state.pushOrigin = "git@github.com:proveo-ca/chess-coach.git";
  expect((await publishDraft(f.io, f.plan)).status).toBe("PASS");
  const network = f.calls.filter(call => ["push", "ls-remote"].includes(call.argv[1]!));
  expect(network).toHaveLength(3);
  for (const call of network) expect(call.argv).toContain(publication.httpsUrl);
  expect(network.some(call => call.argv.includes("origin") || call.argv.some(value => value.startsWith("git@")))).toBe(false);
});

test("URL rewrite inspection rejects applicable fetch and push rewrites without retaining raw values", () => {
  expect(inspectRewriteOutput(1, "", "")).toEqual({ allowed: true, rules: 0, failure: null });
  for (const text of [
    "url.ssh://git@github.com/.insteadof https://github.com/\n",
    "url.https://credential-sentinel@example.invalid/.pushinsteadof https://\n",
    "url.https://github.com/.insteadof https://github.com/\n",
    "URL.ssh://git@github.com/.PushInsteadOf https://github.com/proveo-ca/\n",
    "url.any.insteadof \n",
  ]) {
    const result = inspectRewriteOutput(0, text, "");
    expect(result.allowed).toBe(false);
    expect(JSON.stringify(result)).not.toContain("credential-sentinel");
    expect(JSON.stringify(result)).not.toContain("git@");
  }
  expect(inspectRewriteOutput(0, "url.ssh://elsewhere/.insteadof https://unrelated.invalid/\n", "").allowed).toBe(true);
  expect(inspectRewriteOutput(0, "url.ssh://elsewhere/.insteadof HTTPS://github.com/\n", "").allowed).toBe(true);
  for (const [code, stdout, stderr] of [[1, "unexpected", ""], [0, "", ""], [0, "malformed\n", ""], [0, "url.base.insteadof has spaces\n", ""], [0, "x".repeat(65537), ""], [0, "url.base.insteadof prefix\n", "failure"]] as const)
    expect(inspectRewriteOutput(code, stdout, stderr).allowed).toBe(false);
});

test("origin metadata returns only a verdict and never enters persisted command results", async () => {
  const f = fixture(); f.state.origin = "https://credential-sentinel@github.com/proveo-ca/chess-coach.git";
  const result = await publishDraft(f.io, f.plan);
  expect(result.failure).toBe("PUBLICATION_ORIGIN_MISMATCH");
  expect(result.attempts.commit).toBe(0);
  expect(f.calls.some(call => call.argv.includes("get-url"))).toBe(false);
  expect(JSON.stringify(result)).not.toContain("credential-sentinel");
  expect(inspectOriginOutput(1, publication.httpsUrl, "")).toBe(false);
  expect(inspectOriginOutput(0, publication.httpsUrl, "diagnostic")).toBe(false);
});

test("publisher inherits only existing identity values without inventing or recording them", async () => {
  const source = Object.fromEntries(identityFields.map(field => [field, field + "-identity-sentinel"]));
  const environment = publicationEnvironment({ ...source, HOME: "/fixture", UNRELATED: "excluded" });
  for (const field of identityFields) expect(environment[field]).toBe(source[field]);
  expect(environment.UNRELATED).toBeUndefined();
  expect(publicationEnvironment({}).GIT_AUTHOR_NAME).toBeUndefined();
  const f = fixture(); f.io.checkIdentity = async () => false;
  const result = await publishDraft(f.io, f.plan);
  expect(result.failure).toBe("EXISTING_GIT_IDENTITY_NOT_ACCEPTED");
  expect(result.attempts.commit).toBe(0);
  expect(mutations(f.calls)).toEqual([]);
  expect(JSON.stringify(result)).not.toContain("identity-sentinel");
});

test("transport guards stop before mutation and recheck after hooks within the same deadline", async () => {
  for (const stopAt of [1, 2, 3, 4]) {
    const f = fixture(); let checks = 0;
    f.io.checkTransport = async () => ({ allowed: ++checks !== stopAt, rules: 1, failure: "credential-sentinel" });
    const result = await publishDraft(f.io, f.plan);
    expect(result.failure).toBe("HTTPS_TRANSPORT_NOT_ACCEPTED");
    expect(result.attempts.commit).toBe(stopAt === 1 ? 0 : 1);
    expect(result.attempts.push).toBe(stopAt < 3 ? 0 : 1);
    expect(result.attempts.createRelease).toBe(stopAt < 4 ? 0 : 1);
    expect(JSON.stringify(result)).not.toContain("credential-sentinel");
  }
});

test("prepared-native reuse binds both original hashes and the fresh publisher gate", () => {
  const native = Array.from({ length: 65 }, (_, index) => ({ path: `input-${index}`, sha256: "a".repeat(64) }));
  expect(() => requireUnchangedNative(native, [...native].reverse(), native)).not.toThrow();
  expect(() => requireUnchangedNative(native, native.slice(1), native)).toThrow("PREPARED_NATIVE_INPUTS_CHANGED");
  expect(() => requireUnchangedNative(native, native, native.slice(1))).toThrow("PREPARED_NATIVE_INPUTS_NOT_IN_NEW_GATE");
  expect(() => requireUnchangedNative(native, [{ ...native[0]!, sha256: "b".repeat(64) }, ...native.slice(1)], native)).toThrow("PREPARED_NATIVE_INPUTS_CHANGED");
});

test("empty staged index and invalid bundle paths stop before commit", async () => {
  const empty = fixture(); empty.state.index = "\n";
  expect((await publishDraft(empty.io, empty.plan)).failure).toBe("STAGED_SOURCE_REQUIRED");
  expect(mutations(empty.calls)).toEqual([]);
  const path = fixture(); path.plan.bundle.path = "/fixture/outside.tar.gz";
  expect((await publishDraft(path.io, path.plan)).failure).toBe("PREPARED_BUNDLE_REQUIRED");
  expect(path.calls).toEqual([]);
});

test("commit and push failures retain attempts and stop before release", async () => {
  for (const failure of ["commit", "push"]) {
    const f = fixture(); f.state.fail = failure;
    const result = await publishDraft(f.io, f.plan);
    expect(result.status).toBe("FAIL");
    expect(result.failedStep).toBe(failure);
    expect(result.attempts.commit).toBe(1);
    expect(result.attempts.push).toBe(failure === "push" ? 1 : 0);
    expect(result.commitSucceeded).toBe(failure === "push" ? true : null);
    expect(result.sourceCommit).toBe(failure === "push" ? commit : null);
    expect(result.pushedCommit).toBe(null);
    expect(result.attempts.createRelease).toBe(0);
    expect(result.attempts.upload).toBe(0);
    expect(f.calls.at(-1)!.argv[1]).toBe(failure);
  }
});

test("a pre-existing tag must be absent or resolve to the exact pushed commit", async () => {
  const ref = `refs/tags/${publication.tag}`;
  for (const refs of [`${commit}\t${ref}\n`, `${"f".repeat(40)}\t${ref}\n${commit}\t${ref}^{}\n`]) {
    const f = fixture(); f.state.tagRefs = refs;
    expect((await publishDraft(f.io, f.plan)).status).toBe("PASS");
  }
  const wrong = fixture(); wrong.state.tagRefs = `${"d".repeat(40)}\t${ref}\n`;
  const result = await publishDraft(wrong.io, wrong.plan);
  expect(result.failure).toBe("RELEASE_TAG_TARGET_MISMATCH");
  expect(result.attempts.createRelease).toBe(0);
  expect(result.attempts.upload).toBe(0);
});

test("commit timeout or capture failure records an unknown rather than negative outcome", async () => {
  const f = fixture(); f.state.throw = "commit";
  const result = await publishDraft(f.io, f.plan);
  expect(result.attempts.commit).toBe(1);
  expect(result.commitSucceeded).toBeNull();
  expect(result.sourceCommit).toBeNull();
  expect(result.attempts.push).toBe(0);
  expect(result.attempts.createRelease).toBe(0);
});

test("thrown mutation invocations consume their attempt before stopping", async () => {
  for (const stage of ["commit", "push", "create", "upload-1", "upload-2"]) {
    const f = fixture(); f.state.throw = stage;
    const result = await publishDraft(f.io, f.plan);
    expect(result.status).toBe("FAIL");
    expect(result.failure).toBe("PUBLICATION_STEP_FAILED");
    expect(result.operations.at(-1)!.status).toBe("FAIL");
    expect(result.attempts.commit).toBe(1);
    expect(result.attempts.push).toBe(stage === "commit" ? 0 : 1);
    expect(result.attempts.createRelease).toBe(["commit", "push"].includes(stage) ? 0 : 1);
    expect(result.attempts.upload).toBe(stage === "upload-2" ? 2 : stage === "upload-1" ? 1 : 0);
    expect(JSON.stringify(result)).not.toContain("sensitive-");
  }
});

test("post-hook frozen mutations stop before push or publication", async () => {
  for (const freeze of [1, 2, 3]) {
    const f = fixture();
    let validations = 0;
    f.io.validateFrozen = async () => ++validations !== freeze;
    const result = await publishDraft(f.io, f.plan);
    expect(result.failure).toBe("FROZEN_INPUT_CHANGED");
    expect(result.attempts.commit).toBe(freeze === 1 ? 0 : 1);
    expect(result.attempts.push).toBe(freeze === 3 ? 1 : 0);
    expect(result.attempts.createRelease).toBe(0);
    expect(result.attempts.commitManifest).toBe(0);
  }
});

test("hook changes to branch, origin, or HEAD stop further mutations", async () => {
  for (const change of ["branch", "origin", "head"]) {
    const f = fixture();
    f.state.afterCommand = argv => {
      if (argv[1] === "commit" && change === "branch") f.state.branch = "main";
      if (argv[1] === "commit" && change === "origin") f.state.pushOrigin = "https://github.com/other/repository.git";
      if (argv[1] === "push" && change === "head") f.state.head = "d".repeat(40);
    };
    const result = await publishDraft(f.io, f.plan);
    expect(result.status).toBe("FAIL");
    expect(result.attempts.push).toBe(change === "head" ? 1 : 0);
    expect(result.attempts.createRelease).toBe(0);
  }
});

test("manifest creation happens after the exact push and rejects changed assets", async () => {
  for (const bad of ["bundle", "manifest", "throw"]) {
    const f = fixture();
    f.io.commitManifest = async (sourceCommit, timeoutMs) => {
      expect(sourceCommit).toBe(commit);
      expect(timeoutMs).toBeLessThan(publication.deadlineMs);
      expect(f.calls.some(call => call.argv[1] === "push")).toBe(true);
      if (bad === "throw") throw Error("sensitive-manifest-error");
      return { bundle: { ...f.bundle, ...(bad === "bundle" ? { sha256: "e".repeat(64) } : {}) }, manifest: { ...f.manifest, ...(bad === "manifest" ? { path: "/outside.json" } : {}) } };
    };
    const result = await publishDraft(f.io, f.plan);
    expect(result.status).toBe("FAIL");
    expect(result.pushedCommit).toBe(commit);
    expect(result.attempts.commitManifest).toBe(1);
    expect(result.attempts.createRelease).toBe(0);
    expect(JSON.stringify(result)).not.toContain("sensitive-");
  }
});

test("non-draft, wrong tag, or wrong target response stops without upload or repair", async () => {
  for (const mismatch of ["draft", "tag", "target"]) {
    const f = fixture();
    if (mismatch === "draft") f.state.draft = false;
    if (mismatch === "tag") f.state.tag = "different-tag";
    if (mismatch === "target") f.state.target = "d".repeat(40);
    const result = await publishDraft(f.io, f.plan);
    expect(result.status).toBe("FAIL");
    expect(result.releaseId).toBe(71);
    expect(result.attempts.createRelease).toBe(1);
    expect(result.attempts.upload).toBe(0);
    expect(result.failedStep).toBe("release-create");
    expect(f.calls.at(-1)!.argv).toContain("POST");
  }
});

test("failed release creation never retries or uploads", async () => {
  const f = fixture(); f.state.fail = "create";
  const result = await publishDraft(f.io, f.plan);
  expect(result.attempts.createRelease).toBe(1);
  expect(result.attempts.upload).toBe(0);
  expect(result.releaseId).toBe(null);
  expect(result.failedStep).toBe("release-create");
});

test("second upload failure retains the first uploaded asset and release", async () => {
  const f = fixture(); f.state.fail = "upload-2";
  const result = await publishDraft(f.io, f.plan);
  expect(result.status).toBe("FAIL");
  expect(result.failedStep).toBe("upload-2");
  expect(result.attempts.upload).toBe(2);
  expect(result.uploadedAssets).toEqual([publication.bundleName]);
  expect(result.verifiedAssets).toEqual([{ name: publication.bundleName, bytes: 123, sha256: bundleHash }]);
  expect(result.releaseId).toBe(71);
  expect(result.pushedCommit).toBe(commit);
  expect(f.calls.at(-1)!.argv[4]).toBe(f.manifest.path);
});

test("each pre-upload and final read must still identify the exact draft", async () => {
  for (const afterUploads of [0, 1, 2]) {
    const f = fixture();
    f.state.afterCommand = argv => {
      if ((afterUploads === 0 && argv.includes("POST")) || (argv[1] === "release" && f.state.uploads === afterUploads)) f.state.draft = false;
    };
    const result = await publishDraft(f.io, f.plan);
    expect(result.failure).toBe("DRAFT_RELEASE_REQUIRED");
    expect(result.attempts.upload).toBe(afterUploads);
    expect(result.uploadedAssets).toHaveLength(afterUploads);
    expect(result.releaseDraft).toBe(false);
  }
  const f = fixture(); f.state.readId = 72;
  expect((await publishDraft(f.io, f.plan)).failure).toBe("RELEASE_ID_MISMATCH");
  expect(f.state.uploads).toBe(0);
});

test("asset verification rejects wrong sizes, available digests, and extra names", async () => {
  for (const mismatch of ["wrongSize", "wrongDigest", "extraAsset"] as const) {
    const f = fixture();
    f.state.afterCommand = argv => { if (argv[1] === "release" && f.state.uploads === 2) f.state[mismatch] = true; };
    const result = await publishDraft(f.io, f.plan);
    expect(result.status).toBe("FAIL");
    expect(result.failedStep).toBe("release-final");
    expect(result.attempts.upload).toBe(2);
    expect(result.uploadedAssets).toHaveLength(2);
  }
});

test("asset names must equal the approved basenames rather than path suffixes", async () => {
  for (const name of [`host-feasibility-inputs-1/${publication.bundleName}`, publication.manifestName]) {
    const f = fixture(), run = f.io.run;
    f.io.run = async (argv, timeoutMs) => {
      const output = await run(argv, timeoutMs);
      if (argv[1] !== "api" || f.state.reads !== 2) return output;
      const value = JSON.parse(output.stdout);
      value.assets[0].name = name;
      return { ...output, stdout: JSON.stringify(value) };
    };
    const result = await publishDraft(f.io, f.plan);
    expect(result.failure).toBe("RELEASE_ASSET_MISMATCH");
    expect(result.attempts.upload).toBe(1);
  }
});

test("an API without asset digests records missing hash verification explicitly", async () => {
  const f = fixture(); f.state.digest = false;
  const result = await publishDraft(f.io, f.plan);
  expect(result.status).toBe("PASS");
  expect(result.verifiedAssets.map(asset => asset.sha256)).toEqual([null, null]);
});

test("the whole deadline stops before the next command rather than restarting", async () => {
  const early = fixture(); early.state.cost = publication.deadlineMs;
  const first = await publishDraft(early.io, early.plan);
  expect(first.failure).toBe("PUBLICATION_DEADLINE");
  expect(early.calls).toHaveLength(1);
  expect(first.attempts.commit).toBe(0);
  const pushed = fixture();
  pushed.state.afterCommand = argv => { if (argv[1] === "push") pushed.state.now = publication.deadlineMs; };
  const partial = await publishDraft(pushed.io, pushed.plan);
  expect(partial.failure).toBe("PUBLICATION_DEADLINE");
  expect(partial.pushedCommit).toBe(commit);
  expect(partial.attempts.createRelease).toBe(0);
  const final = fixture();
  final.state.afterCommand = argv => { if (argv[1] === "api" && final.state.reads === 3) final.state.now = publication.deadlineMs; };
  const completeButLate = await publishDraft(final.io, final.plan);
  expect(completeButLate.failure).toBe("PUBLICATION_DEADLINE");
  expect(completeButLate.uploadedAssets).toHaveLength(2);
});

test("callback time consumes the same budget and invalid clocks stop closed", async () => {
  const callback = fixture();
  callback.io.validateFrozen = async () => { callback.state.now = publication.deadlineMs; return true; };
  const expired = await publishDraft(callback.io, callback.plan);
  expect(expired.failure).toBe("PUBLICATION_DEADLINE");
  expect(expired.attempts.commit).toBe(0);
  for (const invalid of [NaN, Infinity, -1]) {
    const f = fixture();
    f.state.afterCommand = () => { f.state.now = invalid; };
    expect((await publishDraft(f.io, f.plan)).failure).toBe("INVALID_PUBLICATION_CLOCK");
    expect(f.calls).toHaveLength(1);
  }
});

test("malformed command JSON fails before any later mutation", async () => {
  const f = fixture(), run = f.io.run;
  f.io.run = async (argv, timeoutMs): Promise<PublicationCommandResult> => {
    const output = await run(argv, timeoutMs);
    return argv.includes("--jq") ? { ...output, stdout: "not JSON" } : output;
  };
  const result = await publishDraft(f.io, f.plan);
  expect(result.failure).toBe("INVALID_COMMAND_JSON");
  expect(mutations(f.calls)).toEqual([]);
});

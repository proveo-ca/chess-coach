// SPEC: _spec/gpu-input-transfer.puml
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { isAbsolute, resolve } from "node:path";
import { repository } from "../../provision";
import { runBounded } from "../../verify";

export const publication = {
  repository: "proveo-ca/chess-coach",
  branch: "feat-ml-adjuntant-ii",
  tag: "gpu-feasibility-inputs-20261110-1",
  bundleName: "host-feasibility-inputs-1.tar.gz",
  manifestName: "host-feasibility-inputs-1.manifest.json",
  deadlineMs: 600_000,
  httpsUrl: "https://github.com/proveo-ca/chess-coach.git",
} as const;

export type PublicationAsset = { path: string; bytes: number; sha256: string };
export type PublicationPlan = { repositoryDirectory: string; bundle: PublicationAsset; receiptDirectory?: string };
export type TransportCheck = { allowed: boolean; rules: number; failure: string | null };
export type PublicationCommandResult = { exitCode: number; stdout: string; status?: "PASS" | "FAIL"; failure?: string | null };
export type PublicationCallbacks = {
  validateFrozen(sourceCommit: string | null, remainingMs: number): Promise<boolean>;
  commitManifest(sourceCommit: string, remainingMs: number): Promise<{ bundle: PublicationAsset; manifest: PublicationAsset }>;
};
export type PublicationIO = PublicationCallbacks & {
  now(): number;
  run(argv: readonly string[], remainingMs: number): Promise<PublicationCommandResult>;
  checkTransport(remainingMs: number): Promise<TransportCheck>;
  checkOrigin(push: boolean, remainingMs: number): Promise<boolean>;
  checkIdentity(remainingMs: number): Promise<boolean>;
};
export type PublicationOperation = {
  step: string; kind: "command" | "callback"; timeoutMs: number; status: "STARTED" | "PASS" | "FAIL";
  argv?: string[]; exitCode?: number;
};
export type PublicationResult = {
  version: "chess-coach.qualification-input-publication.v1";
  status: "PASS" | "FAIL"; failure: string | null; failedStep: string | null; elapsedMs: number;
  attempts: { commit: number; push: number; createRelease: number; upload: number; validateFrozen: number; commitManifest: number; checkTransport: number; checkOrigin: number; checkIdentity: number };
  operations: PublicationOperation[];
  transportChecks: TransportCheck[];
  commitSucceeded: boolean | null; sourceCommit: string | null; pushedCommit: string | null;
  releaseId: number | null; releaseDraft: boolean | null;
  assets: PublicationAsset[]; uploadedAssets: string[];
  verifiedAssets: { name: string; bytes: number; sha256: string | null }[];
  actualHostExecuted: false; cudaGpuCodeExecuted: false; trainingReady: false;
};

class PublicationStop extends Error {}
function fail(code: string): never { throw new PublicationStop(code); }
const assetDirectory = (root: string) => resolve(root, "_work/gpu-owner-recovery/cache/host-feasibility-inputs-1");
const receiptDirectory = (root: string) => resolve(root, "_work/gpu-owner-recovery/runs/host-feasibility-inputs-1");
const httpsReceiptDirectory = (root: string) => resolve(root, "_work/gpu-owner-recovery/runs/host-feasibility-publication-2");
const identityReceiptDirectory = (root: string) => resolve(root, "_work/gpu-owner-recovery/runs/host-feasibility-publication-3");
export const identityFields = ["GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL"] as const;

export function publicationEnvironment(source: NodeJS.ProcessEnv) {
  const environment: Record<string, string> = {};
  for (const key of ["HOME", "PATH", "GH_CONFIG_DIR", "XDG_CONFIG_HOME", "GH_TOKEN", "GITHUB_TOKEN", "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY", "SSL_CERT_FILE", "SSL_CERT_DIR", "GIT_SSL_CAINFO", ...identityFields]) {
    const value = source[key];
    if (value !== undefined) environment[key] = value;
  }
  environment.GH_PROMPT_DISABLED = "1";
  environment.GIT_TERMINAL_PROMPT = "0";
  return environment;
}

export function inspectRewriteOutput(exitCode: number, stdout: string, stderr: string): TransportCheck {
  const stop = (failure: string, rules = 0): TransportCheck => ({ allowed: false, rules, failure });
  if (exitCode === 1 && stdout === "" && stderr === "") return { allowed: true, rules: 0, failure: null };
  if (exitCode !== 0 || stderr !== "" || stdout.length > 65536 || /[\x00-\x08\x0b-\x1f\x7f]/.test(stdout)) return stop("URL_REWRITE_QUERY_FAILED");
  const lines = (stdout.endsWith("\n") ? stdout.slice(0, -1) : stdout).split("\n");
  if (!stdout || lines.some(line => !line)) return stop("URL_REWRITE_RECORD_INVALID");
  let rules = 0;
  for (const line of lines) {
    const match = /^url\.([^\s]+)\.(insteadof|pushinsteadof)(?: (.*))?$/i.exec(line);
    if (!match || /\s/.test(match[3] ?? "")) return stop("URL_REWRITE_RECORD_INVALID", rules);
    rules++;
    if (publication.httpsUrl.startsWith(match[3] ?? "")) return stop("APPLICABLE_URL_REWRITE", rules);
  }
  return { allowed: true, rules, failure: null };
}

export function inspectOriginOutput(exitCode: number, stdout: string, stderr: string): boolean {
  return exitCode === 0 && stderr === "" && ["https://github.com/proveo-ca/chess-coach", publication.httpsUrl,
    "git@github.com:proveo-ca/chess-coach.git", "ssh://git@github.com/proveo-ca/chess-coach.git"].includes(stdout.trim());
}

function validAsset(asset: PublicationAsset, path: string): boolean {
  return !!asset && asset.path === path && Number.isSafeInteger(asset.bytes) && asset.bytes > 0 && /^[a-f0-9]{64}$/.test(asset.sha256);
}

function jsonObject(text: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(text);
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {}
  return fail("INVALID_COMMAND_JSON");
}

export async function publishDraft(io: PublicationIO, plan: PublicationPlan): Promise<PublicationResult> {
  const result: PublicationResult = {
    version: "chess-coach.qualification-input-publication.v1", status: "FAIL", failure: null, failedStep: null, elapsedMs: 0,
    attempts: { commit: 0, push: 0, createRelease: 0, upload: 0, validateFrozen: 0, commitManifest: 0, checkTransport: 0, checkOrigin: 0, checkIdentity: 0 }, operations: [], transportChecks: [],
    commitSucceeded: false, sourceCommit: null, pushedCommit: null, releaseId: null, releaseDraft: null,
    assets: [], uploadedAssets: [], verifiedAssets: [], actualHostExecuted: false, cudaGpuCodeExecuted: false, trainingReady: false,
  };
  let step = "plan", started: number | null = null, lastNow: number | null = null;
  const remaining = () => {
    const now = io.now();
    if (!Number.isFinite(now) || (lastNow !== null && now < lastNow)) fail("INVALID_PUBLICATION_CLOCK");
    started ??= now;
    lastNow = now;
    result.elapsedMs = now - started;
    const ms = Math.floor(publication.deadlineMs - result.elapsedMs);
    if (ms <= 0) fail("PUBLICATION_DEADLINE");
    return ms;
  };
  const command = async (label: string, argv: string[], counter?: "commit" | "push" | "createRelease" | "upload") => {
    step = label;
    const operation: PublicationOperation = { step, kind: "command", timeoutMs: remaining(), status: "STARTED", argv: [...argv] };
    result.operations.push(operation);
    if (counter) result.attempts[counter]++;
    if (counter === "commit") result.commitSucceeded = null;
    try {
      const output = await io.run(argv, operation.timeoutMs);
      if (Number.isInteger(output.exitCode)) operation.exitCode = output.exitCode;
      if (output.exitCode !== 0 || output.status === "FAIL" || (output.failure !== undefined && output.failure !== null) || typeof output.stdout !== "string") fail("PUBLICATION_COMMAND_FAILED");
      operation.status = "PASS";
      return output.stdout;
    } catch (error) {
      operation.status = "FAIL";
      throw error;
    }
  };
  const callback = async <T>(label: string, counter: "validateFrozen" | "commitManifest" | "checkTransport" | "checkOrigin" | "checkIdentity", invoke: (ms: number) => Promise<T>) => {
    step = label;
    const operation: PublicationOperation = { step, kind: "callback", timeoutMs: remaining(), status: "STARTED" };
    result.operations.push(operation);
    result.attempts[counter]++;
    try {
      const value = await invoke(operation.timeoutMs);
      operation.status = "PASS";
      return value;
    } catch (error) {
      operation.status = "FAIL";
      throw error;
    }
  };
  const frozen = async (label: string, commit: string | null) => {
    if (await callback(label, "validateFrozen", ms => io.validateFrozen(commit, ms)) !== true) fail("FROZEN_INPUT_CHANGED");
  };
  const transport = async (suffix: string) => {
    const checked = await callback(`https-transport-${suffix}`, "checkTransport", ms => io.checkTransport(ms));
    result.transportChecks.push({ allowed: checked.allowed === true, rules: Number.isSafeInteger(checked.rules) ? checked.rules : 0,
      failure: checked.allowed === true ? null : "HTTPS_TRANSPORT_NOT_ACCEPTED" });
    if (checked.allowed !== true) fail("HTTPS_TRANSPORT_NOT_ACCEPTED");
  };
  const location = async (suffix: string) => {
    if ((await command(`branch${suffix}`, ["/usr/bin/git", "branch", "--show-current"])).trim() !== publication.branch) fail("PUBLICATION_BRANCH_MISMATCH");
    for (const push of [false, true]) {
      if (await callback(`origin-${push ? "push" : "fetch"}${suffix}`, "checkOrigin", ms => io.checkOrigin(push, ms)) !== true) fail("PUBLICATION_ORIGIN_MISMATCH");
    }
  };
  const release = (text: string, commit: string, expectedId: number | null) => {
    const value = jsonObject(text);
    if (typeof value.id === "number" && Number.isSafeInteger(value.id) && value.id > 0 && expectedId === null) result.releaseId = value.id;
    result.releaseDraft = typeof value.draft === "boolean" ? value.draft : null;
    if (!Number.isSafeInteger(value.id) || (value.id as number) <= 0 || (expectedId !== null && value.id !== expectedId)) fail("RELEASE_ID_MISMATCH");
    if (value.draft !== true) fail("DRAFT_RELEASE_REQUIRED");
    if (value.tag_name !== publication.tag || value.target_commitish !== commit) fail("RELEASE_TARGET_MISMATCH");
    return value;
  };
  const verifyAssets = (value: Record<string, unknown>, expected: PublicationAsset[]) => {
    if (!Array.isArray(value.assets) || value.assets.length !== expected.length) fail("RELEASE_ASSET_SET_MISMATCH");
    const seen = new Set<string>();
    const verified: PublicationResult["verifiedAssets"] = [];
    for (const item of value.assets as unknown[]) {
      if (!item || typeof item !== "object" || Array.isArray(item)) fail("INVALID_RELEASE_ASSET");
      const asset = item as Record<string, unknown>;
      const match = expected.find(entry => entry.path.slice(entry.path.lastIndexOf("/") + 1) === asset.name);
      if (typeof asset.name !== "string" || !match || seen.has(asset.name) || asset.size !== match.bytes) fail("RELEASE_ASSET_MISMATCH");
      seen.add(asset.name);
      const hasDigest = asset.digest !== undefined && asset.digest !== null;
      if (hasDigest && asset.digest !== `sha256:${match.sha256}`) fail("RELEASE_ASSET_DIGEST_MISMATCH");
      verified.push({ name: asset.name, bytes: match.bytes, sha256: hasDigest ? match.sha256 : null });
    }
    result.verifiedAssets = verified;
  };
  const tagTarget = async (commit: string, suffix: string) => {
    await transport(`tag-${suffix}`);
    const tag = `refs/tags/${publication.tag}`;
    const text = (await command(`tag-${suffix}`, ["/usr/bin/git", "ls-remote", "--tags", publication.httpsUrl, tag, tag + "^{}"])).trim();
    if (!text) return;
    const refs = new Map<string, string>();
    for (const line of text.split("\n")) {
      const fields = line.trim().split(/\s+/);
      if (fields.length !== 2 || !/^[a-f0-9]{40}$/.test(fields[0]!) || ![tag, tag + "^{}"].includes(fields[1]!) || refs.has(fields[1]!)) fail("RELEASE_TAG_METADATA_INVALID");
      refs.set(fields[1]!, fields[0]!);
    }
    if (!refs.has(tag) || (refs.get(tag + "^{}") ?? refs.get(tag)) !== commit) fail("RELEASE_TAG_TARGET_MISMATCH");
  };
  try {
    remaining();
    if (!plan || typeof plan.repositoryDirectory !== "string" || !isAbsolute(plan.repositoryDirectory)) fail("PUBLICATION_ROOT_REQUIRED");
    const root = resolve(plan.repositoryDirectory), bundle = { ...plan.bundle };
    if (!validAsset(bundle, resolve(assetDirectory(root), publication.bundleName))) fail("PREPARED_BUNDLE_REQUIRED");
    await location("");
    await transport("preflight");
    if (await callback("identity-preflight", "checkIdentity", ms => io.checkIdentity(ms)) !== true) fail("EXISTING_GIT_IDENTITY_NOT_ACCEPTED");
    const permissions = jsonObject(await command("permission", ["/usr/bin/gh", "api", `repos/${publication.repository}`, "--jq", "{full_name,private,permissions}"]));
    if (permissions.full_name !== publication.repository || typeof permissions.private !== "boolean" || !permissions.permissions || typeof permissions.permissions !== "object" || (permissions.permissions as Record<string, unknown>).push !== true) fail("REPOSITORY_PUSH_PERMISSION_REQUIRED");
    if (!(await command("index", ["/usr/bin/git", "diff", "--cached", "--name-only", "--"])).trim()) fail("STAGED_SOURCE_REQUIRED");
    await frozen("freeze-before-commit", null);
    await command("commit", ["/usr/bin/git", "commit", "-m", "chore: prepare host feasibility inputs"], "commit");
    result.commitSucceeded = true;
    const commit = (await command("head", ["/usr/bin/git", "rev-parse", "--verify", "HEAD"])).trim();
    if (!/^[a-f0-9]{40}$/.test(commit)) fail("EXACT_SOURCE_COMMIT_REQUIRED");
    result.sourceCommit = commit;
    await frozen("freeze-after-commit", commit);
    await location("-before-push");
    await transport("before-push");
    await command("push", ["/usr/bin/git", "push", publication.httpsUrl, `${commit}:refs/heads/${publication.branch}`], "push");
    result.pushedCommit = commit;
    if ((await command("head-after-push", ["/usr/bin/git", "rev-parse", "--verify", "HEAD"])).trim() !== commit) fail("SOURCE_COMMIT_CHANGED");
    await location("-before-publication");
    await frozen("freeze-before-publication", commit);
    const assets = await callback("manifest", "commitManifest", ms => io.commitManifest(commit, ms));
    if (!assets || !validAsset(assets.bundle, bundle.path) || assets.bundle.bytes !== bundle.bytes || assets.bundle.sha256 !== bundle.sha256 || !validAsset(assets.manifest, resolve(assetDirectory(root), publication.manifestName))) fail("COMMITTED_MANIFEST_ASSETS_REQUIRED");
    result.assets = [{ ...assets.bundle }, { ...assets.manifest }];
    await tagTarget(commit, "before-create");
    const created = release(await command("release-create", ["/usr/bin/gh", "api", "--method", "POST", `repos/${publication.repository}/releases`, "-f", `tag_name=${publication.tag}`, "-f", `target_commitish=${commit}`, "-F", "draft=true", "-f", `name=${publication.tag}`], "createRelease"), commit, null);
    if (created.assets !== undefined) verifyAssets(created, []);
    for (const [index, asset] of result.assets.entries()) {
      const value = release(await command(`release-before-upload-${index + 1}`, ["/usr/bin/gh", "api", `repos/${publication.repository}/releases/${result.releaseId}`]), commit, result.releaseId);
      verifyAssets(value, result.assets.slice(0, index));
      await command(`upload-${index + 1}`, ["/usr/bin/gh", "release", "upload", publication.tag, asset.path, "--repo", publication.repository], "upload");
      result.uploadedAssets.push(index === 0 ? publication.bundleName : publication.manifestName);
    }
    const final = release(await command("release-final", ["/usr/bin/gh", "api", `repos/${publication.repository}/releases/${result.releaseId}`]), commit, result.releaseId);
    verifyAssets(final, result.assets);
    await tagTarget(commit, "final");
    remaining();
    result.status = "PASS";
  } catch (error) {
    result.failure = error instanceof PublicationStop ? error.message : "PUBLICATION_STEP_FAILED";
    result.failedStep = step;
    const operation = result.operations.at(-1);
    if (operation?.step === step) operation.status = "FAIL";
    try {
      const now = io.now();
      if (started !== null && Number.isFinite(now) && (lastNow === null || now >= lastNow)) result.elapsedMs = now - started;
    } catch {}
  }
  return result;
}

// Top-level publisher adapter.
export async function runPublisher(plan: PublicationPlan, callbacks: PublicationCallbacks): Promise<PublicationResult> {
  if (resolve(plan.repositoryDirectory) !== resolve(repository) || resolve(process.cwd()) !== resolve(repository)) throw Error("REPOSITORY_ROOT_REQUIRED");
  const directory = plan.receiptDirectory ?? receiptDirectory(repository);
  if (![receiptDirectory(repository), httpsReceiptDirectory(repository), identityReceiptDirectory(repository)].includes(directory)) throw Error("APPROVED_PUBLICATION_RECEIPT_ROOT_REQUIRED");
  if (directory !== receiptDirectory(repository)) await mkdir(directory, { mode: 0o700 });
  const environment = publicationEnvironment(process.env);
  const privateQuery = (args: string[], remainingMs: number) => new Promise<{ exitCode: number; stdout: string; stderr: string }>(resolveQuery => {
    execFile("/usr/bin/git", args, { cwd: repository, env: environment, timeout: remainingMs, maxBuffer: 65536, encoding: "utf8" }, (error, stdout, stderr) => {
      resolveQuery({ exitCode: error === null ? 0 : typeof error.code === "number" ? error.code : -1, stdout, stderr });
    });
  });
  let ordinal = 0;
  const result = await publishDraft({
    ...callbacks,
    now: () => performance.now(),
    checkTransport: async remainingMs => {
      const output = await privateQuery(["config", "--includes", "--get-regexp", "^url\\..*\\.(insteadof|pushinsteadof)$"], remainingMs);
      return inspectRewriteOutput(output.exitCode, output.stdout, output.stderr);
    },
    checkOrigin: async (push, remainingMs) => {
      const output = await privateQuery(["remote", "get-url", ...(push ? ["--push"] : []), "--all", "origin"], remainingMs);
      return inspectOriginOutput(output.exitCode, output.stdout, output.stderr);
    },
    checkIdentity: async remainingMs => {
      if (identityFields.some(field => !environment[field])) return false;
      const deadline = performance.now() + remainingMs;
      for (const name of ["GIT_AUTHOR_IDENT", "GIT_COMMITTER_IDENT"]) {
        const remaining = Math.floor(deadline - performance.now());
        if (remaining <= 0) return false;
        const output = await privateQuery(["var", name], remaining);
        if (output.exitCode !== 0 || output.stderr !== "" || !output.stdout.trim()) return false;
      }
      return performance.now() < deadline;
    },
    run: async (argv, timeoutMs) => {
      const started = performance.now();
      if (ordinal === 0) await writeFile(resolve(directory, "publication.operation"), JSON.stringify({ version: "chess-coach.qualification-input-publication-operation.v1", tag: publication.tag }) + "\n", { flag: "wx", mode: 0o600 });
      const step = resolve(directory, `publish-${String(++ordinal).padStart(2, "0")}`);
      await mkdir(step, { mode: 0o700 });
      const remainingMs = Math.floor(timeoutMs - (performance.now() - started));
      if (remainingMs <= 0) return { exitCode: -1, status: "FAIL", stdout: "", failure: "PUBLICATION_DEADLINE" };
      const output = await runBounded([...argv], step, remainingMs, { cwd: repository, environment });
      return { ...output, stdout: await readFile(resolve(step, "command.stdout"), "utf8") };
    },
  }, plan);
  try {
    await writeFile(resolve(directory, "publication.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  } catch {
    result.status = "FAIL";
    result.failure ??= "PUBLICATION_RECEIPT_WRITE_FAILED";
    result.failedStep ??= "receipt";
  }
  return result;
}

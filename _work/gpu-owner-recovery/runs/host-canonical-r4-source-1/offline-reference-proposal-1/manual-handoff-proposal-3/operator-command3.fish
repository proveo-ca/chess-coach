begin
  set -lx MISE_AUTO_INSTALL false
  set -lx MISE_TASK_RUN_AUTO_INSTALL false
  set -lx MISE_EXEC_AUTO_INSTALL false
  printf '%s' 'Untimed installed Bun selection; no installation or claim in launcher selection.
' >&2
  test (pwd -P) = '/home/gu1lty/Projects/proveo/chess-coach'; or exit 1
  command mise exec core:bun@1.4.0 -- bun --no-env-file --no-install --eval '(async function createDeliveryRuntime() {
  const bootstrapEntryOrigin = process.hrtime.bigint(), fs = await import("node:fs"), path = await import("node:path"), crypto = await import("node:crypto"), cp = await import("node:child_process"), https = await import("node:https"), CAPTURE_PROOF = { path: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/fullverification-6/proof.json", sha256: "8d1ef28d5e90cfb921ad5af31dbbf6fbeb00909ad669de8bd9724c64221415e5" }, CALLER_PROOF = { path: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/invocation-verification-4/proof.json", sha256: "a6a839b7b53ebfe9958e6ad5a063bfd161abe615a29418b18916860675989fcd" }, SOURCE_REVIEW = { path: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-result-3.json", sha256: "c9bd7ed9a5aa1623be547c71eb7093301827a810db3f6e830eebf52326ba12ee" }, future = { deliveryRelease: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery-release3.json", sealedPacketResult: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/sealed-packet-result3.json", packetPublication: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/packet-publication3.json", commandPublication: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/command-publication3.json" }, publicationWorkflow = { approval: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/packet-publication-approval3.json", selection: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/packet-publication-selection3.json", postcheck: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/packet-postcheck3.json", observations: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/packet-publication-observations3", repository: "https://github.com/proveo-ca/chess-coach.git", gitExecutable: "/usr/bin/git", commitMessage: "Publish approved H3 source packet" }, deliveryNames = ["delivery-bootstrap.ts", "delivery-contract3.json", "delivery-packet.ts", "delivery-render.ts", "delivery-verify.ts", "delivery.test.ts", "delivery.tsconfig.json"], sourcePins = Object.fromEntries(Object.entries({
    "capture.ts": "570d3be7da0428521260c4f15733e93495eb09a6d12bb077634106d1359b92d9",
    "capture.test.ts": "a639ba1103e9dd041ed02055785ff6f8a8c7a8ce7b81380ffb68d563014be021",
    "capture-full.test.ts": "6db8469b171f6227d5ac7507ec3884b81ccd82b0848178a48a1e64d9048edec3",
    "root-context.ts": "3f2715121d77141749915a7e9a4dc6d445b5e4630056f581de27f96364f176df",
    "root-context.test.ts": "f3e36a58bc864bafcade7a2b210cb6372e0843347acbc5a86636005708a60252",
    "cache-parent.ts": "62db5298937cf1c752a76b39f42fa19876e36e637d9d21dba6de323de347b27c",
    "cache-parent.test.ts": "83d8e91683140c35de498a9457060f47ec00b94ef59c9d83e47593456c24205f",
    "cache-parent-adapter.ts": "b443bd99c1961dc493fb7e33835391fec8373af73cd9aa1eafb66790261c0623",
    "cache-parent-adapter.test.ts": "32391b054f47e22ae5936aa22e4a25ce07c853de6e1f27c4b5dc9e3c1a4abfe9",
    "verify.ts": "1c391e3eb2e01f7dc5641df5bb43a57c2eab0ab13c523a432a67c487b1f65f72",
    "tsconfig.json": "0083541937af45cc505e9bde2afc99ece5af54fe1855060d20c498bc01488391",
    ".gitignore": "91317cffd2ef9526d9d0ba70fcefa8499556f916a21327cb5492407dd679db0d"
  }).map(([name, sha]) => [`_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/${name}`, sha]));
  Object.assign(sourcePins, Object.fromEntries(Object.entries({ "invoke-approved-bun.ts": "a199bc84f9da248414fb7ea34b760e6d326fa888afff104cc35ed3e0c95d20ef", "invoke-approved-bun.test.ts": "6f2ea8af56d7bc6761d1a9f2fc000f634803a5fe6867c503124b56d9f48970f5", "invoke-approved-bun-verify.ts": "eb1e869c2a1225eadb0cbae82cb148da6fc4fc9302dc43da9e4f8ccdba4ce1c4", "invoke-approved-bun.tsconfig.json": "475349522320904b0f41ec6fa19b785ddccfe51f97bc5b36c0c123bcf9eee56a" }).map(([name, sha]) => [`_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/${name}`, sha])));
  const BOUNDARY_PATH = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-launch-boundary-selection1.json", BOUNDARY_SHA = "44aa077f7db10d3bc3a462da355198973a6f2afba29b7745d4c2bba53f94cdc5", AMENDMENT_PATH = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-source-transport-amendment1.json", AMENDMENT_SHA = "f53b4985052f242a453d24e1bcccde47d1589288952543ea0a5b7d5756291918", fixedInputs = [
    ["_work/gpu-owner-recovery/verify.ts", "9831b75035a5d832c6d86608b7d561821ee1a4c6dec8d2a7ecd31fbca55d5f58"],
    ["_work/gpu-owner-recovery/command-supervisor.ts", "88e56077c3bcddf722f81081a0cb7c6f94d1da106add486dbf13a92d165fb9c6"],
    ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/local-inputs-1/inputs/reference/pnpm-lock.yaml", "1d05ed3d8de5a94873f26a2fb51b88c080704d2e90bf942f9f0bb2ce75a504e0"]
  ], bindings = [
    ["acquisitionRequest", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/request.json", "c0288e1e34e24d2f7a81e12ee1967ffafbd2768b4c2a5bc2ba15826b6384ff3f"],
    ["acquisitionPlan", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/plan.json", "7f6a90ca105d6a7c5a45951b508d4a1ecdd5e217625d1cefe08da23557847405"],
    ["manualHandoffRequest", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-handoff-request1.json", "47d63b8cb446cdc8a83323788c9106cdb82437992e7bd3a88f55821aa6bde52b"],
    ["manualHandoffPlan", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-handoff-plan1.json", "4297e4f1b763b5aa152b88a7a3e288a19cafc85331cbed2d776f38d043f8817a"]
  ], authorityPins = {
    ...Object.fromEntries(bindings.map(([, name, sha]) => [name, sha])),
    ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/approval2.json"]: "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f",
    ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-1/plan.json"]: "8ecfce5156322da42fb852cd071a6091b96187e19a88226bec68295936505f6c",
    ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/local-inputs-1/check.json"]: "acca1e84beb0ebfacf3fb0a7967ffe5d16552861b0da98a4f7e6b4367cee9c63",
    [fixedInputs[2][0]]: fixedInputs[2][1],
    ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/request.json"]: "869d9d97cededc33e51f13cdfdd24de46b971b85d468fe7b5da5ff8621810bf2",
    ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/plan.json"]: "5904802495bf21feeb38b3a049baafd0d704a6c0ad86f371de8c51911d582d9e",
    ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/authority-delta-draft1.json"]: "3a4bdcd383b762b4c5220dd2588fe8b9474cc0e6485ab9574ed5149bc8fc06ec",
    ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/visibility-contract1.json"]: "b9df7a4668aad028fd1d3afcf0969c5d6af5f790aa7e64491dd278d88a6a88b6",
    ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-handoff-report-1/operator-report.json"]: "3912ba6a3bbc036317d03dc83ac950f342b229fe873f1bd588614423501ddd1d",
    ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-handoff-report-1/consumption.json"]: "0cf60b233ad5af53402bc4cff3f68645611f75694fc08c6fc32745814a45c030",
    ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-handoff-report-1/interruption-clarification.json"]: "8a877da0e36aae13bae300332cca105e2733509a2a005cfbb7a9ee3330feba01",
    ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/approval3.json"]: "5e8edc68ad5936cc9d919a9adb7030536ecf0da854b263c170ebec08a06cc121",
    ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/authority-selection2.json"]: "83fe718207581fdb5f07cc8cd692847387f8d474aeef0074f84cea84eb2299df"
  }, limits = { files: 96, file: 1048576, source: 6291456, packet: 8388608, response: 12582912, directories: 256, stageA: 120000, fetch: 30000, stderr: 65536 }, blockers = [];
  function need(value, reason) {
    if (!value)
      throw Error(reason);
  }
  function object(value) {
    need(value !== null && typeof value === "object" && !Array.isArray(value), "object-required");
    return value;
  }
  function same(a, b) {
    if (a === b)
      return !0;
    if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b))
      return !1;
    const x = a, y = b, keys = Object.keys(x);
    return keys.length === Object.keys(y).length && keys.every((key) => Object.hasOwn(y, key) && same(x[key], y[key]));
  }
  function keys(value, names) {
    need(same(Object.keys(value).sort(), names.sort()), "closed-delivery-schema");
  }
  function hash(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }
  function blob(bytes) {
    return crypto.createHash("sha1").update(`blob ${bytes.length}\\x00`).update(bytes).digest("hex");
  }
  function identity(bytes) {
    return { bytes: bytes.length, sha256: hash(bytes), gitBlobOid: blob(bytes) };
  }
  function safePath(value) {
    need(typeof value === "string" && value.length > 0 && value.length <= 1024 && /^[A-Za-z0-9_.\\/-]+$/.test(value), "canonical-relative-path");
    const parts = value.split("/");
    need(parts.every((p) => p !== "" && p !== "." && p !== ".."), "canonical-relative-path");
    need(!parts.some((p) => /^(?:cache|archives?|node_modules|\\.git|native|compiler-output|__pycache__|failed-full1|halted-llvm|reference-package-inputs-[12]|package-inputs-[12]|acquisition-execution-\\d+|acquisition-invocation-\\d+|reference-package-handoff-\\d+)$/i.test(p)), "prohibited-packet-root");
    need(!parts.some((part) => /^(?:fixtures|qualification-inputs|preliminary-verification-\\d+|approved-scope-snapshot-\\d+|source-review-baseline\\d+|frozen-inputs.json)$/.test(part)), "qualification-provenance-not-runtime");
    need(!Object.values(future).filter((name) => name !== future.deliveryRelease).includes(value), "external-only-record-not-packet-member");
    need(/\\.(?:ts|json|jsonl|yaml|yml|md|puml|stdout|stderr)$/.test(value) || value === "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/.gitignore", "text-source-extension");
    need(value !== "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-packet3.json", "packet-self-membership-forbidden");
  }
  function text(bytes) {
    const decoded = new TextDecoder("utf-8", { fatal: !0 }).decode(bytes);
    need(!/[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f]/.test(decoded), "text-only-source");
    need(Buffer.from(decoded).equals(Buffer.from(bytes)), "canonical-utf8");
    return decoded;
  }
  function decode(value, maximum, wrapped = !1) {
    need(typeof value === "string" && value.length <= Math.ceil(maximum / 3) * 4 + (wrapped ? Math.ceil(maximum / 45) * 2 + 2 : 0), "base64-size-cap");
    need(!wrapped || /^[A-Za-z0-9+/=\\r\\n]*$/.test(value), "base64-encoding");
    const canonical = wrapped ? value.replace(/[\\r\\n]/g, "") : value;
    need(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(canonical), "base64-encoding");
    const bytes = Buffer.from(canonical, "base64");
    need(bytes.length <= maximum && bytes.toString("base64") === canonical, "canonical-base64");
    return bytes;
  }
  function directories(paths) {
    const found = new Set([""]);
    for (const member of [...paths, "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/acquisition-invocation-1/placeholder"]) {
      let parent = path.posix.dirname(member);
      while (parent !== ".") {
        found.add(parent);
        parent = path.posix.dirname(parent);
      }
    }
    need(found.size <= limits.directories, "snapshot-directory-cap");
    return [...found].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  }
  function pinCheck(value) {
    need(Number.isSafeInteger(value.bytes) && value.bytes > 0 && value.bytes <= limits.packet && /^[0-9a-f]{64}$/.test(value.sha256) && /^[0-9a-f]{40}$/.test(value.gitBlobOid), "literal-byte-binding-required");
  }
  function match(bytes, expected) {
    need(bytes.length === expected.bytes && hash(bytes) === expected.sha256 && blob(bytes) === expected.gitBlobOid, "length-sha256-git-blob-mismatch");
  }
  function verifyApproval(files) {
    const approval = files.get("_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/approval2.json");
    need(approval && hash(approval) === "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f", "genuine-approval-sha256");
    const row = object(JSON.parse(text(approval))), bound = object(row.bindings);
    need(row.status === "APPROVED_AT_ISSUANCE_NOT_EXECUTED" && row.manualHandoffGrantId === "reference-package-manual-host-handoff-2" && row.archiveGrantId === "reference-two-package-source-acquisition-2", "composite-approval-row");
    for (const [key, name, sha256] of bindings) {
      const item = object(bound[key]), content = files.get(name);
      need(item.path === name && item.sha256 === sha256 && content && hash(content) === sha256, "four-immutable-approval-bindings");
    }
    const boundaryBytes = files.get(BOUNDARY_PATH);
    need(boundaryBytes && hash(boundaryBytes) === BOUNDARY_SHA, "genuine-launch-boundary-sha256");
    const boundary = object(JSON.parse(text(boundaryBytes)));
    need(boundary.status === "EXECUTOR_CONFIRMED_BOOTSTRAP_CLOCK_BOUNDARY" && object(boundary.approval).sha256 === "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f" && object(boundary.manualPlan).sha256 === bindings[3][2], "launch-boundary-bindings");
    const amendmentBytes = files.get(AMENDMENT_PATH);
    need(amendmentBytes && hash(amendmentBytes) === AMENDMENT_SHA, "genuine-transport-amendment-sha256");
    const amendment = object(JSON.parse(text(amendmentBytes)));
    need(amendment.status === "EXECUTOR_APPROVED_ANONYMOUS_SINGLE_HTTPS_REQUEST" && amendment.additionalAttemptsOrRequestsGranted === 0, "transport-amendment-row");
    for (const [key, name, sha256] of [["approval", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/approval2.json", "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f"], ["manualRequest", bindings[2][1], bindings[2][2]], ["manualPlan", bindings[3][1], bindings[3][2]], ["launchBoundary", BOUNDARY_PATH, BOUNDARY_SHA]]) {
      const item = object(amendment[key]);
      need(item.path === name && item.sha256 === sha256, "transport-amendment-bindings");
    }
    const a3 = object(JSON.parse(text(pinned(files, { path: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/approval3.json", sha256: "5e8edc68ad5936cc9d919a9adb7030536ecf0da854b263c170ebec08a06cc121" }))));
    need(a3.version === "chess-coach.h3-supplemental-approval.v1" && a3.status === "APPROVED_AT_ISSUANCE_EXECUTION_GATED", "supplemental-approval-schema");
    need(same(a3.originalInnerIssuanceApproval2, { path: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/approval2.json", sha256: "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f" }), "distinct-original-issuer");
    for (const key of ["scopeBindings", "immutableOriginalScopeBindings", "spentH2ReportBindings"]) {
      const pins = object(a3[key]);
      need(Object.keys(pins).length === (key === "spentH2ReportBindings" ? 3 : 4), "exact-authority-scope-count");
      for (const value of Object.values(pins))
        pinned(files, value);
    }
    pinned(files, object(a3.authorizationSource).selection);
    need(same(object(a3.innerGrant).allowanceAdded, { combinedAttempts: 0, npmGetRequests: 0 }) && same(a3.publicationAuthorityAdded, { commits: 0, pushes: 0 }), "no-renewal-or-publication-grant");
  }
  function pinned(files, value) {
    const pin = object(value);
    keys(pin, ["path", "sha256"]);
    safePath(pin.path);
    need(typeof pin.sha256 === "string" && /^[a-f0-9]{64}$/.test(pin.sha256), "record-sha256");
    const bytes = files.get(pin.path);
    need(bytes && hash(bytes) === pin.sha256, "required-record-pin");
    return bytes;
  }
  function recordAt(files, name) {
    const data = files.get(name);
    need(data, `required-fixed-member:${name}`);
    return object(JSON.parse(text(data)));
  }
  function roleGate(value) {
    const scopes = object(value);
    keys(scopes, ["capture", "caller", "delivery"]);
    for (const scope of Object.values(scopes)) {
      const roles = object(scope);
      keys(roles, ["backend", "devops", "adversarial", "security"]);
      need(Object.values(roles).every((role) => role === "READY"), "all-twelve-source-gates");
    }
  }
  function validateRelease(files, synthetic = !1) {
    const release = recordAt(files, future.deliveryRelease);
    keys(release, ["version", "scope", "nonAuthorizing", "approval3Sha256", "sourceIdentitySha256", "producerProofs", "sourceReviewResult", "deliverySources", "deliveryGeneration", "deliveryProof", "deliveryReviews", "binding", "readiness"]);
    need(release.version === "chess-coach.h3-delivery-release.v1" && release.nonAuthorizing === !0 && release.scope === (synthetic ? "OFFLINE_SYNTHETIC" : "REVIEWED_RELEASED_SOURCE_ONLY"), "delivery-release-schema");
    need(release.approval3Sha256 === "5e8edc68ad5936cc9d919a9adb7030536ecf0da854b263c170ebec08a06cc121" && release.sourceIdentitySha256 === "a66a0e3f40e9ab30bfe6a16b603649c2007b91460da6747d5e86b7b47892f8c8" && same(release.producerProofs, { capture: CAPTURE_PROOF, caller: CALLER_PROOF }) && same(release.sourceReviewResult, SOURCE_REVIEW), "release-frozen-producer-identities");
    const reviews = object(JSON.parse(text(pinned(files, SOURCE_REVIEW)))).reviews;
    need(Array.isArray(reviews) && reviews.length === 8, "source-eight-review-count");
    const roles = new Set;
    for (const item of reviews) {
      const row = object(item), name = row.path;
      safePath(name);
      need(name === `_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-3/${row.scope}/${row.role}.json` && ["capture", "caller"].includes(String(row.scope)) && ["backend", "devops", "adversarial", "security"].includes(String(row.role)), "source-eight-review-location");
      const review = object(JSON.parse(text(pinned(files, { path: name, sha256: row.sha256 }))));
      need(review.verdict === "READY" && same(review.remainingFindings, []) && review.sourceIdentitySha256 === "a66a0e3f40e9ab30bfe6a16b603649c2007b91460da6747d5e86b7b47892f8c8", "source-eight-ready-reviews");
      roles.add(`${row.scope}/${row.role}`);
    }
    need(roles.size === 8, "source-eight-distinct-reviews");
    for (const proof of [CAPTURE_PROOF, CALLER_PROOF]) {
      const value = object(JSON.parse(text(pinned(files, proof)))), manifest = files.get(`${path.posix.dirname(proof.path)}/source-manifest.json`);
      need(manifest && hash(manifest) === value.sourceManifestSha256 && hash(Buffer.from(JSON.stringify(value.sourceIdentity))) === "a66a0e3f40e9ab30bfe6a16b603649c2007b91460da6747d5e86b7b47892f8c8" && value.status === "PASS_OFFLINE_ONLY", "frozen-producer-proof-and-manifest");
    }
    const deliverySources = Object.fromEntries(deliveryNames.map((name) => {
      const path = `_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/${name}`, data = files.get(path);
      need(data, "delivery-seven-members");
      return [path, hash(data)];
    }));
    need(same(release.deliverySources, deliverySources), "release-delivery-source-map");
    const generation = validateGenerationShape(release.deliveryGeneration, Object.fromEntries(deliveryNames.map((name) => {
      const member = `_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/${name}`;
      return [member, identity(files.get(member))];
    })));
    need(generation.bootstrapFunctionSha256 === hash(Buffer.from(createDeliveryRuntime.toString())), "executing-bootstrap-generation-mismatch");
    const proofPin = object(release.deliveryProof), proofPath = proofPin.path;
    need(typeof proofPath === "string" && proofPath.startsWith("_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery-verification-") && /^([1-9][0-9]{0,3})\\/proof\\.json$/.test(proofPath.slice(134)), "delivery-proof-location");
    const proof = object(JSON.parse(text(pinned(files, proofPin))));
    validateDeliveryProof(proof, deliverySources, `/home/gu1lty/Projects/proveo/chess-coach/${path.posix.dirname(proofPath)}`);
    const proofManifest = files.get(`${path.posix.dirname(proofPath)}/source-manifest.json`);
    need(same(proof.deliveryGeneration, generation), "release-qualified-generation-mismatch");
    need(proofManifest && hash(proofManifest) === proof.sourceManifestSha256 && same(JSON.parse(text(proofManifest)), { sources: deliverySources, sourceIdentitySha256: "a66a0e3f40e9ab30bfe6a16b603649c2007b91460da6747d5e86b7b47892f8c8", qualificationDependencyPins: {}, deliveryGeneration: generation, loadTimeSources: generation.sourceFiles, qualificationTooling: proof.qualificationTooling }), "delivery-proof-source-manifest");
    const deliveryReviews = object(release.deliveryReviews);
    keys(deliveryReviews, ["backend", "devops", "adversarial", "security"]);
    for (const [role, value] of Object.entries(deliveryReviews)) {
      const pin = object(value), name = pin.path;
      safePath(name);
      const suffix = name.slice(126);
      need(name.startsWith("_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-") && new RegExp(`^[1-9][0-9]{0,3}/delivery/${role}\\\\.json$`).test(suffix), "delivery-review-location");
      const review = object(JSON.parse(text(pinned(files, pin))));
      need(review.scope === "delivery" && review.role === role && review.verdict === "READY" && same(review.remainingFindings, []) && same(review.proof, proofPin) && same(review.sourceHashes, deliverySources), "delivery-four-source-reviews");
    }
    const bindingPin = object(release.binding), readyPin = object(release.readiness);
    need(bindingPin.path === "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/execution-binding3.json" && readyPin.path === "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/invocation-ready3.json", "fixed-binding-readiness-paths");
    const bindingBytes = pinned(files, bindingPin), binding = object(JSON.parse(text(bindingBytes))), ready = object(JSON.parse(text(pinned(files, readyPin))));
    keys(binding, ["version", "grantId", "nonAuthorizing", "sourceIdentity", "verificationProof", "reviews"]);
    const source = object(binding.sourceIdentity);
    need(binding.version === "chess-coach.h3-execution-binding.v1" && binding.nonAuthorizing === !0 && binding.grantId === "reference-two-package-source-acquisition-2" && hash(Buffer.from(JSON.stringify(source))) === "a66a0e3f40e9ab30bfe6a16b603649c2007b91460da6747d5e86b7b47892f8c8" && same(binding.verificationProof, CAPTURE_PROOF), "binding-source-identity");
    roleGate(binding.reviews);
    keys(ready, ["version", "nonAuthorizing", "grantId", "hashes", "identitySha256", "invocationProof", "captureProof", "reviews"]);
    need(ready.version === "chess-coach.h3-invocation-readiness.v1" && ready.nonAuthorizing === !0 && ready.grantId === binding.grantId && same(ready.captureProof, CAPTURE_PROOF) && same(ready.invocationProof, CALLER_PROOF) && ready.identitySha256 === hash(Buffer.from(JSON.stringify({ ...source, proof3Identity: CAPTURE_PROOF, executionBindingSha256: hash(bindingBytes) }))), "readiness-runtime-identity");
    roleGate(ready.reviews);
    need(same(ready.hashes, { caller: object(source.caller3Identity).hashes, source: Object.fromEntries(Object.entries(object(source.sourceHashes)).map(([name, hash]) => [`_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/${name}`, hash])), observer: object(source.observer3Identity).hashes }), "readiness-source-hashes");
    return release;
  }
  function validatePacket(bytes, expected, table, synthetic = !1) {
    pinCheck(expected);
    need(bytes.length <= limits.packet, "packet-byte-cap");
    match(bytes, expected);
    need(table.length > 0 && table.length <= limits.files, "literal-file-table-count");
    const envelope = object(JSON.parse(text(bytes)));
    need(envelope.version === "chess-coach.literal-text-packet.v1" && envelope.kind === "FIXED_LITERAL_TEXT_FILE_TABLE_NOT_A_RESOLVER", "literal-packet-envelope");
    need(Object.keys(envelope).sort().join(",") === "aggregateBytes,directories,files,kind,version", "packet-envelope-fields");
    const rows = envelope.files;
    need(Array.isArray(rows) && rows.length === table.length, "literal-file-table-count");
    const files = new Map, expectedNames = new Set;
    let aggregate = 0;
    for (const entry of table) {
      keys(entry, ["path", "bytes", "sha256", "gitBlobOid"]);
      safePath(entry.path);
      const canonical = entry.path.toLowerCase();
      need(!expectedNames.has(canonical), "duplicate-or-case-conflicting-literal-member");
      expectedNames.add(canonical);
    }
    for (const name of expectedNames) {
      let parent = path.posix.dirname(name);
      while (parent !== ".") {
        need(!expectedNames.has(parent), "file-directory-conflict");
        parent = path.posix.dirname(parent);
      }
    }
    for (let index = 0;index < rows.length; index++) {
      const row = object(rows[index]), wanted = table[index];
      safePath(row.path);
      need(Object.keys(row).sort().join(",") === "base64,bytes,gitBlobOid,path,sha256", "file-row-fields");
      need(!files.has(row.path), "duplicate-packet-member");
      need(row.path === wanted.path && row.bytes === wanted.bytes && row.sha256 === wanted.sha256 && row.gitBlobOid === wanted.gitBlobOid, "fixed-literal-table-mismatch");
      need(Number.isSafeInteger(row.bytes) && Number(row.bytes) >= 0 && Number(row.bytes) <= limits.file, "file-byte-cap");
      const content = decode(row.base64, limits.file);
      text(content);
      match(content, wanted);
      aggregate += content.length;
      need(aggregate <= limits.source, "aggregate-source-cap");
      files.set(row.path, content);
    }
    const dirs = directories([...files.keys()]);
    need(envelope.aggregateBytes === aggregate && JSON.stringify(envelope.directories) === JSON.stringify(dirs), "packet-total-or-directory-table");
    need(files.has("_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/invoke-approved-bun.ts"), "required-fixed-closure-member");
    for (const [member, sha256] of fixedInputs)
      need(files.has(member) && hash(files.get(member)) === sha256, "unchanged-helpers-and-lock-required");
    for (const [member, sha256] of Object.entries(sourcePins))
      need(files.has(member) && hash(files.get(member)) === sha256, "frozen-source-sixteen-required");
    for (const [member, sha256] of Object.entries(authorityPins))
      need(files.has(member) && hash(files.get(member)) === sha256, "prewrite-producer-authority-required");
    verifyApproval(files);
    validateRelease(files, synthetic);
    return { files, directories: dirs, aggregateBytes: aggregate };
  }
  function parseResponse(bytes, pins) {
    need(bytes.length <= limits.response, "github-response-cap");
    const response = object(JSON.parse(text(bytes)));
    need(response.encoding === "base64" && response.sha === pins.gitBlobOid && response.size === pins.bytes, "github-blob-response-identity");
    const packet = decode(response.content, limits.packet, !0);
    match(packet, pins);
    return packet;
  }
  function ancestors(directory) {
    const all = [];
    for (let current = path.resolve(directory);; current = path.dirname(current)) {
      all.push(current);
      if (path.dirname(current) === current)
        break;
    }
    for (const current of all.reverse()) {
      const stat = fs.lstatSync(current);
      need(stat.isDirectory() && !stat.isSymbolicLink(), "existing-nonsymlink-ancestor-required");
    }
  }
  function absent(name) {
    try {
      fs.lstatSync(name);
      throw Error("fresh-path-required");
    } catch (error) {
      if (error.code !== "ENOENT")
        throw error;
    }
  }
  function durableDirectory(directory, fault) {
    const fd = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    let failed;
    try {
      fs.fsyncSync(fd);
    } catch (error) {
      failed = error;
    }
    try {
      fs.closeSync(fd);
      if (fault === "directory-close")
        throw Error("synthetic-directory-close");
    } catch (error) {
      failed ??= error;
    }
    if (failed)
      throw failed;
  }
  function freshDirectory(directory) {
    ancestors(path.dirname(directory));
    fs.mkdirSync(directory, { mode: 448 });
    durableDirectory(directory);
    durableDirectory(path.dirname(directory));
  }
  function writeExclusive(name, bytes, mode = 256, fault) {
    ancestors(path.dirname(name));
    const fd = fs.openSync(name, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, mode);
    let failed;
    try {
      fs.writeFileSync(fd, bytes);
      fs.fsyncSync(fd);
    } catch (error) {
      failed = error;
    }
    try {
      fs.closeSync(fd);
      if (fault === "file-close" || fault === "receipt-close")
        throw Error(`synthetic-${fault}`);
    } catch (error) {
      failed ??= error;
    }
    try {
      durableDirectory(path.dirname(name));
    } catch (error) {
      failed ??= error;
    }
    if (failed)
      throw failed;
  }
  function record(name, value, fault) {
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + `
`);
    need(bytes.length <= 65536, "receipt-byte-cap");
    writeExclusive(name, bytes, 256, fault);
  }
  function clock(budget, origin = bootstrapEntryOrigin, fault) {
    need(Number.isFinite(budget) && budget > 0 && budget <= limits.stageA, "bounded-process-local-budget-required");
    let previous = origin, sticky = !1, finalizing = !1;
    const remaining = () => {
      const now = process.hrtime.bigint();
      if (fault === "clock" || now < previous)
        sticky = !0;
      previous = now;
      need(!sticky, "stage-a-clock-failure");
      const left = budget - Number(now - origin) / 1e6;
      if (finalizing && fault === "finalization-deadline")
        return -1;
      return left;
    };
    return { remaining, check: () => need(remaining() > 0, "stage-a-deadline"), finalizing: () => {
      finalizing = !0;
    }, invalidate: () => {
      sticky = !0;
    } };
  }
  const fishPrelude = `Untimed installed Bun selection; no installation or claim in launcher selection.
`, fishWitnessMaximumBytes = 96;
  function visibility(writer, preludeBytes = Buffer.byteLength(fishPrelude), witnessBytes = fishWitnessMaximumBytes, onFailure = () => {}, errorSource) {
    need(Number.isSafeInteger(preludeBytes) && preludeBytes >= 0 && preludeBytes <= 14336 && Number.isSafeInteger(witnessBytes) && witnessBytes >= 0 && witnessBytes <= 2048, "fish-ux-byte-reservations");
    let nonterminalBytes = 0, terminalBytes = 0, backpressure = !1, writeFailure = !1, terminalAttempts = 0, heartbeatTicks = 0, nextHeartbeatMs = 1000, pendingCallbacks = 0, errorDispatches = 0, awaitingError = !1, released = !1, sinkClosed = !1, guardInstalled = !1;
    const subscribers = new Set, sink = errorSource ?? (writer ? void 0 : process.stderr), write = writer ?? ((line, callback) => process.stderr.write(line, callback)), latch = () => {
      process.exitCode = 1;
      if (writeFailure)
        return;
      writeFailure = !0;
      try {
        onFailure("visibility-write-failed");
      } catch {}
      for (const notify of [...subscribers])
        try {
          notify("visibility-write-failed");
        } catch {}
    }, detach = () => {
      if (guardInstalled && released && (sinkClosed || pendingCallbacks === 0 && !awaitingError)) {
        sink.removeListener("error", onError);
        sink.removeListener("close", onClose);
        guardInstalled = !1;
      }
    }, onError = () => {
      errorDispatches++;
      awaitingError = !1;
      latch();
      detach();
    }, onClose = () => {
      sinkClosed = !0;
      detach();
    };
    if (sink) {
      sink.on("error", onError);
      sink.on("close", onClose);
      guardInstalled = !0;
    }
    const subscribe = (notify) => {
      subscribers.add(notify);
      if (writeFailure)
        notify("visibility-write-failed");
      return () => {
        subscribers.delete(notify);
      };
    }, emit = (value, terminal = !1) => {
      const line = JSON.stringify(value) + `
`, bytes = Buffer.byteLength(line);
      if (terminal) {
        if (terminalAttempts > 0)
          return !1;
        terminalAttempts++;
        if (bytes > 2048 - witnessBytes)
          return !1;
        terminalBytes += bytes;
      } else {
        if (writeFailure || backpressure || nonterminalBytes + bytes > 14336 - preludeBytes)
          return !1;
        nonterminalBytes += bytes;
      }
      if (writeFailure)
        return !1;
      pendingCallbacks++;
      let completed = !1;
      const beforeErrors = errorDispatches, complete = (error) => {
        if (completed)
          return;
        completed = !0;
        pendingCallbacks--;
        if (error) {
          if (errorDispatches === beforeErrors && sink && !sinkClosed)
            awaitingError = !0;
          latch();
        }
        detach();
      };
      try {
        if (!write(line, complete))
          backpressure = !0;
      } catch {
        if (!completed) {
          completed = !0;
          pendingCallbacks--;
        }
        latch();
        detach();
        return !1;
      }
      return !0;
    };
    return { emit, heartbeat: (elapsedMs, remainingMs, statusCode, receivedBytes, cleanup = !1) => {
      if (cleanup || heartbeatTicks >= 30 || elapsedMs < nextHeartbeatMs || !Number.isFinite(elapsedMs) || !Number.isFinite(remainingMs) || remainingMs <= 0)
        return;
      nextHeartbeatMs = elapsedMs + 1000;
      heartbeatTicks++;
      emit({ phase: "http-wait", clockScope: "PROCESS_LOCAL_HTTP", elapsedMs: Math.floor(elapsedMs), remainingMs: Math.floor(remainingMs), statusCode, receivedBytes });
    }, subscribe, check: () => need(!writeFailure, "visibility-write-failed"), release: () => {
      released = !0;
      detach();
    }, facts: () => ({ nonterminalBytes, terminalBytes, preludeBytes, witnessBytes, controlledMaximumBytes: preludeBytes + nonterminalBytes + terminalBytes + witnessBytes, backpressure, writeFailure, terminalAttempts, heartbeatTicks, pendingCallbacks, awaitingError, guardInstalled, subscribers: subscribers.size }) };
  }
  const EXPECTED_DELIVERY_TESTS = 221, FISH = "/home/agent/toolchains/linux-amd64/.local/share/mise/installs/github-fish-shell-fish-shell/4.9.3/fish";
  function parseSummary(input) {
    need(Buffer.byteLength(input) <= 131073, "summary-byte-cap");
    const counts = new Map;
    let total = null, files = null, nonpass = !1;
    for (const raw of input.split(/\\r?\\n/)) {
      const line = raw.trim(), label = /^\\((pass|fail|skip|todo)\\) .+$/.exec(line);
      if (label) {
        nonpass ||= label[1] !== "pass";
        continue;
      }
      const match = /^(0|[1-9][0-9]{0,15}) (pass|fail|skip|todo)$/.exec(line);
      if (match) {
        need(!counts.has(match[2]), "duplicate-summary");
        const n = Number(match[1]);
        need(Number.isSafeInteger(n), "unsafe-summary");
        counts.set(match[2], n);
        continue;
      }
      need(!/^\\S+\\s+(?:pass|fail|skip|todo)/.test(line), "malformed-summary");
      const ran = /^Ran (0|[1-9][0-9]{0,15}) tests across (0|[1-9][0-9]{0,15}) files?\\. \\[[0-9]{1,12}(?:\\.[0-9]{1,6})?(?:ms|s)\\]$/.exec(line);
      if (ran) {
        need(total === null, "duplicate-total");
        total = Number(ran[1]);
        files = Number(ran[2]);
        need(Number.isSafeInteger(total) && Number.isSafeInteger(files), "unsafe-total");
      } else
        need(!line.startsWith("Ran "), "malformed-total");
    }
    need(counts.has("pass") && counts.has("fail") && total !== null && files !== null, "incomplete-summary");
    const result = { expected: EXPECTED_DELIVERY_TESTS, passed: counts.get("pass"), failed: counts.get("fail"), skipped: counts.get("skip") ?? 0, todo: counts.get("todo") ?? 0 };
    need(!nonpass && result.passed === EXPECTED_DELIVERY_TESTS && total === EXPECTED_DELIVERY_TESTS && files === 1 && result.failed === 0 && result.skipped === 0 && result.todo === 0, "exact-delivery-suite-required");
    return result;
  }
  function qualificationCommands(evidence) {
    return { tests: ["--no-env-file", "--no-install", "test", "--only-failures", "/home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery.test.ts", "--timeout", "10000"], typecheck: ["--no-env-file", "--no-install", "/home/gu1lty/Projects/proveo/chess-coach/node_modules/typescript/bin/tsc", "-p", "/home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery.tsconfig.json"], "fish-syntax": ["--no-config", "--no-execute", `${evidence}/synthetic-nonrunning.fish`] };
  }
  function assessDeliveryVerification(input) {
    let tests = null, commandsValid = !1;
    try {
      need(new RegExp("^/home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery-verification-[1-9][0-9]{0,3}$").test(input.evidence), "protected-qualification-evidence");
      const commands = qualificationCommands(input.evidence);
      need(input.results.length === 3, "three-observed-commands");
      for (const name of ["tests", "typecheck", "fish-syntax"]) {
        const matches = input.results.filter((row) => row.name === name);
        need(matches.length === 1, "unique-command-evidence");
        const row = matches[0];
        keys(row, ["name", "executable", "args", "exitCode", "signal", "spawned", "reaped", "closed", "stdoutEOF", "stderrEOF", "cleanupConfirmed", "clockFailure", "cleanupFailure", "finalizationDeadlineExceeded", "failure", "stdout", "stderr"]);
        need(row.executable === (name === "fish-syntax" ? FISH : "/usr/local/bin/bun") && same(row.args, commands[name]), "fixed-command-evidence");
        need(row.exitCode === 0 && row.signal === null && row.spawned === !0 && row.reaped === !0 && row.closed === !0 && row.stdoutEOF === !0 && row.stderrEOF === !0 && row.cleanupConfirmed === !0 && row.clockFailure === !1 && row.cleanupFailure === !1 && row.finalizationDeadlineExceeded === !1 && row.failure === null, "genuine-command-evidence");
        for (const stream of ["stdout", "stderr"]) {
          const pin = object(row[stream]);
          keys(pin, ["bytes", "sha256", "gitBlobOid"]);
          need(typeof pin.sha256 === "string" && /^[a-f0-9]{64}$/.test(pin.sha256) && typeof pin.gitBlobOid === "string" && /^[a-f0-9]{40}$/.test(pin.gitBlobOid) && typeof pin.bytes === "number" && Number.isSafeInteger(pin.bytes) && pin.bytes >= 0 && pin.bytes <= 65536 && (pin.bytes !== 0 || same(pin, identity(Buffer.alloc(0)))), "bounded-command-stream-evidence");
        }
        if (name === "tests") {
          need(Buffer.byteLength(input.testText) <= 131073, "summary-byte-cap");
          const bytes = Buffer.from(input.testText), out = object(row.stdout), err = object(row.stderr), split = out.bytes;
          need(bytes.toString("utf8") === input.testText && bytes.length === split + 1 + err.bytes && bytes[split] === 10, "summary-stream-separator-length-utf8");
          const stdout = bytes.subarray(0, split), stderr = bytes.subarray(split + 1);
          need(new TextDecoder("utf-8", { fatal: !0 }).decode(stdout) === stdout.toString() && new TextDecoder("utf-8", { fatal: !0 }).decode(stderr) === stderr.toString() && same(identity(stdout), out) && same(identity(stderr), err), "summary-stream-identities");
        }
      }
      tests = parseSummary(input.testText);
      commandsValid = !0;
    } catch {}
    return { passed: tests !== null && commandsValid && input.readchecksMatch === !0 && input.sourceUnchanged === !0 && input.actualProductionOrNetworkOperations === 0, tests, commandsValid };
  }
  function validateDeliveryProof(proof, sources, evidence) {
    keys(proof, ["version", "status", "sources", "sourceIdentitySha256", "sourceManifestSha256", "qualificationDependencyPins", "qualificationTooling", "deliveryGeneration", "loadTimeSources", "tests", "typecheckExitCode", "results", "summary", "readchecksMatch", "sourceUnchanged", "actualProductionOrNetworkOperations"]);
    need(proof.version === "chess-coach.h3-delivery-verification.v1" && proof.status === "PASS_OFFLINE_ONLY" && same(proof.sources, sources) && proof.sourceIdentitySha256 === "a66a0e3f40e9ab30bfe6a16b603649c2007b91460da6747d5e86b7b47892f8c8" && same(proof.qualificationDependencyPins, {}) && proof.typecheckExitCode === 0, "delivery-proof-schema");
    need(typeof proof.summary === "string" && Array.isArray(proof.results), "delivery-proof-evidence");
    const tooling = object(proof.qualificationTooling);
    keys(tooling, ["path", "bytes", "sha256", "gitBlobOid"]);
    pinCheck(tooling);
    need(tooling.path === `${evidence.slice(41)}/qualification-dependencies.json`, "fixed-qualification-tooling-record");
    const generation = validateGenerationShape(proof.deliveryGeneration);
    need(same(Object.fromEntries(Object.entries(object(generation.sourceFiles)).map(([name, pin]) => [name, object(pin).sha256])), sources) && same(proof.loadTimeSources, generation.sourceFiles), "proof-loaded-source-generation");
    const result = assessDeliveryVerification({ testText: proof.summary, results: proof.results, readchecksMatch: proof.readchecksMatch === !0, sourceUnchanged: proof.sourceUnchanged === !0, evidence, actualProductionOrNetworkOperations: proof.actualProductionOrNetworkOperations });
    need(result.passed && same(result.tests, proof.tests), "delivery-proof-assessment");
  }
  function validateGenerationShape(value, expectedFiles) {
    const generation = object(value);
    keys(generation, ["sourceFiles", "bootstrapFunctionSha256", "rendererFunctionSha256", "renderingHelpers"]);
    const sources = object(generation.sourceFiles);
    keys(sources, deliveryNames.map((name) => `_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/${name}`));
    for (const value of Object.values(sources)) {
      const pin = object(value);
      keys(pin, ["bytes", "sha256", "gitBlobOid"]);
      pinCheck(pin);
      need(pin.bytes <= limits.file, "generation-source-cap");
    }
    if (expectedFiles)
      need(same(sources, expectedFiles), "generation-source-identities");
    const helpers = object(generation.renderingHelpers);
    need(Object.keys(helpers).length > 0 && Object.keys(helpers).length <= 32, "bounded-rendering-helpers");
    for (const sha of [generation.bootstrapFunctionSha256, generation.rendererFunctionSha256, ...Object.values(helpers)])
      need(typeof sha === "string" && /^[a-f0-9]{64}$/.test(sha), "generation-function-fingerprint");
    return generation;
  }
  function createPipeCleanup() {
    const empty = () => ({ present: null, attempts: 0, confirmed: !1, destroyed: null, failed: !1, firstFailure: null, getterErrors: 0, destroyErrors: 0, streamErrors: 0, stateErrors: 0 }), states = { stdout: empty(), stderr: empty() };
    let cleanupCalls = 0;
    const increment = (value) => Math.min(Number.MAX_SAFE_INTEGER, value + 1);
    function mark(name, counter, reason) {
      const state = states[name];
      state.failed = !0;
      state.firstFailure ??= reason;
      state[counter] = increment(state[counter]);
    }
    function inspect(name, pipe) {
      const state = states[name];
      try {
        const value = pipe.destroyed;
        if (typeof value !== "boolean")
          throw Error("invalid-pipe-state");
        state.destroyed = value;
        state.confirmed = value;
        return value;
      } catch {
        state.destroyed = null;
        state.confirmed = !1;
        mark(name, "getterErrors", `${name}-pipe-state-unknown`);
        return null;
      }
    }
    function report() {
      return { cleanupCalls, destructionAttempted: states.stdout.attempts > 0 || states.stderr.attempts > 0, pipesDestroyed: states.stdout.confirmed && states.stderr.confirmed, cleanupFailed: states.stdout.failed || states.stderr.failed, stdout: { ...states.stdout }, stderr: { ...states.stderr } };
    }
    function attempt(stdout, stderr) {
      cleanupCalls = increment(cleanupCalls);
      for (const [name, pipe] of [["stdout", stdout], ["stderr", stderr]]) {
        const state = states[name];
        state.present = pipe !== null && pipe !== void 0;
        if (!pipe) {
          state.destroyed = null;
          state.confirmed = !1;
          continue;
        }
        if (inspect(name, pipe) === !0)
          continue;
        state.attempts = increment(state.attempts);
        try {
          pipe.destroy();
        } catch {
          mark(name, "destroyErrors", `${name}-pipe-destroy-failed`);
        }
        if (inspect(name, pipe) !== !0)
          mark(name, "stateErrors", `${name}-pipe-destroy-unconfirmed`);
      }
      return report();
    }
    return { attempt, report, noteError: (name) => mark(name, "streamErrors", `${name}-pipe-error`) };
  }
  async function runChild(spec) {
    const stdout = [], stderr = [];
    let outBytes = 0, errBytes = 0, exitCode = null, signal = null, reaped = !1, closed = !1, outEOF = !1, errEOF = !1, failure = null, interrupted = !1, child, spawned = !1, pid = null, spawnError = !1, spawnAttemptCompleted = !1, spawnAttempted = !1, started = null, previous = null, cleanupOrigin = null, cleanupStarted = !1, cleanupReason = null, cleanupOriginElapsedMs = null, cleanupOriginsStarted = 0, cleanupExpired = !1, cleanupClockFailed = !1, signalFailure = !1;
    const pipeCleanup = createPipeCleanup();
    let processGroupGone = null, cancellationSignal = null, settled = !1;
    const signalAttempts = [], attempted = new Set;
    let watchdog, cleanupTimer, killTimer, doneResolve;
    const done = new Promise((resolve) => {
      doneResolve = resolve;
    });
    function sample() {
      try {
        const now = process.hrtime.bigint();
        if (previous !== null && now < previous || spec.syntheticFault === "child-clock")
          throw Error("clock");
        previous = now;
        return now;
      } catch {
        cleanupClockFailed = !0;
        failure ??= "child-clock-failure";
        return null;
      }
    }
    function finish() {
      if (!settled) {
        settled = !0;
        doneResolve();
      }
    }
    function destroyPipes() {
      const pipes = pipeCleanup.attempt(child?.stdout, child?.stderr);
      if (pipes.cleanupFailed)
        failure ??= pipes.stdout.firstFailure ?? pipes.stderr.firstFailure ?? "pipe-cleanup-failed";
    }
    function send(target, sig) {
      if (pid === null || attempted.has(`${target}:${sig}`))
        return;
      attempted.add(`${target}:${sig}`);
      try {
        const delivered = target === "GROUP" ? process.kill(-pid, sig) : child?.kill(sig);
        signalAttempts.push({ target, signal: sig, result: delivered === !0 ? "SENT" : "NOT_DELIVERED" });
        if (delivered !== !0) {
          signalFailure = !0;
          failure ??= "owned-signal-not-delivered";
        }
      } catch {
        signalAttempts.push({ target, signal: sig, result: "THREW" });
        signalFailure = !0;
        failure ??= "owned-signal-threw";
      }
    }
    function terminate() {
      send("GROUP", "SIGTERM");
      if (killTimer === void 0 && !settled)
        killTimer = setTimeout(() => {
          send("GROUP", "SIGKILL");
        }, 50);
    }
    function startCleanup(reason) {
      if (cleanupStarted)
        return;
      cleanupStarted = !0;
      cleanupReason = reason;
      cleanupOriginsStarted++;
      cleanupOrigin = sample();
      if (cleanupOrigin !== null && started !== null)
        cleanupOriginElapsedMs = Number(cleanupOrigin - started) / 1e6;
      let reserve = spec.cleanupMs;
      if (spec.deadlineOwner !== "INNER_CALLER")
        try {
          reserve = Math.max(0, Math.min(reserve, spec.remainingMs()));
        } catch {
          cleanupClockFailed = !0;
          reserve = 0;
        }
      cleanupTimer = setTimeout(() => {
        cleanupExpired = !0;
        failure ??= "child-cleanup-deadline";
        send("GROUP", "SIGTERM");
        send("GROUP", "SIGKILL");
        destroyPipes();
        finish();
      }, reserve);
    }
    function fail(reason) {
      if (settled)
        return;
      failure ??= reason;
      startCleanup("FAILURE");
      terminate();
    }
    function groupGone() {
      if (pid === null)
        return null;
      try {
        if (process.kill(-pid, 0) !== !0) {
          fail("owned-process-group-check-failed");
          return null;
        }
        return !1;
      } catch (error) {
        if (error.code === "ESRCH")
          return !0;
        fail("owned-process-group-check-failed");
        return null;
      }
    }
    function observe() {
      if (settled)
        return;
      if (spawnAttemptCompleted && !spawned && (spawnError || !spawnAttempted)) {
        destroyPipes();
        finish();
        return;
      }
      if (reaped && (!closed || !outEOF || !errEOF))
        startCleanup("POST_EXIT_DRAIN");
      if (reaped && closed && outEOF && errEOF) {
        processGroupGone = groupGone();
        if (processGroupGone === !0)
          finish();
        else
          fail("owned-process-group-remains-or-unconfirmed");
      }
    }
    function interrupt(sig) {
      if (interrupted)
        return;
      interrupted = !0;
      cancellationSignal = sig;
      failure ??= "delivery-interrupted";
      startCleanup("FAILURE");
      send("CHILD", sig);
      terminate();
      observe();
    }
    const onInt = () => interrupt("SIGINT"), onTerm = () => interrupt("SIGTERM"), onHup = () => interrupt("SIGHUP");
    process.on("SIGINT", onInt);
    process.on("SIGTERM", onTerm);
    process.on("SIGHUP", onHup);
    const unsubscribeFailure = spec.subscribeFailure?.((reason) => {
      fail(reason);
      observe();
    });
    try {
      need(Number.isFinite(spec.workMs) && spec.workMs > 0 && Number.isFinite(spec.cleanupMs) && spec.cleanupMs >= 0 && spec.cleanupMs <= 2000, "child-local-duration-required");
      started = sample();
      if (started === null)
        throw Error("child-clock-failure");
      if (spec.deadlineOwner !== "INNER_CALLER")
        need(spec.remainingMs() > 0, "child-parent-duration-required");
      need(failure === null, failure ?? "visibility-write-failed");
      watchdog = setInterval(() => {
        const now = sample();
        if (now === null)
          fail("child-clock-failure");
        if (spec.syntheticFault === "interrupt" && !interrupted)
          interrupt("SIGINT");
        if (spec.deadlineOwner !== "INNER_CALLER")
          try {
            if (now !== null && started !== null && Number(now - started) / 1e6 >= spec.workMs)
              fail("child-deadline");
            if (spec.remainingMs() <= spec.cleanupMs)
              fail("child-deadline");
          } catch {
            cleanupClockFailed = !0;
            fail("parent-clock-failure");
          }
        if (failure !== null) {
          startCleanup("FAILURE");
          terminate();
        }
        observe();
      }, 5);
      spawnAttempted = !0;
      child = cp.spawn(spec.executable, spec.args, { cwd: spec.cwd, env: spec.env, detached: !0, shell: !1, stdio: ["ignore", "pipe", "pipe"] });
      spawnAttemptCompleted = !0;
      if (typeof child.pid === "number") {
        spawned = !0;
        pid = child.pid;
      }
      need(child.stdout && child.stderr, "owned-child-pipes-required");
      const collect = (data, isOut) => {
        const current = isOut ? outBytes : errBytes, cap = isOut ? spec.stdoutCap : spec.stderrCap, accepted = Math.max(0, Math.min(data.length, cap - current));
        if (accepted)
          (isOut ? stdout : stderr).push(Buffer.from(data.subarray(0, accepted)));
        if (isOut)
          outBytes += accepted;
        else
          errBytes += accepted;
        if (accepted !== data.length)
          fail(isOut ? "child-stdout-cap" : "child-stderr-cap");
      };
      child.stdout.on("data", (data) => collect(data, !0));
      child.stderr.on("data", (data) => collect(data, !1));
      child.stdout.once("end", () => {
        outEOF = !0;
        observe();
      });
      child.stderr.once("end", () => {
        errEOF = !0;
        observe();
      });
      child.stdout.once("error", () => {
        pipeCleanup.noteError("stdout");
        fail("stdout-pipe-error");
      });
      child.stderr.once("error", () => {
        pipeCleanup.noteError("stderr");
        fail("stderr-pipe-error");
      });
      child.once("spawn", () => {
        spawned = !0;
        pid = child?.pid ?? pid;
      });
      child.once("error", () => {
        spawnError = !spawned && pid === null;
        fail(spawnError ? "child-spawn-error" : "child-process-error");
        observe();
      });
      child.once("exit", (code, sig) => {
        exitCode = code;
        signal = sig;
        reaped = !0;
        if (code !== 0 || sig !== null)
          fail("child-nonzero-or-signal");
        observe();
      });
      child.once("close", () => {
        closed = !0;
        observe();
      });
      await done;
    } catch (error) {
      spawnAttemptCompleted = !0;
      spawnError = spawnAttempted && !spawned && pid === null;
      fail(error instanceof Error ? error.message : "child-failure");
      observe();
      if (!settled)
        await done;
    } finally {
      unsubscribeFailure?.();
      if (watchdog !== void 0)
        clearInterval(watchdog);
      if (cleanupTimer !== void 0)
        clearTimeout(cleanupTimer);
      if (killTimer !== void 0)
        clearTimeout(killTimer);
      process.removeListener("SIGINT", onInt);
      process.removeListener("SIGTERM", onTerm);
      process.removeListener("SIGHUP", onHup);
      if (!reaped || !closed || !outEOF || !errEOF) {
        failure ??= "owned-child-reap-or-eof-unconfirmed";
        send("GROUP", "SIGKILL");
        destroyPipes();
      }
    }
    const stdoutBuffer = Buffer.concat(stdout), stderrBuffer = Buffer.concat(stderr);
    let finalizationDeadlineExceeded = !1;
    const finalNow = sample();
    if (finalNow === null)
      failure ??= "child-clock-failure";
    if (cleanupOrigin !== null && finalNow !== null && Number(finalNow - cleanupOrigin) / 1e6 >= spec.cleanupMs) {
      cleanupExpired = !0;
      failure ??= "child-cleanup-deadline";
    }
    if (spec.deadlineOwner !== "INNER_CALLER")
      try {
        if (spec.remainingMs() <= 0) {
          finalizationDeadlineExceeded = !0;
          failure ??= "child-finalization-deadline";
        }
      } catch {
        cleanupClockFailed = !0;
        failure ??= "parent-clock-failure";
      }
    if (spec.syntheticFault === "cleanup")
      failure ??= "synthetic-cleanup-failed";
    if (spec.syntheticFault === "child-finalization-deadline") {
      finalizationDeadlineExceeded = !0;
      failure ??= "child-finalization-deadline";
    }
    const pipeDestruction = pipeCleanup.report(), pipesDestroyed = pipeDestruction.pipesDestroyed, pipeDestructionAttempted = pipeDestruction.destructionAttempted, pipeCleanupFailed = pipeDestruction.cleanupFailed, cleanupConfirmed = spawned && reaped && closed && outEOF && errEOF && processGroupGone === !0 && !cleanupExpired && !cleanupClockFailed && pipeDestruction.cleanupCalls === 0 && !pipeCleanupFailed && !signalFailure && spec.syntheticFault !== "cleanup";
    if (failure === null && (!cleanupConfirmed || exitCode !== 0 || signal !== null))
      failure = "child-lifecycle-incomplete";
    return { stdout: stdoutBuffer, stderr: stderrBuffer, spawnAttempted, spawned, pid, spawnError, noChildCreated: !spawned && pid === null && (spawnError || !spawnAttempted), exitCode, signal, reaped, closed, outEOF, errEOF, failure, interrupted, cancellationSignal, cleanupStarted, cleanupReason, cleanupOriginElapsedMs, cleanupOriginsStarted, cleanupBudgetMs: spec.cleanupMs, cleanupExpired, cleanupClockFailed, finalizationDeadlineExceeded, pipesDestroyed, pipeDestructionAttempted, pipeCleanupFailed, pipeDestruction, processGroupGone, cleanupConfirmed, descendantsConfirmedGone: !1, signalFailure, signalAttempts };
  }
  function requestOptions(oid) {
    need(/^[a-f0-9]{40}$/.test(oid), "committed-git-blob-pin-required");
    return { protocol: "https:", hostname: "api.github.com", port: 443, path: `/repos/proveo-ca/chess-coach/git/blobs/${oid}`, method: "GET", agent: !1, headers: { Accept: "application/vnd.github+json", "User-Agent": "chess-coach-reference-package-handoff-3", Connection: "close", "Accept-Encoding": "identity" } };
  }
  async function fetchPacket(oid, remainingMs, factory, fetchMs, fault, suppliedVisibility) {
    const ux = suppliedVisibility ?? visibility(), started = process.hrtime.bigint();
    let previous = started;
    const chunks = [];
    let request = null, response = null, socket = null, requestCalls = 0, receivedBytes = 0, retainedBytes = 0, statusCode = null, failure = null, requestFinished = !1, requestClosed = !1, responseEOF = !1, responseClosed = !1, socketClosed = !1, cleanupStarted = !1, cleanupFailed = !1, aborted = !1, settled = !1, interrupted = !1, factoryReturned = !1, clockFailure = !1, finalizationDeadlineExceeded = !1, observedSignal = null;
    const destroyAttempted = new Set;
    let resolveDone;
    const done = new Promise((resolve) => {
      resolveDone = resolve;
    }), cleanupReserve = Math.min(2000, fetchMs / 4), fail = (reason) => {
      failure ??= reason;
    }, elapsed = () => {
      try {
        const now = process.hrtime.bigint();
        if (now < previous || fault === "transport-clock")
          throw Error("clock");
        previous = now;
        return Number(now - started) / 1e6;
      } catch {
        clockFailure = !0;
        fail("https-clock-failure");
        return Number.POSITIVE_INFINITY;
      }
    }, parentLeft = () => {
      try {
        return remainingMs();
      } catch {
        clockFailure = !0;
        fail("https-parent-clock-failure");
        return -1;
      }
    }, destroy = (resource) => {
      if (!resource || destroyAttempted.has(resource))
        return;
      destroyAttempted.add(resource);
      try {
        resource.destroy();
      } catch {
        cleanupFailed = !0;
        fail("https-owned-destroy-failed");
      }
    }, allClosed = () => (!request || requestClosed) && (!response || responseClosed) && (!socket || socketClosed), maybeDone = () => {
      if (factoryReturned && cleanupStarted && allClosed()) {
        settled = !0;
        resolveDone();
      }
    }, cleanup = () => {
      cleanupStarted = !0;
      destroy(response);
      destroy(request);
      destroy(socket);
      maybeDone();
    }, abort = (reason) => {
      if (settled)
        return;
      fail(reason);
      aborted = !0;
      cleanup();
    }, interrupt = (signal = null) => {
      if (signal !== null)
        observedSignal = signal;
      interrupted = !0;
      abort("https-interrupted");
    }, onInt = () => interrupt("SIGINT"), onTerm = () => interrupt("SIGTERM"), onHup = () => interrupt("SIGHUP"), onResponse = (incoming) => {
      if (response || settled) {
        fail("https-unexpected-response");
        destroy(incoming);
        cleanup();
        return;
      }
      response = incoming;
      statusCode = incoming.statusCode ?? null;
      incoming.on("error", () => {
        abort("https-response-error");
      });
      incoming.once("aborted", () => {
        abort("https-response-aborted");
      });
      incoming.once("close", () => {
        responseClosed = !0;
        if (!responseEOF || !incoming.complete)
          abort("https-response-incomplete");
        maybeDone();
      });
      incoming.on("data", (value) => {
        if (!Buffer.isBuffer(value)) {
          abort("https-binary-stream-required");
          return;
        }
        receivedBytes = Math.min(limits.response + 1, receivedBytes + Math.min(value.length, limits.response + 1));
        const accepted = Math.max(0, Math.min(value.length, limits.response - retainedBytes));
        if (accepted > 0) {
          chunks.push(Buffer.from(value.subarray(0, accepted)));
          retainedBytes += accepted;
        }
        if (accepted !== value.length)
          abort("https-response-cap");
        if (elapsed() >= fetchMs - cleanupReserve || parentLeft() <= cleanupReserve)
          abort("https-deadline");
      });
      incoming.once("end", () => {
        responseEOF = !0;
        if (!incoming.complete || !incoming.readableEnded)
          fail("https-response-incomplete");
        cleanup();
      });
      ux.emit({ phase: "http-status", statusCode });
      if (cleanupStarted)
        destroy(incoming);
      if (statusCode !== 200)
        abort(`https-status-${statusCode ?? "missing"}`);
    };
    process.on("SIGINT", onInt);
    process.on("SIGTERM", onTerm);
    process.on("SIGHUP", onHup);
    let watchdog, hardDeadline;
    const unsubscribeFailure = ux.subscribe(abort);
    try {
      ux.check();
      need(Number.isFinite(fetchMs) && fetchMs > 0 && fetchMs <= limits.fetch && parentLeft() > cleanupReserve, "https-local-duration-required");
      hardDeadline = setTimeout(() => {
        fail("https-cleanup-deadline");
        cleanup();
        settled = !0;
        resolveDone();
      }, Math.max(0, fetchMs - Number(process.hrtime.bigint() - started) / 1e6));
      watchdog = setInterval(() => {
        const used = elapsed(), left = parentLeft();
        if (fault === "interrupt" && !interrupted)
          interrupt();
        ux.heartbeat(used, Math.min(fetchMs - used, left), statusCode, receivedBytes, cleanupStarted);
        if (used >= fetchMs - cleanupReserve || left <= cleanupReserve)
          abort("https-deadline");
      }, 5);
      requestCalls++;
      request = factory(requestOptions(oid), onResponse);
      factoryReturned = !0;
      request.on("error", () => {
        abort("https-request-error");
      });
      request.once("finish", () => {
        requestFinished = !0;
      });
      request.once("close", () => {
        requestClosed = !0;
        if (!responseEOF && failure === null)
          abort("https-request-premature-close");
        maybeDone();
      });
      request.on("socket", (owned) => {
        if (socket || settled) {
          fail("https-unexpected-socket");
          destroy(owned);
          cleanup();
          return;
        }
        socket = owned;
        owned.on("error", () => {
          abort("https-socket-error");
        });
        owned.once("close", (hadError) => {
          socketClosed = !0;
          if (hadError)
            fail("https-socket-close-error");
          maybeDone();
        });
        if (cleanupStarted)
          destroy(owned);
      });
      if (cleanupStarted)
        cleanup();
      else
        request.end();
      await done;
    } catch (error) {
      factoryReturned = !0;
      fail(error instanceof Error ? error.message : "https-request-construction-failed");
      aborted = !0;
      cleanup();
      if (!allClosed() && watchdog !== void 0)
        await done;
    } finally {
      unsubscribeFailure();
      if (watchdog !== void 0)
        clearInterval(watchdog);
      if (hardDeadline !== void 0)
        clearTimeout(hardDeadline);
      process.removeListener("SIGINT", onInt);
      process.removeListener("SIGTERM", onTerm);
      process.removeListener("SIGHUP", onHup);
      if (!allClosed()) {
        cleanup();
        if (!allClosed()) {
          cleanupFailed = !0;
          fail("https-owned-cleanup-unconfirmed");
        }
      }
      if (!suppliedVisibility)
        ux.release();
    }
    const body = Buffer.concat(chunks);
    if (fault === "cleanup") {
      cleanupFailed = !0;
      fail("https-synthetic-cleanup-failed");
    }
    if (elapsed() >= fetchMs || parentLeft() <= 0 || fault === "transport-finalization-deadline") {
      finalizationDeadlineExceeded = !0;
      fail("https-finalization-deadline");
    }
    const cleanupConfirmed = allClosed() && !cleanupFailed, finalResponse = response;
    if (failure === null && !(requestCalls === 1 && requestFinished && requestClosed && responseEOF && finalResponse?.complete && responseClosed && socketClosed && cleanupConfirmed && statusCode === 200))
      fail("https-lifecycle-incomplete");
    return { body, requestCalls, receivedBytes, retainedBytes, statusCode, failure, requestFinished, requestClosed, responseEOF, responseComplete: finalResponse?.complete === !0, responseClosed, socketClosed, cleanupConfirmed, aborted, interrupted, clockFailure, cleanupFailure: cleanupFailed, finalizationDeadlineExceeded, observedSignal };
  }
  function checkPins(pins) {
    pinCheck(pins);
    need(/^[a-f0-9]{40}$/.test(pins.commitOid) && pins.packetPath === "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-packet3.json", "fixed-published-packet-required");
    need(Array.isArray(pins.fileTable) && pins.fileTable.length > 0 && pins.fileTable.length <= limits.files, "fixed-published-file-table-required");
  }
  function syntheticContext(options) {
    need(options.scope === "OFFLINE_SYNTHETIC", "offline-synthetic-scope-required");
    const pattern = new RegExp(`^${"/home/gu1lty/Projects/proveo/chess-coach".replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}/_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery-verification-[1-9][0-9]{0,3}/fixtures/[a-z][a-z0-9-]{0,63}$`);
    need(pattern.test(options.fixtureRoot) && path.resolve(options.fixtureRoot) === options.fixtureRoot, "protected-fixture-root-required");
    ancestors(options.fixtureRoot);
    const expectedMarker = Buffer.from(`{"scope":"OFFLINE_SYNTHETIC"}
`), markerFd = fs.openSync(path.join(options.fixtureRoot, "OFFLINE_SYNTHETIC.json"), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      const marker = fs.fstatSync(markerFd);
      need(marker.isFile() && marker.nlink === 1 && marker.size === expectedMarker.length, "protected-fixture-marker-required");
      const buffer = Buffer.alloc(expectedMarker.length + 1), count = fs.readSync(markerFd, buffer, 0, buffer.length, null);
      need(count === expectedMarker.length && buffer.subarray(0, count).equals(expectedMarker), "protected-fixture-marker-required");
    } finally {
      fs.closeSync(markerFd);
    }
    need(typeof options.requestFactory === "function", "fixture-only-fake-https-required");
    need(options.fakeCaller === path.join(options.fixtureRoot, "owned-fake-caller.ts") && typeof options.loadModules === "function", "protected-owned-fake-caller-and-modules-required");
    return path.join(options.fixtureRoot, "host");
  }
  async function runSynthetic(pins, options) {
    return run(pins, options);
  }
  async function runProduction(pins) {
    checkPins(pins);
    need(process.versions.bun === "1.4.0", "bun-1.4.0-required");
    need(blockers.length === 0, `PRODUCTION_DELIVERY_BLOCKED:${blockers.join(",")}`);
    return run(pins);
  }
  async function run(pins, synthetic) {
    checkPins(pins);
    need(process.versions.bun === "1.4.0", "bun-1.4.0-required");
    need(process.execArgv.includes("--no-env-file") && process.execArgv.includes("--no-install"), "no-env-file-no-install-runtime-required");
    const host = synthetic ? syntheticContext(synthetic) : "/home/gu1lty/Projects/proveo/chess-coach", handoff = path.join(host, "_work/gpu-owner-recovery/runs/reference-package-handoff-3"), snapshot = path.join(handoff, "snapshot"), evidence = path.join(handoff, "evidence"), scope = synthetic ? synthetic.scope : "EXECUTOR_MANUAL_OPERATOR_ONLY", timer = clock(synthetic?.stageMs ?? limits.stageA, bootstrapEntryOrigin, synthetic?.fault);
    let claimed = !1, sealed = !1, fetched = !1, stageB = !1, failure = null;
    const ux = visibility(synthetic?.writer, Buffer.byteLength(fishPrelude), fishWitnessMaximumBytes, (reason) => {
      failure ??= reason;
    }, synthetic?.stderrEvents);
    let sourceWriteAttempts = 0, outcomePath = null, outcomeUnavailableReason = "NOT_CLAIMED", observedSignal = null, observedHup = !1, interrupted = !1;
    const onInt = () => {
      observedSignal = "SIGINT";
      interrupted = !0;
    }, onTerm = () => {
      observedSignal = "SIGTERM";
      interrupted = !0;
    }, onHup = () => {
      observedHup = !0;
      interrupted = !0;
    };
    process.on("SIGINT", onInt);
    process.on("SIGTERM", onTerm);
    process.on("SIGHUP", onHup);
    let fetchResult = null, callerResult = null;
    const parents = ["_work/gpu-owner-recovery/runs/host-canonical-r4-source-1", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2"], forbidden = ["_work/gpu-owner-recovery/cache/reference-package-inputs-2", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-inputs-2", "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/acquisition-execution-1"];
    try {
      ux.emit({ phase: "preflight", warning: "Ctrl-C after the exclusive handoff claim consumes the attempt. Preserve the claimed root and all partials. No automatic retry." });
      ux.check();
      timer.check();
      need(synthetic ? path.resolve(host) !== "/home/gu1lty/Projects/proveo/chess-coach" : process.cwd() === "/home/gu1lty/Projects/proveo/chess-coach", "fixed-execution-root-required");
      ancestors(path.join(host, "_work/gpu-owner-recovery/runs"));
      try {
        const cache = fs.lstatSync(path.join(host, "_work/gpu-owner-recovery/cache"));
        need(cache.isDirectory() && !cache.isSymbolicLink(), "fixed-cache-parent-invalid");
      } catch (error) {
        if (error.code !== "ENOENT")
          throw error;
      }
      for (const name of ["_work/gpu-owner-recovery/runs/reference-package-handoff-3", ...forbidden])
        absent(path.join(host, name));
      for (const relative of parents)
        try {
          const stat = fs.lstatSync(path.join(host, relative));
          need(stat.isDirectory() && !stat.isSymbolicLink(), "host-operation-parent-invalid");
        } catch (error) {
          if (error.code !== "ENOENT")
            throw error;
        }
      ux.check();
      timer.check();
      fs.mkdirSync(handoff, { mode: 448 });
      claimed = !0;
      durableDirectory(handoff);
      durableDirectory(path.dirname(handoff));
      ux.emit({ phase: "claimed", attemptsConsumed: 1 });
      record(path.join(handoff, "handoff-claim.json"), { scope, approvalSha256: "5e8edc68ad5936cc9d919a9adb7030536ecf0da854b263c170ebec08a06cc121", originalInnerIssuerSha256: "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f", launchBoundarySha256: BOUNDARY_SHA, transportAmendmentSha256: AMENDMENT_SHA, handoffAttemptsConsumed: 1, githubRequestSlots: 1, innerAttemptsConsumedByDelivery: 0 });
      freshDirectory(snapshot);
      freshDirectory(evidence);
      timer.check();
      fetched = !0;
      const factory = synthetic ? synthetic.requestFactory : (options, onResponse) => https.request(options, onResponse);
      ux.emit({ phase: "request-start" });
      ux.check();
      fetchResult = await fetchPacket(pins.gitBlobOid, timer.remaining, factory, Math.min(synthetic?.fetchMs ?? limits.fetch, timer.remaining()), synthetic?.fault, ux);
      if (failure === "visibility-write-failed" && fetchResult.failure !== null && fetchResult.failure !== "visibility-write-failed")
        failure = `github-https:${fetchResult.failure}`;
      need(fetchResult.failure === null && fetchResult.cleanupConfirmed && fetchResult.responseEOF, `github-https:${fetchResult.failure ?? "incomplete"}`);
      if (synthetic?.fault === "clock-after-fetch")
        timer.invalidate();
      timer.check();
      const packet = parseResponse(fetchResult.body, pins), verified = validatePacket(packet, pins, pins.fileTable, Boolean(synthetic));
      timer.check();
      ux.emit({ phase: "validated", files: verified.files.size });
      need(!interrupted, "delivery-interrupted");
      ux.emit({ phase: "materializing" });
      for (const directory of verified.directories) {
        if (directory === "" || directory === "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/acquisition-invocation-1")
          continue;
        freshDirectory(path.join(snapshot, directory));
        timer.check();
      }
      for (const [relative, bytes] of verified.files) {
        ux.check();
        timer.check();
        need(!interrupted, "delivery-interrupted");
        sourceWriteAttempts++;
        writeExclusive(path.join(snapshot, relative), bytes, 256, synthetic?.fault === "file-close" ? synthetic.fault : void 0);
      }
      timer.check();
      for (const directory of [...verified.directories].reverse()) {
        if (directory === "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/acquisition-invocation-1")
          continue;
        const absolute = path.join(snapshot, directory);
        durableDirectory(absolute, synthetic?.fault);
        timer.check();
      }
      need(synthetic?.fault !== "seal-deadline", "stage-a-seal-deadline");
      sealed = !0;
      ux.emit({ phase: "sealed", status: "VERIFIED_FSYNC_CANDIDATE_NOT_OS_DURABILITY_GUARANTEE" });
      const read = (name, cap) => {
        const expected = verified.files.get(name);
        need(expected && expected.length <= cap, "verified-table-reader-only");
        const absolute = path.join(snapshot, name);
        ancestors(path.dirname(absolute));
        const fd = fs.openSync(absolute, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
        try {
          const stat = fs.fstatSync(fd, { bigint: !0 });
          need(stat.isFile() && stat.nlink === 1n && stat.size === BigInt(expected.length) && stat.size <= BigInt(cap), "sealed-bounded-regular-member");
          const buffer = Buffer.alloc(expected.length + 1);
          let count = 0;
          while (count < buffer.length) {
            const got = fs.readSync(fd, buffer, count, buffer.length - count, null);
            if (!got)
              break;
            count += got;
          }
          const after = fs.fstatSync(fd, { bigint: !0 }), data = buffer.subarray(0, count);
          need(stat.ino === after.ino && stat.dev === after.dev && stat.size === after.size && stat.mtimeNs === after.mtimeNs && stat.ctimeNs === after.ctimeNs && data.equals(expected), "sealed-member-drift");
          return data;
        } finally {
          fs.closeSync(fd);
        }
      };
      for (const name of [...Object.keys(sourcePins), ...fixedInputs.map((row) => row[0])])
        read(name, limits.file);
      if (synthetic?.fault === "import")
        throw Error("verified-module-import-failed");
      const modules = synthetic ? await synthetic.loadModules(read) : { source: await import(path.join(snapshot, "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3", "capture.ts")), caller: await import(path.join(snapshot, "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/invoke-approved-bun.ts")) }, source = modules.source.sourceIdentity(read);
      need(hash(Buffer.from(JSON.stringify(source))) === "a66a0e3f40e9ab30bfe6a16b603649c2007b91460da6747d5e86b7b47892f8c8", "postseal-source-identity");
      modules.source.validateSourceProof(CAPTURE_PROOF, "capture", source, read);
      modules.source.validateSourceProof(CALLER_PROOF, "caller", source, read);
      const runtime = modules.source.validateEligibility(read);
      modules.source.validateReady3(runtime, read);
      modules.caller.validateInvocationReady(runtime, read);
      timer.check();
      for (const relative of parents) {
        timer.check();
        const absolute = path.join(host, relative);
        try {
          const stat = fs.lstatSync(absolute);
          need(stat.isDirectory() && !stat.isSymbolicLink(), "host-operation-parent-invalid");
        } catch (error) {
          if (error.code !== "ENOENT")
            throw error;
          freshDirectory(absolute);
        }
      }
      timer.finalizing();
      timer.check();
      record(path.join(evidence, "transfer-receipt.json"), { status: "SEALED_STAGE_A_CANDIDATE_NOT_DELIVERY_SUCCESS", scope, packet: identity(packet), files: verified.files.size, aggregateSourceBytes: verified.aggregateBytes, snapshotDirectoriesIncludingObserver: verified.directories.length, approvalSha256: "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f", launchBoundarySha256: BOUNDARY_SHA, transportAmendmentSha256: AMENDMENT_SHA, httpsRequestCalls: fetchResult.requestCalls, httpsStatusCode: fetchResult.statusCode, httpsResponseBytes: fetchResult.receivedBytes, httpsRetainedBytes: fetchResult.retainedBytes, httpsResponseEOF: !0, httpsOwnedCleanupConfirmed: !0, innerAttemptsConsumedByDelivery: 0 }, synthetic?.fault === "receipt-close" ? synthetic.fault : void 0);
      durableDirectory(evidence);
      timer.check();
      ux.emit({ phase: "inner-caller-launch", clockScope: "OUTER_PROCESS_LOCAL_INFORMATIONAL", remainingMs: null });
      ux.check();
      need(!interrupted, "delivery-interrupted");
      stageB = !0;
      callerResult = await runChild({ executable: process.execPath, args: ["--no-env-file", "--no-install", synthetic ? synthetic.fakeCaller : path.join(snapshot, "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/invoke-approved-bun.ts"), "execute"], cwd: snapshot, env: { LANG: "C", LC_ALL: "C", TZ: "UTC" }, stdoutCap: 65536, stderrCap: 65536, remainingMs: () => Number.MAX_SAFE_INTEGER, workMs: Number.MAX_SAFE_INTEGER, cleanupMs: 2000, deadlineOwner: "INNER_CALLER", subscribeFailure: ux.subscribe, ...synthetic?.fault === "child-cleanup" ? { syntheticFault: "cleanup" } : {} });
      if (failure === "visibility-write-failed" && callerResult.failure !== null && callerResult.failure !== "visibility-write-failed")
        failure = `caller-child:${callerResult.failure}`;
      need(callerResult.failure === null, `caller-child:${callerResult.failure}`);
      need(!interrupted, "delivery-interrupted");
    } catch (error) {
      failure ??= error instanceof Error ? error.message : "delivery-failed";
    }
    if (ux.facts().writeFailure)
      failure ??= "visibility-write-failed";
    if (claimed)
      try {
        record(path.join(handoff, "delivery-outcome.json"), { status: failure === null ? "FINAL_CANDIDATE_REQUIRES_EXTERNAL_EXIT0" : "FAIL_PRESERVE_PARTIALS", provisionalAtTimeOfRecord: !0, scope, failure, claimed, fetched, sealed, stageB, sourceWriteAttempts, observedSignal, observedHup, innerAttemptsConsumedByDelivery: 0, sourceRequest: fetchResult && { ...fetchResult, body: identity(fetchResult.body) }, callerChild: callerResult && { ...callerResult, stdout: identity(callerResult.stdout), stderr: identity(callerResult.stderr) } }, synthetic?.fault === "receipt-close" ? "receipt-close" : void 0);
        ({ outcomePath, outcomeUnavailableReason } = discloseOutcome(path.join(handoff, "delivery-outcome.json"), ownedCleanupConfirmed(fetched, fetchResult, stageB, callerResult)));
        if (!stageB)
          timer.check();
      } catch {
        failure ??= "durable-outcome-failed";
        if (outcomePath === null && outcomeUnavailableReason !== "UNCONFIRMED_OWNED_CLEANUP")
          outcomeUnavailableReason = "PERSISTENCE_OR_CLOSE_UNCONFIRMED";
      }
    if (ux.facts().writeFailure)
      failure ??= "visibility-write-failed";
    ux.emit({ phase: "terminal", status: failure === null ? "FINAL_CANDIDATE_NOT_OWN_EXIT_OR_DURABILITY" : "FAIL_PRESERVE_PARTIALS", failureCode: failure === null ? null : "DELIVERY_FAILED", observedSignal, observedHup, outcomePath, outcomeUnavailableReason }, !0);
    if (ux.facts().writeFailure)
      failure ??= "visibility-write-failed";
    ux.release();
    process.removeListener("SIGINT", onInt);
    process.removeListener("SIGTERM", onTerm);
    process.removeListener("SIGHUP", onHup);
    return { failure, claimed, fetched, sealed, stageB, handoff, snapshot, evidence, fetchResult, callerResult, sourceWriteAttempts, outcomePath, outcomeUnavailableReason, observedSignal, observedHup, visibility: ux.facts() };
  }
  function ownedCleanupConfirmed(fetchStarted, transport, childStarted, child) {
    return (!fetchStarted || transport?.cleanupConfirmed === !0) && (!childStarted || child?.cleanupConfirmed === !0 || child?.noChildCreated === !0 && !child.pipeCleanupFailed && child.pipeDestruction.stdout.present === !1 && child.pipeDestruction.stderr.present === !1);
  }
  function discloseOutcome(persistedClosedPath, cleanupConfirmed) {
    return cleanupConfirmed ? { outcomePath: persistedClosedPath, outcomeUnavailableReason: null } : { outcomePath: null, outcomeUnavailableReason: "UNCONFIRMED_OWNED_CLEANUP" };
  }
  return { constants: { D: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1", R2: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2", P3: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3", S3: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3", HOSTROOT: "/home/gu1lty/Projects/proveo/chess-coach", HREL: "_work/gpu-owner-recovery/runs/reference-package-handoff-3", CALLER: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/invoke-approved-bun.ts", OBSERVER: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/acquisition-invocation-1", PACKET_PATH: "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-packet3.json", APPROVAL_SHA: "4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f", A3_SHA: "5e8edc68ad5936cc9d919a9adb7030536ecf0da854b263c170ebec08a06cc121", SOURCE_ID: "a66a0e3f40e9ab30bfe6a16b603649c2007b91460da6747d5e86b7b47892f8c8", CAPTURE_PROOF, CALLER_PROOF, SOURCE_REVIEW, sourcePins, authorityPins, future, publicationWorkflow, deliveryNames, FISH, EXPECTED_DELIVERY_TESTS, fishPrelude, fishWitnessMaximumBytes, BOUNDARY_PATH, BOUNDARY_SHA, AMENDMENT_PATH, AMENDMENT_SHA, fixedInputs, bindings, limits, blockers }, need: (value, reason) => need(value, reason), hash, blob, identity, same, keys, safePath: (value) => safePath(value), text, decode, directories, validatePacket, parseResponse, verifyApproval, validateRelease, validateDeliveryProof, validateGenerationShape, parseSummary, qualificationCommands, assessDeliveryVerification, visibility, ownedCleanupConfirmed, discloseOutcome, ancestors, absent, writeExclusive, freshDirectory, durableDirectory, record, clock, createPipeCleanup, runChild, fetchPacket, requestOptions, checkPins, runSynthetic, runProduction };
})().then(api=>api.runProduction({"bytes":1706461,"sha256":"d8eaf0522fb00d81839be9a2c0ec80d67bcece498e2bf587edbf4c117b737f06","gitBlobOid":"d3fc4bba5cab9201dde25b59390691d5e9ab59a2","commitOid":"b14202b876e3cef4de898f8269b52dbfcadb3d02","packetPath":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-packet3.json","fileTable":[{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/request.json","bytes":3065,"sha256":"c0288e1e34e24d2f7a81e12ee1967ffafbd2768b4c2a5bc2ba15826b6384ff3f","gitBlobOid":"b5d7bb30d66565b36013a25d87362381c20a7a56"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/plan.json","bytes":10354,"sha256":"7f6a90ca105d6a7c5a45951b508d4a1ecdd5e217625d1cefe08da23557847405","gitBlobOid":"208481afb833947e0c6ee319cf4702af257c53d2"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/approval2.json","bytes":5671,"sha256":"4e68d36f8076e213744364cf4cd5f793ef3dbffda6157b93070edf2ffc282d3f","gitBlobOid":"37d15a0bf824a0030f58cf98433de55f059b8a1e"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-handoff-request1.json","bytes":5433,"sha256":"47d63b8cb446cdc8a83323788c9106cdb82437992e7bd3a88f55821aa6bde52b","gitBlobOid":"09f61cb0667c38ac90b7a73257049f8812b6ee0d"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-handoff-plan1.json","bytes":14449,"sha256":"4297e4f1b763b5aa152b88a7a3e288a19cafc85331cbed2d776f38d043f8817a","gitBlobOid":"e44605f27e3b975f4dbec9bfbd4db1575f02f7d0"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-1/plan.json","bytes":3716,"sha256":"8ecfce5156322da42fb852cd071a6091b96187e19a88226bec68295936505f6c","gitBlobOid":"e9f5fd7698d8cd3f2a5dc51df0eed976ea47d58a"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/local-inputs-1/check.json","bytes":3274,"sha256":"acca1e84beb0ebfacf3fb0a7967ffe5d16552861b0da98a4f7e6b4367cee9c63","gitBlobOid":"ac60f986a3c4bae4884b6ee99b9a2367f4b93fa1"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/local-inputs-1/inputs/reference/pnpm-lock.yaml","bytes":313664,"sha256":"1d05ed3d8de5a94873f26a2fb51b88c080704d2e90bf942f9f0bb2ce75a504e0","gitBlobOid":"5a5aeb96b68fd8832e545da159aa622e4a08c5d1"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/request.json","bytes":5252,"sha256":"869d9d97cededc33e51f13cdfdd24de46b971b85d468fe7b5da5ff8621810bf2","gitBlobOid":"10d258319705e3f0ec525e2084c0ffd20de5d603"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/plan.json","bytes":22893,"sha256":"5904802495bf21feeb38b3a049baafd0d704a6c0ad86f371de8c51911d582d9e","gitBlobOid":"ce8b9b42b06d126990f7a53a6d69fde46e10409c"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/authority-delta-draft1.json","bytes":9302,"sha256":"3a4bdcd383b762b4c5220dd2588fe8b9474cc0e6485ab9574ed5149bc8fc06ec","gitBlobOid":"68869830d59c83b15781b44e41da92c0b43801fb"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/visibility-contract1.json","bytes":4352,"sha256":"b9df7a4668aad028fd1d3afcf0969c5d6af5f790aa7e64491dd278d88a6a88b6","gitBlobOid":"97b3ccaa72a5b8e667a422a66bec1aa4c89d0e4b"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-handoff-report-1/operator-report.json","bytes":1767,"sha256":"3912ba6a3bbc036317d03dc83ac950f342b229fe873f1bd588614423501ddd1d","gitBlobOid":"54c93e1ee202f0379c3003ddd2c8dd2a78f6592e"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-handoff-report-1/consumption.json","bytes":1574,"sha256":"0cf60b233ad5af53402bc4cff3f68645611f75694fc08c6fc32745814a45c030","gitBlobOid":"b1500b88bfa41f96eeffd616267883ee1acc35dd"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-handoff-report-1/interruption-clarification.json","bytes":1337,"sha256":"8a877da0e36aae13bae300332cca105e2733509a2a005cfbb7a9ee3330feba01","gitBlobOid":"3c5fd9b946d07e66a0ff6a2e48551aea46550406"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/approval3.json","bytes":9693,"sha256":"5e8edc68ad5936cc9d919a9adb7030536ecf0da854b263c170ebec08a06cc121","gitBlobOid":"9f1ff20b38e7c838ba559d8de1a4301ca9e379ed"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/authority-selection2.json","bytes":1725,"sha256":"83fe718207581fdb5f07cc8cd692847387f8d474aeef0074f84cea84eb2299df","gitBlobOid":"c21d611dcc63c3bd474749d9a132567d21a47c2b"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/capture.ts","bytes":84121,"sha256":"570d3be7da0428521260c4f15733e93495eb09a6d12bb077634106d1359b92d9","gitBlobOid":"0c0871df9f8659ba860219d34d5e7b8c7ab92c18"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/capture.test.ts","bytes":103493,"sha256":"a639ba1103e9dd041ed02055785ff6f8a8c7a8ce7b81380ffb68d563014be021","gitBlobOid":"e761cf48ff3fe3745b4098664585cb09e437d91e"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/capture-full.test.ts","bytes":29084,"sha256":"6db8469b171f6227d5ac7507ec3884b81ccd82b0848178a48a1e64d9048edec3","gitBlobOid":"52d929410d10694ef586bd9556fa62f8ba84c4ea"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/root-context.ts","bytes":2464,"sha256":"3f2715121d77141749915a7e9a4dc6d445b5e4630056f581de27f96364f176df","gitBlobOid":"1c3383d052d4891e881eee6277a5dc3bad1fef9d"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/root-context.test.ts","bytes":2103,"sha256":"f3e36a58bc864bafcade7a2b210cb6372e0843347acbc5a86636005708a60252","gitBlobOid":"dd2c97032496234d3a0b878768e64b84906f9588"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/cache-parent.ts","bytes":4052,"sha256":"62db5298937cf1c752a76b39f42fa19876e36e637d9d21dba6de323de347b27c","gitBlobOid":"3608c74f46e1b406b5e8a82df3b1e15fefc26f12"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/cache-parent.test.ts","bytes":53554,"sha256":"83d8e91683140c35de498a9457060f47ec00b94ef59c9d83e47593456c24205f","gitBlobOid":"f5479ed43ecc8044c7a3452e6afbb1edf41517c0"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/cache-parent-adapter.ts","bytes":5786,"sha256":"b443bd99c1961dc493fb7e33835391fec8373af73cd9aa1eafb66790261c0623","gitBlobOid":"46e20c29d7d8afdc0ddee130a06cade7360e6299"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/cache-parent-adapter.test.ts","bytes":5557,"sha256":"32391b054f47e22ae5936aa22e4a25ce07c853de6e1f27c4b5dc9e3c1a4abfe9","gitBlobOid":"80fd35c5ddc896f6062a1899eb56d7d50ebd094d"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/verify.ts","bytes":27019,"sha256":"1c391e3eb2e01f7dc5641df5bb43a57c2eab0ab13c523a432a67c487b1f65f72","gitBlobOid":"aaaa3b17ebe310f193d5e22cc21ab6723d1722eb"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/tsconfig.json","bytes":770,"sha256":"0083541937af45cc505e9bde2afc99ece5af54fe1855060d20c498bc01488391","gitBlobOid":"8164ae3f16af5d02ddf81fe5d51ab21c8a178c65"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/.gitignore","bytes":163,"sha256":"91317cffd2ef9526d9d0ba70fcefa8499556f916a21327cb5492407dd679db0d","gitBlobOid":"ad8f5186f6079bce278d4a4a0b3b78032da89c49"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/invoke-approved-bun.ts","bytes":11790,"sha256":"a199bc84f9da248414fb7ea34b760e6d326fa888afff104cc35ed3e0c95d20ef","gitBlobOid":"250a0093837ce46433efdf384493d7c772c8bb9a"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/invoke-approved-bun.test.ts","bytes":48424,"sha256":"6f2ea8af56d7bc6761d1a9f2fc000f634803a5fe6867c503124b56d9f48970f5","gitBlobOid":"686a66693ab46e699f28f8c2943b31c97d03ddb1"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/invoke-approved-bun-verify.ts","bytes":2498,"sha256":"eb1e869c2a1225eadb0cbae82cb148da6fc4fc9302dc43da9e4f8ccdba4ce1c4","gitBlobOid":"2de272a96aacd0d45aa4dd843947e35ee9c0b90a"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/invoke-approved-bun.tsconfig.json","bytes":645,"sha256":"475349522320904b0f41ec6fa19b785ddccfe51f97bc5b36c0c123bcf9eee56a","gitBlobOid":"31be4a7c97408bfbe9a2cf75c851162ee588c99b"},{"path":"_work/gpu-owner-recovery/verify.ts","bytes":12723,"sha256":"9831b75035a5d832c6d86608b7d561821ee1a4c6dec8d2a7ecd31fbca55d5f58","gitBlobOid":"108936008e2e2fe62e046227f21f47de263986b9"},{"path":"_work/gpu-owner-recovery/command-supervisor.ts","bytes":910,"sha256":"88e56077c3bcddf722f81081a0cb7c6f94d1da106add486dbf13a92d165fb9c6","gitBlobOid":"e436672b6d5775e16f34f65408b397a2312fe231"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-launch-boundary-selection1.json","bytes":2525,"sha256":"44aa077f7db10d3bc3a462da355198973a6f2afba29b7745d4c2bba53f94cdc5","gitBlobOid":"ae6ceb2d09312556ecbe3423751e10d16f486055"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-2/manual-source-transport-amendment1.json","bytes":3813,"sha256":"f53b4985052f242a453d24e1bcccde47d1589288952543ea0a5b7d5756291918","gitBlobOid":"310097e5f0e86f242abe9ffe9c5d2e5af76c45a5"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/fullverification-6/proof.json","bytes":22651,"sha256":"8d1ef28d5e90cfb921ad5af31dbbf6fbeb00909ad669de8bd9724c64221415e5","gitBlobOid":"84284c7171bbdc5007f67ec9a17b4075f172dfe3"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/fullverification-6/source-manifest.json","bytes":19808,"sha256":"bcf18a5945af37aa22e501cf82953f5c6b5b00a6cd9e267a87ff540af0e62925","gitBlobOid":"2c0e8a1d4251254cb2e7c448afb30d905e1012f1"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/invocation-verification-4/proof.json","bytes":22164,"sha256":"a6a839b7b53ebfe9958e6ad5a063bfd161abe615a29418b18916860675989fcd","gitBlobOid":"9c85dfbc583cff3f0c6ef0a65dc66ac6260dcf3e"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/invocation-verification-4/source-manifest.json","bytes":20038,"sha256":"eda6c4024082223ba216ae4ff2a64300fa8929ed458a6c5cf6be9efd047a4a2b","gitBlobOid":"6ad6613c1b9d2e3e16ea726d80777ca9390fd3ec"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-result-3.json","bytes":6544,"sha256":"c9bd7ed9a5aa1623be547c71eb7093301827a810db3f6e830eebf52326ba12ee","gitBlobOid":"d3450aac51ccbb9e3d03b99586aecba1c8b73a09"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-3/capture/backend.json","bytes":10213,"sha256":"cba70986c9eda63096e2287d108ae38255b0fbca23ea4145c9572cb7f13b172c","gitBlobOid":"65d1b503c4fcc158beb6f3fd8d4bcbc9087664e5"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-3/capture/devops.json","bytes":10212,"sha256":"325858b766cd3602a8f34d2f3d5ba923245e2f71684afafc7fc6d65bf8ca17a5","gitBlobOid":"256ed41e5ade5b3d91914df5b2020a294c43f709"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-3/capture/adversarial.json","bytes":10171,"sha256":"d0bdc62ad73d8d4087c59173dee736801a5dffb61feb462815550d9f2688216c","gitBlobOid":"a50995e1c492761587561f8f2d8cfb0f72547e15"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-3/capture/security.json","bytes":10282,"sha256":"7aee602f0274abf2433c95d50e097774195eb122db1f6e274f148d6ae9332a0c","gitBlobOid":"cc718aad7f289322fd87633422f13ca8eb1d2d9e"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-3/caller/backend.json","bytes":7483,"sha256":"628a5d2d654af7622211434a2d1e6c10ed744e20279392cff37296170ed9f429","gitBlobOid":"14677502e29fec3a0721a5ff20012ee50b9aad61"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-3/caller/devops.json","bytes":7586,"sha256":"bf63938f0d4e72d334ead111f70eb3a63f0240dcb1cea9e8be38d0f4de153b03","gitBlobOid":"1cbb6df31adadba6251d02d6df522cbbb02d1602"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-3/caller/adversarial.json","bytes":7749,"sha256":"370d4b7d3f0673b714b4314a056e7ca7bccdc069da5b886a76400c7356bb4290","gitBlobOid":"7efc2b7402b1351abc59a33cae7e6057524e8b21"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-3/caller/security.json","bytes":7485,"sha256":"1a4abc81f397fe4a38df6f3ec2c8d128d18fe98bfa239f7185a8ca9e347669f1","gitBlobOid":"02284084a8c4e20e43b07785e2e3c2aef631f6b5"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-6/delivery/backend.json","bytes":8406,"sha256":"8d4a3363b93bc11ab137d6cc1dac82666acb36543eec0ec0c15bfed6512e5c18","gitBlobOid":"1881bca86aa17d1b8e40ccd677963efe482be39a"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-6/delivery/devops.json","bytes":8494,"sha256":"f13cfcaa2a11dc59492e5b6a3afdc82780539222b5560a2e7c7c51c4c910a373","gitBlobOid":"468fca04600c63c465feaebdbc480ed147a1830d"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-6/delivery/adversarial.json","bytes":8427,"sha256":"ee9e0f97aeede436b974324d78523a7d68239b49e566e40c036443a003184906","gitBlobOid":"ee353222d56b752f8d03ff1e05b12c54eb435830"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/source-review-6/delivery/security.json","bytes":8445,"sha256":"3a479fdf7574d319a2e87c6a6083a9a63d58bcf16e78cfc58da58358a1137384","gitBlobOid":"85c8a240a56e2724fa930409242db84cf17da249"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery-bootstrap.ts","bytes":83982,"sha256":"1e615287c481946283015a362f8ea4c4ce3dffaa86c26f6ddf73808fe346928a","gitBlobOid":"6f477a69cfcb29dda1222e8081367c4aef269341"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery-contract3.json","bytes":7541,"sha256":"1e235f93028fd40425b31c7bf7245152570f22732f260ffd11e3e606390ed120","gitBlobOid":"8d6982c78696ba4b6dbc935d5b3ad7927a511b67"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery-packet.ts","bytes":3381,"sha256":"4b3232f701c2681a340c1d72f448a873a9c8f0803169f65757dfedf0f4b1297c","gitBlobOid":"5cf2332618caa996bc64f6e09265d2ffecd45e87"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery-render.ts","bytes":22190,"sha256":"e753bd42330a2aa1159210d3a0f541f6196483e4bebc31995159c65bfee4ca3b","gitBlobOid":"f3d920cd8b1ec62c8157ecd8b3a47ee9448696d2"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery-verify.ts","bytes":18109,"sha256":"ea36b6bc262e75edfc6d3096478c8f9a6377dad0d6b68d08bddd162a818b3f1f","gitBlobOid":"6f6d5f8680273f8e7d07c161d2d47c9c06975ad1"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery.test.ts","bytes":64331,"sha256":"6a06915bdc0d3ccb4a604e1d4ae28d8e2b2fdb39eacc5685016d0fc0044fa8b1","gitBlobOid":"3b3a2dc7e1d9f2730774edf75a7b8630b77712dc"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery.tsconfig.json","bytes":580,"sha256":"e661d19127ec2cd1d202eb94412d733aa92d4ae15e308711be44648f593fceaa","gitBlobOid":"dcd517b97787308f82f0251993bd4e81bf13338c"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery-verification-10/proof.json","bytes":10748,"sha256":"e96e8a135138228359b680ff47305d62ee74bf47836356d9c545abe6fc4d20ca","gitBlobOid":"075040d9bea5419bbb3396ab95a06d870214d802"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery-verification-10/source-manifest.json","bytes":7625,"sha256":"9e89fc1801b0731b2bc7432371bcd112fd4240764eb9041d75fb834b8f55b5e4","gitBlobOid":"73346d444f6474efa8a2611530a3635b44f0028a"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source3/execution-binding3.json","bytes":16531,"sha256":"f5a2dd1946213fbe42760db14011ccc6afab5909e659016d47b72f369a3a266c","gitBlobOid":"a977988ab7c40d3e3846c08989ba529f1a089a96"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/invocation-ready3.json","bytes":4552,"sha256":"499cd2f22c554dd7349498cc4bdc101650489500c723822ad375457260699246","gitBlobOid":"34c362fb61e8eeae1d18060bcb85e780ebba3868"},{"path":"_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3/delivery-release3.json","bytes":7948,"sha256":"e2554d0be844be62348c7f26c168f26da63da287697aaa17a131fc76087d6645","gitBlobOid":"2dcb96000babd9845a5961c86162401c932661b5"}]})).then(result=>{if(result.failure!==null)process.exitCode=1;}).catch(function fallbackTerminal() {
  process.exitCode = 1;
  const sink = process.stderr, detach = () => {
    sink.removeListener("error", failed);
    sink.removeListener("close", detach);
  }, failed = () => {
    process.exitCode = 1;
    detach();
  };
  sink.on("error", failed);
  sink.on("close", detach);
  try {
    sink.write(JSON.stringify({ phase: "terminal", status: "FAIL_PRESERVE_PARTIALS", failureCode: "BOOTSTRAP_IMPORT_OR_ENTRY_FAILED", observedSignal: null, outcomePath: null, outcomeUnavailableReason: "UNPERSISTED_OR_UNKNOWN" }) + `
`, (error) => {
      if (!error)
        detach();
      else
        process.exitCode = 1;
    });
  } catch {
    failed();
  }
})'
  set -l launcher_status $status
  printf 'launcher_exit_status=%d\n' $launcher_status >&2
  exit $launcher_status
end

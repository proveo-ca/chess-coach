# SPEC: _spec/runtime-protocol.puml
import hashlib
import copy
import json
import pathlib
import re
import stat
import subprocess
import sys
import traceback


ROOT = pathlib.Path("/home/gu1lty/Projects/proveo/chess-coach")
P = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/"
C = "_work/gpu-owner-recovery/runs/host-cpu-regression-delivery-source-1/"
CPU = C + "cpu39-pass-report-1/"
GPU = "_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/full2-pass-report-1/"
LOCAL = P + "offline-reference-proposal-1/"
APP_INPUTS = LOCAL + "local-inputs-1/"
CORPUS_INPUTS = LOCAL + "corpus-inputs-1/"
ACQUISITION = LOCAL + "package-acquisition-proposal-1/"
DOCS = [
    "_spec/.spec-index.json",
    "_spec/runtime-protocol.puml",
    "_spec/gpu-qualification.puml",
    "_spec/gpu-full-qualification.puml",
    "_spec/gpu-readiness.md",
    "_spec/gate-closure.md",
    "_spec/readiness.md",
]
PRIMARY = [
    P + name
    for name in [
        "plan.json",
        "canonical.ts",
        "canonical.test.ts",
        "r4.test.ts",
        "verify.ts",
        "tsconfig.json",
    ]
]


def path(value):
    result = pathlib.Path(value)
    local = result.relative_to(ROOT) if result.is_absolute() else result
    assert not local.is_absolute() and ".." not in local.parts
    assert not {"cache", ".bun"}.intersection(local.parts)
    assert local.suffix not in [".crate", ".tar", ".gz", ".xz", ".zip", ".zst", ".bpk"]
    return ROOT / local


def load(value):
    return json.loads(path(value).read_bytes())


def binding(value):
    data = path(value).read_bytes()
    return {
        "path": str(path(value).relative_to(ROOT)),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def verify_rows(rows):
    for row in rows:
        actual = binding(row["path"])
        assert actual["sha256"] == row["sha256"], row["path"]
        if "bytes" in row:
            assert actual["bytes"] == row["bytes"], row["path"]


def verify_local_proof(root, label, status, stages):
    proof = load(root + label + "/receipt.json")
    assert proof["status"] == status and proof["failure"] is None
    assert proof["sourceChanged"] is False and len(proof["results"]) == stages
    verify_rows(proof["sources"])
    verify_rows(proof.get("evidence", []))
    for row in proof["sources"]:
        if row.get("snapshot"):
            assert binding(row["snapshot"])["sha256"] == row["sha256"]
    for result in proof["results"]:
        assert (
            result["status"] == "PASS"
            and result["exitCode"] == 0
            and result["failure"] is None
        )
        verify_rows(result["streams"])
    return proof


def verify_input_tree(root, manifest, materialization):
    base = path(root + "inputs/reference")
    expected = {row["path"]: row for row in materialization["files"]}
    assert len(expected) == len(materialization["files"]) == len(manifest["entries"])
    assert set(expected) == {row["path"] for row in manifest["entries"]}
    directories = {
        "/".join(name.split("/")[:index])
        for name in expected
        for index in range(1, len(name.split("/")))
    }
    found = set()
    assert base.is_dir() and not base.is_symlink()
    for candidate in base.rglob("*"):
        assert not candidate.is_symlink()
        name = candidate.relative_to(base).as_posix()
        if candidate.is_dir():
            assert name in directories
        else:
            assert name in expected and stat.S_ISREG(candidate.lstat().st_mode)
            row = expected[name]
            assert candidate.stat().st_size == row["bytes"] <= 16777216
            data = candidate.read_bytes()
            assert (
                len(data) == row["bytes"]
                and hashlib.sha256(data).hexdigest() == row["sha256"]
            )
            assert (
                hashlib.sha1(
                    b"blob " + str(len(data)).encode() + b"\0" + data
                ).hexdigest()
                == row["gitBlobOid"]
            )
            found.add(name)
    assert found == set(expected)
    for entry in manifest["entries"]:
        row = expected[entry["path"]]
        assert entry["gitBlobOid"] == row["gitBlobOid"]
        assert entry.get("expectedBytes", entry.get("bytes")) == row["bytes"]
    return len(found), sum(row["bytes"] for row in expected.values())


def review_contract(root, review):
    expected = {
        APP_INPUTS: {
            "adversarial": "READY_YES",
            "security": "READY_BOUNDED_LOCAL_MATERIALIZATION_ONLY_YES",
            "devops": "READY_PARTIAL_LOCAL_INPUT_ASSET_PACKET_ONLY_YES",
        },
        CORPUS_INPUTS: {
            "adversarial": "READY_YES",
            "security": "READY_CURRENT_CORPUS_AND_UNAPPROVED_REQUEST_ONLY_YES",
            "devops": "READY_SIDECAR_PACKET_ONLY_YES",
        },
        ACQUISITION: {
            "adversarial": "READY_YES",
            "security": "READY_UNAPPROVED_REQUEST_SCOPE_ONLY_YES",
            "devops": "READY_PROPOSAL_RECORD_CONSISTENCY_ONLY_YES",
        },
    }[root]
    for role, verdict in expected.items():
        assert (
            review[role]["verdict"] == verdict
            and review[role]["remainingFindings"] == []
        )


def review_ready(root):
    review_contract(root, load(root + "review-1.json"))


def git(*args):
    return subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, timeout=30, check=True
    ).stdout


def test_summary(text):
    assert re.findall(r"^\s*(\d+) pass\s*$", text, re.MULTILINE) == ["46"]
    assert re.findall(r"^\s*(\d+) fail\s*$", text, re.MULTILINE) == ["0"]
    assert re.findall(r"^\s*(\d+) expect\(\) calls\s*$", text, re.MULTILINE) == ["367"]


def publication_budget(value):
    for key in [
        "remainingNormalCommits",
        "remainingHttpsPushes",
        "remainingExactTextRedeliveries",
    ]:
        assert value[key] == 0
    for key in [
        "normalCommitsConsumed",
        "httpsPushesConsumed",
        "exactTextRedeliveryAttemptsConsumed",
    ]:
        assert value[key] == 1
    assert value["commitExitCode"] == value["pushExitCode"] == 0
    assert value["hostAttemptOrRetryRenewed"] is False


def branch_contract(value):
    assert value == "feat-ml-adjuntant-ii"


def doc_projection(text):
    lines = [
        line
        for line in text.splitlines()
        if ("current source proof:" in line and "verification-4/receipt.json" in line)
        or "next owner:" in line
        or "current consumption/next:" in line
        or P + "verification-4/receipt.json" in line
    ]
    assert lines
    for line in lines:
        assert re.search(r"\b(?:PASS)?46 tests\s*367 assertions\b", line)
        assert re.search(r"\b(?:All)?92 (?:unchanged|before/after)|\bTSC/92\b", line)
    review_lines = [
        line
        for line in text.splitlines()
        if P + "review-2.json" in line
        or "current source reviews:" in line
        or ("current source proof:" in line and "verification-4/receipt.json" in line)
        or "next owner:" in line
        or "current consumption/next:" in line
    ]
    assert any(
        re.search(
            r"(?:[Rr]eview2|review-2\.json)(?:(?![Rr]eview[ -]?[12]\b|review-[12]\.json)[^\n]){0,256}?READY_SOURCE_ONLY(?:_[A-Z0-9_]+)?\b",
            line,
        )
        for line in review_lines
    )


def change_scope(unstaged, staged):
    assert set(unstaged).union(staged) == set(DOCS)


def stale_canonical_reviews(text):
    result = []
    for line in text.splitlines():
        if (
            P in line
            or "current source proof:" in line
            or "current source reviews:" in line
            or "next owner:" in line
            or "current consumption/next:" in line
        ):
            line = (
                line.replace("review2", "review1")
                .replace("Review2", "Review1")
                .replace("review-2.json", "review-1.json")
            )
        result.append(line)
    return "\n".join(result)


assert pathlib.Path.cwd() == ROOT and len(sys.argv) == 2
assert re.fullmatch(r"packet-audit-[1-9][0-9]?", sys.argv[1])
directory = path(P + sys.argv[1])
directory.mkdir()
checks = {}
inputs = (
    DOCS
    + PRIMARY
    + [
        P + "packet-audit.py",
        P + "review-1.json",
        P + "review-2.json",
        CPU + "review.json",
        CPU + "observation.json",
        CPU + "reported-receipt.json",
        CPU + "operator-summary.txt",
        P + "reference-delivery-decision.json",
        APP_INPUTS + "review-1.json",
        CORPUS_INPUTS + "review-1.json",
        ACQUISITION + "request.json",
        ACQUISITION + "plan.json",
        ACQUISITION + "review-1.json",
        C + "publication-redelivery-execution-1/publication-and-redelivery-result.json",
    ]
)
before = []
failure = None
try:
    before = [binding(value) for value in inputs]
    manifests = [
        load("_work/gpu-owner-recovery/runs/host-gpu-full-source-4/sources.json"),
        load(
            "_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/receipt.json"
        )["sources"],
        load(
            "_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/native-source-manifest.json"
        ),
    ]
    assert [len(rows) for rows in manifests] == [347, 327, 65]
    for rows in manifests:
        verify_rows(rows)
    checks["frozenSourceBindings"] = [347, 327, 65]
    native = binding(
        "_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/native-source-manifest.json"
    )
    assert (
        native["sha256"]
        == "7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec"
    )
    for root, status, stage_count in [
        (CPU, "PASS_OPERATOR_REPORTED_CPU39_RECORDS_SOURCE_TESTS_AND_TYPES_ONLY", 3),
        (GPU, "PASS_OPERATOR_REPORTED_FULL_SIX_RECORDS_SOURCE_TESTS_AND_TYPES_ONLY", 3),
    ]:
        label = "verification-1/" if root == CPU else "verification-3/"
        proof = load(root + label + "receipt.json")
        assert proof["status"] == status and proof["sourceChanged"] is False
        verify_rows(proof["sources"])
        assert len(proof["results"]) == stage_count
        for result in proof["results"]:
            assert (
                result["status"] == "PASS"
                and result["exitCode"] == 0
                and result["failure"] is None
            )
            verify_rows(result["streams"])
    canonical = load(P + "verification-4/receipt.json")
    assert (
        canonical["status"] == "PASS"
        and canonical["sourceCount"] == 92
        and canonical["changed"] == []
    )
    assert len(canonical["stages"]) == 2
    for suffix in ["before", "after"]:
        rows_path = P + "verification-4/sources-" + suffix + ".json"
        verify_rows(load(rows_path))
        assert binding(rows_path)["sha256"] == canonical[suffix + "ManifestSha256"]
    for stage in canonical["stages"]:
        assert stage["result"]["status"] == "PASS" and stage["result"]["exitCode"] == 0
        verify_rows(stage["streams"])
    verify_rows(canonical["mockEvidence"])
    for name in [
        "actualHostExecuted",
        "actualProcessTransportInstantiated",
        "workerProcessExecuted",
        "nativeExecuted",
        "gpuExecuted",
        "referenceCaptured",
        "referenceBuilt",
        "referenceStaged",
        "referenceAcquired",
        "trainingExecuted",
        "trainingReady",
        "independentReferenceQualified",
        "canonicalQualified",
        "bothQualified",
        "closeQualified",
        "r4Qualified",
        "wiringQualified",
    ]:
        assert canonical[name] is False, name
    tests = path(P + "verification-4/selected-pure-tests/command.stderr").read_text()
    test_summary(tests)
    review = load(P + "review-2.json")
    verify_rows(review["correctedSources"] + [review["verification"]])
    assert all(
        review[name]["verdict"] == "READY_SOURCE_ONLY_YES"
        and review[name]["remainingFindings"] == []
        for name in ["adversarial", "security", "backend"]
    )
    checks["canonicalSourceOnly"] = {
        "generation": 4,
        "tests": 46,
        "assertions": 367,
        "sourceBindings": 92,
        "reviewsReady": 3,
    }
    for generation, expected in [(1, "FAIL"), (2, "FAIL"), (3, "PASS")]:
        proof = load(P + f"verification-{generation}/receipt.json")
        assert proof["status"] == expected
        for stage in proof["stages"]:
            verify_rows(stage.get("streams", []))
        verify_rows(proof["mockEvidence"])
    checks["historicalCanonicalProofsPreserved"] = [
        "FAIL",
        "FAIL",
        "PRE_CORRECTION_PASS",
    ]
    observation = load(CPU + "observation.json")
    verify_rows(observation["snapshots"])
    assert (
        observation["reportedCpuTests"] == 39 and observation["reportedHarnesses"] == 16
    )
    assert (
        observation["fullMetadataConsistency"] is False
        and observation["trainingReady"] is False
    )
    anomaly = observation["metadataAnomalies"][0]
    assert [
        anomaly["outcomeStdoutBytes"],
        anomaly["nativeAttemptStdoutBytes"],
        anomaly["nativeStreamStdoutBytes"],
    ] == [192, 179, 179]
    assert (
        observation["remainingHostInvocations"]
        == observation["remainingNormalCommits"]
        == observation["remainingHttpsPushes"]
        == 0
    )
    reported = load(CPU + "reported-receipt.json")["innerReceipt"]
    assert (
        next(
            row
            for row in reported["outcome"]["results"]
            if row["id"] == "policy-io:test:f32"
        )["stdoutBytes"]
        == 192
    )
    attempt = next(
        row for row in reported["results"] if row["id"] == "policy-io:test:f32"
    )
    assert attempt["stdoutBytes"] == attempt["streams"][0]["bytes"] == 179
    checks["cpuReportAnomalyPreserved"] = [192, 179, 179]
    publication = load(
        C + "publication-redelivery-execution-1/publication-and-redelivery-result.json"
    )
    publication_budget(publication)
    branch_contract(git("symbolic-ref", "--short", "HEAD").decode().strip())
    verify_rows(publication["streams"])
    assert (
        publication["commit"]
        == git("rev-parse", "HEAD").decode().strip()
        == "6fdc92c7eb90eb625e6d54c6a448009d5db34423"
    )
    assert (
        publication["destinationRef"]
        == "refs/heads/feat-ml-adjuntant-ii-continuation-2b24d9c5a"
    )
    index = load("_spec/.spec-index.json")
    assert index["unresolved"] == [] and all(row["covers"] for row in index["specs"])
    old_index = json.loads(git("show", "HEAD:_spec/.spec-index.json"))
    assert index["specs"][:-1] == old_index["specs"]
    assert index["specs"][-1] == {
        "spec": "_spec/runtime-protocol.puml",
        "covers": [P + "**"],
        "fingerprint": None,
    }
    for name in [
        "_spec/runtime-protocol.puml",
        "_spec/gpu-qualification.puml",
        "_spec/gpu-full-qualification.puml",
    ]:
        entry = next(row for row in index["specs"] if row["spec"] == name)
        text = path(name).read_text()
        assert re.findall(r"^' covers: (.+)$", text, re.MULTILINE) == entry["covers"]
        assert text.count("@startuml") == text.count("@enduml") == 1
        assert len(re.findall(r"^note\b", text, re.MULTILINE)) == len(
            re.findall(r"^end note$", text, re.MULTILINE)
        )
    checks["diagramIndexMatches"] = 3
    checks["diagramVerification"] = (
        "LOCAL_DELIMITERS_AND_COVERAGE_ONLY_NOT_RENDERED_REMOTE_INCLUDE_NOT_FETCHED"
    )
    for name in DOCS[1:]:
        text = path(name).read_text()
        doc_projection(text)
        assert not re.search(
            r"full C14(?:\s|\*)+512[- ]test|full C14.s512 tests", text
        ), name
    changed = git("diff", "--name-only").decode().splitlines()
    staged = git("diff", "--cached", "--name-only").decode().splitlines()
    change_scope(changed, staged)
    diff_path = str(directory.relative_to(ROOT) / "spec.diff")
    path(diff_path).write_bytes(
        git("diff", "--no-ext-diff", "--no-textconv", "HEAD", "--", *DOCS)
    )
    checks["specDiff"] = binding(diff_path)
    for name, extra in [("unstaged", []), ("staged", ["--cached"])]:
        whitespace = subprocess.run(
            ["git", "diff", *extra, "--check", "--", *DOCS],
            cwd=ROOT,
            capture_output=True,
            timeout=30,
            check=False,
        )
        (directory / (name + "-whitespace.stdout")).write_bytes(whitespace.stdout)
        (directory / (name + "-whitespace.stderr")).write_bytes(whitespace.stderr)
        assert whitespace.returncode == 0
    mutations = [
        (
            "substring-test-count",
            lambda: test_summary(tests.replace("46 pass", "146 pass")),
        ),
        (
            "substring-assertion-count",
            lambda: test_summary(tests.replace("367 expect", "1367 expect")),
        ),
        (
            "nonzero-failure-count",
            lambda: test_summary(tests.replace("0 fail", "1 fail")),
        ),
        (
            "remaining-publication",
            lambda: publication_budget({**publication, "remainingHttpsPushes": 1}),
        ),
        (
            "wrong-consumption",
            lambda: publication_budget({**publication, "normalCommitsConsumed": 0}),
        ),
        ("wrong-branch", lambda: branch_contract("other")),
        ("detached-head", lambda: branch_contract("")),
        (
            "staged-outside-scope",
            lambda: change_scope(DOCS, ["packages/runtime/src/job.ts"]),
        ),
    ]
    sample = path("_spec/runtime-protocol.puml").read_text()
    mutations.extend(
        [
            (
                "stale-projected-totals",
                lambda: doc_projection(
                    sample.replace("46 tests367 assertions", "37 tests305 assertions")
                ),
            ),
        ]
    )
    for name in DOCS[1:]:
        original = path(name).read_text()
        mutations.append(
            (
                "stale-canonical-review:" + name,
                lambda original=original: doc_projection(
                    stale_canonical_reviews(original)
                ),
            )
        )
    co_located = path("_spec/gpu-qualification.puml").read_text()
    old_claim = "review-2.json adversarial/security/backend READY_SOURCE_ONLY"
    assert old_claim in co_located
    mutations.append(
        (
            "canonical-review-only-stale-with-proposal-review2-intact",
            lambda: doc_projection(
                co_located.replace(
                    old_claim,
                    "review-1.json adversarial/security/backend READY_SOURCE_ONLY",
                    1,
                )
            ),
        )
    )
    for root in [APP_INPUTS, CORPUS_INPUTS, ACQUISITION]:
        for role in ["adversarial", "security", "devops"]:
            rejecting = copy.deepcopy(load(root + "review-1.json"))
            rejecting[role]["verdict"] = "READY_TO_MERGE_NO"
            mutations.append(
                (
                    "rejecting-review:" + root + role,
                    lambda root=root, rejecting=rejecting: review_contract(
                        root, rejecting
                    ),
                )
            )
    rejected = []
    for name, action in mutations:
        try:
            action()
        except AssertionError:
            rejected.append(name)
        else:
            raise AssertionError("MUTATION_NOT_REJECTED:" + name)
    checks["auditContractMutationsRejected"] = rejected
    for name in PRIMARY + [
        P + "packet-audit.py",
        CPU + "records.ts",
        CPU + "records.test.ts",
        CPU + "verify.ts",
        APP_INPUTS + "prepare.ts",
        APP_INPUTS + "prepare.test.ts",
        APP_INPUTS + "verification-1/proof.ts",
        CORPUS_INPUTS + "prepare.ts",
        CORPUS_INPUTS + "prepare.test.ts",
        CORPUS_INPUTS + "verification-1/proof.ts",
        ACQUISITION + "verification-1/check.py",
    ]:
        assert all(
            line == line.rstrip() for line in path(name).read_text().splitlines()
        ), name
    checks["scopedWhitespacePassed"] = True
    verify_local_proof(
        APP_INPUTS,
        "verification-3",
        "PASS_FRESH_TESTS_TYPES_AND_PRESERVED_MATERIALIZED_INPUT_RECHECK",
        3,
    )
    verify_local_proof(
        CORPUS_INPUTS,
        "verification-1",
        "PASS_BOUNDED_TWO_CORPUS_FILE_SIDECAR_PACKAGES_STILL_MISSING",
        4,
    )
    staged = []
    for root, count, size in [(APP_INPUTS, 427, 3850400), (CORPUS_INPUTS, 2, 671849)]:
        manifest = load(root + "input-manifest.json")
        materialization = load(root + "materialization.json")
        local_check = load(root + "check.json")
        assert (
            binding(root + "input-manifest.json")["sha256"]
            == materialization["inputManifestSha256"]
            == local_check["inputManifestSha256"]
        )
        assert (
            binding(root + "materialization.json")["sha256"]
            == local_check["materializationSha256"]
        )
        assert verify_input_tree(root, manifest, materialization) == (count, size)
        assert (
            local_check["installedPackageFilesCopied"] == 0
            and local_check["completeOfflineInput"] is False
        )
        for flag in [
            "trainingReady",
            "referenceCodeExecuted",
            "referenceBundlingApproved",
            "nativeOrGpuExecuted",
            "dependencyAcquisitionPerformed",
            "installationPerformed",
        ]:
            assert local_check[flag] is False
        assert local_check["networkOperations"] == local_check["gitMutations"] == 0
        review_ready(root)
        staged.append({"root": root, "files": count, "bytes": size})
    checks["allStagedInputPayloadsRehashed"] = {
        "packets": staged,
        "files": 429,
        "bytes": 4522249,
        "scope": "ALL_APP_SOURCE_AND_CORPUS_PACKET_FILES_NOT_ONE_ASSEMBLED_RUNTIME_TREE",
    }
    request = load(ACQUISITION + "request.json")
    package_plan = load(ACQUISITION + "plan.json")
    assert request["status"] == package_plan["status"] == "UNAPPROVED_NOT_EXECUTED"
    assert request["currentAuthorizedAcquisitionAttempts"] == 0
    assert (
        request["networkAcquisitionApproved"] is False
        and request["selectedArchiveExtractionApproved"] is False
    )
    assert (
        request["referenceBundlingApproved"] is False
        and request["hostAssemblyOrExecutionApproved"] is False
    )
    assert (
        request["actualCommitOrPushApproved"] is False
        and request["experimentTrainingApproved"] is False
    )
    assert (
        package_plan["networkOperationsPerformed"]
        == package_plan["archiveExtractionsPerformed"]
        == 0
    )
    assert [row["urlStatus"] for row in package_plan["archives"]] == [
        "PROPOSED_NOT_CONTACTED",
        "PROPOSED_NOT_CONTACTED",
    ]
    record_proof = load(ACQUISITION + "verification-1/receipt.json")
    assert (
        record_proof["status"] == "PASS_UNAPPROVED_PACKAGE_ACQUISITION_PROPOSAL_RECORDS"
        and record_proof["failure"] is None
    )
    assert len(record_proof["negativeCasesRejected"]) == 13
    assert record_proof["freshSerializeReparseComparisons"] == [
        "request.json",
        "plan.json",
    ]
    verify_rows(record_proof["bindings"])
    review_ready(ACQUISITION)
    checks["packageAcquisitionProposal"] = {
        "status": "UNAPPROVED_NOT_EXECUTED",
        "recordNegativeCases": 13,
        "freshRoundTrips": 2,
        "authorizedAttempts": 0,
        "networkOperations": 0,
    }
    verify_rows(before)
except Exception as error:
    failure = f"{type(error).__name__}: {error}"
    (directory / "failure.stderr").write_text(traceback.format_exc())
receipt = {
    "status": "PASS_LOCAL_PACKET_RECONCILIATION_ONLY"
    if failure is None
    else "FAIL_LOCAL_PACKET_RECONCILIATION",
    "failure": failure,
    "bindings": before,
    "checks": checks,
    "cacheOrArchivePayloadAccessed": False,
    "rawCaptureBytesModified": False,
    "gitMutationPerformed": False,
    "nativeHostGpuOrReferenceExecuted": False,
    "publicationAuthorized": False,
    "experimentTrainingAuthorized": False,
    "referenceInputDelivery": "PARTIAL_LOCAL_SOURCE_AND_CORPUS_MATERIALIZED_PACKAGES_MISSING",
    "authorizedLocalReferenceInputsMaterialized": True,
    "referenceBundlingPerformed": False,
    "trainingReady": False,
}
(directory / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": receipt["status"],
            "failure": failure,
            "receipt": str(directory.relative_to(ROOT) / "receipt.json"),
        }
    )
)
sys.exit(0 if failure is None else 1)

# SPEC: _spec/runtime-protocol.puml
import ast
import copy
import hashlib
import json
import pathlib
import sys
import traceback


ROOT = pathlib.Path("/home/gu1lty/Projects/proveo/chess-coach")
D = (
    ROOT
    / "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1"
)
R = D / "package-acquisition-proposal-1"
HERE = R / "verification-1"


def load(path):
    return json.loads(path.read_bytes())


def binding(path):
    data = path.read_bytes()
    return {
        "path": str(path.relative_to(ROOT)),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def validate(request, plan, lock):
    assert request["status"] == plan["status"] == "UNAPPROVED_NOT_EXECUTED"
    assert request["currentAuthorizedAcquisitionAttempts"] == 0
    assert request["requestedOperations"] == {
        "combinedAcquisitionAttempts": 1,
        "httpGets": 2,
        "getsPerUrl": 1,
        "selectedArchiveExtractions": 2,
    }
    assert request["requestedLimits"] == {
        "bytesPerArchive": 2097152,
        "aggregateArchiveBytes": 4194304,
        "perGetMs": 30000,
        "operationMs": 120000,
        "decompressedBytesPerArchiveIncludingSkippedContent": 8388608,
        "tarHeadersPerArchiveIncludingMetadata": 256,
        "aggregateSelectedOutputBytes": 8388608,
        "selectedFiles": 6,
    }
    for key in [
        "networkAcquisitionApproved",
        "selectedArchiveExtractionApproved",
        "automaticRetryAuthorized",
        "redirectsAuthorized",
        "headOrRegistryMetadataQueriesAuthorized",
        "credentialsCookiesOrNpmrcAuthorized",
        "packageInstallationAuthorized",
        "packageCodeExecutionAuthorized",
        "referenceBundlingApproved",
        "hostAssemblyOrExecutionApproved",
        "nativeOrGpuExecutionApproved",
        "actualCommitOrPushApproved",
        "experimentTrainingApproved",
        "trainingReady",
    ]:
        assert request[key] is False, key
    assert request["publicationBeforeFutureHostCommandDeliveryRequired"] is True
    assert plan["reference"] == "b4b241481fb12de4a7344e6dba8eda775af57675"
    assert (
        plan["archiveRoot"]
        == "_work/gpu-owner-recovery/cache/reference-package-inputs-1"
    )
    assert (
        plan["rawArchivesExcludedFromGit"] is True
        and plan["archiveRootMustBeFresh"] is True
    )
    assert plan["selectedSourcesRoot"] == str(
        (D / "package-inputs-1/files").relative_to(ROOT)
    )
    assert plan["selectedSourcesRootMustBeFresh"] is True
    expected = [
        ("fflate", "0.8.3", "esm/index.mjs"),
        ("jssha", "3.3.2", "dist/sha256.mjs"),
    ]
    assert len(plan["archives"]) == len(lock["lockProvenance"]) == 2
    for archive, (name, version, runtime), provenance in zip(
        plan["archives"], expected, lock["lockProvenance"]
    ):
        assert archive["name"] == provenance["name"] == name
        assert archive["version"] == provenance["requiredVersion"] == version
        assert (
            archive["url"]
            == f"https://registry.npmjs.org/{name}/-/{name}-{version}.tgz"
        )
        assert archive["urlStatus"] == "PROPOSED_NOT_CONTACTED"
        assert (
            provenance["status"] == "EXACT_VERSION_INTEGRITY_FOUND"
            and len(provenance["matches"]) == 1
        )
        assert archive["integrity"] == provenance["matches"][0]["integrity"]
        assert archive["requiredMembers"] == [
            {
                "member": "package/package.json",
                "retainedFile": f"{name}-{version}-package.json",
                "futureRelativePath": f"node_modules/{name}/package.json",
            },
            {
                "member": "package/" + runtime,
                "retainedFile": f"{name}-{version}-" + runtime.replace("/", "-"),
                "futureRelativePath": f"node_modules/{name}/" + runtime,
            },
        ]
        assert archive["optionalLicenseMembersInPreferenceOrder"] == [
            "package/LICENSE",
            "package/LICENSE.md",
            "package/LICENSE.txt",
        ]
        assert archive["maximumLicenseFiles"] == 1
    for key in [
        "verifyPinnedArchiveIntegrityBeforeDecompressionOrExtraction",
        "enforceActualStreamedByteLimits",
        "selectedMembersMustBeRegularFiles",
        "validatePackageJsonNameAndVersionWithoutExecutingCode",
        "preserveOriginalSelectedBytesAndNotices",
        "futurePathMappingsAuthorizeNoAssemblyNow",
    ]:
        assert plan[key] is True, key
    for key in [
        "unselectedMembersMaterialized",
        "flatFilesEstablishOneAssembledReferenceRoot",
        "rawArchiveOrSourceCacheDeletionAuthorized",
        "failedFull1CacheOrHaltedLlvmPipelineUseAuthorized",
        "newResolverOrAuthorizationFrameworkProposed",
        "packageCodeExecuted",
        "referenceBundlingPerformed",
        "hostNativeGpuOrTrainingExecuted",
        "actualCommitOrPushPerformed",
        "trainingReady",
    ]:
        assert plan[key] is False, key
    assert (
        plan["packageManagerOrInstallerInvocations"]
        == plan["networkOperationsPerformed"]
        == plan["archiveExtractionsPerformed"]
        == 0
    )


assert pathlib.Path.cwd() == ROOT and len(sys.argv) == 1
assert not any(
    (HERE / name).exists() for name in ["receipt.json", "check.stdout", "check.stderr"]
)
inputs = [
    R / "request.json",
    R / "plan.json",
    pathlib.Path(__file__),
    D / "local-inputs-1/check.json",
    D / "local-inputs-1/inputs/reference/pnpm-lock.yaml",
]
before = [binding(path) for path in inputs]
failure = None
rejected = []
roundtrips = []
try:
    ast.parse(pathlib.Path(__file__).read_text())
    request, plan, lock = load(inputs[0]), load(inputs[1]), load(inputs[3])
    validate(request, plan, lock)
    assert (
        binding(ROOT / plan["lockSource"]["path"])["sha256"]
        == plan["lockSource"]["sha256"]
    )
    assert all(
        row["lockSha256"] == plan["lockSource"]["sha256"]
        for row in lock["lockProvenance"]
    )
    for name, value in [("request.json", request), ("plan.json", plan)]:
        assert json.loads(json.dumps(value, allow_nan=False, sort_keys=True)) == value
        roundtrips.append(name)
    changes = [
        (
            "acquisition-authority",
            lambda a, b: a.update(networkAcquisitionApproved=True),
        ),
        (
            "attempt-budget",
            lambda a, b: a.update(currentAuthorizedAcquisitionAttempts=1),
        ),
        ("get-count", lambda a, b: a["requestedOperations"].update(httpGets=3)),
        (
            "archive-byte-cap",
            lambda a, b: a["requestedLimits"].update(bytesPerArchive=2097153),
        ),
        (
            "archive-git-exclusion",
            lambda a, b: b.update(rawArchivesExcludedFromGit=False),
        ),
        (
            "new-resolver",
            lambda a, b: b.update(newResolverOrAuthorizationFrameworkProposed=True),
        ),
        ("reference-build", lambda a, b: b.update(referenceBundlingPerformed=True)),
        (
            "wrong-url",
            lambda a, b: b["archives"][0].update(url="http://example.invalid/archive"),
        ),
        (
            "wrong-integrity",
            lambda a, b: b["archives"][0].update(integrity="sha512-incorrect"),
        ),
        (
            "outside-destination",
            lambda a, b: b["archives"][1]["requiredMembers"][1].update(
                futureRelativePath="../outside"
            ),
        ),
        (
            "unverified-contact-claim",
            lambda a, b: b["archives"][0].update(urlStatus="CONTACTED"),
        ),
        (
            "wildcard-license",
            lambda a, b: b["archives"][0].update(
                optionalLicenseMembersInPreferenceOrder=["package/*"]
            ),
        ),
        ("package-execution", lambda a, b: b.update(packageCodeExecuted=True)),
    ]
    for name, change in changes:
        first, second = copy.deepcopy(request), copy.deepcopy(plan)
        change(first, second)
        try:
            validate(first, second, lock)
        except AssertionError:
            rejected.append(name)
        else:
            raise AssertionError("MUTATION_NOT_REJECTED:" + name)
    assert before == [binding(path) for path in inputs]
except Exception as error:
    failure = type(error).__name__ + ": " + str(error)
    detail = traceback.format_exc()
    (HERE / "check.stderr").write_text(detail)
    sys.stderr.write(detail)
receipt = {
    "status": "PASS_UNAPPROVED_PACKAGE_ACQUISITION_PROPOSAL_RECORDS"
    if failure is None
    else "FAIL_ACQUISITION_PROPOSAL_RECORDS",
    "failure": failure,
    "bindings": before,
    "negativeCasesRejected": rejected,
    "freshSerializeReparseComparisons": roundtrips,
    "scope": "JSON_RECORDS_PINNED_LOCK_METADATA_AND_PYTHON_SYNTAX_ONLY",
    "urlContacted": False,
    "networkAcquisitionPerformed": False,
    "archiveExtractionPerformed": False,
    "packageCodeExecuted": False,
    "hostNativeGpuOrTrainingExecuted": False,
    "publicationPerformed": False,
    "newAuthorityGranted": False,
    "trainingReady": False,
}
with (HERE / "receipt.json").open("x") as output:
    output.write(json.dumps(receipt, indent=2) + "\n")
summary = (
    json.dumps(
        {
            "status": receipt["status"],
            "failure": failure,
            "negativeCases": len(rejected),
            "freshRoundTrips": len(roundtrips),
            "receipt": str((HERE / "receipt.json").relative_to(ROOT)),
        }
    )
    + "\n"
)
with (HERE / "check.stdout").open("x") as output:
    output.write(summary)
if failure is None:
    with (HERE / "check.stderr").open("x") as output:
        output.write("")
sys.stdout.write(summary)
sys.exit(0 if failure is None else 1)

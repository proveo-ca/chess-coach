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
HERE = D / "verification-1"


def load(path):
    return json.loads(path.read_bytes())


def binding(path):
    data = path.read_bytes()
    return {
        "path": str(path.relative_to(ROOT)),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def validate(selection, plan):
    assert (
        selection["status"] == "DIRECTION_ONLY"
        and selection["direction"] == "OFFLINE_PREPARATION"
    )
    for name in [
        "newAuthorityGranted",
        "captureCopyExtractBuildStageOrAcquisitionApproved",
        "hostExecutionApproved",
        "publicationApproved",
        "trainingApproved",
        "inputAvailabilityEstablished",
        "trainingReady",
    ]:
        assert selection[name] is False, name
    assert (
        plan["status"] == "UNAPPROVED_UNRESOLVED_NAMED_INPUTS"
        and plan["direction"] == "OFFLINE_PREPARATION"
    )
    for name in [
        "referenceSourceRoot",
        "installedPackageRoot",
        "outputRoot",
        "executableHandoff",
    ]:
        assert plan[name] is None, name
    for name in [
        "operationsAuthorized",
        "automaticInstallationAuthorized",
        "networkFallbackAuthorized",
        "broadDependencyCacheCopyAuthorized",
        "newResolverOrAuthorizationFrameworkProposed",
        "newHostInventoryOrCustodyGateRequired",
        "referenceCapturedBuiltStagedOrAcquired",
        "actualHostNativeOrGpuExecuted",
        "publicationApproved",
        "experimentTrainingAuthorized",
        "trainingReady",
    ]:
        assert plan[name] is False, name
    entries = load(ROOT / "tooling/reference-entrypoints.json")
    assert (
        plan["reference"]
        == entries["reference"]
        == "b4b241481fb12de4a7344e6dba8eda775af57675"
    )
    assert plan["bunVersion"] == entries["bunVersion"] == "1.4.0"
    assert plan["entries"] == entries["entries"] and len(plan["entries"]) == 6
    assert plan["existingBuilderLimits"] == {
        "builds": 6,
        "perEntryTimeoutMs": 30000,
        "maximumIndividualInputBytes": 16777216,
        "maximumIndividualOutputBytes": 16777216,
        "maximumPerEntryMetafileBytes": 1048576,
        "wholeOperationDeadlineMs": None,
        "filesystemQuotaEstablished": False,
    }
    assert plan["allResolvedInputsMustRemainInsideReferenceSourceRoot"] is True
    assert plan["inputNamesArePlanningContextNotAvailabilityProof"] is True
    assert plan["exactOperationalApprovalStillRequired"] is True
    assert (
        plan["preparedPacketCommitAndPushRequiredBeforeAnyHostCommandDelivery"] is True
    )
    assert len(plan["missingContext"]) == 2 and len(plan["proposedOperations"]) == 5
    historical = plan["historicalMetadataOnly"]
    assert historical["historicalExternalInventoryAccessed"] is False
    assert historical["historicalCountsOrPackagesAcceptedAsCurrentClosure"] is False
    assert historical["selectedInputCountAtHistoricalReceipt"] == 95
    assert historical["selectedPackageFilesAtHistoricalReceipt"] == [
        "fflate@0.8.3/esm/index.mjs",
        "jssha@3.3.2/dist/sha256.mjs",
    ]


assert pathlib.Path.cwd() == ROOT and len(sys.argv) == 1
assert not any(
    (HERE / name).exists() for name in ["receipt.json", "check.stdout", "check.stderr"]
)
inputs = [
    D / "selection.json",
    D / "plan.json",
    pathlib.Path(__file__),
    ROOT / "tooling/build-reference.ts",
    ROOT / "tooling/reference-entrypoints.json",
]
before = [binding(path) for path in inputs]
failure = None
rejected = []
try:
    ast.parse(pathlib.Path(__file__).read_text())
    selection, plan = load(D / "selection.json"), load(D / "plan.json")
    validate(selection, plan)
    for row in [
        selection["issuedDirectionRequest"],
        plan["builder"],
        plan["entrypointMetadata"],
    ]:
        assert binding(ROOT / row["path"])["sha256"] == row["sha256"]
    issued = load(ROOT / selection["issuedDirectionRequest"]["path"])
    assert (
        issued["selectedChoice"] is None and selection["issuedRequestPreserved"] is True
    )
    for target, field, value in [
        ("selection", "newAuthorityGranted", True),
        ("selection", "hostExecutionApproved", True),
        ("selection", "publicationApproved", True),
        ("selection", "trainingApproved", True),
        ("selection", "inputAvailabilityEstablished", True),
        ("plan", "operationsAuthorized", True),
        ("plan", "referenceSourceRoot", "/invented"),
        ("plan", "installedPackageRoot", "/invented"),
        ("plan", "outputRoot", "/invented"),
        ("plan", "executableHandoff", "forbidden"),
        ("plan", "networkFallbackAuthorized", True),
        ("plan", "trainingReady", True),
    ]:
        first, second = copy.deepcopy(selection), copy.deepcopy(plan)
        (first if target == "selection" else second)[field] = value
        try:
            validate(first, second)
        except AssertionError:
            rejected.append(target + "." + field)
        else:
            raise AssertionError("MUTATION_NOT_REJECTED:" + field)
    assert before == [binding(path) for path in inputs]
except Exception as error:
    failure = type(error).__name__ + ": " + str(error)
    detail = traceback.format_exc()
    (HERE / "check.stderr").write_text(detail)
    sys.stderr.write(detail)
receipt = {
    "status": "PASS_DIRECTION_ONLY_PROPOSAL_RECORDS"
    if failure is None
    else "FAIL_PROPOSAL_RECORDS",
    "failure": failure,
    "bindings": before,
    "negativeCasesRejected": rejected,
    "recordRoundTripPassed": failure is None,
    "pythonSyntaxPassed": failure is None,
    "scope": "JSON_RECORDS_AND_EXISTING_BUILDER_METADATA_ONLY",
    "referencePayloadAccessed": False,
    "historicalExternalInventoryAccessed": False,
    "captureCopyExtractBuildStageOrAcquisitionPerformed": False,
    "hostNativeGpuOrReferenceExecuted": False,
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

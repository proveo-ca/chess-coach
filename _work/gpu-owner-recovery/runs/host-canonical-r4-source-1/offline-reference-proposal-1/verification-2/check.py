# SPEC: _spec/runtime-protocol.puml
import ast
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
HERE = D / "verification-2"


def binding(path):
    data = path.read_bytes()
    return {
        "path": str(path.relative_to(ROOT)),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


assert pathlib.Path.cwd() == ROOT and len(sys.argv) == 1
assert not any(
    (HERE / name).exists() for name in ["receipt.json", "check.stdout", "check.stderr"]
)
inputs = [
    D / "selection.json",
    D / "plan.json",
    D / "verification-1/check.py",
    D / "verification-1/receipt.json",
    pathlib.Path(__file__),
    ROOT / "tooling/build-reference.ts",
    ROOT / "tooling/reference-entrypoints.json",
]
before = [binding(path) for path in inputs]
failure = None
roundtrips = []
prior = None
try:
    ast.parse(pathlib.Path(__file__).read_text())
    prior = json.loads((D / "verification-1/receipt.json").read_bytes())
    assert (
        prior["status"] == "PASS_DIRECTION_ONLY_PROPOSAL_RECORDS"
        and len(prior["negativeCasesRejected"]) == 12
    )
    assert prior["failure"] is None
    expected = [
        str(path.relative_to(ROOT))
        for path in [
            D / "selection.json",
            D / "plan.json",
            D / "verification-1/check.py",
            ROOT / "tooling/build-reference.ts",
            ROOT / "tooling/reference-entrypoints.json",
        ]
    ]
    assert [row["path"] for row in prior["bindings"]] == expected
    for row in prior["bindings"]:
        assert binding(ROOT / row["path"]) == row
    for name in ["selection.json", "plan.json"]:
        value = json.loads((D / name).read_bytes())
        encoded = json.dumps(value, allow_nan=False, sort_keys=True)
        decoded = json.loads(encoded)
        assert decoded == value
        roundtrips.append(name)
    selection = json.loads((D / "selection.json").read_bytes())
    plan = json.loads((D / "plan.json").read_bytes())
    assert (
        selection["newAuthorityGranted"] is False
        and plan["operationsAuthorized"] is False
    )
    assert all(
        plan[name] is None
        for name in [
            "referenceSourceRoot",
            "installedPackageRoot",
            "outputRoot",
            "executableHandoff",
        ]
    )
    assert before == [binding(path) for path in inputs]
except Exception as error:
    failure = type(error).__name__ + ": " + str(error)
    detail = traceback.format_exc()
    (HERE / "check.stderr").write_text(detail)
    sys.stderr.write(detail)
receipt = {
    "status": "PASS_POST_REVIEW_DIRECTION_ONLY_RECORDS"
    if failure is None
    else "FAIL_POST_REVIEW_RECORDS",
    "failure": failure,
    "bindings": before,
    "priorNegativeCasesAcceptedAtUnchangedBindings": prior["negativeCasesRejected"]
    if failure is None
    else [],
    "priorRoundTripClaimNotUsed": True,
    "freshRoundTripRecords": roundtrips,
    "recordRoundTripPassed": failure is None and len(roundtrips) == 2,
    "scope": "PRIOR_BOUND_12_NEGATIVE_CASES_PLUS_TWO_FRESH_SERIALIZE_REPARSE_COMPARISONS",
    "pythonSyntaxPassed": failure is None,
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

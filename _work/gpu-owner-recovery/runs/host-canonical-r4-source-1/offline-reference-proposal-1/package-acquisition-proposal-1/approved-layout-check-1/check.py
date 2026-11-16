# SPEC: _spec/runtime-protocol.puml
import hashlib
import json
import pathlib
import subprocess
import sys
import traceback


ROOT = pathlib.Path("/home/gu1lty/Projects/proveo/chess-coach")
R = (
    ROOT
    / "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-proposal-1"
)
HERE = R / "approved-layout-check-1"
assert pathlib.Path.cwd() == ROOT and len(sys.argv) == 1
assert not (HERE / "receipt.json").exists()
plan_bytes = (R / "plan.json").read_bytes()
plan = json.loads(plan_bytes)
cases = []
for archive in plan["archives"]:
    cases.append((plan["archiveRoot"] + "/" + archive["archiveFile"], True))
    for member in archive["requiredMembers"]:
        cases.append(
            (plan["selectedSourcesRoot"] + "/" + member["retainedFile"], False)
        )
    for member in archive["optionalLicenseMembersInPreferenceOrder"]:
        cases.append(
            (
                plan["selectedSourcesRoot"]
                + "/"
                + archive["licenseRetainedFilePrefix"]
                + pathlib.PurePosixPath(member).name,
                False,
            )
        )
results = []
failure = None
try:
    for index, (name, expected_ignored) in enumerate(cases):
        argv = [
            "git",
            "--no-optional-locks",
            "-c",
            "core.fsmonitor=false",
            "check-ignore",
            "--no-index",
            "--quiet",
            "--",
            name,
        ]
        result = subprocess.run(
            argv, cwd=ROOT, capture_output=True, timeout=30, check=False
        )
        (HERE / f"{index}.stdout").write_bytes(result.stdout)
        (HERE / f"{index}.stderr").write_bytes(result.stderr)
        assert result.returncode in [0, 1]
        ignored = result.returncode == 0
        results.append(
            {
                "argv": argv,
                "exitCode": result.returncode,
                "path": name,
                "ignored": ignored,
                "expectedIgnored": expected_ignored,
            }
        )
        assert ignored == expected_ignored, name
    assert (R / "plan.json").read_bytes() == plan_bytes
except Exception as error:
    failure = type(error).__name__ + ": " + str(error)
    (HERE / "failure.stderr").write_text(traceback.format_exc())
receipt = {
    "status": "PASS_PROPOSED_ARTIFACT_IGNORE_RULES_ONLY"
    if failure is None
    else "FAIL_ARTIFACT_IGNORE_RULES",
    "failure": failure,
    "planSha256": hashlib.sha256(plan_bytes).hexdigest(),
    "results": results,
    "scope": "GIT_IGNORE_MATCHES_FOR_PATH_STRINGS_NOT_FILESYSTEM_OPERATION_PREFLIGHT",
    "operationRootClaimed": False,
    "artifactDirectoriesCreated": False,
    "gitMutationPerformed": False,
    "getRequestsPerformed": 0,
    "acquisitionAllowanceConsumed": False,
    "trainingReady": False,
}
with (HERE / "receipt.json").open("x") as output:
    output.write(json.dumps(receipt, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": receipt["status"],
            "failure": failure,
            "cases": len(results),
            "receipt": str((HERE / "receipt.json").relative_to(ROOT)),
        }
    )
)
sys.exit(0 if failure is None else 1)

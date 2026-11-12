# SPEC: _spec/gpu-qualification.puml
import hashlib
import json
import pathlib
import re
import subprocess
import sys


ROOT = pathlib.Path("/home/gu1lty/Projects/proveo/chess-coach")
PACKET = pathlib.Path(
    "_work/gpu-owner-recovery/runs/host-cpu-regression-delivery-source-1"
)
CPU = pathlib.Path("_work/gpu-owner-recovery/runs/host-cpu-regression-source-2")
GPU = pathlib.Path(
    "_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/full2-pass-report-1"
)
DOCS = [
    "_spec/.spec-index.json",
    "_spec/gate-closure.md",
    "_spec/gpu-full-qualification.puml",
    "_spec/gpu-qualification.puml",
    "_spec/gpu-readiness.md",
    "_spec/readiness.md",
]


def load(path):
    return json.loads(pathlib.Path(path).read_text())


def digest(path):
    return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


def verify_rows(rows):
    for row in rows:
        path = pathlib.Path(row["path"])
        local = path.relative_to(ROOT) if path.is_absolute() else path
        assert ".." not in local.parts and "cache" not in local.parts
        assert path.suffix not in [".crate", ".tar", ".zst", ".gz", ".xz"]
        assert digest(path) == row["sha256"], str(path)


assert pathlib.Path.cwd() == ROOT
assert len(sys.argv) == 2 and re.fullmatch(r"packet-check-[1-9][0-9]?", sys.argv[1])
directory = PACKET / sys.argv[1]
directory.mkdir()
inputs = DOCS + [
    str(CPU / "receipt.json"),
    str(PACKET / "verification-1/receipt.json"),
    str(PACKET / "verification-1/binding.json"),
    str(PACKET / "campaign-request.json"),
    str(PACKET / "approval.json"),
    str(PACKET / "packet-check.py"),
    str(GPU / "verification-3/receipt.json"),
    str(GPU / "review.json"),
]
bindings = [{"path": path, "sha256": digest(path)} for path in inputs]
failure = None
checks = {}
try:
    full = load("_work/gpu-owner-recovery/runs/host-gpu-full-source-4/sources.json")
    frozen = load(
        "_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/receipt.json"
    )["sources"]
    native_path = "_work/gpu-owner-recovery/runs/host-gpu-policy-record-correction-source-2/native-source-manifest.json"
    native = load(native_path)
    assert [len(full), len(frozen), len(native)] == [347, 327, 65]
    assert (
        digest(native_path)
        == "7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec"
    )
    for rows in [full, frozen, native]:
        verify_rows(rows)
    checks["frozenRepositorySourceHashes"] = [347, 327, 65]
    cpu = load(CPU / "receipt.json")
    assert (
        cpu["status"] == "PASS_SOURCE_ONLY"
        and cpu["sourceChanged"] is False
        and cpu["programsChanged"] is False
    )
    verify_rows(cpu["bindings"])
    verify_rows(cpu["programs"])
    delivery = load(PACKET / "verification-1/receipt.json")
    assert (
        delivery["status"] == "PASS_DELIVERY_SOURCE_TESTS_AND_TYPES_ONLY"
        and delivery["sourceChanged"] is False
        and delivery["fishSyntaxChecked"] is True
    )
    verify_rows(delivery["sources"])
    gpu = load(GPU / "verification-3/receipt.json")
    assert (
        gpu["status"]
        == "PASS_OPERATOR_REPORTED_FULL_SIX_RECORDS_SOURCE_TESTS_AND_TYPES_ONLY"
        and gpu["sourceChanged"] is False
    )
    verify_rows(gpu["sources"])
    for proof in [cpu, delivery, gpu]:
        assert all(
            result["status"] == "PASS"
            and result["exitCode"] == 0
            and result["failure"] is None
            for result in proof["results"]
        )
        for result in proof["results"]:
            verify_rows(result["streams"])
    checks["passingLocalStages"] = [
        len(cpu["results"]),
        len(delivery["results"]),
        len(gpu["results"]),
    ]
    binding = load(PACKET / "verification-1/binding.json")
    request = load(PACKET / "campaign-request.json")
    approval = load(PACKET / "approval.json")
    assert approval["request"]["sha256"] == digest(approval["request"]["path"])
    assert approval["cpuProof"]["sha256"] == digest(approval["cpuProof"]["path"])
    assert approval["manualCommand"]["sha256"] == digest(
        approval["manualCommand"]["path"]
    )
    assert approval["grantId"] == "cpu39-manual-grant-1"
    assert approval["oneNormalScopedCommitAndOneHttpsPushApproved"] is True
    assert (
        approval["maximumNormalCommits"]
        == approval["maximumHttpsPushes"]
        == approval["maximumCombinedManualHostAttempts"]
        == approval["maximumManualCommandTextDeliveries"]
        == 1
    )
    assert (
        approval["automaticTerminalSubmissionAuthorized"] is False
        and approval["automaticRetryAuthorized"] is False
        and approval["codingHostOrNativeProjectExecutionApproved"] is False
        and approval["experimentTrainingAuthorized"] is False
    )
    canonical = pathlib.Path(request["canonicalCpuScript"]["path"])
    data = canonical.read_bytes()
    assert len(data) == binding["bytes"] == request["canonicalCpuScript"]["bytes"]
    assert (
        digest(canonical)
        == binding["sha256"]
        == request["canonicalCpuScript"]["sha256"]
    )
    blob = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
    assert blob == binding["gitBlobSha"] == request["canonicalCpuScript"]["gitBlobSha"]
    assert approval["canonicalScript"] == request["canonicalCpuScript"]
    assert (
        digest(binding["cpuProofReceipt"]["path"])
        == binding["cpuProofReceipt"]["sha256"]
    )
    checks["canonicalScript"] = {
        "bytes": len(data),
        "sha256": digest(canonical),
        "gitBlobSha": blob,
    }
    index = load("_spec/.spec-index.json")
    entries = (
        index if isinstance(index, list) else index.get("specs", index.get("entries"))
    )
    assert isinstance(entries, list)
    for name in ["_spec/gpu-qualification.puml", "_spec/gpu-full-qualification.puml"]:
        entry = next(row for row in entries if row["spec"] == name)
        covers = re.findall(
            r"^' covers: (.+)$", pathlib.Path(name).read_text(), re.MULTILINE
        )
        assert covers == entry["covers"] and entry["fingerprint"] is None
    checks["owningDiagramIndexMatches"] = 2
    result = subprocess.run(
        ["git", "diff", "--check", "--", *DOCS],
        capture_output=True,
        timeout=30,
        check=False,
    )
    (directory / "whitespace.stdout").write_bytes(result.stdout)
    (directory / "whitespace.stderr").write_bytes(result.stderr)
    assert result.returncode == 0
    verify_rows(bindings)
except Exception as error:
    failure = f"{type(error).__name__}: {error}"
receipt = {
    "status": "PASS_SOURCE_PACKET_RECONCILIATION_ONLY"
    if failure is None
    else "FAIL_SOURCE_PACKET_RECONCILIATION",
    "failure": failure,
    "bindings": bindings,
    "checks": checks,
    "gitMutationPerformed": False,
    "hostExecuted": False,
    "downloadsPerformed": False,
    "nativeProjectCommandsExecuted": False,
    "trainingReady": False,
}
(directory / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(
    json.dumps(
        {
            "status": receipt["status"],
            "failure": failure,
            "receipt": str(directory / "receipt.json"),
        }
    )
)
sys.exit(0 if failure is None else 1)

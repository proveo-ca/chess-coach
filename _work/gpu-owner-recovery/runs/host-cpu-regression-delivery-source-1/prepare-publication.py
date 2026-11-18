# SPEC: _spec/gpu-qualification.puml
import hashlib
import json
import os
import pathlib
import stat
import subprocess


ROOT = pathlib.Path("/home/gu1lty/Projects/proveo/chess-coach")
PACKET = pathlib.Path(
    "_work/gpu-owner-recovery/runs/host-cpu-regression-delivery-source-1"
)
request = json.loads((PACKET / "campaign-request.json").read_text())
approval = json.loads((PACKET / "approval.json").read_text())
assert pathlib.Path.cwd() == ROOT
assert approval["oneNormalScopedCommitAndOneHttpsPushApproved"] is True
assert (
    hashlib.sha256((PACKET / "campaign-request.json").read_bytes()).hexdigest()
    == approval["request"]["sha256"]
)
assert (
    subprocess.check_output(["git", "rev-parse", "HEAD"], timeout=10).decode().strip()
    == approval["parentCommit"]
)
assert not subprocess.check_output(
    ["git", "diff", "--cached", "--name-only"], timeout=10
)
scope = request["publication"]["scope"]
exact = [path for path in scope if not path.endswith("/**")]
assert set(
    subprocess.check_output(["git", "diff", "--name-only"], timeout=10)
    .decode()
    .splitlines()
) <= set(exact)
paths = set(exact)
excluded = []
for pattern in scope:
    if not pattern.endswith("/**"):
        continue
    base = pathlib.Path(pattern[:-3])
    for directory, names, files in os.walk(base):
        for name in list(names):
            if name in {
                "home",
                "tmp",
                "node_modules",
                ".bun",
                ".cache",
                "cache",
                "target",
            }:
                excluded.append(str(pathlib.Path(directory) / name))
                names.remove(name)
        paths.update(str(pathlib.Path(directory) / name) for name in files)
controls = [
    str(PACKET / "publication-paths.txt"),
    str(PACKET / "publication-inputs.json"),
]
assert not any(pathlib.Path(path).exists() for path in controls)
rows = []
for path in sorted(paths):
    file = pathlib.Path(path)
    assert stat.S_ISREG(file.lstat().st_mode), path
    assert file.stat().st_size <= 10 * 1024 * 1024, path
    data = file.read_bytes()
    data.decode("utf-8")
    assert b"\0" not in data and "\n" not in path and "\r" not in path, path
    rows.append(
        {"path": path, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    )
paths.update(controls)
assert len(paths) <= 256
listing = "".join(path + "\n" for path in sorted(paths)).encode()
record = {
    "status": "PREPARED_APPROVED_EXPLICIT_TEXT_PUBLICATION_COHORT",
    "grantId": approval["grantId"],
    "paths": sorted(paths),
    "bindingsExcludingTheseTwoControlFiles": rows,
    "pathListSha256": hashlib.sha256(listing).hexdigest(),
    "preservedExcludedRoots": excluded,
    "fileCount": len(paths),
    "boundInputBytes": sum(row["bytes"] for row in rows),
    "regularUtf8TextOnly": True,
    "gitMutationPerformed": False,
    "hostExecuted": False,
    "trainingReady": False,
}
record_bytes = (json.dumps(record, indent=2) + "\n").encode()
complete_bytes = record["boundInputBytes"] + len(listing) + len(record_bytes)
assert complete_bytes <= 16 * 1024 * 1024
with pathlib.Path(controls[0]).open("xb") as stream:
    stream.write(listing)
with pathlib.Path(controls[1]).open("xb") as stream:
    stream.write(record_bytes)
print(
    json.dumps(
        {
            "status": record["status"],
            "fileCount": len(paths),
            "boundInputBytes": record["boundInputBytes"],
            "completeCohortBytesIncludingControls": complete_bytes,
            "excludedRootsPreserved": len(excluded),
        }
    )
)

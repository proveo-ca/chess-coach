# SPEC: _spec/runtime-protocol.puml, _spec/gate-closure.puml
from __future__ import annotations

import json
import os
import re
import selectors
import signal
import stat
import subprocess
import time
from dataclasses import asdict, dataclass
from pathlib import Path, PurePosixPath
from typing import Callable, Protocol
from tooling.runtime.evidence import AttemptEvidence, EvidencePacket


def boottime_ns() -> int:
    return time.clock_gettime_ns(time.CLOCK_BOOTTIME)


@dataclass(frozen=True)
class Budget:
    origin_ns: int
    clock: Callable[[], int]

    @property
    def cold_ns(self) -> int:
        return self.origin_ns + 10_000_000_000

    @property
    def work_ns(self) -> int:
        return self.origin_ns + 297_000_000_000

    @property
    def total_ns(self) -> int:
        return self.origin_ns + 300_000_000_000

    def check(self, deadline: int) -> int:
        now = self.clock()
        if now < self.origin_ns or now >= deadline:
            raise RuntimeError("Supervisor: DEADLINE")
        return now


@dataclass(frozen=True)
class Limits:
    cpus: tuple[int, ...]
    tmp_inodes: int
    nofile: int
    file_bytes: int
    stdout_bytes: int
    stderr_bytes: int
    frame_bytes: int

    @classmethod
    def balanced(cls, cpus: tuple[int, ...]) -> Limits:
        return cls(
            cpus,
            16384,
            256,
            64 * 1024 * 1024,
            64 * 1024 * 1024,
            8 * 1024 * 1024,
            1048576,
        )

    def check(self) -> None:
        if (
            not self.cpus
            or len(self.cpus) > 12
            or tuple(sorted(set(self.cpus))) != self.cpus
        ):
            raise ValueError("Supervisor: CPU_SET")
        if any(type(cpu) is not int or cpu < 0 or cpu > 1_048_575 for cpu in self.cpus):
            raise ValueError("Supervisor: CPU_SET")
        for value in (
            self.tmp_inodes,
            self.nofile,
            self.file_bytes,
            self.stdout_bytes,
            self.stderr_bytes,
            self.frame_bytes,
        ):
            if type(value) is not int or value < 1 or value > 2**53 - 1:
                raise ValueError("Supervisor: LIMITS")
        if self.frame_bytes > self.stdout_bytes:
            raise ValueError("Supervisor: FRAME_BOUND")
        if self != Limits.balanced(self.cpus):
            raise ValueError("Supervisor: C9_PROFILE")


@dataclass(frozen=True)
class JobSpec:
    name: str
    image: str
    session_id: str
    ownership_token: str
    approved_cgroup_parent: str
    expected_boundaries: tuple[str, str, str]
    limits: Limits

    def check(self) -> None:
        self.limits.check()
        if not re.fullmatch(r"chess-coach-[a-z0-9-]{1,48}", self.name):
            raise ValueError("Supervisor: NAME")
        if not re.fullmatch(r"sha256:[a-f0-9]{64}", self.image):
            raise ValueError("Supervisor: IMAGE")
        if not re.fullmatch(r"[A-Za-z0-9._:-]{1,64}", self.session_id):
            raise ValueError("Supervisor: SESSION")
        if not re.fullmatch(r"[a-f0-9]{32}", self.ownership_token):
            raise ValueError("Supervisor: OWNERSHIP_LABEL")
        if len(self.expected_boundaries) != 3 or any(
            not re.fullmatch(r"[a-f0-9]{64}", value)
            for value in self.expected_boundaries
        ):
            raise ValueError("Supervisor: EXPECTATIONS")
        safe_cgroup_path(self.approved_cgroup_parent)


def safe_cgroup_path(value: str) -> PurePosixPath:
    if not value.startswith("/") or "\x00" in value or "\\" in value:
        raise ValueError("Observer: CGROUP_PATH")
    if any(part in ("", ".", "..") for part in value.split("/")[1:]):
        raise ValueError("Observer: CGROUP_PATH")
    path = PurePosixPath(value)
    if path == PurePosixPath("/"):
        raise ValueError("Observer: ROOT_CGROUP")
    return path


def parse_cpu_set(value: str) -> tuple[int, ...]:
    cpus: set[int] = set()
    for part in value.strip().split(","):
        if not re.fullmatch(r"[0-9]+(?:-[0-9]+)?", part):
            raise ValueError("Observer: CPU_SET")
        start, _, end = part.partition("-")
        first, last = int(start), int(end or start)
        if last < first or last - first >= 12:
            raise ValueError("Observer: CPU_SET")
        cpus.update(range(first, last + 1))
        if len(cpus) > 12:
            raise ValueError("Observer: CPU_SET")
    return tuple(sorted(cpus))


@dataclass(frozen=True)
class CgroupBinding:
    relative: PurePosixPath
    parent: PurePosixPath
    root_identity: tuple[int, int]
    parent_identity: tuple[int, int]


class ReadOnlyCgroupObserver:
    def __init__(self, proc_root: Path, cgroup_root: Path):
        self.proc_root = proc_root
        self.cgroup_root = cgroup_root

    @staticmethod
    def _identity(path: Path) -> tuple[int, int]:
        value = path.lstat()
        if not stat.S_ISDIR(value.st_mode):
            raise RuntimeError("Observer: DIRECTORY")
        return value.st_dev, value.st_ino

    @staticmethod
    def _read(path: Path, bound: int = 65536) -> str:
        if not stat.S_ISREG(path.lstat().st_mode):
            raise RuntimeError("Observer: FILE_KIND")
        with path.open("rb") as handle:
            value = handle.read(bound + 1)
        if len(value) > bound:
            raise RuntimeError("Observer: BYTE_BOUND")
        return value.decode("ascii", errors="strict")

    def _path(self, value: PurePosixPath) -> Path:
        path = self.cgroup_root
        self._identity(path)
        for part in value.parts[1:]:
            path /= part
            self._identity(path)
        return path

    def bind(self, pid: int, parent_value: str, limits: Limits) -> CgroupBinding:
        limits.check()
        if type(pid) is not int or pid < 1:
            raise ValueError("Observer: PID")
        lines = self._read(self.proc_root / str(pid) / "cgroup").splitlines()
        if len(lines) != 1 or not lines[0].startswith("0::"):
            raise RuntimeError("Observer: CGROUP_V2")
        relative, parent = (
            safe_cgroup_path(lines[0][3:]),
            safe_cgroup_path(parent_value),
        )
        if relative == parent or not relative.is_relative_to(parent):
            raise RuntimeError("Observer: OWNED_PARENT")
        path = self._path(relative)
        binding = CgroupBinding(
            relative,
            parent,
            self._identity(self.cgroup_root),
            self._identity(self._path(parent)),
        )
        expected = {
            "cpu.max": "400000 100000",
            "memory.max": "8589934592",
            "memory.swap.max": "0",
            "pids.max": "512",
        }
        for name, value in expected.items():
            if self._read(path / name).strip() != value:
                raise RuntimeError(f"Observer: EFFECTIVE_{name}")
        if parse_cpu_set(self._read(path / "cpuset.cpus.effective")) != limits.cpus:
            raise RuntimeError("Observer: EFFECTIVE_CPU_SET")
        if pid not in self.members(binding):
            raise RuntimeError("Observer: INIT_MEMBERSHIP")
        return binding

    def _stable(self, binding: CgroupBinding) -> None:
        if (
            self._identity(self.cgroup_root) != binding.root_identity
            or self._identity(self._path(binding.parent)) != binding.parent_identity
        ):
            raise RuntimeError("Observer: OBSERVATION_ROOT_CHANGED")

    def members(self, binding: CgroupBinding) -> set[int]:
        self._stable(binding)
        pending = [self._path(binding.relative)]
        members: set[int] = set()
        directories = 0
        while pending:
            path = pending.pop()
            self._identity(path)
            directories += 1
            if directories > 513:
                raise RuntimeError("Observer: TREE_BOUND")
            for value in self._read(path / "cgroup.procs").splitlines():
                if not re.fullmatch(r"[1-9][0-9]*", value):
                    raise RuntimeError("Observer: MEMBERSHIP")
                members.add(int(value))
            if len(members) > 512:
                raise RuntimeError("Observer: TASK_BOUND")
            for child in path.iterdir():
                mode = child.lstat().st_mode
                if stat.S_ISLNK(mode):
                    raise RuntimeError("Observer: SYMLINK")
                if stat.S_ISDIR(mode):
                    pending.append(child)
                    if directories + len(pending) > 513:
                        raise RuntimeError("Observer: TREE_BOUND")
        return members

    def gone(self, binding: CgroupBinding) -> bool:
        self._stable(binding)
        try:
            self._path(binding.relative)
        except FileNotFoundError:
            return True
        return False


@dataclass(frozen=True)
class ExitReceipt:
    exit_code: int
    stdout_eof: bool
    stderr_eof: bool
    reaped: bool
    forced: bool


class OwnedProcess:
    def __init__(
        self, argv: list[str], budget: Budget, stdout_bound: int, stderr_bound: int
    ):
        self.budget = budget
        self.child = subprocess.Popen(
            argv,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={
                "PATH": "/usr/local/bin:/usr/bin:/bin",
                "HOME": "/nonexistent",
                "GOMAXPROCS": "2",
            },
            start_new_session=True,
        )
        self.selector = selectors.DefaultSelector()
        self.stdout = bytearray()
        self.stderr = bytearray()
        self.bounds = {"stdout": stdout_bound, "stderr": stderr_bound}
        self.counts = {"stdout": 0, "stderr": 0}
        self.eof = {"stdout": False, "stderr": False}
        self.forced = False
        for name in ("stdout", "stderr"):
            handle = getattr(self.child, name)
            os.set_blocking(handle.fileno(), False)
            self.selector.register(handle, selectors.EVENT_READ, name)
        os.set_blocking(self.child.stdin.fileno(), False)

    def send(self, data: bytes, deadline: int) -> None:
        pending = memoryview(data)
        while pending:
            self.budget.check(deadline)
            try:
                count = os.write(self.child.stdin.fileno(), pending)
                pending = pending[count:]
            except BlockingIOError:
                self.pump(deadline)
        self.budget.check(deadline)

    def close_stdin(self) -> None:
        if not self.child.stdin.closed:
            self.child.stdin.close()

    def pending_stdout(self) -> bool:
        return bool(self.stdout)

    def pump(self, deadline: int) -> None:
        self.budget.check(deadline)
        timeout = min(0.01, (deadline - self.budget.clock()) / 1_000_000_000)
        for key, _ in self.selector.select(max(0, timeout)):
            data = os.read(key.fileobj.fileno(), 65536)
            name = key.data
            if not data:
                self.selector.unregister(key.fileobj)
                key.fileobj.close()
                self.eof[name] = True
                continue
            self.counts[name] += len(data)
            retained = getattr(self, name)
            retained.extend(data[: max(0, self.bounds[name] - len(retained))])
            if self.counts[name] > self.bounds[name]:
                raise RuntimeError(f"Supervisor: {name.upper()}_BOUND")
        self.budget.check(deadline)

    def line(self, deadline: int, frame_bound: int) -> tuple[bytes, int]:
        while True:
            end = self.stdout.find(b"\n")
            if end >= 0:
                received = self.budget.clock()
                self.budget.check(deadline)
                if end > frame_bound or end == 0 or end + 1 != len(self.stdout):
                    raise RuntimeError("Supervisor: FRAME_BOUND_OR_UNSOLICITED")
                value = bytes(self.stdout[:end])
                self.stdout.clear()
                return value, received
            if len(self.stdout) > frame_bound or self.eof["stdout"]:
                raise RuntimeError("Supervisor: FRAME_BOUND_OR_EOF")
            self.pump(deadline)

    def finish(self, deadline: int) -> ExitReceipt:
        self.close_stdin()
        while not all(self.eof.values()) or self.child.poll() is None:
            self.pump(deadline)
        code = self.child.wait(timeout=0)
        self.selector.close()
        self.budget.check(deadline)
        return ExitReceipt(
            code, self.eof["stdout"], self.eof["stderr"], True, self.forced
        )

    def terminate(self, deadline: int) -> None:
        self.forced = True
        if self.child.returncode is None:
            try:
                os.killpg(self.child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        self.finish(deadline)


def run_command(
    argv: list[str],
    budget: Budget,
    deadline: int,
    output_bound: int = 1048576,
    record: Callable[[str, bytes], object] | None = None,
) -> bytes:
    budget.check(deadline)
    process = OwnedProcess(argv, budget, output_bound, output_bound)
    try:
        receipt = process.finish(deadline)
        if receipt.exit_code != 0:
            raise RuntimeError("Supervisor: MANAGER_EXIT")
        return bytes(process.stdout)
    except BaseException:
        process.terminate(budget.total_ns)
        raise
    finally:
        if record is not None:
            record("stdout", bytes(process.stdout))
            record("stderr", bytes(process.stderr))
            record(
                "receipt",
                json.dumps(
                    {
                        "exitCode": process.child.returncode,
                        "eof": process.eof,
                        "forced": process.forced,
                        "receivedBytes": process.counts,
                        "retainedBytes": {
                            "stdout": len(process.stdout),
                            "stderr": len(process.stderr),
                        },
                    }
                ).encode(),
            )


class Attachment(Protocol):
    def send(self, data: bytes, deadline: int) -> None: ...
    def line(self, deadline: int, frame_bound: int) -> tuple[bytes, int]: ...
    def finish(self, deadline: int) -> ExitReceipt: ...
    def terminate(self, deadline: int) -> None: ...
    def pending_stdout(self) -> bool: ...


class Manager(Protocol):
    def create(self, spec: JobSpec, budget: Budget) -> str: ...
    def attach(self, identity: str, spec: JobSpec, budget: Budget) -> Attachment: ...
    def inspect(self, identity: str, budget: Budget, deadline: int) -> dict: ...
    def remove(self, identity: str, budget: Budget, force: bool) -> None: ...


class DockerManager:
    def __init__(self, executable: str, config_directory: Path):
        if not Path(executable).is_absolute() or not config_directory.is_absolute():
            raise ValueError("Supervisor: MANAGER_PATH")
        self.executable = executable
        self.config_directory = config_directory
        self.spec: JobSpec | None = None
        self.identity: str | None = None
        self.evidence: AttemptEvidence | None = None
        self.command_ordinal = 0

    def _argv(self, *arguments: str) -> list[str]:
        return [
            self.executable,
            "--config",
            str(self.config_directory),
            "--host",
            "unix:///var/run/docker.sock",
            *arguments,
        ]

    def _run(self, argv: list[str], budget: Budget, deadline: int) -> bytes:
        prefix = f"manager-{self.command_ordinal:03d}"
        self.command_ordinal += 1
        record = None
        if self.evidence is not None and not self.evidence.failed:
            self.evidence.write(prefix + "-command", json.dumps(argv).encode())
            record = lambda role, payload: self.evidence.write(
                prefix + "-" + role, payload
            )
        return run_command(argv, budget, deadline, record=record)

    def create_argv(self, spec: JobSpec) -> list[str]:
        spec.check()
        value = spec.limits
        return self._argv(
            "create",
            "--pull=never",
            f"--name={spec.name}",
            f"--label=chess-coach.attempt={spec.ownership_token}",
            "--interactive",
            "--network=none",
            "--read-only",
            "--user=1000:1000",
            "--cpu-period=100000",
            "--cpu-quota=400000",
            f"--cpuset-cpus={','.join(map(str, value.cpus))}",
            "--memory=8589934592",
            "--memory-swap=8589934592",
            "--pids-limit=512",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            "--restart=no",
            "--ipc=private",
            "--cgroupns=private",
            f"--cgroup-parent={spec.approved_cgroup_parent}",
            "--log-driver=none",
            f"--ulimit=nofile={value.nofile}:{value.nofile}",
            f"--ulimit=fsize={value.file_bytes}:{value.file_bytes}",
            f"--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=2147483648,nr_inodes={value.tmp_inodes}",
            "--entrypoint=/sbin/chess-init",
            spec.image,
            "-g",
            "--",
            "/usr/local/bin/bun",
            "--no-env-file",
            "--no-install",
            "/app/packages/runtime/src/job.ts",
            spec.session_id,
        )

    def create(self, spec: JobSpec, budget: Budget) -> str:
        if self.evidence is None or self.evidence.failed:
            raise RuntimeError("Supervisor: EVIDENCE_REQUIRED")
        if self.spec is not None:
            raise RuntimeError("Supervisor: NO_RETRY")
        self.spec = spec
        if not self.config_directory.is_dir() or any(self.config_directory.iterdir()):
            raise RuntimeError("Supervisor: ANONYMOUS_CONFIG")
        identity = (
            self._run(self.create_argv(spec), budget, budget.cold_ns)
            .decode("ascii")
            .strip()
        )
        if not re.fullmatch(r"[a-f0-9]{64}", identity):
            raise RuntimeError("Supervisor: CONTAINER_ID")
        self.identity = identity
        return identity

    def attach(self, identity: str, spec: JobSpec, budget: Budget) -> OwnedProcess:
        budget.check(budget.cold_ns)
        return OwnedProcess(
            self._argv("start", "--attach", "--interactive", identity),
            budget,
            spec.limits.stdout_bytes,
            spec.limits.stderr_bytes,
        )

    def inspect(self, identity: str, budget: Budget, deadline: int) -> dict:
        value = json.loads(self._run(self._argv("inspect", identity), budget, deadline))
        if type(value) is not list or len(value) != 1 or type(value[0]) is not dict:
            raise RuntimeError("Supervisor: INSPECT_SCHEMA")
        return value[0]

    def remove(self, identity: str, budget: Budget, force: bool) -> None:
        if self.spec is None or identity not in (self.spec.name, self.identity):
            raise RuntimeError("Supervisor: CLEANUP_OWNERSHIP")
        if identity == self.spec.name:
            value = self.inspect(identity, budget, budget.total_ns)
            if (
                value.get("Config", {}).get("Labels", {}).get("chess-coach.attempt")
                != self.spec.ownership_token
                or value.get("Image") != self.spec.image
            ):
                raise RuntimeError("Supervisor: CLEANUP_OWNERSHIP")
            identity = value["Id"]
        self._run(
            self._argv("rm", *(["--force"] if force else []), identity),
            budget,
            budget.total_ns,
        )


def check_inspection(value: dict, identity: str, spec: JobSpec, running: bool) -> int:
    if value.get("Id") != identity or value.get("Image") != spec.image:
        raise RuntimeError("Supervisor: MANAGER_IDENTITY")
    config, host, state = value["Config"], value["HostConfig"], value["State"]
    if config.get("User") != "1000:1000" or config.get("Entrypoint") != [
        "/sbin/chess-init"
    ]:
        raise RuntimeError("Supervisor: ENTRYPOINT")
    expected_command = [
        "-g",
        "--",
        "/usr/local/bin/bun",
        "--no-env-file",
        "--no-install",
        "/app/packages/runtime/src/job.ts",
        spec.session_id,
    ]
    if (
        config.get("Cmd") != expected_command
        or config.get("Labels", {}).get("chess-coach.attempt") != spec.ownership_token
    ):
        raise RuntimeError("Supervisor: COMMAND")
    expected = {
        "NetworkMode": "none",
        "ReadonlyRootfs": True,
        "CpuPeriod": 100000,
        "CpuQuota": 400000,
        "Memory": 8589934592,
        "MemorySwap": 8589934592,
        "PidsLimit": 512,
        "Privileged": False,
        "PidMode": "",
        "IpcMode": "private",
        "CgroupnsMode": "private",
        "CapAdd": None,
        "CapDrop": ["ALL"],
        "CgroupParent": spec.approved_cgroup_parent,
    }
    if any(host.get(key) != expected_value for key, expected_value in expected.items()):
        raise RuntimeError("Supervisor: MANAGER_POLICY")
    if (
        parse_cpu_set(host["CpusetCpus"]) != spec.limits.cpus
        or host.get("RestartPolicy", {}).get("Name") != "no"
    ):
        raise RuntimeError("Supervisor: MANAGER_POLICY")
    if (
        "no-new-privileges" not in host.get("SecurityOpt", [])
        or host.get("Binds")
        or host.get("Devices")
        or host.get("DeviceRequests")
    ):
        raise RuntimeError("Supervisor: MANAGER_POLICY")
    if host.get("Tmpfs") != {
        "/tmp": f"rw,nosuid,nodev,noexec,size=2147483648,nr_inodes={spec.limits.tmp_inodes}"
    }:
        raise RuntimeError("Supervisor: TMPFS_POLICY")
    for mount in value.get("Mounts", []):
        if mount.get("Type") != "tmpfs" or mount.get("Destination") != "/tmp":
            raise RuntimeError("Supervisor: MOUNT_POLICY")
    ulimits = {
        limit.get("Name"): (limit.get("Soft"), limit.get("Hard"))
        for limit in host.get("Ulimits", [])
    }
    if ulimits != {
        "nofile": (spec.limits.nofile, spec.limits.nofile),
        "fsize": (spec.limits.file_bytes, spec.limits.file_bytes),
    }:
        raise RuntimeError("Supervisor: ULIMIT_POLICY")
    if host.get("LogConfig", {}).get("Type") != "none":
        raise RuntimeError("Supervisor: LOG_POLICY")
    if (
        state.get("Running") is not running
        or state.get("OOMKilled")
        or state.get("Dead")
        or state.get("Error")
    ):
        raise RuntimeError("Supervisor: MANAGER_STATE")
    if not running and state.get("ExitCode") != 0:
        raise RuntimeError("Supervisor: JOB_EXIT")
    return state.get("Pid", 0)


def _frame(raw: bytes, spec: JobSpec, kind: str) -> dict:
    value = json.loads(raw)
    keys = {"version", "sessionId", "kind"} | (
        {"boundaries"} if kind == "native-proof-complete" else set()
    )
    if (
        type(value) is not dict
        or set(value) != keys
        or value.get("version") != "chess-coach.job.v1"
        or value.get("sessionId") != spec.session_id
        or value.get("kind") != kind
    ):
        raise RuntimeError("Supervisor: JOB_FRAME")
    if kind == "native-proof-complete" and value["boundaries"] != list(
        spec.expected_boundaries
    ):
        raise RuntimeError("Supervisor: BOUNDARY_EXPECTATIONS")
    return value


def _supervise_native(
    spec: JobSpec,
    manager: Manager,
    observer: ReadOnlyCgroupObserver,
    budget: Budget,
    evidence: AttemptEvidence,
) -> dict:
    clock = budget.clock
    identity, attachment, binding = spec.name, None, None
    created = False
    try:
        spec.check()
        budget.check(budget.cold_ns)
        evidence.write(
            "started",
            json.dumps({"originNs": budget.origin_ns, "spec": asdict(spec)}).encode(),
        )
        created = True
        identity = manager.create(spec, budget)
        attachment = manager.attach(identity, spec, budget)
        raw, received = attachment.line(budget.cold_ns, spec.limits.frame_bytes)
        evidence.write("boot-frame", raw)
        budget.check(budget.cold_ns)
        if (
            received < budget.origin_ns
            or received >= budget.cold_ns
            or received > clock()
        ):
            raise RuntimeError("Supervisor: RECEIPT_DEADLINE")
        _frame(raw, spec, "boot")
        inspected = manager.inspect(identity, budget, budget.cold_ns)
        pid = check_inspection(inspected, identity, spec, True)
        binding = observer.bind(pid, spec.approved_cgroup_parent, spec.limits)
        evidence.write(
            "admitted",
            json.dumps(
                {
                    "pid": pid,
                    "cgroup": str(binding.relative),
                    "members": sorted(observer.members(binding)),
                }
            ).encode(),
        )
        budget.check(budget.cold_ns)
        attachment.send(
            json.dumps(
                {
                    "version": "chess-coach.job.v1",
                    "sessionId": spec.session_id,
                    "operation": "native-proof",
                }
            ).encode()
            + b"\n",
            budget.cold_ns,
        )
        raw, received = attachment.line(budget.cold_ns, spec.limits.frame_bytes)
        evidence.write("proof-frame", raw)
        budget.check(budget.cold_ns)
        if (
            received < budget.origin_ns
            or received >= budget.cold_ns
            or received > clock()
        ):
            raise RuntimeError("Supervisor: RECEIPT_DEADLINE")
        _frame(raw, spec, "native-proof-complete")
        receipt = attachment.finish(budget.work_ns)
        if attachment.pending_stdout():
            raise RuntimeError("Supervisor: TRAILING_OUTPUT")
        if receipt != ExitReceipt(0, True, True, True, False):
            raise RuntimeError("Supervisor: CLEAN_EXIT")
        evidence.write("job-exit", json.dumps(asdict(receipt)).encode())
        if hasattr(attachment, "stderr"):
            evidence.write("job-stderr", bytes(attachment.stderr))
        check_inspection(
            manager.inspect(identity, budget, budget.work_ns), identity, spec, False
        )
        manager.remove(identity, budget, False)
        budget.check(budget.total_ns)
        if not observer.gone(binding):
            raise RuntimeError("Supervisor: CGROUP_REMAINS")
        evidence.write(
            "cleanup-observed",
            json.dumps({"cgroup": str(binding.relative), "gone": True}).encode(),
        )
        completed = budget.check(budget.total_ns)
        return {
            "scope": "NATIVE_PROOF_ATTEMPT",
            "originNs": budget.origin_ns,
            "completedNs": completed,
            "boundaries": list(spec.expected_boundaries),
        }
    except BaseException as error:
        failures = []
        if not evidence.failed:
            try:
                evidence.write(
                    "failure",
                    json.dumps(
                        {
                            "type": type(error).__name__,
                            "message": str(error),
                            "originNs": budget.origin_ns,
                            "observedNs": clock(),
                        }
                    ).encode(),
                )
                if attachment is not None and hasattr(attachment, "stdout"):
                    evidence.write("failed-job-stdout-prefix", bytes(attachment.stdout))
                    evidence.write("failed-job-stderr-prefix", bytes(attachment.stderr))
            except BaseException as storage:
                failures.append(storage)
        if created:
            try:
                manager.remove(identity, budget, True)
            except BaseException as cleanup:
                failures.append(cleanup)
        if attachment is not None:
            try:
                attachment.terminate(budget.total_ns)
            except BaseException as cleanup:
                failures.append(cleanup)
        if binding is not None:
            try:
                budget.check(budget.total_ns)
                if not observer.gone(binding):
                    raise RuntimeError("Supervisor: CLEANUP_CGROUP_REMAINS")
                budget.check(budget.total_ns)
            except BaseException as cleanup:
                failures.append(cleanup)
        if failures:
            raise BaseExceptionGroup(
                "Supervisor: FAILED_WITH_CLEANUP_ERRORS", [error, *failures]
            ) from error
        raise


class NativeSupervisor:
    def __init__(
        self,
        spec: JobSpec,
        manager: Manager,
        observer: ReadOnlyCgroupObserver,
        clock: Callable[[], int] = boottime_ns,
        packet: EvidencePacket | None = None,
    ):
        self.spec = spec
        self.manager = manager
        self.observer = observer
        self.clock = clock
        self.budget: Budget | None = None
        self.packet = packet

    def run(self) -> dict:
        if self.budget is not None:
            raise RuntimeError("Supervisor: NO_RETRY")
        self.budget = Budget(self.clock(), self.clock)
        if self.packet is None:
            raise RuntimeError("Supervisor: EVIDENCE_REQUIRED")
        evidence = self.packet.attempt(self.spec.session_id)
        if isinstance(self.manager, DockerManager):
            self.manager.evidence = evidence
        return _supervise_native(
            self.spec, self.manager, self.observer, self.budget, evidence
        )

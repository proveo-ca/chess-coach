# SPEC: _spec/runtime-protocol.puml, _spec/gate-closure.puml
import json
import sys
import tempfile
import unittest
from unittest.mock import patch
from dataclasses import replace
from pathlib import Path
from tooling.runtime.evidence import EvidencePacket
from tooling.runtime.evidence import AttemptEvidence

from tooling.runtime.supervise import (
    Budget,
    DockerManager,
    ExitReceipt,
    JobSpec,
    Limits,
    NativeSupervisor,
    ReadOnlyCgroupObserver,
    boottime_ns,
    parse_cpu_set,
    run_command,
)


class Clock:
    def __init__(self):
        self.value = 100

    def __call__(self):
        return self.value

    def step(self):
        self.value += 100_000_000


def job_spec():
    return JobSpec(
        name="chess-coach-synthetic",
        image="sha256:" + "a" * 64,
        session_id="synthetic",
        ownership_token="b" * 32,
        approved_cgroup_parent="/jobs",
        expected_boundaries=("c" * 64, "d" * 64, "e" * 64),
        limits=Limits.balanced((2, 4)),
    )


def inspected(spec, identity, running):
    return {
        "Id": identity,
        "Image": spec.image,
        "Config": {
            "User": "1000:1000",
            "Entrypoint": ["/sbin/chess-init"],
            "Cmd": [
                "-g",
                "--",
                "/usr/local/bin/bun",
                "--no-env-file",
                "--no-install",
                "/app/packages/runtime/src/job.ts",
                spec.session_id,
            ],
            "Labels": {"chess-coach.attempt": spec.ownership_token},
        },
        "HostConfig": {
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
            "CgroupParent": spec.approved_cgroup_parent,
            "CapAdd": None,
            "CapDrop": ["ALL"],
            "CpusetCpus": "2,4",
            "RestartPolicy": {"Name": "no"},
            "SecurityOpt": ["no-new-privileges"],
            "Binds": None,
            "Devices": [],
            "DeviceRequests": None,
            "Tmpfs": {"/tmp": "rw,nosuid,nodev,noexec,size=2147483648,nr_inodes=16384"},
            "Ulimits": [
                {"Name": "nofile", "Soft": 256, "Hard": 256},
                {"Name": "fsize", "Soft": 67108864, "Hard": 67108864},
            ],
            "LogConfig": {"Type": "none"},
        },
        "Mounts": [],
        "State": {
            "Running": running,
            "Pid": 123 if running else 0,
            "ExitCode": 0,
            "OOMKilled": False,
            "Dead": False,
            "Error": "",
        },
    }


class Fixture:
    def __init__(self):
        self.root = Path(
            tempfile.mkdtemp(prefix="chess-coach-ii-observer-", dir="/tmp/opencode")
        )
        self.proc = self.root / "proc"
        self.cgroups = self.root / "cgroup"
        self.job = self.cgroups / "jobs" / "owned"
        (self.proc / "123").mkdir(parents=True)
        self.job.mkdir(parents=True)
        (self.proc / "123" / "cgroup").write_text("0::/jobs/owned\n")
        for name, value in {
            "cpu.max": "400000 100000",
            "memory.max": "8589934592",
            "memory.swap.max": "0",
            "pids.max": "512",
            "cpuset.cpus.effective": "2,4",
            "cgroup.procs": "123\n124",
        }.items():
            (self.job / name).write_text(value + "\n")
        self.observer = ReadOnlyCgroupObserver(self.proc, self.cgroups)

    def remove_job(self):
        if self.job.exists():
            self.job.rename(self.root / "retained-removed-cgroup")


class FakeAttachment:
    def __init__(self, spec, clock):
        self.clock = clock
        self.frames = [
            {
                "version": "chess-coach.job.v1",
                "sessionId": spec.session_id,
                "kind": "boot",
            },
            {
                "version": "chess-coach.job.v1",
                "sessionId": spec.session_id,
                "kind": "native-proof-complete",
                "boundaries": list(spec.expected_boundaries),
            },
        ]
        self.receipt = ExitReceipt(0, True, True, True, False)
        self.sent = []
        self.terminated = 0
        self.late = False
        self.finish_late = False
        self.trailing = False

    def line(self, deadline, frame_bound):
        self.clock.step()
        if self.late:
            self.clock.value = deadline
        value = json.dumps(self.frames.pop(0)).encode()
        if len(value) > frame_bound:
            raise RuntimeError("synthetic frame bound")
        return value, self.clock()

    def send(self, data, deadline):
        self.sent.append(json.loads(data))
        self.clock.step()

    def finish(self, deadline):
        self.clock.step()
        if self.finish_late:
            self.clock.value = deadline
            raise RuntimeError("synthetic final reserve deadline")
        return self.receipt

    def terminate(self, deadline):
        self.terminated += 1

    def pending_stdout(self):
        return self.trailing


class FakeManager:
    def __init__(self, spec, fixture, clock):
        self.spec, self.fixture, self.clock = spec, fixture, clock
        self.attachment = FakeAttachment(spec, clock)
        self.identity = "f" * 64
        self.created = 0
        self.removals = []
        self.inspections = 0
        self.alter = None
        self.remains = False
        self.create_error = False

    def create(self, spec, budget):
        self.created += 1
        self.clock.step()
        if self.create_error:
            raise RuntimeError("synthetic create failure")
        return self.identity

    def attach(self, identity, spec, budget):
        self.clock.step()
        return self.attachment

    def inspect(self, identity, budget, deadline):
        self.inspections += 1
        self.clock.step()
        value = inspected(self.spec, identity, self.inspections == 1)
        if self.alter:
            self.alter(value)
        return value

    def remove(self, identity, budget, force):
        self.removals.append((identity, force))
        self.clock.step()
        if not self.remains:
            self.fixture.remove_job()


class SupervisorTests(unittest.TestCase):
    def setup_job(self):
        spec, fixture, clock = job_spec(), Fixture(), Clock()
        manager = FakeManager(spec, fixture, clock)
        return (
            NativeSupervisor(
                spec,
                manager,
                fixture.observer,
                clock,
                EvidencePacket(fixture.root / "evidence"),
            ),
            manager,
            fixture,
            clock,
        )

    def test_fake_manager_positive_requires_close_reap_and_independent_cgroup_absence(
        self,
    ):
        supervisor, manager, fixture, clock = self.setup_job()
        result = supervisor.run()
        self.assertEqual(result["originNs"], 100)
        self.assertEqual(result["boundaries"], list(job_spec().expected_boundaries))
        self.assertEqual(manager.created, 1)
        self.assertEqual(manager.removals, [(manager.identity, False)])
        self.assertEqual(manager.attachment.terminated, 0)
        self.assertFalse(fixture.job.exists())
        self.assertEqual(manager.attachment.sent[0]["operation"], "native-proof")
        self.assertLess(clock(), supervisor.budget.cold_ns)
        with self.assertRaisesRegex(RuntimeError, "NO_RETRY"):
            supervisor.run()
        self.assertEqual(manager.created, 1)

    def test_exact_deadline_and_final_cleanup_reserve_cannot_renew_origin(self):
        for stage in ("cold", "reserve"):
            with self.subTest(stage=stage):
                supervisor, manager, _, _ = self.setup_job()
                if stage == "cold":
                    manager.attachment.late = True
                else:
                    manager.attachment.finish_late = True
                with self.assertRaises(RuntimeError):
                    supervisor.run()
                self.assertEqual(supervisor.budget.origin_ns, 100)
                self.assertEqual(manager.created, 1)
                self.assertEqual(manager.removals[-1], (manager.identity, True))
                self.assertEqual(manager.attachment.terminated, 1)
                with self.assertRaisesRegex(RuntimeError, "NO_RETRY"):
                    supervisor.run()

    def test_job_claims_and_manager_controls_fail_closed(self):
        for kind in (
            "boundaries",
            "session",
            "authority",
            "image",
            "cpu",
            "swap",
            "mount",
            "command",
            "tmpfs",
            "fd",
        ):
            with self.subTest(kind=kind):
                supervisor, manager, _, _ = self.setup_job()
                if kind == "boundaries":
                    manager.attachment.frames[1]["boundaries"][0] = "0" * 64
                elif kind == "session":
                    manager.attachment.frames[0]["sessionId"] = "other"
                elif kind == "authority":
                    manager.attachment.frames[0]["trainingReady"] = True
                else:

                    def alter(value):
                        if kind == "image":
                            value["Image"] = "sha256:" + "0" * 64
                        elif kind == "cpu":
                            value["HostConfig"]["CpusetCpus"] = "2"
                        elif kind == "swap":
                            value["HostConfig"]["MemorySwap"] += 1
                        elif kind == "mount":
                            value["Mounts"] = [{"Type": "bind", "Destination": "/home"}]
                        elif kind == "command":
                            value["Config"]["Cmd"] = ["/other"]
                        elif kind == "tmpfs":
                            value["HostConfig"]["Tmpfs"] = {}
                        elif kind == "fd":
                            value["HostConfig"]["Ulimits"] = []

                    manager.alter = alter
                with self.assertRaises(RuntimeError):
                    supervisor.run()
                self.assertTrue(manager.removals[-1][1])

    def test_clean_exit_and_remove_claims_cannot_hide_a_live_cgroup(self):
        supervisor, manager, _, _ = self.setup_job()
        manager.remains = True
        with self.assertRaises(BaseExceptionGroup) as caught:
            supervisor.run()
        self.assertIn("CGROUP_REMAINS", str(caught.exception.exceptions[0]))
        self.assertTrue(manager.removals[-1][1])

    def test_trailing_output_after_completion_is_not_a_clean_positive(self):
        supervisor, manager, _, _ = self.setup_job()
        manager.attachment.trailing = True
        with self.assertRaisesRegex(RuntimeError, "TRAILING_OUTPUT"):
            supervisor.run()

    def test_storage_failure_before_launch_consumes_attempt_without_creating_a_job(
        self,
    ):
        supervisor, manager, fixture, _ = self.setup_job()
        supervisor.packet = EvidencePacket(
            fixture.root / "small-evidence", 8, 16, 16, 8
        )
        with self.assertRaisesRegex(RuntimeError, "BYTE_BOUND"):
            supervisor.run()
        self.assertEqual(manager.created, 0)
        self.assertEqual(manager.removals, [])
        with self.assertRaisesRegex(RuntimeError, "NO_RETRY"):
            supervisor.run()

    def test_storage_failure_after_launch_still_stops_the_owned_job_and_preserves_started(
        self,
    ):
        supervisor, manager, fixture, _ = self.setup_job()
        original = AttemptEvidence.write

        def write(attempt, role, payload):
            if role == "proof-frame":
                attempt.packet.failed = True
                raise OSError("synthetic evidence failure")
            return original(attempt, role, payload)

        with patch.object(AttemptEvidence, "write", write):
            with self.assertRaisesRegex(OSError, "evidence failure"):
                supervisor.run()
        self.assertTrue(manager.removals[-1][1])
        self.assertEqual(manager.attachment.terminated, 1)
        self.assertTrue(
            any((fixture.root / "evidence").glob("attempt-*/*-started.bin"))
        )

    def test_c9_profile_substitution_and_unowned_name_collision_cannot_weaken_or_remove(
        self,
    ):
        with self.assertRaisesRegex(ValueError, "C9_PROFILE"):
            replace(job_spec().limits, nofile=512).check()
        manager = DockerManager("/selected/docker", Path("/selected/empty-config"))
        manager.spec = job_spec()
        wrong = inspected(job_spec(), "f" * 64, False)
        wrong["Config"]["Labels"]["chess-coach.attempt"] = "0" * 32
        clock = Clock()
        budget = Budget(clock(), clock)
        with (
            patch.object(manager, "inspect", return_value=wrong),
            patch.object(manager, "_run") as run,
        ):
            with self.assertRaisesRegex(RuntimeError, "CLEANUP_OWNERSHIP"):
                manager.remove(job_spec().name, budget, True)
            run.assert_not_called()

    def test_nonzero_forced_or_incomplete_lifecycle_cannot_pass(self):
        for receipt in (
            ExitReceipt(1, True, True, True, False),
            ExitReceipt(0, False, True, True, False),
            ExitReceipt(0, True, False, True, False),
            ExitReceipt(0, True, True, False, False),
            ExitReceipt(0, True, True, True, True),
        ):
            supervisor, manager, _, _ = self.setup_job()
            manager.attachment.receipt = receipt
            with self.assertRaisesRegex(RuntimeError, "CLEAN_EXIT"):
                supervisor.run()

    def test_partial_create_failure_preserves_original_attempt_and_cleanup_name(self):
        supervisor, manager, _, _ = self.setup_job()
        manager.create_error = True
        with self.assertRaisesRegex(RuntimeError, "create failure"):
            supervisor.run()
        self.assertEqual(manager.removals, [(supervisor.spec.name, True)])
        self.assertEqual(manager.created, 1)

    def test_c2_command_has_no_host_mount_socket_daemon_init_or_retry(self):
        command = DockerManager(
            "/selected/docker", Path("/selected/empty-config")
        ).create_argv(job_spec())
        for expected in (
            "--network=none",
            "--read-only",
            "--cpu-quota=400000",
            "--memory=8589934592",
            "--memory-swap=8589934592",
            "--pids-limit=512",
            "--cpuset-cpus=2,4",
            "--entrypoint=/sbin/chess-init",
            "--pull=never",
        ):
            self.assertIn(expected, command)
        for forbidden in (
            "--init",
            "--privileged",
            "--volume",
            "--mount",
            "--pid=host",
            "--network=host",
        ):
            self.assertNotIn(forbidden, command)


class ObserverTests(unittest.TestCase):
    def test_bound_observer_checks_descendants_and_never_treats_empty_as_gone(self):
        fixture = Fixture()
        child = fixture.job / "child"
        child.mkdir()
        (child / "cgroup.procs").write_text("125\n")
        binding = fixture.observer.bind(123, "/jobs", job_spec().limits)
        self.assertEqual(fixture.observer.members(binding), {123, 124, 125})
        (fixture.job / "cgroup.procs").write_text("")
        (child / "cgroup.procs").write_text("")
        self.assertFalse(fixture.observer.gone(binding))
        fixture.remove_job()
        self.assertTrue(fixture.observer.gone(binding))

    def test_wrong_parent_membership_effective_limits_and_symlinks_fail(self):
        for kind in ("parent", "pid", "cpu", "swap", "quota", "symlink"):
            with self.subTest(kind=kind):
                fixture = Fixture()
                if kind == "parent":
                    (fixture.proc / "123" / "cgroup").write_text("0::/other/job\n")
                elif kind == "pid":
                    (fixture.job / "cgroup.procs").write_text("124\n")
                elif kind == "cpu":
                    (fixture.job / "cpuset.cpus.effective").write_text("2-4")
                elif kind == "swap":
                    (fixture.job / "memory.swap.max").write_text("max")
                elif kind == "quota":
                    (fixture.job / "cpu.max").write_text("max 100000")
                else:
                    (fixture.job / "link").symlink_to(fixture.root)
                with self.assertRaises(RuntimeError):
                    fixture.observer.bind(123, "/jobs", job_spec().limits)

    def test_observation_root_loss_cannot_be_reported_as_owned_job_disappearance(self):
        fixture = Fixture()
        binding = fixture.observer.bind(123, "/jobs", job_spec().limits)
        fixture.cgroups.rename(fixture.root / "retained-old-root")
        fixture.cgroups.mkdir()
        (fixture.cgroups / "jobs").mkdir()
        with self.assertRaisesRegex(RuntimeError, "OBSERVATION_ROOT_CHANGED"):
            fixture.observer.gone(binding)

    def test_cpu_sets_are_explicit_bounded_and_never_derived_from_quota(self):
        self.assertEqual(parse_cpu_set("2,4-5"), (2, 4, 5))
        for value in ("", "0-999999999", "4-2", "-1", "0,1,2,3,4,5,6,7,8,9,10,11,12"):
            with self.assertRaises(ValueError):
                parse_cpu_set(value)
        with self.assertRaises(ValueError):
            replace(job_spec().limits, cpus=()).check()


class ProcessTests(unittest.TestCase):
    def test_standard_process_pipes_reap_and_bounded_output_use_synthetic_tools_only(
        self,
    ):
        budget = Budget(boottime_ns(), boottime_ns)
        self.assertEqual(
            run_command(
                [sys.executable, "-c", "print('synthetic')"], budget, budget.cold_ns
            ),
            b"synthetic\n",
        )
        with self.assertRaisesRegex(RuntimeError, "MANAGER_EXIT"):
            run_command(
                [sys.executable, "-c", "raise SystemExit(7)"], budget, budget.cold_ns
            )
        with self.assertRaisesRegex(RuntimeError, "STDOUT_BOUND"):
            run_command(
                [sys.executable, "-c", "print('x'*4096)"], budget, budget.cold_ns, 1024
            )


if __name__ == "__main__":
    unittest.main()

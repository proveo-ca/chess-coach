# SPEC: _spec/host-entrypoint.puml, _spec/gpu-readiness.puml
from contextlib import nullcontext
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import tomllib
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from tooling.runtime.host_preflight import (
    HOST_FILES,
    NVIDIA_QUERY,
    collect,
    filesystem_metadata,
    gpu_metadata,
    host_facts,
    metadata_text,
    mount_projection,
)


def fixture(directory):
    root = Path(directory)
    source, parent = root / "source", root / "private-parent"
    source.mkdir(mode=0o700)
    parent.mkdir(mode=0o700)
    files = {
        "/proc/meminfo": "MemTotal: 16000000 kB\nMemAvailable: 12000000 kB\nSwapTotal: 0 kB\nSwapFree: 0 kB\nIgnored: private\n",
        "/sys/devices/system/cpu/online": "0-15\n",
        "/sys/devices/system/cpu/present": "0-15\n",
        "/proc/self/cgroup": "0::/synthetic-self\n",
        "/proc/self/mountinfo": "1 0 8:1 / / rw,nosuid - ext4 /dev/synthetic rw,credential=NOT_RETAINED\n",
    }
    return source, parent, files


class HostAdmissionTests(unittest.TestCase):
    def test_host_facts_project_only_selected_metadata_and_create_nothing(self):
        with tempfile.TemporaryDirectory(
            prefix="chess-coach-admission-", dir="/tmp/opencode"
        ) as root:
            source, parent, files = fixture(root)
            result = {}
            with (
                patch(
                    "tooling.runtime.host_preflight.metadata_text",
                    side_effect=lambda path, *args: files[path],
                ) as read,
                patch(
                    "tooling.runtime.host_preflight.os.sched_getaffinity",
                    return_value={2, 3, 4, 5},
                ),
                patch(
                    "tooling.runtime.host_preflight.gpu_metadata",
                    return_value={"qualification": "NOT_QUALIFIED"},
                ),
            ):
                host_facts(result, str(parent), source)
            self.assertEqual(
                [call.args[0] for call in read.call_args_list],
                [*HOST_FILES, "/proc/self/mountinfo"],
            )
            self.assertEqual(result["selfAffinityCpuIds"], [2, 3, 4, 5])
            self.assertEqual(
                result["observed"]["/proc/meminfo"]["MemTotalBytes"], 16_384_000_000
            )
            self.assertEqual(len(result["observed"]["/proc/meminfo"]), 4)
            self.assertEqual(
                result["filesystems"]["stateParent"]["mount"]["filesystemType"], "ext4"
            )
            self.assertEqual(
                result["observation"], "POINT_IN_TIME_NOT_CAPACITY_RESERVATION"
            )
            self.assertFalse(result["runtimeAdmissionQualified"])
            self.assertEqual(list(parent.iterdir()), [])
            self.assertNotIn("credential", json.dumps(result))

    def test_default_state_parent_uses_the_named_xdg_projection_without_creating_it(
        self,
    ):
        with tempfile.TemporaryDirectory(
            prefix="chess-coach-admission-xdg-", dir="/tmp/opencode"
        ) as root:
            source, parent, files = fixture(root)
            result = {}
            with (
                patch.dict(os.environ, {"XDG_STATE_HOME": str(parent)}),
                patch(
                    "tooling.runtime.host_preflight.metadata_text",
                    side_effect=lambda path, *args: files[path],
                ),
                patch(
                    "tooling.runtime.host_preflight.os.sched_getaffinity",
                    return_value={0},
                ),
                patch(
                    "tooling.runtime.host_preflight.gpu_metadata",
                    return_value={"qualification": "NOT_QUALIFIED"},
                ),
            ):
                host_facts(result, None, source)
            self.assertEqual(result["selection"]["stateParent"], str(parent))
            self.assertEqual(list(parent.iterdir()), [])

    def test_forced_gpu_query_cannot_be_reported_as_a_successful_metadata_packet(self):
        with tempfile.TemporaryDirectory(
            prefix="chess-coach-admission-gpu-failure-", dir="/tmp/opencode"
        ) as root:
            source, parent, files = fixture(root)
            result = {}
            with (
                patch(
                    "tooling.runtime.host_preflight.metadata_text",
                    side_effect=lambda path, *args: files[path],
                ),
                patch(
                    "tooling.runtime.host_preflight.os.sched_getaffinity",
                    return_value={0},
                ),
                patch(
                    "tooling.runtime.host_preflight.gpu_metadata",
                    return_value={
                        "nvidiaSmi": {"query": {"forced": True, "reaped": True}}
                    },
                ),
            ):
                with self.assertRaisesRegex(ValueError, "GPU_METADATA_QUERY_FAILED"):
                    host_facts(result, str(parent), source)
            self.assertIn("filesystems", result)
            self.assertTrue(result["gpu"]["nvidiaSmi"]["query"]["forced"])

    def test_source_overlap_relative_parent_and_symlinks_are_not_substituted(self):
        with tempfile.TemporaryDirectory(
            prefix="chess-coach-admission-path-", dir="/tmp/opencode"
        ) as root:
            source, parent, _ = fixture(root)
            for selected in (
                str(source),
                str(source / "state"),
                str(source.parent),
                "relative",
                str(parent / ".."),
            ):
                with self.assertRaises(ValueError):
                    host_facts({}, selected, source)
            alias = Path(root) / "alias"
            alias.symlink_to(parent)
            with self.assertRaisesRegex(ValueError, "NONSYMLINK"):
                filesystem_metadata(alias)
            with self.assertRaises(FileNotFoundError):
                filesystem_metadata(parent / "missing")
            self.assertEqual(list(parent.iterdir()), [])

    def test_raw_metadata_read_has_a_byte_guard(self):
        with tempfile.TemporaryDirectory(
            prefix="chess-coach-admission-read-", dir="/tmp/opencode"
        ) as root:
            path = Path(root) / "synthetic"
            path.write_bytes(b"12345")
            self.assertEqual(metadata_text(str(path), 5), "12345")
            with self.assertRaisesRegex(ValueError, "FILE_BYTE_BOUND"):
                metadata_text(str(path), 4)

    def test_mount_projection_uses_the_longest_path_and_omits_sources_and_superoptions(
        self,
    ):
        text = "1 0 8:1 / / rw - ext4 /dev/private rw,credential=NOT_RETAINED\n2 1 8:2 / /state\\040disk rw - xfs /dev/private2 rw,secret=NOT_RETAINED\n"
        result = mount_projection(text, Path("/state disk/private"))
        self.assertEqual(
            result,
            {
                "mountpoint": "/state disk",
                "majorMinor": "8:2",
                "filesystemType": "xfs",
                "mountOptions": "rw",
            },
        )
        with self.assertRaisesRegex(ValueError, "MOUNTINFO"):
            mount_projection("malformed", Path("/state"))

    def test_gpu_metadata_never_treats_missing_tools_as_no_gpu(self):
        with (
            patch(
                "tooling.runtime.host_preflight.os.scandir",
                return_value=nullcontext(iter([])),
            ),
            patch("tooling.runtime.host_preflight.shutil.which", return_value=None),
            patch("tooling.runtime.host_preflight.query") as run,
        ):
            result = gpu_metadata()
        run.assert_not_called()
        self.assertEqual(result["qualification"], "NOT_QUALIFIED")
        self.assertEqual(
            result["nvidiaSmi"]["meaning"], "TOOL_ABSENT_NOT_PROOF_OF_NO_GPU"
        )

    def test_gpu_metadata_queries_only_the_fixed_nonprocess_nvidia_fields(self):
        with (
            patch(
                "tooling.runtime.host_preflight.os.scandir",
                return_value=nullcontext(iter([SimpleNamespace(name="card0")])),
            ),
            patch(
                "tooling.runtime.host_preflight.metadata_text",
                return_value="synthetic metadata\n",
            ) as read,
            patch(
                "tooling.runtime.host_preflight.os.readlink",
                return_value="/sys/bus/pci/drivers/nvidia",
            ),
            patch(
                "tooling.runtime.host_preflight.shutil.which",
                return_value="/fake/nvidia-smi",
            ),
            patch(
                "tooling.runtime.host_preflight.identity",
                return_value={"resolvedPath": "/fake/nvidia-smi"},
            ),
            patch(
                "tooling.runtime.host_preflight.query",
                return_value={"exitCode": 0, "forced": False, "reaped": True},
            ) as run,
        ):
            result = gpu_metadata()
        self.assertEqual(
            NVIDIA_QUERY,
            (
                "--query-gpu=index,uuid,name,memory.total,driver_version,pci.bus_id",
                "--format=csv,noheader,nounits",
            ),
        )
        self.assertEqual(run.call_args.args[0], ["/fake/nvidia-smi", *NVIDIA_QUERY])
        self.assertEqual(
            [call.args[0] for call in read.call_args_list],
            [
                "/sys/class/drm/card0/device/" + field
                for field in ("vendor", "device", "class", "mem_info_vram_total")
            ],
        )
        self.assertEqual(result["drmCards"][0]["driver"], "nvidia")
        self.assertEqual(result["qualification"], "NOT_QUALIFIED")

    def test_gpu_directory_entry_exhaustion_stops_before_any_driver_query(self):
        entries = [SimpleNamespace(name="not-a-card")] * 257
        with (
            patch(
                "tooling.runtime.host_preflight.os.scandir",
                return_value=nullcontext(iter(entries)),
            ),
            patch("tooling.runtime.host_preflight.query") as run,
        ):
            with self.assertRaisesRegex(ValueError, "DRM_ENTRY_BOUND"):
                gpu_metadata()
        run.assert_not_called()

    def test_gpu_card_exhaustion_does_not_query_or_scan_beyond_its_declared_cards(self):
        entries = [SimpleNamespace(name=f"card{ordinal}") for ordinal in range(17)]
        with (
            patch(
                "tooling.runtime.host_preflight.os.scandir",
                return_value=nullcontext(iter(entries)),
            ),
            patch(
                "tooling.runtime.host_preflight.metadata_text",
                return_value="synthetic metadata",
            ) as read,
            patch(
                "tooling.runtime.host_preflight.os.readlink",
                return_value="/synthetic/driver",
            ),
            patch("tooling.runtime.host_preflight.query") as run,
        ):
            with self.assertRaisesRegex(ValueError, "DRM_CARD_BOUND"):
                gpu_metadata()
        self.assertEqual(read.call_count, 16 * 4)
        run.assert_not_called()

    def test_admission_profile_uses_only_local_docker_client_version_and_retains_facts(
        self,
    ):
        def facts(result, parent):
            result.update(
                fixture="SYNTHETIC", runtimeAdmissionQualified=False, parent=parent
            )

        with (
            patch(
                "tooling.runtime.host_preflight.shutil.which",
                return_value="/fake/docker",
            ),
            patch(
                "tooling.runtime.host_preflight.identity",
                return_value={"resolvedPath": "/fake/docker"},
            ),
            patch(
                "tooling.runtime.host_preflight.query",
                return_value={"forced": False, "reaped": True},
            ) as run,
            patch("tooling.runtime.host_preflight.host_facts", side_effect=facts),
        ):
            result = collect(admission_facts=True, state_parent="/selected")
        self.assertEqual(run.call_args.args[0], ["/fake/docker", "--version"])
        self.assertEqual(result["hostFacts"]["parent"], "/selected")
        self.assertTrue(result["gpuLearningRequired"])
        self.assertEqual(result["gpuQualification"], "NOT_QUALIFIED")
        self.assertFalse(result["trainingReady"])

    def test_admission_failure_preserves_partial_metadata_and_no_followup_query(self):
        def facts(result, parent):
            result["selfAffinityCpuIds"] = [0]
            raise ValueError("synthetic missing parent")

        with (
            patch(
                "tooling.runtime.host_preflight.shutil.which",
                return_value="/fake/docker",
            ),
            patch(
                "tooling.runtime.host_preflight.identity",
                return_value={"resolvedPath": "/fake/docker"},
            ),
            patch(
                "tooling.runtime.host_preflight.query",
                return_value={"forced": False, "reaped": True},
            ) as run,
            patch("tooling.runtime.host_preflight.host_facts", side_effect=facts),
        ):
            result = collect(admission_facts=True)
        self.assertEqual(result["status"], "BLOCKED")
        self.assertEqual(result["hostFacts"]["selfAffinityCpuIds"], [0])
        self.assertIn("missing parent", result["hostFacts"]["error"])
        self.assertEqual(run.call_count, 0)

    def test_missing_docker_does_not_discard_already_collected_hardware_facts(self):
        def facts(result, parent):
            result["fixture"] = "SYNTHETIC_HARDWARE_FACTS"

        with (
            patch("tooling.runtime.host_preflight.shutil.which", return_value=None),
            patch("tooling.runtime.host_preflight.query") as run,
            patch("tooling.runtime.host_preflight.host_facts", side_effect=facts),
        ):
            result = collect(admission_facts=True)
        self.assertEqual(result["status"], "BLOCKED")
        self.assertEqual(result["hostFacts"]["fixture"], "SYNTHETIC_HARDWARE_FACTS")
        self.assertIn("MISSING_DOCKER", result["tools"]["docker"]["error"])
        run.assert_not_called()

    def test_admission_profiles_and_parent_arguments_cannot_be_mixed(self):
        with self.assertRaises(ValueError):
            collect(True, admission_facts=True)
        with self.assertRaises(ValueError):
            collect(state_parent="/selected")
        result = subprocess.run(
            [
                sys.executable,
                "-I",
                "-B",
                "tooling/runtime/host_preflight.py",
                "--confirm-host",
                "--state-parent",
                "/selected",
            ],
            capture_output=True,
            timeout=5,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"requires --admission-facts", result.stderr)
        self.assertEqual(result.stdout, b"")

    def test_admission_cli_child_uses_fake_docker_and_synthetic_facts_not_host_hardware(
        self,
    ):
        with tempfile.TemporaryDirectory(
            prefix="chess-coach-admission-child-", dir="/tmp/opencode"
        ) as root:
            root = Path(root)
            docker = root / "docker"
            docker.write_text("#!/bin/sh\nprintf '%s\\n' 'synthetic Docker client'\n")
            docker.chmod(0o700)
            child = root / "synthetic-child.py"
            script = str(Path("tooling/runtime/host_preflight.py").resolve())
            child.write_text(
                "import runpy, sys\n"
                + f"module = runpy.run_path({script!r})\n"
                + "main = module['main']\n"
                + "main.__globals__['host_facts'] = lambda result, parent: result.update(fixture='SYNTHETIC_NO_HOST_METADATA_READ', runtimeAdmissionQualified=False)\n"
                + "sys.argv = ['host_preflight.py', '--confirm-host', '--admission-facts']\n"
                + "raise SystemExit(main())\n"
            )
            process = subprocess.run(
                [sys.executable, "-I", "-B", str(child)],
                env=dict(os.environ, PATH=f"{root}:/usr/bin:/bin"),
                stdin=subprocess.DEVNULL,
                capture_output=True,
                timeout=10,
            )
            self.assertEqual(process.returncode, 0, process.stderr.decode())
            result = json.loads(process.stdout)
            self.assertEqual(
                result["tools"]["docker"]["query"]["command"],
                [str(docker), "--version"],
            )
            self.assertEqual(
                result["hostFacts"]["fixture"], "SYNTHETIC_NO_HOST_METADATA_READ"
            )
            self.assertEqual(result["gpuQualification"], "NOT_QUALIFIED")
            self.assertFalse(result["trainingReady"])

    def test_admission_task_has_no_creation_training_or_install_dependencies(self):
        config = tomllib.loads(Path("mise.toml").read_text())
        task = config["tasks"]["host:admission-facts"]
        self.assertEqual(
            task["run"],
            "python3 -I -B tooling/runtime/host_preflight.py --admission-facts",
        )
        self.assertTrue(task["raw"])
        self.assertTrue(task["raw_args"])
        self.assertLessEqual(
            set(task), {"description", "raw_args", "raw", "quiet", "env", "run"}
        )
        self.assertFalse(config["settings"]["auto_install"])

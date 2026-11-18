// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
use chess_coach_gpu_owner::{
    RawLaunchRequest, Report,
    input::OwnerInput,
    linux::{Boottime, Clock, LinuxWaiter, Waiter, Watch},
};
use rustix::event::PollFlags;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    cell::Cell,
    fs::{self, DirBuilder, OpenOptions},
    io::Write,
    os::unix::{fs::DirBuilderExt, fs::PermissionsExt, net::UnixListener},
    path::{Path, PathBuf},
    process::Command,
};
use tempfile::TempDir;

pub const UUID: &str = "GPU-11111111-1111-1111-1111-111111111111";
const BUN: &str = "/usr/local/bin/bun";
const DOCKER_SCRIPT: &str = include_str!("fake-docker.ts");
const TELEMETRY_SCRIPT: &str = include_str!("fake-telemetry.ts");

pub fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn private_directory(path: &Path) {
    DirBuilder::new()
        .recursive(true)
        .mode(0o700)
        .create(path)
        .unwrap();
    fs::set_permissions(path, fs::Permissions::from_mode(0o700)).unwrap();
}

fn write_new(path: &Path, bytes: &[u8], mode: u32) {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .unwrap();
    file.write_all(bytes).unwrap();
    file.set_permissions(fs::Permissions::from_mode(mode))
        .unwrap();
}

fn file_expectation(path: &Path, bytes: &[u8]) -> Value {
    json!({"path": path, "byteLength": bytes.len(), "sha256": sha256(bytes)})
}

fn cgroup(path: &Path, quota: u64, memory: u64, cpus: &str, procs: &str) {
    private_directory(path);
    for (name, value) in [
        ("cpu.max", format!("{quota} 100000\n")),
        ("memory.max", format!("{memory}\n")),
        ("memory.swap.max", "0\n".into()),
        ("pids.max", "512\n".into()),
        ("cpuset.cpus.effective", format!("{cpus}\n")),
        ("cgroup.procs", procs.into()),
        ("cgroup.threads", procs.into()),
    ] {
        write_new(&path.join(name), value.as_bytes(), 0o600);
    }
}

struct PrivateRoot(Option<TempDir>);

impl Drop for PrivateRoot {
    fn drop(&mut self) {
        if std::thread::panicking()
            && let Some(temp) = self.0.take()
        {
            eprintln!("preserved lifecycle fixture: {}", temp.keep().display());
        }
    }
}

pub struct Fixture {
    _temp: PrivateRoot,
    _endpoint: UnixListener,
    pub root: PathBuf,
    pub registration: Value,
    pub manifest: Value,
    pub config: Value,
}

impl Fixture {
    pub fn new(mode: &str) -> Self {
        let repo = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .canonicalize()
            .unwrap();
        let scratch = repo.join("_work/gpu-owner-recovery/scratch");
        private_directory(&scratch);
        let temp = PrivateRoot(Some(
            tempfile::Builder::new()
                .prefix("lc-")
                .tempdir_in(scratch)
                .unwrap(),
        ));
        let root = temp.0.as_ref().unwrap().path().to_owned();
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).unwrap();
        let bridge = root.join("bridge");
        private_directory(&bridge);
        let registration_output = bun_command(&root)
            .arg(repo.join("packages/runtime/tests/fixtures/gpu-owner/register.ts"))
            .arg(&bridge)
            .output()
            .unwrap();
        write_new(
            &root.join("registration.stdout"),
            &registration_output.stdout,
            0o600,
        );
        write_new(
            &root.join("registration.stderr"),
            &registration_output.stderr,
            0o600,
        );
        assert!(
            registration_output.status.success(),
            "registration failed at {}: {}",
            root.display(),
            String::from_utf8_lossy(&registration_output.stderr)
        );
        let registration: Value = serde_json::from_slice(&registration_output.stdout).unwrap();
        let proc_root = root.join("proc");
        let cgroup_root = root.join("cgroup");
        let aggregate = cgroup_root.join("aggregate");
        let outside = aggregate.join("control");
        let jobs = aggregate.join("jobs");
        private_directory(&proc_root.join(std::process::id().to_string()));
        write_new(
            &proc_root
                .join(std::process::id().to_string())
                .join("cgroup"),
            b"0::/aggregate/control\n",
            0o600,
        );
        cgroup(&aggregate, 500_000, 12_884_901_888, "0,1,2,3,4", "");
        cgroup(
            &outside,
            100_000,
            1_073_741_824,
            "0",
            &format!("{}\n", std::process::id()),
        );
        cgroup(&jobs, 400_000, 8_589_934_592, "1,2,3,4", "");
        let anonymous_config = root.join("anonymous-config");
        let state_source = root.join("state-source");
        private_directory(&anonymous_config);
        private_directory(&state_source);
        let endpoint = root.join("s");
        let listener = UnixListener::bind(&endpoint).unwrap();
        let unique = sha256(root.as_os_str().as_encoded_bytes());
        let token = &unique[..32];
        let image_id = format!("sha256:{}", "a".repeat(64));
        let mut input_json = registration["inputJson"].as_str().unwrap().to_owned();
        if mode == "premature-startup" {
            assert!(input_json.len() < 65_536);
            input_json.extend(std::iter::repeat_n(' ', 65_536 - input_json.len()));
        }
        let input_sha256 = sha256(input_json.as_bytes());
        let packet_root = root.join("outside-packet");
        let container_name = format!("chess-coach-synthetic-{}", &unique[..16]);
        let config = json!({
            "root": root, "mode": mode, "registration": registration, "imageId": image_id,
            "uuid": UUID, "token": token, "id": unique, "containerName": container_name,
            "inputSha256": input_sha256, "anonymousConfig": anonymous_config, "endpoint": endpoint,
            "stateSource": state_source, "procRoot": proc_root, "leaf": jobs.join("owned"),
            "preservedState": root.join("preserved-state"), "stateReplaced": root.join("state-replaced"),
            "cleanupInspection": root.join("cleanup-inspection"),
            "packetRoot": packet_root, "preservedPacket": root.join("preserved-packet"),
            "events": root.join("manager.jsonl"), "telemetryEvents": root.join("telemetry.jsonl"),
            "created": root.join("created"), "attachPid": root.join("attach-pid"),
            "driverPid": root.join("driver-pid"), "driverStdout": root.join("driver.stdout"),
            "driverStderr": root.join("driver.stderr"), "finished": root.join("driver-finished.json"),
            "inspectCount": root.join("inspect-count"), "removed": root.join("removed"),
            "prematureSent": root.join("premature-sent"), "evidenceFault": root.join("evidence-fault")
        });
        let docker_bytes = DOCKER_SCRIPT.replace(
            "__TRUSTED_FIXTURE_CONFIGURATION__",
            &serde_json::to_string(&config).unwrap(),
        );
        let telemetry_bytes = TELEMETRY_SCRIPT.replace(
            "__TRUSTED_FIXTURE_CONFIGURATION__",
            &serde_json::to_string(&config).unwrap(),
        );
        let docker_path = root.join("docker.ts");
        let telemetry_path = root.join("query.ts");
        write_new(&docker_path, docker_bytes.as_bytes(), 0o700);
        write_new(&telemetry_path, telemetry_bytes.as_bytes(), 0o700);
        let envelope = json!({"cpus": [0], "cpuQuota": 100000, "memoryMaxBytes": "1073741824",
            "aggregateParent": aggregate, "aggregateCpus": [0,1,2,3,4], "aggregateCpuQuota": 500000,
            "aggregateMemoryMaxBytes": "12884901888"});
        let admission = json!({"version": "chess-coach.outside-admission.v1", "expectedSelfEnvelope": envelope});
        let runtime = json!({"version": "chess-coach.gpu-runtime-closure.v1", "imageId": image_id,
            "selectedUuid": UUID, "profileMode": "legacy-nvidia-device-request.v1", "inputSha256": input_sha256});
        let telemetry = json!({"version": "chess-coach.telemetry-closure.v1",
            "executable": {"byteLength": telemetry_bytes.len(), "sha256": sha256(telemetry_bytes.as_bytes())},
            "expectedDriver": "999.0", "selectedUuid": UUID});
        let synthetic_library = b"SYNTHETIC_CPU_ONLY_NOT_CUDA";
        let injection = json!({"version": "chess-coach.gpu-injection.v1", "mode": "legacy", "selectedUuid": UUID,
            "devices": ["/dev/nvidia0", "/dev/nvidiactl"], "libraries": [{"containerPath": "/usr/lib/libcuda.so.1",
                "bytes": {"byteLength": synthetic_library.len(), "sha256": sha256(synthetic_library)}}], "inspectMounts": []});
        let provenance = |name: &str, value: &Value| {
            let path = root.join(name);
            let bytes = serde_json::to_vec(value).unwrap();
            write_new(&path, &bytes, 0o400);
            file_expectation(&path, &bytes)
        };
        let manifest = json!({
            "version": "chess-coach.gpu-owner.v1",
            "ownership": {"sessionId": registration["sessionId"], "attemptId": registration["attemptId"],
                "containerName": container_name, "ownershipToken": token},
            "outsideControl": {"admissionReceipt": provenance("admission.json", &admission), "expectedSelfEnvelope": envelope},
            "docker": {"executable": file_expectation(&docker_path, docker_bytes.as_bytes()),
                "anonymousConfigDirectory": anonymous_config, "endpointUnixSocket": endpoint, "cgroupParentArgument": "synthetic.slice"},
            "observation": {"procRoot": proc_root, "cgroupRoot": cgroup_root, "approvedJobParentAbsolutePath": jobs,
                "expectedOutsideControlCgroupAbsolutePath": outside},
            "job": {"imageId": image_id, "runtimeClosure": provenance("job-runtime.json", &runtime),
                "gpuProfile": {"mode": "legacy-nvidia-device-request.v1", "cpus": [1,2,3,4],
                    "injectionInventory": provenance("injection.json", &injection)},
                "stateHostSource": state_source, "jobInputJson": input_json,
                "jobInputRef": {"byteLength": input_json.len(), "sha256": input_sha256},
                "expectedDescriptorSha256": registration["expectedDescriptorSha256"], "initialModelId": registration["initialModelId"]},
            "cooperative": {"selectedUuid": UUID, "startupMinFreeBytes": "629145600", "runningStopBelowFreeBytes": "209715200",
                "samplePeriodNs": "2000000000", "maxSampleAgeNs": "3000000000"},
            "telemetry": {"kind": "registered-nvidia-smi-query.v1", "executable": file_expectation(&telemetry_path, telemetry_bytes.as_bytes()),
                "runtimeClosure": provenance("telemetry-runtime.json", &telemetry), "expectedDriver": "999.0",
                "queryBudgetNs": "500000000", "refreshIntervalNs": "500000000", "schedulingReserveNs": "100000000"},
            "evidence": {"exclusivePacketRoot": packet_root}
        });
        let bytes = serde_json::to_vec(&manifest).unwrap();
        let _ = OwnerInput::parse(&bytes, &sha256(&bytes)).unwrap();
        Self {
            _temp: temp,
            _endpoint: listener,
            root,
            registration,
            manifest,
            config,
        }
    }

    pub fn path(&self, key: &str) -> PathBuf {
        PathBuf::from(self.config[key].as_str().unwrap())
    }

    pub fn request(&self) -> RawLaunchRequest {
        let bytes = serde_json::to_vec(&self.manifest).unwrap();
        RawLaunchRequest {
            input_manifest: String::from_utf8(bytes.clone()).unwrap(),
            expected_manifest_sha256: sha256(&bytes),
        }
    }

    pub fn events(&self) -> Vec<Value> {
        let path = self.path("events");
        if !path.exists() {
            return vec![];
        }
        fs::read_to_string(path)
            .unwrap()
            .lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect()
    }

    pub fn frames(&self) -> Vec<Value> {
        fs::read_to_string(self.path("driverStdout"))
            .unwrap()
            .lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect()
    }

    pub fn assert_no_fixture_error(&self) {
        assert!(
            self.events().iter().all(|e| e["event"] != "fixture-error"),
            "fixture errors at {}: {:?}",
            self.root.display(),
            self.events()
        );
    }

    pub fn assert_helper_pids_gone(&self) {
        for event in self
            .events()
            .iter()
            .filter(|event| event["event"] == "invoke")
        {
            assert_pid_gone(event["pid"].as_u64().unwrap() as u32);
        }
        let telemetry = self.path("telemetryEvents");
        if telemetry.exists() {
            for line in fs::read_to_string(telemetry).unwrap().lines() {
                let event: Value = serde_json::from_str(line).unwrap();
                assert_pid_gone(event["pid"].as_u64().unwrap() as u32);
            }
        }
    }

    pub fn assert_no_work(&self) {
        assert!(!Path::new(self.registration["layout"]["stateRoot"].as_str().unwrap()).exists());
        assert!(!self.root.join("bridge/learner-a.started.json").exists());
        assert!(!self.root.join("bridge/learner-b.started.json").exists());
        assert!(!self.root.join("bridge/match.started.json").exists());
    }

    pub fn assert_completed(&self) {
        self.assert_no_fixture_error();
        let inspector = self.root.join("assert-completed.ts");
        write_new(&inspector, include_bytes!("assert-completed.ts"), 0o600);
        let output = bun_command(&self.root)
            .arg(inspector)
            .arg(self.registration["layoutPath"].as_str().unwrap())
            .output()
            .unwrap();
        write_new(&self.root.join("sqlite.stdout"), &output.stdout, 0o600);
        write_new(&self.root.join("sqlite.stderr"), &output.stderr, 0o600);
        assert!(
            output.status.success(),
            "SQLite inspection: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        let state: Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(
            state["attempts"],
            json!([{"id": self.registration["attemptId"], "ordinal": 0, "status": "COMPLETED"}])
        );
        assert_eq!(
            state["masters"],
            json!([{"master": 101, "pending": null, "status": "active"}])
        );
        assert_eq!(state["control"], json!({"aborted": 0}));
        assert_eq!(
            state["matchExit"],
            json!({"stdinClosed": true, "stdoutEof": true, "stderrEof": true, "reaped": true, "exitCode": 0, "forced": false})
        );
        assert_eq!(state["learnersClosed"]["kind"], "diagnostic");
        for name in ["learner-a", "learner-b", "match"] {
            let receipt = read_json(&self.root.join(format!("bridge/{name}.receipt.json")));
            assert_eq!(receipt["stdinEof"], true);
            assert_pid_gone(receipt["pid"].as_u64().unwrap() as u32);
            if name == "match" {
                assert_eq!(receipt["scores"], 0);
                assert_eq!(receipt["scorerClosed"], 1);
                assert_eq!(receipt["scorerStopped"], 0);
            } else {
                assert_eq!(receipt["events"], json!(["begin", "finish", "close"]));
                let attempt = Path::new(
                    self.registration["layout"]["factory"]["scratchRoot"]
                        .as_str()
                        .unwrap(),
                )
                .join(format!(
                    "attempt-{}",
                    self.registration["attemptId"].as_str().unwrap()
                ));
                assert_eq!(
                    receipt["configPath"],
                    attempt.join("config.json").to_str().unwrap()
                );
                assert_eq!(
                    receipt["recordPath"],
                    attempt.join("model.bpk").to_str().unwrap()
                );
            }
        }
        assert_eq!(
            fs::read_dir(
                self.registration["layout"]["factory"]["scratchRoot"]
                    .as_str()
                    .unwrap()
            )
            .unwrap()
            .count(),
            0
        );
        let finished = read_json(&self.path("finished"));
        assert_eq!(finished["exitCode"], 0);
        assert_eq!(finished["stdoutEof"], true);
        assert_eq!(finished["stderrEof"], true);
        assert_eq!(finished["reaped"], true);
        assert_pid_gone(finished["pid"].as_u64().unwrap() as u32);
    }

    pub fn record_report(&self, report: &Report) {
        write_new(
            &self.root.join("report.json"),
            &serde_json::to_vec(report).unwrap(),
            0o600,
        );
    }
}

fn bun_command(root: &Path) -> Command {
    let mut command = Command::new(BUN);
    command
        .args(["--no-env-file", "--no-install"])
        .current_dir(root)
        .env_clear()
        .env("LANG", "C")
        .env("LC_ALL", "C")
        .env("TZ", "UTC")
        .env("TMPDIR", root)
        .env("BUN_RUNTIME_TRANSPILER_CACHE_PATH", "0");
    command
}

pub fn read_json(path: &Path) -> Value {
    serde_json::from_slice(&fs::read(path).unwrap()).unwrap()
}

pub fn assert_pid_gone(pid: u32) {
    assert!(
        !Path::new(&format!("/proc/{pid}")).exists(),
        "owned fixture PID {pid} still exists"
    );
}

pub struct OffsetClock {
    offset: Cell<i64>,
}

impl OffsetClock {
    pub fn new() -> Self {
        Self {
            offset: Cell::new(0),
        }
    }
}

impl Clock for OffsetClock {
    fn now_ns(&self) -> chess_coach_gpu_owner::Result<i64> {
        Ok(Boottime.now_ns()? + self.offset.get())
    }
}

pub struct GuardedWaiter<'a> {
    pub clock: &'a OffsetClock,
    pub removed: PathBuf,
    pub premature: Option<PathBuf>,
    pub advanced_cleanup: bool,
    pub advanced_startup_guard: bool,
    first_wait: Option<i64>,
    real: LinuxWaiter,
}

impl<'a> GuardedWaiter<'a> {
    pub fn new(clock: &'a OffsetClock, fixture: &Fixture, premature: bool) -> Self {
        Self {
            clock,
            removed: fixture.path("removed"),
            premature: premature.then(|| fixture.path("prematureSent")),
            advanced_cleanup: false,
            advanced_startup_guard: false,
            first_wait: None,
            real: LinuxWaiter,
        }
    }
}

impl Waiter for GuardedWaiter<'_> {
    fn wait_until(
        &mut self,
        deadline: i64,
        watches: &[Watch<'_>],
    ) -> chess_coach_gpu_owner::Result<Vec<PollFlags>> {
        let real_now = Boottime.now_ns()?;
        let first_wait = *self.first_wait.get_or_insert(real_now);
        if self.removed.exists() && watches.is_empty() {
            self.clock
                .offset
                .set(self.clock.offset.get() + first_wait + 300_000_000_000 - self.clock.now_ns()?);
            self.advanced_cleanup = true;
            return Err(chess_coach_gpu_owner::OwnerError("DEADLINE"));
        }
        if self.premature.as_ref().is_some_and(|path| path.exists())
            && !self.removed.exists()
            && real_now - first_wait >= 1_000_000_000
        {
            self.clock
                .offset
                .set(self.clock.offset.get() + first_wait + 297_000_000_000 - self.clock.now_ns()?);
            self.advanced_startup_guard = true;
            return Err(chess_coach_gpu_owner::OwnerError("DEADLINE"));
        }
        let translated = deadline - self.clock.offset.get();
        if self.premature.as_ref().is_some_and(|path| path.exists())
            && translated - real_now > 1_000_000_000
        {
            let flags = self.real.wait_until(real_now + 1_000_000_000, watches);
            if flags.is_err() && Boottime.now_ns()? < translated {
                return Ok(vec![PollFlags::empty(); watches.len()]);
            }
            return flags;
        }
        self.real.wait_until(translated, watches)
    }
}

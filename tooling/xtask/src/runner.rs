// SPEC: _spec/packages/training/burn-compat.puml, _spec/apps/arena/burn-compat.puml
use std::fs::{self, DirBuilder, File, OpenOptions};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde_json::{Value, json};

const COMMAND_TIMEOUT: Duration = Duration::from_secs(600);
const CLEANUP_RESERVE: Duration = Duration::from_secs(3);
static SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub(crate) struct Gate {
    pub root: PathBuf,
    pub directory: PathBuf,
    pub results: Vec<Value>,
}

impl Gate {
    pub fn new(root: PathBuf) -> Result<Self, String> {
        let parent = std::env::var_os("TRAINING_RECEIPT_PARENT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let parent = parent
            .canonicalize()
            .map_err(|error| format!("Receipt parent: {error}"))?;
        if parent.starts_with(&root) {
            return Err(
                "TRAINING_RECEIPT_PARENT must remain outside the repository input tree".into(),
            );
        }
        let directory = fresh_directory(&parent, "rust-training-")?;
        Ok(Self {
            root,
            directory,
            results: Vec::new(),
        })
    }

    pub fn command(&mut self, name: &str, argv: &[&str]) -> Result<String, String> {
        let mut command = Command::new(argv[0]);
        command.args(&argv[1..]).current_dir(&self.root);
        let result = execute(command, &self.directory, name, argv, COMMAND_TIMEOUT);
        let failed = result["error"].as_str().map(str::to_owned);
        self.results.push(result);
        if let Some(error) = failed {
            return Err(format!("{name}: {error}; see {}", self.directory.display()));
        }
        match fs::read_to_string(self.directory.join(format!("{name}.stdout"))) {
            Ok(stdout) => {
                eprintln!("{name}: exit 0");
                Ok(stdout)
            }
            Err(error) => self.validate(Err(format!("Cannot read {name} stdout: {error}"))),
        }
    }

    pub fn last_stderr(&self) -> Result<String, String> {
        let name = self
            .results
            .last()
            .and_then(|result| result["name"].as_str())
            .ok_or("No command to read")?;
        fs::read_to_string(self.directory.join(format!("{name}.stderr")))
            .map_err(|error| format!("Cannot read {name} stderr: {error}"))
    }

    pub fn validate<T>(&mut self, value: Result<T, String>) -> Result<T, String> {
        if let Err(error) = &value
            && let Some(last) = self.results.last_mut()
        {
            last["validationError"] = json!(error);
            last["status"] = json!("STOP");
        }
        value
    }

    pub fn tests(&mut self, count: u64, binaries: Option<Vec<Value>>) -> Result<(), String> {
        let last = self
            .results
            .last_mut()
            .ok_or("Missing test command result")?;
        last["tests"] = json!(count);
        if let Some(binaries) = binaries {
            last["testBinaries"] = json!(binaries);
        }
        Ok(())
    }
}

pub(crate) fn fresh_directory(parent: &Path, prefix: &str) -> Result<PathBuf, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    for _ in 0..128 {
        let sequence = SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let directory = parent.join(format!(
            "{prefix}{}-{timestamp}-{sequence}",
            std::process::id()
        ));
        let mut builder = DirBuilder::new();
        #[cfg(unix)]
        {
            use std::os::unix::fs::DirBuilderExt;
            builder.mode(0o700);
        }
        match builder.create(&directory) {
            Ok(()) => return Ok(directory),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(format!("Cannot create receipt directory: {error}")),
        }
    }
    Err("Cannot allocate a fresh receipt directory".into())
}

pub(crate) fn write_new_json(path: &Path, value: &Value) -> Result<(), String> {
    use std::io::Write;
    let mut file = fresh_file(path).map_err(|error| error.to_string())?;
    let bytes = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    file.write_all(&bytes)
        .and_then(|()| file.write_all(b"\n"))
        .and_then(|()| file.sync_all())
        .map_err(|error| error.to_string())
}

fn fresh_file(path: &Path) -> std::io::Result<File> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options.open(path)
}

fn execute(
    mut command: Command,
    directory: &Path,
    name: &str,
    argv: &[&str],
    timeout: Duration,
) -> Value {
    let start = Instant::now();
    let cleanup_timeout = CLEANUP_RESERVE.min(timeout / 5);
    let work_timeout = timeout - cleanup_timeout;
    let deadline = start + timeout;
    let work_deadline = start + work_timeout;
    let mut result = json!({
        "name": name, "argv": argv, "executable": resolved_executable(argv[0]),
        "exit": null, "signal": null, "timedOut": false, "seconds": 0.0,
        "timeoutSeconds": timeout.as_secs_f64(), "status": "STOP", "error": null,
        "workTimeoutSeconds": work_timeout.as_secs_f64(),
        "cleanupTimeoutSeconds": cleanup_timeout.as_secs_f64(),
        "cleanupSeconds": 0.0, "cleanupTimedOut": false, "cleanupError": null,
        "reaped": false,
    });
    let outcome = (|| -> Result<(), String> {
        let stdout = fresh_file(&directory.join(format!("{name}.stdout")))
            .map_err(|error| format!("stdout log: {error}"))?;
        let stderr = fresh_file(&directory.join(format!("{name}.stderr")))
            .map_err(|error| format!("stderr log: {error}"))?;
        command
            .stdin(Stdio::null())
            .stdout(Stdio::from(stdout))
            .stderr(Stdio::from(stderr))
            .env("CARGO_BUILD_JOBS", "2")
            .env("CARGO_NET_OFFLINE", "true")
            .env("CARGO_TERM_COLOR", "never")
            .env("RUSTUP_AUTO_INSTALL", "0")
            .env("NO_COLOR", "1");
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
        let mut child = command
            .spawn()
            .map_err(|error| format!("spawn failed: {error}"))?;
        #[cfg(unix)]
        {
            result["processGroup"] = json!(child.id());
            result["cleanupScope"] = json!("owned-process-group");
        }
        #[cfg(not(unix))]
        {
            result["cleanupScope"] = json!("direct-child");
        }
        let (status, failure) = loop {
            match child.try_wait() {
                Ok(Some(status)) => break (Some(status), None),
                Ok(None) if Instant::now() < work_deadline => pause_until(work_deadline),
                Ok(None) => {
                    result["timedOut"] = json!(true);
                    let cleanup_deadline = deadline.min(Instant::now() + cleanup_timeout);
                    let status = terminate_and_reap(&mut child, &mut result, cleanup_deadline);
                    break (status, Some("command work deadline exceeded".to_string()));
                }
                Err(error) => {
                    let cleanup_deadline = deadline.min(Instant::now() + cleanup_timeout);
                    let status = terminate_and_reap(&mut child, &mut result, cleanup_deadline);
                    break (status, Some(format!("wait failed: {error}")));
                }
            }
        };
        if let Some(status) = status {
            result["reaped"] = json!(true);
            result["exit"] = json!(status.code());
            #[cfg(unix)]
            {
                use std::os::unix::process::ExitStatusExt;
                result["signal"] = json!(status.signal());
            }
        }
        if let Some(error) = failure {
            return Err(match result["cleanupError"].as_str() {
                Some(cleanup) => format!("{error}; {cleanup}"),
                None => error,
            });
        }
        let status = status.ok_or("Command status unavailable")?;
        if !status.success() {
            return Err(format!(
                "command failed (exit {}, signal {})",
                result["exit"], result["signal"]
            ));
        }
        result["status"] = json!("PASS");
        Ok(())
    })();
    result["seconds"] = json!(start.elapsed().as_secs_f64());
    if let Err(error) = outcome {
        result["error"] = json!(error);
    }
    result
}

fn terminate_and_reap(
    child: &mut Child,
    result: &mut Value,
    deadline: Instant,
) -> Option<ExitStatus> {
    let start = Instant::now();
    let mut errors = Vec::new();
    if let Err(error) = terminate_owned(child) {
        errors.push(error);
    }
    let reaped = reap_until(child, deadline);
    if let Some(error) = reaped.error {
        errors.push(error);
    }
    result["cleanupSeconds"] = json!(start.elapsed().as_secs_f64());
    result["cleanupTimedOut"] = json!(reaped.timed_out);
    if !errors.is_empty() {
        result["cleanupError"] = json!(errors.join("; "));
    }
    reaped.status
}

#[cfg(unix)]
fn terminate_owned(child: &mut Child) -> Result<(), String> {
    use rustix::process::{Pid, Signal, getpgrp, kill_process_group};
    let raw = i32::try_from(child.id()).map_err(|_| "Owned child process-group ID overflow")?;
    if raw <= 1 {
        return Err("Refusing a non-owned process-group ID".into());
    }
    let group = Pid::from_raw(raw).ok_or("Missing owned process-group ID")?;
    if group == getpgrp() {
        return Err("Refusing to signal the current process group".into());
    }
    match kill_process_group(group, Signal::KILL) {
        Ok(()) | Err(rustix::io::Errno::SRCH) => Ok(()),
        Err(error) => Err(format!("Owned process-group kill failed: {error}")),
    }
}

#[cfg(not(unix))]
fn terminate_owned(child: &mut Child) -> Result<(), String> {
    child
        .kill()
        .map_err(|error| format!("Owned child kill failed: {error}"))
}

struct Reaped {
    status: Option<ExitStatus>,
    error: Option<String>,
    timed_out: bool,
}

fn reap_until(child: &mut Child, deadline: Instant) -> Reaped {
    let mut error = None;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                return Reaped {
                    status: Some(status),
                    error,
                    timed_out: false,
                };
            }
            Ok(None) => {}
            Err(failed) => {
                error.get_or_insert_with(|| format!("Cleanup wait failed: {failed}"));
            }
        }
        if Instant::now() >= deadline {
            let timeout = "Cleanup reap deadline exceeded; direct-child status unavailable";
            return Reaped {
                status: None,
                error: Some(match error {
                    Some(error) => format!("{error}; {timeout}"),
                    None => timeout.into(),
                }),
                timed_out: true,
            };
        }
        pause_until(deadline);
    }
}

fn pause_until(deadline: Instant) {
    thread::sleep(
        Duration::from_millis(20).min(deadline.saturating_duration_since(Instant::now())),
    );
}

fn resolved_executable(program: &str) -> Option<PathBuf> {
    let path = Path::new(program);
    if path.components().count() > 1 {
        return path.canonicalize().ok();
    }
    std::env::var_os("PATH").and_then(|paths| {
        std::env::split_paths(&paths)
            .map(|directory| directory.join(program))
            .find(|path| path.is_file())
    })
}

pub(crate) fn safe_environment_value(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    ![
        "secret",
        "token",
        "password",
        "passwd",
        "credential",
        "authorization",
        "bearer",
        "api_key",
        "apikey",
        "private_key",
    ]
    .iter()
    .any(|word| lower.contains(word))
}

pub(crate) fn build_environment() -> Value {
    let mut environment = json!({
        "CARGO_BUILD_JOBS": "2", "CARGO_NET_OFFLINE": "true", "RUSTUP_AUTO_INSTALL": "0",
        "rustcPath": resolved_executable("rustc"), "cargoPath": resolved_executable("cargo"),
    });
    for name in [
        "RUSTUP_TOOLCHAIN",
        "CC",
        "CXX",
        "CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER",
        "RUSTFLAGS",
        "CARGO_ENCODED_RUSTFLAGS",
        "CARGO_BUILD_RUSTFLAGS",
    ] {
        if let Some(value) = std::env::var_os(name) {
            environment[name] = match value.into_string() {
                Ok(value) if safe_environment_value(&value) => json!(value),
                _ => json!("[REDACTED]"),
            };
        }
    }
    environment
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subprocess_fixture() {
        match std::env::var("XTASK_CHILD_FIXTURE").as_deref() {
            Ok("exit-seven") => {
                println!("fixture stdout");
                eprintln!("fixture stderr");
                std::process::exit(7);
            }
            Ok("sleep") => thread::sleep(Duration::from_secs(30)),
            #[cfg(target_os = "linux")]
            Ok("spawn-sleep") => {
                use std::io::Write;
                let mut child = Command::new(std::env::current_exe().unwrap())
                    .args([
                        "--exact",
                        "runner::tests::subprocess_fixture",
                        "--nocapture",
                    ])
                    .env("XTASK_CHILD_FIXTURE", "sleep")
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .spawn()
                    .unwrap();
                println!("owned-grandchild-pid={}", child.id());
                std::io::stdout().flush().unwrap();
                thread::sleep(Duration::from_secs(30));
                child.wait().unwrap();
            }
            Ok("success") => println!("fixture success"),
            Err(_) => assert!(std::env::var_os("XTASK_CHILD_FIXTURE").is_none()),
            Ok(_) => panic!("unknown fixture"),
        }
    }

    fn fixture(directory: &Path, mode: &str, timeout: Duration) -> Value {
        let executable = std::env::current_exe().unwrap();
        let executable = executable.to_str().unwrap();
        let argv = [
            executable,
            "--exact",
            "runner::tests::subprocess_fixture",
            "--nocapture",
        ];
        let mut command = Command::new(executable);
        command.args(&argv[1..]).env("XTASK_CHILD_FIXTURE", mode);
        execute(command, directory, mode, &argv, timeout)
    }

    #[test]
    fn actual_failed_exit_and_raw_logs_remain_available() {
        let directory = crate::test_directory();
        let result = fixture(&directory, "exit-seven", Duration::from_secs(5));
        assert_eq!(result["exit"], 7);
        assert_eq!(result["signal"], Value::Null);
        assert_eq!(result["timedOut"], false);
        assert_eq!(result["status"], "STOP");
        assert!(result["seconds"].as_f64().unwrap() > 0.0);
        assert!(
            fs::read_to_string(directory.join("exit-seven.stdout"))
                .unwrap()
                .contains("fixture stdout")
        );
        assert!(
            fs::read_to_string(directory.join("exit-seven.stderr"))
                .unwrap()
                .contains("fixture stderr")
        );
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn actual_timeout_records_reaped_status_and_signal_separately() {
        let directory = crate::test_directory();
        let result = fixture(&directory, "sleep", Duration::from_millis(100));
        assert_eq!(result["timedOut"], true);
        assert_eq!(result["status"], "STOP");
        assert_eq!(result["timeoutSeconds"], 0.1);
        assert_eq!(result["workTimeoutSeconds"], 0.08);
        assert_eq!(result["cleanupTimeoutSeconds"], 0.02);
        assert_eq!(result["reaped"], true);
        assert_eq!(result["cleanupTimedOut"], false);
        assert_eq!(result["cleanupError"], Value::Null);
        #[cfg(unix)]
        {
            assert_eq!(result["signal"], 9);
            assert_eq!(result["exit"], Value::Null);
        }
        assert!(result["error"].as_str().unwrap().contains("deadline"));
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn bounded_reap_reports_an_unavailable_status_without_waiting_for_exit() {
        struct OwnedChild(Child);

        impl Drop for OwnedChild {
            fn drop(&mut self) {
                let _ = self.0.kill();
                let _ = reap_until(&mut self.0, Instant::now() + CLEANUP_RESERVE);
            }
        }

        let directory = crate::test_directory();
        let mut command = Command::new(std::env::current_exe().unwrap());
        command
            .args([
                "--exact",
                "runner::tests::subprocess_fixture",
                "--nocapture",
            ])
            .env("XTASK_CHILD_FIXTURE", "sleep")
            .current_dir(&directory)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
        let mut child = OwnedChild(command.spawn().unwrap());
        let start = Instant::now();
        let reaped = reap_until(&mut child.0, start + Duration::from_millis(20));
        assert!(reaped.status.is_none());
        assert!(reaped.timed_out);
        assert!(reaped.error.unwrap().contains("reap deadline exceeded"));
        assert!(start.elapsed() < Duration::from_secs(1));
        let mut result = json!({});
        let status =
            terminate_and_reap(&mut child.0, &mut result, Instant::now() + CLEANUP_RESERVE);
        assert!(status.is_some());
        assert_eq!(result["cleanupTimedOut"], false);
        fs::remove_dir_all(directory).unwrap();
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn timeout_terminates_owned_descendant() {
        use rustix::process::{Pid, Signal, kill_process};

        struct OwnedDescendant(Pid);

        impl Drop for OwnedDescendant {
            fn drop(&mut self) {
                let _ = kill_process(self.0, Signal::KILL);
            }
        }

        fn running(pid: Pid) -> bool {
            match fs::read_to_string(format!("/proc/{}/stat", pid.as_raw_nonzero())) {
                Ok(stat) => {
                    stat.rsplit_once(") ").unwrap().1.split_whitespace().next() != Some("Z")
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
                Err(error) => panic!("Cannot inspect owned descendant: {error}"),
            }
        }

        let directory = crate::test_directory();
        let result = fixture(&directory, "spawn-sleep", Duration::from_secs(1));
        let stdout = fs::read_to_string(directory.join("spawn-sleep.stdout")).unwrap();
        let pid = stdout
            .lines()
            .find_map(|line| line.strip_prefix("owned-grandchild-pid="))
            .and_then(|pid| pid.parse::<i32>().ok())
            .and_then(Pid::from_raw)
            .expect("Missing controlled descendant PID marker");
        let descendant = OwnedDescendant(pid);
        println!(
            "descendant evidence: {}; result: {result}",
            directory.display()
        );
        assert_eq!(result["timedOut"], true);
        assert_eq!(result["status"], "STOP");
        assert_eq!(result["reaped"], true);
        assert_eq!(result["cleanupScope"], "owned-process-group");
        let group = result["processGroup"].as_i64().unwrap();
        assert!(group > 1);
        assert_ne!(group, i64::from(rustix::process::getpgrp().as_raw_pid()));
        let deadline = Instant::now() + Duration::from_millis(500);
        while running(descendant.0) && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(10));
        }
        assert!(
            !running(descendant.0),
            "Timed-out command left its descendant running"
        );
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn actual_success_and_missing_program_do_not_share_a_status() {
        let directory = crate::test_directory();
        let success = fixture(&directory, "success", Duration::from_secs(5));
        assert_eq!(success["exit"], 0);
        assert_eq!(success["status"], "PASS");
        let program = directory.join("nonexistent-program");
        let missing = execute(
            Command::new(&program),
            &directory,
            "missing",
            &[program.to_str().unwrap()],
            Duration::from_secs(1),
        );
        assert_eq!(missing["exit"], Value::Null);
        assert_eq!(missing["status"], "STOP");
        assert!(missing["error"].as_str().unwrap().contains("spawn failed"));
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn private_fresh_directories_and_create_new_receipts_reject_overwrites() {
        let directory = crate::test_directory();
        let next = crate::test_directory();
        assert_ne!(directory, next);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&directory).unwrap().permissions().mode() & 0o777,
                0o700
            );
        }
        let receipt = directory.join("receipt.json");
        write_new_json(&receipt, &json!({"reviewEligible": false})).unwrap();
        assert!(write_new_json(&receipt, &json!({"reviewEligible": true})).is_err());
        assert_eq!(crate::read_json(&receipt).unwrap()["reviewEligible"], false);
        fs::remove_dir_all(directory).unwrap();
        fs::remove_dir_all(next).unwrap();
    }

    #[test]
    fn environment_receipt_redacts_sensitive_flags() {
        assert!(!safe_environment_value("--cfg api_token=hidden"));
        assert!(!safe_environment_value("-C link-arg=Authorization:secret"));
        assert!(safe_environment_value("-C debuginfo=0"));
        assert!(build_environment().get("PATH").is_none());
    }

    #[test]
    fn validation_failure_preserves_zero_exit_and_marks_stop() {
        let directory = crate::test_directory();
        let result = fixture(&directory, "success", Duration::from_secs(5));
        let mut gate = Gate {
            root: directory.clone(),
            directory: directory.clone(),
            results: vec![result],
        };
        assert!(
            gate.validate::<()>(Err("incomplete invoice".into()))
                .is_err()
        );
        assert_eq!(gate.results[0]["exit"], 0);
        assert_eq!(gate.results[0]["status"], "STOP");
        assert_eq!(gate.results[0]["validationError"], "incomplete invoice");
        fs::remove_dir_all(directory).unwrap();
    }
}

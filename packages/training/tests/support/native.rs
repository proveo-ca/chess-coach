// SPEC: _spec/packages/training/burn-compat.puml
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{Receiver, sync_channel};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use serde_json::{Value, json};
use tempfile::Builder;
use training_native::candidates::{RuntimeCounters, generate_with_runtime};
use training_native::contracts::*;

const FRAME_LIMIT: usize = 1024 * 1024;

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap()
}

struct Process {
    child: Child,
    stdin: Option<ChildStdin>,
    lines: Receiver<Result<Vec<u8>, String>>,
    reader: Option<JoinHandle<()>>,
}

impl Process {
    fn spawn(script: &Path) -> Self {
        let mut child = Command::new("node")
            .args(["--import", "tsx"])
            .arg(script)
            .current_dir(root().join("apps/arena"))
            .env_remove("NODE_OPTIONS")
            .env_remove("NODE_PATH")
            .env("CHESS_COACH_TEST_ROOT", root())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .expect("Fixed Node/tsx test worker");
        let stdout = child.stdout.take().unwrap();
        let (sender, lines) = sync_channel(2);
        let reader = thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            loop {
                let mut bytes = Vec::new();
                let result = reader
                    .by_ref()
                    .take((FRAME_LIMIT + 1) as u64)
                    .read_until(b'\n', &mut bytes);
                let result = match result {
                    Ok(0) => break,
                    Ok(_) if bytes.len() > FRAME_LIMIT || bytes.last() != Some(&b'\n') => {
                        Err("Oversized or partial Node test frame".into())
                    }
                    Ok(_) => Ok(bytes),
                    Err(error) => Err(error.to_string()),
                };
                let failed = result.is_err();
                if sender.send(result).is_err() || failed {
                    break;
                }
            }
        });
        let stdin = child.stdin.take();
        Self {
            child,
            stdin,
            lines,
            reader: Some(reader),
        }
    }

    fn exchange(&mut self, value: &Value) -> ContractResult<Value> {
        let mut bytes = serde_json::to_vec(value).map_err(|error| error.to_string())?;
        bytes.push(b'\n');
        if bytes.len() > 64 * 1024 {
            return Err("Node test request exceeds 64 KiB".into());
        }
        let stdin = self.stdin.as_mut().ok_or("Closed Node test input")?;
        stdin
            .write_all(&bytes)
            .and_then(|_| stdin.flush())
            .map_err(|error| error.to_string())?;
        let bytes = self
            .lines
            .recv_timeout(Duration::from_secs(30))
            .map_err(|error| format!("Node test reply: {error}"))??;
        serde_json::from_slice(&bytes).map_err(|error| error.to_string())
    }
}

impl Drop for Process {
    fn drop(&mut self) {
        self.stdin.take();
        let _ = self.child.kill();
        let _ = self.child.wait();
        if let Some(reader) = self.reader.take() {
            reader.join().expect("Node test output reader");
        }
    }
}

struct NativeOracle {
    process: Process,
    id: u32,
}

impl NativeOracle {
    fn new() -> Self {
        Self {
            process: Process::spawn(&root().join("apps/arena/engine/worker-v2.ts")),
            id: 0,
        }
    }

    fn call(&mut self, mut value: Value) -> ContractResult<Value> {
        self.id = self.id.checked_add(1).ok_or("Test request ID overflow")?;
        value["protocol"] = json!("arena-engine-v2");
        value["id"] = json!(self.id);
        let reply = self.process.exchange(&value)?;
        if reply["protocol"] != "arena-engine-v2" || reply["id"] != self.id {
            return Err("Uncorrelated Node test reply".into());
        }
        if reply["ok"] != true {
            return Err(format!("Native test oracle: {}", reply["error"]));
        }
        reply
            .get("result")
            .cloned()
            .ok_or("Missing Node test result".into())
    }

    fn fixture_views(&mut self, fixture: &str) -> Vec<AuthorizedView> {
        let started = self
            .call(json!({"op":"session.start","fixture":fixture}))
            .unwrap();
        let session = started["session"].as_u64().unwrap();
        assert!(started["outcome"].is_null());
        let opened = self
            .call(json!({"op":"session.open","session":session,"planningOrdinal":0}))
            .unwrap();
        assert_eq!(opened["kind"], "planning");
        let views = ["w", "b"]
            .into_iter()
            .map(|side| serde_json::from_value(opened["views"][side].clone()).unwrap())
            .collect();
        self.call(json!({"op":"session.close","session":session}))
            .unwrap();
        views
    }
}

impl PlanningOracle for NativeOracle {
    fn open(&mut self, view: &AuthorizedView) -> ContractResult<PlanningId> {
        let result = self.call(json!({"op":"plan.open","view":view}))?;
        if result["kind"] != "planning-opened" {
            return Err("Wrong planning-open result".into());
        }
        serde_json::from_value(result["planning"].clone()).map_err(|error| error.to_string())
    }
    fn next(
        &mut self,
        planning: PlanningId,
        pulls: &[CursorPull],
    ) -> ContractResult<Vec<DomainStep>> {
        let result = self.call(json!({"op":"plan.next","planning":planning,"pulls":pulls}))?;
        if result["kind"] != "planned" || result["planning"] != planning {
            return Err("Wrong planning-next result".into());
        }
        serde_json::from_value(result["steps"].clone()).map_err(|error| error.to_string())
    }
    fn close(&mut self, planning: PlanningId) -> ContractResult<()> {
        let result = self.call(json!({"op":"plan.close","planning":planning}))?;
        if result["kind"] != "planning-closed" || result["planning"] != planning {
            return Err("Wrong planning-close result".into());
        }
        Ok(())
    }
}

pub fn assert_parity() {
    let mut legacy_file = Builder::new()
        .prefix("training-legacy-oracle-")
        .suffix(".mjs")
        .tempfile()
        .unwrap();
    legacy_file.write_all(include_bytes!("legacy.mjs")).unwrap();
    legacy_file.flush().unwrap();
    let mut legacy = Process::spawn(legacy_file.path());
    let mut native = NativeOracle::new();
    for fixture in ["tiny-v1", "standard-v1", "all-actors-v1"] {
        for view in native.fixture_views(fixture) {
            view.validate().unwrap();
            let expected = legacy.exchange(&json!({"view":view})).unwrap();
            assert_eq!(
                expected["ok"],
                true,
                "legacy {fixture}/{}: {expected}",
                view.side.as_str()
            );
            let mut expected_batch = expected["batch"].clone();
            expected_batch["version"] = json!("arena-composition-v1");
            for candidate in expected_batch["candidates"].as_array_mut().unwrap() {
                candidate["version"] = json!("arena-candidate-v1");
            }
            let expected_batch: CandidateBatch = serde_json::from_value(expected_batch).unwrap();
            let expected_runtime: RuntimeCounters =
                serde_json::from_value(expected["runtime"].clone()).unwrap();
            let actual = generate_with_runtime(&view, &mut native).unwrap();
            assert_eq!(
                actual.batch,
                expected_batch,
                "native/public V3 parity {fixture}/{}",
                view.side.as_str()
            );
            assert_eq!(
                actual.runtime,
                expected_runtime,
                "native/legacy runtime {fixture}/{}",
                view.side.as_str()
            );
            assert!(
                actual
                    .batch
                    .candidates
                    .iter()
                    .any(|candidate| !candidate.actions.is_empty())
            );
            if fixture == "all-actors-v1" {
                assert_eq!(actual.batch.diagnostics.active_families, ACTION_KINDS);
            }
        }
    }
}

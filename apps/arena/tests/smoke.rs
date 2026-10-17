// SPEC: _spec/apps/arena/burn-compat.puml
use serde_json::{Value, json};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

const CWD: &str = env!("CARGO_MANIFEST_DIR");
const INITIAL: &str = "SCFEN|4k3/8/8/8/8/8/8/4K3|0|33|P|G:11:11|B:3:3|Q:w:;b:";

fn cli(args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_arena"))
        .args(args)
        .current_dir(CWD)
        .output()
        .expect("Run compiled Rust arena binary")
}

fn smoke() -> (Vec<u8>, Value) {
    let output = cli(&["smoke"]);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    assert_eq!(
        output.stdout.iter().filter(|&&byte| byte == b'\n').count(),
        1
    );
    assert!(output.stdout.ends_with(b"\n"));
    let report = serde_json::from_slice(&output.stdout).expect("Single JSON report");
    (output.stdout, report)
}

struct OracleScript(tempfile::NamedTempFile);

impl OracleScript {
    fn new() -> Self {
        let mut file = tempfile::Builder::new()
            .prefix("arena-native-oracle-")
            .suffix(".mjs")
            .tempfile()
            .expect("Create private exclusive native oracle file");
        let native = Path::new(CWD)
            .join("../../packages/starchess-core/src/index.ts")
            .canonicalize()
            .expect("Native engine source exists");
        let module = serde_json::to_string(&format!("file://{}", native.display())).unwrap();
        let source = format!(
            r#"
            import {{addScAction,applyStoredIncome,beginScTurn,endScTurn,formatScFen,parseScFen}} from {module};
            const initial=parseScFen({initial});
            const bankBefore={{...initial.stored}};
            const rawBegin=beginScTurn(structuredClone(initial));
            const opening={{...structuredClone(rawBegin.next),stored:{{...bankBefore}}}};
            const action={{kind:'classical',timing:'C',color:'w',from:'e1',to:'f1'}};
            const requestedActions={{w:[action],b:[]}};
            const committed={{...addScAction({{snapshot:structuredClone(opening),action}}).snapshot,stored:{{...bankBefore}}}};
            const rawResolve=endScTurn(structuredClone(committed),{{skipTurnStartChecks:true}});
            const bankAfter=applyStoredIncome({{...bankBefore}},rawResolve.next.turn);
            const final={{...structuredClone(rawResolve.next),stored:{{...bankAfter}}}};
            process.stdout.write(JSON.stringify({{
                initialScfen:formatScFen(initial),openScfen:formatScFen(opening),
                committedScfen:formatScFen(committed),finalScfen:formatScFen(final),
                bankBefore,bankCommitted:bankBefore,bankAfter,requestedActions,rawBegin,rawResolve
            }})+'\n');
        "#,
            initial = serde_json::to_string(INITIAL).unwrap()
        );
        file.write_all(source.as_bytes())
            .expect("Write trusted static native oracle");
        file.flush()
            .expect("Flush native oracle before Node import");
        Self(file)
    }

    fn path(&self) -> &Path {
        self.0.path()
    }

    fn run(&self) -> Value {
        let output = Command::new("node")
            .args(["--import", "tsx"])
            .arg(self.path())
            .current_dir(CWD)
            .env_clear()
            .env("PATH", std::env::var_os("PATH").unwrap())
            .output()
            .expect("Run independent native replay");
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(output.stderr.is_empty());
        serde_json::from_slice(&output.stdout).expect("Native replay JSON")
    }
}

#[cfg(unix)]
struct LegacyOracleLink {
    path: PathBuf,
    target: PathBuf,
}

#[cfg(unix)]
impl LegacyOracleLink {
    fn new(target: &Path) -> Self {
        let path =
            std::env::temp_dir().join(format!("arena-native-oracle-{}.mjs", std::process::id()));
        std::os::unix::fs::symlink(target, &path)
            .expect("Create owned legacy symlink exclusively; preserve any preexisting path");
        Self {
            path,
            target: target.to_owned(),
        }
    }

    fn still_owned(&self) -> bool {
        std::fs::read_link(&self.path).ok().as_deref() == Some(self.target.as_path())
    }
}

#[cfg(unix)]
impl Drop for LegacyOracleLink {
    fn drop(&mut self) {
        if self.still_owned() {
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

#[cfg(unix)]
#[test]
fn oracle_script_preserves_victim_behind_preexisting_legacy_symlink() {
    use std::os::unix::fs::PermissionsExt;

    const CANARY: &[u8] = b"arena-owned-private-victim-must-remain-unchanged\n";
    let directory = tempfile::Builder::new()
        .prefix("arena-oracle-victim-")
        .tempdir()
        .unwrap();
    let mut victim = tempfile::NamedTempFile::new_in(directory.path()).unwrap();
    victim.write_all(CANARY).unwrap();
    victim.flush().unwrap();
    let legacy = LegacyOracleLink::new(victim.path());
    let oracle = OracleScript::new();
    let victim_unchanged = std::fs::read(victim.path()).unwrap() == CANARY;
    let oracle_is_distinct = oracle.path() != legacy.path;
    let oracle_mode = std::fs::metadata(oracle.path())
        .unwrap()
        .permissions()
        .mode()
        & 0o777;
    drop(oracle);
    let legacy_preserved = legacy.still_owned();
    drop(legacy);

    assert!(
        victim_unchanged,
        "Oracle helper overwrote the controlled victim through the preexisting legacy symlink"
    );
    assert!(oracle_is_distinct);
    assert_eq!(oracle_mode, 0o600);
    assert!(
        legacy_preserved,
        "Oracle cleanup removed the preexisting legacy symlink"
    );
    assert_eq!(std::fs::read(victim.path()).unwrap(), CANARY);
}

#[cfg(unix)]
#[test]
fn oracle_scripts_use_distinct_private_files_and_cleanup_only_their_own_file() {
    use std::os::unix::fs::PermissionsExt;

    let first = OracleScript::new();
    let second = OracleScript::new();
    let first_path = first.path().to_owned();
    let second_path = second.path().to_owned();
    assert_ne!(first_path, second_path);
    for path in [&first_path, &second_path] {
        let metadata = std::fs::symlink_metadata(path).unwrap();
        assert!(metadata.file_type().is_file());
        assert_eq!(metadata.permissions().mode() & 0o777, 0o600);
    }
    drop(first);
    assert!(!first_path.exists());
    assert!(second_path.is_file());
    drop(second);
    assert!(!second_path.exists());
}

#[test]
fn actual_cli_scores_in_f64_resolves_native_frame_zero_and_matches_independent_oracle() {
    let (_, report) = smoke();
    assert_eq!(report["milestone"], "burn-flex-compat-v1");
    assert_eq!(report["scope"], "synthetic");
    assert_eq!(report["assurance"], "NON_ADMITTED");
    assert_eq!(report["fullRunner"], false);
    assert!(report["modelArtifact"].is_null());
    assert_eq!(report["opponent"], json!({"side":"b","decision":"pass"}));
    assert_eq!(report["scores"], json!([1.875, 2.875]));
    assert_eq!(report["selected"]["index"], 1);
    assert_eq!(report["selected"]["score"], 2.875);
    assert_eq!(
        report["selected"]["action"],
        json!({"color":"w","from":"e1","kind":"classical","timing":"C","to":"f1"})
    );
    let action = report["selected"]["action"].clone();
    assert_eq!(report["requestedActions"], json!({"w":[action],"b":[]}));
    assert_eq!(report["candidates"][1]["key"], report["selected"]["key"]);
    assert_eq!(
        report["candidates"][1]["action"],
        report["selected"]["action"]
    );
    assert_eq!(
        report["candidates"][1]["score"],
        report["selected"]["score"]
    );
    assert_eq!(report["bankBefore"], json!({"w":3,"b":3}));
    assert_eq!(report["bankCommitted"], report["bankBefore"]);
    assert_eq!(report["bankAfter"], json!({"w":4,"b":4}));
    assert_eq!(report["rawResolve"]["next"]["turn"], 1);
    assert_eq!(report["rawResolve"]["next"]["gas"], json!({"w":0,"b":0}));
    assert_eq!(
        report["rawResolve"]["next"]["gasIncome"],
        json!({"w":1,"b":1})
    );
    assert!(report["rawResolve"]["next"].get("stored").is_none());
    assert_eq!(report["rawResolve"]["queue"][0]["seq"], 0);
    assert_eq!(report["observation"]["turn"], 0);
    assert_eq!(report["observation"]["side"], "w");
    assert_eq!(
        report["observation"]["own"]["pieces"],
        json!([{"square":"e1","type":"k"}])
    );
    let cells = report["observation"]["cells"].as_array().unwrap();
    assert_eq!(cells.len(), 64);
    assert_eq!(cells[39], json!({"square":"e8","visibility":"unknown"}));
    assert_eq!(report["features"]["rows"], 2);
    assert_eq!(report["features"]["columns"], 418);
    let values = report["features"]["values"].as_array().unwrap();
    assert_eq!(values.len(), 836);
    assert_eq!(&values[..2], &[json!(4.0), json!(1.0)]);
    assert_eq!(&values[418..420], &[json!(6.0), json!(1.0)]);
    assert!(
        values[2..418]
            .iter()
            .chain(&values[420..])
            .all(|value| value.as_f64() == Some(0.0))
    );
    let oracle = OracleScript::new().run();
    for (key, expected) in oracle.as_object().unwrap() {
        assert_eq!(
            &report[key], expected,
            "Independent native replay differs at {key}"
        );
    }
}

#[test]
fn repeated_real_smoke_reports_are_byte_deterministic() {
    assert_eq!(smoke().0, smoke().0);
}

#[test]
fn cli_requires_exact_explicit_command_and_keeps_json_off_error_paths() {
    for arguments in [
        vec![],
        vec!["unknown"],
        vec!["--"],
        vec!["smoke", "extra"],
        vec!["--help", "smoke"],
        vec!["-h", "extra"],
    ] {
        let output = cli(&arguments);
        assert_eq!(output.status.code(), Some(2), "{arguments:?}");
        assert!(output.stdout.is_empty());
        assert!(!output.stderr.is_empty());
    }
    for arguments in [["--help"], ["-h"]] {
        let output = cli(&arguments);
        assert!(output.status.success());
        assert!(output.stderr.is_empty());
        assert!(String::from_utf8_lossy(&output.stdout).contains("Usage: arena smoke"));
    }
}

#[test]
fn missing_node_fails_without_runtime_installation_or_json() {
    let output = Command::new(env!("CARGO_BIN_EXE_arena"))
        .arg("smoke")
        .current_dir(CWD)
        .env_clear()
        .env("PATH", "/arena-test-no-node")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    assert!(String::from_utf8_lossy(&output.stderr).contains("Node executable is missing"));
}

#[test]
fn parent_node_options_cannot_inject_code_into_engine_children() {
    let output = Command::new(env!("CARGO_BIN_EXE_arena"))
        .arg("smoke")
        .current_dir(CWD)
        .env("NODE_OPTIONS", "--require=/arena-must-not-load-this.cjs")
        .env("NODE_PATH", "/arena-must-not-load-this")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    let report: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["scores"], json!([1.875, 2.875]));
}

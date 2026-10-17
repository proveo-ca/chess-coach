// SPEC: _spec/apps/arena/burn-compat.puml
use arena::record::{MatchSpec, RunRecord, RunStop, decision_seed};
use arena::run::run_match;
use serde_json::{Value, json};
use std::io::Write;
use std::process::{Command, Output};
use std::sync::OnceLock;
use training_native::contracts::Side;

fn spec(windows: u32, white: &str, black: &str) -> MatchSpec {
    serde_json::from_value(json!({"version":"arena-match-v1","caseId":"runner-test","fixture":"tiny-v1",
        "players":{"w":white,"b":black},"environmentSeed":7,"policySeeds":{"w":1,"b":2},"maxWindows":windows})).unwrap()
}

fn one_window() -> &'static RunRecord {
    static RECORD: OnceLock<RunRecord> = OnceLock::new();
    RECORD.get_or_init(|| run_match(&spec(1, "pass-v1", "pass-v1")).unwrap())
}

fn config_file(config: &impl serde::Serialize) -> tempfile::NamedTempFile {
    let mut file = tempfile::NamedTempFile::new().unwrap();
    serde_json::to_writer(&mut file, config).unwrap();
    file.flush().unwrap();
    file
}

fn cli(args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_arena"))
        .args(args)
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .output()
        .unwrap()
}

#[test]
fn native_pass_pass_reaches_the_45_window_boundary_without_a_fabricated_outcome() {
    let record = run_match(&spec(45, "pass-v1", "pass-v1")).unwrap();
    assert_eq!(record.completed_windows, 45, "{:?}", record.stop);
    assert!(
        matches!(record.stop, RunStop::Terminal),
        "{:?}",
        record.stop
    );
    assert!(record.outcome.is_some());
    assert!(record.full_runner && !record.learned && record.model_artifact.is_none());
    assert!(!record.environment_seed_used);
    assert!(record.native_frames() <= 128);
    for (ordinal, window) in record.windows.iter().enumerate() {
        assert_eq!(window.context.planning_ordinal, ordinal as u32);
        assert!(window.decisions.w.generation.is_none() && window.decisions.b.generation.is_none());
        assert!(window.settlement.requests.w.is_empty() && window.settlement.requests.b.is_empty());
        assert_eq!(window.begin.after, window.settlement.before);
        assert_eq!(
            window.settlement.before.bank,
            window.settlement.committed.bank
        );
    }
    record.validate_bounds().unwrap();
}

#[test]
fn one_window_limit_keeps_deferred_begin_and_is_not_a_draw() {
    let record = one_window();
    assert!(
        matches!(record.stop, RunStop::WindowLimit),
        "{:?}",
        record.stop
    );
    assert_eq!(record.completed_windows, 1);
    assert!(record.outcome.is_none());
    let trailing = record.trailing_begin.as_ref().unwrap();
    assert_eq!(trailing.planning_ordinal, 1);
    assert_eq!(trailing.before, record.windows[0].settlement.after);
    assert_eq!(record.final_image.as_ref(), Some(&trailing.after));
    assert_eq!(record.windows[0].settlement.after.bank.w, 4);
    assert_eq!(trailing.before.bank, trailing.after.bank);
}

#[test]
fn all_actors_starting_at_turn_21_stops_on_native_terminal_before_host_limit() {
    let mut config = spec(45, "pass-v1", "pass-v1");
    config.fixture = arena::record::FixtureId::AllActorsV1;
    let record = run_match(&config).unwrap();
    assert!(
        matches!(record.stop, RunStop::Terminal),
        "{:?}",
        record.stop
    );
    assert_eq!(record.completed_windows, 24);
    assert!(record.outcome.is_some());
}

#[test]
fn seeded_selection_uses_real_generation_and_never_rescues_native_rejection() {
    let record = run_match(&spec(1, "seeded-v1", "pass-v1")).unwrap();
    let decisions = if let Some(window) = record.windows.first() {
        &window.decisions
    } else {
        &record
            .failed_attempt
            .as_ref()
            .unwrap_or_else(|| panic!("{:?}", record.stop))
            .decisions
    };
    let generation = decisions.w.generation.as_ref().unwrap();
    assert!(generation.attempted_extensions > 0);
    assert!(generation.unique_including_pass > 1);
    assert!(!decisions.w.selected.actions.is_empty());
    assert!(decisions.b.generation.is_none());
    assert!(
        matches!(
            record.stop,
            RunStop::WindowLimit | RunStop::Terminal | RunStop::NativeRejection { .. }
        ),
        "{:?}",
        record.stop
    );
    if let Some(attempt) = &record.failed_attempt {
        assert_eq!(record.completed_windows, 0);
        assert_eq!(attempt.witness.requests.w, decisions.w.selected.actions);
        assert_eq!(attempt.witness.image, attempt.witness.begin.after);
        assert!(record.trailing_begin.is_none());
        assert!(record.outcome.is_none());
    }
}

#[test]
fn decision_seed_contract_has_wrapping_golden_vectors_and_seat_separation() {
    assert_eq!(decision_seed(0, 0, Side::White), 0x9e37_79b9);
    assert_eq!(decision_seed(0, 0, Side::Black), 0x2423_4424);
    assert_eq!(decision_seed(u32::MAX, 1, Side::White), 0x3c6e_f371);
    assert_eq!(decision_seed(0, u32::MAX, Side::White), 0);
    assert_ne!(
        decision_seed(1, 0, Side::White),
        decision_seed(1, 1, Side::White)
    );
}

#[test]
fn configs_are_closed_and_invalid_options_do_not_emit_json() {
    for args in [
        vec!["run"],
        vec!["run", "--config"],
        vec!["run", "--config", "x", "--config", "y"],
        vec!["run", "--config", "x", "--out", "y"],
        vec!["replay"],
        vec!["suite", "--config", "x"],
    ] {
        let output = cli(&args);
        assert_eq!(output.status.code(), Some(2));
        assert!(output.stdout.is_empty());
    }
    let mut value = serde_json::to_value(spec(1, "pass-v1", "pass-v1")).unwrap();
    value["script"] = json!("must-not-be-executable");
    let file = config_file(&value);
    let output = cli(&["run", "--config", file.path().to_str().unwrap()]);
    assert_eq!(output.status.code(), Some(2));
    assert!(output.stdout.is_empty());
    value.as_object_mut().unwrap().remove("script");
    value["maxWindows"] = json!(0);
    let file = config_file(&value);
    assert_eq!(
        cli(&["run", "--config", file.path().to_str().unwrap()])
            .status
            .code(),
        Some(2)
    );
}

#[test]
fn bounded_config_and_missing_node_preserve_explicit_failure_record() {
    let file = config_file(&spec(1, "pass-v1", "pass-v1"));
    let output = Command::new(env!("CARGO_BIN_EXE_arena"))
        .args(["run", "--config", file.path().to_str().unwrap()])
        .env_clear()
        .env("PATH", "/arena-v2-no-node")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(1));
    let record: RunRecord = serde_json::from_slice(&output.stdout).unwrap();
    assert!(record.initial.is_none() && record.final_image.is_none() && record.outcome.is_none());
    let RunStop::BridgeFailure { message, pending } = record.stop else {
        panic!("Expected bridge failure");
    };
    assert!(message.contains("Node executable is missing"));
    assert_eq!(pending.method, "session.start");
    assert!(pending.id.is_none());
    let mut oversized = tempfile::NamedTempFile::new().unwrap();
    oversized.write_all(&vec![b' '; 65537]).unwrap();
    oversized.flush().unwrap();
    let output = cli(&["run", "--config", oversized.path().to_str().unwrap()]);
    assert_eq!(output.status.code(), Some(2));
    assert!(output.stdout.is_empty());
}

#[test]
fn v2_worker_ignores_parent_node_preloads_and_emits_one_json_line() {
    let file = config_file(&spec(1, "pass-v1", "pass-v1"));
    let output = Command::new(env!("CARGO_BIN_EXE_arena"))
        .args(["run", "--config", file.path().to_str().unwrap()])
        .env("NODE_OPTIONS", "--require=/arena-v2-must-not-load.cjs")
        .env("NODE_PATH", "/arena-v2-must-not-load")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    assert_eq!(
        output.stdout.iter().filter(|byte| **byte == b'\n').count(),
        1
    );
    let record: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(record["stop"]["kind"], "window-limit");
}

#[test]
fn n2_match_config_rejects_fixture_and_version_unit_map_aliases() {
    let canonical = serde_json::to_value(spec(1, "pass-v1", "pass-v1")).unwrap();
    for (field, alias) in [
        ("fixture", json!({"tiny-v1":null})),
        ("version", json!({"arena-match-v1":null})),
    ] {
        let mut value = canonical.clone();
        value[field] = alias;
        assert!(
            serde_json::from_value::<MatchSpec>(value).is_err(),
            "Accepted unit-map alias for {field}"
        );
    }
}

#[test]
fn n3_match_config_rejects_positional_players_and_policy_seed_pairs() {
    let canonical = serde_json::to_value(spec(1, "pass-v1", "pass-v1")).unwrap();
    for (field, positional) in [
        ("players", json!(["pass-v1", "pass-v1"])),
        ("policySeeds", json!([1, 2])),
    ] {
        let mut value = canonical.clone();
        value[field] = positional;
        assert!(
            serde_json::from_value::<MatchSpec>(value).is_err(),
            "Accepted positional pair for {field}"
        );
    }
}

// SPEC: _spec/apps/arena/burn-compat.puml
use arena::evaluation::{CaseResult, evaluate};
use arena::record::{MatchSpec, RunRecord, RunStop};
use arena::replay::{VerificationKind, replay_record};
use arena::run::run_match;
use serde_json::{Value, json};
use std::process::Command;
use std::sync::OnceLock;

fn spec(fixture: &str, policy: &str, windows: u32) -> MatchSpec {
    serde_json::from_value(json!({"version":"arena-match-v1","caseId":"replay-control","fixture":fixture,
        "players":{"w":policy,"b":"pass-v1"},"environmentSeed":0,"policySeeds":{"w":1,"b":2},"maxWindows":windows})).unwrap()
}

fn limited() -> &'static RunRecord {
    static RECORD: OnceLock<RunRecord> = OnceLock::new();
    RECORD.get_or_init(|| {
        let record = run_match(&spec("tiny-v1", "pass-v1", 1)).unwrap();
        assert_eq!(record.stop, RunStop::WindowLimit);
        record
    })
}

#[test]
fn independent_replay_verifies_limited_records_and_actual_native_terminals() {
    let verified = replay_record(limited()).unwrap();
    assert_eq!(verified.kind(), VerificationKind::WindowLimited);
    assert!(verified.outcome().is_none());
    let terminal = run_match(&spec("all-actors-v1", "pass-v1", 45)).unwrap();
    let verified = replay_record(&terminal).unwrap();
    assert_eq!(verified.kind(), VerificationKind::Terminal);
    assert_eq!(verified.outcome(), terminal.outcome.as_ref());
    let evaluation = evaluate(&[CaseResult::Verified(verified)]).unwrap();
    assert_eq!(evaluation.verified_terminal, 1);
    assert_eq!(evaluation.policies["pass-v1"].appearances, 2);
    assert_eq!(
        evaluation.policies["pass-v1"].wins
            + evaluation.policies["pass-v1"].losses
            + evaluation.policies["pass-v1"].draws,
        2
    );
}

#[test]
fn two_seeded_seats_generate_and_replay_multiple_native_windows() {
    let spec: MatchSpec =
        serde_json::from_str(include_str!("fixtures/seeded-all-actors.json")).unwrap();
    let record = run_match(&spec).unwrap();
    assert_eq!(record.completed_windows, 3, "{:?}", record.stop);
    assert_eq!(record.stop, RunStop::WindowLimit);
    for window in &record.windows {
        assert!(
            window
                .decisions
                .w
                .generation
                .as_ref()
                .unwrap()
                .attempted_extensions
                > 0
        );
        assert!(
            window
                .decisions
                .b
                .generation
                .as_ref()
                .unwrap()
                .attempted_extensions
                > 0
        );
    }
    assert_eq!(
        replay_record(&record).unwrap().kind(),
        VerificationKind::WindowLimited
    );
}

#[test]
fn replay_rejects_keys_actions_spend_decision_seeds_and_seed_version_tampering() {
    let original = serde_json::to_value(limited()).unwrap();
    let mutations: &[(&str, Value)] = &[
        ("/windows/0/decisions/w/selected/key", json!("forged-key")),
        (
            "/windows/0/decisions/w/selected/actions",
            json!([{"kind":"classical","timing":"C","color":"w","from":"e1","to":"f1"}]),
        ),
        (
            "/windows/0/decisions/w/selected/ownSpend/minerals",
            json!(1),
        ),
        ("/windows/0/decisions/w/seed", json!(0)),
        ("/spec/policySeeds/w", json!(4)),
        ("/seedVersion", json!("forged-seeds")),
    ];
    for (pointer, replacement) in mutations {
        let mut value = original.clone();
        *value.pointer_mut(pointer).unwrap() = replacement.clone();
        if let Ok(record) = serde_json::from_value::<RunRecord>(value) {
            assert!(
                replay_record(&record).is_err(),
                "Accepted tamper at {pointer}"
            );
        }
    }
}

#[test]
fn replay_rejects_views_banks_scfen_grants_raw_native_frames_and_stale_contexts() {
    let original = serde_json::to_value(limited()).unwrap();
    let mutations: &[(&str, Value)] = &[
        ("/windows/0/views/w/own/minerals", json!(2)),
        ("/initial/bank/w", json!(2)),
        ("/windows/0/begin/before/scfen", json!("forged-SCFEN")),
        ("/windows/0/begin/rawBegin", json!({"forged":true})),
        ("/windows/0/settlement/committed/bank/w", json!(2)),
        ("/windows/0/settlement/grants/w", json!(12)),
        ("/windows/0/settlement/rawResolve", json!({"forged":true})),
        ("/windows/0/context/planningOrdinal", json!(4)),
        ("/windows/0/settlement/context/turn", json!(42)),
        ("/trailingBegin/rawBegin", json!({"forged":true})),
        ("/finalImage/scfen", json!("forged-final")),
    ];
    for (pointer, replacement) in mutations {
        let mut value = original.clone();
        *value.pointer_mut(pointer).unwrap() = replacement.clone();
        let record: RunRecord = serde_json::from_value(value).unwrap();
        assert!(
            replay_record(&record).is_err(),
            "Accepted tamper at {pointer}"
        );
    }
}

#[test]
fn replay_rejects_fabricated_outcomes_stop_reclassification_and_omitted_begins() {
    let original = serde_json::to_value(limited()).unwrap();
    let mut draw = original.clone();
    draw["outcome"] = json!({"winner":null,"draw":true});
    assert!(replay_record(&serde_json::from_value(draw).unwrap()).is_err());
    let mut terminal = original.clone();
    terminal["stop"] = json!({"kind":"terminal"});
    assert!(replay_record(&serde_json::from_value(terminal).unwrap()).is_err());
    let mut omitted = original.clone();
    omitted["trailingBegin"] = Value::Null;
    assert!(replay_record(&serde_json::from_value(omitted).unwrap()).is_err());
    let mut missing = original.clone();
    missing["windows"][0]
        .as_object_mut()
        .unwrap()
        .remove("begin");
    assert!(serde_json::from_value::<RunRecord>(missing).is_err());
    let mut counter = limited().clone();
    counter.completed_windows += 1;
    assert!(replay_record(&counter).is_err());
}

#[test]
fn seeded_replay_regenerates_full_diagnostics_and_selection_instead_of_trusting_the_record() {
    let record = run_match(&spec("tiny-v1", "seeded-v1", 1)).unwrap();
    assert!(
        matches!(
            record.stop,
            RunStop::WindowLimit | RunStop::NativeRejection { .. }
        ),
        "{:?}",
        record.stop
    );
    let verified = replay_record(&record).unwrap();
    let report = evaluate(&[CaseResult::Verified(verified)]).unwrap();
    assert_eq!(report.scheduled, 1);
    if matches!(record.stop, RunStop::NativeRejection { .. }) {
        assert_eq!(report.failed_unverified, 1);
        assert_eq!(report.verified_native_rejections, 1);
        assert_eq!(report.verified_terminal, 0);
    }
    let mut value = serde_json::to_value(&record).unwrap();
    let generation = if record.failed_attempt.is_some() {
        "/failedAttempt/decisions/w/generation"
    } else {
        "/windows/0/decisions/w/generation"
    };
    let pointer = format!("{generation}/attemptedExtensions");
    let before = value.pointer(&pointer).unwrap().as_u64().unwrap();
    *value.pointer_mut(&pointer).unwrap() = json!(before + 1);
    assert!(replay_record(&serde_json::from_value(value).unwrap()).is_err());
}

#[test]
fn an_explicit_transport_failure_verifies_only_its_prefix_and_cannot_enter_terminal_wdl() {
    let mut record = limited().clone();
    record.stop = RunStop::BridgeFailure {
        message: "controlled pending operation".into(),
        pending: arena::record::PendingOperation {
            method: "session.commit".into(),
            id: Some(9),
            context: None,
            status: arena::record::PendingStatus::MutationUnknown,
        },
    };
    record.final_image = None;
    record.trailing_begin = None;
    let error = replay_record(&record).unwrap_err();
    assert_eq!(error.verified_prefix_windows, 1);
    assert!(error.message.contains("remains unverified"));
    let report = evaluate(&[CaseResult::FailedUnverified {
        spec: record.spec,
        message: error.message,
    }])
    .unwrap();
    assert_eq!(report.failed_unverified, 1);
    assert_eq!(report.verified_terminal, 0);
}

#[test]
fn cli_replay_emits_a_failed_json_summary_for_tampered_and_oversized_records() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("record.json");
    let mut tampered = limited().clone();
    tampered.windows[0].settlement.after.bank.w = 0;
    std::fs::write(&path, serde_json::to_vec(&tampered).unwrap()).unwrap();
    let invoke = || {
        Command::new(env!("CARGO_BIN_EXE_arena"))
            .args(["replay", "--record"])
            .arg(&path)
            .output()
            .unwrap()
    };
    let output = invoke();
    assert_eq!(output.status.code(), Some(1));
    let report: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["version"], "arena-replay-v1");
    assert_eq!(report["verified"], false);
    let file = std::fs::File::create(&path).unwrap();
    file.set_len(16 * 1024 * 1024 + 1).unwrap();
    let output = invoke();
    assert_eq!(output.status.code(), Some(1));
    let report: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["verified"], false);
    assert!(report["error"].as_str().unwrap().contains("exceeds"));
}

#[test]
fn n3_run_records_reject_positional_bank_request_view_and_decision_pairs() {
    let canonical = serde_json::to_value(limited()).unwrap();
    for path in [
        "/initial/bank",
        "/windows/0/settlement/requests",
        "/windows/0/views",
        "/windows/0/decisions",
        "/windows/0/settlement/grants",
    ] {
        let mut value = canonical.clone();
        let pair = value.pointer(path).unwrap();
        let positional = json!([pair["w"], pair["b"]]);
        *value.pointer_mut(path).unwrap() = positional;
        assert!(
            serde_json::from_value::<RunRecord>(value).is_err(),
            "Accepted positional run-record pair: {path}"
        );
    }
    assert_eq!(
        serde_json::to_value(serde_json::from_value::<RunRecord>(canonical.clone()).unwrap())
            .unwrap(),
        canonical
    );
}

// SPEC: _spec/apps/arena/burn-compat.puml
#[path = "support/economic.rs"]
mod support;

use arena::economic::decode_record;
use arena::record::{CleanupStatus, PendingOperation, PendingStatus, RunRecord, RunStop};
use arena::run::run_match;
use serde_json::{Value, json};
use std::process::Command;
use support::{analyze, limited, spec};

#[test]
fn all_fixed_fixtures_use_native_initial_forward_origins() {
    for (fixture, turn, bank) in [
        ("tiny-v1", 0, 3),
        ("standard-v1", 0, 3),
        ("all-actors-v1", 21, 12),
    ] {
        let record = run_match(&spec(fixture, 1)).unwrap();
        let (verified, report) = analyze(&record);
        assert!(verified, "{fixture}: {report}");
        assert_eq!(report.get("terminalTrainingCloseout"), Some(&Value::Null));
        for side in ["w", "b"] {
            let ledger = &report["ledgers"][side];
            assert_eq!(ledger["scope"], "record-initial-forward");
            assert_eq!(ledger["calculated"]["origin"]["nativeTurn"], turn);
            assert_eq!(ledger["calculated"]["origin"]["minerals"], bank);
            assert_eq!(ledger["calculated"]["origin"]["paidMineralBasis"], 0);
            assert_eq!(ledger["grantOrdinal"], 1);
        }
    }
}

#[test]
fn actual_standard_45_pass_windows_check_turn_1_11_21_grants_and_caps() {
    let record = run_match(&spec("standard-v1", 45)).unwrap();
    assert_eq!(record.completed_windows, 45, "{:?}", record.stop);
    let (verified, report) = analyze(&record);
    assert!(verified, "{report}");
    assert_eq!(report["classification"], "terminal");
    assert_eq!(
        report["terminalTrainingCloseout"],
        json!({
            "version":"arena-terminal-training-closeout-v1", "terminalPhase":"end",
            "excludedReceipt":{"grantOrdinal":45,"sourcePlanningOrdinal":44,"settledTurn":45,"reason":"terminal-at-end"},
            "seats":{"w":{"excludedMineralCredit":0,"eligibleMineralCredits":9,"trainingClosingBank":12},"b":{"excludedMineralCredit":0,"eligibleMineralCredits":9,"trainingClosingBank":12}},
            "terminalGasRefillEligible":false,"usableGas":{"w":0,"b":0}
        })
    );
    for side in ["w", "b"] {
        let ledger = &report["ledgers"][side];
        let origin = &ledger["calculated"]["origin"];
        assert_eq!(origin["nativeTurn"], 0);
        assert_eq!(origin["minerals"], 3);
        assert_eq!(origin["nativeUnitCostSum"], 5);
        assert_eq!(origin["nonCcReplacementValue"], 4);
        assert_eq!(origin["paidMineralBasis"], 0);
        assert_eq!(origin["gas"], 1);
        assert_eq!(origin["ccLives"], 3);
        let settlements = ledger["calculated"]["settlements"].as_array().unwrap();
        assert_eq!(settlements.len(), 45);
        for (index, entitlement, capacity, credited) in [(0, 1, 1, 1), (10, 2, 2, 0), (20, 3, 3, 0)]
        {
            let receipt = &settlements[index];
            let window = &record.windows[index];
            assert_eq!(window.context.turn as usize, index);
            assert_eq!(receipt["planningOrdinal"], index + 1);
            assert_eq!(receipt["grantOrdinal"], index + 1);
            assert_eq!(receipt["at"]["nativeTurn"], index + 1);
            assert_eq!(receipt["entitlement"], entitlement);
            assert_eq!(receipt["nextGasCapacity"], capacity);
            assert_eq!(receipt["credited"], credited);
            assert_eq!(
                *window.settlement.grants.get(if side == "w" {
                    training_native::contracts::Side::White
                } else {
                    training_native::contracts::Side::Black
                }),
                credited
            );
        }
        assert_eq!(ledger["grantOrdinal"], 45);
        assert_eq!(ledger["calculated"]["minerals"]["actualCredits"], 9);
        assert_eq!(ledger["calculated"]["minerals"]["nominalEntitlement"], 105);
        assert_eq!(ledger["calculated"]["minerals"]["currentBank"], 12);
        assert_eq!(ledger["calculated"]["gas"]["available"], 0);
    }
    assert_eq!(report["work"].as_array().unwrap().len(), 45);
    for (ordinal, receipt) in report["work"].as_array().unwrap().iter().enumerate() {
        assert_eq!(receipt["ordinal"], ordinal);
        assert!(receipt["used"].as_u64().unwrap() > 0);
        assert!(receipt["used"].as_u64().unwrap() <= receipt["limit"].as_u64().unwrap());
    }
}

#[test]
fn native_fact_tampering_never_constructs_full_ledger_authority() {
    let original = serde_json::to_value(limited()).unwrap();
    let mutations = [
        ("/initial/scfen", json!("forged")),
        ("/initial/bank/w", json!(2)),
        ("/windows/0/context/turn", json!(4)),
        ("/windows/0/views/w/own/minerals", json!(2)),
        ("/windows/0/views/b/turn", json!(4)),
        ("/windows/0/begin/rawBegin", json!({"forged":true})),
        ("/windows/0/begin/after/bank/w", json!(1)),
        ("/windows/0/begin/before/scfen", json!("forged")),
        ("/windows/0/settlement/before/scfen", json!("forged")),
        ("/windows/0/settlement/committed/bank/b", json!(2)),
        ("/windows/0/settlement/after/bank/w", json!(2)),
        ("/windows/0/settlement/grants/w", json!(0)),
        ("/windows/0/settlement/rawResolve", json!({"forged":true})),
        (
            "/windows/0/settlement/requests/w",
            json!([{"kind":"classical","timing":"C","color":"w","from":"e1","to":"f1"}]),
        ),
        ("/trailingBegin/rawBegin", json!({"forged":true})),
        ("/trailingBegin/planningOrdinal", json!(9)),
        ("/finalImage/scfen", json!("forged")),
        ("/outcome", json!({"winner":null,"draw":true})),
        ("/stop", json!({"kind":"terminal"})),
        ("/cleanup", json!({"kind":"reaped"})),
        ("/trailingBegin", Value::Null),
    ];
    for (pointer, replacement) in mutations {
        let mut value = original.clone();
        *value.pointer_mut(pointer).unwrap() = replacement;
        let record: RunRecord = serde_json::from_value(value).unwrap();
        let (verified, report) = analyze(&record);
        assert!(!verified, "Accepted {pointer}: {report}");
        assert_eq!(report["fullEconomicVerification"], false);
        assert_eq!(report.get("terminalTrainingCloseout"), Some(&Value::Null));
        if pointer.starts_with("/initial") {
            assert!(report["ledgers"].is_null());
        }
    }
}

#[test]
fn ledger_does_not_claim_or_execute_policy_seed_verification() {
    let mut record = limited().clone();
    record.spec.policy_seeds.w = 44;
    record.spec.players.w = arena::record::BaselinePolicy::SeededV1;
    record.windows[0].decisions.w.seed = 99;
    let (verified, report) = analyze(&record);
    assert!(verified, "{report}");
    assert_eq!(report["policyVerification"], "not-executed");
    assert!(arena::replay::replay_record(&record).is_err());
}

#[test]
fn later_failure_retains_only_previously_published_both_seat_boundaries() {
    let mut record = run_match(&spec("standard-v1", 2)).unwrap();
    record.windows[1].settlement.grants.b = 0;
    let (verified, report) = analyze(&record);
    assert!(!verified);
    assert_eq!(report.get("terminalTrainingCloseout"), Some(&Value::Null));
    assert_eq!(report["verifiedPrefixWindows"], 1);
    assert_eq!(report["ledgers"]["w"]["grantOrdinal"], 1);
    assert_eq!(report["ledgers"]["b"]["grantOrdinal"], 1);
    assert_eq!(report["ledgers"]["w"]["boundaryOrdinal"], 3);
    assert_eq!(report["ledgers"]["b"]["boundaryOrdinal"], 3);
}

#[test]
fn uncertain_original_mutation_is_never_retried_or_promoted() {
    let mut record = limited().clone();
    record.stop = RunStop::BridgeFailure {
        message: "uncertain original commit".into(),
        pending: PendingOperation {
            method: "session.commit".into(),
            id: Some(9),
            context: None,
            status: PendingStatus::MutationUnknown,
        },
    };
    record.final_image = None;
    record.trailing_begin = None;
    record.cleanup = CleanupStatus::Reaped;
    let (verified, report) = analyze(&record);
    assert!(!verified);
    assert_eq!(report.get("terminalTrainingCloseout"), Some(&Value::Null));
    assert_eq!(report["verifiedPrefixWindows"], 1);
    assert_eq!(report["ledgers"]["w"]["grantOrdinal"], 1);
    assert_eq!(report["ledgers"]["w"]["boundaryOrdinal"], 2);
    assert!(report["error"].as_str().unwrap().contains("unverified"));
}

#[test]
fn existing_seeded_all_actors_record_reconstructs_its_actual_stop() {
    let spec = serde_json::from_str::<arena::record::MatchSpec>(include_str!(
        "fixtures/seeded-all-actors.json"
    ))
    .unwrap();
    let record = run_match(&spec).unwrap();
    assert_eq!(record.stop, RunStop::WindowLimit);
    let (verified, report) = analyze(&record);
    assert!(verified, "{report}");
    assert_eq!(report.get("terminalTrainingCloseout"), Some(&Value::Null));
    assert_eq!(report["verifiedPrefixWindows"], record.completed_windows);
    assert_eq!(
        report["ledgers"]["w"]["grantOrdinal"],
        record.completed_windows
    );
    assert_eq!(
        report["ledgers"]["b"]["grantOrdinal"],
        record.completed_windows
    );
    assert_eq!(report["cleanup"], json!({"kind":"exited","success":true}));
}

#[test]
fn strict_original_decode_rejects_duplicates_even_inside_native_opaque_objects() {
    let bytes = serde_json::to_vec(limited()).unwrap();
    assert!(decode_record(&bytes).is_ok());
    let text = String::from_utf8(bytes).unwrap();
    let duplicate = text.replacen(
        "\"rawBegin\":{",
        "\"rawBegin\":{\"forged\":1,\"forged\":2,",
        1,
    );
    assert!(
        decode_record(duplicate.as_bytes())
            .unwrap_err()
            .contains("Duplicate")
    );
    assert!(decode_record(b"[]").is_err());
    assert!(decode_record(b"{}").is_err());
}

#[test]
fn cli_ledger_has_bounded_read_only_output_and_explicit_exit_codes() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("record.json");
    let original = serde_json::to_vec(limited()).unwrap();
    std::fs::write(&path, &original).unwrap();
    let invoke = |extra: &[&str]| {
        Command::new(env!("CARGO_BIN_EXE_arena"))
            .args(["ledger", "--record"])
            .arg(&path)
            .args(extra)
            .output()
            .unwrap()
    };
    let output = invoke(&[]);
    assert_eq!(
        output.status.code(),
        Some(0),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(report["version"], "arena-economic-report-v1");
    assert_eq!(report["trainingReady"], false);
    assert_eq!(report.get("terminalTrainingCloseout"), Some(&Value::Null));
    assert!(output.stdout.len() <= 16 * 1024 * 1024);
    assert_eq!(std::fs::read(&path).unwrap(), original);
    assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
    for extra in [
        &["--out", "forbidden"][..],
        &["trailing"][..],
        &["--record", "duplicate"][..],
    ] {
        assert_eq!(invoke(extra).status.code(), Some(2));
    }
    let mut tampered = limited().clone();
    tampered.windows[0].settlement.grants.w = 0;
    std::fs::write(&path, serde_json::to_vec(&tampered).unwrap()).unwrap();
    assert_eq!(invoke(&[]).status.code(), Some(1));
    std::fs::write(&path, b"{\"version\":1,\"version\":2}").unwrap();
    assert_eq!(invoke(&[]).status.code(), Some(2));
    std::fs::File::create(&path)
        .unwrap()
        .set_len(16 * 1024 * 1024 + 1)
        .unwrap();
    assert_eq!(invoke(&[]).status.code(), Some(2));
}

// SPEC: _spec/apps/arena/burn-compat.puml
#[path = "support/economic.rs"]
mod support;

use serde_json::{Value, json};
use support::{analyze, limited, spec};

fn check<'a>(report: &'a Value, id: &str) -> &'a Value {
    report["checks"]
        .as_array()
        .unwrap()
        .iter()
        .find(|check| check["id"] == id)
        .unwrap()
}

#[test]
fn complete_ledger_checks_pass_only_the_executed_slice_and_never_training() {
    let (verified, report) = analyze(limited());
    assert!(verified, "{report}");
    assert_eq!(report["assurance"], "NON_ADMITTED");
    assert_eq!(report["learned"], false);
    assert_eq!(report["modelArtifact"], Value::Null);
    assert_eq!(report["trainingReady"], false);
    assert_eq!(report.get("terminalTrainingCloseout"), Some(&Value::Null));
    assert_eq!(
        check(&report, "terminal-training-closeout")["status"],
        "not-executed"
    );
    assert!(check(&report, "terminal-training-closeout")["receiptRef"].is_null());
    for id in [
        "native-defaults-profile",
        "native-correspondence",
        "ordered-causal-history",
        "mineral-conservation",
        "paid-basis-conservation",
        "sequence-identity",
        "protocol-bounds",
        "clean-exit",
        "full-record-coverage",
    ] {
        assert_eq!(check(&report, id)["status"], "pass", "{id}: {report}");
        assert!(!check(&report, id)["receiptRef"].is_null());
    }
    for id in [
        "policy-verification",
        "full-418-features",
        "pmf-posterior",
        "promotion-kernels",
        "learner-core",
        "calibration",
        "resource-profiling",
        "whole-decision-cap-adequacy",
        "runtime-authority",
        "training-authorization",
        "learned-admission",
    ] {
        assert_eq!(check(&report, id)["status"], "not-executed");
        assert!(check(&report, id)["receiptRef"].is_null());
    }
}

#[test]
fn forged_public_report_booleans_and_receipts_supply_no_native_authority() {
    let (_, mut public_report) = analyze(limited());
    public_report["trainingReady"] = json!(true);
    public_report["fullEconomicVerification"] = json!(true);
    public_report["terminalTrainingCloseout"] =
        json!({"terminalPhase":"end","usableGas":{"w":0,"b":0}});
    public_report["checks"][0]["receiptRef"] = json!("invented-external-receipt");
    assert!(arena::economic::decode_record(&serde_json::to_vec(&public_report).unwrap()).is_err());
    let mut bad = limited().clone();
    bad.initial.as_mut().unwrap().bank.w = 0;
    let (verified, report) = analyze(&bad);
    assert!(!verified);
    assert_eq!(report["trainingReady"], false);
    assert_eq!(report.get("terminalTrainingCloseout"), Some(&Value::Null));
    assert_eq!(
        check(&report, "terminal-training-closeout")["status"],
        "not-executed"
    );
    assert!(report["ledgers"].is_null());
    assert_eq!(
        check(&report, "mineral-conservation")["status"],
        "not-executed"
    );
    assert!(check(&report, "mineral-conservation")["receiptRef"].is_null());
    assert_eq!(check(&report, "native-correspondence")["status"], "fail");
    assert_eq!(check(&report, "full-record-coverage")["status"], "fail");
}

#[test]
fn tampered_tail_keeps_scoped_substantive_conservation_not_full_coverage() {
    let mut bad = limited().clone();
    bad.final_image.as_mut().unwrap().bank.w = 1;
    let (verified, report) = analyze(&bad);
    assert!(!verified);
    assert_eq!(check(&report, "mineral-conservation")["status"], "pass");
    assert_eq!(
        check(&report, "mineral-conservation")["scope"],
        "confirmed-boundary-prefix"
    );
    assert_eq!(check(&report, "full-record-coverage")["status"], "fail");
    assert_eq!(check(&report, "native-correspondence")["status"], "fail");
    assert_eq!(check(&report, "learner-core")["status"], "not-executed");
    assert_eq!(report["trainingReady"], false);
    assert_eq!(report.get("terminalTrainingCloseout"), Some(&Value::Null));
    assert_eq!(
        check(&report, "terminal-training-closeout")["status"],
        "not-executed"
    );
}

#[test]
fn only_verified_native_terminal_executes_the_closeout_accounting_check() {
    let record = arena::run::run_match(&spec("standard-v1", 45)).unwrap();
    let (verified, report) = analyze(&record);
    assert!(verified, "{report}");
    assert_eq!(
        check(&report, "terminal-training-closeout")["status"],
        "pass"
    );
    assert_eq!(
        check(&report, "terminal-training-closeout")["scope"],
        "verified-terminal-check-before-intent-accounting"
    );
    assert!(!check(&report, "terminal-training-closeout")["receiptRef"].is_null());
    assert_eq!(
        report["terminalTrainingCloseout"]["excludedReceipt"]["grantOrdinal"],
        45
    );
    assert_eq!(report["trainingReady"], false);
    for id in [
        "policy-verification",
        "learner-core",
        "calibration",
        "training-authorization",
        "learned-admission",
    ] {
        assert_eq!(check(&report, id)["status"], "not-executed");
    }
    let mut unclean = record.clone();
    unclean.cleanup = arena::record::CleanupStatus::Reaped;
    let (verified, report) = analyze(&unclean);
    assert!(!verified);
    assert_eq!(report.get("terminalTrainingCloseout"), Some(&Value::Null));
    assert_eq!(
        check(&report, "terminal-training-closeout")["status"],
        "not-executed"
    );
    assert!(check(&report, "terminal-training-closeout")["receiptRef"].is_null());
    let mut unknown = record;
    unknown.stop = arena::record::RunStop::BridgeFailure {
        message: "unknown original close after a confirmed terminal settlement".into(),
        pending: arena::record::PendingOperation {
            method: "session.close".into(),
            id: Some(99),
            context: None,
            status: arena::record::PendingStatus::MutationUnknown,
        },
    };
    unknown.final_image = None;
    unknown.outcome = None;
    unknown.cleanup = arena::record::CleanupStatus::Reaped;
    let (verified, report) = analyze(&unknown);
    assert!(!verified);
    assert_eq!(report["ledgers"]["w"]["grantOrdinal"], 45);
    assert_eq!(report.get("terminalTrainingCloseout"), Some(&Value::Null));
    assert_eq!(
        check(&report, "terminal-training-closeout")["status"],
        "not-executed"
    );
}

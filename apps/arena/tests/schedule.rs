// SPEC: _spec/apps/arena/burn-compat.puml
use arena::evaluation::{CaseResult, evaluate};
use arena::record::FixtureId;
use arena::schedule::{SuiteSpec, expand_schedule, run_suite};
use serde_json::json;
use std::io::Write;
use std::os::unix::fs::{PermissionsExt, symlink};
use std::process::Command;

fn spec() -> SuiteSpec {
    serde_json::from_value(
        json!({"version":"arena-schedule-v1","fixtures":["tiny-v1","standard-v1"],
        "pairings":[{"w":"pass-v1","b":"pass-v1"},{"w":"first-v1","b":"pass-v1"}],"repeats":2,
        "environmentSeed":4294967294_u32,"policySeed":4294967293_u32,"maxWindows":1}),
    )
    .unwrap()
}

#[test]
fn schedule_order_and_seed_wrapping_are_explicit() {
    let cases = expand_schedule(&spec()).unwrap();
    assert_eq!(cases.len(), 8);
    assert_eq!(cases[0].fixture, FixtureId::TinyV1);
    assert_eq!(cases[1].fixture, FixtureId::TinyV1);
    assert_eq!(cases[2].fixture, FixtureId::StandardV1);
    assert_eq!(cases[4].fixture, FixtureId::TinyV1);
    assert_eq!(cases[0].environment_seed, u32::MAX - 1);
    assert_eq!(cases[2].environment_seed, 0);
    assert_eq!(cases[1].policy_seeds.w, u32::MAX);
    assert_eq!(cases[1].policy_seeds.b, 0);
    assert_eq!(cases[2].policy_seeds.w, 1);
    for (index, case) in cases.iter().enumerate() {
        assert_eq!(case.case_id, format!("case-{index}"));
    }
}

#[test]
fn schedule_validates_products_and_bounds_before_expansion() {
    let mut config = spec();
    config.repeats = 16;
    assert_eq!(expand_schedule(&config).unwrap().len(), 64);
    config.pairings.push(config.pairings[0].clone());
    assert!(expand_schedule(&config).is_err());
    config = spec();
    config.fixtures.clear();
    assert!(expand_schedule(&config).is_err());
    config = spec();
    config.repeats = 17;
    assert!(expand_schedule(&config).is_err());
    config = spec();
    config.max_windows = 46;
    assert!(expand_schedule(&config).is_err());
    let mut value = serde_json::to_value(spec()).unwrap();
    value["hiddenEnginePath"] = json!("no");
    assert!(serde_json::from_value::<SuiteSpec>(value).is_err());
}

#[test]
fn independent_suite_replay_conserves_denominator_and_self_pair_appearances() {
    let mut config = spec();
    config.pairings.truncate(1);
    config.repeats = 1;
    let suite = run_suite(&config).unwrap();
    assert_eq!(suite.records.len(), 2);
    let evaluation = &suite.summary.evaluation;
    assert_eq!(evaluation.scheduled, 2);
    assert_eq!(evaluation.verified_window_limited, 2);
    assert_eq!(evaluation.verified_terminal, 0);
    assert_eq!(evaluation.failed_unverified, 0);
    assert_eq!(evaluation.policies["pass-v1"].appearances, 4);
    assert_eq!(evaluation.policies["pass-v1"].draws, 0);
    assert!(!evaluation.learned && !evaluation.learned_pass);
}

#[test]
fn unverified_errors_remain_in_evaluation_denominator_without_becoming_losses() {
    let case = expand_schedule(&spec()).unwrap().remove(0);
    let report = evaluate(&[CaseResult::FailedUnverified {
        spec: case,
        message: "explicit case failure".into(),
    }])
    .unwrap();
    assert_eq!(report.scheduled, 1);
    assert_eq!(report.failed_unverified, 1);
    assert_eq!(report.policies["pass-v1"].appearances, 2);
    assert_eq!(report.policies["pass-v1"].losses, 0);
    assert_eq!(report.policies["pass-v1"].draws, 0);
}

#[test]
fn suite_cli_creates_only_private_fresh_outputs_and_refuses_aliases() {
    let temp = tempfile::tempdir().unwrap();
    let mut config = spec();
    config.fixtures.truncate(1);
    config.pairings.truncate(1);
    config.repeats = 1;
    let mut file = tempfile::NamedTempFile::new_in(temp.path()).unwrap();
    serde_json::to_writer(&mut file, &config).unwrap();
    file.flush().unwrap();
    let destination = temp.path().join("outputs");
    let run = |out: &std::path::Path| {
        Command::new(env!("CARGO_BIN_EXE_arena"))
            .args([
                "suite",
                "--config",
                file.path().to_str().unwrap(),
                "--out",
                out.to_str().unwrap(),
            ])
            .output()
            .unwrap()
    };
    let output = run(&destination);
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(
        std::fs::metadata(&destination)
            .unwrap()
            .permissions()
            .mode()
            & 0o777,
        0o700
    );
    for name in ["case-0000.json", "summary.json"] {
        assert_eq!(
            std::fs::metadata(destination.join(name))
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
    }
    let before = std::fs::read(destination.join("summary.json")).unwrap();
    assert_eq!(run(&destination).status.code(), Some(2));
    assert_eq!(
        std::fs::read(destination.join("summary.json")).unwrap(),
        before
    );
    let protected = temp.path().join("_spec");
    std::fs::create_dir(&protected).unwrap();
    let alias = temp.path().join("alias");
    symlink(&protected, &alias).unwrap();
    assert_eq!(run(&alias.join("outputs")).status.code(), Some(2));
    assert!(!protected.join("outputs").exists());
}

#[test]
fn n2_schedule_rejects_unit_map_versions_and_fixtures() {
    let canonical = serde_json::to_value(spec()).unwrap();
    for pointer in ["/version", "/fixtures/0"] {
        let mut value = canonical.clone();
        let text = value.pointer(pointer).unwrap().as_str().unwrap().to_owned();
        *value.pointer_mut(pointer).unwrap() = json!({text:null});
        assert!(
            serde_json::from_value::<SuiteSpec>(value).is_err(),
            "Accepted unit-map schedule field: {pointer}"
        );
    }
}

#[test]
fn n3_schedule_rejects_positional_pairings_and_config_objects() {
    let mut value = serde_json::to_value(spec()).unwrap();
    value["pairings"][0] = json!(["pass-v1", "pass-v1"]);
    assert!(serde_json::from_value::<SuiteSpec>(value).is_err());
    assert!(
        serde_json::from_value::<SuiteSpec>(
            json!(["arena-schedule-v1",["tiny-v1"],[{"w":"pass-v1","b":"pass-v1"}],1,0,0,1])
        )
        .is_err()
    );
}

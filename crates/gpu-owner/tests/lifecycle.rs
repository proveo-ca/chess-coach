// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
#![forbid(unsafe_code)]

mod support;

use chess_coach_gpu_owner::{
    Report,
    linux::{Boottime, Clock, LinuxWaiter},
    run_once, run_once_with,
};
use serde_json::json;
use std::{
    cell::Cell,
    fs,
    path::{Path, PathBuf},
};
use support::{Fixture, GuardedWaiter, OffsetClock, assert_pid_gone, read_json, sha256};

fn run(fixture: &Fixture) -> Report {
    let report = run_once(fixture.request()).unwrap();
    fixture.record_report(&report);
    fixture.assert_no_fixture_error();
    fixture.assert_helper_pids_gone();
    assert!(!report.training_ready);
    report
}

fn assert_removed(fixture: &Fixture, report: &Report) {
    assert!(report.cgroup_gone, "{report:?}");
    assert_owned_remove(fixture, report);
}

fn assert_owned_remove(fixture: &Fixture, report: &Report) {
    assert!(report.all_helpers_reaped, "{report:?}");
    assert!(fixture.path("removed").is_file());
    assert!(!fixture.path("leaf").exists());
    let events = fixture.events();
    let remove = events.iter().position(|e| e["event"] == "remove").unwrap();
    let inspect = events[..remove]
        .iter()
        .rposition(|e| e["event"] == "inspect")
        .unwrap();
    assert_eq!(events[inspect]["value"]["image"], fixture.config["imageId"]);
    assert_eq!(events[inspect]["value"]["token"], fixture.config["token"]);
    assert_eq!(events.iter().filter(|e| e["event"] == "create").count(), 1);
    assert_eq!(events.iter().filter(|e| e["event"] == "remove").count(), 1);
    if fixture.path("attachPid").exists() {
        let pid = fs::read_to_string(fixture.path("attachPid"))
            .unwrap()
            .parse()
            .unwrap();
        assert_pid_gone(pid);
    }
}

fn assert_rejected_before_create(mode: &str) {
    let fixture = Fixture::new(mode);
    let report = run(&fixture);
    assert!(!report.success, "{report:?}");
    assert!(report.first_failure.is_some());
    assert!(report.all_helpers_reaped, "{report:?}");
    assert!(!fixture.path("created").exists());
    assert!(!fixture.path("removed").exists());
    assert!(!fixture.path("attachPid").exists());
    fixture.assert_no_work();
    let telemetry = fs::read_to_string(fixture.path("telemetryEvents")).unwrap();
    assert!(!telemetry.is_empty());
    for line in telemetry.lines() {
        let event: serde_json::Value = serde_json::from_str(line).unwrap();
        assert_pid_gone(event["pid"].as_u64().unwrap() as u32);
    }
}

#[test]
fn real_bun_attempt_commits_once_and_naturally_reaps_every_child() {
    let fixture = Fixture::new("normal");
    let report = run(&fixture);
    assert!(report.success, "{report:?}");
    assert!(report.first_failure.is_none());
    assert!(report.cleanup_errors.is_empty(), "{report:?}");
    assert_removed(&fixture, &report);
    fixture.assert_completed();
    let frames = fixture.frames();
    assert_eq!(
        frames
            .iter()
            .map(|frame| frame["kind"].as_str().unwrap())
            .collect::<Vec<_>>(),
        ["boot", "startup", "attempt-proposal"]
    );
    assert_eq!(
        frames[1]["initialModelId"],
        fixture.registration["initialModelId"]
    );
    let exact_proposal = frames[2]["proposalJson"].as_str().unwrap();
    assert_eq!(report.proposal_json.as_deref(), Some(exact_proposal));
    assert_eq!(
        frames[2]["proposalSha256"],
        sha256(exact_proposal.as_bytes())
    );
    let proposal: serde_json::Value = serde_json::from_str(exact_proposal).unwrap();
    assert_eq!(proposal["descriptor"], fixture.registration["descriptor"]);
    assert_eq!(
        proposal["state"]["modelId"],
        fixture.registration["initialModelId"]
    );
    assert_eq!(proposal["state"]["master"], 101);
    assert_eq!(
        proposal["state"]["counters"],
        json!({"started": 1, "verifiedCompleted": 1, "eligibleCompleted": 0,
        "updates": 0, "nonzeroPGUpdates": 0, "baselineCount": 0, "baselineSum": 0})
    );
    assert_eq!(
        read_json(&fixture.root.join("report.json"))["origin_ns"],
        report.origin_ns.to_string()
    );
}

#[test]
fn wrong_image_or_ownership_token_never_authorizes_remove_or_start_release() {
    for mode in ["wrong-image", "wrong-label"] {
        let fixture = Fixture::new(mode);
        let report = run(&fixture);
        assert!(!report.success, "{mode}: {report:?}");
        assert!(report.first_failure.is_some());
        assert!(report.all_helpers_reaped, "{mode}: {report:?}");
        assert!(!fixture.path("removed").exists());
        assert!(fixture.path("created").is_file());
        assert!(
            fixture
                .events()
                .iter()
                .any(|event| event["event"] == "inspect"
                    && (event["value"]["image"] != fixture.config["imageId"]
                        || event["value"]["token"] != fixture.config["token"]))
        );
        assert!(!fixture.events().iter().any(|e| e["event"] == "remove"));
        fixture.assert_no_work();
    }
}

#[test]
fn extra_gpu_request_fails_c2_but_keeps_owned_cleanup_authority() {
    let fixture = Fixture::new("extra-gpu");
    let report = run(&fixture);
    assert!(!report.success, "{report:?}");
    assert!(report.first_failure.is_some());
    assert_owned_remove(&fixture, &report);
    fixture.assert_no_work();
}

#[test]
fn extra_bind_mount_fails_c13_but_keeps_owned_cleanup_authority() {
    let fixture = Fixture::new("extra-mount");
    let report = run(&fixture);
    assert!(!report.success, "{report:?}");
    assert!(report.first_failure.is_some());
    assert_owned_remove(&fixture, &report);
    fixture.assert_no_work();
}

#[test]
fn malformed_registered_query_never_creates_or_releases_work() {
    assert_rejected_before_create("malformed-query");
}

#[test]
fn low_registered_query_never_creates_or_releases_work() {
    assert_rejected_before_create("low-query");
}

#[test]
fn stalled_registered_query_expires_and_reaps_without_create() {
    assert_rejected_before_create("stalled-query");
}

#[test]
fn trailing_stdout_after_real_sqlite_commit_never_becomes_success() {
    let fixture = Fixture::new("trailing-stdout");
    let report = run(&fixture);
    assert!(!report.success, "{report:?}");
    assert!(report.first_failure.is_some());
    assert_removed(&fixture, &report);
    fixture.assert_completed();
    assert_eq!(fixture.frames().len(), 3);
    assert!(
        Path::new(
            fixture.registration["layout"]["stateRoot"]
                .as_str()
                .unwrap()
        )
        .join("private.sqlite")
        .is_file()
    );
}

#[test]
fn nonzero_attach_after_real_sqlite_commit_never_becomes_success() {
    let fixture = Fixture::new("nonzero-after-proposal");
    let report = run(&fixture);
    assert!(!report.success, "{report:?}");
    assert!(report.first_failure.is_some());
    assert_removed(&fixture, &report);
    fixture.assert_completed();
    assert_eq!(fixture.frames().len(), 3);
}

#[test]
fn empty_retained_cgroup_is_not_disappearance_before_original_final_deadline() {
    let fixture = Fixture::new("retained-cgroup");
    let clock = OffsetClock::new();
    let mut waiter = GuardedWaiter::new(&clock, &fixture, false);
    let report = run_once_with(fixture.request(), &clock, &mut waiter).unwrap();
    fixture.record_report(&report);
    fixture.assert_no_fixture_error();
    fixture.assert_helper_pids_gone();
    assert!(!report.success, "{report:?}");
    assert!(!report.training_ready);
    assert!(!report.cgroup_gone);
    assert!(report.all_helpers_reaped, "{report:?}");
    assert!(waiter.advanced_cleanup);
    assert!(clock.now_ns().unwrap() >= report.origin_ns + 300_000_000_000);
    assert!(fixture.path("leaf").is_dir());
    assert_eq!(
        fs::read(fixture.path("leaf").join("cgroup.procs")).unwrap(),
        b""
    );
    assert!(fixture.path("removed").is_file());
    fixture.assert_completed();
}

#[test]
fn evidence_path_failure_still_rechecks_ownership_binds_and_removes() {
    for mode in [
        "storage-failure",
        "storage-wrong-image",
        "storage-wrong-label",
    ] {
        let fixture = Fixture::new(mode);
        let report = run(&fixture);
        assert!(!report.success, "{mode}: {report:?}");
        let first = report.first_failure.as_deref().unwrap();
        assert!(
            first.contains("EVIDENCE") || first.contains("IO"),
            "{mode}: first failure {first}"
        );
        assert!(report.all_helpers_reaped, "{mode}: {report:?}");
        assert!(fixture.path("packetRoot").is_file());
        assert!(fixture.path("preservedPacket").is_dir());
        assert!(
            fs::read_dir(fixture.path("preservedPacket"))
                .unwrap()
                .next()
                .is_some()
        );
        let events = fixture.events();
        assert!(
            events.iter().filter(|e| e["event"] == "inspect").count() >= 2,
            "{mode}: {events:?}"
        );
        if mode == "storage-failure" {
            assert_removed(&fixture, &report);
        } else {
            assert!(
                !fixture.path("removed").exists(),
                "{mode}: removed unowned container"
            );
            assert!(!events.iter().any(|e| e["event"] == "remove"));
        }
        fixture.assert_no_work();
    }
}

#[test]
fn startup_before_complete_start_write_and_stdin_eof_is_rejected() {
    let fixture = Fixture::new("premature-startup");
    assert_eq!(
        fixture.manifest["job"]["jobInputJson"]
            .as_str()
            .unwrap()
            .len(),
        65_536
    );
    let clock = OffsetClock::new();
    let mut waiter = GuardedWaiter::new(&clock, &fixture, true);
    let report = run_once_with(fixture.request(), &clock, &mut waiter).unwrap();
    fixture.record_report(&report);
    fixture.assert_no_fixture_error();
    fixture.assert_helper_pids_gone();
    assert!(fixture.path("prematureSent").exists());
    assert!(
        !waiter.advanced_startup_guard,
        "owner accepted premature startup and entered ordinary work"
    );
    assert!(!report.success, "{report:?}");
    assert!(!report.training_ready);
    assert_eq!(report.first_failure.as_deref(), Some("WIRE_STARTUP"));
    assert_removed(&fixture, &report);
    fixture.assert_no_work();
}

struct ColdAfterQueueClock {
    origin: Cell<Option<i64>>,
    checks_after_start: Cell<usize>,
    start_path: PathBuf,
}
impl Clock for ColdAfterQueueClock {
    fn now_ns(&self) -> chess_coach_gpu_owner::Result<i64> {
        let now = Boottime.now_ns()?;
        let origin = match self.origin.get() {
            Some(origin) => origin,
            None => {
                self.origin.set(Some(now));
                now
            }
        };
        if self.start_path.exists() {
            let checks = self.checks_after_start.get().saturating_add(1);
            self.checks_after_start.set(checks);
            if checks >= 2 {
                return Ok(origin + 10_000_000_000);
            }
        }
        Ok(now)
    }
}

#[test]
fn cold_expiry_after_queueing_does_not_release_job_work_during_cleanup() {
    for mode in ["cold-after-queue", "cleanup-attach-overflow"] {
        let fixture = Fixture::new(mode);
        let clock = ColdAfterQueueClock {
            origin: Cell::new(None),
            checks_after_start: Cell::new(0),
            start_path: fixture.path("packetRoot").join("job-start.json"),
        };
        let report = run_once_with(fixture.request(), &clock, &mut LinuxWaiter).unwrap();
        fixture.record_report(&report);
        fixture.assert_no_fixture_error();
        fixture.assert_helper_pids_gone();
        assert!(clock.checks_after_start.get() >= 2);
        assert!(clock.start_path.is_file());
        assert_eq!(
            report.first_failure.as_deref(),
            Some("DEADLINE"),
            "{mode}: {report:?}"
        );
        assert!(!report.success);
        assert_removed(&fixture, &report);
        fixture.assert_no_work();
        if mode == "cleanup-attach-overflow" {
            assert!(
                report
                    .cleanup_errors
                    .iter()
                    .any(|error| error == "OUTPUT_BOUND"),
                "{report:?}"
            );
        } else {
            assert_eq!(
                fixture
                    .frames()
                    .iter()
                    .map(|frame| frame["kind"].as_str().unwrap())
                    .collect::<Vec<_>>(),
                ["boot"]
            );
        }
    }
}

#[test]
fn owner_rejects_evidence_inside_state_before_any_query_or_manager() {
    let mut fixture = Fixture::new("normal");
    let evidence = fixture.path("stateSource").join("owner-packet");
    fixture.manifest["evidence"]["exclusivePacketRoot"] = json!(evidence);
    let report = run(&fixture);
    assert_eq!(
        report.first_failure.as_deref(),
        Some("EVIDENCE_STATE_OVERLAP")
    );
    assert!(!report.success);
    assert!(!evidence.exists());
    assert!(!fixture.path("telemetryEvents").exists());
    assert!(fixture.events().is_empty());
    fixture.assert_no_work();
}

#[test]
fn state_path_substitution_stops_work_but_preserves_owned_cleanup() {
    for mode in [
        "state-replaced-before-create",
        "state-replaced-after-create",
        "state-replaced-running",
    ] {
        let fixture = Fixture::new(mode);
        let report = run(&fixture);
        assert_eq!(
            report.first_failure.as_deref(),
            Some("STATE_PATH_REPLACED"),
            "{mode}: {report:?}"
        );
        assert!(!report.success);
        assert!(report.all_helpers_reaped);
        assert!(fixture.path("stateReplaced").exists());
        assert!(fixture.path("preservedState").is_dir());
        fixture.assert_no_work();
        if mode == "state-replaced-before-create" {
            assert!(!fixture.path("created").exists());
            assert!(!fixture.path("removed").exists());
            assert!(fixture.events().is_empty());
        } else {
            assert_owned_remove(&fixture, &report);
            if mode == "state-replaced-running" {
                assert!(report.cgroup_gone, "{report:?}");
            }
        }
    }
}

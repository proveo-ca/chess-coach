// SPEC: _spec/apps/arena/burn-compat.puml
use arena::record::{MatchSpec, RunRecord, RunStop};
use arena::run::run_match;
use serde_json::{Value, json};
use std::sync::OnceLock;

pub fn spec(fixture: &str, windows: u32) -> MatchSpec {
    serde_json::from_value(json!({"version":"arena-match-v1","caseId":"economic-control","fixture":fixture,
        "players":{"w":"pass-v1","b":"pass-v1"},"environmentSeed":0,"policySeeds":{"w":1,"b":2},"maxWindows":windows})).unwrap()
}

pub fn limited() -> &'static RunRecord {
    static RECORD: OnceLock<RunRecord> = OnceLock::new();
    RECORD.get_or_init(|| {
        let record = run_match(&spec("tiny-v1", 1)).unwrap();
        assert_eq!(record.stop, RunStop::WindowLimit);
        record
    })
}

pub fn analyze(record: &RunRecord) -> (bool, Value) {
    let analysis = arena::economic::analyze_record(record).unwrap();
    (
        analysis.is_verified(),
        serde_json::to_value(analysis.report()).unwrap(),
    )
}

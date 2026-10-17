// SPEC: _spec/apps/arena/burn-compat.puml
use crate::evaluation::{CaseResult, Evaluation, evaluate};
use crate::record::object_struct;
use crate::record::*;
use crate::replay::{VerificationKind, replay_record};
use crate::run::run_match;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(try_from = "String")]
pub enum ScheduleVersion {
    #[serde(rename = "arena-schedule-v1")]
    V1,
}

impl TryFrom<String> for ScheduleVersion {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        match value.as_str() {
            "arena-schedule-v1" => Ok(Self::V1),
            _ => Err(format!("Invalid ScheduleVersion: {value}")),
        }
    }
}

object_struct! {
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SuiteSpec {
    pub version: ScheduleVersion,
    pub fixtures: Vec<FixtureId>,
    pub pairings: Vec<Pair<BaselinePolicy>>,
    pub repeats: u32,
    pub environment_seed: u32,
    pub policy_seed: u32,
    pub max_windows: u32,
}
}

impl SuiteSpec {
    pub fn validate(&self) -> Result<usize, String> {
        if !(1..=16).contains(&self.repeats)
            || !(1..=45).contains(&self.max_windows)
            || self.fixtures.is_empty()
            || self.pairings.is_empty()
            || self.fixtures.len() > 64
            || self.pairings.len() > 64
        {
            return Err("Schedule requires repeats 1..16, maxWindows 1..45 and nonempty bounded fixtures/pairings".into());
        }
        let total = self
            .fixtures
            .len()
            .checked_mul(self.pairings.len())
            .and_then(|n| n.checked_mul(self.repeats as usize))
            .ok_or("Schedule size overflow")?;
        if total > 64 {
            return Err("Schedule exceeds 64 cases".into());
        }
        Ok(total)
    }
}

pub fn expand_schedule(spec: &SuiteSpec) -> Result<Vec<MatchSpec>, String> {
    let total = spec.validate()?;
    let mut cases = Vec::with_capacity(total);
    for _ in 0..spec.repeats {
        for fixture in &spec.fixtures {
            for players in &spec.pairings {
                let index = cases.len() as u32;
                cases.push(MatchSpec {
                    version: MatchVersion::V1,
                    case_id: format!("case-{index}"),
                    fixture: *fixture,
                    players: players.clone(),
                    environment_seed: spec.environment_seed.wrapping_add(index),
                    policy_seeds: Pair {
                        w: spec.policy_seed.wrapping_add(index.wrapping_mul(2)),
                        b: spec
                            .policy_seed
                            .wrapping_add(index.wrapping_mul(2))
                            .wrapping_add(1),
                    },
                    max_windows: spec.max_windows,
                });
            }
        }
    }
    Ok(cases)
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuiteCase {
    pub case_id: String,
    pub record: String,
    pub verified: bool,
    pub classification: Option<VerificationKind>,
    pub error: Option<String>,
    pub verified_prefix_windows: u32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuiteReport {
    pub version: &'static str,
    pub assurance: &'static str,
    pub learned: bool,
    pub model_artifact: Option<()>,
    pub full_runner: bool,
    pub spec: SuiteSpec,
    pub cases: Vec<SuiteCase>,
    pub evaluation: Evaluation,
}

pub struct SuiteRun {
    pub records: Vec<RunRecord>,
    pub summary: SuiteReport,
}

pub fn run_suite(spec: &SuiteSpec) -> Result<SuiteRun, String> {
    let schedule = expand_schedule(spec)?;
    let mut records = Vec::with_capacity(schedule.len());
    let mut reports = Vec::with_capacity(schedule.len());
    let mut results = Vec::with_capacity(schedule.len());
    for (index, case) in schedule.into_iter().enumerate() {
        let record = run_match(&case)?;
        let mut report = SuiteCase {
            case_id: case.case_id.clone(),
            record: format!("case-{index:04}.json"),
            verified: false,
            classification: None,
            error: None,
            verified_prefix_windows: 0,
        };
        match replay_record(&record) {
            Ok(verified) => {
                report.verified = true;
                report.classification = Some(verified.kind());
                report.verified_prefix_windows = verified.completed_windows();
                results.push(CaseResult::Verified(verified));
            }
            Err(error) => {
                report.error = Some(error.message.clone());
                report.verified_prefix_windows = error.verified_prefix_windows;
                results.push(CaseResult::FailedUnverified {
                    spec: case,
                    message: error.message,
                });
            }
        }
        records.push(record);
        reports.push(report);
    }
    let evaluation = evaluate(&results)?;
    Ok(SuiteRun {
        records,
        summary: SuiteReport {
            version: "arena-suite-v1",
            assurance: "NON_ADMITTED",
            learned: false,
            model_artifact: None,
            full_runner: true,
            spec: spec.clone(),
            cases: reports,
            evaluation,
        },
    })
}

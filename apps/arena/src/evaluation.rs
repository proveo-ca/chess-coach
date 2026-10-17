// SPEC: _spec/apps/arena/burn-compat.puml
use crate::record::{BaselinePolicy, MatchSpec};
use crate::replay::{VerificationKind, VerifiedRun};
use serde::Serialize;
use std::collections::BTreeMap;
use training_native::contracts::Side;

pub enum CaseResult {
    Verified(VerifiedRun),
    FailedUnverified { spec: MatchSpec, message: String },
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeatResults {
    pub appearances: u32,
    pub wins: u32,
    pub draws: u32,
    pub losses: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Evaluation {
    pub version: &'static str,
    pub assurance: &'static str,
    pub learned: bool,
    pub model_artifact: Option<()>,
    pub learned_pass: bool,
    pub scheduled: u32,
    pub verified_terminal: u32,
    pub verified_window_limited: u32,
    pub failed_unverified: u32,
    pub verified_native_rejections: u32,
    pub policies: BTreeMap<String, SeatResults>,
}

pub fn evaluate(cases: &[CaseResult]) -> Result<Evaluation, String> {
    if cases.len() > 64 {
        return Err("Evaluation exceeds 64 scheduled cases".into());
    }
    let mut report = Evaluation {
        version: "arena-evaluation-v1",
        assurance: "NON_ADMITTED",
        learned: false,
        model_artifact: None,
        learned_pass: false,
        scheduled: cases.len() as u32,
        verified_terminal: 0,
        verified_window_limited: 0,
        failed_unverified: 0,
        verified_native_rejections: 0,
        policies: BTreeMap::new(),
    };
    for case in cases {
        let spec = match case {
            CaseResult::Verified(run) => run.spec(),
            CaseResult::FailedUnverified { spec, .. } => spec,
        };
        for side in [Side::White, Side::Black] {
            report
                .policies
                .entry(policy_name(*spec.players.get(side))?)
                .or_default()
                .appearances += 1;
        }
        match case {
            CaseResult::Verified(run) => match run.kind() {
                VerificationKind::Terminal => {
                    let outcome = run
                        .outcome()
                        .ok_or("Verified terminal is missing its native outcome")?;
                    report.verified_terminal += 1;
                    for side in [Side::White, Side::Black] {
                        let key = policy_name(*run.spec().players.get(side))?;
                        let results = report.policies.entry(key).or_default();
                        if outcome.draw {
                            results.draws += 1;
                        } else if outcome.winner == Some(side) {
                            results.wins += 1;
                        } else {
                            results.losses += 1;
                        }
                    }
                }
                VerificationKind::WindowLimited => {
                    report.verified_window_limited += 1;
                }
                VerificationKind::NativeRejection => {
                    report.failed_unverified += 1;
                    report.verified_native_rejections += 1;
                }
            },
            CaseResult::FailedUnverified { .. } => {
                report.failed_unverified += 1;
            }
        }
    }
    if report.scheduled
        != report.verified_terminal + report.verified_window_limited + report.failed_unverified
    {
        return Err("Evaluation denominator does not conserve scheduled cases".into());
    }
    Ok(report)
}

fn policy_name(policy: BaselinePolicy) -> Result<String, String> {
    serde_json::to_value(policy)
        .map_err(|e| e.to_string())?
        .as_str()
        .map(str::to_owned)
        .ok_or("Policy ID must be a string".into())
}

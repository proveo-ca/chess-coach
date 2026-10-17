// SPEC: _spec/apps/arena/burn-compat.puml
#![forbid(unsafe_code)]

mod bridge;
pub mod cli;
mod engine_v2;
pub mod evaluation;
mod features;
mod observation;
mod protocol;
pub mod record;
pub mod replay;
pub mod run;
pub mod schedule;

use features::{FeatureMatrix, ScoredCandidate, Selection};
use observation::Observation;
use protocol::{Action, Bank, EngineResult};
use serde::Serialize;

pub type ArenaResult<T> = Result<T, String>;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SmokeReport {
    milestone: &'static str,
    scope: &'static str,
    assurance: &'static str,
    full_runner: bool,
    model_artifact: Option<()>,
    observation: Observation,
    features: FeatureMatrix,
    candidates: Vec<ScoredCandidate>,
    scores: Vec<f64>,
    selected: Selection,
    opponent: Opponent,
    #[serde(flatten)]
    engine: EngineResult,
}

#[derive(Debug, Serialize)]
struct Opponent {
    side: &'static str,
    decision: &'static str,
}

pub fn run_smoke() -> ArenaResult<SmokeReport> {
    let observation = bridge::open()?;
    let actions = features::synthetic_candidates(&observation)?;
    let features = features::synthetic_features(&actions);
    let scores = training_native::score_synthetic_f64(&features.values, features.rows)
        .map_err(|error| format!("Burn scoring failed: {error}"))?;
    let selected = features::select_highest_score(&actions, &scores)?;
    let (settled_observation, engine) = bridge::settle(&selected.action)?;
    if settled_observation != observation {
        return Err("Engine reconstructed a different open observation".into());
    }
    validate_tiny_result(&engine, &selected.action)?;
    let candidates = actions
        .into_iter()
        .zip(scores.iter().copied())
        .map(|(action, score)| ScoredCandidate {
            key: action.canonical_key(),
            action,
            score,
        })
        .collect();
    Ok(SmokeReport {
        milestone: "burn-flex-compat-v1",
        scope: "synthetic",
        assurance: "NON_ADMITTED",
        full_runner: false,
        model_artifact: None,
        observation,
        features,
        candidates,
        scores,
        selected,
        opponent: Opponent {
            side: "b",
            decision: "pass",
        },
        engine,
    })
}

fn validate_tiny_result(engine: &EngineResult, selected: &Action) -> ArenaResult<()> {
    if engine.requested_actions.w.as_slice() != [selected.clone()]
        || !engine.requested_actions.b.is_empty()
    {
        return Err(
            "Engine requested actions differ from the selected action and black pass".into(),
        );
    }
    if engine.bank_before != (Bank { w: 3, b: 3 })
        || engine.bank_committed != engine.bank_before
        || engine.bank_after != (Bank { w: 4, b: 4 })
    {
        return Err(
            "Engine bank differs from the tiny fixture's zero-spend, one-income proof".into(),
        );
    }
    Ok(())
}

// SPEC: _spec/packages/training/burn-compat.puml
#![forbid(unsafe_code)]

pub mod accounting_kernel;
pub mod artifact_bytes;
pub mod artifacts;
pub mod banded_joint;
pub mod candidates;
pub mod checkpoint;
pub mod contracts;
pub mod evidence_tables;
pub mod feature_input;
pub mod feature_manifest;
pub mod features;
mod inference;
pub mod joint_accounting;
pub mod joint_math;
pub mod learner_math;
pub mod ledger;
mod model;
pub mod numerical_belief;
#[cfg(test)]
mod offline_trainer;
pub mod policy;
pub mod policy_weights;
pub mod protocol;
mod runtime;
mod synthetic_batch;
pub mod transition_tables;

pub use inference::{SyntheticInferenceContext, score_synthetic_f64};
pub use runtime::F64Runtime;

pub const COLUMNS: usize = 418;
pub const MAX_ROWS: usize = 512;
pub const MAX_ABS_VALUE: f64 = 1_000_000.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    BadRequest,
    Shape,
    NonFinite,
    BackendFailure,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ScoreError {
    pub code: ErrorCode,
    pub message: &'static str,
}

impl ScoreError {
    pub(crate) const fn new(code: ErrorCode, message: &'static str) -> Self {
        Self { code, message }
    }
}

impl std::fmt::Display for ScoreError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.message)
    }
}

impl std::error::Error for ScoreError {}

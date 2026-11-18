// SPEC: _spec/learning.puml
use burn::tensor::activation::log_softmax;
use burn::tensor::{Device, Tensor};

use crate::{FeatureBatch, PolicyModel};

pub const MAX_SAMPLED_DECISIONS: usize = 64;
pub const LEARNING_RATE: f64 = 0.001;
pub const L2: f64 = 0.0001;
pub const POLICY_TEMPERATURE: f64 = 1.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EpisodeError {
    Selected,
    DecisionLimit,
    Baseline,
    Return,
}

#[derive(Clone, Debug)]
pub struct SampledDecision {
    features: FeatureBatch,
    selected: usize,
}

impl SampledDecision {
    pub fn new(features: FeatureBatch, selected: usize) -> Result<Self, EpisodeError> {
        if selected >= features.rows() {
            return Err(EpisodeError::Selected);
        }
        Ok(Self { features, selected })
    }
}

#[derive(Clone, Debug)]
pub struct Episode {
    decisions: Vec<SampledDecision>,
    advantage: f64,
}

impl Episode {
    pub fn new(
        decisions: Vec<SampledDecision>,
        frozen_baseline: f64,
        return_value: i8,
    ) -> Result<Self, EpisodeError> {
        if decisions.len() > MAX_SAMPLED_DECISIONS {
            return Err(EpisodeError::DecisionLimit);
        }
        if !frozen_baseline.is_finite() || !(-1.0..=1.0).contains(&frozen_baseline) {
            return Err(EpisodeError::Baseline);
        }
        if !(-1..=1).contains(&return_value) {
            return Err(EpisodeError::Return);
        }
        Ok(Self {
            decisions,
            advantage: f64::from(return_value) - frozen_baseline,
        })
    }

    pub fn objective(&self, model: &PolicyModel, device: &Device) -> Option<Tensor<1>> {
        if self.decisions.is_empty() {
            return None;
        }
        let mut log_probability_sum = Tensor::<1>::zeros([1], device);
        for decision in &self.decisions {
            let logits = model.logits(&decision.features, device) / POLICY_TEMPERATURE;
            let log_probabilities = log_softmax(logits, 0);
            log_probability_sum =
                log_probability_sum + log_probabilities.narrow(0, decision.selected, 1);
        }
        Some(log_probability_sum * -self.advantage + model.squared_norm() * (L2 / 2.0))
    }
}

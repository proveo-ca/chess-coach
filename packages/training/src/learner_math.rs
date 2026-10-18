// SPEC: _spec/packages/training/burn-compat.puml
pub type Vector418 = [f64; 418];

pub const LEARNING_RATE: f64 = 0.001;
pub const POLICY_TEMPERATURE: f64 = 1.0;
pub const L2: f64 = 0.0001;

const MAX_CANDIDATES: usize = 512;
const MAX_SAMPLED_DECISIONS: usize = 64;
const NORMALIZATION_TOLERANCE: f64 = 1e-12;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MathError {
    Shape,
    Domain,
    NonFinite,
    DecisionLimit,
}

pub type MathResult<T> = Result<T, MathError>;

#[derive(Debug)]
pub struct Distribution {
    probabilities: Vec<f64>,
    log_probabilities: Vec<f64>,
}

impl Distribution {
    pub fn len(&self) -> usize {
        self.probabilities.len()
    }

    pub fn is_empty(&self) -> bool {
        self.probabilities.is_empty()
    }

    pub fn probabilities(&self) -> &[f64] {
        &self.probabilities
    }

    pub fn log_probabilities(&self) -> &[f64] {
        &self.log_probabilities
    }
}

#[derive(Debug)]
pub struct DecisionStatistics {
    delta: Vector418,
    selected_log_probability: f64,
}

#[derive(Debug)]
pub struct EpisodeStatistics {
    sampled_decisions: usize,
    score_accumulator: Vector418,
    log_probability_sum: f64,
}

impl Default for EpisodeStatistics {
    fn default() -> Self {
        Self::new()
    }
}

impl EpisodeStatistics {
    pub fn new() -> Self {
        Self {
            sampled_decisions: 0,
            score_accumulator: [0.0; 418],
            log_probability_sum: 0.0,
        }
    }

    pub fn append(&mut self, decision: &DecisionStatistics) -> MathResult<()> {
        let sampled_decisions = self
            .sampled_decisions
            .checked_add(1)
            .filter(|count| *count <= MAX_SAMPLED_DECISIONS)
            .ok_or(MathError::DecisionLimit)?;
        let mut score_accumulator = [0.0; 418];
        for (index, coordinate) in score_accumulator.iter_mut().enumerate() {
            let previous = finite(self.score_accumulator[index])?;
            let increment = finite(decision.delta[index])?;
            *coordinate = finite(previous + increment)?;
        }
        let previous_log_probability = finite(self.log_probability_sum)?;
        let selected_log_probability = finite(decision.selected_log_probability)?;
        let log_probability_sum = finite(previous_log_probability + selected_log_probability)?;
        self.sampled_decisions = sampled_decisions;
        self.score_accumulator = score_accumulator;
        self.log_probability_sum = log_probability_sum;
        Ok(())
    }

    pub fn sampled_decisions(&self) -> usize {
        self.sampled_decisions
    }

    pub fn score_accumulator(&self) -> &Vector418 {
        &self.score_accumulator
    }

    pub fn log_probability_sum(&self) -> f64 {
        self.log_probability_sum
    }
}

#[derive(Debug)]
pub struct SgdProposal {
    pub gradient: Vector418,
    pub proposed_weights: Vector418,
    pub objective: f64,
    pub nonzero_pg: bool,
}

pub fn zero_weights() -> Vector418 {
    [0.0; 418]
}

pub fn linear_logit(weights: &Vector418, features: &Vector418) -> MathResult<f64> {
    let mut total = 0.0;
    for (weight, feature) in weights.iter().zip(features) {
        let weight = finite(*weight)?;
        let feature = finite(*feature)?;
        let product = finite(weight * feature)?;
        total = finite(total + product)?;
    }
    Ok(total)
}

pub fn softmax(logits: &[f64]) -> MathResult<Distribution> {
    if logits.is_empty() || logits.len() > MAX_CANDIDATES {
        return Err(MathError::Shape);
    }
    let mut maximum = finite(logits[0])?;
    for logit in logits {
        let logit = finite(*logit)?;
        if logit > maximum {
            maximum = logit;
        }
    }
    let mut probabilities = Vec::with_capacity(logits.len());
    let mut log_probabilities = Vec::with_capacity(logits.len());
    let mut normalizer = 0.0;
    for logit in logits {
        let difference = finite(*logit - maximum)?;
        let shifted = finite(difference / POLICY_TEMPERATURE)?;
        let exponential = finite(shifted.exp())?;
        normalizer = finite(normalizer + exponential)?;
        probabilities.push(exponential);
        log_probabilities.push(shifted);
    }
    let log_normalizer = finite(normalizer.ln())?;
    let mut probability_sum = 0.0;
    for index in 0..logits.len() {
        let probability = finite(probabilities[index] / normalizer)?;
        if !(0.0..=1.0).contains(&probability) {
            return Err(MathError::NonFinite);
        }
        probabilities[index] = probability;
        log_probabilities[index] = finite(log_probabilities[index] - log_normalizer)?;
        probability_sum = finite(probability_sum + probability)?;
    }
    if finite(probability_sum - 1.0)?.abs() > NORMALIZATION_TOLERANCE {
        return Err(MathError::NonFinite);
    }
    Ok(Distribution {
        probabilities,
        log_probabilities,
    })
}

pub fn sample_index(distribution: &Distribution, uniform: f64) -> MathResult<usize> {
    let uniform = finite(uniform)?;
    if !(0.0..1.0).contains(&uniform) {
        return Err(MathError::Domain);
    }
    let mut cumulative = 0.0;
    let mut last_nonzero = None;
    for (index, probability) in distribution.probabilities.iter().enumerate() {
        let probability = finite(*probability)?;
        cumulative = finite(cumulative + probability)?;
        if probability > 0.0 {
            last_nonzero = Some(index);
            if cumulative > uniform {
                return Ok(index);
            }
        }
    }
    if finite(cumulative - 1.0)?.abs() <= NORMALIZATION_TOLERANCE {
        last_nonzero.ok_or(MathError::NonFinite)
    } else {
        Err(MathError::NonFinite)
    }
}

pub fn decision_statistics(
    distribution: &Distribution,
    selected: usize,
    mut feature_at: impl FnMut(usize) -> MathResult<Vector418>,
) -> MathResult<DecisionStatistics> {
    if selected >= distribution.len() {
        return Err(MathError::Shape);
    }
    let selected_log_probability = finite(distribution.log_probabilities[selected])?;
    let mut weighted_features = [0.0; 418];
    let mut selected_features = [0.0; 418];
    for (index, probability) in distribution.probabilities.iter().enumerate() {
        let row = feature_at(index)?;
        let probability = finite(*probability)?;
        for (coordinate, feature) in row.iter().enumerate() {
            let feature = finite(*feature)?;
            let product = finite(probability * feature)?;
            weighted_features[coordinate] = finite(weighted_features[coordinate] + product)?;
        }
        if index == selected {
            selected_features = row;
        }
    }
    for (coordinate, feature) in selected_features.iter_mut().enumerate() {
        *feature = finite(*feature - weighted_features[coordinate])?;
    }
    Ok(DecisionStatistics {
        delta: selected_features,
        selected_log_probability,
    })
}

pub fn sgd_proposal(
    frozen_weights: &Vector418,
    frozen_baseline: f64,
    return_value: i8,
    episode: &EpisodeStatistics,
) -> MathResult<Option<SgdProposal>> {
    validate_vector(frozen_weights)?;
    let frozen_baseline = finite(frozen_baseline)?;
    if !(-1.0..=1.0).contains(&frozen_baseline) || !(-1..=1).contains(&return_value) {
        return Err(MathError::Domain);
    }
    if episode.sampled_decisions == 0 {
        return Ok(None);
    }
    let advantage = finite(f64::from(return_value) - frozen_baseline)?;
    let negative_advantage = finite(-advantage)?;
    let mut norm_squared = 0.0;
    let mut gradient = [0.0; 418];
    let mut proposed_weights = [0.0; 418];
    let mut nonzero_pg = false;
    for (index, weight) in frozen_weights.iter().enumerate() {
        let squared = finite(*weight * *weight)?;
        norm_squared = finite(norm_squared + squared)?;
        let score = finite(episode.score_accumulator[index])?;
        let policy_gradient = finite(negative_advantage * score)?;
        nonzero_pg |= policy_gradient != 0.0;
        let regularization_gradient = finite(L2 * *weight)?;
        gradient[index] = finite(policy_gradient + regularization_gradient)?;
        let step = finite(LEARNING_RATE * gradient[index])?;
        proposed_weights[index] = finite(*weight - step)?;
    }
    let sum_log_probability = finite(episode.log_probability_sum)?;
    let policy_loss = finite(negative_advantage * sum_log_probability)?;
    let regularized_norm = finite(L2 * norm_squared)?;
    let regularization_loss = finite(regularized_norm / 2.0)?;
    let objective = finite(policy_loss + regularization_loss)?;
    Ok(Some(SgdProposal {
        gradient,
        proposed_weights,
        objective,
        nonzero_pg,
    }))
}

fn validate_vector(vector: &Vector418) -> MathResult<()> {
    for value in vector {
        finite(*value)?;
    }
    Ok(())
}

fn finite(value: f64) -> MathResult<f64> {
    if value.is_finite() {
        Ok(value)
    } else {
        Err(MathError::NonFinite)
    }
}

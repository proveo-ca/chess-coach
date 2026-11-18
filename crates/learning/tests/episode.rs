// SPEC: _spec/learning.puml
mod common;

use burn::optim::{GradientsParams, SgdConfig};
use burn::tensor::{Device, Tensor};
use chess_coach_learning::{
    Episode, EpisodeError, FEATURES, FeatureBatch, LEARNING_RATE, MAX_SAMPLED_DECISIONS,
    PolicyModel, SampledDecision,
};
use common::{controlled_model, device};

fn features() -> FeatureBatch {
    let mut values = vec![0.0; 2 * FEATURES];
    values[0] = 1.0;
    values[1] = 2.0;
    values[FEATURES] = 3.0;
    values[FEATURES + 1] = 4.0;
    FeatureBatch::new(values, 2).unwrap()
}

fn values(tensor: Tensor<1>) -> Vec<f64> {
    tensor.into_data().try_to_vec::<f64>().unwrap()
}

fn assert_close(actual: f64, expected: f64) {
    assert!((actual - expected).abs() <= 1e-12, "{actual} != {expected}");
}

#[test]
fn rejects_invalid_selected_candidates_and_episode_domains() {
    for selected in [2, usize::MAX] {
        assert!(matches!(
            SampledDecision::new(features(), selected),
            Err(EpisodeError::Selected)
        ));
    }
    for baseline in [f64::NAN, f64::INFINITY, -1.0001, 1.0001] {
        assert!(matches!(
            Episode::new(vec![], baseline, 0),
            Err(EpisodeError::Baseline)
        ));
    }
    for return_value in [i8::MIN, -2, 2, i8::MAX] {
        assert!(matches!(
            Episode::new(vec![], 0.0, return_value),
            Err(EpisodeError::Return)
        ));
    }
    for baseline in [-1.0, 1.0] {
        assert!(Episode::new(vec![], baseline, 1).is_ok());
    }
}

#[test]
fn enforces_the_inclusive_sample_limit() {
    let decision = SampledDecision::new(features(), 0).unwrap();
    assert!(Episode::new(vec![decision.clone(); MAX_SAMPLED_DECISIONS], 0.0, 0).is_ok());
    assert!(matches!(
        Episode::new(vec![decision; MAX_SAMPLED_DECISIONS + 1], 0.0, 0),
        Err(EpisodeError::DecisionLimit)
    ));
}

#[test]
fn empty_episode_produces_no_update_objective() {
    let device = device();
    let model = PolicyModel::new(&device);
    assert!(
        Episode::new(vec![], 0.0, 1)
            .unwrap()
            .objective(&model, &device)
            .is_none()
    );
}

fn policy_updated_model(device: &Device) -> PolicyModel {
    let model = controlled_model(device);
    let decision = SampledDecision::new(features(), 0).unwrap();
    let episode = Episode::new(vec![decision; 2], 0.0, 1).unwrap();
    let objective = episode.objective(&model, device).unwrap();
    assert_close(
        values(objective.clone())[0],
        2.0 * std::f64::consts::LN_2 + 0.0001,
    );
    let gradients = GradientsParams::from_grads(objective.backward(), &model);
    let mut optimizer = SgdConfig::new().init();
    let updated = optimizer.step(LEARNING_RATE, model, gradients);
    let logits = values(updated.logits(&features(), device));
    assert_close(logits[0], -0.006 * (1.0 - 1e-7));
    assert_close(logits[1], -0.014 * (1.0 - 1e-7));
    updated
}

#[test]
fn burn_preserves_the_summed_episode_policy_gradient() {
    let _ = policy_updated_model(&device().autodiff());
}

#[test]
fn frozen_baseline_scales_the_selected_log_probability_gradient() {
    let device = device().autodiff();
    let model = controlled_model(&device);
    let decision = SampledDecision::new(features(), 1).unwrap();
    let episode = Episode::new(vec![decision], 0.5, 1).unwrap();
    let objective = episode.objective(&model, &device).unwrap();
    assert_close(
        values(objective.clone())[0],
        0.5 * std::f64::consts::LN_2 + 0.0001,
    );
    let gradients = GradientsParams::from_grads(objective.backward(), &model);
    let mut optimizer = SgdConfig::new().init();
    let updated = optimizer.step(LEARNING_RATE, model, gradients);
    let logits = values(updated.logits(&features(), &device));
    assert_close(logits[0], 0.0015 * (1.0 - 1e-7));
    assert_close(logits[1], 0.0035 * (1.0 - 1e-7));
}

#[test]
fn zero_advantage_keeps_l2_but_empty_episodes_skip_it() {
    let device = device().autodiff();
    let model = policy_updated_model(&device);
    let decision = SampledDecision::new(features(), 0).unwrap();
    let episode = Episode::new(vec![decision], 1.0, 1).unwrap();
    let objective = episode.objective(&model, &device).unwrap();
    let decay = 1.0 - 1e-7;
    assert_close(values(objective.clone())[0], 0.0001 * decay * decay + 4e-10);
    let gradients = GradientsParams::from_grads(objective.backward(), &model);
    let mut optimizer = SgdConfig::new().init();
    let updated = optimizer.step(LEARNING_RATE, model, gradients);
    let logits = values(updated.logits(&features(), &device));
    assert_close(logits[0], -0.006 * decay.powi(3));
    assert_close(logits[1], -0.014 * decay.powi(3));
    assert!(
        Episode::new(vec![], 1.0, 1)
            .unwrap()
            .objective(&updated, &device)
            .is_none()
    );
}

// SPEC: _spec/learning-runtime.puml
mod common;

use burn::module::{Module, ModuleVisitor, Param};
use burn::optim::{GradientsParams, SgdConfig};
use burn::store::ModuleRecord;
use burn::tensor::Tensor;
use chess_coach_learning::{
    AccumulatedEpisode, AccumulationError, Episode, FEATURES, FeatureBatch, LEARNING_RATE,
    MAX_SAMPLED_DECISIONS, PolicyModel, SampledDecision,
};
use common::{controlled_model, device};

fn features() -> FeatureBatch {
    let mut values = vec![0.0; 3 * FEATURES];
    for row in 0..3 {
        values[row * FEATURES] = f64::from(row as u32) + 1.0;
        values[row * FEATURES + 1] = 4.0 - f64::from(row as u32);
    }
    FeatureBatch::new(values, 3).unwrap()
}

fn parameters(model: &PolicyModel) -> Vec<Vec<f64>> {
    struct Read(Vec<Vec<f64>>);
    impl ModuleVisitor for Read {
        fn visit_float<const D: usize>(&mut self, param: &Param<Tensor<D>>) {
            self.0
                .push(param.val().into_data().try_to_vec::<f64>().unwrap());
        }
    }
    let mut read = Read(vec![]);
    model.visit(&mut read);
    read.0
}

#[test]
fn framework_accumulation_matches_the_whole_episode_objective_and_sgd() {
    let device = device().autodiff();
    let batch = features();
    let seed_model = controlled_model(&device);
    let seed_episode = Episode::new(
        vec![SampledDecision::new(batch.clone(), 0).unwrap()],
        0.0,
        1,
    )
    .unwrap();
    let grads = GradientsParams::from_grads(
        seed_episode
            .objective(&seed_model, &device)
            .unwrap()
            .backward(),
        &seed_model,
    );
    let mut optimizer = SgdConfig::new().init();
    let nonzero_head = optimizer.step(LEARNING_RATE, seed_model.clone(), grads);
    for frozen in [seed_model, nonzero_head] {
        for (baseline, reward) in [(0.0, 1), (0.5, -1), (1.0, 1), (-1.0, 0)] {
            let before = parameters(&frozen);
            let indices = [0, 2, 1];
            let episode = Episode::new(
                indices
                    .iter()
                    .map(|index| SampledDecision::new(batch.clone(), *index).unwrap())
                    .collect(),
                baseline,
                reward,
            )
            .unwrap();
            let objective = episode.objective(&frozen, &device).unwrap();
            let expected_loss = objective.clone().into_data().try_to_vec::<f64>().unwrap()[0];
            let gradients = GradientsParams::from_grads(objective.backward(), &frozen);
            let mut optimizer = SgdConfig::new().init();
            let expected = optimizer.step(LEARNING_RATE, frozen.clone(), gradients);
            let mut accumulated =
                AccumulatedEpisode::new(frozen.clone(), device.clone(), baseline).unwrap();
            for index in indices {
                accumulated.acknowledge(&batch, index).unwrap();
            }
            let proposal = accumulated.finish(reward).unwrap().unwrap();
            assert_eq!(proposal.sampled_decisions, indices.len());
            assert!((proposal.objective - expected_loss).abs() <= 1e-12);
            for (actual, expected) in parameters(&proposal.model)
                .into_iter()
                .flatten()
                .zip(parameters(&expected).into_iter().flatten())
            {
                assert!((actual - expected).abs() <= 1e-12);
            }
            assert_eq!(parameters(&frozen), before);
            if baseline == f64::from(reward) {
                assert!(!proposal.nonzero_policy_gradient);
            }
        }
    }
}

#[test]
fn empty_single_candidate_and_zero_advantage_do_not_invent_policy_updates() {
    let device = device().autodiff();
    let model = controlled_model(&device);
    assert!(
        AccumulatedEpisode::new(model.clone(), device.clone(), 0.0)
            .unwrap()
            .finish(1)
            .unwrap()
            .is_none()
    );
    let batch = FeatureBatch::new(vec![1.0; FEATURES], 1).unwrap();
    let mut accumulated = AccumulatedEpisode::new(model, device, 0.0).unwrap();
    accumulated.acknowledge(&batch, 0).unwrap();
    let proposal = accumulated.finish(1).unwrap().unwrap();
    assert!(!proposal.nonzero_policy_gradient);
    assert!((proposal.objective - 0.0001).abs() <= 1e-12);
}

#[test]
fn invalid_acknowledgement_closes_the_episode_and_sample_cap_is_inclusive() {
    let device = device().autodiff();
    let model = controlled_model(&device);
    let mut invalid = AccumulatedEpisode::new(model.clone(), device.clone(), 0.0).unwrap();
    assert_eq!(
        invalid.acknowledge(&features(), 3),
        Err(AccumulationError::Selected)
    );
    assert_eq!(
        invalid.acknowledge(&features(), 0),
        Err(AccumulationError::Closed)
    );
    assert!(matches!(invalid.finish(1), Err(AccumulationError::Closed)));
    let batch = FeatureBatch::new(vec![0.0; FEATURES], 1).unwrap();
    let mut accepted = AccumulatedEpisode::new(model.clone(), device.clone(), 0.0).unwrap();
    for _ in 0..MAX_SAMPLED_DECISIONS {
        accepted.acknowledge(&batch, 0).unwrap();
    }
    assert_eq!(
        accepted.finish(0).unwrap().unwrap().sampled_decisions,
        MAX_SAMPLED_DECISIONS
    );
    let mut overflow = AccumulatedEpisode::new(model, device, 0.0).unwrap();
    for _ in 0..MAX_SAMPLED_DECISIONS {
        overflow.acknowledge(&batch, 0).unwrap();
    }
    assert_eq!(
        overflow.acknowledge(&batch, 0),
        Err(AccumulationError::DecisionLimit)
    );
    assert!(matches!(overflow.finish(0), Err(AccumulationError::Closed)));
}

#[test]
fn baseline_return_and_device_domains_fail_before_update() {
    let device = device().autodiff();
    for baseline in [f64::NAN, f64::INFINITY, -1.00001, 1.00001] {
        assert!(matches!(
            AccumulatedEpisode::new(controlled_model(&device), device.clone(), baseline),
            Err(AccumulationError::Baseline)
        ));
    }
    assert!(matches!(
        AccumulatedEpisode::new(
            controlled_model(&device).valid(),
            device.clone().without_autodiff(),
            0.0
        ),
        Err(AccumulationError::Device)
    ));
    assert!(matches!(
        AccumulatedEpisode::new(controlled_model(&device).valid(), device.clone(), 0.0),
        Err(AccumulationError::Device)
    ));
    assert!(matches!(
        AccumulatedEpisode::new(controlled_model(&device), device, 0.0)
            .unwrap()
            .finish(2),
        Err(AccumulationError::Return)
    ));
}

#[test]
fn proposed_update_round_trips_through_a_burn_native_record() {
    let device = device().autodiff();
    let mut accumulated =
        AccumulatedEpisode::new(controlled_model(&device), device.clone(), 0.0).unwrap();
    accumulated.acknowledge(&features(), 0).unwrap();
    let model = accumulated.finish(1).unwrap().unwrap().model.valid();
    let expected = parameters(&model);
    let bytes = model.into_record().into_bytes().unwrap();
    let restored = PolicyModel::new(&device.clone().without_autodiff())
        .load_record(ModuleRecord::from_bytes(bytes).unwrap());
    assert_eq!(parameters(&restored), expected);
    let logits = restored.logits(&features(), &device.without_autodiff());
    assert!(
        logits
            .into_data()
            .try_to_vec::<f64>()
            .unwrap()
            .iter()
            .all(|value| value.is_finite())
    );
}

#[test]
fn finite_extreme_features_do_not_bypass_gradient_checks() {
    let device = device().autodiff();
    let mut features = vec![1_000_000.0; FEATURES];
    features.extend(vec![-1_000_000.0; FEATURES]);
    let batch = FeatureBatch::new(features, 2).unwrap();
    let mut accumulated = AccumulatedEpisode::new(controlled_model(&device), device, 0.0).unwrap();
    accumulated.acknowledge(&batch, 1).unwrap();
    let proposal = accumulated.finish(-1).unwrap().unwrap();
    assert!(proposal.objective.is_finite());
    assert!(proposal.model.has_finite_f64_parameters());
}

// SPEC: _spec/packages/training/burn-compat.puml
use burn::module::{Module, Param, ParamId};
use burn::optim::{GradientsParams, SgdConfig};
use burn::tensor::{DType, Device, FloatDType, Tensor, TensorData};
use training_native::learner_math::{
    DecisionStatistics, EpisodeStatistics, L2, LEARNING_RATE, MathError, MathResult,
    POLICY_TEMPERATURE, SgdProposal, Vector418, decision_statistics, linear_logit, sample_index,
    sgd_proposal, softmax, zero_weights,
};

const WIDTH: usize = 418;
const EPSILON: f64 = 1e-6;
const ATOL: f64 = 1e-8;
const RTOL: f64 = 1e-5;

#[derive(Clone)]
struct SparseRow(Vec<(usize, f64)>);

impl SparseRow {
    fn dense(&self) -> Vector418 {
        let mut result = [0.0; WIDTH];
        let mut previous = None;
        for &(index, value) in &self.0 {
            assert!(index < WIDTH);
            assert!(previous.is_none_or(|last| last < index));
            assert!(value.is_finite());
            result[index] = value;
            previous = Some(index);
        }
        result
    }

    fn dot(&self, weights: &Vector418) -> f64 {
        self.0
            .iter()
            .map(|&(index, value)| weights[index] * value)
            .sum()
    }
}

#[derive(Clone)]
struct FixedDecision {
    rows: Vec<SparseRow>,
    selected: usize,
}

fn row(entries: &[(usize, f64)]) -> SparseRow {
    SparseRow(entries.to_vec())
}

fn sparse_multi_decisions() -> Vec<FixedDecision> {
    vec![
        FixedDecision {
            rows: vec![
                row(&[(0, 0.5), (17, -0.25)]),
                row(&[(1, -0.75), (417, 0.25)]),
                row(&[(83, 0.25)]),
            ],
            selected: 1,
        },
        FixedDecision {
            rows: vec![
                row(&[(369, -0.5), (370, 0.25)]),
                row(&[(381, 0.75), (382, -0.5)]),
            ],
            selected: 0,
        },
        FixedDecision {
            rows: vec![
                row(&[(0, -0.25), (382, 0.25)]),
                row(&[(17, 0.5), (417, -0.75)]),
                row(&[(1, 0.25), (370, -0.25)]),
            ],
            selected: 2,
        },
    ]
}

fn fixed_weights() -> Vector418 {
    std::array::from_fn(|index| ((index % 13) as f64 - 6.0) / 128.0)
}

fn reference_distribution(weights: &Vector418, decision: &FixedDecision) -> (Vec<f64>, f64) {
    let logits: Vec<f64> = decision.rows.iter().map(|row| row.dot(weights)).collect();
    let maximum = logits.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let exponentials: Vec<f64> = logits.iter().map(|value| (value - maximum).exp()).collect();
    let partition: f64 = exponentials.iter().sum();
    let probabilities = exponentials.iter().map(|value| value / partition).collect();
    let selected_logp = (logits[decision.selected] - maximum) - partition.ln();
    (probabilities, selected_logp)
}

fn reference_objective(
    weights: &Vector418,
    baseline: f64,
    reward: i8,
    decisions: &[FixedDecision],
) -> f64 {
    let likelihood: f64 = decisions
        .iter()
        .map(|decision| reference_distribution(weights, decision).1)
        .sum();
    let norm: f64 = weights.iter().map(|value| value * value).sum();
    -(f64::from(reward) - baseline) * likelihood + 0.0001 * norm / 2.0
}

fn reference_statistics(weights: &Vector418, decisions: &[FixedDecision]) -> (Vector418, f64) {
    let mut accumulated = [0.0; WIDTH];
    let mut logp_sum = 0.0;
    for decision in decisions {
        let (probabilities, logp) = reference_distribution(weights, decision);
        let mut average = [0.0; WIDTH];
        for (candidate, probability) in decision.rows.iter().zip(probabilities) {
            for &(index, value) in &candidate.0 {
                average[index] += probability * value;
            }
        }
        let selected = decision.rows[decision.selected].dense();
        for index in 0..WIDTH {
            accumulated[index] += selected[index] - average[index];
        }
        logp_sum += logp;
    }
    (accumulated, logp_sum)
}

fn reference_gradient(
    weights: &Vector418,
    baseline: f64,
    reward: i8,
    decisions: &[FixedDecision],
) -> Vector418 {
    let (delta, _) = reference_statistics(weights, decisions);
    let advantage = f64::from(reward) - baseline;
    std::array::from_fn(|index| -advantage * delta[index] + 0.0001 * weights[index])
}

fn production_episode(weights: &Vector418, decisions: &[FixedDecision]) -> EpisodeStatistics {
    let mut episode = EpisodeStatistics::new();
    for decision in decisions {
        let logits: Vec<f64> = decision
            .rows
            .iter()
            .map(|row| linear_logit(weights, &row.dense()).unwrap())
            .collect();
        let distribution = softmax(&logits).unwrap();
        let statistics = decision_statistics(&distribution, decision.selected, |index| {
            Ok(decision.rows[index].dense())
        })
        .unwrap();
        episode.append(&statistics).unwrap();
    }
    episode
}

fn profile_a(actual: f64, expected: f64, coordinate: usize) {
    assert!(actual.is_finite() && expected.is_finite());
    let tolerance = ATOL + RTOL * actual.abs().max(expected.abs());
    assert!(
        (actual - expected).abs() <= tolerance,
        "coordinate {coordinate}: actual={actual:.17e}, expected={expected:.17e}, tolerance={tolerance:.17e}"
    );
}

fn close(actual: f64, expected: f64) {
    assert!(actual.is_finite() && expected.is_finite());
    assert!(
        (actual - expected).abs() <= 1e-12 * expected.abs().max(1.0),
        "{actual:.17e} != {expected:.17e}"
    );
}

fn check_proposal(
    weights: &Vector418,
    baseline: f64,
    reward: i8,
    decisions: &[FixedDecision],
) -> SgdProposal {
    let episode = production_episode(weights, decisions);
    let (delta, logp) = reference_statistics(weights, decisions);
    assert_eq!(episode.sampled_decisions(), decisions.len());
    close(episode.log_probability_sum(), logp);
    for (actual, expected) in episode.score_accumulator().iter().zip(delta) {
        close(*actual, expected);
    }
    let proposal = sgd_proposal(weights, baseline, reward, &episode)
        .unwrap()
        .unwrap();
    let analytic = reference_gradient(weights, baseline, reward, decisions);
    close(
        proposal.objective,
        reference_objective(weights, baseline, reward, decisions),
    );
    for index in 0..WIDTH {
        close(proposal.gradient[index], analytic[index]);
        close(
            proposal.proposed_weights[index],
            weights[index] - 0.001 * analytic[index],
        );
        let mut plus = *weights;
        let mut minus = *weights;
        plus[index] += EPSILON;
        minus[index] -= EPSILON;
        let finite_difference = (reference_objective(&plus, baseline, reward, decisions)
            - reference_objective(&minus, baseline, reward, decisions))
            / (2.0 * EPSILON);
        profile_a(proposal.gradient[index], finite_difference, index);
    }
    let advantage = f64::from(reward) - baseline;
    assert_eq!(
        proposal.nonzero_pg,
        delta.iter().any(|value| -advantage * value != 0.0)
    );
    proposal
}

fn expect_error<T>(result: MathResult<T>, expected: MathError) {
    match result {
        Err(actual) => assert_eq!(actual, expected),
        Ok(_) => panic!("expected {expected:?}"),
    }
}

fn vector(index: usize, value: f64) -> Vector418 {
    let mut result = [0.0; WIDTH];
    result[index] = value;
    result
}

fn inspect(statistics: &DecisionStatistics) -> (Vector418, f64) {
    let mut episode = EpisodeStatistics::new();
    episode.append(statistics).unwrap();
    assert_eq!(episode.sampled_decisions(), 1);
    (*episode.score_accumulator(), episode.log_probability_sum())
}

fn snapshot(episode: &EpisodeStatistics) -> (usize, [u64; WIDTH], u64) {
    (
        episode.sampled_decisions(),
        episode.score_accumulator().map(f64::to_bits),
        episode.log_probability_sum().to_bits(),
    )
}

#[test]
fn frozen_constants_and_initial_vectors_have_418_zero_weights_without_a_bias() {
    assert_eq!(LEARNING_RATE, 0.001);
    assert_eq!(POLICY_TEMPERATURE, 1.0);
    assert_eq!(L2, 0.0001);
    assert_eq!(zero_weights(), [0.0; WIDTH]);
    let new = EpisodeStatistics::new();
    let default = EpisodeStatistics::default();
    assert_eq!(new.sampled_decisions(), 0);
    assert_eq!(new.log_probability_sum(), 0.0);
    assert_eq!(*new.score_accumulator(), [0.0; WIDTH]);
    assert_eq!(snapshot(&new), snapshot(&default));
}

#[test]
fn all_418_basis_pairs_pass_every_coordinate_profile_a_for_positive_negative_zero_and_regularization_only_cases()
 {
    let mut covered = [false; WIDTH];
    for start in (0..WIDTH).step_by(64) {
        let end = (start + 64).min(WIDTH);
        let decisions: Vec<FixedDecision> = (start..end)
            .map(|index| {
                covered[index] = true;
                FixedDecision {
                    rows: vec![row(&[(index, 1.0)]), row(&[(index, -1.0)])],
                    selected: index % 2,
                }
            })
            .collect();
        for reward in [-1, 0, 1] {
            let proposal = check_proposal(&[0.0; WIDTH], 0.0, reward, &decisions);
            assert_eq!(proposal.nonzero_pg, reward != 0);
            for (index, gradient) in proposal.gradient.iter().enumerate() {
                let sign = if index % 2 == 0 { 1.0 } else { -1.0 };
                assert_eq!(
                    *gradient,
                    if (start..end).contains(&index) {
                        -f64::from(reward) * sign
                    } else {
                        0.0
                    }
                );
            }
        }
        let proposal = check_proposal(&fixed_weights(), 0.0, 0, &decisions);
        assert!(!proposal.nonzero_pg);
    }
    assert!(covered.into_iter().all(|value| value));
}

#[test]
fn independent_sparse_multi_decision_objectives_recompute_all_418_perturbations_with_single_l2_and_summed_scores()
 {
    let decisions = sparse_multi_decisions();
    let weights = fixed_weights();
    for (baseline, reward) in [(0.25, -1), (-0.5, 1), (0.0, 0)] {
        let old = weights.map(f64::to_bits);
        check_proposal(&weights, baseline, reward, &decisions);
        assert_eq!(weights.map(f64::to_bits), old);
    }
}

#[derive(Module, Debug)]
struct NoBiasGraph {
    weight: Param<Tensor<2>>,
}

impl NoBiasGraph {
    fn new(weights: &Vector418, device: &Device) -> Self {
        Self {
            weight: Param::initialized(
                ParamId::from(1_u64),
                Tensor::from_data(TensorData::new(weights.to_vec(), [WIDTH, 1]), device)
                    .set_require_grad(true),
            ),
        }
    }

    fn objective(&self, decisions: &[FixedDecision], advantage: f64, device: &Device) -> Tensor<1> {
        let weight = self.weight.val();
        let mut loss = (weight.clone() * weight).sum().mul_scalar(0.0001 / 2.0);
        for decision in decisions {
            let features: Vec<f64> = decision.rows.iter().flat_map(|row| row.dense()).collect();
            let input = Tensor::<2>::from_data(
                TensorData::new(features, [decision.rows.len(), WIDTH]),
                device,
            );
            assert_eq!(input.dtype(), DType::F64);
            let logits = input.matmul(self.weight.val());
            assert_eq!(logits.dtype(), DType::F64);
            assert_eq!(logits.dims(), [decision.rows.len(), 1]);
            let shifted = logits.clone() - logits.max_dim(0);
            let selected = shifted
                .clone()
                .slice([decision.selected..decision.selected + 1, 0..1])
                .sum();
            let logp = selected - shifted.exp().sum().log();
            loss = loss - logp.mul_scalar(advantage);
        }
        loss
    }
}

fn tensor_values<const D: usize>(tensor: Tensor<D>) -> Vec<f64> {
    assert_eq!(tensor.dtype(), DType::F64);
    tensor.into_data().try_to_vec::<f64>().unwrap()
}

#[test]
fn actual_burn_022_flex_f64_live_no_bias_autodiff_and_synthetic_sgd_match_independent_all_coordinate_math()
 {
    let mut cpu = Device::flex();
    cpu.configure(FloatDType::F64).unwrap();
    assert_eq!(cpu, Device::flex());
    assert_eq!(cpu.settings().float_dtype, FloatDType::F64);
    let device = cpu.autodiff();
    assert!(device.is_autodiff());
    assert_eq!(device.settings().float_dtype, FloatDType::F64);
    let decisions = sparse_multi_decisions();
    let weights = fixed_weights();
    for (baseline, reward) in [(0.25, -1), (-0.5, 1), (0.0, 0)] {
        let model = NoBiasGraph::new(&weights, &device);
        assert_eq!(model.weight.val().dims(), [WIDTH, 1]);
        assert_eq!(model.weight.val().dtype(), DType::F64);
        assert!(model.weight.val().is_require_grad());
        let loss = model.objective(&decisions, f64::from(reward) - baseline, &device);
        assert_eq!(loss.dtype(), DType::F64);
        assert_eq!(loss.dims(), [1]);
        let gradients = loss.clone().backward();
        close(
            tensor_values(loss)[0],
            reference_objective(&weights, baseline, reward, &decisions),
        );
        let gradient = model.weight.val().grad(&gradients).unwrap();
        assert_eq!(gradient.dims(), [WIDTH, 1]);
        let actual_gradient = tensor_values(gradient);
        let expected_gradient = reference_gradient(&weights, baseline, reward, &decisions);
        let episode = production_episode(&weights, &decisions);
        let proposal = sgd_proposal(&weights, baseline, reward, &episode)
            .unwrap()
            .unwrap();
        for index in 0..WIDTH {
            close(actual_gradient[index], expected_gradient[index]);
            close(proposal.gradient[index], actual_gradient[index]);
        }
        let gradients = GradientsParams::from_grads(gradients, &model);
        let mut optimizer = SgdConfig::new().init();
        let updated = optimizer.step(0.001, model, gradients);
        assert_eq!(updated.weight.val().dims(), [WIDTH, 1]);
        let updated = tensor_values(updated.weight.val());
        for index in 0..WIDTH {
            close(
                updated[index],
                weights[index] - 0.001 * expected_gradient[index],
            );
            close(proposal.proposed_weights[index], updated[index]);
        }
    }
}

#[test]
fn linear_logits_use_every_coordinate_in_ascending_order_and_accept_finite_values_above_compat_limits()
 {
    for index in 0..WIDTH {
        assert_eq!(
            linear_logit(&vector(index, -3.5), &vector(index, 2.0)).unwrap(),
            -7.0
        );
    }
    let weights = std::array::from_fn(|index| (index % 7) as f64 - 3.0);
    let features = std::array::from_fn(|index| (index % 5) as f64 / 4.0);
    let expected: f64 = (0..WIDTH)
        .map(|index| weights[index] * features[index])
        .sum();
    assert_eq!(linear_logit(&weights, &features).unwrap(), expected);
    assert_eq!(
        linear_logit(&vector(417, 1e100), &vector(417, 1e100)).unwrap(),
        1e200
    );
    let mut ordered = [0.0; WIDTH];
    ordered[0] = 1e16;
    ordered[1] = 1.0;
    ordered[2] = -1e16;
    assert_eq!(linear_logit(&[1.0; WIDTH], &ordered).unwrap(), 0.0);
}

#[test]
fn linear_logits_reject_nonfinite_inputs_at_every_coordinate_and_each_overflow_before_cancellation()
{
    for index in 0..WIDTH {
        for invalid in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            expect_error(
                linear_logit(&vector(index, invalid), &[0.0; WIDTH]),
                MathError::NonFinite,
            );
            expect_error(
                linear_logit(&[0.0; WIDTH], &vector(index, invalid)),
                MathError::NonFinite,
            );
        }
    }
    let mut weights = [0.0; WIDTH];
    let mut features = [0.0; WIDTH];
    weights[0] = 1e308;
    weights[1] = -1e308;
    features[0] = 2.0;
    features[1] = 2.0;
    expect_error(linear_logit(&weights, &features), MathError::NonFinite);
    weights[0] = 1e308;
    weights[1] = 1e308;
    weights[2] = -1e308;
    features[0] = 1.0;
    features[1] = 1.0;
    features[2] = 2.0;
    expect_error(linear_logit(&weights, &features), MathError::NonFinite);
}

#[test]
fn stable_softmax_covers_each_1_to_512_cardinality_equal_logits_and_original_candidate_order() {
    for count in 1..=512 {
        let distribution = softmax(&vec![3.25; count]).unwrap();
        assert_eq!(distribution.len(), count);
        assert_eq!(distribution.probabilities().len(), count);
        assert_eq!(distribution.log_probabilities().len(), count);
        let sum: f64 = distribution.probabilities().iter().sum();
        assert!((sum - 1.0).abs() <= 1e-12);
        for (&probability, &logp) in distribution
            .probabilities()
            .iter()
            .zip(distribution.log_probabilities())
        {
            close(probability, 1.0 / count as f64);
            close(logp, -(count as f64).ln());
        }
    }
    let logits = [-4.0_f64, 0.0, 2.0, -1.0];
    let distribution = softmax(&logits).unwrap();
    let partition: f64 = logits.iter().map(|value| (value - 2.0).exp()).sum();
    for (index, logit) in logits.iter().enumerate() {
        close(
            distribution.probabilities()[index],
            (logit - 2.0).exp() / partition,
        );
        close(
            distribution.log_probabilities()[index],
            logit - 2.0 - partition.ln(),
        );
    }
    assert!(distribution.probabilities()[0] < distribution.probabilities()[3]);
    assert!(distribution.probabilities()[3] < distribution.probabilities()[1]);
    assert!(distribution.probabilities()[1] < distribution.probabilities()[2]);
}

#[test]
fn direct_shifted_log_probabilities_preserve_large_equal_logits_and_underflowed_selected_tails() {
    for value in [1e308, -1e308] {
        let distribution = softmax(&[value, value]).unwrap();
        assert_eq!(distribution.probabilities(), &[0.5, 0.5]);
        for &logp in distribution.log_probabilities() {
            close(logp, -2.0_f64.ln());
            assert!(logp < 0.0);
        }
    }
    for logits in [[0.0, -1000.0], [1000.0, -1000.0]] {
        let distribution = softmax(&logits).unwrap();
        assert_eq!(distribution.probabilities(), &[1.0, 0.0]);
        assert_eq!(distribution.log_probabilities()[1], logits[1] - logits[0]);
        let stats = decision_statistics(&distribution, 1, |index| {
            Ok(vector(417, if index == 0 { -2.0 } else { 3.0 }))
        })
        .unwrap();
        let (delta, logp) = inspect(&stats);
        assert_eq!(delta[417], 5.0);
        assert_eq!(logp, logits[1] - logits[0]);
        assert!(logp.is_finite());
    }
    expect_error(softmax(&[-1e308, 1e308]), MathError::NonFinite);
}

#[test]
fn softmax_shape_and_nonfinite_error_families_are_isolated() {
    expect_error(softmax(&[]), MathError::Shape);
    expect_error(softmax(&[0.0; 513]), MathError::Shape);
    for invalid in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        expect_error(softmax(&[invalid]), MathError::NonFinite);
        for position in [0, 256, 511] {
            let mut logits = [0.0; 512];
            logits[position] = invalid;
            expect_error(softmax(&logits), MathError::NonFinite);
        }
    }
}

#[test]
fn explicit_uniform_sampling_uses_strict_cdf_and_never_selects_zero_probability_rows() {
    let distribution = softmax(&[-1000.0, 0.0, 0.0, -1000.0]).unwrap();
    assert_eq!(distribution.probabilities(), &[0.0, 0.5, 0.5, 0.0]);
    let below_one = f64::from_bits(1.0_f64.to_bits() - 1);
    for (uniform, expected) in [
        (0.0, 1),
        (-0.0, 1),
        (0.25, 1),
        (0.5, 2),
        (0.75, 2),
        (below_one, 2),
    ] {
        assert_eq!(sample_index(&distribution, uniform).unwrap(), expected);
    }
    let equal = softmax(&[0.0; 4]).unwrap();
    for (uniform, expected) in [(0.0, 0), (0.25, 1), (0.5, 2), (0.75, 3)] {
        assert_eq!(sample_index(&equal, uniform).unwrap(), expected);
    }
}

#[test]
fn deterministic_rounding_fallback_chooses_last_nonzero_not_the_zero_tail() {
    let distribution = softmax(&[-1000.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -1000.0]).unwrap();
    let sum: f64 = distribution.probabilities().iter().sum();
    let uniform = f64::from_bits(1.0_f64.to_bits() - 1);
    assert!(sum < uniform && (1.0 - sum) <= 1e-12);
    assert_eq!(distribution.probabilities()[8], 0.0);
    assert_eq!(sample_index(&distribution, uniform).unwrap(), 7);
    assert_eq!(sample_index(&distribution, 0.0).unwrap(), 1);
}

#[test]
fn singleton_and_multi_candidate_sampling_validate_every_uniform_without_rng() {
    for distribution in [softmax(&[1e308]).unwrap(), softmax(&[0.0, 1.0]).unwrap()] {
        for uniform in [0.0, -0.0, 0.5, f64::from_bits(1.0_f64.to_bits() - 1)] {
            assert!(sample_index(&distribution, uniform).unwrap() < distribution.len());
        }
        for invalid in [-f64::from_bits(1), -1.0, 1.0, 2.0, f64::MAX] {
            expect_error(sample_index(&distribution, invalid), MathError::Domain);
        }
        for invalid in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            expect_error(sample_index(&distribution, invalid), MathError::NonFinite);
        }
    }
}

#[test]
fn streaming_statistics_visit_every_index_once_in_order_including_zero_rows_and_detach_callback_storage()
 {
    let distribution = softmax(&[0.0, -1000.0, 0.0, -1000.0]).unwrap();
    let mut rows = [
        vector(0, 2.0),
        vector(1, 7.0),
        vector(417, -4.0),
        vector(17, 5.0),
    ];
    let mut visited = Vec::new();
    let stats = decision_statistics(&distribution, 1, |index| {
        visited.push(index);
        Ok(rows[index])
    })
    .unwrap();
    assert_eq!(visited, [0, 1, 2, 3]);
    rows.fill([999.0; WIDTH]);
    let (delta, logp) = inspect(&stats);
    let mut expected = [0.0; WIDTH];
    expected[0] = -1.0;
    expected[1] = 7.0;
    expected[417] = 2.0;
    assert_eq!(delta, expected);
    close(logp, -1000.0 - 2.0_f64.ln());
    assert!(rows.iter().all(|row| row[0] == 999.0));
    let large = softmax(&[0.0; 512]).unwrap();
    let mut next = 0;
    let stats = decision_statistics(&large, 511, |index| {
        assert_eq!(index, next);
        next += 1;
        Ok(vector(index % WIDTH, index as f64 / 512.0))
    })
    .unwrap();
    assert_eq!(next, 512);
    let (_, logp) = inspect(&stats);
    close(logp, -512.0_f64.ln());
}

#[test]
fn selected_bounds_precede_callback_calls_and_callback_errors_keep_only_the_visited_prefix() {
    let distribution = softmax(&[0.0; 5]).unwrap();
    for selected in [5, usize::MAX] {
        let mut calls = 0;
        expect_error(
            decision_statistics(&distribution, selected, |_| {
                calls += 1;
                Ok([0.0; WIDTH])
            }),
            MathError::Shape,
        );
        assert_eq!(calls, 0);
    }
    for stop in 0..5 {
        for error in [
            MathError::Shape,
            MathError::Domain,
            MathError::NonFinite,
            MathError::DecisionLimit,
        ] {
            let mut visited = Vec::new();
            expect_error(
                decision_statistics(&distribution, 4, |index| {
                    visited.push(index);
                    if index == stop {
                        Err(error)
                    } else {
                        Ok([0.0; WIDTH])
                    }
                }),
                error,
            );
            assert_eq!(visited, (0..=stop).collect::<Vec<_>>());
        }
    }
}

#[test]
fn streaming_statistics_validate_zero_probability_rows_and_reject_mean_or_delta_overflow() {
    let distribution = softmax(&[0.0, -1000.0]).unwrap();
    for coordinate in [0, 207, 417] {
        for invalid in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            let mut visited = Vec::new();
            expect_error(
                decision_statistics(&distribution, 0, |index| {
                    visited.push(index);
                    Ok(if index == 1 {
                        vector(coordinate, invalid)
                    } else {
                        [0.0; WIDTH]
                    })
                }),
                MathError::NonFinite,
            );
            assert_eq!(visited, [0, 1]);
        }
    }
    let reverse = softmax(&[-1000.0, 0.0]).unwrap();
    expect_error(
        decision_statistics(&reverse, 0, |index| {
            Ok(vector(417, if index == 0 { 1e308 } else { -1e308 }))
        }),
        MathError::NonFinite,
    );
    let eleven = softmax(&[0.0; 11]).unwrap();
    expect_error(
        decision_statistics(&eleven, 0, |_| Ok(vector(417, f64::MAX))),
        MathError::NonFinite,
    );
}

#[test]
fn episode_statistics_sum_all_coordinates_and_log_probabilities_through_64_then_refuse_65_atomically()
 {
    let distribution = softmax(&[0.0, 0.0]).unwrap();
    let features: Vector418 = std::array::from_fn(|index| (index % 7) as f64 / 4.0 - 0.75);
    let stats = decision_statistics(&distribution, 0, |index| {
        Ok(if index == 0 {
            features
        } else {
            features.map(|value| -value)
        })
    })
    .unwrap();
    let mut episode = EpisodeStatistics::new();
    for count in 1..=64 {
        episode.append(&stats).unwrap();
        assert_eq!(episode.sampled_decisions(), count);
        for (index, feature) in features.iter().enumerate() {
            assert_eq!(episode.score_accumulator()[index], feature * count as f64);
        }
        close(
            episode.log_probability_sum(),
            -(count as f64) * 2.0_f64.ln(),
        );
    }
    let old = snapshot(&episode);
    expect_error(episode.append(&stats), MathError::DecisionLimit);
    assert_eq!(snapshot(&episode), old);
}

#[test]
fn late_coordinate_417_append_overflow_preserves_every_prior_coordinate_count_and_logp() {
    let distribution = softmax(&[0.0, 0.0]).unwrap();
    let stats = decision_statistics(&distribution, 0, |index| {
        let mut result = if index == 0 {
            [2.0; WIDTH]
        } else {
            [0.0; WIDTH]
        };
        result[417] = if index == 0 { 1e308 } else { -1e308 };
        Ok(result)
    })
    .unwrap();
    let mut episode = EpisodeStatistics::new();
    episode.append(&stats).unwrap();
    assert_eq!(&episode.score_accumulator()[..417], &[1.0; 417]);
    assert_eq!(episode.score_accumulator()[417], 1e308);
    let old = snapshot(&episode);
    expect_error(episode.append(&stats), MathError::NonFinite);
    assert_eq!(snapshot(&episode), old);
}

#[test]
fn summed_logp_overflow_alone_preserves_the_whole_episode() {
    let distribution = softmax(&[0.0, -1e308]).unwrap();
    let stats = decision_statistics(&distribution, 1, |_| Ok([0.0; WIDTH])).unwrap();
    let mut episode = EpisodeStatistics::new();
    episode.append(&stats).unwrap();
    assert_eq!(episode.log_probability_sum(), -1e308);
    assert_eq!(*episode.score_accumulator(), [0.0; WIDTH]);
    let old = snapshot(&episode);
    expect_error(episode.append(&stats), MathError::NonFinite);
    assert_eq!(snapshot(&episode), old);
}

#[test]
fn zero_decisions_validate_domains_before_returning_none_and_skip_overflowing_norms() {
    let episode = EpisodeStatistics::new();
    for weights in [[0.0; WIDTH], [1e308; WIDTH]] {
        for (baseline, reward) in [(-1.0, -1), (0.0, 0), (1.0, 1)] {
            assert!(
                sgd_proposal(&weights, baseline, reward, &episode)
                    .unwrap()
                    .is_none()
            );
        }
    }
    for coordinate in [0, 207, 417] {
        for invalid in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            expect_error(
                sgd_proposal(&vector(coordinate, invalid), 0.0, 0, &episode),
                MathError::NonFinite,
            );
        }
    }
    for invalid in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        expect_error(
            sgd_proposal(&[1e308; WIDTH], invalid, 0, &episode),
            MathError::NonFinite,
        );
    }
    for invalid in [-1.0001, 1.0001, f64::MAX] {
        expect_error(
            sgd_proposal(&[1e308; WIDTH], invalid, 0, &episode),
            MathError::Domain,
        );
    }
    for invalid in [i8::MIN, -2, 2, i8::MAX] {
        expect_error(
            sgd_proposal(&[1e308; WIDTH], 0.0, invalid, &episode),
            MathError::Domain,
        );
    }
}

#[test]
fn proposal_domains_reject_nonfinite_weights_baselines_and_invalid_finite_returns_without_mutating_weights()
 {
    let decisions = sparse_multi_decisions();
    let episode = production_episode(&[0.0; WIDTH], &decisions);
    for coordinate in 0..WIDTH {
        for invalid in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            let weights = vector(coordinate, invalid);
            let old = weights.map(f64::to_bits);
            expect_error(
                sgd_proposal(&weights, 0.0, 1, &episode),
                MathError::NonFinite,
            );
            assert_eq!(weights.map(f64::to_bits), old);
        }
    }
    let weights = fixed_weights();
    let old = weights.map(f64::to_bits);
    for invalid in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        expect_error(
            sgd_proposal(&weights, invalid, 1, &episode),
            MathError::NonFinite,
        );
    }
    for invalid in [-1.0001, 1.0001, f64::MAX, -f64::MAX] {
        expect_error(
            sgd_proposal(&weights, invalid, 1, &episode),
            MathError::Domain,
        );
    }
    for invalid in [i8::MIN, -2, 2, i8::MAX] {
        expect_error(
            sgd_proposal(&weights, 0.0, invalid, &episode),
            MathError::Domain,
        );
    }
    assert_eq!(weights.map(f64::to_bits), old);
}

#[test]
fn arithmetic_overflow_in_norm_pg_or_objective_rejects_without_weight_or_episode_mutation() {
    let equal = softmax(&[0.0, 0.0]).unwrap();
    let zero = decision_statistics(&equal, 0, |_| Ok([0.0; WIDTH])).unwrap();
    let mut ordinary = EpisodeStatistics::new();
    ordinary.append(&zero).unwrap();
    let mut norm_sum = [0.0; WIDTH];
    norm_sum[0] = 1e154;
    norm_sum[1] = 1e154;
    for weights in [vector(417, 1e308), norm_sum] {
        let old = weights.map(f64::to_bits);
        let old_episode = snapshot(&ordinary);
        expect_error(
            sgd_proposal(&weights, 0.0, 0, &ordinary),
            MathError::NonFinite,
        );
        assert_eq!(weights.map(f64::to_bits), old);
        assert_eq!(snapshot(&ordinary), old_episode);
    }
    let huge = decision_statistics(&equal, 0, |index| {
        Ok(vector(417, if index == 0 { 1e308 } else { -1e308 }))
    })
    .unwrap();
    let mut pg = EpisodeStatistics::new();
    pg.append(&huge).unwrap();
    expect_error(
        sgd_proposal(&[0.0; WIDTH], -1.0, 1, &pg),
        MathError::NonFinite,
    );
    let distribution = softmax(&[0.0, -1e308]).unwrap();
    let tail = decision_statistics(&distribution, 1, |_| Ok([0.0; WIDTH])).unwrap();
    let mut objective = EpisodeStatistics::new();
    objective.append(&tail).unwrap();
    expect_error(
        sgd_proposal(&[0.0; WIDTH], -1.0, 1, &objective),
        MathError::NonFinite,
    );
    let maximum = softmax(&[0.0, -f64::MAX]).unwrap();
    let tail = decision_statistics(&maximum, 1, |_| Ok([0.0; WIDTH])).unwrap();
    let mut addition = EpisodeStatistics::new();
    addition.append(&tail).unwrap();
    let weights = vector(0, 1e154);
    let old = weights.map(f64::to_bits);
    let old_episode = snapshot(&addition);
    expect_error(
        sgd_proposal(&weights, 0.0, 1, &addition),
        MathError::NonFinite,
    );
    assert_eq!(weights.map(f64::to_bits), old);
    assert_eq!(snapshot(&addition), old_episode);
}

#[test]
fn positive_and_negative_advantage_move_the_selected_likelihood_in_opposite_directions_at_zero_weights()
 {
    let decisions = vec![FixedDecision {
        rows: vec![row(&[(417, 1.0)]), row(&[(417, -1.0)])],
        selected: 0,
    }];
    let weights = [0.0; WIDTH];
    let episode = production_episode(&weights, &decisions);
    let original = reference_distribution(&weights, &decisions[0]).1;
    for reward in [-1, 1] {
        let proposal = sgd_proposal(&weights, 0.0, reward, &episode)
            .unwrap()
            .unwrap();
        let changed = reference_distribution(&proposal.proposed_weights, &decisions[0]).1;
        assert!(proposal.nonzero_pg);
        assert_eq!(proposal.gradient[417], -f64::from(reward));
        assert_eq!(proposal.proposed_weights[417], 0.001 * f64::from(reward));
        assert!(if reward > 0 {
            changed > original
        } else {
            changed < original
        });
    }
    assert_eq!(weights, [0.0; WIDTH]);
}

#[test]
fn regularization_applies_once_not_per_decision_and_nonzero_pg_ignores_l2_and_signed_zeros() {
    let weights = vector(417, 0.25);
    let decisions = sparse_multi_decisions();
    let episode = production_episode(&weights, &decisions);
    for (baseline, reward) in [(0.0, 0), (-0.0, 0), (1.0, 1), (-1.0, -1)] {
        let proposal = sgd_proposal(&weights, baseline, reward, &episode)
            .unwrap()
            .unwrap();
        assert!(!proposal.nonzero_pg);
        assert_eq!(proposal.gradient[417], 0.0001 * 0.25);
        assert_eq!(proposal.proposed_weights[417], 0.25 - 0.001 * 0.0001 * 0.25);
        assert_ne!(proposal.proposed_weights[417], weights[417]);
        close(proposal.objective, 0.0001 * 0.25 * 0.25 / 2.0);
    }
    let distribution = softmax(&[0.0]).unwrap();
    let stat = decision_statistics(&distribution, 0, |_| Ok([7.0; WIDTH])).unwrap();
    let mut zero_delta = EpisodeStatistics::new();
    zero_delta.append(&stat).unwrap();
    assert!(
        !sgd_proposal(&weights, 0.0, 1, &zero_delta)
            .unwrap()
            .unwrap()
            .nonzero_pg
    );
}

#[test]
fn nonzero_pg_uses_computed_terms_without_an_epsilon_or_rounded_weight_movement_test() {
    let smallest = f64::from_bits(1);
    let distribution = softmax(&[0.0, 0.0]).unwrap();
    let stat = decision_statistics(&distribution, 0, |index| {
        Ok(vector(417, if index == 0 { smallest } else { -smallest }))
    })
    .unwrap();
    let mut episode = EpisodeStatistics::new();
    episode.append(&stat).unwrap();
    assert_eq!(episode.score_accumulator()[417], smallest);
    let proposal = sgd_proposal(&[0.0; WIDTH], 0.0, 1, &episode)
        .unwrap()
        .unwrap();
    assert_eq!(proposal.gradient[417], -smallest);
    assert!(proposal.nonzero_pg);
    assert_eq!(proposal.proposed_weights[417], 0.0);
    let underflow = sgd_proposal(&[0.0; WIDTH], 0.5, 1, &episode)
        .unwrap()
        .unwrap();
    assert_eq!(underflow.gradient[417], 0.0);
    assert!(!underflow.nonzero_pg);
}

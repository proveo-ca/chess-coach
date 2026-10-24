// SPEC: _spec/packages/training/burn-compat.puml
use std::collections::BTreeSet;

use training_native::accounting_kernel::{
    AccountingPoint, NumericGrant, PointAccountingInput, accounting_point_flow,
};
use training_native::joint_math::{
    JointMathError, JointMathResult, NumericCertainty, NumericJoint, NumericReadout,
    NumericSupport, ReadoutTemperature, normalize_aggregate, readout_copy,
};
use training_native::ledger::contracts::{LedgerErrorCode, LedgerRules};
use training_native::ledger::{LEDGER_WORK_LIMIT, LedgerWork};

const N: usize = 7501;
const M: usize = 577 + 589;
const THRESHOLDS: [f64; 4] = [0.05, 0.95, 0.025, 0.975];

fn index(material: u16, bank: u8) -> usize {
    577 * usize::from(bank) + usize::from(material)
}

fn mask(points: &[(u16, u8)]) -> Vec<bool> {
    let mut cells = vec![false; N];
    for &(material, bank) in points {
        cells[index(material, bank)] = true;
    }
    cells
}

fn masses(points: &[(u16, u8, f64)]) -> Vec<f64> {
    let mut values = vec![0.0; N];
    for &(material, bank, value) in points {
        values[index(material, bank)] = value;
    }
    values
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ErrorKind {
    Shape,
    Domain,
    NonFinite,
    Underflow,
    EmptyMass,
    EmptySupport,
    Budget,
}

fn error_kind(error: &JointMathError) -> ErrorKind {
    match error {
        JointMathError::Shape => ErrorKind::Shape,
        JointMathError::Domain => ErrorKind::Domain,
        JointMathError::NonFinite => ErrorKind::NonFinite,
        JointMathError::Underflow => ErrorKind::Underflow,
        JointMathError::EmptyMass => ErrorKind::EmptyMass,
        JointMathError::EmptySupport => ErrorKind::EmptySupport,
        JointMathError::Work(error) => {
            assert_eq!(error.code, LedgerErrorCode::Budget);
            ErrorKind::Budget
        }
    }
}

fn ok<T>(result: JointMathResult<T>) -> T {
    match result {
        Ok(value) => value,
        Err(error) => panic!("unexpected joint math error {:?}", error_kind(&error)),
    }
}

fn expect_error<T>(result: JointMathResult<T>, expected: ErrorKind) {
    match result {
        Err(error) => assert_eq!(error_kind(&error), expected),
        Ok(_) => panic!("expected {expected:?}"),
    }
}

fn close(actual: f64, expected: f64) {
    assert!(actual.is_finite() && expected.is_finite());
    assert!(
        (actual - expected).abs() <= 1e-12,
        "{actual:.17e} != {expected:.17e}"
    );
}

fn reference_certainty(cells: &[bool]) -> NumericCertainty {
    let mut material = BTreeSet::new();
    let mut potential = BTreeSet::new();
    for (offset, &present) in cells.iter().enumerate() {
        if present {
            let d = (offset % 577) as u16;
            let b = (offset / 577) as u16;
            material.insert(d);
            potential.insert(d + b);
        }
    }
    NumericCertainty {
        material: if material.len() == 1 {
            material.first().copied()
        } else {
            None
        },
        potential: if potential.len() == 1 {
            potential.first().copied()
        } else {
            None
        },
    }
}

fn direct_normalize(raw: &[f64]) -> Vec<f64> {
    let mut total = 0.0;
    for &value in raw {
        total += value;
    }
    assert!(total > 0.0 && total.is_finite());
    raw.iter().map(|value| value / total).collect()
}

fn checked_joint(raw: &[f64], cells: &[bool]) -> (NumericJoint, Vec<f64>) {
    let mut work = LedgerWork::new();
    let support = ok(NumericSupport::from_cells(cells, &mut work));
    let joint = ok(normalize_aggregate(raw, &support, &mut work));
    assert_eq!(work.used(), support_fee() + normalization_fee());
    let expected = direct_normalize(raw);
    assert_eq!(joint.probabilities().len(), N);
    assert_eq!(joint.support().cells(), cells);
    assert_eq!(joint.support().certainty(), reference_certainty(cells));
    for (offset, (&actual, &expected)) in joint.probabilities().iter().zip(&expected).enumerate() {
        assert_eq!(
            actual.to_bits(),
            expected.to_bits(),
            "normalization lane {offset}"
        );
    }
    let sum: f64 = joint.probabilities().iter().sum();
    assert!((sum - 1.0).abs() <= 1e-12);
    (joint, expected)
}

fn independent_temper(probabilities: &[f64], temperature: f64) -> Vec<f64> {
    let largest = probabilities.iter().copied().fold(0.0_f64, f64::max);
    let powered: Vec<f64> = probabilities
        .iter()
        .map(|&value| {
            if value == 0.0 {
                0.0
            } else {
                (value / largest).powf(1.0 / temperature)
            }
        })
        .collect();
    let total: f64 = powered.iter().sum();
    powered.into_iter().map(|value| value / total).collect()
}

fn sorted_target_summary(probabilities: &[f64], potential: bool) -> (f64, [u16; 4]) {
    let mut records: Vec<(u16, f64)> = probabilities
        .iter()
        .enumerate()
        .filter_map(|(offset, &probability)| {
            if probability == 0.0 {
                return None;
            }
            let material = offset % 577;
            let bank = offset / 577;
            Some((
                (material + if potential { bank } else { 0 }) as u16,
                probability,
            ))
        })
        .collect();
    records.sort_by_key(|record| record.0);
    let mut grouped: Vec<(u16, f64)> = Vec::new();
    for (target, probability) in records {
        if let Some(last) = grouped.last_mut().filter(|last| last.0 == target) {
            last.1 += probability;
        } else {
            grouped.push((target, probability));
        }
    }
    close(grouped.iter().map(|record| record.1).sum(), 1.0);
    let mean = grouped
        .iter()
        .map(|&(target, probability)| f64::from(target) * probability)
        .sum();
    let quantiles = THRESHOLDS.map(|threshold| {
        let mut accumulated = 0.0;
        grouped
            .iter()
            .find_map(|&(target, probability)| {
                accumulated += probability;
                if accumulated >= threshold {
                    Some(target)
                } else {
                    None
                }
            })
            .expect("normalized sorted records reach every threshold")
    });
    (mean, quantiles)
}

fn reference_readout(
    probabilities: &[f64],
    cells: &[bool],
    own: u16,
    temperature: f64,
) -> NumericReadout {
    let tempered = independent_temper(probabilities, temperature);
    close(tempered.iter().sum(), 1.0);
    let (mut mean_d, mut quantiles_d) = sorted_target_summary(&tempered, false);
    let (mut mean_potential, mut quantiles_potential) = sorted_target_summary(&tempered, true);
    let certainty = reference_certainty(cells);
    if let Some(material) = certainty.material {
        mean_d = f64::from(material);
        quantiles_d = [material; 4];
    }
    if let Some(potential) = certainty.potential {
        mean_potential = f64::from(potential);
        quantiles_potential = [potential; 4];
    }
    NumericReadout {
        mean_d,
        mean_potential,
        quantiles_d,
        quantiles_potential,
        balance: f64::from(own) - mean_d,
        uncertainty: f64::from(quantiles_d[3] - quantiles_d[2]) / 2.0,
    }
}

fn compare_readout(actual: &NumericReadout, expected: &NumericReadout) {
    close(actual.mean_d, expected.mean_d);
    close(actual.mean_potential, expected.mean_potential);
    assert_eq!(actual.quantiles_d, expected.quantiles_d);
    assert_eq!(actual.quantiles_potential, expected.quantiles_potential);
    close(actual.balance, expected.balance);
    assert_eq!(actual.uncertainty, expected.uncertainty);
}

fn source_snapshot(joint: &NumericJoint) -> (Vec<u64>, Vec<bool>, NumericCertainty) {
    (
        joint
            .probabilities()
            .iter()
            .map(|value| value.to_bits())
            .collect(),
        joint.support().cells().to_vec(),
        joint.support().certainty(),
    )
}

fn support_fee() -> u64 {
    128 + 192 + 28 * N as u64
}
fn normalization_fee() -> u64 {
    128 + 2 * 192 + 40 * N as u64
}
fn temperature_fee() -> u64 {
    128 + 32
}
fn readout_fee() -> u64 {
    256 + 3 * 192 + 4 * (N + M) as u64 + 56 * N as u64 + 32 * M as u64
}
fn chain_fee() -> u64 {
    support_fee() + normalization_fee() + temperature_fee() + readout_fee()
}

#[test]
fn all_7501_normalization_lanes_match_direct_global_total_and_canonical_d_bank_potential_layout() {
    let cells = vec![true; N];
    let raw: Vec<f64> = (0..N).map(|offset| (offset % 19 + 1) as f64).collect();
    let (joint, expected) = checked_joint(&raw, &cells);
    let mut targets_d = BTreeSet::new();
    let mut targets_p = BTreeSet::new();
    let mut banks = BTreeSet::new();
    for (offset, &probability) in expected.iter().enumerate() {
        let material = offset % 577;
        let bank = offset / 577;
        assert_eq!(offset, index(material as u16, bank as u8));
        assert_eq!(joint.probabilities()[offset], probability);
        targets_d.insert(material);
        targets_p.insert(material + bank);
        banks.insert(bank);
    }
    assert_eq!(targets_d, (0..=576).collect());
    assert_eq!(targets_p, (0..=588).collect());
    assert_eq!(banks, (0..=12).collect());
    assert_eq!(index(0, 0), 0);
    assert_eq!(index(576, 12), 7500);
    let temperature = ok(ReadoutTemperature::from_index(500, &mut LedgerWork::new()));
    let actual = ok(readout_copy(
        &joint,
        576,
        &temperature,
        &mut LedgerWork::new(),
    ));
    compare_readout(&actual, &reference_readout(&expected, &cells, 576, 1.0));
}

#[test]
fn already_aggregated_sources_are_normalized_once_not_individually_repaired() {
    let cells = mask(&[(0, 0), (1, 0)]);
    let raw = masses(&[(0, 0, 0.125), (1, 0, 0.5)]);
    let (joint, _) = checked_joint(&raw, &cells);
    assert_eq!(joint.probabilities()[0], 0.2);
    assert_eq!(joint.probabilities()[1], 0.8);
    assert_ne!(joint.probabilities()[0], 0.5);
    assert_ne!(joint.probabilities()[1], 0.5);
}

#[test]
fn support_certainty_covers_all_target_combinations_and_irreversible_variation_including_zero_pmf_cells()
 {
    let cases = [
        (vec![(4, 0), (4, 12)], Some(4), None),
        (vec![(4, 0), (0, 4)], None, Some(4)),
        (vec![(576, 12)], Some(576), Some(588)),
        (vec![(4, 0), (5, 0), (4, 1)], None, None),
        (vec![(4, 0), (5, 0), (3, 1)], None, None),
    ];
    for (points, material, potential) in cases {
        let cells = mask(&points);
        let mut raw = vec![0.0; N];
        raw[index(points[0].0, points[0].1)] = 1.0;
        let (joint, expected) = checked_joint(&raw, &cells);
        let certainty = joint.support().certainty();
        assert_eq!(
            certainty,
            NumericCertainty {
                material,
                potential
            }
        );
        for temperature_index in [0, 250, 500, 750, 1000] {
            let temperature = ok(ReadoutTemperature::from_index(
                temperature_index,
                &mut LedgerWork::new(),
            ));
            let actual = ok(readout_copy(
                &joint,
                17,
                &temperature,
                &mut LedgerWork::new(),
            ));
            compare_readout(
                &actual,
                &reference_readout(&expected, &cells, 17, temperature.value()),
            );
            if let Some(target) = material {
                assert_eq!(actual.mean_d, f64::from(target));
                assert_eq!(actual.quantiles_d, [target; 4]);
            }
            if let Some(target) = potential {
                assert_eq!(actual.mean_potential, f64::from(target));
                assert_eq!(actual.quantiles_potential, [target; 4]);
            }
        }
    }
    let broad = vec![true; N];
    let (joint, _) = checked_joint(&masses(&[(4, 0, 1.0)]), &broad);
    assert_eq!(
        joint.support().certainty(),
        NumericCertainty {
            material: None,
            potential: None
        }
    );
}

#[test]
fn supplied_mask_and_owned_joint_are_isolated_from_caller_mask_mutations() {
    let mut cells = mask(&[(4, 0), (4, 12)]);
    let expected = cells.clone();
    let mut work = LedgerWork::new();
    let support = ok(NumericSupport::from_cells(&cells, &mut work));
    cells.fill(false);
    assert_eq!(support.cells(), expected);
    assert_eq!(
        support.certainty(),
        NumericCertainty {
            material: Some(4),
            potential: None
        }
    );
    let raw = masses(&[(4, 0, 1.0), (4, 12, 3.0)]);
    let joint = ok(normalize_aggregate(&raw, &support, &mut work));
    drop(support);
    cells.fill(true);
    assert_eq!(joint.support().cells(), expected);
    assert_eq!(joint.support().certainty(), reference_certainty(&expected));
    assert_eq!(joint.probabilities()[index(4, 12)], 0.75);
}

#[test]
fn sorted_record_oracle_handles_repeated_targets_gaps_and_expectations_instead_of_mode_or_median() {
    let points = [(0, 0, 1.0), (0, 12, 1.0), (10, 0, 2.0), (100, 5, 4.0)];
    let cells = mask(&points.map(|(material, bank, _)| (material, bank)));
    let (joint, expected) = checked_joint(&masses(&points), &cells);
    let temperature = ok(ReadoutTemperature::from_index(500, &mut LedgerWork::new()));
    let actual = ok(readout_copy(
        &joint,
        50,
        &temperature,
        &mut LedgerWork::new(),
    ));
    compare_readout(&actual, &reference_readout(&expected, &cells, 50, 1.0));
    close(actual.mean_d, 52.5);
    close(actual.mean_potential, 56.5);
    assert_ne!(actual.mean_d, 100.0);
    assert_ne!(actual.mean_d, 10.0);
    assert_eq!(actual.quantiles_d, [0, 100, 0, 100]);
    assert_eq!(actual.quantiles_potential, [0, 105, 0, 105]);
}

#[test]
fn exact_cdf_threshold_equality_selects_the_smallest_reaching_target_in_frozen_quantile_order() {
    for count in [20_u16, 40] {
        let points: Vec<(u16, u8, f64)> = (0..count).map(|offset| (2 * offset, 0, 1.0)).collect();
        let cells = mask(
            &points
                .iter()
                .map(|&(material, bank, _)| (material, bank))
                .collect::<Vec<_>>(),
        );
        let (joint, expected) = checked_joint(&masses(&points), &cells);
        let threshold = if count == 20 { 0.05 } else { 0.025 };
        assert_eq!(1.0 / f64::from(count), threshold);
        for temperature_index in [0, 500, 1000] {
            let temperature = ok(ReadoutTemperature::from_index(
                temperature_index,
                &mut LedgerWork::new(),
            ));
            let actual = ok(readout_copy(
                &joint,
                0,
                &temperature,
                &mut LedgerWork::new(),
            ));
            compare_readout(
                &actual,
                &reference_readout(&expected, &cells, 0, temperature.value()),
            );
            if count == 20 {
                assert_eq!(actual.quantiles_d[0], 0);
            } else {
                assert_eq!(actual.quantiles_d[2], 0);
                assert_eq!(actual.quantiles_d[0], 2);
            }
            assert!(actual.quantiles_d[0] < actual.quantiles_d[1]);
            assert!(actual.quantiles_d[2] <= actual.quantiles_d[0]);
            assert!(actual.quantiles_d[1] <= actual.quantiles_d[3]);
        }
    }
}

#[test]
fn exact_upper_cdf_thresholds_do_not_advance_to_the_next_supported_target() {
    for (counts, count, threshold, quantile_index) in [
        (vec![6_u8, 13], 20_u16, 0.95, 1),
        (vec![4_u8, 13, 13, 9], 40_u16, 0.975, 3),
    ] {
        let targets = [2_u16, 40, 100, 200];
        let mut points = Vec::new();
        let mut boundary = 0.0;
        for (group, &size) in counts.iter().enumerate() {
            let mut group_mass = 0.0;
            for bank in 0..size {
                points.push((targets[group], bank, 1.0));
                group_mass += 1.0 / f64::from(count);
            }
            boundary += group_mass;
        }
        assert_eq!(boundary, threshold);
        assert_eq!(points.len() + 1, usize::from(count));
        points.push((576, 0, 1.0));
        let cells = mask(
            &points
                .iter()
                .map(|&(material, bank, _)| (material, bank))
                .collect::<Vec<_>>(),
        );
        let (joint, expected) = checked_joint(&masses(&points), &cells);
        for temperature_index in [0, 500, 1000] {
            let temperature = ok(ReadoutTemperature::from_index(
                temperature_index,
                &mut LedgerWork::new(),
            ));
            let actual = ok(readout_copy(
                &joint,
                0,
                &temperature,
                &mut LedgerWork::new(),
            ));
            compare_readout(
                &actual,
                &reference_readout(&expected, &cells, 0, temperature.value()),
            );
            assert_eq!(
                actual.quantiles_d[quantile_index],
                targets[counts.len() - 1]
            );
            assert_ne!(actual.quantiles_d[quantile_index], 576);
        }
    }
}

#[test]
fn certainty_overrides_only_the_certain_target_and_material_uncertainty_does_not_use_potential_interval()
 {
    for points in [
        vec![(4, 0, 1.0), (4, 12, 1.0)],
        vec![(4, 0, 1.0), (0, 4, 3.0)],
    ] {
        let cells = mask(
            &points
                .iter()
                .map(|&(material, bank, _)| (material, bank))
                .collect::<Vec<_>>(),
        );
        let (joint, expected) = checked_joint(&masses(&points), &cells);
        let temperature = ok(ReadoutTemperature::from_index(500, &mut LedgerWork::new()));
        let actual = ok(readout_copy(
            &joint,
            7,
            &temperature,
            &mut LedgerWork::new(),
        ));
        compare_readout(&actual, &reference_readout(&expected, &cells, 7, 1.0));
        if joint.support().certainty().material == Some(4) {
            assert_eq!(actual.mean_d, 4.0);
            assert_eq!(actual.quantiles_d, [4; 4]);
            assert_eq!(actual.uncertainty, 0.0);
            assert_eq!(actual.quantiles_potential, [4, 16, 4, 16]);
        } else {
            assert_eq!(actual.mean_potential, 4.0);
            assert_eq!(actual.quantiles_potential, [4; 4]);
            close(actual.mean_d, 1.0);
            assert_eq!(actual.uncertainty, 2.0);
        }
    }
}

#[test]
fn singleton_and_maximum_spread_have_exact_endpoints_and_material_uncertainty_288() {
    let cells = mask(&[(576, 12)]);
    let (joint, _) = checked_joint(&masses(&[(576, 12, 17.0)]), &cells);
    for temperature_index in [0, 250, 500, 750, 1000] {
        let temperature = ok(ReadoutTemperature::from_index(
            temperature_index,
            &mut LedgerWork::new(),
        ));
        let actual = ok(readout_copy(
            &joint,
            576,
            &temperature,
            &mut LedgerWork::new(),
        ));
        assert_eq!(actual.mean_d, 576.0);
        assert_eq!(actual.mean_potential, 588.0);
        assert_eq!(actual.quantiles_d, [576; 4]);
        assert_eq!(actual.quantiles_potential, [588; 4]);
        assert_eq!(actual.balance, 0.0);
        assert_eq!(actual.uncertainty, 0.0);
    }
    let cells = mask(&[(0, 0), (576, 12)]);
    let (joint, expected) = checked_joint(&masses(&[(0, 0, 1.0), (576, 12, 1.0)]), &cells);
    let temperature = ok(ReadoutTemperature::from_index(500, &mut LedgerWork::new()));
    let actual = ok(readout_copy(
        &joint,
        0,
        &temperature,
        &mut LedgerWork::new(),
    ));
    compare_readout(&actual, &reference_readout(&expected, &cells, 0, 1.0));
    assert_eq!(actual.mean_d, 288.0);
    assert_eq!(actual.mean_potential, 294.0);
    assert_eq!(actual.quantiles_d, [0, 576, 0, 576]);
    assert_eq!(actual.quantiles_potential, [0, 588, 0, 588]);
    assert_eq!(actual.uncertainty, 288.0);
}

#[test]
fn all_1001_temperatures_are_monotone_match_formula_and_match_independent_power_readouts() {
    let cells = mask(&[(2, 1), (17, 6)]);
    let (joint, expected) = checked_joint(&masses(&[(2, 1, 1.0), (17, 6, 4.0)]), &cells);
    let old = source_snapshot(&joint);
    let mut previous = 0.0;
    for temperature_index in 0..=1000 {
        let mut work = LedgerWork::new();
        let temperature = ok(ReadoutTemperature::from_index(temperature_index, &mut work));
        let expected_temperature = 0.25 * 16.0_f64.powf(f64::from(temperature_index) / 1000.0);
        assert_eq!(temperature.index(), temperature_index);
        close(temperature.value(), expected_temperature);
        assert!(temperature.value() > previous);
        previous = temperature.value();
        assert_eq!(work.used(), temperature_fee());
        let actual = ok(readout_copy(&joint, 100, &temperature, &mut work));
        compare_readout(
            &actual,
            &reference_readout(&expected, &cells, 100, expected_temperature),
        );
        assert_eq!(work.used(), temperature_fee() + readout_fee());
    }
    assert_eq!(source_snapshot(&joint), old);
    for (temperature_index, value) in [(0, 0.25), (250, 0.5), (500, 1.0), (750, 2.0), (1000, 4.0)] {
        assert_eq!(
            ok(ReadoutTemperature::from_index(
                temperature_index,
                &mut LedgerWork::new()
            ))
            .value(),
            value
        );
    }
}

#[test]
fn rational_and_algebraic_temperature_anchors_match_two_state_expectations() {
    let cells = mask(&[(0, 0), (10, 0)]);
    let (joint, _) = checked_joint(&masses(&[(0, 0, 1.0), (10, 0, 4.0)]), &cells);
    for (temperature_index, high_probability) in [
        (0, 256.0 / 257.0),
        (250, 16.0 / 17.0),
        (500, 4.0 / 5.0),
        (750, 2.0 / 3.0),
        (1000, 2.0_f64.sqrt() / (1.0 + 2.0_f64.sqrt())),
    ] {
        let temperature = ok(ReadoutTemperature::from_index(
            temperature_index,
            &mut LedgerWork::new(),
        ));
        let actual = ok(readout_copy(
            &joint,
            10,
            &temperature,
            &mut LedgerWork::new(),
        ));
        close(actual.mean_d, 10.0 * high_probability);
        close(actual.mean_potential, 10.0 * high_probability);
        close(actual.balance, 10.0 * (1.0 - high_probability));
    }
}

#[test]
fn uniform_full_joint_and_point_pmfs_are_temperature_invariant_without_mask_pruning() {
    let cells = vec![true; N];
    let (uniform, expected) = checked_joint(&vec![1.0; N], &cells);
    let (point, _) = checked_joint(&masses(&[(4, 0, 1.0)]), &cells);
    for temperature_index in [0, 250, 500, 750, 1000] {
        let temperature = ok(ReadoutTemperature::from_index(
            temperature_index,
            &mut LedgerWork::new(),
        ));
        let actual = ok(readout_copy(
            &uniform,
            288,
            &temperature,
            &mut LedgerWork::new(),
        ));
        compare_readout(
            &actual,
            &reference_readout(&expected, &cells, 288, temperature.value()),
        );
        close(actual.mean_d, 288.0);
        close(actual.mean_potential, 294.0);
        let actual = ok(readout_copy(
            &point,
            4,
            &temperature,
            &mut LedgerWork::new(),
        ));
        assert_eq!(actual.mean_d, 4.0);
        assert_eq!(actual.mean_potential, 4.0);
        assert_eq!(
            point.support().certainty(),
            NumericCertainty {
                material: None,
                potential: None
            }
        );
    }
}

#[test]
fn readout_preserves_every_input_probability_and_support_bit_including_negative_zero() {
    let cells = mask(&[(12, 2)]);
    let mut raw = vec![-0.0; N];
    raw[index(12, 2)] = 3.0;
    let (joint, _) = checked_joint(&raw, &cells);
    assert_eq!(joint.probabilities()[0].to_bits(), (-0.0_f64).to_bits());
    let old = source_snapshot(&joint);
    let probability_pointer = joint.probabilities().as_ptr();
    let support_pointer = joint.support().cells().as_ptr();
    for temperature_index in [0, 250, 500, 750, 1000] {
        let temperature = ok(ReadoutTemperature::from_index(
            temperature_index,
            &mut LedgerWork::new(),
        ));
        let actual = ok(readout_copy(
            &joint,
            12,
            &temperature,
            &mut LedgerWork::new(),
        ));
        assert_eq!(actual.mean_d, 12.0);
        assert_eq!(source_snapshot(&joint), old);
        assert_eq!(joint.probabilities().as_ptr(), probability_pointer);
        assert_eq!(joint.support().cells().as_ptr(), support_pointer);
    }
}

#[test]
fn errors_distinguish_shape_empty_support_empty_mass_domain_nonfinite_and_underflow() {
    for length in [0, 1, N - 1, N + 1, N + 513] {
        let mut work = LedgerWork::new();
        expect_error(
            NumericSupport::from_cells(&vec![true; length], &mut work),
            ErrorKind::Shape,
        );
        assert_eq!(work.used(), 128);
    }
    let mut empty_work = LedgerWork::new();
    expect_error(
        NumericSupport::from_cells(&vec![false; N], &mut empty_work),
        ErrorKind::EmptySupport,
    );
    assert_eq!(empty_work.used(), support_fee());
    let support = ok(NumericSupport::from_cells(
        &mask(&[(4, 0), (4, 12)]),
        &mut LedgerWork::new(),
    ));
    for length in [0, N - 1, N + 1, N + 513] {
        let mut work = LedgerWork::new();
        expect_error(
            normalize_aggregate(&vec![f64::NAN; length], &support, &mut work),
            ErrorKind::Shape,
        );
        assert_eq!(work.used(), 128);
    }
    expect_error(
        normalize_aggregate(&vec![0.0; N], &support, &mut LedgerWork::new()),
        ErrorKind::EmptyMass,
    );
    for raw in [masses(&[(4, 0, -1.0)]), masses(&[(0, 0, 1.0)])] {
        expect_error(
            normalize_aggregate(&raw, &support, &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
    }
    for invalid in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        for offset in [0, 3750, N - 1] {
            let mut raw = masses(&[(4, 0, 1.0)]);
            raw[offset] = invalid;
            expect_error(
                normalize_aggregate(&raw, &support, &mut LedgerWork::new()),
                ErrorKind::NonFinite,
            );
        }
    }
    expect_error(
        normalize_aggregate(
            &masses(&[(4, 0, f64::MAX), (4, 12, f64::MAX)]),
            &support,
            &mut LedgerWork::new(),
        ),
        ErrorKind::NonFinite,
    );
    expect_error(
        normalize_aggregate(
            &masses(&[(4, 0, 2.0), (4, 12, f64::from_bits(1))]),
            &support,
            &mut LedgerWork::new(),
        ),
        ErrorKind::Underflow,
    );
}

#[test]
fn tempered_positive_underflow_cannot_hide_behind_background_or_target_certainty_and_tau_four_retains_it()
 {
    for points in [[(4, 0), (4, 12)], [(4, 0), (0, 4)], [(0, 0), (576, 12)]] {
        let cells = mask(&points);
        let raw = masses(&[
            (points[0].0, points[0].1, 1.0),
            (points[1].0, points[1].1, 1e-300),
        ]);
        let (joint, _) = checked_joint(&raw, &cells);
        let old = source_snapshot(&joint);
        let cold = ok(ReadoutTemperature::from_index(0, &mut LedgerWork::new()));
        expect_error(
            readout_copy(&joint, 0, &cold, &mut LedgerWork::new()),
            ErrorKind::Underflow,
        );
        assert_eq!(source_snapshot(&joint), old);
        let warm = ok(ReadoutTemperature::from_index(1000, &mut LedgerWork::new()));
        let actual = ok(readout_copy(&joint, 0, &warm, &mut LedgerWork::new()));
        assert!(actual.mean_d.is_finite() && actual.mean_potential.is_finite());
        if points[0] == (0, 0) {
            assert!(actual.mean_d > 0.0);
            assert!(actual.mean_potential > 0.0);
        }
        assert_eq!(source_snapshot(&joint), old);
    }
}

#[test]
fn temperature_index_and_own_replacement_bounds_reject_after_headers_only() {
    for invalid in [1001, u16::MAX] {
        let mut work = LedgerWork::with_limit(128).unwrap();
        expect_error(
            ReadoutTemperature::from_index(invalid, &mut work),
            ErrorKind::Domain,
        );
        assert_eq!(work.used(), 128);
    }
    let cells = mask(&[(0, 0)]);
    let (joint, _) = checked_joint(&masses(&[(0, 0, 1.0)]), &cells);
    let temperature = ok(ReadoutTemperature::from_index(500, &mut LedgerWork::new()));
    for invalid in [577, u16::MAX] {
        let mut work = LedgerWork::with_limit(256).unwrap();
        expect_error(
            readout_copy(&joint, invalid, &temperature, &mut work),
            ErrorKind::Domain,
        );
        assert_eq!(work.used(), 256);
    }
}

#[test]
fn independent_invoices_match_exact_caps_and_one_below_for_all_four_operations() {
    assert_eq!(
        (
            support_fee(),
            normalization_fee(),
            temperature_fee(),
            readout_fee()
        ),
        (210348, 300552, 160, 492868)
    );
    let cells = mask(&[(0, 0)]);
    let raw = masses(&[(0, 0, 1.0)]);
    let mut support_work = LedgerWork::with_limit(support_fee()).unwrap();
    let support = ok(NumericSupport::from_cells(&cells, &mut support_work));
    assert_eq!(support_work.remaining(), 0);
    let mut short = LedgerWork::with_limit(support_fee() - 1).unwrap();
    expect_error(
        NumericSupport::from_cells(&cells, &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), 128);
    let mut normalize_work = LedgerWork::with_limit(normalization_fee()).unwrap();
    let joint = ok(normalize_aggregate(&raw, &support, &mut normalize_work));
    assert_eq!(normalize_work.remaining(), 0);
    let mut short = LedgerWork::with_limit(normalization_fee() - 1).unwrap();
    expect_error(
        normalize_aggregate(&raw, &support, &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), 128);
    let mut temperature_work = LedgerWork::with_limit(temperature_fee()).unwrap();
    let temperature = ok(ReadoutTemperature::from_index(500, &mut temperature_work));
    assert_eq!(temperature_work.remaining(), 0);
    let mut short = LedgerWork::with_limit(temperature_fee() - 1).unwrap();
    expect_error(
        ReadoutTemperature::from_index(500, &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), 128);
    let mut readout_work = LedgerWork::with_limit(readout_fee()).unwrap();
    ok(readout_copy(&joint, 0, &temperature, &mut readout_work));
    assert_eq!(readout_work.remaining(), 0);
    let mut short = LedgerWork::with_limit(readout_fee() - 1).unwrap();
    expect_error(
        readout_copy(&joint, 0, &temperature, &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), 256);
}

#[test]
fn malformed_valid_shape_requests_cannot_scan_or_report_data_errors_before_full_reservation() {
    let mut short = LedgerWork::with_limit(support_fee() - 1).unwrap();
    expect_error(
        NumericSupport::from_cells(&vec![false; N], &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), 128);
    let support = ok(NumericSupport::from_cells(
        &mask(&[(0, 0), (1, 0)]),
        &mut LedgerWork::new(),
    ));
    for (raw, expected) in [
        (vec![0.0; N], ErrorKind::EmptyMass),
        (masses(&[(0, 0, f64::NAN)]), ErrorKind::NonFinite),
        (masses(&[(0, 0, -1.0)]), ErrorKind::Domain),
        (
            masses(&[(0, 0, 2.0), (1, 0, f64::from_bits(1))]),
            ErrorKind::Underflow,
        ),
    ] {
        let mut short = LedgerWork::with_limit(normalization_fee() - 1).unwrap();
        expect_error(
            normalize_aggregate(&raw, &support, &mut short),
            ErrorKind::Budget,
        );
        assert_eq!(short.used(), 128);
        let mut exact = LedgerWork::with_limit(normalization_fee()).unwrap();
        expect_error(normalize_aggregate(&raw, &support, &mut exact), expected);
        assert_eq!(exact.used(), normalization_fee());
    }
    let cells = mask(&[(0, 0), (576, 12)]);
    let (joint, _) = checked_joint(&masses(&[(0, 0, 1.0), (576, 12, 1e-300)]), &cells);
    let cold = ok(ReadoutTemperature::from_index(0, &mut LedgerWork::new()));
    let mut short = LedgerWork::with_limit(readout_fee() - 1).unwrap();
    expect_error(
        readout_copy(&joint, 0, &cold, &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), 256);
    let mut exact = LedgerWork::with_limit(readout_fee()).unwrap();
    expect_error(
        readout_copy(&joint, 0, &cold, &mut exact),
        ErrorKind::Underflow,
    );
    assert_eq!(exact.used(), readout_fee());
}

#[test]
fn headers_precede_every_length_index_and_own_bound_check_and_prior_charges_are_never_refunded() {
    for header in [128, 256] {
        let mut work = LedgerWork::with_limit(header - 1).unwrap();
        if header == 128 {
            expect_error(
                NumericSupport::from_cells(&[], &mut work),
                ErrorKind::Budget,
            );
        } else {
            let (joint, _) = checked_joint(&masses(&[(0, 0, 1.0)]), &mask(&[(0, 0)]));
            let temperature = ok(ReadoutTemperature::from_index(500, &mut LedgerWork::new()));
            expect_error(
                readout_copy(&joint, 577, &temperature, &mut work),
                ErrorKind::Budget,
            );
        }
        assert_eq!(work.used(), 0);
    }
    let support = ok(NumericSupport::from_cells(
        &mask(&[(0, 0)]),
        &mut LedgerWork::new(),
    ));
    let mut before_header = LedgerWork::with_limit(127).unwrap();
    expect_error(
        normalize_aggregate(&[], &support, &mut before_header),
        ErrorKind::Budget,
    );
    assert_eq!(before_header.used(), 0);
    let mut before_header = LedgerWork::with_limit(127).unwrap();
    expect_error(
        ReadoutTemperature::from_index(1001, &mut before_header),
        ErrorKind::Budget,
    );
    assert_eq!(before_header.used(), 0);
    let mut prior = LedgerWork::with_limit(support_fee() + 16).unwrap();
    prior.charge(17).unwrap();
    expect_error(
        NumericSupport::from_cells(&mask(&[(0, 0)]), &mut prior),
        ErrorKind::Budget,
    );
    assert_eq!(prior.used(), 17 + 128);
    let mut wrong_shape = LedgerWork::with_limit(128).unwrap();
    expect_error(
        normalize_aggregate(&[], &support, &mut wrong_shape),
        ErrorKind::Shape,
    );
    assert_eq!(wrong_shape.used(), 128);
}

#[test]
fn prior_work_prefixes_remain_spent_on_each_operation_success_and_reservation_failure() {
    let cells = mask(&[(0, 0)]);
    let raw = masses(&[(0, 0, 1.0)]);
    let support = ok(NumericSupport::from_cells(&cells, &mut LedgerWork::new()));
    let joint = ok(normalize_aggregate(&raw, &support, &mut LedgerWork::new()));
    let temperature = ok(ReadoutTemperature::from_index(500, &mut LedgerWork::new()));
    for (operation, total, header) in [
        (0, support_fee(), 128),
        (1, normalization_fee(), 128),
        (2, temperature_fee(), 128),
        (3, readout_fee(), 256),
    ] {
        for short in [false, true] {
            let mut work = LedgerWork::with_limit(total + if short { 16 } else { 17 }).unwrap();
            work.charge(17).unwrap();
            let result = match operation {
                0 => NumericSupport::from_cells(&cells, &mut work).map(|_| ()),
                1 => normalize_aggregate(&raw, &support, &mut work).map(|_| ()),
                2 => ReadoutTemperature::from_index(500, &mut work).map(|_| ()),
                _ => readout_copy(&joint, 0, &temperature, &mut work).map(|_| ()),
            };
            if short {
                expect_error(result, ErrorKind::Budget);
                assert_eq!(work.used(), 17 + header);
            } else {
                ok(result);
                assert_eq!(work.used(), 17 + total);
                assert_eq!(work.remaining(), 0);
            }
        }
    }
}

fn numeric_chain(
    raw: &[f64],
    cells: &[bool],
    work: &mut LedgerWork,
) -> JointMathResult<NumericReadout> {
    let support = NumericSupport::from_cells(cells, work)?;
    let joint = normalize_aggregate(raw, &support, work)?;
    let temperature = ReadoutTemperature::from_index(500, work)?;
    readout_copy(&joint, 0, &temperature, work)
}

#[test]
fn one_meter_numeric_chain_costs_1003928_and_keeps_44648_headroom_without_an_extra_allowance() {
    assert_eq!(chain_fee(), 1003928);
    assert_eq!(LEDGER_WORK_LIMIT - chain_fee(), 44648);
    let cells = mask(&[(0, 0)]);
    let raw = masses(&[(0, 0, 1.0)]);
    let mut exact = LedgerWork::with_limit(chain_fee()).unwrap();
    let actual = ok(numeric_chain(&raw, &cells, &mut exact));
    assert_eq!(actual.mean_d, 0.0);
    assert_eq!(actual.mean_potential, 0.0);
    assert_eq!(actual.uncertainty, 0.0);
    assert_eq!(exact.used(), chain_fee());
    assert_eq!(exact.remaining(), 0);
    let mut short = LedgerWork::with_limit(chain_fee() - 1).unwrap();
    expect_error(numeric_chain(&raw, &cells, &mut short), ErrorKind::Budget);
    assert_eq!(
        short.used(),
        support_fee() + normalization_fee() + temperature_fee() + 256
    );
    assert_eq!(short.used(), 511316);
    let mut maximum = LedgerWork::new();
    ok(numeric_chain(&raw, &cells, &mut maximum));
    assert_eq!(maximum.remaining(), 44648);
    let mut prior = LedgerWork::new();
    prior.charge(44648).unwrap();
    ok(numeric_chain(&raw, &cells, &mut prior));
    assert_eq!(prior.remaining(), 0);
    let mut below = LedgerWork::new();
    below.charge(44649).unwrap();
    expect_error(numeric_chain(&raw, &cells, &mut below), ErrorKind::Budget);
    assert_eq!(below.used(), 44649 + 511316);
}

#[test]
fn valid_structural_f3_point_plus_numeric_chain_refuses_work_on_the_same_meter_not_shape_or_domain()
{
    #[derive(serde::Deserialize)]
    struct StructuralRules {
        rules: LedgerRules,
    }
    let rules =
        serde_json::from_str::<StructuralRules>(include_str!("fixtures/ledger-boundaries.json"))
            .unwrap()
            .rules;
    let point = PointAccountingInput {
        source: AccountingPoint {
            material: 3,
            bank: 0,
        },
        input_turn: 0,
        visible_before: 3,
        marines_before: 0,
        witnessed_loss: 0,
        destination_lower: 0,
        destination_upper: 576,
        grant: NumericGrant::None,
    };
    let mut work = LedgerWork::new();
    let flow = accounting_point_flow(&rules, &point, &[], &mut work)
        .unwrap()
        .unwrap();
    assert_eq!(work.used(), 453120);
    assert_eq!(453120 + chain_fee(), 1457048);
    let support = ok(NumericSupport::from_cells(
        flow.support().cells(),
        &mut work,
    ));
    assert_eq!(work.used(), 663468);
    let joint = ok(normalize_aggregate(flow.masses(), &support, &mut work));
    assert_eq!(work.used(), 964020);
    close(joint.probabilities().iter().sum(), 1.0);
    let temperature = ok(ReadoutTemperature::from_index(500, &mut work));
    assert_eq!(work.used(), 964180);
    expect_error(
        readout_copy(&joint, 0, &temperature, &mut work),
        ErrorKind::Budget,
    );
    assert_eq!(work.used(), 964436);
    assert_eq!(work.remaining(), 84140);
}

// Full-lattice sparse-run oracle and invoices.
fn runs_readout_bits(readout: &NumericReadout) -> [u64; 12] {
    let mut bits = [0; 12];
    bits[0] = readout.mean_d.to_bits();
    bits[1] = readout.mean_potential.to_bits();
    for lane in 0..4 {
        bits[2 + lane] = f64::from(readout.quantiles_d[lane]).to_bits();
        bits[6 + lane] = f64::from(readout.quantiles_potential[lane]).to_bits();
    }
    bits[10] = readout.balance.to_bits();
    bits[11] = readout.uncertainty.to_bits();
    bits
}

fn runs_full_lattice_oracle(
    cells: &[training_native::joint_math::SparseCell],
    support: &[bool],
    own: u16,
    temperature: f64,
) -> JointMathResult<(NumericReadout, u64, u64)> {
    fn kahan(sum: &mut f64, compensation: &mut f64, term: f64) {
        let adjusted = term - *compensation;
        let next = *sum + adjusted;
        let recovered = next - *sum;
        *compensation = recovered - adjusted;
        *sum = next;
        assert!(sum.is_finite() && compensation.is_finite());
    }
    fn state_bits(state: &[f64; 4]) -> [u64; 4] {
        state.map(f64::to_bits)
    }
    fn quantiles(marginal: &[f64]) -> [u16; 4] {
        THRESHOLDS.map(|threshold| {
            let mut cumulative = 0.0;
            let mut selected = None;
            for (lane, probability) in marginal.iter().enumerate() {
                cumulative += *probability;
                if selected.is_none() && cumulative >= threshold {
                    selected = Some(lane as u16);
                }
            }
            assert!((cumulative - 1.0).abs() <= 1e-12);
            selected.unwrap()
        })
    }
    let mut dense = vec![0.0; N];
    let mut logs = Vec::with_capacity(cells.len());
    let mut maximum = f64::NEG_INFINITY;
    let mut input_sum = 0.0;
    for cell in cells {
        input_sum += cell.probability;
        let scaled = cell.probability.ln() / temperature;
        assert!(scaled.is_finite());
        maximum = if maximum > scaled { maximum } else { scaled };
        logs.push(scaled);
    }
    assert!((input_sum - 1.0).abs() <= 1e-12);
    let mut denominator = 0.0;
    for value in &mut logs {
        *value = (*value - maximum).exp();
        if *value == 0.0 { return Err(JointMathError::Underflow); }
        denominator += *value;
    }
    let mut tempered_sum = 0.0;
    for (cell, value) in cells.iter().zip(logs) {
        let probability = value / denominator;
        if probability == 0.0 { return Err(JointMathError::Underflow); }
        dense[index(cell.material, cell.bank)] = probability;
        tempered_sum += probability;
    }
    assert!((tempered_sum - 1.0).abs() <= 1e-12);
    let mut material = vec![0.0; 577];
    let mut potential = vec![0.0; 589];
    let mut state = [0.0; 4];
    let mut runs = 0;
    let mut visits = 0;
    let mut in_zero_run = false;
    let mut fixed = false;
    let mut executed_means = 0;
    for (lane, probability) in dense.into_iter().enumerate() {
        let d = lane % 577;
        let p = d + lane / 577;
        let before = state_bits(&state);
        let [mut sum_d, mut comp_d, mut sum_p, mut comp_p] = state;
        if probability > 0.0 {
            material[d] += probability;
            potential[p] += probability;
            kahan(&mut sum_d, &mut comp_d, d as f64 * probability);
            kahan(&mut sum_p, &mut comp_p, p as f64 * probability);
            in_zero_run = false;
        } else {
            if !in_zero_run {
                runs += 1;
                in_zero_run = true;
                fixed = false;
            }
            kahan(&mut sum_d, &mut comp_d, 0.0);
            kahan(&mut sum_p, &mut comp_p, 0.0);
        }
        state = [sum_d, comp_d, sum_p, comp_p];
        if probability == 0.0 && !fixed {
            visits += 1;
            fixed = before == state_bits(&state);
        }
        executed_means += 1;
    }
    assert_eq!(executed_means, N);
    assert!(runs <= cells.len() as u64 + 1);
    assert!(visits <= (N - cells.len()) as u64);
    let quantiles_d = quantiles(&material);
    let quantiles_potential = quantiles(&potential);
    let certainty = reference_certainty(support);
    let mut mean_d = state[0];
    let mut mean_potential = state[2];
    if let Some(d) = certainty.material {
        assert_eq!(quantiles_d, [d; 4]);
        mean_d = f64::from(d);
    }
    if let Some(p) = certainty.potential {
        assert_eq!(quantiles_potential, [p; 4]);
        mean_potential = f64::from(p);
    }
    Ok((NumericReadout {
        mean_d, mean_potential, quantiles_d, quantiles_potential,
        balance: f64::from(own) - mean_d,
        uncertainty: f64::from(quantiles_d[3] - quantiles_d[2]) / 2.0,
    }, runs, visits))
}

#[test]
fn sparse_runs_match_full_lattice_oracle_all_bits_and_independent_invoices() {
    use training_native::joint_math::{SparseCell, readout_sparse_copy, readout_sparse_runs_copy};
    fn rng(state: &mut u64) -> u64 {
        *state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        *state
    }
    let mut distributions = vec![
        vec![(0, 1.0)], vec![(N - 1, 1.0)], vec![(3750, 1.0)],
        vec![(0, 0.5), (N - 1, 0.5)],
        vec![(1, f64::from_bits(1)), (576, f64::MIN_POSITIVE), (578, 1.0)],
        vec![(0, 0.05), (1, 0.9), (N - 1, 0.05)],
        vec![(7, 1.0000000000005)],
        (0..40).map(|lane| (lane * 2, 0.025)).collect(),
        vec![(4, 0.25), (4 + 12 * 577, 0.75)],
        vec![(4, 0.25), (4 * 577, 0.75)],
    ];
    for seed in 0..24_u64 {
        let mut state = seed + 1;
        let count = 2 + (rng(&mut state) % 79) as usize;
        let mut chosen = BTreeSet::new();
        while chosen.len() < count { chosen.insert((rng(&mut state) % N as u64) as usize); }
        let mut records: Vec<_> = chosen.into_iter().map(|lane| {
            let mantissa = 1.0 + (rng(&mut state) >> 12) as f64 / (1_u64 << 52) as f64;
            let exponent = (rng(&mut state) % 41) as i32 - 20;
            (lane, mantissa * 2.0_f64.powi(exponent))
        }).collect();
        let total: f64 = records.iter().map(|record| record.1).sum();
        for record in &mut records { record.1 /= total; }
        distributions.push(records);
    }
    for records in distributions {
        let cells: Vec<_> = records.iter().map(|&(lane, probability)| SparseCell {
            bank: (lane / 577) as u8, material: (lane % 577) as u16, probability,
        }).collect();
        for broad in [false, true] {
            let mut mask = vec![broad; N];
            for &(lane, _) in &records { mask[lane] = true; }
            let support = ok(NumericSupport::from_cells(&mask, &mut LedgerWork::new()));
            let before = cells.iter().map(|cell| (cell.bank, cell.material, cell.probability.to_bits())).collect::<Vec<_>>();
            let certainty = support.certainty();
            for temperature_index in [0, 1, 249, 250, 251, 499, 500, 501, 749, 750, 751, 999, 1000] {
                let temperature = ok(ReadoutTemperature::from_index(temperature_index, &mut LedgerWork::new()));
                let expected = runs_full_lattice_oracle(&cells, &mask, 317, temperature.value());
                let mut old_work = LedgerWork::new();
                let old = readout_sparse_copy(&cells, &support, 317, &temperature, &mut old_work);
                match expected {
                    Err(error) => {
                        assert_eq!(error, JointMathError::Underflow);
                        assert_eq!(old.unwrap_err(), error);
                        let mut work = LedgerWork::new();
                        assert_eq!(readout_sparse_runs_copy(&cells, &support, 317, &temperature, &mut work).unwrap_err(), error);
                        assert_eq!(work.used(), old_work.used());
                    }
                    Ok((expected, runs, visits)) => {
                        let old = old.unwrap();
                        let positives = cells.len() as u64;
                        let invoice = 42984 + 180 * positives + 32 * runs + 40 * visits;
                        assert_eq!(old_work.used(), 222992 + 140 * positives);
                        let mut exact = LedgerWork::with_limit(19 + invoice).unwrap();
                        exact.charge(19).unwrap();
                        let actual = ok(readout_sparse_runs_copy(&cells, &support, 317, &temperature, &mut exact));
                        assert_eq!(runs_readout_bits(&actual), runs_readout_bits(&expected));
                        assert_eq!(runs_readout_bits(&actual), runs_readout_bits(&old));
                        assert_eq!(actual.quantiles_d, expected.quantiles_d);
                        assert_eq!(actual.quantiles_potential, expected.quantiles_potential);
                        assert_eq!(exact.used(), 19 + invoice);
                        let mut short = LedgerWork::with_limit(19 + invoice - 1).unwrap();
                        short.charge(19).unwrap();
                        expect_error(readout_sparse_runs_copy(&cells, &support, 317, &temperature, &mut short), ErrorKind::Budget);
                        assert_eq!(short.used(), 19 + invoice - 64);
                    }
                }
                assert_eq!(cells.iter().map(|cell| (cell.bank, cell.material, cell.probability.to_bits())).collect::<Vec<_>>(), before);
                assert_eq!(support.cells(), mask);
                assert_eq!(support.certainty(), certainty);
            }
        }
    }
}

#[test]
fn sparse_runs_validate_all_cells_before_zero_evidence_and_preserve_failure_prefixes() {
    use training_native::joint_math::{SparseCell, readout_sparse_copy, readout_sparse_runs_copy};
    let temperature = ok(ReadoutTemperature::from_index(500, &mut LedgerWork::new()));
    let support = ok(NumericSupport::from_cells(&vec![true; N], &mut LedgerWork::new()));
    let base = SparseCell { bank: 0, material: 0, probability: 0.5 };
    let end = SparseCell { bank: 12, material: 576, probability: 0.5 };
    let cases = vec![
        (vec![], JointMathError::Domain, 256),
        (vec![base; N + 1], JointMathError::Domain, 256),
        (vec![SparseCell { bank: 13, ..base }], JointMathError::Domain, 288),
        (vec![SparseCell { material: 577, ..base }], JointMathError::Domain, 288),
        (vec![SparseCell { probability: 0.0, ..base }], JointMathError::Domain, 288),
        (vec![SparseCell { probability: -0.0, ..base }], JointMathError::Domain, 288),
        (vec![SparseCell { probability: -0.5, ..base }], JointMathError::Domain, 288),
        (vec![base, SparseCell { probability: f64::NAN, ..end }], JointMathError::NonFinite, 320),
        (vec![base, SparseCell { probability: f64::INFINITY, ..end }], JointMathError::NonFinite, 320),
        (vec![base, SparseCell { probability: f64::NEG_INFINITY, ..end }], JointMathError::NonFinite, 320),
        (vec![base, base], JointMathError::Domain, 320),
        (vec![end, base], JointMathError::Domain, 320),
        (vec![base], JointMathError::NonFinite, 320),
        (vec![SparseCell { probability: f64::MAX, ..base }, SparseCell { probability: f64::MAX, ..end }], JointMathError::NonFinite, 320),
    ];
    for (cells, expected, prefix) in cases {
        for old in [false, true] {
            let mut work = LedgerWork::new();
            work.charge(23).unwrap();
            let result = if old { readout_sparse_copy(&cells, &support, 0, &temperature, &mut work) }
                else { readout_sparse_runs_copy(&cells, &support, 0, &temperature, &mut work) };
            assert_eq!(result.unwrap_err(), expected);
            assert_eq!(work.used(), 23 + prefix);
        }
        let mut short = LedgerWork::with_limit(23 + prefix - 1).unwrap();
        short.charge(23).unwrap();
        expect_error(readout_sparse_runs_copy(&cells, &support, 0, &temperature, &mut short), ErrorKind::Budget);
        assert!(short.used() >= 23 && short.used() < 23 + prefix);
    }
    let narrow = ok(NumericSupport::from_cells(&mask(&[(0, 0)]), &mut LedgerWork::new()));
    let mut work = LedgerWork::new();
    assert_eq!(readout_sparse_runs_copy(&[base, end], &narrow, 0, &temperature, &mut work).unwrap_err(), JointMathError::Domain);
    assert_eq!(work.used(), 320);
    for own in [577, u16::MAX] {
        let mut work = LedgerWork::with_limit(256).unwrap();
        assert_eq!(readout_sparse_runs_copy(&[base, end], &support, own, &temperature, &mut work).unwrap_err(), JointMathError::Domain);
        assert_eq!(work.used(), 256);
    }
    let mut unpaid = LedgerWork::with_limit(255).unwrap();
    expect_error(readout_sparse_runs_copy(&[], &support, 577, &temperature, &mut unpaid), ErrorKind::Budget);
    assert_eq!(unpaid.used(), 0);
}

#[test]
fn sparse_runs_full_positive_lattice_refuses_without_a_universal_budget_fit() {
    use training_native::joint_math::{SparseCell, readout_sparse_runs_copy};
    let cells: Vec<_> = (0..N).map(|lane| SparseCell {
        bank: (lane / 577) as u8, material: (lane % 577) as u16, probability: 1.0 / N as f64,
    }).collect();
    let support = ok(NumericSupport::from_cells(&vec![true; N], &mut LedgerWork::new()));
    let temperature = ok(ReadoutTemperature::from_index(500, &mut LedgerWork::new()));
    let (_, runs, visits) = ok(runs_full_lattice_oracle(&cells, support.cells(), 0, temperature.value()));
    assert_eq!((runs, visits), (0, 0));
    let invoice = 42984 + 180 * N as u64;
    assert_eq!(invoice, 1393164);
    assert!(invoice > LEDGER_WORK_LIMIT);
    let before = cells.iter().map(|cell| cell.probability.to_bits()).collect::<Vec<_>>();
    let mut work = LedgerWork::new();
    work.charge(11).unwrap();
    expect_error(readout_sparse_runs_copy(&cells, &support, 0, &temperature, &mut work), ErrorKind::Budget);
    let initial = 256 + 32 + 192 + 132 * N as u64 + 32 + 2 * 192 + 4 * M as u64;
    let complete_positives = (LEDGER_WORK_LIMIT - 11 - initial) / 48;
    let prefix = 11 + initial + 48 * complete_positives;
    let paid_schedule = if LEDGER_WORK_LIMIT - prefix >= 16 { 16 } else { 0 };
    assert_eq!(work.used(), prefix + paid_schedule);
    assert_eq!(cells.iter().map(|cell| cell.probability.to_bits()).collect::<Vec<_>>(), before);
    assert!(support.cells().iter().all(|present| *present));
}

// SPEC: _spec/packages/training/burn-compat.puml
use std::collections::BTreeSet;

use training_native::accounting_kernel::NumericGrant;
use training_native::banded_joint::{
    BandError, BandResult, NumericBandedJoint, expand_joint, normalize_weighted, reband_joint,
};
use training_native::evidence_tables::{
    EvidenceWeightedAccounting, InnovationCode, build_numeric_economic_tables, weight_evidence,
};
use training_native::joint_accounting::{NumericAccountingStep, aggregate_accounting};
use training_native::joint_math::{
    JointMathError, NumericCertainty, NumericJoint, NumericSupport, ReadoutTemperature,
    normalize_aggregate, readout_copy,
};
use training_native::ledger::contracts::{LedgerErrorCode, LedgerRules};
use training_native::ledger::{LEDGER_WORK_LIMIT, LedgerWork};
use training_native::transition_tables::NumericSourceContext;

const N: usize = 7501;
const STARTS: [usize; 19] = [
    0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512,
];
const WIDTHS: [usize; 19] = [
    1, 1, 1, 1, 2, 2, 4, 4, 8, 8, 16, 16, 32, 32, 64, 64, 128, 128, 65,
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ErrorKind {
    Domain,
    NonFinite,
    Underflow,
    Budget,
    JointShape,
    JointDomain,
    JointEmptySupport,
    JointEmptyMass,
    JointOther,
}

fn kind(error: &BandError) -> ErrorKind {
    match error {
        BandError::Domain => ErrorKind::Domain,
        BandError::NonFinite => ErrorKind::NonFinite,
        BandError::Underflow => ErrorKind::Underflow,
        BandError::Work(error) => {
            assert_eq!(error.code, LedgerErrorCode::Budget);
            ErrorKind::Budget
        }
        BandError::Joint(error) => match error {
            JointMathError::Shape => ErrorKind::JointShape,
            JointMathError::Domain => ErrorKind::JointDomain,
            JointMathError::EmptySupport => ErrorKind::JointEmptySupport,
            JointMathError::EmptyMass => ErrorKind::JointEmptyMass,
            _ => ErrorKind::JointOther,
        },
    }
}

fn ok<T>(result: BandResult<T>) -> T {
    match result {
        Ok(value) => value,
        Err(error) => panic!("unexpected band error {:?}", kind(&error)),
    }
}

fn expect_error<T>(result: BandResult<T>, expected: ErrorKind) {
    match result {
        Err(error) => assert_eq!(kind(&error), expected),
        Ok(_) => panic!("expected {expected:?}"),
    }
}

fn index(material: usize, bank: usize) -> usize {
    577 * bank + material
}

fn certainty(cells: &[bool]) -> NumericCertainty {
    let mut d = BTreeSet::new();
    let mut potential = BTreeSet::new();
    for (offset, &present) in cells.iter().enumerate() {
        if present {
            d.insert((offset % 577) as u16);
            potential.insert((offset % 577 + offset / 577) as u16);
        }
    }
    NumericCertainty {
        material: if d.len() == 1 {
            d.first().copied()
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

struct Dense {
    joint: NumericJoint,
    probabilities: Vec<f64>,
    cells: Vec<bool>,
}

fn dense(raw: Vec<f64>, cells: Vec<bool>) -> Dense {
    let mut work = LedgerWork::new();
    let support = NumericSupport::from_cells(&cells, &mut work).unwrap();
    let joint = normalize_aggregate(&raw, &support, &mut work).unwrap();
    assert_eq!(work.used(), 510900);
    let mut total = 0.0;
    for &value in &raw {
        total += value;
    }
    let probabilities: Vec<f64> = raw.iter().map(|value| value / total).collect();
    for (&actual, &expected) in joint.probabilities().iter().zip(&probabilities) {
        assert_eq!(actual.to_bits(), expected.to_bits());
    }
    assert_eq!(joint.support().cells(), cells);
    assert_eq!(joint.support().certainty(), certainty(&cells));
    Dense {
        joint,
        probabilities,
        cells,
    }
}

fn sparse(points: &[(usize, usize, f64)], extra_support: &[(usize, usize)]) -> Dense {
    let mut raw = vec![0.0; N];
    let mut cells = vec![false; N];
    for &(material, bank, mass) in points {
        raw[index(material, bank)] = mass;
        cells[index(material, bank)] = true;
    }
    for &(material, bank) in extra_support {
        cells[index(material, bank)] = true;
    }
    dense(raw, cells)
}

struct ExpectedComponent {
    bank: u8,
    band: u8,
    mass: f64,
    conditional: Vec<f64>,
}

fn categorical_reference(probabilities: &[f64]) -> Vec<ExpectedComponent> {
    let mut components = Vec::new();
    let mut component_total = 0.0;
    for bank in 0..13 {
        for band in 0..19 {
            let mut mass = 0.0;
            for material in STARTS[band]..STARTS[band] + WIDTHS[band] {
                mass += probabilities[index(material, bank)];
            }
            if mass == 0.0 {
                continue;
            }
            assert!(mass.is_finite() && mass > 0.0 && mass <= 1.0);
            let mut conditional = Vec::new();
            let mut total = 0.0;
            for material in STARTS[band]..STARTS[band] + WIDTHS[band] {
                let value = probabilities[index(material, bank)] / mass;
                assert!(value.is_finite() && (0.0..=1.0).contains(&value));
                conditional.push(value);
                total += value;
            }
            assert!((total - 1.0).abs() <= 1e-12);
            component_total += mass;
            components.push(ExpectedComponent {
                bank: bank as u8,
                band: band as u8,
                mass,
                conditional,
            });
        }
    }
    assert!((component_total - 1.0).abs() <= 1e-12);
    components
}

fn specified_expansion(components: &[ExpectedComponent]) -> Vec<f64> {
    let mut result = vec![0.0; N];
    for component in components {
        let start = STARTS[usize::from(component.band)];
        for (offset, &conditional) in component.conditional.iter().enumerate() {
            result[index(start + offset, usize::from(component.bank))] =
                component.mass * conditional;
        }
    }
    let mut total = 0.0;
    for &probability in &result {
        total += probability;
    }
    assert!((total - 1.0).abs() <= 1e-12);
    result
}

fn compare_banded(actual: &NumericBandedJoint, expected: &[ExpectedComponent], cells: &[bool]) {
    assert_eq!(actual.components().len(), expected.len());
    assert_eq!(actual.support().cells(), cells);
    assert_eq!(actual.support().certainty(), certainty(cells));
    for (actual, expected) in actual.components().iter().zip(expected) {
        assert_eq!(
            (actual.bank(), actual.band()),
            (expected.bank, expected.band)
        );
        assert_eq!(actual.mass().to_bits(), expected.mass.to_bits());
        assert!(actual.mass() > 0.0 && actual.mass() <= 1.0);
        assert_eq!(
            actual.conditional().len(),
            WIDTHS[usize::from(actual.band())]
        );
        for (&actual, &expected) in actual.conditional().iter().zip(&expected.conditional) {
            assert_eq!(actual.to_bits(), expected.to_bits());
        }
    }
}

fn compare_expanded(actual: &NumericJoint, expected: &[f64], cells: &[bool]) {
    assert_eq!(actual.probabilities().len(), N);
    assert_eq!(actual.support().cells(), cells);
    assert_eq!(actual.support().certainty(), certainty(cells));
    for (offset, (&actual, &expected)) in actual.probabilities().iter().zip(expected).enumerate() {
        assert_eq!(
            actual.to_bits(),
            expected.to_bits(),
            "expanded lane {offset}"
        );
    }
}

type BandedSnapshot = (Vec<(u8, u8, u64, Vec<u64>)>, Vec<bool>, NumericCertainty);

fn snapshot(banded: &NumericBandedJoint) -> BandedSnapshot {
    (
        banded
            .components()
            .iter()
            .map(|component| {
                (
                    component.bank(),
                    component.band(),
                    component.mass().to_bits(),
                    component
                        .conditional()
                        .iter()
                        .map(|value| value.to_bits())
                        .collect(),
                )
            })
            .collect(),
        banded.support().cells().to_vec(),
        banded.support().certainty(),
    )
}

fn structural_rules() -> LedgerRules {
    #[derive(serde::Deserialize)]
    struct StructuralRules {
        rules: LedgerRules,
    }
    serde_json::from_str::<StructuralRules>(include_str!("fixtures/ledger-boundaries.json"))
        .unwrap()
        .rules
}

fn weighted(
    sources: &[(u16, u8, f64)],
    bins: [u8; 3],
    loss: u16,
    upper: u16,
) -> EvidenceWeightedAccounting {
    let model =
        build_numeric_economic_tables(&structural_rules(), 3, &[], &mut LedgerWork::new()).unwrap();
    let mut raw = vec![0.0; N];
    let mut cells = vec![false; N];
    for &(material, bank, probability) in sources {
        raw[index(usize::from(material), usize::from(bank))] = probability;
        cells[index(usize::from(material), usize::from(bank))] = true;
    }
    let prior = dense(raw, cells).joint;
    let before: Vec<u64> = prior
        .probabilities()
        .iter()
        .map(|value| value.to_bits())
        .collect();
    let step = NumericAccountingStep {
        context: NumericSourceContext {
            input_turn: 0,
            visible_before: 0,
            marines_before: 0,
        },
        grant: NumericGrant::None,
        witnessed_loss: loss,
        destination_lower: 0,
        destination_upper: upper,
    };
    let raw =
        aggregate_accounting(&prior, model.transitions(), &step, &mut LedgerWork::new()).unwrap();
    assert_eq!(
        prior
            .probabilities()
            .iter()
            .map(|value| value.to_bits())
            .collect::<Vec<_>>(),
        before
    );
    let code = InnovationCode::from_bins(bins, &mut LedgerWork::new()).unwrap();
    weight_evidence(raw, &model, 0, code, &mut LedgerWork::new()).unwrap()
}

fn full_support_weighted() -> EvidenceWeightedAccounting {
    let sources: Vec<_> = (0..13).map(|bank| (576, bank, 1.0)).collect();
    let weighted = weighted(&sources, [0; 3], 0, 576);
    assert!(weighted.masses().iter().all(|&mass| mass > 0.0));
    assert!(weighted.accounting_cells().iter().all(|&cell| cell));
    weighted
}

fn normalization_fee() -> u64 {
    128 + 32 + 128 + 52 * N as u64
}
fn reband_fee(expected: &[ExpectedComponent]) -> u64 {
    129332
        + 248 * expected.len() as u64
        + 28 * expected
            .iter()
            .map(|component| component.conditional.len() as u64)
            .sum::<u64>()
}
fn expansion_fee(expected: &[ExpectedComponent]) -> u64 {
    210796
        + 32 * expected.len() as u64
        + 16 * expected
            .iter()
            .map(|component| component.conditional.len() as u64)
            .sum::<u64>()
}

#[test]
fn hardcoded_categorical_bands_cover_all_577_material_values_and_247_bank_band_keys() {
    assert_eq!(WIDTHS.iter().sum::<usize>(), 577);
    assert_eq!((STARTS[18], WIDTHS[18]), (512, 65));
    let mut materials = BTreeSet::new();
    let mut keys = BTreeSet::new();
    for band in 0..19 {
        assert_eq!(
            STARTS[band] + WIDTHS[band],
            STARTS.get(band + 1).copied().unwrap_or(577)
        );
        for material in STARTS[band]..STARTS[band] + WIDTHS[band] {
            assert!(materials.insert(material));
        }
        for bank in 0..13 {
            assert!(keys.insert((bank, band)));
        }
    }
    assert_eq!(materials, (0..577).collect());
    assert_eq!(keys.len(), 247);
}

#[test]
fn dirac_material_five_keeps_both_categorical_entries_zero_and_one() {
    let input = sparse(&[(5, 0, 1.0)], &[]);
    let expected = categorical_reference(&input.probabilities);
    let support_pointer = input.joint.support().cells().as_ptr();
    let banded = ok(reband_joint(input.joint, &mut LedgerWork::new()));
    compare_banded(&banded, &expected, &input.cells);
    assert_eq!(banded.components().len(), 1);
    assert_eq!(banded.components()[0].band(), 4);
    assert_eq!(banded.components()[0].conditional(), &[0.0, 1.0]);
    assert_eq!(banded.support().cells().as_ptr(), support_pointer);
}

#[test]
fn dirac_576_keeps_final_width_65_and_exact_unit_offset_64() {
    let input = sparse(&[(576, 12, 7.0)], &[]);
    let expected = categorical_reference(&input.probabilities);
    let banded = ok(reband_joint(input.joint, &mut LedgerWork::new()));
    compare_banded(&banded, &expected, &input.cells);
    let component = &banded.components()[0];
    assert_eq!((component.bank(), component.band()), (12, 18));
    assert_eq!(component.conditional().len(), 65);
    assert_eq!(&component.conditional()[..64], &[0.0; 64]);
    assert_eq!(component.conditional()[64], 1.0);
    let expanded = ok(expand_joint(&banded, &mut LedgerWork::new()));
    compare_expanded(&expanded, &specified_expansion(&expected), &input.cells);
}

#[test]
fn full_width_conditionals_preserve_interior_and_trailing_zeros_without_tail_truncation() {
    for points in [
        vec![(129, 0, 1.0)],
        vec![(128, 0, 5.0), (135, 0, 8.0), (190, 0, 5.0)],
    ] {
        let input = sparse(&points, &[]);
        let expected = categorical_reference(&input.probabilities);
        let banded = ok(reband_joint(input.joint, &mut LedgerWork::new()));
        compare_banded(&banded, &expected, &input.cells);
        assert_eq!(banded.components()[0].conditional().len(), 64);
        assert_eq!(banded.components()[0].conditional()[63], 0.0);
        assert_eq!(banded.components()[0].conditional()[2], 0.0);
        let expanded = ok(expand_joint(&banded, &mut LedgerWork::new()));
        compare_expanded(&expanded, &specified_expansion(&expected), &input.cells);
    }
}

#[test]
fn uniform_7501_cells_form_all_247_components_using_actual_ordinary_band_sums_then_divisions() {
    let input = dense(vec![1.0; N], vec![true; N]);
    let expected = categorical_reference(&input.probabilities);
    assert_eq!(expected.len(), 247);
    assert_eq!(
        expected
            .iter()
            .map(|component| component.conditional.len())
            .sum::<usize>(),
        7501
    );
    assert!(
        expected
            .iter()
            .any(|component| component.conditional[0].to_bits()
                != (1.0 / component.conditional.len() as f64).to_bits())
    );
    let support_pointer = input.joint.support().cells().as_ptr();
    let mut work = LedgerWork::new();
    let banded = ok(reband_joint(input.joint, &mut work));
    compare_banded(&banded, &expected, &input.cells);
    assert_eq!(work.used(), 400616);
    assert_eq!(banded.support().cells().as_ptr(), support_pointer);
    let before = snapshot(&banded);
    let mut work = LedgerWork::new();
    let expanded = ok(expand_joint(&banded, &mut work));
    compare_expanded(&expanded, &specified_expansion(&expected), &input.cells);
    assert_eq!(work.used(), 338716);
    assert_eq!(snapshot(&banded), before);
}

#[test]
fn all_band_boundaries_cross_banks_and_sparse_components_follow_bank_band_material_order() {
    let mut points = Vec::new();
    for bank in [0, 6, 12] {
        for band in 0..19 {
            points.push((STARTS[band], bank, (band + 1) as f64));
            if WIDTHS[band] > 1 {
                points.push((STARTS[band] + WIDTHS[band] - 1, bank, (bank + 2) as f64));
            }
        }
    }
    let input = sparse(&points, &[]);
    let expected = categorical_reference(&input.probabilities);
    let banded = ok(reband_joint(input.joint, &mut LedgerWork::new()));
    compare_banded(&banded, &expected, &input.cells);
    assert_eq!(banded.components().len(), 3 * 19);
    assert!(
        banded
            .components()
            .windows(2)
            .all(|pair| (pair[0].bank(), pair[0].band()) < (pair[1].bank(), pair[1].band()))
    );
    let expanded = ok(expand_joint(&banded, &mut LedgerWork::new()));
    compare_expanded(&expanded, &specified_expansion(&expected), &input.cells);
}

#[test]
fn zero_mass_band_omission_preserves_every_true_mask_cell_and_cached_target_certainty() {
    for extra in [vec![(5, 12)], vec![(0, 5)], vec![(0, 0), (576, 12)]] {
        let input = sparse(&[(5, 0, 1.0)], &extra);
        let expected_certainty = certainty(&input.cells);
        let expected = categorical_reference(&input.probabilities);
        let support_pointer = input.joint.support().cells().as_ptr();
        let banded = ok(reband_joint(input.joint, &mut LedgerWork::new()));
        assert_eq!(banded.components().len(), 1);
        compare_banded(&banded, &expected, &input.cells);
        assert_eq!(banded.support().cells().as_ptr(), support_pointer);
        assert_eq!(banded.support().certainty(), expected_certainty);
        let expanded = ok(expand_joint(&banded, &mut LedgerWork::new()));
        compare_expanded(&expanded, &specified_expansion(&expected), &input.cells);
    }
}

#[test]
fn specified_sum_divide_multiply_roundtrip_is_not_original_bit_identity_or_a_second_global_division()
 {
    let input = sparse(&[(4, 0, 5.0), (5, 0, 8.0), (6, 0, 5.0)], &[]);
    let expected = categorical_reference(&input.probabilities);
    let reconstructed = specified_expansion(&expected);
    assert!(
        reconstructed
            .iter()
            .zip(&input.probabilities)
            .any(|(left, right)| left.to_bits() != right.to_bits())
    );
    let mut total = 0.0;
    for &value in &reconstructed {
        total += value;
    }
    assert_ne!(total.to_bits(), 1.0_f64.to_bits());
    assert!((total - 1.0).abs() <= 1e-12);
    assert!(
        reconstructed
            .iter()
            .any(|&value| value.to_bits() != (value / total).to_bits())
    );
    let banded = ok(reband_joint(input.joint, &mut LedgerWork::new()));
    let expanded = ok(expand_joint(&banded, &mut LedgerWork::new()));
    compare_expanded(&expanded, &reconstructed, &input.cells);
}

#[test]
fn f4_valid_global_sum_tolerance_does_not_waive_strict_component_mass_above_one() {
    let points: Vec<_> = (32..41).map(|material| (material, 0, 1.0)).collect();
    let input = sparse(&points, &[]);
    let mut global = 0.0;
    for &probability in input.joint.probabilities() {
        global += probability;
    }
    assert!(global > 1.0 && (global - 1.0).abs() <= 1e-12);
    let mut band_mass = 0.0;
    for material in 32..48 {
        band_mass += input.probabilities[material];
    }
    assert!(band_mass > 1.0);
    expect_error(
        reband_joint(input.joint, &mut LedgerWork::new()),
        ErrorKind::Domain,
    );
}

#[test]
fn expanded_buffers_are_detached_from_live_banded_conditionals_and_support_not_from_freed_dense_addresses()
 {
    let input = sparse(&[(4, 0, 5.0), (5, 0, 8.0), (576, 12, 5.0)], &[(0, 7)]);
    let expected = categorical_reference(&input.probabilities);
    let banded = ok(reband_joint(input.joint, &mut LedgerWork::new()));
    let before = snapshot(&banded);
    let support_pointer = banded.support().cells().as_ptr();
    let expanded = ok(expand_joint(&banded, &mut LedgerWork::new()));
    assert_ne!(expanded.support().cells().as_ptr(), support_pointer);
    for component in banded.components() {
        assert_ne!(
            expanded.probabilities().as_ptr(),
            component.conditional().as_ptr()
        );
    }
    let second = ok(expand_joint(&banded, &mut LedgerWork::new()));
    assert_ne!(
        expanded.probabilities().as_ptr(),
        second.probabilities().as_ptr()
    );
    assert_ne!(
        expanded.support().cells().as_ptr(),
        second.support().cells().as_ptr()
    );
    compare_expanded(&expanded, &specified_expansion(&expected), &input.cells);
    compare_expanded(&second, &specified_expansion(&expected), &input.cells);
    assert_eq!(snapshot(&banded), before);
}

#[test]
fn private_copy_temperature_readout_never_changes_banded_probabilities_mask_or_future_untempered_expansion()
 {
    let input = sparse(&[(4, 0, 1.0), (5, 0, 2.0), (6, 0, 4.0)], &[(576, 12)]);
    let expected = categorical_reference(&input.probabilities);
    let banded = ok(reband_joint(input.joint, &mut LedgerWork::new()));
    let before = snapshot(&banded);
    let expanded = ok(expand_joint(&banded, &mut LedgerWork::new()));
    let expanded_before: Vec<u64> = expanded
        .probabilities()
        .iter()
        .map(|value| value.to_bits())
        .collect();
    let mut means = Vec::new();
    for temperature in [0, 500, 1000] {
        let temperature =
            ReadoutTemperature::from_index(temperature, &mut LedgerWork::new()).unwrap();
        let readout = readout_copy(&expanded, 7, &temperature, &mut LedgerWork::new()).unwrap();
        means.push(readout.mean_d);
        assert_eq!(snapshot(&banded), before);
        assert_eq!(
            expanded
                .probabilities()
                .iter()
                .map(|value| value.to_bits())
                .collect::<Vec<_>>(),
            expanded_before
        );
    }
    assert_ne!(means[0].to_bits(), means[2].to_bits());
    let expanded_again = ok(expand_joint(&banded, &mut LedgerWork::new()));
    compare_expanded(
        &expanded_again,
        &specified_expansion(&expected),
        &input.cells,
    );
    assert_eq!(snapshot(&banded), before);
}

#[test]
fn owned_normalization_matches_old_public_canonical_result_and_moves_both_existing_buffers() {
    for (sources, bins, loss, upper) in [
        (vec![(0, 0, 1.0), (1, 0, 3.0)], [1, 0, 0], 1, 0),
        (vec![(0, 0, 1.0), (3, 1, 0.0)], [0; 3], 0, 576),
        (vec![(3, 3, 1.0)], [1, 0, 0], 0, 576),
        (
            (0..13).map(|bank| (576, bank, 1.0)).collect(),
            [0; 3],
            0,
            576,
        ),
    ] {
        let weighted = weighted(&sources, bins, loss, upper);
        let mass_pointer = weighted.masses().as_ptr();
        let mask_pointer = weighted.accounting_cells().as_ptr();
        let raw = weighted.masses().to_vec();
        let cells = weighted.accounting_cells().to_vec();
        let old = dense(raw.clone(), cells.clone());
        let mut work = LedgerWork::new();
        let joint = ok(normalize_weighted(weighted, &mut work));
        assert_eq!(work.used(), normalization_fee());
        assert_eq!(joint.probabilities().as_ptr(), mass_pointer);
        assert_eq!(joint.support().cells().as_ptr(), mask_pointer);
        for (&actual, &expected) in joint.probabilities().iter().zip(old.joint.probabilities()) {
            assert_eq!(actual.to_bits(), expected.to_bits());
        }
        assert_eq!(joint.support().cells(), cells);
        assert_eq!(joint.support().certainty(), certainty(&cells));
    }
    assert_eq!(128 + 52 * 7501, 390180);
    assert_eq!(510900 - (128 + 52 * 7501), 120720);
    assert_eq!(128 + 3 * 192 + 16 * 7501, 120720);
    assert_eq!(normalization_fee(), 390340);
}

#[derive(Clone, Copy)]
struct FeeStep {
    label: &'static str,
    units: u64,
}

fn normalization_steps() -> Vec<FeeStep> {
    vec![
        FeeStep {
            label: "wrapper-entry",
            units: 128,
        },
        FeeStep {
            label: "weighted-parts-move",
            units: 32,
        },
        FeeStep {
            label: "owned-normalization-header",
            units: 128,
        },
        FeeStep {
            label: "owned-normalization-full-work",
            units: 52 * 7501,
        },
    ]
}

fn reband_steps(expected: &[ExpectedComponent]) -> Vec<FeeStep> {
    let mut steps = vec![
        FeeStep {
            label: "entry",
            units: 128,
        },
        FeeStep {
            label: "joint-parts-move",
            units: 32,
        },
        FeeStep {
            label: "single-scratch-initialization",
            units: 4 * 247,
        },
        FeeStep {
            label: "all-band-headers",
            units: 32 * 247,
        },
        FeeStep {
            label: "all-mass-scans",
            units: 16 * 7501,
        },
        FeeStep {
            label: "exact-component-vector",
            units: 192 + 24 * expected.len() as u64,
        },
    ];
    for component in expected {
        steps.push(FeeStep {
            label: "full-conditional-allocation-and-work",
            units: 192
                + 4 * component.conditional.len() as u64
                + 24 * component.conditional.len() as u64
                + 32,
        });
    }
    steps.push(FeeStep {
        label: "cached-component-total",
        units: 32,
    });
    steps.push(FeeStep {
        label: "banded-output-move",
        units: 40,
    });
    steps
}

fn expansion_steps(expected: &[ExpectedComponent]) -> Vec<FeeStep> {
    let mut steps = vec![
        FeeStep {
            label: "entry",
            units: 128,
        },
        FeeStep {
            label: "single-dense-allocation-and-init",
            units: 192 + 4 * 7501,
        },
    ];
    for component in expected {
        steps.push(FeeStep {
            label: "component-header",
            units: 32,
        });
        steps.push(FeeStep {
            label: "full-conditional-products",
            units: 16 * component.conditional.len() as u64,
        });
    }
    steps.push(FeeStep {
        label: "checked-support-copy-header",
        units: 128,
    });
    steps.push(FeeStep {
        label: "one-detached-support-buffer",
        units: 192 + 8 * 7501,
    });
    steps.push(FeeStep {
        label: "from-normalized-header",
        units: 128,
    });
    steps.push(FeeStep {
        label: "dense-validation-no-division",
        units: 16 * 7501,
    });
    steps
}

fn invoice(steps: &[FeeStep]) -> u64 {
    steps.iter().map(|step| step.units).sum()
}

fn before(steps: &[FeeStep], label: &str) -> u64 {
    let mut total = 0;
    for step in steps {
        if step.label == label {
            return total;
        }
        total += step.units;
    }
    panic!("missing block {label}");
}

fn failed_prefix(steps: &[FeeStep], available: u64) -> u64 {
    let mut spent = 0;
    for step in steps {
        if step.units > available - spent {
            return spent;
        }
        spent += step.units;
    }
    panic!("expected budget refusal");
}

#[test]
fn independent_owned_normalization_invoice_reserves_all_work_before_mutation_and_moves() {
    let steps = normalization_steps();
    assert_eq!(invoice(&steps), 390340);
    let mut exact = LedgerWork::with_limit(invoice(&steps)).unwrap();
    let input = weighted(&[(0, 0, 1.0)], [0; 3], 0, 576);
    let joint = ok(normalize_weighted(input, &mut exact));
    assert_eq!(joint.probabilities()[0], 1.0);
    assert_eq!(exact.used(), 390340);
    assert_eq!(exact.remaining(), 0);
    let mut spent = 0;
    for step in &steps {
        let input = weighted(&[(0, 0, 1.0)], [0; 3], 0, 576);
        let mut short = LedgerWork::with_limit(spent + step.units - 1).unwrap();
        expect_error(normalize_weighted(input, &mut short), ErrorKind::Budget);
        assert_eq!(short.used(), spent, "block={}", step.label);
        spent += step.units;
    }
    let mut short = LedgerWork::with_limit(390340 - 1).unwrap();
    let input = weighted(&[(0, 0, 1.0)], [0; 3], 0, 576);
    expect_error(normalize_weighted(input, &mut short), ErrorKind::Budget);
    assert_eq!(short.used(), 288);
}

#[test]
fn reband_exact_invoices_include_all_full_width_zero_entries_and_every_component_allocation() {
    for points in [
        vec![(5, 0, 1.0)],
        vec![(576, 12, 1.0)],
        vec![(4, 0, 5.0), (5, 0, 8.0), (6, 0, 5.0)],
    ] {
        let input = sparse(&points, &[]);
        let expected = categorical_reference(&input.probabilities);
        let steps = reband_steps(&expected);
        assert_eq!(invoice(&steps), reband_fee(&expected));
        let mut exact = LedgerWork::with_limit(invoice(&steps)).unwrap();
        let banded = ok(reband_joint(input.joint, &mut exact));
        compare_banded(&banded, &expected, &input.cells);
        assert_eq!(exact.remaining(), 0);
    }
    let input = sparse(&[(576, 12, 1.0)], &[]);
    let expected = categorical_reference(&input.probabilities);
    assert_eq!(reband_fee(&expected), 131400);
    assert_eq!(expansion_fee(&expected), 211868);
}

#[test]
fn reband_precharge_edges_cover_stack_band_scan_exact_capacities_conditionals_cached_total_and_output_move()
 {
    let points = [(4, 0, 5.0), (5, 0, 8.0), (6, 12, 5.0)];
    let fixture = sparse(&points, &[]);
    let expected = categorical_reference(&fixture.probabilities);
    let steps = reband_steps(&expected);
    assert_eq!(
        before(&steps, "all-mass-scans"),
        128 + 32 + 4 * 247 + 32 * 247
    );
    drop(fixture);
    let mut spent = 0;
    for step in &steps {
        let input = sparse(&points, &[]);
        let mut short = LedgerWork::with_limit(spent + step.units - 1).unwrap();
        expect_error(reband_joint(input.joint, &mut short), ErrorKind::Budget);
        assert_eq!(short.used(), spent, "block={}", step.label);
        spent += step.units;
    }
    let input = sparse(&points, &[]);
    let mut short = LedgerWork::with_limit(invoice(&steps) - 1).unwrap();
    expect_error(reband_joint(input.joint, &mut short), ErrorKind::Budget);
    assert_eq!(short.used(), invoice(&steps) - 40);
}

#[test]
fn strict_partial_domain_is_checked_only_after_the_full_mass_scan_reservation_without_repair() {
    let points: Vec<_> = (32..41).map(|material| (material, 0, 1.0)).collect();
    let prefix = 128 + 32 + 4 * 247 + 32 * 247;
    let mut short = LedgerWork::with_limit(prefix + 16 * 7501 - 1).unwrap();
    let input = sparse(&points, &[]);
    expect_error(reband_joint(input.joint, &mut short), ErrorKind::Budget);
    assert_eq!(short.used(), prefix);
    let mut exact = LedgerWork::with_limit(prefix + 16 * 7501).unwrap();
    let input = sparse(&points, &[]);
    expect_error(reband_joint(input.joint, &mut exact), ErrorKind::Domain);
    assert_eq!(exact.used(), 129068);
}

#[test]
fn expansion_exact_invoice_pays_products_support_copy_and_no_division_normalized_constructor() {
    for points in [
        vec![(5, 0, 1.0)],
        vec![(576, 12, 1.0)],
        vec![(4, 0, 5.0), (5, 0, 8.0), (6, 0, 5.0)],
    ] {
        let input = sparse(&points, &[(0, 7)]);
        let expected = categorical_reference(&input.probabilities);
        let banded = ok(reband_joint(input.joint, &mut LedgerWork::new()));
        let steps = expansion_steps(&expected);
        assert_eq!(invoice(&steps), expansion_fee(&expected));
        let before = snapshot(&banded);
        let mut exact = LedgerWork::with_limit(invoice(&steps)).unwrap();
        let expanded = ok(expand_joint(&banded, &mut exact));
        compare_expanded(&expanded, &specified_expansion(&expected), &input.cells);
        assert_eq!(exact.remaining(), 0);
        assert_eq!(snapshot(&banded), before);
    }
}

#[test]
fn expansion_precharge_failures_preserve_the_borrowed_banded_model_and_typed_budget_payload() {
    let input = sparse(&[(4, 0, 5.0), (5, 0, 8.0), (6, 12, 5.0)], &[(576, 12)]);
    let expected = categorical_reference(&input.probabilities);
    let banded = ok(reband_joint(input.joint, &mut LedgerWork::new()));
    let before = snapshot(&banded);
    let steps = expansion_steps(&expected);
    let mut spent = 0;
    for step in &steps {
        let mut short = LedgerWork::with_limit(spent + step.units - 1).unwrap();
        expect_error(expand_joint(&banded, &mut short), ErrorKind::Budget);
        assert_eq!(short.used(), spent, "block={}", step.label);
        assert_eq!(snapshot(&banded), before);
        spent += step.units;
    }
    let mut short = LedgerWork::with_limit(invoice(&steps) - 1).unwrap();
    expect_error(expand_joint(&banded, &mut short), ErrorKind::Budget);
    assert_eq!(short.used(), invoice(&steps) - 16 * 7501);
    assert_eq!(snapshot(&banded), before);
}

#[test]
fn owned_normalization_uses_all_mask_cells_for_certainty_without_pruning_zero_mass_bands() {
    let input = weighted(&[(0, 0, 1.0), (3, 1, 0.0)], [0; 3], 0, 576);
    let cells = input.accounting_cells().to_vec();
    let support_pointer = input.accounting_cells().as_ptr();
    let joint = ok(normalize_weighted(input, &mut LedgerWork::new()));
    assert_eq!(
        joint.support().certainty(),
        NumericCertainty {
            material: None,
            potential: None
        }
    );
    assert_eq!(joint.support().cells().as_ptr(), support_pointer);
    assert!(
        joint
            .support()
            .cells()
            .iter()
            .zip(joint.probabilities())
            .any(|(&cell, &probability)| cell && probability == 0.0)
    );
    let banded = ok(reband_joint(joint, &mut LedgerWork::new()));
    assert_eq!(banded.components().len(), 1);
    assert_eq!(banded.support().cells(), cells);
    assert_eq!(banded.support().cells().as_ptr(), support_pointer);
    assert_eq!(banded.support().certainty(), certainty(&cells));
}

#[test]
fn full_support_all_247_components_and_7501_conditionals_have_exact_maximum_invoices() {
    let input = dense(vec![1.0; N], vec![true; N]);
    let expected = categorical_reference(&input.probabilities);
    assert_eq!(expected.len(), 247);
    assert_eq!(
        expected
            .iter()
            .map(|component| component.conditional.len())
            .sum::<usize>(),
        7501
    );
    assert_eq!(invoice(&reband_steps(&expected)), 400616);
    assert_eq!(invoice(&expansion_steps(&expected)), 338716);
    let mut exact_reband = LedgerWork::with_limit(400616).unwrap();
    let banded = ok(reband_joint(input.joint, &mut exact_reband));
    assert_eq!(exact_reband.remaining(), 0);
    let mut exact_expand = LedgerWork::with_limit(338716).unwrap();
    let expanded = ok(expand_joint(&banded, &mut exact_expand));
    assert_eq!(exact_expand.remaining(), 0);
    compare_expanded(&expanded, &specified_expansion(&expected), &input.cells);
}

#[test]
fn prior_charges_and_unused_reservations_remain_spent_for_owned_and_borrowed_operations() {
    let mut normalize_work = LedgerWork::with_limit(normalization_fee() + 16).unwrap();
    normalize_work.charge(17).unwrap();
    expect_error(
        normalize_weighted(
            weighted(&[(0, 0, 1.0)], [0; 3], 0, 576),
            &mut normalize_work,
        ),
        ErrorKind::Budget,
    );
    assert_eq!(normalize_work.used(), 17 + 288);
    let mut exact = LedgerWork::new();
    exact
        .charge(LEDGER_WORK_LIMIT - normalization_fee())
        .unwrap();
    let joint = ok(normalize_weighted(
        weighted(&[(0, 0, 1.0)], [0; 3], 0, 576),
        &mut exact,
    ));
    assert_eq!(exact.remaining(), 0);
    let expected = categorical_reference(joint.probabilities());
    let mut reband_work = LedgerWork::with_limit(reband_fee(&expected) + 16).unwrap();
    reband_work.charge(17).unwrap();
    expect_error(reband_joint(joint, &mut reband_work), ErrorKind::Budget);
    assert_eq!(reband_work.used(), 17 + reband_fee(&expected) - 40);
    let input = sparse(&[(0, 0, 1.0)], &[]);
    let banded = ok(reband_joint(input.joint, &mut LedgerWork::new()));
    let before = snapshot(&banded);
    let mut expand_work = LedgerWork::with_limit(expansion_fee(&expected) + 16).unwrap();
    expand_work.charge(17).unwrap();
    expect_error(expand_joint(&banded, &mut expand_work), ErrorKind::Budget);
    assert_eq!(
        expand_work.used(),
        17 + expansion_fee(&expected) - 16 * 7501
    );
    assert_eq!(snapshot(&banded), before);
}

#[test]
fn full_support_normalize_reband_expand_composition_refuses_on_one_unchanged_caller_meter() {
    let input = full_support_weighted();
    let mass_pointer = input.masses().as_ptr();
    let mask_pointer = input.accounting_cells().as_ptr();
    let mut work = LedgerWork::new();
    let joint = ok(normalize_weighted(input, &mut work));
    assert_eq!(joint.probabilities().as_ptr(), mass_pointer);
    assert_eq!(joint.support().cells().as_ptr(), mask_pointer);
    assert_eq!(work.used(), 390340);
    let expected = categorical_reference(joint.probabilities());
    let complete_invoice = normalization_fee() + reband_fee(&expected) + expansion_fee(&expected);
    assert_eq!(complete_invoice, 1129672);
    assert!(complete_invoice > LEDGER_WORK_LIMIT);
    assert_eq!(expected.len(), 247);
    assert_eq!(
        expected
            .iter()
            .map(|component| component.conditional.len())
            .sum::<usize>(),
        7501
    );
    let banded = ok(reband_joint(joint, &mut work));
    compare_banded(&banded, &expected, &vec![true; N]);
    assert_eq!(banded.support().cells().as_ptr(), mask_pointer);
    assert_eq!(work.used(), 790956);
    let before = snapshot(&banded);
    let steps = expansion_steps(&expected);
    let prefix = work.used();
    let additional = failed_prefix(&steps, work.remaining());
    expect_error(expand_joint(&banded, &mut work), ErrorKind::Budget);
    assert_eq!(work.used(), prefix + additional);
    assert_eq!(work.used(), 1009656);
    assert_eq!(work.remaining(), 38920);
    assert_eq!(snapshot(&banded), before);
}

#[test]
fn a_small_same_meter_numeric_representation_chain_can_succeed_without_claiming_full_window_admission()
 {
    let mut work = LedgerWork::with_limit(730792).unwrap();
    let joint = ok(normalize_weighted(
        weighted(&[(0, 0, 1.0)], [0; 3], 0, 576),
        &mut work,
    ));
    assert_eq!(work.used(), 390340);
    let expected = categorical_reference(joint.probabilities());
    assert_eq!(reband_fee(&expected), 129608);
    assert_eq!(expansion_fee(&expected), 210844);
    let banded = ok(reband_joint(joint, &mut work));
    let expanded = ok(expand_joint(&banded, &mut work));
    compare_expanded(&expanded, &specified_expansion(&expected), &{
        let mut cells = vec![false; N];
        cells[0] = true;
        cells
    });
    assert_eq!(work.used(), 730792);
    assert_eq!(work.remaining(), 0);
}

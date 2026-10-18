// SPEC: _spec/packages/training/burn-compat.puml
use std::collections::{BTreeMap, BTreeSet};

use training_native::accounting_kernel::{
    AccountingError, AccountingPoint, AccountingResult, BANK_CEILING, JOINT_SIZE, MATERIAL_CEILING,
    NumericGrant, NumericTransitionRow, PointAccountingInput, accounting_point_flow,
    accounting_point_support, growth_support, joint_index,
};
use training_native::ledger::contracts::{LedgerErrorCode, LedgerRules};
use training_native::ledger::{LEDGER_WORK_LIMIT, LedgerWork};

const CELLS: usize = 7501;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct Tuple {
    spend: u8,
    created: u8,
    wasted: u8,
    growth: u8,
    destroyed: u16,
}

fn tuple(row: &NumericTransitionRow) -> Tuple {
    Tuple {
        spend: row.spend,
        created: row.created,
        wasted: row.wasted,
        growth: row.growth,
        destroyed: row.destroyed,
    }
}

fn numeric(spend: u8, created: u8, growth: u8, destroyed: u16, count: f64) -> NumericTransitionRow {
    NumericTransitionRow {
        spend,
        created,
        wasted: spend - created,
        growth,
        destroyed,
        count,
    }
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

fn input(material: u16, bank: u8) -> PointAccountingInput {
    PointAccountingInput {
        source: AccountingPoint { material, bank },
        input_turn: 0,
        visible_before: material,
        marines_before: 0,
        witnessed_loss: 0,
        destination_lower: 0,
        destination_upper: 576,
        grant: NumericGrant::None,
    }
}

fn growth_sequences(opportunities: u8) -> Vec<u8> {
    let mut sums = vec![0];
    for _ in 0..opportunities {
        sums = sums
            .into_iter()
            .flat_map(|sum| [0, 2, 4, 8].map(|increment| sum + increment))
            .collect();
    }
    sums
}

fn distinct_growth(opportunities: u8) -> BTreeSet<u8> {
    growth_sequences(opportunities).into_iter().collect()
}

fn source_tuples(rules: &LedgerRules, input: &PointAccountingInput) -> BTreeSet<Tuple> {
    let mut tuples = BTreeSet::new();
    let tier = rules.gas_capacity_by_turn[input.input_turn as usize] as u16;
    for spend in [0_u8, 1, 3, 5, 9] {
        if spend > input.source.bank {
            continue;
        }
        for created in BTreeSet::from([0, spend]) {
            let opportunities = 4_u16.min(1 + tier - u16::from(spend > 0)).min(
                u16::from(input.marines_before) + input.source.material - input.visible_before
                    + u16::from(created == 1),
            );
            for growth in distinct_growth(opportunities as u8) {
                let headstock = input.source.material + u16::from(created) + u16::from(growth);
                for destroyed in headstock.saturating_sub(576)..=headstock {
                    tuples.insert(Tuple {
                        spend,
                        created,
                        wasted: spend - created,
                        growth,
                        destroyed,
                    });
                }
            }
        }
    }
    tuples
}

fn destination_bank(rules: &LedgerRules, input: &PointAccountingInput, spend: u8) -> usize {
    let bank = usize::from(input.source.bank - spend);
    match input.grant {
        NumericGrant::None => bank,
        NumericGrant::AtNativeTurn(turn) => {
            12.min(bank + rules.income_by_turn[turn as usize] as usize)
        }
    }
}

struct Reference {
    masses: Vec<f64>,
    support: Vec<bool>,
    retained: f64,
    tuple_count: u32,
}

fn reference(
    rules: &LedgerRules,
    input: &PointAccountingInput,
    rows: &[NumericTransitionRow],
) -> Reference {
    let tuples = source_tuples(rules, input);
    let counts: BTreeMap<Tuple, f64> = rows.iter().map(|row| (tuple(row), row.count)).collect();
    assert_eq!(counts.len(), rows.len());
    let source_counts: f64 = counts
        .iter()
        .filter(|(key, _)| tuples.contains(*key))
        .map(|(_, count)| count)
        .sum();
    let denominator = source_counts + 0.5 * tuples.len() as f64;
    let mut masses = vec![0.0; CELLS];
    let mut support = vec![false; CELLS];
    for key in &tuples {
        let headstock = input.source.material + u16::from(key.created) + u16::from(key.growth);
        let material = headstock - key.destroyed;
        if key.destroyed < input.witnessed_loss
            || !(input.destination_lower..=input.destination_upper).contains(&material)
        {
            continue;
        }
        let index = 577 * destination_bank(rules, input, key.spend) + usize::from(material);
        support[index] = true;
        masses[index] += (0.5 + counts.get(key).copied().unwrap_or(0.0)) / denominator;
    }
    let retained = masses.iter().sum();
    Reference {
        masses,
        support,
        retained,
        tuple_count: tuples.len() as u32,
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ErrorKind {
    Domain,
    Unsupported,
    NonFinite,
    Underflow,
    Budget,
    BadRules,
}

fn kind(error: &AccountingError) -> ErrorKind {
    match error {
        AccountingError::Domain => ErrorKind::Domain,
        AccountingError::UnsupportedProfile => ErrorKind::Unsupported,
        AccountingError::NonFinite => ErrorKind::NonFinite,
        AccountingError::Underflow => ErrorKind::Underflow,
        AccountingError::Work(error) => match error.code {
            LedgerErrorCode::Budget => ErrorKind::Budget,
            LedgerErrorCode::BadInput => ErrorKind::BadRules,
            other => panic!("unexpected ledger error {other:?}"),
        },
    }
}

fn ok<T>(result: AccountingResult<T>) -> T {
    match result {
        Ok(value) => value,
        Err(error) => panic!("unexpected accounting error {:?}", kind(&error)),
    }
}

fn expect_error<T>(result: AccountingResult<T>, expected: ErrorKind) {
    match result {
        Err(error) => assert_eq!(kind(&error), expected),
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

fn compare(
    rules: &LedgerRules,
    input: &PointAccountingInput,
    rows: &[NumericTransitionRow],
) -> Reference {
    let expected = reference(rules, input, rows);
    let actual = ok(accounting_point_flow(
        rules,
        input,
        rows,
        &mut LedgerWork::new(),
    ));
    if expected.support.iter().all(|supported| !supported) {
        assert!(actual.is_none());
    } else {
        let actual = actual.expect("nonempty independent support requires a flow");
        assert_eq!(actual.masses().len(), CELLS);
        assert_eq!(actual.support().cells(), expected.support);
        assert!(!actual.support().is_empty());
        assert_eq!(actual.feasible_tuple_count(), expected.tuple_count);
        close(actual.retained_mass(), expected.retained);
        close(actual.masses().iter().sum(), expected.retained);
        for (index, (&actual, &expected_mass)) in
            actual.masses().iter().zip(&expected.masses).enumerate()
        {
            assert!(actual >= 0.0 && actual.is_finite());
            assert!(
                (actual - expected_mass).abs() <= 1e-12,
                "lane {index}: {actual:.17e} != {expected_mass:.17e}"
            );
            if expected.support[index] {
                assert!(actual > 0.0);
            } else {
                assert_eq!(actual, 0.0);
            }
        }
    }
    expected
}

fn compare_support(rules: &LedgerRules, input: &PointAccountingInput, expected: &[bool]) {
    let support = ok(accounting_point_support(
        rules,
        input,
        &mut LedgerWork::new(),
    ));
    assert_eq!(support.cells().len(), CELLS);
    assert_eq!(support.cells(), expected);
    assert_eq!(support.is_empty(), expected.iter().all(|value| !value));
}

#[test]
fn joint_index_covers_all_7501_cells_in_bank_major_order_and_rejects_bounds() {
    assert_eq!(MATERIAL_CEILING, 576);
    assert_eq!(BANK_CEILING, 12);
    assert_eq!(JOINT_SIZE, 7501);
    let mut seen = BTreeSet::new();
    for bank in 0..=12 {
        for material in 0..=576 {
            let index = ok(joint_index(
                AccountingPoint { material, bank },
                &mut LedgerWork::new(),
            ));
            assert_eq!(index, 577 * usize::from(bank) + usize::from(material));
            assert!(seen.insert(index));
        }
    }
    assert_eq!(seen.len(), CELLS);
    for point in [
        AccountingPoint {
            material: 577,
            bank: 0,
        },
        AccountingPoint {
            material: u16::MAX,
            bank: 0,
        },
        AccountingPoint {
            material: 0,
            bank: 13,
        },
        AccountingPoint {
            material: 0,
            bank: u8::MAX,
        },
    ] {
        expect_error(
            joint_index(point, &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
    }
}

#[test]
fn growth_masks_match_distinct_sequence_sums_for_every_zero_to_four_opportunities() {
    for opportunities in 0..=4 {
        let sums = distinct_growth(opportunities);
        let actual = ok(growth_support(opportunities, &mut LedgerWork::new()));
        for (growth, &present) in actual.iter().enumerate() {
            assert_eq!(
                present,
                sums.contains(&(growth as u8)),
                "M={opportunities}, growth={growth}"
            );
        }
        assert_eq!(actual.iter().filter(|&&value| value).count(), sums.len());
    }
    assert_eq!(
        growth_sequences(2)
            .iter()
            .filter(|&&growth| growth == 8)
            .count(),
        3
    );
    assert_eq!(
        distinct_growth(2)
            .iter()
            .filter(|&&growth| growth == 8)
            .count(),
        1
    );
    for invalid in [5, u8::MAX] {
        expect_error(
            growth_support(invalid, &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
    }
}

#[test]
fn exhaustive_420_small_sources_all_gas_visible_marine_combinations_match_every_mass_and_support_lane()
 {
    let base = structural_rules();
    let patterns = [
        vec![],
        vec![
            numeric(0, 0, 0, 0, 2.0),
            numeric(1, 0, 0, 0, 3.0),
            numeric(9, 9, 32, 617, 5.0),
        ],
        vec![
            numeric(0, 0, 0, 0, 0.25),
            numeric(0, 0, 2, 1, 7.0),
            numeric(1, 1, 0, 1, 14400.0),
            numeric(3, 3, 24, 600, 12.0),
        ],
    ];
    let mut sources = 0;
    let mut comparisons = 0;
    for material in 0..=4 {
        for bank in 0..=3 {
            for tier in 1..=3 {
                let mut rules = base.clone();
                rules.gas_capacity_by_turn[0] = tier;
                for visible in 0..=material {
                    for marines in 0..=visible {
                        sources += 1;
                        let mut point = input(material, bank);
                        point.visible_before = visible;
                        point.marines_before = marines as u8;
                        for conditioned in [false, true] {
                            point.witnessed_loss = if conditioned { 2 } else { 0 };
                            point.destination_upper =
                                if conditioned { material.min(2) } else { 576 };
                            let expected = reference(&rules, &point, &[]);
                            compare_support(&rules, &point, &expected.support);
                            for rows in &patterns {
                                let expected = compare(&rules, &point, rows);
                                if !conditioned {
                                    close(expected.retained, 1.0);
                                }
                                comparisons += 1;
                            }
                        }
                    }
                }
            }
        }
    }
    assert_eq!(sources, 420);
    assert_eq!(comparisons, 2520);
}

#[test]
fn distinct_growth_and_zero_spend_creation_are_counted_once_before_alpha_weighting() {
    let rules = structural_rules();
    let mut point = input(2, 0);
    point.visible_before = 0;
    let tuples = source_tuples(&rules, &point);
    assert_eq!(
        tuples.len(),
        distinct_growth(2)
            .iter()
            .map(|&growth| usize::from(2 + growth) + 1)
            .sum::<usize>()
    );
    assert_eq!(
        tuples
            .iter()
            .filter(|key| key.growth == 8 && key.destroyed == 0)
            .count(),
        1
    );
    let expected = compare(&rules, &point, &[]);
    assert_eq!(expected.tuple_count as usize, tuples.len());
    close(expected.retained, 1.0);
    let zero = compare(&rules, &input(0, 0), &[]);
    assert_eq!(zero.tuple_count, 1);
    assert_eq!(zero.masses[0], 1.0);
    assert_eq!(zero.support.iter().filter(|&&value| value).count(), 1);
}

#[test]
fn global_source_and_conditioning_gates_preserve_the_unconditioned_denominator() {
    let rules = structural_rules();
    let mut point = input(3, 0);
    let rows = [numeric(0, 0, 0, 0, 2.0)];
    let unconditioned = compare(&rules, &point, &rows);
    assert_eq!(unconditioned.tuple_count, 4);
    close(unconditioned.retained, 1.0);
    close(unconditioned.masses[3], 0.625);
    point.witnessed_loss = 2;
    point.destination_upper = 1;
    let conditioned = compare(&rules, &point, &rows);
    assert_eq!(conditioned.tuple_count, 4);
    assert_eq!(conditioned.masses[0], 0.125);
    assert_eq!(conditioned.masses[1], 0.125);
    assert_eq!(conditioned.retained, 0.25);
    assert_ne!(conditioned.retained, 0.5);
    assert_ne!(conditioned.retained, 1.0);
    let mut with_infeasible = rows.to_vec();
    with_infeasible.push(numeric(1, 1, 0, 0, 14400.0));
    let ignored = compare(&rules, &point, &with_infeasible);
    assert_eq!(ignored.masses, conditioned.masses);
    assert_eq!(ignored.support, conditioned.support);
    let changed = compare(&rules, &point, &[numeric(0, 0, 0, 0, 6.0)]);
    assert_eq!(changed.support, conditioned.support);
    assert_eq!(changed.retained, 0.125);
    assert_ne!(changed.masses, conditioned.masses);
}

#[test]
fn count_changes_alter_mass_but_never_the_independent_boolean_point_support() {
    let rules = structural_rules();
    let point = input(4, 3);
    let alpha = compare(&rules, &point, &[]);
    for count in [0.25, 1.0, 7.0, 14400.0] {
        let weighted = compare(&rules, &point, &[numeric(0, 0, 0, 0, count)]);
        assert_eq!(weighted.support, alpha.support);
        assert_ne!(weighted.masses, alpha.masses);
        close(weighted.retained, 1.0);
        compare_support(&rules, &point, &weighted.support);
    }
}

#[test]
fn numeric_grants_read_changed_native_tables_allow_unrelated_turns_and_cap_bank_at_twelve() {
    let mut rules = structural_rules();
    rules.max_turn = 3;
    rules.income_by_turn = vec![3, 1, 2, 3];
    rules.gas_capacity_by_turn = vec![3, 1, 2, 3];
    let mut point = input(2, 12);
    point.visible_before = 0;
    point.input_turn = 1;
    let no_grant = compare(&rules, &point, &[]);
    for turn in 0..=3 {
        point.grant = NumericGrant::AtNativeTurn(turn);
        let granted = compare(&rules, &point, &[]);
        close(granted.retained, 1.0);
        compare_support(&rules, &point, &granted.support);
        assert_ne!(granted.masses, no_grant.masses);
        assert!(granted.support[12 * 577]);
    }
    point.grant = NumericGrant::AtNativeTurn(0);
    let three_income = compare(&rules, &point, &[]);
    rules.income_by_turn[0] = 1;
    let one_income = compare(&rules, &point, &[]);
    assert_ne!(three_income.masses, one_income.masses);
    point.grant = NumericGrant::None;
    point.input_turn = 0;
    let three_gas = compare(&rules, &point, &[]);
    rules.gas_capacity_by_turn[0] = 1;
    let one_gas = compare(&rules, &point, &[]);
    assert_ne!(three_gas.tuple_count, one_gas.tuple_count);
    assert_ne!(three_gas.masses, one_gas.masses);
}

#[test]
fn structural_profiles_require_bank_twelve_and_all_income_gas_entries_in_supported_tiers() {
    let base = structural_rules();
    let point = input(0, 0);
    let mut unsupported = Vec::new();
    let mut lower = base.clone();
    lower.mineral_bank_cap = 11;
    unsupported.push(lower);
    for (index, income) in [(0, 0), (45, 0), (20, 4)] {
        let mut rules = base.clone();
        rules.income_by_turn[index] = income;
        unsupported.push(rules);
    }
    for rules in unsupported {
        rules.validate(&mut LedgerWork::new()).unwrap();
        expect_error(
            accounting_point_support(&rules, &point, &mut LedgerWork::new()),
            ErrorKind::Unsupported,
        );
        expect_error(
            accounting_point_flow(&rules, &point, &[], &mut LedgerWork::new()),
            ErrorKind::Unsupported,
        );
    }
    for gas in [0, 4] {
        let mut rules = base.clone();
        rules.gas_capacity_by_turn[45] = gas;
        expect_error(
            accounting_point_flow(&rules, &point, &[], &mut LedgerWork::new()),
            ErrorKind::BadRules,
        );
    }
    let mut malformed = base;
    malformed.income_by_turn.pop();
    expect_error(
        accounting_point_flow(&malformed, &point, &[], &mut LedgerWork::new()),
        ErrorKind::BadRules,
    );
}

#[test]
fn maximum_material_bank_and_storage_endpoints_match_all_cells_without_inventing_reachable_617() {
    let mut rules = structural_rules();
    rules.gas_capacity_by_turn[0] = 3;
    let mut point = input(576, 12);
    point.visible_before = 64;
    point.marines_before = 64;
    let tuples = source_tuples(&rules, &point);
    let maximum = tuples
        .iter()
        .map(|key| 576 + u16::from(key.created) + u16::from(key.growth))
        .max()
        .unwrap();
    assert_eq!(maximum, 609);
    assert!(!tuples.contains(&tuple(&numeric(9, 9, 32, 617, 1.0))));
    let globally_valid_impossible = [numeric(0, 0, 0, 617, 1.0), numeric(9, 9, 32, 617, 14400.0)];
    let full = compare(&rules, &point, &globally_valid_impossible);
    close(full.retained, 1.0);
    assert_eq!(full.masses, reference(&rules, &point, &[]).masses);
    compare_support(&rules, &point, &full.support);
    point.witnessed_loss = 609;
    let last = compare(&rules, &point, &[]);
    assert_eq!(last.support.iter().filter(|&&value| value).count(), 1);
    assert!(last.support[3 * 577]);
    for loss in [610, 617] {
        point.witnessed_loss = loss;
        let empty = compare(&rules, &point, &globally_valid_impossible);
        compare_support(&rules, &point, &empty.support);
        assert_eq!(empty.retained, 0.0);
    }
    point.destination_lower = 576;
    point.destination_upper = 576;
    point.witnessed_loss = 617;
    assert_eq!(
        u32::from(point.destination_upper) + u32::from(point.witnessed_loss),
        1193
    );
    let empty = compare(&rules, &point, &[]);
    assert!(empty.support.iter().all(|value| !value));
}

#[test]
fn input_header_domains_reject_before_any_row_proportional_work() {
    let rules = structural_rules();
    let base = input(3, 3);
    let mut malformed = Vec::new();
    for material in [577, u16::MAX] {
        let mut point = base;
        point.source.material = material;
        malformed.push(point);
    }
    for bank in [13, u8::MAX] {
        let mut point = base;
        point.source.bank = bank;
        malformed.push(point);
    }
    let mut point = base;
    point.visible_before = 4;
    malformed.push(point);
    let mut point = input(576, 3);
    point.marines_before = 65;
    malformed.push(point);
    let mut point = base;
    point.marines_before = 4;
    malformed.push(point);
    let mut point = base;
    point.destination_lower = 2;
    point.destination_upper = 1;
    malformed.push(point);
    let mut point = base;
    point.destination_upper = 577;
    malformed.push(point);
    let mut point = base;
    point.destination_lower = 577;
    point.destination_upper = 577;
    malformed.push(point);
    let mut point = base;
    point.witnessed_loss = 618;
    malformed.push(point);
    for point in malformed {
        expect_error(
            accounting_point_support(&rules, &point, &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
        expect_error(
            accounting_point_flow(&rules, &point, &[], &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
    }
}

#[test]
fn globally_malformed_rows_reject_even_when_source_support_is_eliminated() {
    let rules = structural_rules();
    let mut point = input(3, 0);
    point.witnessed_loss = 617;
    assert!(
        ok(accounting_point_support(
            &rules,
            &point,
            &mut LedgerWork::new()
        ))
        .is_empty()
    );
    let valid = numeric(0, 0, 0, 0, 1.0);
    let mut malformed = Vec::new();
    for spend in [2, 4, 6, 7, 8, 10, u8::MAX] {
        let mut row = valid;
        row.spend = spend;
        row.wasted = spend;
        malformed.push(row);
    }
    let mut row = numeric(3, 0, 0, 0, 1.0);
    row.created = 1;
    row.wasted = 2;
    malformed.push(row);
    let mut row = valid;
    row.created = 10;
    malformed.push(row);
    let mut row = valid;
    row.wasted = 1;
    malformed.push(row);
    let mut row = valid;
    row.wasted = 10;
    malformed.push(row);
    for growth in [1, 3, 31, 33, u8::MAX] {
        let mut row = valid;
        row.growth = growth;
        malformed.push(row);
    }
    for destroyed in [618, u16::MAX] {
        let mut row = valid;
        row.destroyed = destroyed;
        malformed.push(row);
    }
    for count in [0.0, -0.0, -1.0, 14400.0001, f64::MAX] {
        let mut row = valid;
        row.count = count;
        malformed.push(row);
    }
    for row in malformed {
        expect_error(
            accounting_point_flow(&rules, &point, &[row], &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
    }
    for count in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        let mut row = valid;
        row.count = count;
        expect_error(
            accounting_point_flow(&rules, &point, &[row], &mut LedgerWork::new()),
            ErrorKind::NonFinite,
        );
    }
    assert!(
        ok(accounting_point_flow(
            &rules,
            &point,
            &[numeric(9, 9, 32, 617, 14400.0)],
            &mut LedgerWork::new()
        ))
        .is_none()
    );
}

#[test]
fn strict_tuple_lexicographic_uniqueness_excludes_count_from_the_key() {
    let rules = structural_rules();
    let point = input(4, 3);
    let first = numeric(0, 0, 0, 0, 1.0);
    let later = numeric(0, 0, 0, 1, 2.0);
    for rows in [
        vec![first, first],
        vec![
            first,
            NumericTransitionRow {
                count: 9.0,
                ..first
            },
        ],
        vec![later, first],
    ] {
        expect_error(
            accounting_point_flow(&rules, &point, &rows, &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
    }
    let expected = compare(
        &rules,
        &point,
        &[
            first,
            later,
            numeric(0, 0, 2, 0, 3.0),
            numeric(1, 0, 0, 0, 4.0),
            numeric(1, 1, 0, 0, 5.0),
        ],
    );
    close(expected.retained, 1.0);
}

#[test]
fn minimum_positive_sparse_count_division_underflow_refuses_even_with_positive_alpha_background() {
    let rules = structural_rules();
    let point = input(3, 0);
    let background = compare(&rules, &point, &[]);
    assert_eq!(background.tuple_count, 4);
    assert_eq!(background.masses[3], 0.25);
    let smallest = f64::from_bits(1);
    assert!(smallest > 0.0);
    assert_eq!(smallest / 2.0, 0.0);
    expect_error(
        accounting_point_flow(
            &rules,
            &point,
            &[numeric(0, 0, 0, 0, smallest)],
            &mut LedgerWork::new(),
        ),
        ErrorKind::Underflow,
    );
    let ignored = compare(&rules, &point, &[numeric(9, 9, 32, 617, smallest)]);
    assert_eq!(ignored.masses, background.masses);
    assert_eq!(ignored.support, background.support);
    let mut excluded = point;
    excluded.witnessed_loss = 2;
    excluded.destination_upper = 1;
    let excluded_background = compare(&rules, &excluded, &[]);
    assert!(excluded_background.retained > 0.0);
}

fn physical_rows(count: usize) -> Vec<NumericTransitionRow> {
    (0..=32)
        .step_by(2)
        .flat_map(|growth| (0..=617).map(move |destroyed| numeric(0, 0, growth, destroyed, 1.0)))
        .take(count)
        .collect()
}

#[test]
fn physical_row_cap_is_not_an_extra_allowance_and_never_returns_a_truncated_prefix() {
    let rules = structural_rules();
    let point = input(0, 0);
    let rows = physical_rows(8193);
    assert_eq!(rows.len(), 8193);
    assert!(
        rows.windows(2)
            .all(|rows| tuple(&rows[0]) < tuple(&rows[1]))
    );
    expect_error(
        accounting_point_flow(&rules, &point, &rows, &mut LedgerWork::new()),
        ErrorKind::Domain,
    );
    let mut work = LedgerWork::new();
    expect_error(
        accounting_point_flow(&rules, &point, &rows[..8192], &mut work),
        ErrorKind::Budget,
    );
    let steps = flow_steps(&rules, &point, 8192);
    assert_eq!(invoice(&steps), 1272512);
    assert_eq!(work.used(), failed_prefix(&steps, LEDGER_WORK_LIMIT));
    assert_eq!(work.used(), 963944);
}

#[test]
fn numeric_table_lookup_bounds_refuse_without_inventing_a_turn_or_grant_fallback() {
    let rules = structural_rules();
    for turn in [46, u32::MAX] {
        let mut point = input(3, 0);
        point.input_turn = turn;
        expect_error(
            accounting_point_support(&rules, &point, &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
        expect_error(
            accounting_point_flow(&rules, &point, &[], &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
        point.input_turn = 0;
        point.grant = NumericGrant::AtNativeTurn(turn);
        expect_error(
            accounting_point_support(&rules, &point, &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
        expect_error(
            accounting_point_flow(&rules, &point, &[], &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
    }
}

#[test]
fn repeated_numeric_grants_are_independent_hypotheses_not_a_retained_grant_history() {
    let rules = structural_rules();
    let mut point = input(3, 0);
    point.grant = NumericGrant::AtNativeTurn(0);
    let steps = flow_steps(&rules, &point, 0);
    let mut work = LedgerWork::new();
    let first = ok(accounting_point_flow(&rules, &point, &[], &mut work)).unwrap();
    let second = ok(accounting_point_flow(&rules, &point, &[], &mut work)).unwrap();
    assert_eq!(first.masses(), second.masses());
    assert_eq!(first.support().cells(), second.support().cells());
    assert_eq!(work.used(), 2 * invoice(&steps));
    assert!(first.support().cells()[577]);
    assert!(!first.support().cells()[2 * 577]);
    close(first.retained_mass(), 1.0);
}

#[test]
fn joint_index_reserves_entry_and_arithmetic_blocks_on_the_same_inclusive_caller_meter() {
    let point = AccountingPoint {
        material: 576,
        bank: 12,
    };
    let mut header_short = LedgerWork::with_limit(127).unwrap();
    expect_error(joint_index(point, &mut header_short), ErrorKind::Budget);
    assert_eq!(header_short.used(), 0);
    let mut arithmetic_short = LedgerWork::with_limit(159).unwrap();
    expect_error(joint_index(point, &mut arithmetic_short), ErrorKind::Budget);
    assert_eq!(arithmetic_short.used(), 128);
    let mut exact = LedgerWork::with_limit(160).unwrap();
    assert_eq!(ok(joint_index(point, &mut exact)), 7500);
    assert_eq!(exact.used(), 160);
    assert_eq!(exact.remaining(), 0);
    let mut prior = LedgerWork::with_limit(167).unwrap();
    prior.charge(8).unwrap();
    expect_error(joint_index(point, &mut prior), ErrorKind::Budget);
    assert_eq!(prior.used(), 136);
    let mut inclusive = LedgerWork::new();
    inclusive.charge(LEDGER_WORK_LIMIT - 160).unwrap();
    assert_eq!(ok(joint_index(point, &mut inclusive)), 7500);
    assert_eq!(inclusive.remaining(), 0);
}

#[derive(Clone, Copy)]
struct FeeStep {
    label: &'static str,
    units: u64,
}

fn fee(steps: &mut Vec<FeeStep>, label: &'static str, units: u64) {
    steps.push(FeeStep { label, units });
}

fn parameter_steps(rules: &LedgerRules) -> Vec<FeeStep> {
    vec![
        FeeStep {
            label: "entry",
            units: 128,
        },
        FeeStep {
            label: "parameters",
            units: 32,
        },
        FeeStep {
            label: "rules-base",
            units: 32,
        },
        FeeStep {
            label: "rules-income",
            units: rules.income_by_turn.len() as u64,
        },
        FeeStep {
            label: "rules-gas",
            units: rules.gas_capacity_by_turn.len() as u64,
        },
        FeeStep {
            label: "profile-income",
            units: 32 * rules.income_by_turn.len() as u64,
        },
    ]
}

fn growth_steps(steps: &mut Vec<FeeStep>, opportunities: u8) {
    fee(steps, "growth-stack-init", 4 * 5 * 33);
    for _ in 0..opportunities {
        for _ in 0..33 {
            for _ in [0, 2, 4, 8] {
                fee(steps, "growth-attempt", 32);
            }
        }
    }
}

fn branch_steps(steps: &mut Vec<FeeStep>, tuples: &BTreeSet<Tuple>) {
    let mut branches: BTreeMap<(u8, u8), BTreeSet<u8>> = BTreeMap::new();
    for key in tuples {
        branches
            .entry((key.spend, key.created))
            .or_default()
            .insert(key.growth);
    }
    for growths in branches.values() {
        fee(steps, "branch-parameters", 32);
        for _ in growths {
            fee(steps, "branch", 64);
        }
    }
}

fn buffer_steps(
    steps: &mut Vec<FeeStep>,
    allocation: &'static str,
    initialization: &'static str,
    lanes: u64,
) {
    fee(steps, allocation, 192);
    fee(steps, initialization, 4 * lanes);
}

fn support_steps(rules: &LedgerRules, point: &PointAccountingInput) -> Vec<FeeStep> {
    let mut steps = parameter_steps(rules);
    growth_steps(&mut steps, 4);
    buffer_steps(
        &mut steps,
        "support-stock-allocate",
        "support-stock-init",
        13 * 618,
    );
    buffer_steps(
        &mut steps,
        "support-cells-allocate",
        "support-cells-init",
        13 * 577,
    );
    branch_steps(&mut steps, &source_tuples(rules, point));
    fee(&mut steps, "suffix", 16 * 13 * 618);
    fee(&mut steps, "destination", 24 * 13 * 577);
    steps
}

fn flow_steps(rules: &LedgerRules, point: &PointAccountingInput, row_count: usize) -> Vec<FeeStep> {
    let mut steps = parameter_steps(rules);
    growth_steps(&mut steps, 4);
    if row_count > 0 {
        fee(&mut steps, "flags-allocate", 192);
        fee(&mut steps, "flags-init", 4 * row_count as u64);
    }
    fee(&mut steps, "row-validation", 64 * row_count as u64);
    let tuples = source_tuples(rules, point);
    branch_steps(&mut steps, &tuples);
    let retained = tuples.iter().any(|key| {
        let material =
            point.source.material + u16::from(key.created) + u16::from(key.growth) - key.destroyed;
        key.destroyed >= point.witnessed_loss
            && (point.destination_lower..=point.destination_upper).contains(&material)
    });
    if !retained {
        return steps;
    }
    buffer_steps(&mut steps, "stock-allocate", "stock-init", 13 * 618);
    buffer_steps(
        &mut steps,
        "stock-support-allocate",
        "stock-support-init",
        13 * 618,
    );
    buffer_steps(&mut steps, "masses-allocate", "masses-init", 13 * 577);
    buffer_steps(&mut steps, "cells-allocate", "cells-init", 13 * 577);
    branch_steps(&mut steps, &tuples);
    fee(&mut steps, "scatter", 32 * row_count as u64);
    fee(&mut steps, "suffix", 16 * 13 * 618);
    fee(&mut steps, "destination", 24 * 13 * 577);
    steps
}

fn invoice(steps: &[FeeStep]) -> u64 {
    steps.iter().map(|step| step.units).sum()
}

fn before(steps: &[FeeStep], label: &str) -> u64 {
    steps
        .iter()
        .take_while(|step| step.label != label)
        .map(|step| step.units)
        .sum()
}

fn failed_prefix(steps: &[FeeStep], remaining: u64) -> u64 {
    let mut used = 0;
    for step in steps {
        if step.units > remaining - used {
            return used;
        }
        used += step.units;
    }
    panic!("expected invoice to exceed remaining work");
}

#[test]
fn growth_work_reserves_fixed_stack_all_dp_attempts_and_detached_mask_copy() {
    for opportunities in 0..=4 {
        let mut steps = vec![
            FeeStep {
                label: "entry",
                units: 128,
            },
            FeeStep {
                label: "parameters",
                units: 32,
            },
        ];
        growth_steps(&mut steps, opportunities);
        fee(&mut steps, "growth-copy", 4 * 33);
        let total = invoice(&steps);
        assert_eq!(total, 952 + 4224 * u64::from(opportunities));
        let mut exact = LedgerWork::with_limit(total).unwrap();
        ok(growth_support(opportunities, &mut exact));
        assert_eq!(exact.used(), total);
        assert_eq!(exact.remaining(), 0);
        let mut spent = 0;
        for step in &steps {
            let mut short = LedgerWork::with_limit(spent + step.units - 1).unwrap();
            expect_error(growth_support(opportunities, &mut short), ErrorKind::Budget);
            assert_eq!(
                short.used(),
                spent,
                "M={opportunities}, block={}",
                step.label
            );
            spent += step.units;
        }
    }
}

#[test]
fn independent_flow_and_support_invoices_include_rules_buffers_and_every_branch_recalculation() {
    let rules = structural_rules();
    let mut varying = input(4, 3);
    varying.visible_before = 1;
    varying.marines_before = 1;
    for point in [input(3, 0), varying] {
        for rows in [
            vec![],
            vec![numeric(0, 0, 0, 0, 2.0)],
            vec![numeric(0, 0, 0, 0, 2.0), numeric(9, 9, 32, 617, 1.0)],
        ] {
            let steps = flow_steps(&rules, &point, rows.len());
            let mut exact = LedgerWork::with_limit(invoice(&steps)).unwrap();
            assert!(ok(accounting_point_flow(&rules, &point, &rows, &mut exact)).is_some());
            assert_eq!(exact.used(), invoice(&steps));
            assert_eq!(exact.remaining(), 0);
        }
        let steps = support_steps(&rules, &point);
        let mut exact = LedgerWork::with_limit(invoice(&steps)).unwrap();
        assert!(!ok(accounting_point_support(&rules, &point, &mut exact)).is_empty());
        assert_eq!(exact.used(), invoice(&steps));
        assert_eq!(exact.remaining(), 0);
    }
    let point = input(3, 0);
    assert_eq!(invoice(&flow_steps(&rules, &point, 0)), 453120);
    assert_eq!(invoice(&flow_steps(&rules, &point, 1)), 453412);
    assert_eq!(invoice(&flow_steps(&rules, &point, 2)), 453512);
    assert_eq!(invoice(&support_steps(&rules, &point)), 390500);
}

#[test]
fn flow_work_refuses_at_each_precharge_edge_before_flags_rows_scatter_suffix_or_destination() {
    let rules = structural_rules();
    let point = input(3, 0);
    let rows = [numeric(0, 0, 0, 0, 2.0), numeric(9, 9, 32, 617, 1.0)];
    let steps = flow_steps(&rules, &point, rows.len());
    let mut spent = 0;
    for step in &steps {
        if step.units > 0 {
            let mut short = LedgerWork::with_limit(spent + step.units - 1).unwrap();
            expect_error(
                accounting_point_flow(&rules, &point, &rows, &mut short),
                ErrorKind::Budget,
            );
            assert_eq!(short.used(), spent, "block={}", step.label);
        }
        spent += step.units;
    }
    let mut malformed = rows;
    malformed[1].count = 0.0;
    let row_charge = 64 * rows.len() as u64;
    let before_rows = before(&steps, "row-validation");
    let mut row_short = LedgerWork::with_limit(before_rows + row_charge - 1).unwrap();
    expect_error(
        accounting_point_flow(&rules, &point, &malformed, &mut row_short),
        ErrorKind::Budget,
    );
    assert_eq!(row_short.used(), before_rows);
    let mut row_exact = LedgerWork::with_limit(before_rows + row_charge).unwrap();
    expect_error(
        accounting_point_flow(&rules, &point, &malformed, &mut row_exact),
        ErrorKind::Domain,
    );
    assert_eq!(row_exact.used(), before_rows + row_charge);
    let tiny = [numeric(0, 0, 0, 0, f64::from_bits(1))];
    let tiny_steps = flow_steps(&rules, &point, 1);
    let before_scatter = before(&tiny_steps, "scatter");
    let mut scatter_short = LedgerWork::with_limit(before_scatter + 31).unwrap();
    expect_error(
        accounting_point_flow(&rules, &point, &tiny, &mut scatter_short),
        ErrorKind::Budget,
    );
    assert_eq!(scatter_short.used(), before_scatter);
    let mut scatter_exact = LedgerWork::with_limit(before_scatter + 32).unwrap();
    expect_error(
        accounting_point_flow(&rules, &point, &tiny, &mut scatter_exact),
        ErrorKind::Underflow,
    );
    assert_eq!(scatter_exact.used(), before_scatter + 32);
}

#[test]
fn independent_support_prepays_each_allocation_initialization_suffix_and_destination_block() {
    let rules = structural_rules();
    let point = input(3, 0);
    let steps = support_steps(&rules, &point);
    let mut spent = 0;
    for step in &steps {
        let mut short = LedgerWork::with_limit(spent + step.units - 1).unwrap();
        expect_error(
            accounting_point_support(&rules, &point, &mut short),
            ErrorKind::Budget,
        );
        assert_eq!(short.used(), spent, "block={}", step.label);
        spent += step.units;
    }
}

#[test]
fn source_infeasible_rows_pay_validation_flags_and_inspected_scatter_without_changing_the_flow() {
    let rules = structural_rules();
    let point = input(3, 0);
    let feasible = numeric(0, 0, 0, 0, 2.0);
    let infeasible = numeric(9, 9, 32, 617, 14400.0);
    let mut first = LedgerWork::new();
    let first_flow = ok(accounting_point_flow(
        &rules,
        &point,
        &[feasible],
        &mut first,
    ))
    .unwrap();
    let mut second = LedgerWork::new();
    let second_flow = ok(accounting_point_flow(
        &rules,
        &point,
        &[feasible, infeasible],
        &mut second,
    ))
    .unwrap();
    assert_eq!(second.used() - first.used(), 4 + 64 + 32);
    assert_eq!(first_flow.masses(), second_flow.masses());
    assert_eq!(first_flow.support().cells(), second_flow.support().cells());
    assert_eq!(
        first_flow.feasible_tuple_count(),
        second_flow.feasible_tuple_count()
    );
}

#[test]
fn eliminated_sources_validate_all_rows_before_none_and_reserve_no_numeric_output_buffers() {
    let rules = structural_rules();
    let mut point = input(3, 0);
    point.witnessed_loss = 617;
    let rows = [numeric(0, 0, 0, 0, 2.0), numeric(9, 9, 32, 617, 14400.0)];
    let steps = flow_steps(&rules, &point, rows.len());
    assert!(!steps.iter().any(|step| step.label == "stock-allocate"));
    assert_eq!(invoice(&steps), 19736);
    let mut exact = LedgerWork::with_limit(invoice(&steps)).unwrap();
    assert!(ok(accounting_point_flow(&rules, &point, &rows, &mut exact)).is_none());
    assert_eq!(exact.used(), invoice(&steps));
    let mut short = LedgerWork::with_limit(invoice(&steps) - 1).unwrap();
    expect_error(
        accounting_point_flow(&rules, &point, &rows, &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), invoice(&steps) - 64);
    let mut malformed = rows;
    malformed[1].count = 0.0;
    let mut work = LedgerWork::new();
    expect_error(
        accounting_point_flow(&rules, &point, &malformed, &mut work),
        ErrorKind::Domain,
    );
    assert_eq!(
        work.used(),
        before(&steps, "row-validation") + 64 * rows.len() as u64
    );
}

#[test]
fn same_caller_meter_accumulates_outputs_and_keeps_spent_prefix_on_later_budget_refusal() {
    let rules = structural_rules();
    let point = input(3, 0);
    let rows = [numeric(0, 0, 0, 0, 2.0)];
    let flow_invoice = flow_steps(&rules, &point, 1);
    let support_invoice = support_steps(&rules, &point);
    let mut work = LedgerWork::new();
    work.charge(17).unwrap();
    let first = ok(accounting_point_flow(&rules, &point, &rows, &mut work)).unwrap();
    let old_masses = first.masses().to_vec();
    assert_eq!(work.used(), 17 + invoice(&flow_invoice));
    let support = ok(accounting_point_support(&rules, &point, &mut work));
    assert_eq!(support.cells(), first.support().cells());
    let spent = 17 + invoice(&flow_invoice) + invoice(&support_invoice);
    assert_eq!(work.used(), spent);
    let failed = failed_prefix(&flow_invoice, work.remaining());
    expect_error(
        accounting_point_flow(&rules, &point, &rows, &mut work),
        ErrorKind::Budget,
    );
    assert_eq!(work.used(), spent + failed);
    assert_eq!(first.masses(), old_masses);
    let mut inclusive = LedgerWork::new();
    inclusive
        .charge(LEDGER_WORK_LIMIT - invoice(&flow_invoice))
        .unwrap();
    assert!(ok(accounting_point_flow(&rules, &point, &rows, &mut inclusive)).is_some());
    assert_eq!(inclusive.remaining(), 0);
    let mut below = LedgerWork::new();
    let prior = LEDGER_WORK_LIMIT - invoice(&flow_invoice) + 1;
    below.charge(prior).unwrap();
    expect_error(
        accounting_point_flow(&rules, &point, &rows, &mut below),
        ErrorKind::Budget,
    );
    assert_eq!(
        below.used(),
        prior + failed_prefix(&flow_invoice, LEDGER_WORK_LIMIT - prior)
    );
}

#[test]
fn rule_validation_and_additional_profile_table_scan_are_prepaid_without_canonical_profile_assumptions()
 {
    let rules = structural_rules();
    let mut short = rules.clone();
    short.max_turn = 3;
    short.income_by_turn.truncate(4);
    short.gas_capacity_by_turn.truncate(4);
    let point = input(3, 0);
    let long_steps = flow_steps(&rules, &point, 0);
    let short_steps = flow_steps(&short, &point, 0);
    assert_eq!(
        invoice(&long_steps) - invoice(&short_steps),
        (46 - 4) * (1 + 1 + 32)
    );
    for rules in [&rules, &short] {
        let expected = invoice(&flow_steps(rules, &point, 0));
        let mut work = LedgerWork::new();
        assert!(ok(accounting_point_flow(rules, &point, &[], &mut work)).is_some());
        assert_eq!(work.used(), expected);
    }
    let mut unsupported = rules.clone();
    unsupported.income_by_turn[45] = 4;
    let parameters = parameter_steps(&unsupported);
    let prefix = before(&parameters, "profile-income");
    let profile_scan = 32 * 46;
    let mut before_scan = LedgerWork::with_limit(prefix + profile_scan - 1).unwrap();
    expect_error(
        accounting_point_flow(&unsupported, &point, &[], &mut before_scan),
        ErrorKind::Budget,
    );
    assert_eq!(before_scan.used(), prefix);
    let mut scan_exact = LedgerWork::with_limit(prefix + profile_scan).unwrap();
    expect_error(
        accounting_point_flow(&unsupported, &point, &[], &mut scan_exact),
        ErrorKind::Unsupported,
    );
    assert_eq!(scan_exact.used(), prefix + profile_scan);
}

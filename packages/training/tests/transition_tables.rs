// SPEC: _spec/packages/training/burn-compat.puml
use std::collections::{BTreeMap, BTreeSet};

use training_native::accounting_kernel::AccountingPoint;
use training_native::ledger::contracts::{LedgerErrorCode, LedgerRules};
use training_native::ledger::{LEDGER_WORK_LIMIT, LedgerWork};
use training_native::transition_tables::{
    NumericFitGroup, NumericFitRow, NumericOutcome, NumericSourceContext, NumericTransitions,
    TableError, TableResult, TransitionCohort, build_numeric_transitions,
};

const BAND_STARTS: [u16; 19] = [
    0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512,
];

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct Key {
    spend: u8,
    created: u8,
    wasted: u8,
    growth: u8,
    destroyed: u16,
}

fn key(spend: u8, created: u8, growth: u8, destroyed: u16) -> Key {
    Key {
        spend,
        created,
        wasted: spend - created,
        growth,
        destroyed,
    }
}

fn fit(
    node_index: u8,
    material: u16,
    bank: u8,
    input_turn: u32,
    visible_before: u16,
    marines_before: u8,
    outcome: Key,
) -> NumericFitRow {
    NumericFitRow {
        node_index,
        source: AccountingPoint { material, bank },
        input_turn,
        visible_before,
        marines_before,
        outcome: NumericOutcome {
            spend: outcome.spend,
            created: outcome.created,
            wasted: outcome.wasted,
            growth: outcome.growth,
            destroyed: outcome.destroyed,
        },
    }
}

fn simple(node: u8, material: u16, bank: u8, turn: u32, outcome: Key) -> NumericFitRow {
    fit(node, material, bank, turn, material, 0, outcome)
}

fn outcome_key(row: &NumericFitRow) -> Key {
    Key {
        spend: row.outcome.spend,
        created: row.outcome.created,
        wasted: row.outcome.wasted,
        growth: row.outcome.growth,
        destroyed: row.outcome.destroyed,
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

fn source_rules() -> LedgerRules {
    let mut rules = structural_rules();
    rules.gas_capacity_by_turn[0] = 1;
    rules.gas_capacity_by_turn[1] = 2;
    rules.gas_capacity_by_turn[2] = 3;
    rules
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ErrorKind {
    Domain,
    Order,
    Infeasible,
    Capacity,
    NonFinite,
    Budget,
    BadRules,
}

fn kind(error: &TableError) -> ErrorKind {
    match error {
        TableError::Domain => ErrorKind::Domain,
        TableError::Order => ErrorKind::Order,
        TableError::InfeasibleSource => ErrorKind::Infeasible,
        TableError::Capacity => ErrorKind::Capacity,
        TableError::NonFinite => ErrorKind::NonFinite,
        TableError::Work(error) => match error.code {
            LedgerErrorCode::Budget => ErrorKind::Budget,
            LedgerErrorCode::BadInput => ErrorKind::BadRules,
            other => panic!("unexpected ledger code {other:?}"),
        },
    }
}

fn ok<T>(result: TableResult<T>) -> T {
    match result {
        Ok(value) => value,
        Err(error) => panic!("unexpected table error {:?}", kind(&error)),
    }
}

fn expect_error<T>(result: TableResult<T>, expected: ErrorKind) {
    match result {
        Err(error) => assert_eq!(kind(&error), expected),
        Ok(_) => panic!("expected {expected:?}"),
    }
}

fn build_result(
    rules: &LedgerRules,
    final_nodes: u8,
    owned: &[(u16, Vec<NumericFitRow>)],
    work: &mut LedgerWork,
) -> TableResult<NumericTransitions> {
    let groups: Vec<NumericFitGroup<'_>> = owned
        .iter()
        .map(|(slot, rows)| NumericFitGroup {
            slot: *slot,
            selected_rows: rows,
        })
        .collect();
    build_numeric_transitions(rules, final_nodes, &groups, work)
}

fn build(
    rules: &LedgerRules,
    final_nodes: u8,
    owned: &[(u16, Vec<NumericFitRow>)],
) -> NumericTransitions {
    ok(build_result(
        rules,
        final_nodes,
        owned,
        &mut LedgerWork::new(),
    ))
}

fn band(material: u16) -> u8 {
    BAND_STARTS
        .iter()
        .rposition(|&start| start <= material)
        .unwrap() as u8
}

fn tier(turn: u32) -> u8 {
    match turn {
        0..=10 => 0,
        11..=20 => 1,
        21..=45 => 2,
        _ => panic!("invalid fixture turn"),
    }
}

fn cohort_list() -> Vec<TransitionCohort> {
    let mut result = Vec::new();
    for bank in 0..13 {
        for band in 0..19 {
            for tier in 0..3 {
                result.push(TransitionCohort::BankBandTier { bank, band, tier });
            }
        }
    }
    for bank in 0..13 {
        for tier in 0..3 {
            result.push(TransitionCohort::BankTier { bank, tier });
        }
    }
    for bank in 0..13 {
        result.push(TransitionCohort::Bank { bank });
    }
    result.push(TransitionCohort::Global);
    assert_eq!(result.len(), 794);
    result
}

fn row_cohorts(row: &NumericFitRow) -> [usize; 4] {
    let bank = usize::from(row.source.bank);
    let band = usize::from(band(row.source.material));
    let tier = usize::from(tier(row.input_turn));
    [
        57 * bank + 3 * band + tier,
        741 + 3 * bank + tier,
        780 + bank,
        793,
    ]
}

struct ExpectedTable {
    cohort: TransitionCohort,
    groups: u16,
    last_group: Option<u16>,
    rows: BTreeMap<Key, f64>,
}

fn reference_tables(owned: &[(u16, Vec<NumericFitRow>)]) -> Vec<ExpectedTable> {
    let mut tables: Vec<ExpectedTable> = cohort_list()
        .into_iter()
        .map(|cohort| ExpectedTable {
            cohort,
            groups: 0,
            last_group: None,
            rows: BTreeMap::new(),
        })
        .collect();
    for (slot, rows) in owned {
        if rows.is_empty() {
            continue;
        }
        let weight = 1.0 / rows.len() as f64;
        for row in rows {
            for index in row_cohorts(row) {
                let table = &mut tables[index];
                match table.rows.get_mut(&outcome_key(row)) {
                    Some(count) => *count += weight,
                    None => {
                        table.rows.insert(outcome_key(row), weight);
                    }
                }
                if table.last_group != Some(*slot) {
                    table.groups += 1;
                    table.last_group = Some(*slot);
                }
            }
        }
    }
    tables
}

fn compare_tables(actual: &NumericTransitions, expected: &[ExpectedTable]) {
    assert_eq!(actual.tables().len(), 794);
    for (index, (actual, expected)) in actual.tables().iter().zip(expected).enumerate() {
        assert_eq!(actual.cohort(), expected.cohort, "cohort index {index}");
        assert_eq!(actual.groups(), expected.groups, "groups index {index}");
        assert_eq!(
            actual.rows().len(),
            expected.rows.len(),
            "rows index {index}"
        );
        for (row, (&key, &count)) in actual.rows().iter().zip(&expected.rows) {
            assert_eq!(
                (
                    row.spend,
                    row.created,
                    row.wasted,
                    row.growth,
                    row.destroyed
                ),
                (
                    key.spend,
                    key.created,
                    key.wasted,
                    key.growth,
                    key.destroyed
                )
            );
            assert_eq!(
                row.count.to_bits(),
                count.to_bits(),
                "count bits index {index}, key {key:?}"
            );
        }
    }
}

fn growth_sequences(opportunities: u8) -> Vec<u8> {
    let mut values = vec![0];
    for _ in 0..opportunities {
        values = values
            .into_iter()
            .flat_map(|value| [0, 2, 4, 8].map(|increment| value + increment))
            .collect();
    }
    values
}

fn complete_tuples(
    source: AccountingPoint,
    context: &NumericSourceContext,
    gas: u32,
) -> BTreeSet<Key> {
    let mut tuples = BTreeSet::new();
    for spend in [0_u8, 1, 3, 5, 9] {
        if spend > source.bank {
            continue;
        }
        for created in BTreeSet::from([0, spend]) {
            let opportunities = 4_u16.min(1 + gas as u16 - u16::from(spend > 0)).min(
                u16::from(context.marines_before) + source.material - context.visible_before
                    + u16::from(created == 1),
            );
            let growths: BTreeSet<u8> = growth_sequences(opportunities as u8).into_iter().collect();
            for growth in growths {
                let stock = source.material + u16::from(created) + u16::from(growth);
                for destroyed in stock.saturating_sub(576)..=stock {
                    tuples.insert(key(spend, created, growth, destroyed));
                }
            }
        }
    }
    tuples
}

fn expected_selection(expected: &[ExpectedTable], source: AccountingPoint, turn: u32) -> usize {
    let bank = usize::from(source.bank);
    let band = usize::from(band(source.material));
    let tier = usize::from(tier(turn));
    [
        57 * bank + 3 * band + tier,
        741 + 3 * bank + tier,
        780 + bank,
    ]
    .into_iter()
    .find(|&index| expected[index].groups >= 32)
    .unwrap_or(793)
}

fn compare_terms(
    actual: &NumericTransitions,
    expected: &[ExpectedTable],
    rules: &LedgerRules,
    source: AccountingPoint,
    context: &NumericSourceContext,
    tuples: &BTreeSet<Key>,
) {
    let selected = expected_selection(expected, source, context.input_turn);
    let mut count = 0.0;
    for (key, value) in &expected[selected].rows {
        if tuples.contains(key) {
            count += value;
        }
    }
    let terms = ok(actual.source_terms(source, context, &mut LedgerWork::new()));
    assert_eq!(terms.cohort, expected[selected].cohort);
    assert_eq!(terms.feasible_tuple_count, tuples.len() as u32);
    assert_eq!(terms.fitted_count_sum.to_bits(), count.to_bits());
    assert_eq!(
        terms.denominator.to_bits(),
        (count + 0.5 * tuples.len() as f64).to_bits()
    );
    assert!((1..=3).contains(&rules.gas_capacity_by_turn[context.input_turn as usize]));
}

#[test]
fn all_794_cohorts_include_canonical_indices_empties_and_unqualified_global_fallback() {
    let rules = structural_rules();
    for owned in [vec![], vec![(0, vec![]), (7, vec![]), (14399, vec![])]] {
        let tables = build(&rules, 3, &owned);
        compare_tables(&tables, &reference_tables(&owned));
        for bank in 0..=12 {
            for material in [0, 576] {
                let source = AccountingPoint { material, bank };
                assert_eq!(
                    ok(tables.select(source, 45, &mut LedgerWork::new())).cohort(),
                    TransitionCohort::Global
                );
            }
        }
        assert_eq!(tables.tables()[793].groups(), 0);
        assert!(tables.tables()[793].rows().is_empty());
        let source = AccountingPoint {
            material: 0,
            bank: 0,
        };
        let context = NumericSourceContext {
            input_turn: 0,
            visible_before: 0,
            marines_before: 0,
        };
        let terms = ok(tables.source_terms(source, &context, &mut LedgerWork::new()));
        assert_eq!(terms.feasible_tuple_count, 1);
        assert_eq!(terms.fitted_count_sum, 0.0);
        assert_eq!(terms.denominator, 0.5);
    }
}

#[test]
fn every_material_value_all_band_boundaries_and_model_turn_boundaries_map_to_independent_cohorts() {
    let rules = structural_rules();
    let turns = [0, 10, 11, 20, 21, 45];
    let mut covered = BTreeSet::new();
    for start in (0..=576_u16).step_by(12) {
        let rows: Vec<NumericFitRow> = (start..=576.min(start + 11))
            .enumerate()
            .map(|(node, material)| {
                covered.insert(material);
                simple(
                    node as u8,
                    material,
                    (material % 13) as u8,
                    turns[usize::from(material) % turns.len()],
                    key(0, 0, 0, 0),
                )
            })
            .collect();
        let owned = vec![(0, rows)];
        let tables = build(&rules, 12, &owned);
        compare_tables(&tables, &reference_tables(&owned));
    }
    assert_eq!(covered, (0..=576).collect());
    for (band_index, &start) in BAND_STARTS.iter().enumerate() {
        assert_eq!(band(start), band_index as u8);
        let end = BAND_STARTS.get(band_index + 1).map_or(576, |next| next - 1);
        assert_eq!(band(end), band_index as u8);
    }
    assert_eq!([tier(10), tier(11), tier(20), tier(21)], [0, 1, 1, 2]);
}

#[test]
fn every_bbt_bt_and_bank_contribution_index_is_exercised_by_canonical_numeric_witnesses() {
    let rules = structural_rules();
    let mut witnesses = Vec::new();
    for bank in 0..13 {
        for &material in &BAND_STARTS {
            for turn in [0, 11, 21] {
                witnesses.push((material, bank, turn));
            }
        }
    }
    assert_eq!(witnesses.len(), 741);
    let mut covered = BTreeSet::new();
    for batch in witnesses.chunks(12) {
        let owned = vec![(
            0,
            batch
                .iter()
                .enumerate()
                .map(|(node, &(material, bank, turn))| {
                    simple(node as u8, material, bank, turn, key(0, 0, 0, 0))
                })
                .collect::<Vec<_>>(),
        )];
        for row in &owned[0].1 {
            covered.extend(row_cohorts(row));
        }
        let tables = build(&rules, 12, &owned);
        compare_tables(&tables, &reference_tables(&owned));
    }
    assert_eq!(covered, (0..794).collect());
}

#[test]
fn fractional_weights_use_complete_selected_row_count_including_rows_in_other_cohorts() {
    let rules = structural_rules();
    let owned = vec![(
        5,
        vec![
            simple(0, 0, 0, 0, key(0, 0, 0, 0)),
            simple(1, 1, 1, 11, key(0, 0, 0, 0)),
            simple(2, 2, 2, 21, key(0, 0, 0, 0)),
        ],
    )];
    let tables = build(&rules, 3, &owned);
    compare_tables(&tables, &reference_tables(&owned));
    for row in &owned[0].1 {
        for cohort in &row_cohorts(row)[..3] {
            assert_eq!(tables.tables()[*cohort].groups(), 1);
            assert_eq!(
                tables.tables()[*cohort].rows()[0].count.to_bits(),
                (1.0_f64 / 3.0).to_bits()
            );
        }
    }
    assert_eq!(tables.tables()[793].groups(), 1);
    assert_eq!(tables.tables()[793].rows()[0].count, 1.0);
}

#[test]
fn canonical_fractional_contributions_are_not_reassociated_into_group_or_chunk_totals() {
    let rules = structural_rules();
    let owned: Vec<(u16, Vec<NumericFitRow>)> = (0..2)
        .map(|slot| {
            (
                slot,
                (0..3)
                    .map(|node| simple(node, 0, 0, 0, key(0, 0, 0, 0)))
                    .collect(),
            )
        })
        .collect();
    let tables = build(&rules, 3, &owned);
    compare_tables(&tables, &reference_tables(&owned));
    let mut canonical = 0.0_f64;
    for _ in 0..6 {
        canonical += 1.0 / 3.0;
    }
    let mut one_chunk = 0.0_f64;
    for _ in 0..3 {
        one_chunk += 1.0 / 3.0;
    }
    let merged = one_chunk + one_chunk;
    assert_ne!(canonical.to_bits(), merged.to_bits());
    assert_eq!(
        tables.tables()[793].rows()[0].count.to_bits(),
        canonical.to_bits()
    );
    assert_eq!(tables.tables()[793].groups(), 2);
}

#[test]
fn reverse_tuple_insertions_growth_copies_and_found_updates_preserve_sorted_order_and_count_bits() {
    let rules = structural_rules();
    let mut owned = vec![(
        0,
        (0..12)
            .map(|node| simple(node, 20, 0, 0, key(0, 0, 0, u16::from(11 - node))))
            .collect::<Vec<_>>(),
    )];
    owned.push((
        1,
        vec![
            simple(0, 20, 0, 0, key(0, 0, 0, 5)),
            simple(1, 20, 0, 0, key(0, 0, 0, 5)),
            simple(2, 20, 0, 0, key(0, 0, 0, 11)),
        ],
    ));
    let tables = build(&rules, 12, &owned);
    compare_tables(&tables, &reference_tables(&owned));
    assert_eq!(
        tables
            .tables()
            .iter()
            .map(|table| table.rows().len())
            .sum::<usize>(),
        4 * 12
    );
    assert_eq!(
        tables.tables()[793]
            .rows()
            .iter()
            .map(|row| row.destroyed)
            .collect::<Vec<_>>(),
        (0..12).collect::<Vec<_>>()
    );
}

#[test]
fn qualification_31_to_32_uses_distinct_group_counts_at_every_backoff_level() {
    let rules = structural_rules();
    for level in 0..4 {
        for count in [31_u16, 32] {
            let owned: Vec<(u16, Vec<NumericFitRow>)> = (0..count)
                .map(|slot| {
                    let (material, bank, turn) = match level {
                        0 => (0, 1, 0),
                        1 => (slot % 2, 1, 0),
                        2 => (0, 1, [0, 11, 21][usize::from(slot % 3)]),
                        _ => (0, (slot % 13) as u8, 0),
                    };
                    (slot, vec![simple(0, material, bank, turn, key(0, 0, 0, 0))])
                })
                .collect();
            let tables = build(&rules, 3, &owned);
            let expected = reference_tables(&owned);
            compare_tables(&tables, &expected);
            let source = AccountingPoint {
                material: 0,
                bank: 1,
            };
            let mut select_work = LedgerWork::new();
            let selected = ok(tables.select(source, 0, &mut select_work));
            let expected_cohort = if count == 31 || level == 3 {
                TransitionCohort::Global
            } else {
                match level {
                    0 => TransitionCohort::BankBandTier {
                        bank: 1,
                        band: 0,
                        tier: 0,
                    },
                    1 => TransitionCohort::BankTier { bank: 1, tier: 0 },
                    _ => TransitionCohort::Bank { bank: 1 },
                }
            };
            assert_eq!(selected.cohort(), expected_cohort);
            assert_eq!(tables.tables()[793].groups(), count);
            let context = NumericSourceContext {
                input_turn: 0,
                visible_before: 0,
                marines_before: 0,
            };
            assert_eq!(
                select_work.used(),
                invoice(&query_steps(&expected, source, &context, false))
            );
            let mut terms_work = LedgerWork::new();
            ok(tables.source_terms(source, &context, &mut terms_work));
            assert_eq!(
                terms_work.used(),
                invoice(&query_steps(&expected, source, &context, true))
            );
        }
    }
    let owned: Vec<(u16, Vec<NumericFitRow>)> = (0..32)
        .map(|slot| {
            (
                slot,
                (0..3)
                    .map(|node| simple(node, 0, 0, 0, key(0, 0, 0, 0)))
                    .collect(),
            )
        })
        .collect();
    let tables = build(&rules, 3, &owned);
    compare_tables(&tables, &reference_tables(&owned));
    assert_eq!(tables.tables()[0].groups(), 32);
    assert_eq!(
        ok(tables.select(
            AccountingPoint {
                material: 0,
                bank: 0
            },
            0,
            &mut LedgerWork::new()
        ))
        .cohort(),
        TransitionCohort::BankBandTier {
            bank: 0,
            band: 0,
            tier: 0
        }
    );
}

#[test]
fn qualified_table_with_no_query_feasible_rows_stays_selected_and_cohort_a1_needs_some_source_not_every_source()
 {
    let rules = structural_rules();
    let mut owned: Vec<(u16, Vec<NumericFitRow>)> = (0..32)
        .map(|slot| (slot, vec![simple(0, 10, 1, 0, key(1, 1, 0, 11))]))
        .collect();
    owned.push((32, vec![simple(0, 8, 1, 21, key(0, 0, 0, 0))]));
    let tables = build(&rules, 3, &owned);
    let expected = reference_tables(&owned);
    compare_tables(&tables, &expected);
    let source = AccountingPoint {
        material: 8,
        bank: 1,
    };
    let context = NumericSourceContext {
        input_turn: 0,
        visible_before: 8,
        marines_before: 0,
    };
    let tuples = complete_tuples(source, &context, rules.gas_capacity_by_turn[0]);
    compare_terms(&tables, &expected, &rules, source, &context, &tuples);
    let mut query_work = LedgerWork::new();
    let terms = ok(tables.source_terms(source, &context, &mut query_work));
    assert_eq!(
        terms.cohort,
        TransitionCohort::BankBandTier {
            bank: 1,
            band: band(8),
            tier: 0
        }
    );
    assert_eq!(terms.fitted_count_sum, 0.0);
    assert_eq!(query_work.used(), 576);
    assert_eq!(
        query_work.used(),
        invoice(&query_steps(&expected, source, &context, true))
    );
    assert_eq!(
        terms.denominator,
        0.5 * f64::from(terms.feasible_tuple_count)
    );
    let bad_witness = vec![(0, vec![simple(0, 8, 1, 0, key(1, 1, 0, 11))])];
    expect_error(
        build_result(&rules, 3, &bad_witness, &mut LedgerWork::new()),
        ErrorKind::Infeasible,
    );
}

fn selected_outcomes() -> Vec<Key> {
    vec![
        key(0, 0, 0, 0),
        key(0, 0, 6, 1),
        key(0, 0, 14, 7),
        key(0, 0, 22, 2),
        key(0, 0, 32, 8),
        key(1, 1, 0, 0),
        key(1, 0, 8, 2),
        key(1, 1, 14, 3),
        key(3, 0, 12, 5),
        key(3, 3, 16, 7),
        key(5, 5, 24, 10),
        key(9, 9, 24, 15),
    ]
}

#[test]
fn exhaustive_420_small_contexts_match_direct_complete_tuple_z_n_and_denominator_for_joint_and_isolated_outcomes()
 {
    let rules = source_rules();
    let outcomes = selected_outcomes();
    let owned = vec![(
        0,
        outcomes
            .iter()
            .enumerate()
            .map(|(node, &outcome)| fit(node as u8, 64, 12, 2, 0, 0, outcome))
            .collect(),
    )];
    let combined = build(&rules, 12, &owned);
    let expected_combined = reference_tables(&owned);
    compare_tables(&combined, &expected_combined);
    let isolated: Vec<_> = outcomes
        .iter()
        .map(|&outcome| {
            let owned = vec![(0, vec![fit(0, 64, 12, 2, 0, 0, outcome)])];
            (build(&rules, 3, &owned), reference_tables(&owned))
        })
        .collect();
    let mut contexts = 0;
    let mut comparisons = 0;
    for material in 0..=4 {
        for bank in 0..=3 {
            for input_turn in 0..3 {
                for visible_before in 0..=material {
                    for marines_before in 0..=visible_before {
                        let source = AccountingPoint { material, bank };
                        let context = NumericSourceContext {
                            input_turn,
                            visible_before,
                            marines_before: marines_before as u8,
                        };
                        let tuples = complete_tuples(
                            source,
                            &context,
                            rules.gas_capacity_by_turn[input_turn as usize],
                        );
                        compare_terms(
                            &combined,
                            &expected_combined,
                            &rules,
                            source,
                            &context,
                            &tuples,
                        );
                        comparisons += 1;
                        for (actual, expected) in &isolated {
                            compare_terms(actual, expected, &rules, source, &context, &tuples);
                            comparisons += 1;
                        }
                        contexts += 1;
                    }
                }
            }
        }
    }
    assert_eq!(contexts, 420);
    assert_eq!(comparisons, 5460);
}

#[test]
fn minimum_growth_opportunities_and_negative_widened_bounds_match_sequence_witnesses() {
    let rules = source_rules();
    for (growth, minimum) in [(6, 2), (14, 3), (22, 4)] {
        assert_eq!(
            (0..=4).find(|&opportunities| growth_sequences(opportunities).contains(&growth)),
            Some(minimum)
        );
        let good = vec![(
            0,
            vec![fit(0, u16::from(minimum), 0, 2, 0, 0, key(0, 0, growth, 0))],
        )];
        let tables = build(&rules, 3, &good);
        compare_tables(&tables, &reference_tables(&good));
        let bad = vec![(
            0,
            vec![fit(
                0,
                u16::from(minimum - 1),
                0,
                2,
                0,
                0,
                key(0, 0, growth, 0),
            )],
        )];
        expect_error(
            build_result(&rules, 3, &bad, &mut LedgerWork::new()),
            ErrorKind::Infeasible,
        );
    }
    assert!(!(0..=4).any(|opportunities| growth_sequences(opportunities).contains(&30)));
    let unreachable = vec![(0, vec![fit(0, 64, 0, 2, 0, 0, key(0, 0, 30, 0))])];
    expect_error(
        build_result(&rules, 3, &unreachable, &mut LedgerWork::new()),
        ErrorKind::Infeasible,
    );
    let negative_bounds = vec![(0, vec![simple(0, 0, 1, 0, key(1, 1, 8, 0))])];
    let tables = build(&rules, 3, &negative_bounds);
    let expected = reference_tables(&negative_bounds);
    let source = AccountingPoint {
        material: 0,
        bank: 1,
    };
    let context = NumericSourceContext {
        input_turn: 0,
        visible_before: 0,
        marines_before: 0,
    };
    compare_terms(
        &tables,
        &expected,
        &rules,
        source,
        &context,
        &complete_tuples(source, &context, 1),
    );
}

#[test]
fn every_reachable_even_growth_matches_all_420_small_contexts_without_ceil_division_shortcuts() {
    let rules = source_rules();
    let reachable: BTreeSet<u8> = growth_sequences(4).into_iter().collect();
    assert_eq!(reachable.len(), 16);
    assert!(!reachable.contains(&30));
    let mut comparisons = 0;
    for growth in reachable {
        let owned = vec![(0, vec![fit(0, 4, 0, 2, 0, 0, key(0, 0, growth, 0))])];
        let tables = build(&rules, 3, &owned);
        let expected = reference_tables(&owned);
        for material in 0..=4 {
            for bank in 0..=3 {
                for input_turn in 0..3 {
                    for visible_before in 0..=material {
                        for marines_before in 0..=visible_before {
                            let source = AccountingPoint { material, bank };
                            let context = NumericSourceContext {
                                input_turn,
                                visible_before,
                                marines_before: marines_before as u8,
                            };
                            let tuples = complete_tuples(
                                source,
                                &context,
                                rules.gas_capacity_by_turn[input_turn as usize],
                            );
                            compare_terms(&tables, &expected, &rules, source, &context, &tuples);
                            comparisons += 1;
                        }
                    }
                }
            }
        }
    }
    assert_eq!(comparisons, 6720);
}

#[test]
fn explicit_destruction_enumeration_matches_stock_cap_split_and_z_2307() {
    let rules = source_rules();
    let tables = build(&rules, 3, &[]);
    let expected = reference_tables(&[]);
    let source = AccountingPoint {
        material: 575,
        bank: 0,
    };
    let context = NumericSourceContext {
        input_turn: 0,
        visible_before: 575,
        marines_before: 1,
    };
    let tuples = complete_tuples(source, &context, 1);
    assert_eq!(tuples.len(), 576 + 3 * 577);
    let terms = ok(tables.source_terms(source, &context, &mut LedgerWork::new()));
    assert_eq!(terms.feasible_tuple_count, 2307);
    compare_terms(&tables, &expected, &rules, source, &context, &tuples);
    for material in [574, 575, 576] {
        for bank in [0, 1, 3, 5, 9, 12] {
            let source = AccountingPoint { material, bank };
            let context = NumericSourceContext {
                input_turn: 2,
                visible_before: 64,
                marines_before: 64,
            };
            let tuples = complete_tuples(source, &context, 3);
            compare_terms(&tables, &expected, &rules, source, &context, &tuples);
        }
    }
    let bad = vec![(0, vec![fit(0, 575, 0, 0, 575, 1, key(0, 0, 2, 0))])];
    expect_error(
        build_result(&rules, 3, &bad, &mut LedgerWork::new()),
        ErrorKind::Infeasible,
    );
    let good = vec![(0, vec![fit(0, 575, 0, 0, 575, 1, key(0, 0, 2, 1))])];
    let tables = build(&rules, 3, &good);
    compare_tables(&tables, &reference_tables(&good));
}

#[test]
fn copied_native_gas_profile_is_independent_of_model_tier_and_caller_rule_mutation() {
    let mut rules = structural_rules();
    rules.gas_capacity_by_turn[0] = 3;
    let owned = vec![(0, vec![fit(0, 4, 0, 0, 0, 0, key(0, 0, 22, 0))])];
    let tables = build(&rules, 3, &owned);
    compare_tables(&tables, &reference_tables(&owned));
    assert_eq!(tables.tables()[3 * usize::from(band(4))].rows().len(), 1);
    assert!(
        tables.tables()[3 * usize::from(band(4)) + 1]
            .rows()
            .is_empty()
    );
    assert!(
        tables.tables()[3 * usize::from(band(4)) + 2]
            .rows()
            .is_empty()
    );
    let source = AccountingPoint {
        material: 4,
        bank: 0,
    };
    let context = NumericSourceContext {
        input_turn: 0,
        visible_before: 0,
        marines_before: 0,
    };
    let before = ok(tables.source_terms(source, &context, &mut LedgerWork::new()));
    let tuples = complete_tuples(source, &context, 3);
    assert_eq!(before.feasible_tuple_count as usize, tuples.len());
    rules.gas_capacity_by_turn.fill(1);
    rules.income_by_turn.fill(0);
    rules.max_turn = 0;
    let after = ok(tables.source_terms(source, &context, &mut LedgerWork::new()));
    assert_eq!(before.feasible_tuple_count, after.feasible_tuple_count);
    assert_eq!(
        before.fitted_count_sum.to_bits(),
        after.fitted_count_sum.to_bits()
    );
    assert_eq!(before.denominator.to_bits(), after.denominator.to_bits());
}

#[test]
fn malformed_slots_nodes_cardinalities_and_global_outcomes_reject_without_sorting_or_repair() {
    let rules = structural_rules();
    for final_nodes in [0, 1, 2, 13, u8::MAX] {
        expect_error(
            build_result(&rules, final_nodes, &[], &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
    }
    for slot in [14400, u16::MAX] {
        expect_error(
            build_result(&rules, 3, &[(slot, vec![])], &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
    }
    for slots in [[7, 7], [7, 6]] {
        let owned = vec![(slots[0], vec![]), (slots[1], vec![])];
        expect_error(
            build_result(&rules, 3, &owned, &mut LedgerWork::new()),
            ErrorKind::Order,
        );
    }
    for nodes in [[0, 0], [1, 0]] {
        let owned = vec![(
            0,
            nodes
                .into_iter()
                .map(|node| simple(node, 0, 0, 0, key(0, 0, 0, 0)))
                .collect(),
        )];
        expect_error(
            build_result(&rules, 3, &owned, &mut LedgerWork::new()),
            ErrorKind::Order,
        );
    }
    let too_many_nodes = vec![(
        0,
        (0..4)
            .map(|node| simple(node, 0, 0, 0, key(0, 0, 0, 0)))
            .collect(),
    )];
    expect_error(
        build_result(&rules, 3, &too_many_nodes, &mut LedgerWork::new()),
        ErrorKind::Domain,
    );
    let out_of_range = vec![(0, vec![simple(3, 0, 0, 0, key(0, 0, 0, 0))])];
    expect_error(
        build_result(&rules, 3, &out_of_range, &mut LedgerWork::new()),
        ErrorKind::Domain,
    );
    let too_many_groups: Vec<(u16, Vec<NumericFitRow>)> = (0..14401).map(|_| (0, vec![])).collect();
    expect_error(
        build_result(&rules, 3, &too_many_groups, &mut LedgerWork::new()),
        ErrorKind::Domain,
    );
    for malformed in [
        Key {
            spend: 2,
            created: 0,
            wasted: 2,
            growth: 0,
            destroyed: 0,
        },
        Key {
            spend: 3,
            created: 1,
            wasted: 2,
            growth: 0,
            destroyed: 0,
        },
        Key {
            spend: 0,
            created: 0,
            wasted: 1,
            growth: 0,
            destroyed: 0,
        },
        key(0, 0, 1, 0),
        key(0, 0, 33, 0),
        key(0, 0, 0, 618),
    ] {
        let owned = vec![(0, vec![fit(0, 64, 12, 2, 0, 0, malformed)])];
        expect_error(
            build_result(&source_rules(), 3, &owned, &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
    }
}

#[test]
fn every_fit_row_requires_its_own_feasible_source_instead_of_f3_query_ignore_semantics() {
    let rules = source_rules();
    for row in [
        simple(0, 0, 0, 0, key(1, 1, 0, 0)),
        simple(0, 0, 0, 0, key(0, 0, 0, 617)),
        fit(0, 1, 0, 0, 0, 0, key(0, 0, 6, 0)),
        fit(0, 64, 12, 2, 0, 0, key(1, 1, 22, 0)),
    ] {
        expect_error(
            build_result(&rules, 3, &[(0, vec![row])], &mut LedgerWork::new()),
            ErrorKind::Infeasible,
        );
    }
    for row in [
        simple(0, 577, 0, 0, key(0, 0, 0, 0)),
        simple(0, 0, 13, 0, key(0, 0, 0, 0)),
        simple(0, 0, 0, 46, key(0, 0, 0, 0)),
        fit(0, 0, 0, 0, 1, 0, key(0, 0, 0, 0)),
        fit(0, 64, 0, 0, 64, 65, key(0, 0, 0, 0)),
        fit(0, 1, 0, 0, 0, 1, key(0, 0, 0, 0)),
    ] {
        expect_error(
            build_result(&rules, 3, &[(0, vec![row])], &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
    }
}

#[test]
fn physically_valid_large_distinct_input_can_exhaust_work_without_partial_tables_or_cap_waivers() {
    let rules = structural_rules();
    let owned: Vec<(u16, Vec<NumericFitRow>)> = (0..512_u16)
        .collect::<Vec<_>>()
        .chunks(12)
        .enumerate()
        .map(|(slot, destructions)| {
            (
                slot as u16,
                destructions
                    .iter()
                    .enumerate()
                    .map(|(node, &destroyed)| {
                        simple(node as u8, 576, 0, 0, key(0, 0, 0, destroyed))
                    })
                    .collect(),
            )
        })
        .collect();
    assert_eq!(owned.iter().map(|(_, rows)| rows.len()).sum::<usize>(), 512);
    let mut work = LedgerWork::new();
    expect_error(
        build_result(&rules, 12, &owned, &mut work),
        ErrorKind::Budget,
    );
    assert!(work.used() > 0 && work.used() <= LEDGER_WORK_LIMIT);
}

#[derive(Clone, Copy)]
struct FeeStep {
    label: &'static str,
    units: u64,
}

fn fee(steps: &mut Vec<FeeStep>, label: &'static str, units: u64) {
    steps.push(FeeStep { label, units });
}

fn fixed_tables_fee() -> u64 {
    192 + 4 * (3 + 9 * 794 + 2 * 794) + 32 * 794
}
fn growth_metadata_fee() -> u64 {
    (0..=4)
        .map(|opportunities| 952 + 4224 * opportunities)
        .sum::<u64>()
        + 4 * 373
        + 8 * 5 * 33
}
fn profile_fee(rules: &LedgerRules) -> u64 {
    2 * 192
        + 4 * (17 + rules.income_by_turn.len() + rules.gas_capacity_by_turn.len()) as u64
        + 32 * (rules.income_by_turn.len() + rules.gas_capacity_by_turn.len()) as u64
}
fn final_fixed_fee() -> u64 {
    4 * (373 + 17 + 3)
}

fn initialization_steps(rules: &LedgerRules) -> Vec<FeeStep> {
    let entries = (rules.income_by_turn.len() + rules.gas_capacity_by_turn.len()) as u64;
    let mut steps = vec![
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
            label: "profile-allocation",
            units: 2 * 192,
        },
        FeeStep {
            label: "profile-initialization",
            units: 4 * (17 + entries),
        },
        FeeStep {
            label: "profile-validation-copy",
            units: 32 * entries,
        },
        FeeStep {
            label: "fixed-tables",
            units: fixed_tables_fee(),
        },
        FeeStep {
            label: "growth-metadata-initialization",
            units: 4 * 373,
        },
    ];
    for opportunities in 0..=4 {
        fee(&mut steps, "f3-growth-entry", 128);
        fee(&mut steps, "f3-growth-parameters", 32);
        fee(&mut steps, "f3-growth-stack", 4 * 5 * 33);
        for _ in 0..opportunities {
            for _ in 0..33 {
                for _ in [0, 2, 4, 8] {
                    fee(&mut steps, "f3-growth-attempt", 32);
                }
            }
        }
        fee(&mut steps, "f3-growth-return-copy", 4 * 33);
        fee(&mut steps, "growth-summary", 8 * 33);
    }
    steps
}

struct FeeTable {
    keys: Vec<Key>,
    paid: usize,
}

fn build_steps(rules: &LedgerRules, owned: &[(u16, Vec<NumericFitRow>)]) -> Vec<FeeStep> {
    let mut steps = initialization_steps(rules);
    let mut tables: Vec<FeeTable> = (0..794)
        .map(|_| FeeTable {
            keys: Vec::new(),
            paid: 0,
        })
        .collect();
    let mut occupied = 0;
    for (_, rows) in owned {
        fee(&mut steps, "group-header", 32);
        if rows.is_empty() {
            continue;
        }
        fee(&mut steps, "group-weight", 32);
        for row in rows {
            fee(&mut steps, "row-validation", 64);
            fee(&mut steps, "row-source", 32);
            fee(&mut steps, "row-interval", 128);
            fee(&mut steps, "row-minimum-lookup", 32);
            for table_index in row_cohorts(row) {
                fee(&mut steps, "contribution-index", 32);
                fee(&mut steps, "single-search", 14 * 16);
                let table = &mut tables[table_index];
                let outcome = outcome_key(row);
                let position = table
                    .keys
                    .iter()
                    .position(|&key| key >= outcome)
                    .unwrap_or(table.keys.len());
                if table.keys.get(position) == Some(&outcome) {
                    fee(&mut steps, "count-update", 32);
                } else {
                    assert!(occupied < 8192);
                    let length = table.keys.len();
                    if length == table.paid {
                        let new_paid = if table.paid == 0 {
                            1
                        } else {
                            8192.min(2 * table.paid)
                        };
                        fee(&mut steps, "row-growth-allocation", 192);
                        fee(
                            &mut steps,
                            "row-growth-initialization",
                            4 * 6 * new_paid as u64,
                        );
                        fee(&mut steps, "row-growth-old-copy", 64 * length as u64);
                        fee(&mut steps, "row-growth-metadata", 32);
                        table.paid = new_paid;
                    }
                    fee(&mut steps, "new-row-copy", 64);
                    fee(
                        &mut steps,
                        "insertion-shifts",
                        64 * (length - position) as u64,
                    );
                    fee(&mut steps, "new-length-global-count", 32);
                    table.keys.insert(position, outcome);
                    occupied += 1;
                }
                fee(&mut steps, "qualification-every-contribution", 32);
            }
        }
    }
    fee(&mut steps, "final-fixed-move", final_fixed_fee());
    fee(&mut steps, "final-tables", 32 * 794);
    fee(&mut steps, "final-rows", 64 * occupied);
    steps
}

fn invoice(steps: &[FeeStep]) -> u64 {
    steps.iter().map(|step| step.units).sum()
}

fn before(steps: &[FeeStep], label: &str, occurrence: usize) -> u64 {
    let mut matched = 0;
    let mut units = 0;
    for step in steps {
        if step.label == label {
            if matched == occurrence {
                return units;
            }
            matched += 1;
        }
        units += step.units;
    }
    panic!("missing fee step {label}, occurrence {occurrence}");
}

fn query_steps(
    expected: &[ExpectedTable],
    source: AccountingPoint,
    context: &NumericSourceContext,
    terms: bool,
) -> Vec<FeeStep> {
    let selected = expected_selection(expected, source, context.input_turn);
    let levels = match expected[selected].cohort {
        TransitionCohort::BankBandTier { .. } => 1,
        TransitionCohort::BankTier { .. } => 2,
        TransitionCohort::Bank { .. } => 3,
        TransitionCohort::Global => 4,
    };
    let mut steps = vec![
        FeeStep {
            label: "query-entry",
            units: 128,
        },
        FeeStep {
            label: "query-source",
            units: 32,
        },
    ];
    for _ in 0..levels {
        fee(&mut steps, "query-selection-index", 32);
    }
    if terms {
        for spend in [0, 1, 3, 5, 9] {
            if spend > source.bank {
                continue;
            }
            for _ in BTreeSet::from([0, spend]) {
                fee(&mut steps, "z-parameters", 32);
                fee(&mut steps, "z-prefix-lookup", 32);
            }
        }
        fee(
            &mut steps,
            "canonical-row-inspection",
            32 * expected[selected].rows.len() as u64,
        );
        for _ in &expected[selected].rows {
            fee(&mut steps, "query-row-interval", 128);
            fee(&mut steps, "query-row-minimum-lookup", 32);
        }
    }
    steps
}

#[test]
fn independent_empty_builder_invoices_cover_fixed_tables_growth_profile_and_final_ownership() {
    let rules = structural_rules();
    assert_eq!(fixed_tables_fee(), 60548);
    assert_eq!(growth_metadata_fee(), 49812);
    assert_eq!(profile_fee(&rules), 3764);
    assert_eq!(final_fixed_fee(), 1572);
    let steps = build_steps(&rules, &[]);
    assert_eq!(invoice(&initialization_steps(&rules)), 114408);
    assert_eq!(invoice(&steps), 141388);
    let mut exact = LedgerWork::with_limit(invoice(&steps)).unwrap();
    let tables = ok(build_result(&rules, 3, &[], &mut exact));
    compare_tables(&tables, &reference_tables(&[]));
    assert_eq!(exact.used(), 141388);
    assert_eq!(exact.remaining(), 0);
    let mut spent = 0;
    for step in &steps {
        if step.units > 0 {
            let mut short = LedgerWork::with_limit(spent + step.units - 1).unwrap();
            expect_error(build_result(&rules, 3, &[], &mut short), ErrorKind::Budget);
            assert_eq!(short.used(), spent, "block={}", step.label);
        }
        spent += step.units;
    }
}

#[test]
fn every_empty_group_header_is_charged_before_order_checks_and_zero_rows_never_qualify() {
    let rules = structural_rules();
    let owned = vec![(0, vec![]), (4, vec![]), (9, vec![])];
    let steps = build_steps(&rules, &owned);
    let mut work = LedgerWork::new();
    let tables = ok(build_result(&rules, 3, &owned, &mut work));
    assert_eq!(work.used(), 141388 + 3 * 32);
    assert!(
        tables
            .tables()
            .iter()
            .all(|table| table.groups() == 0 && table.rows().is_empty())
    );
    assert_eq!(invoice(&steps), work.used());
    let duplicate = vec![(0, vec![]), (0, vec![])];
    let prefix = before(&steps, "group-header", 1);
    let mut short = LedgerWork::with_limit(prefix + 31).unwrap();
    expect_error(
        build_result(&rules, 3, &duplicate, &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), prefix);
    let mut exact = LedgerWork::with_limit(prefix + 32).unwrap();
    expect_error(
        build_result(&rules, 3, &duplicate, &mut exact),
        ErrorKind::Order,
    );
    assert_eq!(exact.used(), prefix + 32);
    let maximum: Vec<(u16, Vec<NumericFitRow>)> = (0..14400).map(|slot| (slot, vec![])).collect();
    let expected = 141388 + 32 * 14400;
    let mut exact = LedgerWork::with_limit(expected).unwrap();
    let tables = ok(build_result(&rules, 3, &maximum, &mut exact));
    assert_eq!(exact.used(), expected);
    assert!(tables.tables().iter().all(|table| table.groups() == 0));
}

#[test]
fn new_rows_consume_four_cohort_copies_and_found_updates_consume_no_new_copy_or_allocation() {
    let rules = structural_rules();
    let first = vec![(0, vec![simple(0, 0, 0, 0, key(0, 0, 0, 0))])];
    let mut work = LedgerWork::new();
    let tables = ok(build_result(&rules, 3, &first, &mut work));
    assert_eq!(
        tables
            .tables()
            .iter()
            .map(|table| table.rows().len())
            .sum::<usize>(),
        4
    );
    assert_eq!(invoice(&build_steps(&rules, &first)), 144492);
    assert_eq!(work.used(), 144492);
    let both = vec![
        (0, vec![simple(0, 0, 0, 0, key(0, 0, 0, 0))]),
        (1, vec![simple(0, 0, 0, 0, key(0, 0, 0, 0))]),
    ];
    let steps = build_steps(&rules, &both);
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "row-growth-allocation")
            .count(),
        4
    );
    let mut work = LedgerWork::new();
    let tables = ok(build_result(&rules, 3, &both, &mut work));
    assert_eq!(
        tables
            .tables()
            .iter()
            .map(|table| table.rows().len())
            .sum::<usize>(),
        4
    );
    assert_eq!(invoice(&steps), 146092);
    assert_eq!(work.used(), 146092);
    compare_tables(&tables, &reference_tables(&both));
}

#[test]
fn manual_paid_doubling_old_bit_copies_insertion_shifts_and_final_move_have_exact_prepaid_invoices()
{
    let rules = structural_rules();
    let owned = vec![(
        0,
        (0..12)
            .map(|node| simple(node, 20, 0, 0, key(0, 0, 0, u16::from(11 - node))))
            .collect(),
    )];
    let steps = build_steps(&rules, &owned);
    assert_eq!(invoice(&steps), 194220);
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "row-growth-allocation")
            .count(),
        4 * 5
    );
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "row-growth-old-copy")
            .map(|step| step.units)
            .sum::<u64>(),
        4 * 64 * (1 + 2 + 4 + 8)
    );
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "insertion-shifts")
            .map(|step| step.units)
            .sum::<u64>(),
        4 * 64 * (0..12).sum::<u64>()
    );
    let mut exact = LedgerWork::with_limit(invoice(&steps)).unwrap();
    let tables = ok(build_result(&rules, 12, &owned, &mut exact));
    compare_tables(&tables, &reference_tables(&owned));
    assert_eq!(exact.used(), invoice(&steps));
    assert_eq!(exact.remaining(), 0);
    let mut spent = 0;
    for step in &steps {
        if step.units > 0 && !step.label.starts_with("f3-growth-") {
            let mut short = LedgerWork::with_limit(spent + step.units - 1).unwrap();
            expect_error(
                build_result(&rules, 12, &owned, &mut short),
                ErrorKind::Budget,
            );
            assert_eq!(short.used(), spent, "block={}", step.label);
        }
        spent += step.units;
    }
}

#[test]
fn search_count_update_and_qualification_are_prepaid_even_for_same_slot_repeated_contributions() {
    let rules = structural_rules();
    let owned = vec![(
        0,
        (0..3)
            .map(|node| simple(node, 0, 0, 0, key(0, 0, 0, 0)))
            .collect(),
    )];
    let steps = build_steps(&rules, &owned);
    assert_eq!(invoice(&steps), 147564);
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "single-search")
            .count(),
        12
    );
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "count-update")
            .count(),
        8
    );
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "qualification-every-contribution")
            .count(),
        12
    );
    let mut exact = LedgerWork::with_limit(invoice(&steps)).unwrap();
    let tables = ok(build_result(&rules, 3, &owned, &mut exact));
    compare_tables(&tables, &reference_tables(&owned));
    assert_eq!(exact.used(), invoice(&steps));
    for label in [
        "single-search",
        "count-update",
        "qualification-every-contribution",
    ] {
        for (occurrence, step) in steps.iter().filter(|step| step.label == label).enumerate() {
            let prefix = before(&steps, label, occurrence);
            let mut short = LedgerWork::with_limit(prefix + step.units - 1).unwrap();
            expect_error(
                build_result(&rules, 3, &owned, &mut short),
                ErrorKind::Budget,
            );
            assert_eq!(
                short.used(),
                prefix,
                "block={label}, occurrence={occurrence}"
            );
        }
    }
}

#[test]
fn row_order_outcome_and_source_errors_are_observable_only_after_their_covered_reservations() {
    let rules = source_rules();
    let valid = vec![(0, vec![fit(0, 64, 0, 2, 0, 0, key(0, 0, 0, 0))])];
    let steps = build_steps(&rules, &valid);
    let invalid_outcome = vec![(0, vec![fit(0, 64, 0, 2, 0, 0, key(0, 0, 1, 0))])];
    let prefix = before(&steps, "row-validation", 0);
    let mut short = LedgerWork::with_limit(prefix + 63).unwrap();
    expect_error(
        build_result(&rules, 3, &invalid_outcome, &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), prefix);
    let mut exact = LedgerWork::with_limit(prefix + 64).unwrap();
    expect_error(
        build_result(&rules, 3, &invalid_outcome, &mut exact),
        ErrorKind::Domain,
    );
    assert_eq!(exact.used(), prefix + 64);
    let impossible = vec![(0, vec![fit(0, 64, 0, 2, 0, 0, key(0, 0, 30, 0))])];
    let prefix = before(&steps, "row-interval", 0);
    let mut short = LedgerWork::with_limit(prefix + 127).unwrap();
    expect_error(
        build_result(&rules, 3, &impossible, &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), prefix);
    let mut lookup_short = LedgerWork::with_limit(prefix + 128 + 31).unwrap();
    expect_error(
        build_result(&rules, 3, &impossible, &mut lookup_short),
        ErrorKind::Budget,
    );
    assert_eq!(lookup_short.used(), prefix + 128);
    let mut exact = LedgerWork::with_limit(prefix + 128 + 32).unwrap();
    expect_error(
        build_result(&rules, 3, &impossible, &mut exact),
        ErrorKind::Infeasible,
    );
    assert_eq!(exact.used(), prefix + 160);
}

#[test]
fn selected_queries_bill_one_selector_every_z_prefix_and_all_inspected_row_intervals() {
    let rules = structural_rules();
    let owned = vec![(0, vec![simple(0, 3, 0, 0, key(0, 0, 0, 0))])];
    let tables = build(&rules, 3, &owned);
    let expected = reference_tables(&owned);
    for bank in [0, 1, 3, 5, 9, 12] {
        let source = AccountingPoint { material: 3, bank };
        let context = NumericSourceContext {
            input_turn: 0,
            visible_before: 3,
            marines_before: 0,
        };
        for terms in [false, true] {
            let steps = query_steps(&expected, source, &context, terms);
            let mut exact = LedgerWork::with_limit(invoice(&steps)).unwrap();
            if terms {
                ok(tables.source_terms(source, &context, &mut exact));
            } else {
                ok(tables.select(source, 0, &mut exact));
            }
            assert_eq!(exact.used(), invoice(&steps));
            assert_eq!(exact.remaining(), 0);
            let mut spent = 0;
            for step in &steps {
                if step.units > 0 {
                    let mut short = LedgerWork::with_limit(spent + step.units - 1).unwrap();
                    if terms {
                        expect_error(
                            tables.source_terms(source, &context, &mut short),
                            ErrorKind::Budget,
                        );
                    } else {
                        expect_error(tables.select(source, 0, &mut short), ErrorKind::Budget);
                    }
                    assert_eq!(short.used(), spent, "query block={}", step.label);
                }
                spent += step.units;
            }
        }
    }
    let source = AccountingPoint {
        material: 3,
        bank: 0,
    };
    let context = NumericSourceContext {
        input_turn: 0,
        visible_before: 3,
        marines_before: 0,
    };
    assert_eq!(
        invoice(&query_steps(&expected, source, &context, false)),
        288
    );
    assert_eq!(
        invoice(&query_steps(&expected, source, &context, true)),
        544
    );
}

#[test]
fn shared_caller_meter_preserves_prior_work_and_exact_inclusive_cap_without_refunds() {
    let rules = structural_rules();
    let owned = vec![(0, vec![simple(0, 0, 0, 0, key(0, 0, 0, 0))])];
    let total = invoice(&build_steps(&rules, &owned));
    let mut exact = LedgerWork::new();
    exact.charge(LEDGER_WORK_LIMIT - total).unwrap();
    let tables = ok(build_result(&rules, 3, &owned, &mut exact));
    assert_eq!(exact.remaining(), 0);
    expect_error(
        tables.select(
            AccountingPoint {
                material: 0,
                bank: 0,
            },
            0,
            &mut exact,
        ),
        ErrorKind::Budget,
    );
    assert_eq!(exact.used(), LEDGER_WORK_LIMIT);
    let mut short = LedgerWork::new();
    let prior = LEDGER_WORK_LIMIT - total + 1;
    short.charge(prior).unwrap();
    expect_error(
        build_result(&rules, 3, &owned, &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), prior + total - 4 * 64);
    let mut work = LedgerWork::new();
    work.charge(17).unwrap();
    let tables = ok(build_result(&rules, 3, &owned, &mut work));
    assert_eq!(work.used(), 17 + total);
    let context = NumericSourceContext {
        input_turn: 0,
        visible_before: 0,
        marines_before: 0,
    };
    let source = AccountingPoint {
        material: 0,
        bank: 0,
    };
    let query = invoice(&query_steps(
        &reference_tables(&owned),
        source,
        &context,
        true,
    ));
    ok(tables.source_terms(source, &context, &mut work));
    assert_eq!(work.used(), 17 + total + query);
}

#[test]
fn malformed_profile_rejection_occurs_after_additional_copy_reservation_and_short_profiles_remain_supported()
 {
    let rules = structural_rules();
    let mut unsupported = rules.clone();
    unsupported.income_by_turn[45] = 0;
    let steps = initialization_steps(&unsupported);
    let prefix = before(&steps, "profile-validation-copy", 0);
    let validation =
        32 * (unsupported.income_by_turn.len() + unsupported.gas_capacity_by_turn.len()) as u64;
    let mut short = LedgerWork::with_limit(prefix + validation - 1).unwrap();
    expect_error(
        build_result(&unsupported, 3, &[], &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), prefix);
    let mut exact = LedgerWork::with_limit(prefix + validation).unwrap();
    expect_error(
        build_result(&unsupported, 3, &[], &mut exact),
        ErrorKind::Domain,
    );
    assert_eq!(exact.used(), prefix + validation);
    let mut small = rules;
    small.max_turn = 3;
    small.income_by_turn = vec![3, 1, 2, 3];
    small.gas_capacity_by_turn = vec![3, 1, 2, 3];
    let mut work = LedgerWork::new();
    let tables = ok(build_result(&small, 3, &[], &mut work));
    assert_eq!(work.used(), invoice(&build_steps(&small, &[])));
    assert_eq!(141388 - work.used(), (46 - 4) * (1 + 1 + 4 * 2 + 32 * 2));
    let context = NumericSourceContext {
        input_turn: 0,
        visible_before: 0,
        marines_before: 0,
    };
    let source = AccountingPoint {
        material: 4,
        bank: 0,
    };
    compare_terms(
        &tables,
        &reference_tables(&[]),
        &small,
        source,
        &context,
        &complete_tuples(source, &context, 3),
    );
    let bad_context = NumericSourceContext {
        input_turn: 4,
        visible_before: 0,
        marines_before: 0,
    };
    expect_error(
        tables.source_terms(source, &bad_context, &mut LedgerWork::new()),
        ErrorKind::Domain,
    );
}

#[test]
fn checked_query_domains_and_effective_source_metadata_precharge_before_invalid_values() {
    let rules = structural_rules();
    let tables = build(&rules, 3, &[]);
    let context = NumericSourceContext {
        input_turn: 0,
        visible_before: 0,
        marines_before: 0,
    };
    for source in [
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
            tables.select(source, 0, &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
        let mut short = LedgerWork::with_limit(159).unwrap();
        expect_error(
            tables.source_terms(source, &context, &mut short),
            ErrorKind::Budget,
        );
        assert_eq!(short.used(), 128);
        let mut exact = LedgerWork::with_limit(160).unwrap();
        expect_error(
            tables.source_terms(source, &context, &mut exact),
            ErrorKind::Domain,
        );
        assert_eq!(exact.used(), 160);
    }
    let source = AccountingPoint {
        material: 64,
        bank: 0,
    };
    for context in [
        NumericSourceContext {
            input_turn: 46,
            visible_before: 0,
            marines_before: 0,
        },
        NumericSourceContext {
            input_turn: u32::MAX,
            visible_before: 0,
            marines_before: 0,
        },
        NumericSourceContext {
            input_turn: 0,
            visible_before: 65,
            marines_before: 0,
        },
        NumericSourceContext {
            input_turn: 0,
            visible_before: 64,
            marines_before: 65,
        },
        NumericSourceContext {
            input_turn: 0,
            visible_before: 0,
            marines_before: 1,
        },
    ] {
        expect_error(
            tables.source_terms(source, &context, &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
    }
}

#[test]
fn structural_profile_checks_remain_additional_to_f5_bank_and_supported_table_domains() {
    let base = structural_rules();
    let mut cap = base.clone();
    cap.mineral_bank_cap = 11;
    let mut income = base.clone();
    income.income_by_turn[45] = 4;
    for rules in [cap, income] {
        rules.validate(&mut LedgerWork::new()).unwrap();
        expect_error(
            build_result(&rules, 3, &[], &mut LedgerWork::new()),
            ErrorKind::Domain,
        );
    }
    for invalid in [0, 4] {
        let mut rules = base.clone();
        rules.gas_capacity_by_turn[45] = invalid;
        expect_error(
            build_result(&rules, 3, &[], &mut LedgerWork::new()),
            ErrorKind::BadRules,
        );
    }
    let mut bad_length = base;
    bad_length.income_by_turn.pop();
    expect_error(
        build_result(&bad_length, 3, &[], &mut LedgerWork::new()),
        ErrorKind::BadRules,
    );
}

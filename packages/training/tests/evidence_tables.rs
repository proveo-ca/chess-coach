// SPEC: _spec/packages/training/burn-compat.puml
use std::collections::{BTreeMap, BTreeSet};

use training_native::accounting_kernel::{AccountingPoint, NumericGrant};
use training_native::evidence_tables::{
    EvidenceError, EvidenceResult, EvidenceWeightedAccounting, InnovationCode,
    NumericEconomicFitGroup, NumericEconomicFitRow, NumericEconomicTables,
    build_numeric_economic_tables, weight_evidence,
};
use training_native::joint_accounting::{
    NumericAccountingStep, RawJointAccounting, aggregate_accounting,
};
use training_native::joint_math::{NumericSupport, normalize_aggregate};
use training_native::ledger::contracts::{LedgerErrorCode, LedgerRules};
use training_native::ledger::{LEDGER_WORK_LIMIT, LedgerWork};
use training_native::transition_tables::{
    NumericFitRow, NumericOutcome, NumericSourceContext, TableError, TransitionCohort,
};

const N: usize = 7501;
const BANDS: [u16; 19] = [
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

fn transition(node: u8, source: AccountingPoint, turn: u32, key: Key) -> NumericFitRow {
    NumericFitRow {
        node_index: node,
        source,
        input_turn: turn,
        visible_before: source.material,
        marines_before: 0,
        outcome: NumericOutcome {
            spend: key.spend,
            created: key.created,
            wasted: key.wasted,
            growth: key.growth,
            destroyed: key.destroyed,
        },
    }
}

fn checked_code(bins: [u8; 3]) -> InnovationCode {
    let mut work = LedgerWork::new();
    let value = ok(InnovationCode::from_bins(bins, &mut work));
    assert_eq!(work.used(), 160);
    assert_eq!(value.bins(), bins);
    value
}

fn code_index(bins: [u8; 3]) -> usize {
    (4 * usize::from(bins[0]) + usize::from(bins[1])) * 3 + usize::from(bins[2])
}

fn compound(
    transition: NumericFitRow,
    destination: AccountingPoint,
    boundary_turn: u32,
    bins: [u8; 3],
) -> NumericEconomicFitRow {
    NumericEconomicFitRow {
        transition,
        destination,
        boundary_turn,
        innovation: checked_code(bins),
    }
}

fn derived(
    transition: NumericFitRow,
    boundary_turn: u32,
    bins: [u8; 3],
    rules: &LedgerRules,
) -> NumericEconomicFitRow {
    let material = transition.source.material
        + u16::from(transition.outcome.created)
        + u16::from(transition.outcome.growth)
        - transition.outcome.destroyed;
    let bank = 12.min(
        u32::from(transition.source.bank - transition.outcome.spend)
            + rules.income_by_turn[boundary_turn as usize],
    ) as u8;
    compound(
        transition,
        AccountingPoint { material, bank },
        boundary_turn,
        bins,
    )
}

fn neutral(
    node: u8,
    material: u16,
    destination_bank: u8,
    boundary: u32,
    bins: [u8; 3],
    rules: &LedgerRules,
) -> NumericEconomicFitRow {
    let source_bank = destination_bank - rules.income_by_turn[boundary as usize] as u8;
    derived(
        transition(
            node,
            AccountingPoint {
                material,
                bank: source_bank,
            },
            0,
            key(0, 0, 0, 0),
        ),
        boundary,
        bins,
        rules,
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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ErrorKind {
    Domain,
    Order,
    Capacity,
    NonFinite,
    Underflow,
    EmptyMass,
    TransitionInfeasible,
    Table,
    Budget,
}

fn kind(error: &EvidenceError) -> ErrorKind {
    match error {
        EvidenceError::Domain => ErrorKind::Domain,
        EvidenceError::Order => ErrorKind::Order,
        EvidenceError::Capacity => ErrorKind::Capacity,
        EvidenceError::NonFinite => ErrorKind::NonFinite,
        EvidenceError::Underflow => ErrorKind::Underflow,
        EvidenceError::EmptyMass => ErrorKind::EmptyMass,
        EvidenceError::Table(TableError::InfeasibleSource) => ErrorKind::TransitionInfeasible,
        EvidenceError::Work(error) | EvidenceError::Table(TableError::Work(error)) => {
            assert_eq!(error.code, LedgerErrorCode::Budget);
            ErrorKind::Budget
        }
        EvidenceError::Table(_) => ErrorKind::Table,
    }
}

fn ok<T>(result: EvidenceResult<T>) -> T {
    match result {
        Ok(value) => value,
        Err(error) => panic!("unexpected evidence error {:?}", kind(&error)),
    }
}

fn expect_error<T>(result: EvidenceResult<T>, expected: ErrorKind) {
    match result {
        Err(error) => assert_eq!(kind(&error), expected),
        Ok(_) => panic!("expected {expected:?}"),
    }
}

fn band(material: u16) -> usize {
    BANDS.iter().rposition(|&start| start <= material).unwrap()
}
fn tier(turn: u32) -> usize {
    match turn {
        0..=10 => 0,
        11..=20 => 1,
        21..=45 => 2,
        _ => panic!("fixture turn"),
    }
}
fn indices(point: AccountingPoint, turn: u32) -> [usize; 4] {
    let bank = usize::from(point.bank);
    [
        57 * bank + 3 * band(point.material) + tier(turn),
        741 + 3 * bank + tier(turn),
        780 + bank,
        793,
    ]
}

fn cohorts() -> Vec<TransitionCohort> {
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
    result
}

#[derive(Default)]
struct ExpectedTransition {
    groups: u16,
    last: Option<u16>,
    rows: BTreeMap<Key, f64>,
}

struct ExpectedEvidence {
    groups: u16,
    last: Option<u16>,
    counts: [f64; 48],
}

struct Model {
    actual: NumericEconomicTables,
    transitions: Vec<ExpectedTransition>,
    evidence: Vec<ExpectedEvidence>,
    rules: LedgerRules,
}

fn fit_key(row: &NumericFitRow) -> Key {
    Key {
        spend: row.outcome.spend,
        created: row.outcome.created,
        wasted: row.outcome.wasted,
        growth: row.outcome.growth,
        destroyed: row.outcome.destroyed,
    }
}

fn reference(
    owned: &[(u16, Vec<NumericEconomicFitRow>)],
) -> (Vec<ExpectedTransition>, Vec<ExpectedEvidence>) {
    let mut transitions: Vec<ExpectedTransition> =
        (0..794).map(|_| ExpectedTransition::default()).collect();
    let mut evidence: Vec<ExpectedEvidence> = (0..794)
        .map(|_| ExpectedEvidence {
            groups: 0,
            last: None,
            counts: [0.0; 48],
        })
        .collect();
    for (slot, rows) in owned {
        if rows.is_empty() {
            continue;
        }
        let weight = 1.0 / rows.len() as f64;
        for row in rows {
            for index in indices(row.transition.source, row.transition.input_turn) {
                let table = &mut transitions[index];
                match table.rows.get_mut(&fit_key(&row.transition)) {
                    Some(count) => *count += weight,
                    None => {
                        table.rows.insert(fit_key(&row.transition), weight);
                    }
                }
                if table.last != Some(*slot) {
                    table.groups += 1;
                    table.last = Some(*slot);
                }
            }
            for index in indices(row.destination, row.boundary_turn) {
                let table = &mut evidence[index];
                table.counts[code_index(row.innovation.bins())] += weight;
                if table.last != Some(*slot) {
                    table.groups += 1;
                    table.last = Some(*slot);
                }
            }
        }
    }
    (transitions, evidence)
}

fn build_result(
    rules: &LedgerRules,
    nodes: u8,
    owned: &[(u16, Vec<NumericEconomicFitRow>)],
    work: &mut LedgerWork,
) -> EvidenceResult<NumericEconomicTables> {
    let groups: Vec<NumericEconomicFitGroup<'_>> = owned
        .iter()
        .map(|(slot, rows)| NumericEconomicFitGroup {
            slot: *slot,
            selected_rows: rows,
        })
        .collect();
    build_numeric_economic_tables(rules, nodes, &groups, work)
}

fn compare_model(
    actual: &NumericEconomicTables,
    transitions: &[ExpectedTransition],
    evidence: &[ExpectedEvidence],
) {
    assert_eq!(actual.transitions().tables().len(), 794);
    assert_eq!(actual.evidence_tables().len(), 794);
    let mut occupied = 0;
    for (index, cohort) in cohorts().into_iter().enumerate() {
        let transition = &actual.transitions().tables()[index];
        let expected_transition = &transitions[index];
        assert_eq!(transition.cohort(), cohort);
        assert_eq!(transition.groups(), expected_transition.groups);
        assert_eq!(transition.rows().len(), expected_transition.rows.len());
        occupied += expected_transition.rows.len();
        for (actual, (&key, &count)) in transition.rows().iter().zip(&expected_transition.rows) {
            assert_eq!(
                (
                    actual.spend,
                    actual.created,
                    actual.wasted,
                    actual.growth,
                    actual.destroyed
                ),
                (
                    key.spend,
                    key.created,
                    key.wasted,
                    key.growth,
                    key.destroyed
                )
            );
            assert_eq!(actual.count.to_bits(), count.to_bits());
        }
        let table = &actual.evidence_tables()[index];
        let expected = &evidence[index];
        assert_eq!(table.cohort(), cohort);
        assert_eq!(table.groups(), expected.groups);
        for (code, (&count, &expected)) in table.counts().iter().zip(&expected.counts).enumerate() {
            assert_eq!(
                count.to_bits(),
                expected.to_bits(),
                "table={index}, code={code}"
            );
        }
        let positive = expected.counts.iter().filter(|&&value| value > 0.0).count();
        assert_eq!(usize::from(table.occupied_rows()), positive);
        occupied += positive;
    }
    assert_eq!(actual.occupied_sparse_rows(), occupied);
    assert!(occupied <= 8192);
}

fn make_model(rules: LedgerRules, owned: &[(u16, Vec<NumericEconomicFitRow>)]) -> Model {
    let (transitions, evidence) = reference(owned);
    let actual = ok(build_result(&rules, 12, owned, &mut LedgerWork::new()));
    compare_model(&actual, &transitions, &evidence);
    Model {
        actual,
        transitions,
        evidence,
        rules,
    }
}

fn selection(model: &Model, destination: AccountingPoint, boundary: u32) -> (usize, usize) {
    for (level, index) in indices(destination, boundary).into_iter().enumerate() {
        if level == 3 || model.evidence[index].groups >= 32 {
            return (index, level + 1);
        }
    }
    unreachable!()
}

fn likelihood(model: &Model, destination: AccountingPoint, boundary: u32, bins: [u8; 3]) -> f64 {
    if bins == [0; 3] {
        return 1.0;
    }
    let (index, _) = selection(model, destination, boundary);
    let table = &model.evidence[index];
    let mut total = 0.0;
    for count in table.counts {
        total += count;
    }
    (table.counts[code_index(bins)] + 0.5) / (total + 24.0)
}

fn query_fee(model: &Model, destination: AccountingPoint, boundary: u32, bins: [u8; 3]) -> u64 {
    if bins == [0; 3] {
        224
    } else {
        1984 + 32 * selection(model, destination, boundary).1 as u64
    }
}

fn query(model: &Model, destination: AccountingPoint, boundary: u32, bins: [u8; 3]) -> f64 {
    let code = checked_code(bins);
    let mut work = LedgerWork::new();
    let actual = ok(model
        .actual
        .evidence_likelihood(destination, boundary, code, &mut work));
    assert_eq!(
        actual.to_bits(),
        likelihood(model, destination, boundary, bins).to_bits()
    );
    assert_eq!(work.used(), query_fee(model, destination, boundary, bins));
    actual
}

type ModelSnapshot = (
    Vec<(TransitionCohort, u16, Vec<(Key, u64)>)>,
    Vec<(TransitionCohort, u16, [u64; 48], u8)>,
    usize,
);

fn snapshot(model: &Model) -> ModelSnapshot {
    (
        model
            .actual
            .transitions()
            .tables()
            .iter()
            .map(|table| {
                (
                    table.cohort(),
                    table.groups(),
                    table
                        .rows()
                        .iter()
                        .map(|row| {
                            (
                                Key {
                                    spend: row.spend,
                                    created: row.created,
                                    wasted: row.wasted,
                                    growth: row.growth,
                                    destroyed: row.destroyed,
                                },
                                row.count.to_bits(),
                            )
                        })
                        .collect(),
                )
            })
            .collect(),
        model
            .actual
            .evidence_tables()
            .iter()
            .map(|table| {
                (
                    table.cohort(),
                    table.groups(),
                    table.counts().map(f64::to_bits),
                    table.occupied_rows(),
                )
            })
            .collect(),
        model.actual.occupied_sparse_rows(),
    )
}

fn make_raw(
    model: &Model,
    sources: &[(u16, u8, f64)],
    loss: u16,
    lower: u16,
    upper: u16,
) -> RawJointAccounting {
    let mut masses = vec![0.0; N];
    let mut cells = vec![false; N];
    for &(material, bank, value) in sources {
        let index = 577 * usize::from(bank) + usize::from(material);
        cells[index] = true;
        masses[index] = value;
    }
    let mut prior_work = LedgerWork::new();
    let support = NumericSupport::from_cells(&cells, &mut prior_work).unwrap();
    let prior = normalize_aggregate(&masses, &support, &mut prior_work).unwrap();
    assert_eq!(prior_work.used(), 510900);
    let before_probabilities: Vec<u64> = prior
        .probabilities()
        .iter()
        .map(|value| value.to_bits())
        .collect();
    let before_model = snapshot(model);
    let step = NumericAccountingStep {
        context: NumericSourceContext {
            input_turn: 0,
            visible_before: 0,
            marines_before: 0,
        },
        grant: NumericGrant::None,
        witnessed_loss: loss,
        destination_lower: lower,
        destination_upper: upper,
    };
    let raw = aggregate_accounting(
        &prior,
        model.actual.transitions(),
        &step,
        &mut LedgerWork::new(),
    )
    .unwrap();
    assert_eq!(
        prior
            .probabilities()
            .iter()
            .map(|value| value.to_bits())
            .collect::<Vec<_>>(),
        before_probabilities
    );
    assert_eq!(prior.support().cells(), cells);
    assert_eq!(snapshot(model), before_model);
    raw
}

fn expected_weight(raw: &[f64], model: &Model, boundary: u32, bins: [u8; 3]) -> (Vec<f64>, f64) {
    let mut result = Vec::with_capacity(N);
    let mut retained = 0.0;
    for (index, &mass) in raw.iter().enumerate() {
        let weighted = if bins == [0; 3] || mass == 0.0 {
            mass
        } else {
            mass * likelihood(
                model,
                AccountingPoint {
                    material: (index % 577) as u16,
                    bank: (index / 577) as u8,
                },
                boundary,
                bins,
            )
        };
        result.push(weighted);
        retained += weighted;
    }
    (result, retained)
}

fn weight_fee(raw: &[f64], model: &Model, boundary: u32, bins: [u8; 3]) -> u64 {
    if bins == [0; 3] {
        return 288 + 32 * 7501 + 32 + 28;
    }
    let mut visited = BTreeSet::new();
    let mut units = 250292;
    for (index, &mass) in raw.iter().enumerate() {
        if mass <= 0.0 {
            continue;
        }
        let destination = AccountingPoint {
            material: (index % 577) as u16,
            bank: (index / 577) as u8,
        };
        units += 64;
        if visited.insert((destination.bank, band(destination.material))) {
            units += query_fee(model, destination, boundary, bins) + 32;
        }
    }
    units
}

fn apply_and_compare(
    raw: RawJointAccounting,
    model: &Model,
    boundary: u32,
    bins: [u8; 3],
) -> EvidenceWeightedAccounting {
    let mass_pointer = raw.masses().as_ptr();
    let mask_pointer = raw.accounting_cells().as_ptr();
    let mask = raw.accounting_cells().to_vec();
    let fee = weight_fee(raw.masses(), model, boundary, bins);
    let (expected, retained) = expected_weight(raw.masses(), model, boundary, bins);
    let before = snapshot(model);
    let mut work = LedgerWork::new();
    let actual = ok(weight_evidence(
        raw,
        &model.actual,
        boundary,
        checked_code(bins),
        &mut work,
    ));
    assert_eq!(actual.masses().as_ptr(), mass_pointer);
    assert_eq!(actual.accounting_cells().as_ptr(), mask_pointer);
    assert_eq!(actual.accounting_cells(), mask);
    assert_eq!(actual.masses().len(), N);
    for (index, (&mass, &expected)) in actual.masses().iter().zip(&expected).enumerate() {
        assert_eq!(mass.to_bits(), expected.to_bits(), "weighted lane={index}");
    }
    assert_eq!(actual.retained_mass().to_bits(), retained.to_bits());
    assert_eq!(work.used(), fee);
    assert_eq!(snapshot(model), before);
    actual
}

#[test]
fn all_48_codes_have_exact_checked_bins_order_and_constructor_precharge() {
    let mut codes = Vec::new();
    for y1 in 0..4 {
        for y2 in 0..4 {
            for y3 in 0..3 {
                let bins = [y1, y2, y3];
                let code = checked_code(bins);
                assert_eq!(code_index(bins), codes.len());
                assert_eq!(code.is_zero(), bins == [0; 3]);
                if let Some(previous) = codes.last() {
                    assert!(previous < &code);
                }
                codes.push(code);
            }
        }
    }
    assert_eq!(codes.len(), 48);
    for bins in [[4, 0, 0], [0, 4, 0], [0, 0, 3], [u8::MAX, 0, 0]] {
        let mut short = LedgerWork::with_limit(159).unwrap();
        expect_error(
            InnovationCode::from_bins(bins, &mut short),
            ErrorKind::Budget,
        );
        assert_eq!(short.used(), 128);
        let mut exact = LedgerWork::with_limit(160).unwrap();
        expect_error(
            InnovationCode::from_bins(bins, &mut exact),
            ErrorKind::Domain,
        );
        assert_eq!(exact.used(), 160);
    }
}

#[test]
fn all_794_by_48_counts_groups_and_combined_occupancy_match_original_compound_roster() {
    let rules = structural_rules();
    let mut owned = Vec::new();
    for group in 0..4_u16 {
        let rows = (0..12_u8)
            .map(|node| {
                let code = 12 * group as usize + usize::from(node);
                let bins = [(code / 12) as u8, ((code / 3) % 4) as u8, (code % 3) as u8];
                derived(
                    transition(
                        node,
                        AccountingPoint {
                            material: 0,
                            bank: 0,
                        },
                        0,
                        key(0, 0, 0, 0),
                    ),
                    0,
                    bins,
                    &rules,
                )
            })
            .collect();
        owned.push((group, rows));
    }
    let model = make_model(rules, &owned);
    assert_eq!(
        model
            .actual
            .evidence_tables()
            .iter()
            .map(|table| usize::from(table.occupied_rows()))
            .sum::<usize>(),
        4 * 48
    );
    assert_eq!(
        model
            .actual
            .transitions()
            .tables()
            .iter()
            .map(|table| table.rows().len())
            .sum::<usize>(),
        4
    );
    assert_eq!(model.actual.occupied_sparse_rows(), 196);
    assert_eq!(794 * 48, 38112);
    let destination = AccountingPoint {
        material: 0,
        bank: 1,
    };
    let mut effective_total = 0.0;
    for y1 in 0..4 {
        for y2 in 0..4 {
            for y3 in 0..3 {
                effective_total += query(&model, destination, 0, [y1, y2, y3]);
            }
        }
    }
    assert!(effective_total > 1.9);
    assert_ne!(effective_total, 1.0);
}

#[test]
fn complete_r_empty_roster_entries_and_once_per_slot_groups_are_shared_by_both_families() {
    let rules = structural_rules();
    let owned = vec![
        (
            0,
            vec![
                derived(
                    transition(
                        0,
                        AccountingPoint {
                            material: 0,
                            bank: 0,
                        },
                        0,
                        key(0, 0, 0, 0),
                    ),
                    0,
                    [0, 0, 0],
                    &rules,
                ),
                derived(
                    transition(
                        1,
                        AccountingPoint {
                            material: 1,
                            bank: 1,
                        },
                        11,
                        key(0, 0, 0, 0),
                    ),
                    11,
                    [1, 0, 0],
                    &rules,
                ),
                derived(
                    transition(
                        2,
                        AccountingPoint {
                            material: 2,
                            bank: 2,
                        },
                        21,
                        key(0, 0, 0, 0),
                    ),
                    21,
                    [3, 3, 2],
                    &rules,
                ),
            ],
        ),
        (3, vec![]),
    ];
    let model = make_model(rules, &owned);
    for row in &owned[0].1 {
        let table = indices(row.destination, row.boundary_turn)[0];
        assert_eq!(model.actual.evidence_tables()[table].groups(), 1);
        assert_eq!(
            model.actual.evidence_tables()[table].counts()[code_index(row.innovation.bins())]
                .to_bits(),
            (1.0_f64 / 3.0).to_bits()
        );
        let input_table = indices(row.transition.source, row.transition.input_turn)[0];
        assert_eq!(
            model.actual.transitions().tables()[input_table].rows()[0]
                .count
                .to_bits(),
            (1.0_f64 / 3.0).to_bits()
        );
    }
    assert_eq!(model.actual.evidence_tables()[793].groups(), 1);
}

#[test]
fn repeated_codes_follow_canonical_fractional_bits_not_group_or_chunk_rounded_totals() {
    let rules = structural_rules();
    let owned: Vec<_> = (0..2_u16)
        .map(|slot| {
            (
                slot,
                (0..3)
                    .map(|node| neutral(node, 0, 3, 0, [1, 0, 0], &rules))
                    .collect(),
            )
        })
        .collect();
    let model = make_model(rules, &owned);
    let mut canonical = 0.0_f64;
    for _ in 0..6 {
        canonical += 1.0 / 3.0;
    }
    let mut group_total = 0.0_f64;
    for _ in 0..3 {
        group_total += 1.0 / 3.0;
    }
    assert_ne!(canonical.to_bits(), (group_total + group_total).to_bits());
    assert_eq!(
        model.actual.evidence_tables()[793].counts()[12].to_bits(),
        canonical.to_bits()
    );
    assert_eq!(model.actual.evidence_tables()[793].groups(), 2);
    assert_eq!(
        model.actual.transitions().tables()[793].rows()[0]
            .count
            .to_bits(),
        canonical.to_bits()
    );
}

#[test]
fn evidence_uses_destination_bank_band_boundary_tier_and_nominal_table_income() {
    let rules = structural_rules();
    let owned = vec![(
        0,
        vec![
            derived(
                transition(
                    0,
                    AccountingPoint {
                        material: 3,
                        bank: 3,
                    },
                    10,
                    key(3, 3, 0, 0),
                ),
                11,
                [3, 2, 1],
                &rules,
            ),
            derived(
                transition(
                    1,
                    AccountingPoint {
                        material: 3,
                        bank: 3,
                    },
                    20,
                    key(3, 3, 0, 0),
                ),
                21,
                [1, 1, 1],
                &rules,
            ),
            derived(
                transition(
                    2,
                    AccountingPoint {
                        material: 4,
                        bank: 12,
                    },
                    21,
                    key(0, 0, 0, 0),
                ),
                0,
                [0, 3, 2],
                &rules,
            ),
        ],
    )];
    assert_eq!(
        (
            owned[0].1[0].destination.material,
            owned[0].1[0].destination.bank
        ),
        (6, 2)
    );
    let model = make_model(rules, &owned);
    assert_eq!(indices(owned[0].1[0].transition.source, 10)[0], 180);
    assert_eq!(indices(owned[0].1[0].destination, 11)[0], 130);
    assert_eq!(
        model.actual.evidence_tables()[130].counts()[code_index([3, 2, 1])].to_bits(),
        (1.0_f64 / 3.0).to_bits()
    );
    assert_eq!(
        model.actual.evidence_tables()[180].counts()[code_index([3, 2, 1])],
        0.0
    );
    assert_eq!(owned[0].1[1].destination.bank, 3);
    assert_eq!(owned[0].1[2].destination.bank, 12);
}

#[test]
fn all_codes_accept_numeric_feasible_transitions_without_invented_code_action_constraints() {
    let mut rules = structural_rules();
    rules.gas_capacity_by_turn[0] = 3;
    rules.income_by_turn[0] = 3;
    for y1 in 0..4 {
        for y2 in 0..4 {
            for y3 in 0..3 {
                let owned = vec![(
                    0,
                    vec![derived(
                        transition(
                            0,
                            AccountingPoint {
                                material: 0,
                                bank: 0,
                            },
                            0,
                            key(0, 0, 0, 0),
                        ),
                        0,
                        [y1, y2, y3],
                        &rules,
                    )],
                )];
                let model = make_model(rules.clone(), &owned);
                let table = indices(
                    AccountingPoint {
                        material: 0,
                        bank: 3,
                    },
                    0,
                )[0];
                assert_eq!(
                    model.actual.evidence_tables()[table].counts()[code_index([y1, y2, y3])],
                    1.0
                );
                assert_eq!(model.actual.evidence_tables()[table + 1].groups(), 0);
            }
        }
    }
}

#[test]
fn likelihood_anchors_keep_zero_fit_counts_but_validate_zero_inference_before_bypass() {
    let rules = structural_rules();
    let empty = make_model(rules.clone(), &[]);
    let destination = AccountingPoint {
        material: 0,
        bank: 3,
    };
    assert_eq!(query(&empty, destination, 0, [1, 0, 0]), 1.0 / 48.0);
    assert_eq!(query(&empty, destination, 0, [0; 3]), 1.0);
    let one = make_model(
        rules.clone(),
        &[(0, vec![neutral(0, 0, 3, 0, [0; 3], &rules)])],
    );
    assert_eq!(query(&one, destination, 0, [1, 0, 0]), 1.0 / 50.0);
    let mut owned: Vec<_> = (0..32_u16)
        .map(|slot| (slot, vec![neutral(0, 0, 3, 0, [0; 3], &rules)]))
        .collect();
    owned.push((32, vec![neutral(0, 1, 3, 0, [1, 0, 0], &rules)]));
    let qualified = make_model(rules, &owned);
    assert_eq!(selection(&qualified, destination, 0).1, 1);
    assert!(qualified.evidence[741 + 3 * 3].counts[12] > 0.0);
    assert_eq!(query(&qualified, destination, 0, [1, 0, 0]), 1.0 / 112.0);
    assert_eq!(query(&qualified, destination, 0, [0; 3]), 1.0);
}

#[test]
fn qualification_31_32_at_every_destination_level_uses_groups_and_never_code_presence_fallback() {
    let rules = structural_rules();
    for level in 0..4 {
        for count in [31_u16, 32] {
            let owned: Vec<_> = (0..count)
                .map(|slot| {
                    let (material, bank, boundary) = match level {
                        0 => (0, 3, 0),
                        1 => (slot % 2, 3, 0),
                        2 => (0, 3, [0, 11, 21][usize::from(slot % 3)]),
                        _ => (0, 3 + (slot % 10) as u8, 0),
                    };
                    (
                        slot,
                        vec![neutral(0, material, bank, boundary, [0; 3], &rules)],
                    )
                })
                .collect();
            let model = make_model(rules.clone(), &owned);
            let destination = AccountingPoint {
                material: 0,
                bank: 3,
            };
            let expected_q = if count == 31 || level == 3 {
                4
            } else {
                level + 1
            };
            assert_eq!(selection(&model, destination, 0).1, expected_q);
            query(&model, destination, 0, [1, 0, 0]);
            assert_eq!(model.actual.evidence_tables()[793].groups(), count);
        }
    }
}

#[test]
fn fractional_count_mass_below_32_does_not_block_32_distinct_group_qualification() {
    let rules = structural_rules();
    let owned: Vec<_> = (0..32_u16)
        .map(|slot| {
            (
                slot,
                vec![
                    neutral(0, 0, 3, 0, [0; 3], &rules),
                    neutral(1, 1, 4, 0, [1, 0, 0], &rules),
                    neutral(2, 2, 5, 0, [1, 0, 0], &rules),
                ],
            )
        })
        .collect();
    let model = make_model(rules, &owned);
    let destination = AccountingPoint {
        material: 0,
        bank: 3,
    };
    let (selected, depth) = selection(&model, destination, 0);
    assert_eq!(depth, 1);
    assert_eq!(model.actual.evidence_tables()[selected].groups(), 32);
    assert!(
        model.actual.evidence_tables()[selected]
            .counts()
            .iter()
            .sum::<f64>()
            < 32.0
    );
    let actual = query(&model, destination, 0, [1, 0, 0]);
    let global = &model.evidence[793].counts;
    let mut global_total = 0.0;
    for &count in global {
        global_total += count;
    }
    let fallback = (global[12] + 0.5) / (global_total + 24.0);
    assert_ne!(actual.to_bits(), fallback.to_bits());
}

#[test]
fn all_577_material_values_and_destination_band_turn_boundaries_match_original_record_tallies() {
    let rules = structural_rules();
    let boundaries = [0, 10, 11, 20, 21, 45];
    let mut covered = BTreeSet::new();
    for first in (0..=576_u16).step_by(12) {
        let rows = (first..=576.min(first + 11))
            .enumerate()
            .map(|(node, material)| {
                covered.insert(material);
                let boundary = boundaries[usize::from(material) % boundaries.len()];
                let code = usize::from(material) % 48;
                neutral(
                    node as u8,
                    material,
                    3 + (material % 10) as u8,
                    boundary,
                    [(code / 12) as u8, ((code / 3) % 4) as u8, (code % 3) as u8],
                    &rules,
                )
            })
            .collect();
        let model = make_model(rules.clone(), &[(0, rows)]);
        assert_eq!(model.actual.evidence_tables().len(), 794);
    }
    assert_eq!(covered, (0..=576).collect());
    assert_eq!([tier(10), tier(11), tier(20), tier(21)], [0, 1, 1, 2]);
}

#[test]
fn zero_weighting_moves_both_buffers_and_preserves_all_mass_bits_mask_and_zero_pmf_cells() {
    let model = make_model(structural_rules(), &[]);
    let raw = make_raw(&model, &[(0, 0, 1.0), (3, 1, 0.0)], 0, 0, 576);
    assert!(
        raw.accounting_cells()
            .iter()
            .zip(raw.masses())
            .any(|(&cell, &mass)| cell && mass == 0.0)
    );
    let actual = apply_and_compare(raw, &model, 0, [0; 3]);
    assert_eq!(actual.retained_mass(), 1.0);
}

#[test]
fn nonzero_weighting_applies_qualified_likelihood_to_raw_mass_without_normalization_or_mask_pruning()
 {
    let model = make_model(structural_rules(), &[]);
    let raw = make_raw(&model, &[(0, 0, 1.0), (1, 0, 3.0)], 1, 0, 0);
    assert!((raw.retained_mass() - 3.0 / 22.0).abs() <= 1e-12);
    let actual = apply_and_compare(raw, &model, 0, [1, 0, 0]);
    assert!((actual.retained_mass() - (3.0 / 22.0) / 48.0).abs() <= 1e-12);
    assert!(actual.retained_mass() < 1.0);
    let raw = make_raw(&model, &[(0, 0, 1.0), (3, 1, 0.0)], 0, 0, 576);
    let actual = apply_and_compare(raw, &model, 0, [1, 0, 0]);
    assert!(
        actual
            .accounting_cells()
            .iter()
            .zip(actual.masses())
            .any(|(&cell, &mass)| cell && mass == 0.0)
    );
}

#[test]
fn local_likelihood_cache_does_not_leak_between_models_boundary_turns_or_codes() {
    let rules = structural_rules();
    let empty = make_model(rules.clone(), &[]);
    let owned: Vec<_> = (0..64_u16)
        .map(|slot| {
            let (boundary, bins) = if slot < 32 {
                (0, [1, 0, 0])
            } else {
                (11, [2, 0, 0])
            };
            (slot, vec![neutral(0, 3, 3, boundary, bins, &rules)])
        })
        .collect();
    let trained_numeric = make_model(rules, &owned);
    let mut results = Vec::new();
    for (model, boundary, bins) in [
        (&empty, 0, [1, 0, 0]),
        (&trained_numeric, 0, [1, 0, 0]),
        (&trained_numeric, 11, [1, 0, 0]),
        (&trained_numeric, 11, [2, 0, 0]),
        (&trained_numeric, 0, [2, 0, 0]),
    ] {
        let raw = make_raw(&empty, &[(3, 3, 1.0)], 0, 0, 576);
        let actual = apply_and_compare(raw, model, boundary, bins);
        results.push(actual.masses()[577 * 3 + 3].to_bits());
    }
    assert_ne!(results[0], results[1]);
    assert_ne!(results[1], results[2]);
    assert_ne!(results[2], results[3]);
    assert_ne!(results[1], results[4]);
}

#[test]
fn positive_raw_mass_multiplication_underflow_is_reachable_through_checked_public_inputs() {
    let model = make_model(structural_rules(), &[]);
    let sources = [(1, 0, 1.0), (0, 1, f64::from_bits(32))];
    let raw = make_raw(&model, &sources, 0, 0, 576);
    assert_eq!(raw.masses()[577].to_bits(), f64::from_bits(1).to_bits());
    let zero = apply_and_compare(raw, &model, 0, [0; 3]);
    assert_eq!(zero.masses()[577].to_bits(), f64::from_bits(1).to_bits());
    let raw = make_raw(&model, &sources, 0, 0, 576);
    let before = snapshot(&model);
    expect_error(
        weight_evidence(
            raw,
            &model.actual,
            0,
            checked_code([1, 0, 0]),
            &mut LedgerWork::new(),
        ),
        ErrorKind::Underflow,
    );
    assert_eq!(snapshot(&model), before);
}

#[derive(Clone, Copy)]
struct FeeStep {
    label: &'static str,
    units: u64,
}

fn fee(steps: &mut Vec<FeeStep>, label: &'static str, units: u64) {
    steps.push(FeeStep { label, units });
}
fn invoice(steps: &[FeeStep]) -> u64 {
    steps.iter().map(|step| step.units).sum()
}

fn before(steps: &[FeeStep], label: &str, occurrence: usize) -> u64 {
    let mut seen = 0;
    let mut total = 0;
    for step in steps {
        if step.label == label {
            if seen == occurrence {
                return total;
            }
            seen += 1;
        }
        total += step.units;
    }
    panic!("missing fee step {label} occurrence {occurrence}");
}

fn failed_prefix(steps: &[FeeStep], available: u64) -> u64 {
    let mut spent = 0;
    for step in steps {
        if step.units > available - spent {
            return spent;
        }
        spent += step.units;
    }
    panic!("expected a budget refusal");
}

fn path_steps(steps: &mut Vec<FeeStep>) {
    fee(steps, "path-construction", 32);
    fee(steps, "path-checked-source", 32);
    for _ in 0..4 {
        fee(steps, "path-index", 32);
    }
}

fn likelihood_steps(
    model: &Model,
    destination: AccountingPoint,
    boundary: u32,
    bins: [u8; 3],
) -> Vec<FeeStep> {
    let mut steps = vec![
        FeeStep {
            label: "query-entry",
            units: 128,
        },
        FeeStep {
            label: "query-context",
            units: 32,
        },
        FeeStep {
            label: "query-profile-loan",
            units: 32,
        },
        FeeStep {
            label: "query-profile-bound",
            units: 32,
        },
    ];
    if bins == [0; 3] {
        return steps;
    }
    path_steps(&mut steps);
    for _ in 0..selection(model, destination, boundary).1 {
        fee(&mut steps, "query-qualification", 32);
    }
    fee(&mut steps, "query-all48", 32 * 48);
    fee(&mut steps, "query-target-smoothing", 32);
    steps
}

struct PaidTable {
    keys: Vec<Key>,
    paid: usize,
}

fn old_transition_steps(
    rules: &LedgerRules,
    owned: &[(u16, Vec<NumericEconomicFitRow>)],
) -> Vec<FeeStep> {
    let entries = (rules.income_by_turn.len() + rules.gas_capacity_by_turn.len()) as u64;
    let mut steps = vec![
        FeeStep {
            label: "old-entry",
            units: 128,
        },
        FeeStep {
            label: "old-root",
            units: 32,
        },
        FeeStep {
            label: "old-rules-base",
            units: 32,
        },
        FeeStep {
            label: "old-rules-income",
            units: rules.income_by_turn.len() as u64,
        },
        FeeStep {
            label: "old-rules-gas",
            units: rules.gas_capacity_by_turn.len() as u64,
        },
        FeeStep {
            label: "old-profile-allocation",
            units: 2 * 192,
        },
        FeeStep {
            label: "old-profile-initialization",
            units: 4 * (17 + entries),
        },
        FeeStep {
            label: "old-profile-copy-check",
            units: 32 * entries,
        },
        FeeStep {
            label: "old-fixed-tables",
            units: 192 + 4 * (3 + 9 * 794 + 2 * 794) + 32 * 794,
        },
        FeeStep {
            label: "old-growth-initialization",
            units: 4 * 373,
        },
    ];
    for opportunities in 0..=4 {
        fee(&mut steps, "old-f3-growth-entry", 128);
        fee(&mut steps, "old-f3-growth-root", 32);
        fee(&mut steps, "old-f3-growth-stack", 4 * 5 * 33);
        for _ in 0..opportunities {
            for _ in 0..33 {
                for _ in [0, 2, 4, 8] {
                    fee(&mut steps, "old-f3-growth-attempt", 32);
                }
            }
        }
        fee(&mut steps, "old-f3-growth-copy", 4 * 33);
        fee(&mut steps, "old-growth-summary", 8 * 33);
    }
    let mut tables: Vec<PaidTable> = (0..794)
        .map(|_| PaidTable {
            keys: Vec::new(),
            paid: 0,
        })
        .collect();
    let mut occupied = 0;
    for (_, rows) in owned {
        fee(&mut steps, "old-group-header", 32);
        if rows.is_empty() {
            continue;
        }
        fee(&mut steps, "old-group-weight", 32);
        for row in rows {
            fee(&mut steps, "old-row-validation", 64);
            fee(&mut steps, "old-row-source", 32);
            fee(&mut steps, "old-row-interval", 128);
            fee(&mut steps, "old-row-minimum", 32);
            for table_index in indices(row.transition.source, row.transition.input_turn) {
                fee(&mut steps, "old-contribution-index", 32);
                fee(&mut steps, "old-search", 224);
                let table = &mut tables[table_index];
                let key = fit_key(&row.transition);
                let position = table
                    .keys
                    .iter()
                    .position(|&existing| existing >= key)
                    .unwrap_or(table.keys.len());
                if table.keys.get(position) == Some(&key) {
                    fee(&mut steps, "old-found-count", 32);
                } else {
                    let length = table.keys.len();
                    if length == table.paid {
                        let new_paid = if table.paid == 0 {
                            1
                        } else {
                            8192.min(2 * table.paid)
                        };
                        fee(&mut steps, "old-row-allocation", 192);
                        fee(
                            &mut steps,
                            "old-row-initialization",
                            4 * 6 * new_paid as u64,
                        );
                        fee(&mut steps, "old-row-copy", 64 * length as u64);
                        fee(&mut steps, "old-row-paid-metadata", 32);
                        table.paid = new_paid;
                    }
                    fee(&mut steps, "old-new-row-copy", 64);
                    fee(
                        &mut steps,
                        "old-row-shifts",
                        64 * (length - position) as u64,
                    );
                    fee(&mut steps, "old-row-length-global", 32);
                    table.keys.insert(position, key);
                    occupied += 1;
                }
                fee(&mut steps, "old-qualification", 32);
            }
        }
    }
    fee(&mut steps, "old-final-move", 4 * (373 + 17 + 3));
    fee(&mut steps, "old-final-tables", 32 * 794);
    fee(&mut steps, "old-final-rows", 64 * occupied);
    steps
}

fn build_steps(rules: &LedgerRules, owned: &[(u16, Vec<NumericEconomicFitRow>)]) -> Vec<FeeStep> {
    let rows = owned.iter().map(|(_, rows)| rows.len()).sum::<usize>() as u64;
    let groups = owned.len() as u64;
    let mut steps = vec![
        FeeStep {
            label: "entry",
            units: 128,
        },
        FeeStep {
            label: "root",
            units: 32,
        },
    ];
    for (_, group) in owned {
        fee(&mut steps, "preflight-group", 32);
        fee(&mut steps, "preflight-rows", 64 * group.len() as u64);
    }
    fee(&mut steps, "temporary-teardown-reservation", 32);
    fee(
        &mut steps,
        "flat-allocation-init-copy",
        192 + 12 + 4 * 11 * rows + 64 * rows,
    );
    for _ in owned {
        fee(&mut steps, "flat-group-reread", 32);
    }
    fee(
        &mut steps,
        "descriptor-allocation-init",
        192 + 12 + 4 * 3 * groups,
    );
    for _ in owned {
        fee(&mut steps, "descriptor-group-reread", 32);
    }
    steps.extend(old_transition_steps(rules, owned));
    fee(
        &mut steps,
        "actual-transition-occupancy-loan",
        32 + 32 * 794,
    );
    fee(&mut steps, "profile-loan", 32);
    fee(
        &mut steps,
        "evidence-fixed",
        192 + 4 * (3 + 56 * 794) + 32 * 794,
    );
    let mut occupied: Vec<BTreeSet<usize>> = (0..794).map(|_| BTreeSet::new()).collect();
    for (_, group) in owned {
        fee(&mut steps, "evidence-group", 32);
        if group.is_empty() {
            continue;
        }
        fee(&mut steps, "evidence-group-weight", 32);
        for row in group {
            fee(&mut steps, "compound-validation", 64);
            fee(&mut steps, "boundary-income", 32);
            fee(&mut steps, "destination-equation", 32);
            fee(&mut steps, "innovation-index", 32);
            path_steps(&mut steps);
            for table in indices(row.destination, row.boundary_turn) {
                fee(&mut steps, "evidence-cohort-access", 32);
                fee(&mut steps, "evidence-cell-access", 32);
                if occupied[table].insert(code_index(row.innovation.bins())) {
                    fee(&mut steps, "new-positive-cell", 64);
                    fee(&mut steps, "combined-occupied-mutation", 32);
                }
                fee(&mut steps, "count-calculation-store", 32);
                fee(&mut steps, "qualification-every-contribution", 32);
            }
        }
    }
    fee(&mut steps, "final-table-metadata", 32 * 794);
    for table in occupied {
        if !table.is_empty() {
            fee(&mut steps, "populated-full48-validation", 32 * 48);
        }
    }
    fee(&mut steps, "final-owned-move", 4 * (393 + 3 + 1));
    steps
}

fn weighting_steps(raw: &[f64], model: &Model, boundary: u32, bins: [u8; 3]) -> Vec<FeeStep> {
    let mut steps = vec![
        FeeStep {
            label: "weight-entry",
            units: 128,
        },
        FeeStep {
            label: "weight-context",
            units: 32,
        },
        FeeStep {
            label: "weight-profile-loan",
            units: 32,
        },
        FeeStep {
            label: "weight-profile-bound",
            units: 32,
        },
        FeeStep {
            label: "raw-parts-transfer",
            units: 32,
        },
        FeeStep {
            label: "parts-shape",
            units: 32,
        },
    ];
    if bins == [0; 3] {
        fee(&mut steps, "all-destination-scan", 32 * 7501);
    } else {
        fee(&mut steps, "material-band-loan", 32);
        fee(&mut steps, "cache-initialization", 4 * 494);
        fee(&mut steps, "all-destination-scan", 32 * 7501);
        let mut cache = BTreeSet::new();
        for bank in 0..13 {
            fee(&mut steps, "bank-reset", 32);
            for material in 0..577 {
                if BANDS[1..].contains(&(material as u16)) {
                    fee(&mut steps, "band-advance", 32);
                }
                if raw[577 * bank + material] > 0.0 {
                    fee(&mut steps, "positive-cache-index", 32);
                    if cache.insert((bank, band(material as u16))) {
                        steps.extend(likelihood_steps(
                            model,
                            AccountingPoint {
                                material: material as u16,
                                bank: bank as u8,
                            },
                            boundary,
                            bins,
                        ));
                        fee(&mut steps, "cache-miss-store", 32);
                    }
                    fee(&mut steps, "positive-product-store", 32);
                }
            }
        }
    }
    fee(&mut steps, "retained-end-check", 32);
    fee(&mut steps, "weighted-owned-move", 28);
    steps
}

#[test]
fn independently_derived_empty_and_single_row_construction_invoices_include_every_projection_and_old_builder_pass()
 {
    let rules = structural_rules();
    let empty = build_steps(&rules, &[]);
    assert_eq!(invoice(&old_transition_steps(&rules, &[])), 141388);
    assert_eq!(invoice(&empty), 397924);
    assert_eq!(192 + 4 * (3 + 56 * 794) + 32 * 794, 203468);
    assert_eq!(4 * (393 + 3 + 1), 1588);
    let owned = vec![(0, vec![neutral(0, 0, 3, 0, [1, 0, 0], &rules)])];
    let single = build_steps(&rules, &owned);
    assert_eq!(invoice(&single), 408764);
    for (owned, steps) in [(&[][..], empty), (&owned[..], single)] {
        let mut work = LedgerWork::with_limit(invoice(&steps)).unwrap();
        let actual = ok(build_result(&rules, 12, owned, &mut work));
        let (transitions, evidence) = reference(owned);
        compare_model(&actual, &transitions, &evidence);
        assert_eq!(work.used(), invoice(&steps));
        assert_eq!(work.remaining(), 0);
    }
}

#[test]
fn all_precharge_edges_cover_projection_real_occupancy_init_and_full_populated_counts_before_publication()
 {
    let rules = structural_rules();
    let owned = vec![(0, vec![neutral(0, 0, 3, 0, [1, 0, 0], &rules)])];
    let steps = build_steps(&rules, &owned);
    let mut spent = 0;
    for step in &steps {
        if step.units > 0 {
            let mut work = LedgerWork::with_limit(spent + step.units - 1).unwrap();
            expect_error(
                build_result(&rules, 12, &owned, &mut work),
                ErrorKind::Budget,
            );
            assert_eq!(work.used(), spent, "block={}", step.label);
        }
        spent += step.units;
    }
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "actual-transition-occupancy-loan")
            .count(),
        1
    );
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "populated-full48-validation")
            .count(),
        4
    );
}

#[test]
fn empty_groups_are_preserved_and_pay_five_headers_each_without_evidence_count_rescans() {
    let rules = structural_rules();
    let owned = vec![(0, vec![]), (7, vec![]), (14399, vec![])];
    let steps = build_steps(&rules, &owned);
    assert_eq!(invoice(&steps), 397924 + 3 * (5 * 32 + 12));
    assert!(
        !steps
            .iter()
            .any(|step| step.label == "populated-full48-validation")
    );
    let mut work = LedgerWork::with_limit(invoice(&steps)).unwrap();
    let actual = ok(build_result(&rules, 3, &owned, &mut work));
    assert_eq!(work.used(), invoice(&steps));
    assert_eq!(actual.occupied_sparse_rows(), 0);
    for table in actual.evidence_tables() {
        assert_eq!(table.groups(), 0);
        assert_eq!(table.occupied_rows(), 0);
        assert_eq!(table.counts(), &[0.0; 48]);
    }
}

#[test]
fn repeated_same_slot_contributions_still_reserve_count_and_qualification_before_mutation() {
    let rules = structural_rules();
    let owned = vec![(
        0,
        (0..3)
            .map(|node| neutral(node, 0, 3, 0, [1, 0, 0], &rules))
            .collect(),
    )];
    let steps = build_steps(&rules, &owned);
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "new-positive-cell")
            .count(),
        4
    );
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "count-calculation-store")
            .count(),
        12
    );
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "qualification-every-contribution")
            .count(),
        12
    );
    let mut work = LedgerWork::with_limit(invoice(&steps)).unwrap();
    let model = ok(build_result(&rules, 12, &owned, &mut work));
    assert_eq!(work.used(), invoice(&steps));
    assert_eq!(model.evidence_tables()[793].groups(), 1);
    for label in [
        "new-positive-cell",
        "combined-occupied-mutation",
        "count-calculation-store",
        "qualification-every-contribution",
    ] {
        for (occurrence, step) in steps.iter().filter(|step| step.label == label).enumerate() {
            let prefix = before(&steps, label, occurrence);
            let mut short = LedgerWork::with_limit(prefix + step.units - 1).unwrap();
            expect_error(
                build_result(&rules, 12, &owned, &mut short),
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
fn public_likelihood_zero_and_nonzero_queries_reserve_each_context_path_qualification_and_all48_block()
 {
    let model = make_model(structural_rules(), &[]);
    let destination = AccountingPoint {
        material: 0,
        bank: 3,
    };
    for bins in [[0; 3], [1, 0, 0]] {
        let steps = likelihood_steps(&model, destination, 0, bins);
        assert_eq!(
            invoice(&steps),
            if bins == [0; 3] { 224 } else { 1984 + 32 * 4 }
        );
        let code = checked_code(bins);
        let mut exact = LedgerWork::with_limit(invoice(&steps)).unwrap();
        ok(model
            .actual
            .evidence_likelihood(destination, 0, code, &mut exact));
        assert_eq!(exact.remaining(), 0);
        let mut spent = 0;
        for step in &steps {
            let mut short = LedgerWork::with_limit(spent + step.units - 1).unwrap();
            expect_error(
                model
                    .actual
                    .evidence_likelihood(destination, 0, code, &mut short),
                ErrorKind::Budget,
            );
            assert_eq!(short.used(), spent, "query block={}", step.label);
            spent += step.units;
        }
    }
}

#[test]
fn zero_and_nonzero_weight_invoices_include_cursor_motion_cache_hits_misses_and_same_buffer_moves()
{
    let model = make_model(structural_rules(), &[]);
    for bins in [[0; 3], [1, 0, 0]] {
        let raw = make_raw(&model, &[(3, 3, 1.0)], 0, 0, 576);
        let steps = weighting_steps(raw.masses(), &model, 0, bins);
        assert_eq!(invoice(&steps), weight_fee(raw.masses(), &model, 0, bins));
        if bins == [0; 3] {
            assert_eq!(invoice(&steps), 240380);
            assert!(!steps.iter().any(|step| step.label == "query-entry"
                || step.label == "positive-product-store"
                || step.label == "cache-initialization"
                || step.label == "material-band-loan"));
        } else {
            assert_eq!(
                steps
                    .iter()
                    .filter(|step| step.label == "bank-reset")
                    .count(),
                13
            );
            assert_eq!(
                steps
                    .iter()
                    .filter(|step| step.label == "band-advance")
                    .count(),
                234
            );
            let positives = raw.masses().iter().filter(|&&mass| mass > 0.0).count();
            assert_eq!(
                steps
                    .iter()
                    .filter(|step| step.label == "positive-cache-index")
                    .count(),
                positives
            );
            assert_eq!(
                steps
                    .iter()
                    .filter(|step| step.label == "positive-product-store")
                    .count(),
                positives
            );
            assert!(
                steps
                    .iter()
                    .filter(|step| step.label == "cache-miss-store")
                    .count()
                    < positives
            );
        }
        let mass_pointer = raw.masses().as_ptr();
        let mask_pointer = raw.accounting_cells().as_ptr();
        let mut exact = LedgerWork::with_limit(invoice(&steps)).unwrap();
        let actual = ok(weight_evidence(
            raw,
            &model.actual,
            0,
            checked_code(bins),
            &mut exact,
        ));
        assert_eq!(actual.masses().as_ptr(), mass_pointer);
        assert_eq!(actual.accounting_cells().as_ptr(), mask_pointer);
        assert_eq!(exact.remaining(), 0);
    }
}

#[test]
fn weighting_precharge_refusals_keep_prior_spent_work_and_never_publish_partial_output() {
    let model = make_model(structural_rules(), &[]);
    for bins in [[0; 3], [1, 0, 0]] {
        let raw = make_raw(&model, &[(0, 0, 1.0)], 0, 0, 576);
        let steps = weighting_steps(raw.masses(), &model, 0, bins);
        drop(raw);
        let mut spent = 0;
        for step in &steps {
            let mut short = LedgerWork::with_limit(spent + step.units - 1).unwrap();
            let raw = make_raw(&model, &[(0, 0, 1.0)], 0, 0, 576);
            expect_error(
                weight_evidence(raw, &model.actual, 0, checked_code(bins), &mut short),
                ErrorKind::Budget,
            );
            assert_eq!(short.used(), spent, "weight block={}", step.label);
            spent += step.units;
        }
        let mut prior = LedgerWork::with_limit(invoice(&steps) + 16).unwrap();
        prior.charge(17).unwrap();
        let raw = make_raw(&model, &[(0, 0, 1.0)], 0, 0, 576);
        expect_error(
            weight_evidence(raw, &model.actual, 0, checked_code(bins), &mut prior),
            ErrorKind::Budget,
        );
        assert_eq!(prior.used(), 17 + invoice(&steps) - 28);
    }
}

#[test]
fn dense_positive_raw_output_legitimately_refuses_nonzero_weight_budget_without_pruning_or_refill()
{
    let model = make_model(structural_rules(), &[]);
    let sources: Vec<_> = (0..13).map(|bank| (576, bank, 1.0)).collect();
    let raw = make_raw(&model, &sources, 0, 0, 576);
    assert!(raw.masses().iter().all(|&mass| mass > 0.0));
    assert_eq!(raw.masses().len(), 7501);
    let expected = weight_fee(raw.masses(), &model, 0, [1, 0, 0]);
    assert_eq!(expected, 1259924);
    assert!(expected > LEDGER_WORK_LIMIT);
    let steps = weighting_steps(raw.masses(), &model, 0, [1, 0, 0]);
    assert_eq!(invoice(&steps), expected);
    let before = snapshot(&model);
    let mut work = LedgerWork::new();
    expect_error(
        weight_evidence(raw, &model.actual, 0, checked_code([1, 0, 0]), &mut work),
        ErrorKind::Budget,
    );
    assert_eq!(work.used(), failed_prefix(&steps, LEDGER_WORK_LIMIT));
    assert_eq!(snapshot(&model), before);
    let raw = make_raw(&model, &sources, 0, 0, 576);
    let actual = apply_and_compare(raw, &model, 0, [0; 3]);
    assert!(actual.masses().iter().all(|&mass| mass > 0.0));
}

#[test]
fn query_and_weight_validate_destination_boundary_and_owned_profile_maximum_before_zero_bypass() {
    let mut rules = structural_rules();
    rules.max_turn = 3;
    rules.income_by_turn.truncate(4);
    rules.gas_capacity_by_turn.truncate(4);
    let model = make_model(rules, &[]);
    assert_eq!(model.rules.max_turn, 3);
    let zero = checked_code([0; 3]);
    for destination in [
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
        let mut work = LedgerWork::new();
        expect_error(
            model
                .actual
                .evidence_likelihood(destination, 0, zero, &mut work),
            ErrorKind::Domain,
        );
        assert_eq!(work.used(), 160);
    }
    for boundary in [46, u32::MAX] {
        let mut work = LedgerWork::new();
        expect_error(
            model.actual.evidence_likelihood(
                AccountingPoint {
                    material: 0,
                    bank: 0,
                },
                boundary,
                zero,
                &mut work,
            ),
            ErrorKind::Domain,
        );
        assert_eq!(work.used(), 160);
    }
    let mut query_work = LedgerWork::with_limit(224).unwrap();
    expect_error(
        model.actual.evidence_likelihood(
            AccountingPoint {
                material: 0,
                bank: 0,
            },
            4,
            zero,
            &mut query_work,
        ),
        ErrorKind::Domain,
    );
    assert_eq!(query_work.used(), 224);
    let mut short = LedgerWork::with_limit(223).unwrap();
    expect_error(
        model.actual.evidence_likelihood(
            AccountingPoint {
                material: 0,
                bank: 0,
            },
            4,
            zero,
            &mut short,
        ),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), 192);
    for (boundary, expected_used) in [(4, 224), (46, 160)] {
        let raw = make_raw(&model, &[(0, 0, 1.0)], 0, 0, 576);
        let mut work = LedgerWork::new();
        expect_error(
            weight_evidence(raw, &model.actual, boundary, zero, &mut work),
            ErrorKind::Domain,
        );
        assert_eq!(work.used(), expected_used);
    }
}

#[test]
fn compound_destination_equations_refuse_bad_material_or_nominal_bank_without_code_action_rules() {
    let rules = structural_rules();
    for bad_material in [true, false] {
        let mut row = derived(
            transition(
                0,
                AccountingPoint {
                    material: 3,
                    bank: 3,
                },
                10,
                key(3, 3, 0, 0),
            ),
            11,
            [3, 3, 2],
            &rules,
        );
        if bad_material {
            row.destination.material = 7;
        } else {
            row.destination.bank = 1;
        }
        let owned = vec![(0, vec![row])];
        let steps = build_steps(&rules, &owned);
        let prefix = before(&steps, "destination-equation", 0);
        let mut short = LedgerWork::with_limit(prefix + 31).unwrap();
        expect_error(
            build_result(&rules, 12, &owned, &mut short),
            ErrorKind::Budget,
        );
        assert_eq!(short.used(), prefix);
        let mut exact = LedgerWork::with_limit(prefix + 32).unwrap();
        expect_error(
            build_result(&rules, 12, &owned, &mut exact),
            ErrorKind::Domain,
        );
        assert_eq!(exact.used(), prefix + 32);
    }
    let mut bad_transition = transition(
        0,
        AccountingPoint {
            material: 4,
            bank: 0,
        },
        0,
        key(0, 0, 30, 0),
    );
    bad_transition.visible_before = 0;
    let owned = vec![(0, vec![derived(bad_transition, 0, [3, 3, 2], &rules)])];
    assert!(matches!(
        build_result(&rules, 12, &owned, &mut LedgerWork::new()),
        Err(EvidenceError::Table(TableError::InfeasibleSource))
    ));
}

#[test]
fn malformed_rosters_and_declared_bounds_reject_in_preflight_before_temporary_allocation() {
    let rules = structural_rules();
    for nodes in [0, 1, 2, 13, u8::MAX] {
        let mut work = LedgerWork::new();
        expect_error(
            build_result(&rules, nodes, &[], &mut work),
            ErrorKind::Domain,
        );
        assert_eq!(work.used(), 160);
    }
    for slot in [14400, u16::MAX] {
        let mut work = LedgerWork::new();
        expect_error(
            build_result(&rules, 3, &[(slot, vec![])], &mut work),
            ErrorKind::Domain,
        );
        assert_eq!(work.used(), 192);
    }
    for slots in [[1, 1], [1, 0]] {
        let mut work = LedgerWork::new();
        expect_error(
            build_result(
                &rules,
                3,
                &[(slots[0], vec![]), (slots[1], vec![])],
                &mut work,
            ),
            ErrorKind::Order,
        );
        assert_eq!(work.used(), 224);
    }
    for nodes in [[0, 0], [1, 0]] {
        let owned = vec![(
            0,
            nodes
                .into_iter()
                .map(|node| neutral(node, 0, 3, 0, [1, 0, 0], &rules))
                .collect(),
        )];
        let mut work = LedgerWork::new();
        expect_error(build_result(&rules, 3, &owned, &mut work), ErrorKind::Order);
        assert_eq!(work.used(), 160 + 32 + 2 * 64);
    }
    let out_of_range = vec![(0, vec![neutral(3, 0, 3, 0, [1, 0, 0], &rules)])];
    expect_error(
        build_result(&rules, 3, &out_of_range, &mut LedgerWork::new()),
        ErrorKind::Domain,
    );
    let too_many = vec![(
        0,
        (0..4)
            .map(|node| neutral(node, 0, 3, 0, [1, 0, 0], &rules))
            .collect(),
    )];
    expect_error(
        build_result(&rules, 3, &too_many, &mut LedgerWork::new()),
        ErrorKind::Domain,
    );
    for (destination, boundary) in [
        (
            AccountingPoint {
                material: 577,
                bank: 3,
            },
            0,
        ),
        (
            AccountingPoint {
                material: 0,
                bank: 13,
            },
            0,
        ),
        (
            AccountingPoint {
                material: 0,
                bank: 3,
            },
            46,
        ),
    ] {
        let row = compound(
            transition(
                0,
                AccountingPoint {
                    material: 0,
                    bank: 2,
                },
                0,
                key(0, 0, 0, 0),
            ),
            destination,
            boundary,
            [1, 0, 0],
        );
        let mut work = LedgerWork::new();
        expect_error(
            build_result(&rules, 3, &[(0, vec![row])], &mut work),
            ErrorKind::Domain,
        );
        assert_eq!(work.used(), 160 + 32 + 64);
    }
    let oversized: Vec<(u16, Vec<NumericEconomicFitRow>)> =
        (0..14401).map(|_| (0, vec![])).collect();
    let mut work = LedgerWork::new();
    expect_error(
        build_result(&rules, 3, &oversized, &mut work),
        ErrorKind::Domain,
    );
    assert_eq!(work.used(), 160);
}

#[test]
fn physically_maximal_empty_roster_can_refuse_budget_before_projection_without_truncation_or_cap_raise()
 {
    let rules = structural_rules();
    let owned: Vec<(u16, Vec<NumericEconomicFitRow>)> =
        (0..14400).map(|slot| (slot, vec![])).collect();
    let steps = build_steps(&rules, &owned);
    assert_eq!(invoice(&steps), 397924 + 172 * 14400);
    assert!(invoice(&steps) > LEDGER_WORK_LIMIT);
    let mut work = LedgerWork::new();
    expect_error(
        build_result(&rules, 3, &owned, &mut work),
        ErrorKind::Budget,
    );
    assert_eq!(work.used(), failed_prefix(&steps, LEDGER_WORK_LIMIT));
    assert_eq!(work.used(), 921996);
}

#[test]
fn original_compound_records_can_change_after_owned_paired_construction_without_aliasing_counts() {
    let rules = structural_rules();
    let mut owned = vec![(0, vec![neutral(0, 0, 3, 0, [1, 0, 0], &rules)])];
    let model = make_model(rules, &owned);
    let transition_occupied: usize = model.transitions.iter().map(|table| table.rows.len()).sum();
    let evidence_occupied: usize = model
        .evidence
        .iter()
        .map(|table| table.counts.iter().filter(|&&count| count > 0.0).count())
        .sum();
    assert_eq!(
        model.actual.occupied_sparse_rows(),
        transition_occupied + evidence_occupied
    );
    assert_eq!((transition_occupied, evidence_occupied), (4, 4));
    owned[0].1[0].innovation = checked_code([3, 3, 2]);
    owned[0].1[0].destination.material = 42;
    owned[0].1[0].transition.outcome.destroyed = 99;
    owned.clear();
    compare_model(&model.actual, &model.transitions, &model.evidence);
    assert_eq!(model.actual.evidence_tables()[793].counts()[12], 1.0);
    assert_eq!(model.actual.evidence_tables()[793].counts()[47], 0.0);
}

#[test]
fn builder_exact_inclusive_cap_retains_prior_charges_and_one_below_final_move_never_returns_a_model()
 {
    let rules = structural_rules();
    let owned = vec![(0, vec![neutral(0, 0, 3, 0, [1, 0, 0], &rules)])];
    let total = invoice(&build_steps(&rules, &owned));
    let mut exact = LedgerWork::new();
    exact.charge(LEDGER_WORK_LIMIT - total).unwrap();
    let model = ok(build_result(&rules, 12, &owned, &mut exact));
    assert_eq!(exact.remaining(), 0);
    expect_error(
        model.evidence_likelihood(
            AccountingPoint {
                material: 0,
                bank: 3,
            },
            0,
            checked_code([0; 3]),
            &mut exact,
        ),
        ErrorKind::Budget,
    );
    assert_eq!(exact.used(), LEDGER_WORK_LIMIT);
    let mut short = LedgerWork::new();
    let prior = LEDGER_WORK_LIMIT - total + 1;
    short.charge(prior).unwrap();
    expect_error(
        build_result(&rules, 12, &owned, &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), prior + total - 1588);
    let mut caller = LedgerWork::new();
    caller.charge(17).unwrap();
    ok(build_result(&rules, 12, &owned, &mut caller));
    assert_eq!(caller.used(), 17 + total);
}

#[test]
fn reachable_multiplication_underflow_happens_only_after_its_full_positive_product_reservation() {
    let model = make_model(structural_rules(), &[]);
    let sources = [(1, 0, 1.0), (0, 1, f64::from_bits(32))];
    let raw = make_raw(&model, &sources, 0, 0, 576);
    let tiny_index = 577;
    assert_eq!(
        raw.masses()[tiny_index].to_bits(),
        f64::from_bits(1).to_bits()
    );
    let earlier_positives = raw.masses()[..tiny_index]
        .iter()
        .filter(|&&mass| mass > 0.0)
        .count();
    let steps = weighting_steps(raw.masses(), &model, 0, [1, 0, 0]);
    let prefix = before(&steps, "positive-product-store", earlier_positives);
    drop(raw);
    let mut short = LedgerWork::with_limit(prefix + 31).unwrap();
    let raw = make_raw(&model, &sources, 0, 0, 576);
    expect_error(
        weight_evidence(raw, &model.actual, 0, checked_code([1, 0, 0]), &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), prefix);
    let mut exact = LedgerWork::with_limit(prefix + 32).unwrap();
    let raw = make_raw(&model, &sources, 0, 0, 576);
    expect_error(
        weight_evidence(raw, &model.actual, 0, checked_code([1, 0, 0]), &mut exact),
        ErrorKind::Underflow,
    );
    assert_eq!(exact.used(), prefix + 32);
}

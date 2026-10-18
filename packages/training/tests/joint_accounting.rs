// SPEC: _spec/packages/training/burn-compat.puml
use std::collections::{BTreeMap, BTreeSet};

use training_native::accounting_kernel::{
    AccountingPoint, NumericGrant, PointAccountingInput, accounting_point_flow,
};
use training_native::joint_accounting::{
    JointAccountingError, JointAccountingResult, NumericAccountingStep, RawJointAccounting,
    aggregate_accounting,
};
use training_native::joint_math::{
    NumericCertainty, NumericJoint, NumericSupport, ReadoutTemperature, normalize_aggregate,
    readout_copy,
};
use training_native::ledger::contracts::{LedgerErrorCode, LedgerRules};
use training_native::ledger::{LEDGER_WORK_LIMIT, LedgerWork};
use training_native::transition_tables::{
    NumericFitGroup, NumericFitRow, NumericOutcome, NumericSourceContext, NumericTransitions,
    TableError, TransitionCohort, build_numeric_transitions,
};

const N: usize = 7501;
const STOCK: usize = 8034;
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

fn fit(node: u8, material: u16, bank: u8, turn: u32, outcome: Key) -> NumericFitRow {
    NumericFitRow {
        node_index: node,
        source: AccountingPoint { material, bank },
        input_turn: turn,
        visible_before: material,
        marines_before: 0,
        outcome: NumericOutcome {
            spend: outcome.spend,
            created: outcome.created,
            wasted: outcome.wasted,
            growth: outcome.growth,
            destroyed: outcome.destroyed,
        },
    }
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

fn structural_rules() -> LedgerRules {
    #[derive(serde::Deserialize)]
    struct StructuralRules {
        rules: LedgerRules,
    }
    serde_json::from_str::<StructuralRules>(include_str!("fixtures/ledger-boundaries.json"))
        .unwrap()
        .rules
}

fn index(material: u16, bank: u8) -> usize {
    577 * usize::from(bank) + usize::from(material)
}
fn point(offset: usize) -> AccountingPoint {
    AccountingPoint {
        material: (offset % 577) as u16,
        bank: (offset / 577) as u8,
    }
}
fn band(material: u16) -> usize {
    BAND_STARTS
        .iter()
        .rposition(|&start| start <= material)
        .unwrap()
}
fn tier(turn: u32) -> usize {
    match turn {
        0..=10 => 0,
        11..=20 => 1,
        21..=45 => 2,
        _ => panic!("fixture turn"),
    }
}

fn cohort_indices(source: AccountingPoint, turn: u32) -> [usize; 4] {
    let bank = usize::from(source.bank);
    [
        57 * bank + 3 * band(source.material) + tier(turn),
        741 + 3 * bank + tier(turn),
        780 + bank,
        793,
    ]
}

#[derive(Default)]
struct ExpectedTable {
    groups: u16,
    last: Option<u16>,
    rows: BTreeMap<Key, f64>,
}

struct Model {
    actual: NumericTransitions,
    expected: Vec<ExpectedTable>,
    rules: LedgerRules,
}

fn model(rules: LedgerRules, owned: &[(u16, Vec<NumericFitRow>)]) -> Model {
    let groups: Vec<NumericFitGroup<'_>> = owned
        .iter()
        .map(|(slot, rows)| NumericFitGroup {
            slot: *slot,
            selected_rows: rows,
        })
        .collect();
    let actual = build_numeric_transitions(&rules, 12, &groups, &mut LedgerWork::new()).unwrap();
    let mut expected: Vec<ExpectedTable> = (0..794).map(|_| ExpectedTable::default()).collect();
    for (slot, rows) in owned {
        if rows.is_empty() {
            continue;
        }
        let weight = 1.0 / rows.len() as f64;
        for row in rows {
            for table_index in cohort_indices(row.source, row.input_turn) {
                let table = &mut expected[table_index];
                match table.rows.get_mut(&fit_key(row)) {
                    Some(count) => *count += weight,
                    None => {
                        table.rows.insert(fit_key(row), weight);
                    }
                }
                if table.last != Some(*slot) {
                    table.groups += 1;
                    table.last = Some(*slot);
                }
            }
        }
    }
    assert_eq!(actual.tables().len(), 794);
    for (table, expected) in actual.tables().iter().zip(&expected) {
        assert_eq!(table.groups(), expected.groups);
        assert_eq!(table.rows().len(), expected.rows.len());
        for (row, (&key, &count)) in table.rows().iter().zip(&expected.rows) {
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
            assert_eq!(row.count.to_bits(), count.to_bits());
        }
    }
    Model {
        actual,
        expected,
        rules,
    }
}

struct Prior {
    actual: NumericJoint,
    probabilities: Vec<f64>,
    cells: Vec<bool>,
}

fn prior(points: &[(u16, u8, f64)]) -> Prior {
    let mut raw = vec![0.0; N];
    let mut cells = vec![false; N];
    for &(material, bank, mass) in points {
        let i = index(material, bank);
        assert!(!cells[i]);
        cells[i] = true;
        raw[i] = mass;
    }
    prior_buffers(raw, cells)
}

fn prior_buffers(raw: Vec<f64>, cells: Vec<bool>) -> Prior {
    let mut work = LedgerWork::new();
    let support = NumericSupport::from_cells(&cells, &mut work).unwrap();
    let actual = normalize_aggregate(&raw, &support, &mut work).unwrap();
    assert_eq!(work.used(), 210348 + 300552);
    let mut total = 0.0;
    for &value in &raw {
        total += value;
    }
    let probabilities: Vec<f64> = raw.iter().map(|value| value / total).collect();
    for (&actual, &expected) in actual.probabilities().iter().zip(&probabilities) {
        assert_eq!(actual.to_bits(), expected.to_bits());
    }
    assert_eq!(actual.support().cells(), cells);
    Prior {
        actual,
        probabilities,
        cells,
    }
}

fn step(
    turn: u32,
    visible: u16,
    marines: u8,
    loss: u16,
    lower: u16,
    upper: u16,
    grant: NumericGrant,
) -> NumericAccountingStep {
    NumericAccountingStep {
        context: NumericSourceContext {
            input_turn: turn,
            visible_before: visible,
            marines_before: marines,
        },
        grant,
        witnessed_loss: loss,
        destination_lower: lower,
        destination_upper: upper,
    }
}

fn sequence_growth(opportunities: u16) -> BTreeSet<u8> {
    let mut sequences = vec![0_u8];
    for _ in 0..opportunities {
        sequences = sequences
            .into_iter()
            .flat_map(|sum| [0, 2, 4, 8].map(|increment| sum + increment))
            .collect();
    }
    sequences.into_iter().collect()
}

fn tuples(source: AccountingPoint, context: &NumericSourceContext, gas: u32) -> BTreeSet<Key> {
    let mut result = BTreeSet::new();
    for spend in [0_u8, 1, 3, 5, 9] {
        if spend > source.bank {
            continue;
        }
        for created in BTreeSet::from([0, spend]) {
            let opportunities = 4_u16.min(1 + gas as u16 - u16::from(spend > 0)).min(
                u16::from(context.marines_before) + source.material - context.visible_before
                    + u16::from(created == 1),
            );
            for growth in sequence_growth(opportunities) {
                let stock = source.material + u16::from(created) + u16::from(growth);
                for destroyed in stock.saturating_sub(576)..=stock {
                    result.insert(key(spend, created, growth, destroyed));
                }
            }
        }
    }
    result
}

fn selected(model: &Model, source: AccountingPoint, turn: u32) -> usize {
    cohort_indices(source, turn)
        .into_iter()
        .find(|&table| table == 793 || model.expected[table].groups >= 32)
        .unwrap()
}

fn denominator(
    model: &Model,
    source: AccountingPoint,
    context: &NumericSourceContext,
    feasible: &BTreeSet<Key>,
) -> (usize, f64) {
    let table = selected(model, source, context.input_turn);
    let mut count = 0.0;
    for (key, value) in &model.expected[table].rows {
        if feasible.contains(key) {
            count += value;
        }
    }
    (table, count + 0.5 * feasible.len() as f64)
}

fn bank_after(model: &Model, source: AccountingPoint, spend: u8, grant: NumericGrant) -> usize {
    let bank = usize::from(source.bank - spend);
    match grant {
        NumericGrant::None => bank,
        NumericGrant::AtNativeTurn(turn) => {
            12.min(bank + model.rules.income_by_turn[turn as usize] as usize)
        }
    }
}

struct Reference {
    masses: Vec<f64>,
    cells: Vec<bool>,
    retained: f64,
}

fn direct_oracle(prior: &Prior, model: &Model, step: &NumericAccountingStep) -> Reference {
    let mut masses = vec![0.0; N];
    let mut cells = vec![false; N];
    let gas = model.rules.gas_capacity_by_turn[step.context.input_turn as usize];
    for (source_index, &present) in prior.cells.iter().enumerate() {
        if !present {
            continue;
        }
        let source = point(source_index);
        let probability = prior.probabilities[source_index];
        let feasible = tuples(source, &step.context, gas);
        let numeric = if probability > 0.0 {
            Some(denominator(model, source, &step.context, &feasible))
        } else {
            None
        };
        for key in &feasible {
            let material =
                source.material + u16::from(key.created) + u16::from(key.growth) - key.destroyed;
            if key.destroyed < step.witnessed_loss
                || !(step.destination_lower..=step.destination_upper).contains(&material)
            {
                continue;
            }
            let destination =
                bank_after(model, source, key.spend, step.grant) * 577 + usize::from(material);
            cells[destination] = true;
            if let Some((table, denominator)) = numeric {
                let count = model.expected[table].rows.get(key).copied().unwrap_or(0.0);
                masses[destination] += ((0.5 + count) / denominator) * probability;
            }
        }
    }
    let retained = masses.iter().sum();
    Reference {
        masses,
        cells,
        retained,
    }
}

struct HeadRecord {
    source: usize,
    branch: (u8, u8, u8),
    index: usize,
    background: Option<f64>,
}
struct SparseRecord {
    source: usize,
    key: Key,
    index: usize,
    probability: f64,
    count: f64,
    denominator: f64,
}
struct Records {
    heads: Vec<HeadRecord>,
    sparse: Vec<SparseRecord>,
}

fn contributor_records(prior: &Prior, model: &Model, step: &NumericAccountingStep) -> Records {
    let mut heads = Vec::new();
    let mut sparse = Vec::new();
    let gas = model.rules.gas_capacity_by_turn[step.context.input_turn as usize];
    for (source_index, &present) in prior.cells.iter().enumerate() {
        if !present {
            continue;
        }
        let source = point(source_index);
        let feasible = tuples(source, &step.context, gas);
        let probability = prior.probabilities[source_index];
        let numeric = if probability > 0.0 {
            Some(denominator(model, source, &step.context, &feasible))
        } else {
            None
        };
        let background = numeric.map(|(_, denominator)| (0.5 * probability) / denominator);
        let branches: BTreeSet<(u8, u8, u8)> = feasible
            .iter()
            .map(|key| (key.spend, key.created, key.growth))
            .collect();
        for (spend, created, growth) in branches {
            let stock = source.material + u16::from(created) + u16::from(growth);
            heads.push(HeadRecord {
                source: source_index,
                branch: (spend, created, growth),
                index: 618 * bank_after(model, source, spend, step.grant) + usize::from(stock),
                background,
            });
        }
        if let Some((table, denominator)) = numeric {
            for (&key, &count) in &model.expected[table].rows {
                if !feasible.contains(&key) || key.destroyed < step.witnessed_loss {
                    continue;
                }
                let material = source.material + u16::from(key.created) + u16::from(key.growth)
                    - key.destroyed;
                sparse.push(SparseRecord {
                    source: source_index,
                    key,
                    index: 577 * bank_after(model, source, key.spend, step.grant)
                        + usize::from(material),
                    probability,
                    count,
                    denominator,
                });
            }
        }
    }
    heads.sort_by_key(|record| (record.source, record.branch));
    sparse.sort_by_key(|record| (record.source, record.key));
    Records { heads, sparse }
}

#[derive(Clone, Copy)]
enum SparseArithmetic {
    Canonical,
    DivideFirst,
    Fused,
}

fn reduce_records(
    records: &Records,
    step: &NumericAccountingStep,
    sparse_arithmetic: SparseArithmetic,
) -> Reference {
    reduce_graph(records, step, sparse_arithmetic, false)
}

fn reduce_graph(
    records: &Records,
    step: &NumericAccountingStep,
    sparse_arithmetic: SparseArithmetic,
    regroup_heads: bool,
) -> Reference {
    let mut head = vec![0.0_f64; STOCK];
    let mut boolean_head = vec![false; STOCK];
    let mut sparse = vec![0.0_f64; N];
    let mut grouped: BTreeMap<usize, Vec<f64>> = BTreeMap::new();
    for record in &records.heads {
        boolean_head[record.index] = true;
        if let Some(background) = record.background {
            if regroup_heads {
                grouped.entry(record.index).or_default().push(background);
            } else {
                head[record.index] += background;
            }
        }
    }
    for (index, contributors) in grouped {
        head[index] = contributors
            .into_iter()
            .rev()
            .fold(0.0, |suffix, value| value + suffix);
    }
    for record in &records.sparse {
        let previous = sparse[record.index];
        sparse[record.index] = match sparse_arithmetic {
            SparseArithmetic::Canonical => {
                previous + (record.probability * record.count) / record.denominator
            }
            SparseArithmetic::DivideFirst => {
                previous + record.probability * (record.count / record.denominator)
            }
            SparseArithmetic::Fused => record
                .probability
                .mul_add(record.count / record.denominator, previous),
        };
    }
    for bank in 0..13 {
        for stock in (0..617).rev() {
            let index = 618 * bank + stock;
            head[index] += head[index + 1];
            boolean_head[index] |= boolean_head[index + 1];
        }
    }
    let mut masses = vec![0.0; N];
    let mut cells = vec![false; N];
    let mut retained = 0.0;
    for bank in 0..13 {
        for material in 0..577 {
            let destination = 577 * bank + material;
            if (usize::from(step.destination_lower)..=usize::from(step.destination_upper))
                .contains(&material)
            {
                let threshold = material + usize::from(step.witnessed_loss);
                let (suffix, supported) = if threshold <= 617 {
                    (
                        head[618 * bank + threshold],
                        boolean_head[618 * bank + threshold],
                    )
                } else {
                    (0.0, false)
                };
                masses[destination] = sparse[destination] + suffix;
                cells[destination] = supported;
            }
            retained += masses[destination];
        }
    }
    Reference {
        masses,
        cells,
        retained,
    }
}

type PriorSnapshot = (Vec<u64>, Vec<bool>, NumericCertainty);
type TableSnapshot = Vec<(TransitionCohort, u16, Vec<(Key, u64)>)>;

fn prior_snapshot(prior: &Prior) -> PriorSnapshot {
    (
        prior
            .actual
            .probabilities()
            .iter()
            .map(|value| value.to_bits())
            .collect(),
        prior.actual.support().cells().to_vec(),
        prior.actual.support().certainty(),
    )
}

fn table_snapshot(model: &Model) -> TableSnapshot {
    model
        .actual
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
        .collect()
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ErrorKind {
    Domain,
    NonFinite,
    Underflow,
    EmptySupport,
    EmptyMass,
    Table,
    Budget,
}

fn kind(error: &JointAccountingError) -> ErrorKind {
    match error {
        JointAccountingError::Domain => ErrorKind::Domain,
        JointAccountingError::NonFinite => ErrorKind::NonFinite,
        JointAccountingError::Underflow => ErrorKind::Underflow,
        JointAccountingError::EmptySupport => ErrorKind::EmptySupport,
        JointAccountingError::EmptyMass => ErrorKind::EmptyMass,
        JointAccountingError::Table(TableError::Work(error))
        | JointAccountingError::Work(error) => {
            assert_eq!(error.code, LedgerErrorCode::Budget);
            ErrorKind::Budget
        }
        JointAccountingError::Table(_) => ErrorKind::Table,
    }
}

fn ok<T>(result: JointAccountingResult<T>) -> T {
    match result {
        Ok(value) => value,
        Err(error) => panic!("unexpected aggregate error {:?}", kind(&error)),
    }
}

fn expect_error<T>(result: JointAccountingResult<T>, expected: ErrorKind) {
    match result {
        Err(error) => assert_eq!(kind(&error), expected),
        Ok(_) => panic!("expected {expected:?}"),
    }
}

fn compare(prior: &Prior, model: &Model, step: &NumericAccountingStep) -> RawJointAccounting {
    let direct = direct_oracle(prior, model, step);
    let canonical = reduce_records(
        &contributor_records(prior, model, step),
        step,
        SparseArithmetic::Canonical,
    );
    let prior_before = prior_snapshot(prior);
    let tables_before = table_snapshot(model);
    let actual = ok(aggregate_accounting(
        &prior.actual,
        &model.actual,
        step,
        &mut LedgerWork::new(),
    ));
    assert_eq!(actual.masses().len(), N);
    assert_eq!(actual.accounting_cells().len(), N);
    assert_eq!(actual.accounting_cells(), direct.cells);
    assert_eq!(actual.accounting_cells(), canonical.cells);
    for (index, &value) in actual.masses().iter().enumerate() {
        assert!(value.is_finite() && value >= 0.0);
        assert_eq!(
            value.to_bits(),
            canonical.masses[index].to_bits(),
            "canonical lane {index}"
        );
        assert!(
            (value - direct.masses[index]).abs() <= 1e-12,
            "mathematical lane {index}: {value:.17e} != {:.17e}",
            direct.masses[index]
        );
        if !actual.accounting_cells()[index] {
            assert_eq!(value, 0.0);
        }
    }
    assert_eq!(
        actual.retained_mass().to_bits(),
        canonical.retained.to_bits()
    );
    assert!((actual.retained_mass() - direct.retained).abs() <= 1e-12);
    assert!(actual.retained_mass().is_finite() && actual.retained_mass() > 0.0);
    assert_eq!(prior_snapshot(prior), prior_before);
    assert_eq!(table_snapshot(model), tables_before);
    actual
}

fn failure(prior: &Prior, model: &Model, step: &NumericAccountingStep, expected: ErrorKind) {
    let prior_before = prior_snapshot(prior);
    let tables_before = table_snapshot(model);
    expect_error(
        aggregate_accounting(&prior.actual, &model.actual, step, &mut LedgerWork::new()),
        expected,
    );
    assert_eq!(prior_snapshot(prior), prior_before);
    assert_eq!(table_snapshot(model), tables_before);
}

#[test]
fn one_source_f3_parity_is_mathematical_and_separate_from_the_canonical_bit_oracle() {
    let rules = structural_rules();
    let model = model(rules.clone(), &[]);
    for (material, bank, visible, marines, loss, grant) in [
        (0, 0, 0, 0, 0, NumericGrant::None),
        (3, 1, 3, 0, 1, NumericGrant::None),
        (4, 3, 0, 0, 2, NumericGrant::AtNativeTurn(21)),
        (575, 0, 575, 1, 0, NumericGrant::None),
    ] {
        let prior = prior(&[(material, bank, 1.0)]);
        let step = step(0, visible, marines, loss, 0, 576, grant);
        let actual = compare(&prior, &model, &step);
        let point = PointAccountingInput {
            source: AccountingPoint { material, bank },
            input_turn: 0,
            visible_before: visible,
            marines_before: marines,
            witnessed_loss: loss,
            destination_lower: 0,
            destination_upper: 576,
            grant,
        };
        let point_flow = accounting_point_flow(&rules, &point, &[], &mut LedgerWork::new())
            .unwrap()
            .unwrap();
        assert_eq!(actual.accounting_cells(), point_flow.support().cells());
        for (&joint, &point) in actual.masses().iter().zip(point_flow.masses()) {
            assert!((joint - point).abs() <= 1e-12);
        }
        assert!((actual.retained_mass() - point_flow.retained_mass()).abs() <= 1e-12);
    }
}

#[test]
fn unequal_multisource_retained_evidence_is_a_raw_weighted_aggregate_not_per_source_normalization()
{
    let model = model(structural_rules(), &[]);
    let prior = prior(&[(0, 0, 1.0), (1, 0, 3.0)]);
    let step = step(0, 0, 0, 1, 0, 0, NumericGrant::None);
    let actual = compare(&prior, &model, &step);
    assert!((actual.retained_mass() - 3.0 / 22.0).abs() <= 1e-12);
    assert_eq!(
        actual.masses()[0].to_bits(),
        actual.retained_mass().to_bits()
    );
    assert!(actual.retained_mass() < 0.75 && actual.retained_mass() < 1.0);
    assert_eq!(
        actual
            .accounting_cells()
            .iter()
            .filter(|&&cell| cell)
            .count(),
        1
    );
}

fn qualified_fractional_model() -> Model {
    let mut owned: Vec<(u16, Vec<NumericFitRow>)> = (0..32)
        .map(|slot| (slot, vec![fit(0, 10, 1, 0, key(1, 1, 0, 11))]))
        .collect();
    owned.push((
        32,
        vec![
            fit(0, 4, 1, 0, key(0, 0, 0, 0)),
            fit(1, 4, 2, 11, key(0, 0, 0, 0)),
            fit(2, 4, 3, 21, key(0, 0, 0, 0)),
        ],
    ));
    model(structural_rules(), &owned)
}

#[test]
fn source_specific_qualified_n_zero_fractional_n_and_backoff_keep_unconditioned_denominators() {
    let model = qualified_fractional_model();
    let prior = prior(&[(2, 0, 1.0), (4, 1, 2.0), (8, 1, 3.0)]);
    assert_eq!(
        selected(
            &model,
            AccountingPoint {
                material: 8,
                bank: 1
            },
            0
        ),
        57 + 3 * band(8)
    );
    assert_eq!(
        selected(
            &model,
            AccountingPoint {
                material: 4,
                bank: 1
            },
            0
        ),
        741 + 3
    );
    for (loss, lower, upper) in [(0, 0, 576), (2, 0, 4), (1, 2, 5)] {
        compare(
            &prior,
            &model,
            &step(0, 0, 0, loss, lower, upper, NumericGrant::None),
        );
    }
}

#[test]
fn fitted_count_changes_modify_mass_but_not_boolean_accounting_reachability() {
    let empty = model(structural_rules(), &[]);
    let counted = model(
        structural_rules(),
        &[(
            0,
            vec![
                fit(0, 3, 0, 0, key(0, 0, 0, 0)),
                fit(1, 3, 0, 0, key(0, 0, 0, 1)),
                fit(2, 3, 0, 0, key(0, 0, 0, 2)),
            ],
        )],
    );
    let prior = prior(&[(3, 0, 1.0)]);
    let step = step(0, 3, 0, 0, 0, 576, NumericGrant::None);
    let first = compare(&prior, &empty, &step);
    let second = compare(&prior, &counted, &step);
    assert_eq!(first.accounting_cells(), second.accounting_cells());
    assert!(
        first
            .masses()
            .iter()
            .zip(second.masses())
            .any(|(left, right)| left.to_bits() != right.to_bits())
    );
    assert!((first.retained_mass() - 1.0).abs() <= 1e-12);
    assert!((second.retained_mass() - 1.0).abs() <= 1e-12);
}

#[test]
fn supported_zero_pmf_sources_expand_boolean_cells_without_creating_numeric_mass() {
    let model = model(structural_rules(), &[]);
    let positive = prior(&[(0, 0, 1.0)]);
    let extended = prior(&[(0, 0, 1.0), (3, 1, 0.0)]);
    let step = step(0, 0, 0, 0, 0, 576, NumericGrant::None);
    let first = compare(&positive, &model, &step);
    let second = compare(&extended, &model, &step);
    assert_eq!(first.masses(), second.masses());
    assert_eq!(first.retained_mass(), 1.0);
    assert!(
        second
            .accounting_cells()
            .iter()
            .filter(|&&value| value)
            .count()
            > first
                .accounting_cells()
                .iter()
                .filter(|&&value| value)
                .count()
    );
    assert!(
        second
            .accounting_cells()
            .iter()
            .zip(second.masses())
            .any(|(&cell, &mass)| cell && mass == 0.0)
    );
}

#[test]
fn empty_boolean_support_and_reachable_zero_aggregate_mass_are_distinct_not_underflow() {
    let model = model(structural_rules(), &[]);
    let eliminated = prior(&[(0, 0, 1.0)]);
    let zero_reachable = prior(&[(0, 0, 1.0), (1, 0, 0.0)]);
    let step = step(0, 0, 0, 1, 0, 0, NumericGrant::None);
    failure(&eliminated, &model, &step, ErrorKind::EmptySupport);
    failure(&zero_reachable, &model, &step, ErrorKind::EmptyMass);
}

#[test]
fn supported_sources_below_visible_material_reject_including_zero_pmf_instead_of_pruning() {
    let model = model(structural_rules(), &[]);
    for points in [
        vec![(0, 0, 1.0), (3, 0, 1.0)],
        vec![(0, 0, 0.0), (3, 0, 1.0)],
    ] {
        failure(
            &prior(&points),
            &model,
            &step(0, 1, 0, 0, 0, 576, NumericGrant::None),
            ErrorKind::Domain,
        );
    }
}

#[test]
fn minimum_positive_background_product_cannot_be_rescued_by_divide_first_reassociation() {
    let model = model(structural_rules(), &[]);
    let probability = f64::from_bits(1);
    let prior = prior(&[(0, 0, probability), (1, 0, 1.0)]);
    assert_eq!(prior.probabilities[0].to_bits(), probability.to_bits());
    assert_eq!(0.5 * probability, 0.0);
    assert!((0.5 / 0.5) * probability > 0.0);
    failure(
        &prior,
        &model,
        &step(0, 0, 0, 0, 0, 576, NumericGrant::None),
        ErrorKind::Underflow,
    );
}

#[test]
fn sparse_positive_product_underflow_refuses_when_background_remains_positive() {
    let rows: Vec<NumericFitRow> = (0..12)
        .map(|node| fit(node, 20, 0, 0, key(0, 0, 0, u16::from(node))))
        .collect();
    let model = model(structural_rules(), &[(0, rows)]);
    let probability = f64::from_bits(2);
    let prior = prior(&[(0, 0, probability), (1, 0, 1.0)]);
    let denominator = 0.5 + 1.0 / 12.0;
    assert!((0.5 * probability) / denominator > 0.0);
    assert_eq!(probability * (1.0 / 12.0), 0.0);
    failure(
        &prior,
        &model,
        &step(0, 0, 0, 0, 0, 576, NumericGrant::None),
        ErrorKind::Underflow,
    );
}

#[test]
fn sparse_positive_division_underflow_refuses_after_a_nonzero_product_and_background() {
    let model = model(
        structural_rules(),
        &[(
            0,
            vec![
                fit(0, 3, 0, 0, key(0, 0, 0, 0)),
                fit(1, 20, 0, 0, key(0, 0, 0, 10)),
                fit(2, 20, 0, 0, key(0, 0, 0, 11)),
            ],
        )],
    );
    let probability = f64::from_bits(3);
    let prior = prior(&[(3, 0, probability), (4, 0, 1.0)]);
    let denominator = 2.0 + 1.0 / 3.0;
    let product = probability * (1.0 / 3.0);
    assert!((0.5 * probability) / denominator > 0.0);
    assert!(product > 0.0);
    assert_eq!(product / denominator, 0.0);
    failure(
        &prior,
        &model,
        &step(0, 3, 0, 0, 0, 576, NumericGrant::None),
        ErrorKind::Underflow,
    );
}

#[test]
fn numeric_grants_use_the_owned_profile_table_and_bank_cap_without_chronology_inference() {
    let mut rules = structural_rules();
    rules.max_turn = 3;
    rules.income_by_turn = vec![3, 1, 2, 3];
    rules.gas_capacity_by_turn = vec![3, 1, 2, 3];
    let model = model(rules, &[]);
    let prior = prior(&[(2, 11, 1.0), (4, 12, 2.0)]);
    let mut outcomes = Vec::new();
    for grant in [
        NumericGrant::None,
        NumericGrant::AtNativeTurn(0),
        NumericGrant::AtNativeTurn(1),
        NumericGrant::AtNativeTurn(2),
        NumericGrant::AtNativeTurn(3),
    ] {
        outcomes.push(compare(&prior, &model, &step(1, 0, 0, 0, 0, 576, grant)));
    }
    assert_ne!(
        outcomes[0].accounting_cells(),
        outcomes[1].accounting_cells()
    );
    assert_ne!(outcomes[1].masses(), outcomes[2].masses());
    assert!(outcomes[1].accounting_cells()[index(0, 12)]);
}

#[test]
fn invalid_step_context_grant_and_loss_destination_domains_refuse_without_input_mutation() {
    let model = model(structural_rules(), &[]);
    let prior = prior(&[(576, 0, 1.0)]);
    for step in [
        step(46, 0, 0, 0, 0, 576, NumericGrant::None),
        step(u32::MAX, 0, 0, 0, 0, 576, NumericGrant::None),
        step(0, 0, 1, 0, 0, 576, NumericGrant::None),
        step(0, 65, 65, 0, 0, 576, NumericGrant::None),
        step(0, 0, 0, 618, 0, 576, NumericGrant::None),
        step(0, 0, 0, 0, 2, 1, NumericGrant::None),
        step(0, 0, 0, 0, 0, 577, NumericGrant::None),
        step(0, 0, 0, 0, 0, 576, NumericGrant::AtNativeTurn(46)),
        step(0, 0, 0, 0, 0, 576, NumericGrant::AtNativeTurn(u32::MAX)),
    ] {
        failure(&prior, &model, &step, ErrorKind::Domain);
    }
}

#[test]
fn small_multisource_matrix_matches_both_oracles_on_all_7501_lanes_without_raw_mass_normalization()
{
    let mut cases = 0;
    for gas in [1, 3] {
        for counted in [false, true] {
            let mut rules = structural_rules();
            rules.gas_capacity_by_turn[0] = gas;
            let owned = if counted {
                vec![(
                    0,
                    vec![
                        fit(0, 3, 0, 0, key(0, 0, 0, 0)),
                        fit(1, 3, 0, 0, key(0, 0, 0, 1)),
                        fit(2, 3, 0, 0, key(0, 0, 0, 2)),
                    ],
                )]
            } else {
                vec![]
            };
            let model = model(rules, &owned);
            for material in 0..=4 {
                for bank in 0..=2 {
                    let prior =
                        prior(&[(material, bank, 1.0), (material + 1, (bank + 1) % 3, 3.0)]);
                    for conditioned in [false, true] {
                        let step = step(
                            0,
                            0,
                            0,
                            if conditioned { 1 } else { 0 },
                            0,
                            if conditioned { 2 } else { 576 },
                            NumericGrant::None,
                        );
                        let actual = compare(&prior, &model, &step);
                        if !conditioned {
                            assert!((actual.retained_mass() - 1.0).abs() <= 1e-12);
                        }
                        cases += 1;
                    }
                }
            }
        }
    }
    assert_eq!(cases, 120);
}

#[test]
fn shared_headstock_contributor_order_is_bitwise_distinguishable_from_regrouping() {
    let model = model(structural_rules(), &[]);
    let prior = prior(&[(2, 0, 1.0), (9, 1, 1.0), (7, 3, 1.0)]);
    let step = step(0, 0, 0, 0, 0, 576, NumericGrant::None);
    let records = contributor_records(&prior, &model, &step);
    let contributors: Vec<f64> = records
        .heads
        .iter()
        .filter(|record| record.index == 18)
        .map(|record| record.background.unwrap())
        .collect();
    assert_eq!(contributors.len(), 3);
    assert_ne!(
        ((contributors[0] + contributors[1]) + contributors[2]).to_bits(),
        (contributors[0] + (contributors[1] + contributors[2])).to_bits()
    );
    let canonical = reduce_records(&records, &step, SparseArithmetic::Canonical);
    let regrouped = reduce_graph(&records, &step, SparseArithmetic::Canonical, true);
    assert!(
        canonical
            .masses
            .iter()
            .zip(&regrouped.masses)
            .any(|(left, right)| left.to_bits() != right.to_bits())
    );
    compare(&prior, &model, &step);
}

#[test]
fn sparse_collisions_preserve_multiply_then_divide_and_unfused_canonical_additions() {
    let model = model(
        structural_rules(),
        &[(
            0,
            vec![
                fit(0, 20, 0, 0, key(0, 0, 0, 0)),
                fit(1, 20, 0, 0, key(0, 0, 0, 1)),
                fit(2, 20, 0, 0, key(0, 0, 0, 2)),
            ],
        )],
    );
    let prior = prior(&[(3, 0, 1.0), (4, 0, 5.0), (5, 0, 5.0)]);
    let step = step(0, 3, 0, 0, 0, 576, NumericGrant::None);
    let records = contributor_records(&prior, &model, &step);
    assert_eq!(
        records
            .sparse
            .iter()
            .filter(|record| record.index == 3)
            .count(),
        3
    );
    assert!(records.sparse.iter().any(|record| {
        ((record.probability * record.count) / record.denominator).to_bits()
            != (record.probability * (record.count / record.denominator)).to_bits()
    }));
    let canonical = reduce_records(&records, &step, SparseArithmetic::Canonical);
    for arithmetic in [SparseArithmetic::DivideFirst, SparseArithmetic::Fused] {
        let changed = reduce_records(&records, &step, arithmetic);
        assert!(
            canonical
                .masses
                .iter()
                .zip(&changed.masses)
                .any(|(left, right)| left.to_bits() != right.to_bits())
        );
    }
    compare(&prior, &model, &step);
}

#[derive(Clone, Copy)]
struct FeeStep {
    label: &'static str,
    units: u64,
}

fn fee(steps: &mut Vec<FeeStep>, label: &'static str, units: u64) {
    steps.push(FeeStep { label, units });
}

fn fixed_fee() -> u64 {
    128 + 4 * 192 + 4 * (2 * 8034 + 2 * 7501) + 8 * 7501 + 16 * 8034 + 24 * 7501 + 4 * 170 + 8 * 165
}

fn allowed_pairs(source: AccountingPoint) -> Vec<(u8, u8)> {
    let mut pairs = Vec::new();
    for spend in [0, 1, 3, 5, 9] {
        if spend <= source.bank {
            for created in BTreeSet::from([0, spend]) {
                pairs.push((spend, created));
            }
        }
    }
    pairs
}

fn old_source_term_steps(
    model: &Model,
    source: AccountingPoint,
    context: &NumericSourceContext,
) -> Vec<FeeStep> {
    let table = selected(model, source, context.input_turn);
    let candidates = cohort_indices(source, context.input_turn);
    let levels = candidates
        .iter()
        .position(|&candidate| candidate == table)
        .unwrap()
        + 1;
    let mut steps = vec![
        FeeStep {
            label: "old-query-entry",
            units: 128,
        },
        FeeStep {
            label: "old-checked-source",
            units: 32,
        },
    ];
    for _ in 0..levels {
        fee(&mut steps, "old-selection-index", 32);
    }
    for _ in allowed_pairs(source) {
        fee(&mut steps, "old-z-parameters", 32);
        fee(&mut steps, "old-z-prefix", 32);
    }
    fee(
        &mut steps,
        "old-row-inspection",
        32 * model.expected[table].rows.len() as u64,
    );
    for _ in &model.expected[table].rows {
        fee(&mut steps, "old-row-interval", 128);
        fee(&mut steps, "old-row-minimum", 32);
    }
    steps
}

fn aggregate_steps(prior: &Prior, model: &Model, step: &NumericAccountingStep) -> Vec<FeeStep> {
    let mut steps = vec![
        FeeStep {
            label: "entry",
            units: 128,
        },
        FeeStep {
            label: "global-step",
            units: 32,
        },
        FeeStep {
            label: "profile-loan",
            units: 32,
        },
        FeeStep {
            label: "input-gas-lookup",
            units: 32,
        },
        FeeStep {
            label: "grant-branch",
            units: 32,
        },
    ];
    if matches!(step.grant, NumericGrant::AtNativeTurn(_)) {
        fee(&mut steps, "grant-income-lookup", 32);
    }
    fee(&mut steps, "minimums-loan", 32);
    fee(&mut steps, "gamma-initialization", 4 * 170);
    fee(&mut steps, "gamma-materialization", 8 * 165);
    for (allocation, initialization, lanes) in [
        ("head-allocation", "head-initialization", 8034),
        (
            "boolean-head-allocation",
            "boolean-head-initialization",
            8034,
        ),
        ("mass-allocation", "mass-initialization", 7501),
        ("cell-allocation", "cell-initialization", 7501),
    ] {
        fee(&mut steps, allocation, 192);
        fee(&mut steps, initialization, 4 * lanes);
    }
    fee(&mut steps, "all-prior-lanes", 8 * 7501);
    let gas = model.rules.gas_capacity_by_turn[step.context.input_turn as usize];
    for (source_index, &present) in prior.cells.iter().enumerate() {
        if !present {
            continue;
        }
        let source = point(source_index);
        fee(&mut steps, "active-source", 32);
        let positive = prior.probabilities[source_index] > 0.0;
        if positive {
            steps.extend(old_source_term_steps(model, source, &step.context));
        }
        fee(&mut steps, "accounting-source-check", 32);
        fee(&mut steps, "accounting-source-handle", 32);
        if positive {
            fee(&mut steps, "prepared-direct-table-index", 32);
            fee(&mut steps, "prepared-handle", 32);
            fee(&mut steps, "positive-background", 32);
        }
        let feasible = tuples(source, &step.context, gas);
        let mut branches: BTreeMap<(u8, u8), BTreeSet<u8>> = BTreeMap::new();
        for key in &feasible {
            branches
                .entry((key.spend, key.created))
                .or_default()
                .insert(key.growth);
        }
        for growths in branches.values() {
            fee(&mut steps, "opportunities-wrapper-is-pair-setup", 32);
            for _ in growths {
                fee(&mut steps, "distinct-growth", 64);
            }
        }
        if positive {
            let table = selected(model, source, step.context.input_turn);
            for _ in &model.expected[table].rows {
                fee(&mut steps, "f6-inspected-row", 64);
                fee(&mut steps, "reevaluation-index", 32);
                fee(&mut steps, "reevaluation-interval", 128);
                fee(&mut steps, "reevaluation-minimum", 32);
            }
        }
    }
    fee(&mut steps, "suffix", 16 * 8034);
    fee(&mut steps, "destination", 24 * 7501);
    steps
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
    panic!("missing fee {label} occurrence {occurrence}");
}

fn failed_prefix(steps: &[FeeStep], remaining: u64) -> u64 {
    let mut used = 0;
    for step in steps {
        if step.units > remaining - used {
            return used;
        }
        used += step.units;
    }
    panic!("expected a budget refusal");
}

#[test]
fn fixed_census_four_heaps_and_all_variable_global_source_bridge_fees_are_independent_invoices() {
    assert_eq!(fixed_fee(), 495752);
    let model = model(structural_rules(), &[]);
    for (points, grant) in [
        (vec![(0, 0, 1.0)], NumericGrant::None),
        (vec![(0, 0, 1.0)], NumericGrant::AtNativeTurn(0)),
        (vec![(1, 0, 1.0)], NumericGrant::None),
        (vec![(3, 0, 1.0)], NumericGrant::None),
        (
            vec![(1, 0, 1.0), (3, 1, 2.0), (4, 3, 3.0)],
            NumericGrant::None,
        ),
        (vec![(0, 0, 1.0), (3, 1, 0.0)], NumericGrant::None),
    ] {
        let prior = prior(&points);
        let step = step(0, 0, 0, 0, 0, 576, grant);
        let steps = aggregate_steps(&prior, &model, &step);
        assert_eq!(
            steps
                .iter()
                .filter(|step| step.label.ends_with("-allocation"))
                .count(),
            4
        );
        assert_eq!(
            steps
                .iter()
                .filter(|step| step.label == "gamma-initialization")
                .count(),
            1
        );
        let mut work = LedgerWork::with_limit(invoice(&steps)).unwrap();
        let result = ok(aggregate_accounting(
            &prior.actual,
            &model.actual,
            &step,
            &mut work,
        ));
        assert_eq!(work.used(), invoice(&steps));
        assert_eq!(work.remaining(), 0);
        assert!((result.retained_mass() - 1.0).abs() <= 1e-12);
    }
    let prior = prior(&[(0, 0, 1.0)]);
    let step = step(0, 0, 0, 0, 0, 576, NumericGrant::None);
    assert_eq!(
        invoice(&old_source_term_steps(&model, point(0), &step.context)),
        352
    );
    assert_eq!(invoice(&aggregate_steps(&prior, &model, &step)), 496552);
}

#[test]
fn every_precharge_boundary_refuses_before_covered_allocation_scan_lookup_math_or_publication() {
    let model = model(structural_rules(), &[]);
    let prior = prior(&[(0, 0, 1.0)]);
    let step = step(0, 0, 0, 0, 0, 576, NumericGrant::AtNativeTurn(0));
    let steps = aggregate_steps(&prior, &model, &step);
    let prior_before = prior_snapshot(&prior);
    let tables_before = table_snapshot(&model);
    let mut spent = 0;
    for entry in &steps {
        if entry.units > 0 {
            let mut short = LedgerWork::with_limit(spent + entry.units - 1).unwrap();
            expect_error(
                aggregate_accounting(&prior.actual, &model.actual, &step, &mut short),
                ErrorKind::Budget,
            );
            assert_eq!(short.used(), spent, "block={}", entry.label);
            assert_eq!(prior_snapshot(&prior), prior_before);
            assert_eq!(table_snapshot(&model), tables_before);
        }
        spent += entry.units;
    }
}

#[test]
fn zero_pmf_path_cost_is_count_and_qualification_independent_after_matched_positive_path_differences()
 {
    let empty = model(structural_rules(), &[]);
    let owned: Vec<(u16, Vec<NumericFitRow>)> = (0..32)
        .map(|slot| (slot, vec![fit(0, 3, 1, 0, key(1, 1, 0, 0))]))
        .collect();
    let qualified = model(structural_rules(), &owned);
    let positive = prior(&[(0, 0, 1.0)]);
    let with_zero = prior(&[(0, 0, 1.0), (3, 1, 0.0)]);
    let step = step(0, 0, 0, 0, 0, 576, NumericGrant::None);
    let mut differences = Vec::new();
    let mut positive_costs = Vec::new();
    for model in [&empty, &qualified] {
        let mut first_work = LedgerWork::new();
        let first = ok(aggregate_accounting(
            &positive.actual,
            &model.actual,
            &step,
            &mut first_work,
        ));
        let mut second_work = LedgerWork::new();
        let second = ok(aggregate_accounting(
            &with_zero.actual,
            &model.actual,
            &step,
            &mut second_work,
        ));
        assert_eq!(
            first_work.used(),
            invoice(&aggregate_steps(&positive, model, &step))
        );
        assert_eq!(
            second_work.used(),
            invoice(&aggregate_steps(&with_zero, model, &step))
        );
        assert_eq!(first.masses(), second.masses());
        assert!(
            second
                .accounting_cells()
                .iter()
                .zip(second.masses())
                .any(|(&cell, &mass)| cell && mass == 0.0)
        );
        differences.push(second_work.used() - first_work.used());
        positive_costs.push(first_work.used());
    }
    assert_eq!(differences, [1216, 1216]);
    assert_eq!(positive_costs[1] - positive_costs[0], 192 + 64 + 192);
    assert_eq!(
        selected(
            &qualified,
            AccountingPoint {
                material: 3,
                bank: 1
            },
            0
        ),
        57 + 3 * band(3)
    );
}

#[test]
fn positive_preparation_and_inspected_rows_keep_old_n_scan_and_all_reevaluation_fees_even_when_filtered()
 {
    {
        let owned = vec![(
            0,
            vec![
                fit(0, 3, 0, 0, key(0, 0, 0, 0)),
                fit(1, 20, 0, 0, key(0, 0, 0, 10)),
                fit(2, 20, 0, 0, key(0, 0, 0, 11)),
            ],
        )];
        let model = model(structural_rules(), &owned);
        let prior = prior(&[(3, 0, 1.0)]);
        let step = step(0, 3, 0, 2, 0, 1, NumericGrant::None);
        let steps = aggregate_steps(&prior, &model, &step);
        assert_eq!(
            steps
                .iter()
                .filter(|step| step.label == "old-query-entry")
                .count(),
            1
        );
        assert_eq!(
            steps
                .iter()
                .filter(|step| step.label == "f6-inspected-row")
                .count(),
            3
        );
        assert_eq!(
            steps
                .iter()
                .filter(|step| step.label == "reevaluation-minimum")
                .count(),
            3
        );
        let mut work = LedgerWork::with_limit(invoice(&steps)).unwrap();
        let actual = ok(aggregate_accounting(
            &prior.actual,
            &model.actual,
            &step,
            &mut work,
        ));
        assert_eq!(work.used(), invoice(&steps));
        assert!(actual.retained_mass() < 1.0);
        for (occurrence, entry) in steps
            .iter()
            .filter(|step| step.label == "f6-inspected-row")
            .enumerate()
        {
            let prefix = before(&steps, entry.label, occurrence);
            let mut short = LedgerWork::with_limit(prefix + entry.units - 1).unwrap();
            expect_error(
                aggregate_accounting(&prior.actual, &model.actual, &step, &mut short),
                ErrorKind::Budget,
            );
            assert_eq!(short.used(), prefix);
        }
    }
    let qualified = qualified_fractional_model();
    let prior = prior(&[(8, 1, 1.0)]);
    let step = step(0, 0, 0, 0, 0, 576, NumericGrant::None);
    let steps = aggregate_steps(&prior, &qualified, &step);
    let mut work = LedgerWork::with_limit(invoice(&steps)).unwrap();
    ok(aggregate_accounting(
        &prior.actual,
        &qualified.actual,
        &step,
        &mut work,
    ));
    assert_eq!(work.used(), invoice(&steps));
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "old-selection-index")
            .count(),
        1
    );
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "old-query-entry")
            .count(),
        1
    );
    let multiple = self::prior(&[(2, 0, 1.0), (4, 1, 2.0), (8, 1, 3.0)]);
    let steps = aggregate_steps(&multiple, &qualified, &step);
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "old-query-entry")
            .count(),
        3
    );
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label == "positive-background")
            .count(),
        3
    );
    assert_eq!(
        steps
            .iter()
            .filter(|step| step.label.ends_with("-allocation"))
            .count(),
        4
    );
    let mut work = LedgerWork::with_limit(invoice(&steps)).unwrap();
    ok(aggregate_accounting(
        &multiple.actual,
        &qualified.actual,
        &step,
        &mut work,
    ));
    assert_eq!(work.used(), invoice(&steps));
}

#[test]
fn budget_errors_precede_global_domain_or_positive_underflow_when_covered_blocks_are_unpaid() {
    let model = model(structural_rules(), &[]);
    let ordinary = prior(&[(0, 0, 1.0)]);
    let invalid = step(0, 0, 0, 618, 0, 576, NumericGrant::None);
    let mut short = LedgerWork::with_limit(159).unwrap();
    expect_error(
        aggregate_accounting(&ordinary.actual, &model.actual, &invalid, &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), 128);
    let mut exact = LedgerWork::with_limit(160).unwrap();
    expect_error(
        aggregate_accounting(&ordinary.actual, &model.actual, &invalid, &mut exact),
        ErrorKind::Domain,
    );
    assert_eq!(exact.used(), 160);
    let tiny = prior(&[(0, 0, f64::from_bits(1)), (1, 0, 1.0)]);
    let step = step(0, 0, 0, 0, 0, 576, NumericGrant::None);
    let steps = aggregate_steps(&tiny, &model, &step);
    let prefix = before(&steps, "positive-background", 0);
    let mut short = LedgerWork::with_limit(prefix + 31).unwrap();
    expect_error(
        aggregate_accounting(&tiny.actual, &model.actual, &step, &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), prefix);
    let mut exact = LedgerWork::with_limit(prefix + 32).unwrap();
    expect_error(
        aggregate_accounting(&tiny.actual, &model.actual, &step, &mut exact),
        ErrorKind::Underflow,
    );
    assert_eq!(exact.used(), prefix + 32);
}

#[test]
fn same_meter_prior_charges_exact_cap_and_one_below_preserve_spent_prefix_and_input_bits() {
    let model = model(structural_rules(), &[]);
    let prior = prior(&[(0, 0, 1.0)]);
    let step = step(0, 0, 0, 0, 0, 576, NumericGrant::None);
    let steps = aggregate_steps(&prior, &model, &step);
    let total = invoice(&steps);
    let mut exact = LedgerWork::new();
    exact.charge(LEDGER_WORK_LIMIT - total).unwrap();
    let actual = ok(aggregate_accounting(
        &prior.actual,
        &model.actual,
        &step,
        &mut exact,
    ));
    assert_eq!(actual.retained_mass(), 1.0);
    assert_eq!(exact.remaining(), 0);
    let mut short = LedgerWork::new();
    let prefix = LEDGER_WORK_LIMIT - total + 1;
    short.charge(prefix).unwrap();
    expect_error(
        aggregate_accounting(&prior.actual, &model.actual, &step, &mut short),
        ErrorKind::Budget,
    );
    assert_eq!(short.used(), prefix + total - 24 * 7501);
    let mut shared = LedgerWork::new();
    shared.charge(17).unwrap();
    ok(aggregate_accounting(
        &prior.actual,
        &model.actual,
        &step,
        &mut shared,
    ));
    assert_eq!(shared.used(), 17 + total);
    ok(aggregate_accounting(
        &prior.actual,
        &model.actual,
        &step,
        &mut shared,
    ));
    assert_eq!(shared.used(), 17 + 2 * total);
    let remaining = shared.remaining();
    let before_failure = shared.used();
    expect_error(
        aggregate_accounting(&prior.actual, &model.actual, &step, &mut shared),
        ErrorKind::Budget,
    );
    assert_eq!(
        shared.used(),
        before_failure + failed_prefix(&steps, remaining)
    );
}

#[test]
fn dense_supported_prior_refuses_budget_without_pruning_sources_or_resetting_the_caller_meter() {
    let model = model(structural_rules(), &[]);
    let prior = prior_buffers(vec![1.0; N], vec![true; N]);
    let before_prior = prior_snapshot(&prior);
    let before_tables = table_snapshot(&model);
    let minimum_positive_source = 32 + (128 + 32 + 4 * 32 + 64) + 128 + 32 + 32 + 64;
    assert_eq!(minimum_positive_source, 640);
    assert!(fixed_fee() + 7501 * minimum_positive_source > LEDGER_WORK_LIMIT);
    let mut work = LedgerWork::new();
    let step = step(0, 0, 0, 0, 0, 576, NumericGrant::None);
    expect_error(
        aggregate_accounting(&prior.actual, &model.actual, &step, &mut work),
        ErrorKind::Budget,
    );
    assert!(work.used() > 495752 && work.used() <= LEDGER_WORK_LIMIT);
    assert_eq!(prior_snapshot(&prior), before_prior);
    assert_eq!(table_snapshot(&model), before_tables);
}

#[test]
fn full_standalone_f4_chain_plus_even_fixed_f6_cost_is_not_admitted_on_one_meter() {
    let model = model(structural_rules(), &[]);
    assert_eq!(fixed_fee() + 1003928, 1499680);
    assert!(fixed_fee() + 1003928 > LEDGER_WORK_LIMIT);
    let mut raw = vec![0.0; N];
    raw[0] = 1.0;
    let mut cells = vec![false; N];
    cells[0] = true;
    let mut work = LedgerWork::new();
    let support = NumericSupport::from_cells(&cells, &mut work).unwrap();
    let joint = normalize_aggregate(&raw, &support, &mut work).unwrap();
    let temperature = ReadoutTemperature::from_index(500, &mut work).unwrap();
    readout_copy(&joint, 0, &temperature, &mut work).unwrap();
    assert_eq!(work.used(), 1003928);
    let expected_prior = Prior {
        actual: joint,
        probabilities: raw,
        cells,
    };
    let step = step(0, 0, 0, 0, 0, 576, NumericGrant::None);
    let steps = aggregate_steps(&expected_prior, &model, &step);
    let prefix = work.used();
    let expected_spent = failed_prefix(&steps, work.remaining());
    expect_error(
        aggregate_accounting(&expected_prior.actual, &model.actual, &step, &mut work),
        ErrorKind::Budget,
    );
    assert_eq!(work.used(), prefix + expected_spent);
}

#[test]
fn widened_loss_thresholds_and_reachable_stock_endpoints_do_not_overflow_or_invent_617() {
    let mut rules = structural_rules();
    rules.gas_capacity_by_turn[0] = 3;
    let model = model(rules, &[]);
    let prior = prior(&[(576, 12, 1.0)]);
    let step_last = step(0, 0, 0, 609, 0, 0, NumericGrant::None);
    let actual = compare(&prior, &model, &step_last);
    assert_eq!(
        actual
            .accounting_cells()
            .iter()
            .filter(|&&cell| cell)
            .count(),
        1
    );
    assert!(actual.accounting_cells()[index(0, 3)]);
    for loss in [610, 617] {
        failure(
            &prior,
            &model,
            &step(0, 0, 0, loss, 576, 576, NumericGrant::None),
            ErrorKind::EmptySupport,
        );
    }
    assert_eq!(576 + 617, 1193);
}

#[test]
fn readout_borrows_and_prior_negative_zero_bits_stay_unchanged_after_success() {
    let model = model(structural_rules(), &[]);
    let mut raw = vec![-0.0; N];
    raw[0] = 1.0;
    let mut cells = vec![false; N];
    cells[0] = true;
    let prior = prior_buffers(raw, cells);
    assert_eq!(
        prior.actual.probabilities()[1].to_bits(),
        (-0.0_f64).to_bits()
    );
    let old = prior_snapshot(&prior);
    let actual = compare(
        &prior,
        &model,
        &step(0, 0, 0, 0, 0, 576, NumericGrant::None),
    );
    assert_eq!(prior_snapshot(&prior), old);
    let mass_pointer = actual.masses().as_ptr();
    let support_pointer = actual.accounting_cells().as_ptr();
    for _ in 0..4 {
        assert_eq!(actual.masses().as_ptr(), mass_pointer);
        assert_eq!(actual.accounting_cells().as_ptr(), support_pointer);
        assert_eq!(actual.retained_mass(), 1.0);
    }
}

#[test]
fn maximum_valid_marine_context_and_source_endpoints_match_both_full_lane_oracles() {
    let mut rules = structural_rules();
    rules.gas_capacity_by_turn[0] = 3;
    let model = model(rules, &[]);
    let prior = prior(&[(64, 0, 1.0), (576, 12, 2.0)]);
    let actual = compare(
        &prior,
        &model,
        &step(0, 64, 64, 0, 0, 576, NumericGrant::None),
    );
    assert!((actual.retained_mass() - 1.0).abs() <= 1e-12);
}

#[test]
fn aggregator_uses_only_transition_owned_profile_after_caller_numeric_rules_are_changed() {
    let mut caller = structural_rules();
    caller.max_turn = 3;
    caller.income_by_turn = vec![3, 1, 2, 3];
    caller.gas_capacity_by_turn = vec![3, 1, 2, 3];
    let model = model(caller.clone(), &[]);
    caller.income_by_turn.fill(0);
    caller.gas_capacity_by_turn.fill(1);
    caller.max_turn = 0;
    let prior = prior(&[(2, 11, 1.0), (4, 12, 3.0)]);
    let actual = compare(
        &prior,
        &model,
        &step(0, 0, 0, 0, 0, 576, NumericGrant::AtNativeTurn(0)),
    );
    assert!((actual.retained_mass() - 1.0).abs() <= 1e-12);
    assert_eq!(model.rules.income_by_turn[0], 3);
    assert_eq!(model.rules.gas_capacity_by_turn[0], 3);
    assert_eq!(caller.income_by_turn[0], 0);
}

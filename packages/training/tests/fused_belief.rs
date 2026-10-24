// SPEC: _spec/packages/training/belief-integration.puml
use std::collections::BTreeSet;

use training_native::accounting_kernel::{AccountingPoint, NumericGrant};
use training_native::banded_joint::{BandError, expand_joint, normalize_weighted, readout_banded_copy, reband_joint, sparse_probabilities};
use training_native::contracts::{Candidate, ObservedPiece, OwnInventory, OwnPiece, Spend, ViewVersion, all_squares};
use training_native::evidence_tables::{InnovationCode, NumericEconomicFitGroup, NumericEconomicFitRow,
    NumericEconomicTables, build_numeric_economic_tables, weight_evidence};
use training_native::feature_input::AdvanceDisposition;
use training_native::joint_accounting::{JointAccountingError, NumericAccountingStep, aggregate_accounting};
use training_native::joint_math::{JointMathError, ReadoutTemperature, SparseCell, SupportRun, SupportRuns, readout_copy};
use training_native::ledger::{LEDGER_WORK_LIMIT, LedgerWork};
use training_native::ledger::contracts::*;
use training_native::numerical_belief::*;
use training_native::transition_tables::{NumericFitRow, NumericOutcome, NumericSourceContext};

type Tuple = (u8, u8, u8, u8, u16);

fn rules() -> LedgerRules {
    #[derive(serde::Deserialize)]
    struct RulesOnly { rules: LedgerRules }
    serde_json::from_str::<RulesOnly>(include_str!("fixtures/ledger-boundaries.json")).unwrap().rules
}

fn code(bins: [u8; 3]) -> InnovationCode {
    InnovationCode::from_bins(bins, &mut LedgerWork::new()).unwrap()
}

fn fit_rows() -> [NumericEconomicFitRow; 2] {
    [
        NumericEconomicFitRow {
            transition: NumericFitRow { node_index: 0, source: AccountingPoint { material: 4, bank: 3 },
                input_turn: 0, visible_before: 0, marines_before: 0,
                outcome: NumericOutcome { spend: 1, created: 1, wasted: 0, growth: 2, destroyed: 1 } },
            destination: AccountingPoint { material: 6, bank: 3 }, boundary_turn: 1, innovation: code([1, 0, 0]),
        },
        NumericEconomicFitRow {
            transition: NumericFitRow { node_index: 0, source: AccountingPoint { material: 2, bank: 0 },
                input_turn: 0, visible_before: 0, marines_before: 0,
                outcome: NumericOutcome { spend: 0, created: 0, wasted: 0, growth: 0, destroyed: 1 } },
            destination: AccountingPoint { material: 1, bank: 1 }, boundary_turn: 1, innovation: code([0, 1, 0]),
        },
    ]
}

fn tables(profile: &LedgerRules, fitted: bool) -> NumericEconomicTables {
    let rows = fit_rows();
    let groups = [NumericEconomicFitGroup { slot: 0, selected_rows: &rows[..1] },
        NumericEconomicFitGroup { slot: 1, selected_rows: &rows[1..] }];
    build_numeric_economic_tables(profile, 3, if fitted { &groups } else { &[] }, &mut LedgerWork::new()).unwrap()
}

fn bins(temperature: &ReadoutTemperature) -> [CalibrationBin<'_>; 1] {
    [CalibrationBin { turn_low: 0, turn_high: 45, lit_low: 0, lit_high: 64, temperature }]
}

fn posterior(points: &[(u8, u16, f64)], extra: &[(u8, u16)]) -> CompactPosterior {
    let cells: Vec<_> = points.iter().map(|&(bank, material, probability)| SparseCell { bank, material, probability }).collect();
    let mut support: BTreeSet<_> = points.iter().map(|&(bank, material, _)| (bank, material)).collect();
    support.extend(extra.iter().copied());
    let mut runs: Vec<SupportRun> = vec![];
    for (bank, material) in support {
        if let Some(last) = runs.last_mut() {
            if last.bank == bank && last.upper + 1 == material { last.upper = material; continue; }
        }
        runs.push(SupportRun { bank, lower: material, upper: material });
    }
    CompactPosterior::from_sparse(&cells, &runs, &mut LedgerWork::new()).unwrap()
}

fn step(turn: u32, loss: u16, grant: NumericGrant) -> NumericAccountingStep {
    NumericAccountingStep { context: NumericSourceContext { input_turn: turn, visible_before: 0, marines_before: 0 },
        grant, witnessed_loss: loss, destination_lower: 0, destination_upper: 12 }
}

fn tuple_set(material: u16, bank: u8, context: NumericSourceContext, gas: u32) -> BTreeSet<Tuple> {
    let mut tuples = BTreeSet::new();
    for spend in [0_u8, 1, 3, 5, 9] {
        if spend > bank { continue; }
        let creations = if spend == 0 { vec![0] } else { vec![0, spend] };
        for created in creations {
            let opportunities = 4_u32.min(1 + gas - u32::from(spend > 0)).min(
                u32::from(context.marines_before) + u32::from(material - context.visible_before) + u32::from(created == 1));
            let mut growth = BTreeSet::from([0_u8]);
            for _ in 0..opportunities {
                growth = growth.into_iter().flat_map(|sum| [0, 2, 4, 8].map(|increment| sum + increment)).collect();
            }
            for growth in growth {
                let stock = material + u16::from(created) + u16::from(growth);
                for destroyed in stock.saturating_sub(576)..=stock {
                    tuples.insert((spend, created, spend - created, growth, destroyed));
                }
            }
        }
    }
    tuples
}

fn oracle(
    points: &[(u8, u16, f64)], extra: &[(u8, u16)], profile: &LedgerRules,
    step: &NumericAccountingStep, fitted: bool,
) -> (Vec<bool>, Vec<f64>) {
    let mut support = vec![false; 7501];
    let mut mass = vec![0.0; 7501];
    let rows = fit_rows();
    let mut sources = points.to_vec();
    sources.extend(extra.iter().map(|&(bank, material)| (bank, material, 0.0)));
    sources.sort_by_key(|&(bank, material, _)| (bank, material));
    let income = match step.grant { NumericGrant::None => 0, NumericGrant::AtNativeTurn(turn) => profile.income_at(turn).unwrap() };
    for (bank, material, probability) in sources {
        let tuples = tuple_set(material, bank, step.context, profile.gas_capacity_at(step.context.input_turn).unwrap());
        let selected: Vec<_> = if fitted { rows.iter().filter_map(|row| {
            let value = row.transition.outcome;
            let key = (value.spend, value.created, value.wasted, value.growth, value.destroyed);
            tuples.contains(&key).then_some(key)
        }).collect() } else { vec![] };
        let denominator = selected.len() as f64 + 0.5 * tuples.len() as f64;
        for (spend, created, wasted, growth, destroyed) in tuples {
            if destroyed < step.witnessed_loss { continue; }
            let destination = material + u16::from(created) + u16::from(growth) - destroyed;
            if destination < step.destination_lower || destination > step.destination_upper { continue; }
            let bank = (u32::from(bank - spend) + income).min(12) as usize;
            let index = 577 * bank + usize::from(destination);
            support[index] = true;
            mass[index] += (0.5 * probability) / denominator;
            for key in &selected {
                if *key == (spend, created, wasted, growth, destroyed) { mass[index] += probability / denominator; }
            }
        }
    }
    let sum: f64 = mass.iter().sum();
    for mass in &mut mass { *mass /= sum; }
    (support, mass)
}

fn expanded(posterior: &CompactPosterior) -> Vec<f64> {
    let mut probabilities = vec![0.0; 7501];
    for cell in sparse_probabilities(posterior.banded(), &mut LedgerWork::new()).unwrap() {
        probabilities[usize::from(cell.bank) * 577 + usize::from(cell.material)] = cell.probability;
    }
    probabilities
}

fn budget(error: &BeliefError) -> bool {
    match error {
        BeliefError::Ledger(error) => error.code == LedgerErrorCode::Budget,
        BeliefError::Math(JointMathError::Work(error)) | BeliefError::Band(BandError::Work(error)) => error.code == LedgerErrorCode::Budget,
        _ => false,
    }
}

#[test]
fn small_tuple_oracle_has_exact_boolean_support_and_declared_numeric_tolerance() {
    let profile = rules();
    let tables = tables(&profile, true);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = bins(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &SharedMarineOpportunities, &mut LedgerWork::new()).unwrap();
    let points = [(0, 2, 0.75), (3, 4, 0.25)];
    let extra = [(1, 4)];
    let prior = posterior(&points, &extra);
    for turn in [0, 10, 20] {
        for loss in [0, 1, 3] {
            for grant in [NumericGrant::None, NumericGrant::AtNativeTurn(turn + 1)] {
                let step = step(turn, loss, grant);
                let (support, expected) = oracle(&points, &extra, &profile, &step, true);
                let result = fused_settlement(&prior, &model, &step, turn + 1, code([0; 3]), &mut LedgerWork::new()).unwrap();
                assert_eq!(result.banded().support().cells(), support);
                for (actual, expected) in expanded(&result).into_iter().zip(expected) {
                    assert!((actual - expected).abs() <= 1e-12, "tuple-order oracle tolerance");
                }
            }
        }
    }
}

#[test]
fn nonzero_evidence_and_sparse_fits_match_legacy_component_bits_in_unchanged_orders() {
    let profile = rules();
    let tables = tables(&profile, true);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = bins(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &SharedMarineOpportunities, &mut LedgerWork::new()).unwrap();
    let prior = posterior(&[(0, 2, 0.75), (3, 4, 0.25)], &[(1, 4)]);
    let step = step(0, 1, NumericGrant::AtNativeTurn(1));
    let innovation = code([1, 0, 0]);
    let actual = fused_settlement(&prior, &model, &step, 1, innovation, &mut LedgerWork::new()).unwrap();
    let legacy_prior = expand_joint(prior.banded(), &mut LedgerWork::new()).unwrap();
    let raw = aggregate_accounting(&legacy_prior, tables.transitions(), &step, &mut LedgerWork::new()).unwrap();
    let weighted = weight_evidence(raw, &tables, 1, innovation, &mut LedgerWork::new()).unwrap();
    let mut representation = LedgerWork::new();
    let normalized = normalize_weighted(weighted, &mut representation).unwrap();
    let expected = reband_joint(normalized, &mut representation).unwrap();
    assert_eq!(actual.banded().support().cells(), expected.support().cells());
    assert_eq!(actual.banded().components().len(), expected.components().len());
    for (actual, expected) in actual.banded().components().iter().zip(expected.components()) {
        assert_eq!((actual.bank(), actual.band()), (expected.bank(), expected.band()));
        assert_eq!(actual.mass().to_bits(), expected.mass().to_bits());
        assert_eq!(actual.conditional().iter().map(|p| p.to_bits()).collect::<Vec<_>>(),
            expected.conditional().iter().map(|p| p.to_bits()).collect::<Vec<_>>());
    }
}

#[test]
fn zero_pmf_origins_reach_banks_that_positive_origins_cannot_reach() {
    let profile = rules();
    let tables = tables(&profile, false);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = bins(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &SharedMarineOpportunities, &mut LedgerWork::new()).unwrap();
    let prior = posterior(&[(0, 2, 1.0)], &[(12, 4)]);
    let result = fused_settlement(&prior, &model, &step(0, 0, NumericGrant::None), 1, code([0; 3]), &mut LedgerWork::new()).unwrap();
    assert!(result.banded().support().cells()[12 * 577 + 4]);
    assert_eq!(expanded(&result)[12 * 577 + 4], 0.0);
    assert!(result.support_runs().runs().iter().any(|run| run.bank == 12));
}

#[test]
fn stationary_evidence_retains_independent_support_and_never_applies_grant_or_loss_flow() {
    let profile = rules();
    let tables = tables(&profile, true);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = bins(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &SharedMarineOpportunities, &mut LedgerWork::new()).unwrap();
    let prior = posterior(&[(1, 1, 0.5), (3, 6, 0.5)], &[(8, 4)]);
    let innovation = code([1, 0, 0]);
    let result = fused_stationary(&prior, &model, 1, 6, 1, innovation, &mut LedgerWork::new()).unwrap();
    assert_eq!(result.banded().support().cells(), prior.banded().support().cells());
    let first = tables.evidence_likelihood(AccountingPoint { bank: 1, material: 1 }, 1, innovation, &mut LedgerWork::new()).unwrap();
    let second = tables.evidence_likelihood(AccountingPoint { bank: 3, material: 6 }, 1, innovation, &mut LedgerWork::new()).unwrap();
    assert!((expanded(&result)[577 + 1] - first / (first + second)).abs() < 1e-12);
    let narrowed = fused_stationary(&prior, &model, 4, 6, 1, code([0; 3]), &mut LedgerWork::new()).unwrap();
    assert!(!narrowed.banded().support().cells()[577 + 1]);
    assert!(narrowed.banded().support().cells()[8 * 577 + 4]);
    assert_eq!(expanded(&narrowed)[3 * 577 + 6], 1.0);
    assert!(matches!(fused_stationary(&prior, &model, 10, 12, 1, code([0; 3]), &mut LedgerWork::new()),
        Err(BeliefError::Accounting(JointAccountingError::EmptySupport))));
}

#[test]
fn nonzero_evidence_selects_distinct_cohorts_and_cache_keys_do_not_escape_the_call() {
    let profile = rules();
    let row = |bank, innovation| NumericEconomicFitRow {
        transition: NumericFitRow { node_index: 0, source: AccountingPoint { material: 0, bank },
            input_turn: 0, visible_before: 0, marines_before: 0,
            outcome: NumericOutcome { spend: 0, created: 0, wasted: 0, growth: 0, destroyed: 0 } },
        destination: AccountingPoint { material: 0, bank: bank + 1 }, boundary_turn: 1, innovation,
    };
    let a = [row(0, code([1, 0, 0]))];
    let b = [row(2, code([0, 1, 0]))];
    let groups: Vec<_> = (0..33).map(|slot| NumericEconomicFitGroup { slot,
        selected_rows: if slot < 32 { &a } else { &b } }).collect();
    let tables = build_numeric_economic_tables(&profile, 3, &groups, &mut LedgerWork::new()).unwrap();
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = bins(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &SharedMarineOpportunities, &mut LedgerWork::new()).unwrap();
    let prior = posterior(&[(1, 0, 0.5), (3, 0, 0.5)], &[(8, 4)]);
    for innovation in [code([1, 0, 0]), code([0, 1, 0])] {
        let first = tables.evidence_likelihood(AccountingPoint { bank: 1, material: 0 }, 1, innovation, &mut LedgerWork::new()).unwrap();
        let second = tables.evidence_likelihood(AccountingPoint { bank: 3, material: 0 }, 1, innovation, &mut LedgerWork::new()).unwrap();
        assert_ne!(first.to_bits(), second.to_bits());
        let result = fused_stationary(&prior, &model, 0, 4, 1, innovation, &mut LedgerWork::new()).unwrap();
        assert!((expanded(&result)[577] - first / (first + second)).abs() <= 1e-12);
        assert!(result.banded().support().cells()[8 * 577 + 4]);
        assert_eq!(expanded(&result)[8 * 577 + 4], 0.0);
    }
}

#[test]
fn compact_checked_constructors_reject_order_adjacency_domain_containment_and_nonfinite() {
    for runs in [vec![SupportRun { bank: 0, lower: 2, upper: 1 }],
        vec![SupportRun { bank: 13, lower: 0, upper: 0 }],
        vec![SupportRun { bank: 0, lower: 0, upper: 0 }, SupportRun { bank: 0, lower: 1, upper: 1 }],
        vec![SupportRun { bank: 1, lower: 0, upper: 0 }, SupportRun { bank: 0, lower: 0, upper: 0 }]]
    { assert!(SupportRuns::from_slice(&runs, &mut LedgerWork::new()).is_err()); }
    let runs = [SupportRun { bank: 0, lower: 0, upper: 4 }];
    for cells in [vec![SparseCell { bank: 0, material: 5, probability: 1.0 }],
        vec![SparseCell { bank: 0, material: 2, probability: f64::NAN }],
        vec![SparseCell { bank: 0, material: 2, probability: 0.5 }],
        vec![SparseCell { bank: 0, material: 2, probability: 0.5 }, SparseCell { bank: 0, material: 2, probability: 0.5 }],
        vec![SparseCell { bank: 0, material: 3, probability: 0.5 }, SparseCell { bank: 0, material: 2, probability: 0.5 }]]
    { assert!(CompactPosterior::from_sparse(&cells, &runs, &mut LedgerWork::new()).is_err()); }
}

#[test]
fn full_7501_boolean_support_is_representable_without_positive_pmf_truncation() {
    let cells = [SparseCell { bank: 0, material: 4, probability: 1.0 }];
    let runs: Vec<_> = (0..=12).map(|bank| SupportRun { bank, lower: 0, upper: 576 }).collect();
    let prior = CompactPosterior::from_sparse(&cells, &runs, &mut LedgerWork::new()).unwrap();
    assert_eq!(prior.support_runs().cell_count(), 7501);
    assert!(prior.banded().support().cells().iter().all(|cell| *cell));
    assert_eq!(sparse_probabilities(prior.banded(), &mut LedgerWork::new()).unwrap().len(), 1);
    assert_eq!(prior.banded().support().certainty().material, None);
    assert_eq!(prior.banded().support().certainty().potential, None);
    let profile = rules();
    let tables = tables(&profile, false);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = bins(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &SharedMarineOpportunities, &mut LedgerWork::new()).unwrap();
    let mut work = LedgerWork::new();
    work.charge(23).unwrap();
    let error = fused_settlement(&prior, &model, &step(0, 0, NumericGrant::None), 1, code([0; 3]), &mut work).unwrap_err();
    assert!(budget(&error) || matches!(error, BeliefError::Table(training_native::transition_tables::TableError::Work(ref error))
        if error.code == LedgerErrorCode::Budget));
    assert!(work.used() >= 23);
    assert!(work.used() <= work.limit());
    assert!(prior.banded().support().cells().iter().all(|cell| *cell));
}

#[test]
fn checked_constructor_exact_cap_and_one_below_preserve_charged_prefix() {
    let cells = [SparseCell { bank: 3, material: 4, probability: 1.0 }];
    let runs = [SupportRun { bank: 3, lower: 4, upper: 4 }];
    let mut measured = LedgerWork::new();
    measured.charge(17).unwrap();
    CompactPosterior::from_sparse(&cells, &runs, &mut measured).unwrap();
    let mut exact = LedgerWork::with_limit(measured.used()).unwrap();
    exact.charge(17).unwrap();
    CompactPosterior::from_sparse(&cells, &runs, &mut exact).unwrap();
    assert_eq!(exact.used(), measured.used());
    let mut short = LedgerWork::with_limit(measured.used() - 1).unwrap();
    short.charge(17).unwrap();
    let error = CompactPosterior::from_sparse(&cells, &runs, &mut short).unwrap_err();
    assert!(budget(&error));
    assert_eq!(short.used(), measured.used() - 40);
}

#[test]
fn fused_exact_cap_one_below_and_source_immutability_share_one_meter_each() {
    let profile = rules();
    let tables = tables(&profile, true);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = bins(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &SharedMarineOpportunities, &mut LedgerWork::new()).unwrap();
    let prior = posterior(&[(3, 4, 1.0)], &[(4, 5)]);
    let before = expanded(&prior);
    let mask = prior.banded().support().cells().to_vec();
    let step = step(0, 1, NumericGrant::AtNativeTurn(1));
    let innovation = code([1, 0, 0]);
    let mut measured = LedgerWork::new();
    measured.charge(19).unwrap();
    fused_settlement(&prior, &model, &step, 1, innovation, &mut measured).unwrap();
    let mut exact = LedgerWork::with_limit(measured.used()).unwrap();
    exact.charge(19).unwrap();
    fused_settlement(&prior, &model, &step, 1, innovation, &mut exact).unwrap();
    assert_eq!(exact.used(), measured.used());
    let mut short = LedgerWork::with_limit(measured.used() - 1).unwrap();
    short.charge(19).unwrap();
    let error = fused_settlement(&prior, &model, &step, 1, innovation, &mut short).unwrap_err();
    assert!(budget(&error));
    assert_eq!(short.used(), measured.used() - 40);
    assert_eq!(expanded(&prior), before);
    assert_eq!(prior.banded().support().cells(), mask);
}

#[test]
fn direct_banded_readout_preserves_all_zero_mean_visits_and_copy_isolation() {
    let prior = posterior(&[(0, 0, 0.125), (0, 17, 0.25), (8, 111, 0.125), (12, 576, 0.5)], &[(3, 7)]);
    let before = expanded(&prior);
    for index in [0, 137, 500, 777, 1000] {
        let temperature = ReadoutTemperature::from_index(index, &mut LedgerWork::new()).unwrap();
        let joint = expand_joint(prior.banded(), &mut LedgerWork::new()).unwrap();
        let expected = readout_copy(&joint, 7, &temperature, &mut LedgerWork::new()).unwrap();
        let actual = readout_banded_copy(prior.banded(), 7, &temperature, &mut LedgerWork::new()).unwrap();
        assert_eq!(actual.mean_d.to_bits(), expected.mean_d.to_bits());
        assert_eq!(actual.mean_potential.to_bits(), expected.mean_potential.to_bits());
        assert_eq!(actual.balance.to_bits(), expected.balance.to_bits());
        assert_eq!(actual.uncertainty.to_bits(), expected.uncertainty.to_bits());
        assert_eq!(actual.quantiles_d, expected.quantiles_d);
        assert_eq!(actual.quantiles_potential, expected.quantiles_potential);
    }
    assert_eq!(expanded(&prior), before);
    assert!(prior.banded().support().cells()[3 * 577 + 7]);
}

#[test]
fn direct_readout_invoice_prices_every_canonical_zero_mean_visit_and_refuses_one_below() {
    let prior = posterior(&[(0, 0, 0.25), (3, 7, 0.25), (12, 576, 0.5)], &[(8, 4)]);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let components = prior.banded().components().len() as u64;
    let width = prior.banded().components().iter().map(|component| component.conditional().len() as u64).sum::<u64>();
    let nonzero = sparse_probabilities(prior.banded(), &mut LedgerWork::new()).unwrap().len() as u64;
    let invoice = 223312 + 64 * components + 32 * width + 152 * nonzero;
    let mut exact = LedgerWork::with_limit(17 + invoice).unwrap();
    exact.charge(17).unwrap();
    readout_banded_copy(prior.banded(), 4, &temperature, &mut exact).unwrap();
    assert_eq!(exact.used(), 17 + invoice);
    let mut short = LedgerWork::with_limit(17 + invoice - 1).unwrap();
    short.charge(17).unwrap();
    assert!(matches!(readout_banded_copy(prior.banded(), 4, &temperature, &mut short),
        Err(BandError::Work(ref error)) if error.code == LedgerErrorCode::Budget));
    assert_eq!(short.used(), 17 + invoice - 64);
}

#[test]
fn direct_banded_readout_refuses_positive_low_temperature_underflow() {
    let prior = posterior(&[(0, 0, f64::MIN_POSITIVE), (1, 4, 1.0)], &[]);
    let temperature = ReadoutTemperature::from_index(0, &mut LedgerWork::new()).unwrap();
    assert!(matches!(readout_banded_copy(prior.banded(), 0, &temperature, &mut LedgerWork::new()), Err(BandError::Underflow)));
    let joint = expand_joint(prior.banded(), &mut LedgerWork::new()).unwrap();
    assert_eq!(readout_copy(&joint, 0, &temperature, &mut LedgerWork::new()).unwrap_err(), JointMathError::Underflow);
}

fn sq(value: &str) -> Square { Square::parse(value).unwrap() }

fn initial() -> Pair<EconomicBoundary> {
    let boundary = |side| {
        let cc = sq(if side == Side::White { "e1" } else { "e8" });
        let mut cells: Vec<_> = all_squares().into_iter().map(|square| ObservedCell::Unknown { square }).collect();
        cells[cc.index()] = ObservedCell::Lit { square: cc, piece: Some(ObservedPiece { color: side, kind: UnitType::King }) };
        EconomicBoundary { version: BoundaryVersion::V1, side, ordinal: 0, phase: BoundaryPhase::Initial, turn: 0,
            planning_ordinal: 0, grant_ordinal: 0, seq_before: 0, seq_through: 0, groups: vec![],
            snapshot: AuthorizedView { version: ViewVersion::V2, side, turn: 0,
                own: OwnInventory { minerals: 3, gas: 1, gas_income: 1, cc_lives: 3,
                    pieces: vec![OwnPiece { square: cc, kind: UnitType::King }], mines: vec![], sieged_tanks: vec![] }, cells } }
    };
    Pair { w: boundary(Side::White), b: boundary(Side::Black) }
}

fn opened(prior: &Pair<EconomicBoundary>) -> Pair<EconomicBoundary> {
    let make = |before: &EconomicBoundary| {
        let mut next = before.clone();
        next.ordinal += 1;
        next.phase = BoundaryPhase::TurnOpen;
        next.seq_before = before.seq_through;
        next.groups.clear();
        next.snapshot.own.gas = next.snapshot.own.gas_income;
        next
    };
    Pair { w: make(&prior.w), b: make(&prior.b) }
}

fn settled(prior: &Pair<EconomicBoundary>) -> Pair<EconomicBoundary> {
    let make = |before: &EconomicBoundary| {
        let mut next = before.clone();
        next.ordinal += 1;
        next.turn += 1;
        next.snapshot.turn = next.turn;
        next.phase = BoundaryPhase::Settled;
        next.planning_ordinal += 1;
        next.grant_ordinal += 1;
        next.seq_before = before.seq_through;
        next.seq_through += 1;
        let entitlement = rules().income_at(next.turn).unwrap();
        let credited = entitlement.min(12 - before.snapshot.own.minerals);
        let capacity = rules().gas_capacity_at(next.turn).unwrap();
        next.groups = vec![AtomicGroup::Settlement { seq: next.seq_through, entitlement, credited,
            gas_before_reset: before.snapshot.own.gas, next_gas_capacity: capacity }];
        next.snapshot.own.minerals += credited;
        next.snapshot.own.gas = 0;
        next.snapshot.own.gas_income = capacity;
        next
    };
    Pair { w: make(&prior.w), b: make(&prior.b) }
}

#[test]
fn prospective_whole_both_window_includes_f1_init_shared_marines_two_readouts_and_real418_batches() {
    let profile = rules();
    let owned_rules = rules();
    let tables = tables(&profile, true);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = bins(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &SharedMarineOpportunities, &mut LedgerWork::new()).unwrap();
    let initial = initial();
    let open = opened(&initial);
    let settled = settled(&open);
    let pass_w = [Candidate::new(vec![], Spend::default(), Side::White).unwrap()];
    let pass_b = [Candidate::new(vec![], Spend::default(), Side::Black).unwrap()];
    let mut work = LedgerWork::new();
    let mut pair = EconomicBeliefPair::initialize(owned_rules, &model, &initial, &mut work).unwrap();
    pair.advance(&open, &mut work).unwrap();
    pair.advance(&settled, &mut work).expect("prospective admission: functional HIGH remains open until native verification");
    for side in [Side::White, Side::Black] {
        assert_eq!(pair.state(side).unwrap().frame().view.own.gas, 0);
        assert_eq!(pair.state(side).unwrap().stamp().turn, 1);
        let readout = pair.readout(side, &mut work).unwrap();
        assert_eq!(readout.side, side);
        assert_eq!(readout.stamp, pair.state(side).unwrap().stamp());
    }
    let white = pair.encode_feature_batch(Side::White, &pass_w, &mut work).unwrap();
    let black = pair.encode_feature_batch(Side::Black, &pass_b, &mut work).unwrap();
    assert_eq!((white.len(), black.len()), (1, 1));
    assert!(white[0].iter().chain(&black[0]).all(|value| value.is_finite()));
    assert!(work.used() <= LEDGER_WORK_LIMIT);
    assert!(!pair.is_revoked());
}

#[test]
fn charged_replay_and_boundary_readout_cache_do_not_fold_or_mutate_posterior() {
    let profile = rules();
    let tables = tables(&profile, false);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = bins(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &SharedMarineOpportunities, &mut LedgerWork::new()).unwrap();
    let initial = initial();
    let mut work = LedgerWork::new();
    let mut pair = EconomicBeliefPair::initialize(rules(), &model, &initial, &mut work).unwrap();
    let pointer = pair.state(Side::White).unwrap().components().components().as_ptr();
    let before = work.used();
    assert_eq!(pair.advance(&initial, &mut work).unwrap(), AdvanceDisposition::Replayed);
    assert!(work.used() > before);
    let first = pair.readout(Side::White, &mut work).unwrap();
    let before = work.used();
    let second = pair.readout(Side::White, &mut work).unwrap();
    assert_eq!(first, second);
    assert_eq!(work.used() - before, 32 + 128 + 8 * 21);
    assert_eq!(pair.state(Side::White).unwrap().components().components().as_ptr(), pointer);
}

#[test]
fn surviving_recipient_terminal_begin_uses_both_f1_boundaries_after_both_settled_gas_zero() {
    for lost in [Side::White, Side::Black] {
        let profile = rules();
        let tables = tables(&profile, false);
        let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
        let bins = bins(&temperature);
        let model = NumericalBeliefModel::new(&profile, &tables, &bins, &SharedMarineOpportunities, &mut LedgerWork::new()).unwrap();
        let initial = initial();
        let open = opened(&initial);
        let settled = settled(&open);
        let mut terminal = opened(&settled);
        for side in [Side::White, Side::Black] {
            terminal.get_mut(side).turn += 1;
            terminal.get_mut(side).snapshot.turn += 1;
        }
        let before = OwnGeometry::from_snapshot(&settled.get(lost).snapshot, &mut LedgerWork::new()).unwrap();
        let mut after = before.clone();
        after.cc_lives = 0;
        let lost_boundary = terminal.get_mut(lost);
        lost_boundary.snapshot.own.cc_lives = 0;
        lost_boundary.seq_through += 1;
        lost_boundary.groups.push(AtomicGroup::Effects { seq: lost_boundary.seq_through, before_own: before,
            after_own: after, facts: vec![EffectFact::CcLivesChanged { before: 3, after: 0 }] });
        let mut work = LedgerWork::new();
        let mut pair = EconomicBeliefPair::initialize(rules(), &model, &initial, &mut work).unwrap();
        pair.advance(&open, &mut work).unwrap();
        pair.advance(&settled, &mut work).unwrap();
        for side in [Side::White, Side::Black] { assert_eq!(pair.state(side).unwrap().frame().view.own.gas, 0); }
        pair.advance(&terminal, &mut work).unwrap();
        assert_eq!(pair.state(lost.other()).unwrap().frame().view.own.cc_lives, 3);
        for side in [Side::White, Side::Black] {
            let state = pair.state(side).unwrap();
            assert_eq!(state.stamp().turn, 2);
            assert_eq!(state.stamp().grant_ordinal, 1);
            assert!(state.frame().innovation.grant.is_none());
            assert_eq!(state.frame().view.own.gas, 1);
        }
        assert!(!pair.is_revoked());
    }
}

// Banded zero-run copy parity and independent full-lattice invoices.
mod zero_run_readouts {
    use super::*;
    use training_native::banded_joint::{NumericBandedJoint, readout_banded_runs_copy};
    use training_native::joint_math::{NumericReadout, readout_sparse_runs_copy};

    fn bits(readout: &NumericReadout) -> [u64; 12] {
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

    fn snapshot(banded: &NumericBandedJoint) -> (Vec<bool>, Vec<(u8, u8, u64, Vec<u64>)>) {
        (banded.support().cells().to_vec(), banded.components().iter().map(|component| (
            component.bank(), component.band(), component.mass().to_bits(),
            component.conditional().iter().map(|value| value.to_bits()).collect(),
        )).collect())
    }

    fn oracle(
        cells: &[SparseCell], support: &[bool], own: u16, temperature: f64,
    ) -> Result<(NumericReadout, u64, u64), JointMathError> {
        fn add(sum: &mut f64, compensation: &mut f64, term: f64) {
            let adjusted = term - *compensation;
            let next = *sum + adjusted;
            let recovered = next - *sum;
            *compensation = recovered - adjusted;
            *sum = next;
        }
        fn quantiles(values: &[f64]) -> [u16; 4] {
            [0.05, 0.95, 0.025, 0.975].map(|threshold| {
                let mut total = 0.0;
                let mut first = None;
                for (target, value) in values.iter().enumerate() {
                    total += *value;
                    if first.is_none() && total >= threshold { first = Some(target as u16); }
                }
                assert!((total - 1.0).abs() <= 1e-12);
                first.unwrap()
            })
        }
        let mut values: Vec<_> = cells.iter().map(|cell| cell.probability.ln() / temperature).collect();
        let maximum = values.iter().copied().fold(f64::NEG_INFINITY,
            |old, value| if old > value { old } else { value });
        let mut denominator = 0.0;
        for value in &mut values {
            *value = (*value - maximum).exp();
            if *value == 0.0 { return Err(JointMathError::Underflow); }
            denominator += *value;
        }
        let mut normalized = 0.0;
        for value in &mut values {
            *value /= denominator;
            if *value == 0.0 { return Err(JointMathError::Underflow); }
            normalized += *value;
        }
        assert!((normalized - 1.0).abs() <= 1e-12);
        let mut marginal_d = vec![0.0; 577];
        let mut marginal_p = vec![0.0; 589];
        let mut mean_d = 0.0;
        let mut mean_p = 0.0;
        let mut comp_d = 0.0;
        let mut comp_p = 0.0;
        let mut cursor = 0;
        let mut runs = 0;
        let mut visits = 0;
        let mut in_run = false;
        let mut fixed = false;
        let mut full_visits = 0;
        for lane in 0..7501 {
            let d = lane % 577;
            let p = d + lane / 577;
            if cells.get(cursor).is_some_and(|cell| usize::from(cell.bank) * 577 + usize::from(cell.material) == lane) {
                let probability = values[cursor];
                marginal_d[d] += probability;
                marginal_p[p] += probability;
                add(&mut mean_d, &mut comp_d, d as f64 * probability);
                add(&mut mean_p, &mut comp_p, p as f64 * probability);
                cursor += 1;
                in_run = false;
            } else {
                if !in_run { runs += 1; in_run = true; fixed = false; }
                let before = [mean_d, comp_d, mean_p, comp_p].map(f64::to_bits);
                add(&mut mean_d, &mut comp_d, 0.0);
                add(&mut mean_p, &mut comp_p, 0.0);
                let after = [mean_d, comp_d, mean_p, comp_p].map(f64::to_bits);
                if !fixed { visits += 1; fixed = before == after; }
            }
            full_visits += 1;
        }
        assert_eq!((full_visits, cursor), (7501, cells.len()));
        assert!(runs <= cells.len() as u64 + 1);
        assert!(visits <= (7501 - cells.len()) as u64);
        let quantiles_d = quantiles(&marginal_d);
        let quantiles_potential = quantiles(&marginal_p);
        let mut materials = BTreeSet::new();
        let mut potentials = BTreeSet::new();
        for (lane, present) in support.iter().enumerate() {
            if *present {
                materials.insert((lane % 577) as u16);
                potentials.insert((lane % 577 + lane / 577) as u16);
            }
        }
        if materials.len() == 1 {
            let target = *materials.first().unwrap();
            assert_eq!(quantiles_d, [target; 4]);
            mean_d = f64::from(target);
        }
        if potentials.len() == 1 {
            let target = *potentials.first().unwrap();
            assert_eq!(quantiles_potential, [target; 4]);
            mean_p = f64::from(target);
        }
        Ok((NumericReadout {
            mean_d, mean_potential: mean_p, quantiles_d, quantiles_potential,
            balance: f64::from(own) - mean_d,
            uncertainty: f64::from(quantiles_d[3] - quantiles_d[2]) / 2.0,
        }, runs, visits))
    }

    #[test]
    fn typed_banded_runs_match_old_copy_all_bits_and_price_only_executed_zero_transitions() {
        let priors = [
            posterior(&[(0, 0, 1.0)], &[(12, 576)]),
            posterior(&[(12, 576, 1.0)], &[]),
            posterior(&[(0, 1, 0.125), (0, 2, 0.25), (8, 111, 0.125), (12, 575, 0.5)], &[(3, 7)]),
            posterior(&[(0, 4, 0.25), (12, 4, 0.75)], &[(6, 4)]),
            posterior(&[(0, 4, 0.25), (4, 0, 0.75)], &[(2, 2)]),
            posterior(&[(0, 0, f64::from_bits(1)), (1, 4, 1.0)], &[]),
        ];
        for prior in &priors {
            let banded = prior.banded();
            let before = snapshot(banded);
            let support_pointer = banded.support().cells().as_ptr();
            let component_pointer = banded.components().as_ptr();
            let cells = sparse_probabilities(banded, &mut LedgerWork::new()).unwrap();
            let positives = cells.len() as u64;
            let components = banded.components().len() as u64;
            let width: u64 = banded.components().iter().map(|component| component.conditional().len() as u64).sum();
            for temperature_index in [0, 1, 249, 250, 251, 499, 500, 501, 749, 750, 751, 999, 1000] {
                let temperature = ReadoutTemperature::from_index(temperature_index, &mut LedgerWork::new()).unwrap();
                let expected = oracle(&cells, banded.support().cells(), 19, temperature.value());
                let mut old_work = LedgerWork::new();
                let old = readout_banded_copy(banded, 19, &temperature, &mut old_work);
                match expected {
                    Err(error) => {
                        assert_eq!(error, JointMathError::Underflow);
                        assert_eq!(old.unwrap_err(), BandError::Underflow);
                        let mut work = LedgerWork::new();
                        assert_eq!(readout_banded_runs_copy(banded, 19, &temperature, &mut work).unwrap_err(), BandError::Underflow);
                        assert_eq!(work.used(), old_work.used());
                    }
                    Ok((expected, runs, visits)) => {
                        let old = old.unwrap();
                        let extraction = 320 + 64 * components + 32 * width + 12 * positives;
                        let sparse_invoice = 42984 + 180 * positives + 32 * runs + 40 * visits;
                        let invoice = 43304 + 192 * positives + 64 * components + 32 * width + 32 * runs + 40 * visits;
                        assert_eq!(invoice, extraction + sparse_invoice);
                        assert_eq!(old_work.used(), 223312 + 152 * positives + 64 * components + 32 * width);
                        let mut exact = LedgerWork::with_limit(29 + invoice).unwrap();
                        exact.charge(29).unwrap();
                        let actual = readout_banded_runs_copy(banded, 19, &temperature, &mut exact).unwrap();
                        assert_eq!(bits(&actual), bits(&expected));
                        assert_eq!(bits(&actual), bits(&old));
                        assert_eq!(actual.quantiles_d, expected.quantiles_d);
                        assert_eq!(actual.quantiles_potential, expected.quantiles_potential);
                        assert_eq!(exact.used(), 29 + invoice);
                        let mut sparse_work = LedgerWork::with_limit(sparse_invoice).unwrap();
                        let sparse = readout_sparse_runs_copy(&cells, banded.support(), 19, &temperature, &mut sparse_work).unwrap();
                        assert_eq!(bits(&sparse), bits(&actual));
                        assert_eq!(sparse_work.used(), sparse_invoice);
                        let mut short = LedgerWork::with_limit(29 + invoice - 1).unwrap();
                        short.charge(29).unwrap();
                        assert!(matches!(readout_banded_runs_copy(banded, 19, &temperature, &mut short),
                            Err(BandError::Work(ref error)) if error.code == LedgerErrorCode::Budget));
                        assert_eq!(short.used(), 29 + invoice - 64);
                    }
                }
                assert_eq!(snapshot(banded), before);
                assert_eq!(banded.support().cells().as_ptr(), support_pointer);
                assert_eq!(banded.components().as_ptr(), component_pointer);
            }
        }
    }

    #[test]
    fn typed_banded_runs_keep_full_boolean_support_and_zero_pmf_certainty_distinct() {
        let runs: Vec<_> = (0..=12).map(|bank| SupportRun { bank, lower: 0, upper: 576 }).collect();
        let prior = CompactPosterior::from_sparse(&[SparseCell { bank: 0, material: 4, probability: 1.0 }],
            &runs, &mut LedgerWork::new()).unwrap();
        let before = snapshot(prior.banded());
        for temperature_index in [0, 500, 1000] {
            let temperature = ReadoutTemperature::from_index(temperature_index, &mut LedgerWork::new()).unwrap();
            let actual = readout_banded_runs_copy(prior.banded(), 4, &temperature, &mut LedgerWork::new()).unwrap();
            let old = readout_banded_copy(prior.banded(), 4, &temperature, &mut LedgerWork::new()).unwrap();
            assert_eq!(bits(&actual), bits(&old));
            assert_eq!(snapshot(prior.banded()), before);
            assert_eq!(prior.support_runs().cell_count(), 7501);
            assert_eq!(prior.banded().support().certainty().material, None);
            assert_eq!(prior.banded().support().certainty().potential, None);
        }
    }
}

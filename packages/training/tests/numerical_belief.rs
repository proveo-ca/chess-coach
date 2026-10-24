// SPEC: _spec/packages/training/belief-integration.puml
use serde::Deserialize;
use training_native::accounting_kernel::{AccountingPoint, JOINT_SIZE, NumericGrant};
use training_native::banded_joint::{BandError, expand_joint, normalize_weighted, reband_joint};
use training_native::contracts::{ObservedPiece, OwnInventory, OwnPiece, ViewVersion, all_squares};
use training_native::evidence_tables::{InnovationCode, NumericEconomicFitGroup, NumericEconomicFitRow,
    NumericEconomicTables, build_numeric_economic_tables, weight_evidence};
use training_native::feature_input::{AdvanceDisposition, FeatureInput, FeatureInputPair};
use training_native::joint_accounting::{NumericAccountingStep, aggregate_accounting};
use training_native::joint_math::{NumericJoint, NumericSupport, ReadoutTemperature,
    normalize_aggregate, readout_copy};
use training_native::ledger::{LEDGER_WORK_LIMIT, LedgerWork};
use training_native::ledger::contracts::*;
use training_native::numerical_belief::*;
use training_native::transition_tables::{NumericFitRow, NumericOutcome, NumericSourceContext};

struct ScriptedMarine;

impl MarineOpportunityProvider for ScriptedMarine {
    fn visit(
        &self, source: Square, enemy: Side, diagonal: u64, options: MarineOptions,
        work: &mut LedgerWork,
        emit: &mut dyn FnMut(MarineOutcome, &mut LedgerWork) -> BeliefResult<()>,
    ) -> BeliefResult<()> {
        work.charge(32)?;
        assert_eq!(source, sq("c7"));
        assert_eq!(enemy, Side::Black);
        assert_eq!(diagonal, 0);
        assert_eq!(options, MarineOptions { gas: 1, classical: true, specials: true, before: true });
        emit(MarineOutcome { destination: sq("c6"), promotion: None }, work)
    }
}

fn rules() -> LedgerRules {
    #[derive(Deserialize)]
    struct RulesOnly { rules: LedgerRules }
    serde_json::from_str::<RulesOnly>(include_str!("fixtures/ledger-boundaries.json")).unwrap().rules
}

fn tables(profile: &LedgerRules) -> NumericEconomicTables {
    let mut work = LedgerWork::new();
    let code = InnovationCode::from_bins([0, 0, 1], &mut work).unwrap();
    let row = NumericEconomicFitRow {
        transition: NumericFitRow {
            node_index: 0, source: AccountingPoint { material: 4, bank: 3 },
            input_turn: 0, visible_before: 4, marines_before: 4,
            outcome: NumericOutcome { spend: 0, created: 0, wasted: 0, growth: 0, destroyed: 0 },
        },
        destination: AccountingPoint { material: 4, bank: 4 },
        boundary_turn: 1, innovation: code,
    };
    let rows = [row];
    let groups = [NumericEconomicFitGroup { slot: 0, selected_rows: &rows }];
    build_numeric_economic_tables(profile, 3, &groups, &mut work).unwrap()
}

fn sq(value: &str) -> Square { Square::parse(value).unwrap() }

fn view(side: Side, turn: u32, bank: u32) -> AuthorizedView {
    let cc = sq(if side == Side::White { "e1" } else { "e8" });
    let mut cells: Vec<_> = all_squares().into_iter().map(|square| ObservedCell::Unknown { square }).collect();
    cells[cc.index()] = ObservedCell::Lit { square: cc, piece: Some(ObservedPiece { color: side, kind: UnitType::King }) };
    let capacity = rules().gas_capacity_at(turn).unwrap();
    AuthorizedView {
        version: ViewVersion::V2, side, turn,
        own: OwnInventory { minerals: bank, gas: capacity, gas_income: capacity, cc_lives: 3,
            pieces: vec![OwnPiece { square: cc, kind: UnitType::King }], mines: vec![], sieged_tanks: vec![] },
        cells,
    }
}

fn initial(turn: u32, bank: u32) -> Pair<EconomicBoundary> {
    let boundary = |side| EconomicBoundary {
        version: BoundaryVersion::V1, side, ordinal: 0, phase: BoundaryPhase::Initial,
        turn, planning_ordinal: 0, grant_ordinal: 0, seq_before: 0, seq_through: 0,
        groups: vec![], snapshot: view(side, turn, bank),
    };
    Pair { w: boundary(Side::White), b: boundary(Side::Black) }
}

fn opened(prior: &Pair<EconomicBoundary>) -> Pair<EconomicBoundary> {
    let boundary = |before: &EconomicBoundary| {
        let mut next = before.clone();
        next.ordinal += 1;
        next.phase = BoundaryPhase::TurnOpen;
        next.seq_before = before.seq_through;
        next.groups.clear();
        next.snapshot.own.gas = next.snapshot.own.gas_income;
        next
    };
    Pair { w: boundary(&prior.w), b: boundary(&prior.b) }
}

fn settled(prior: &Pair<EconomicBoundary>) -> Pair<EconomicBoundary> {
    let profile = rules();
    let boundary = |before: &EconomicBoundary| {
        let mut next = before.clone();
        next.ordinal += 1;
        next.phase = BoundaryPhase::Settled;
        next.turn += 1;
        next.planning_ordinal += 1;
        next.grant_ordinal += 1;
        next.seq_before = before.seq_through;
        next.seq_through += 1;
        let entitlement = profile.income_at(next.turn).unwrap();
        let credited = entitlement.min(12 - before.snapshot.own.minerals);
        let capacity = profile.gas_capacity_at(next.turn).unwrap();
        next.groups = vec![AtomicGroup::Settlement { seq: next.seq_through, entitlement, credited,
            gas_before_reset: before.snapshot.own.gas, next_gas_capacity: capacity }];
        next.snapshot.turn = next.turn;
        next.snapshot.own.minerals += credited;
        next.snapshot.own.gas = 0;
        next.snapshot.own.gas_income = capacity;
        next
    };
    Pair { w: boundary(&prior.w), b: boundary(&prior.b) }
}

fn observe(boundary: &mut EconomicBoundary, cell: ObservedCell) {
    boundary.seq_through += 1;
    boundary.snapshot.cells[cell.square().index()] = cell.clone();
    boundary.groups.push(AtomicGroup::Vision { seq: boundary.seq_through, turn: boundary.turn, changes: vec![cell] });
}

fn input_pair(initial: &Pair<EconomicBoundary>) -> FeatureInputPair {
    FeatureInputPair::initialize(rules(), initial, &mut LedgerWork::new()).unwrap()
}

fn input(inputs: &FeatureInputPair, side: Side) -> FeatureInput {
    inputs.input(side, &mut LedgerWork::new()).unwrap()
}

fn calibration(temperature: &ReadoutTemperature) -> [CalibrationBin<'_>; 1] {
    [CalibrationBin { turn_low: 0, turn_high: 45, lit_low: 0, lit_high: 64, temperature }]
}

fn dense(points: &[(usize, usize, f64)], extra: &[(usize, usize)]) -> NumericJoint {
    let mut masses = vec![0.0; JOINT_SIZE];
    let mut cells = vec![false; JOINT_SIZE];
    for &(material, bank, mass) in points {
        masses[577 * bank + material] = mass;
        cells[577 * bank + material] = true;
    }
    for &(material, bank) in extra { cells[577 * bank + material] = true; }
    let mut work = LedgerWork::new();
    let support = NumericSupport::from_cells(&cells, &mut work).unwrap();
    normalize_aggregate(&masses, &support, &mut work).unwrap()
}

fn snapshot(state: &BeliefState) -> Vec<(u8, u8, u64, Vec<u64>)> {
    state.components().components().iter().map(|component| (
        component.bank(), component.band(), component.mass().to_bits(),
        component.conditional().iter().map(|value| value.to_bits()).collect(),
    )).collect()
}

#[test]
fn opening_is_d4_b3_and_not_fresh_bank_seven() {
    let profile = rules();
    let tables = tables(&profile);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = calibration(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &ScriptedMarine, &mut LedgerWork::new()).unwrap();
    let inputs = input_pair(&initial(0, 3));
    let state = initialize_belief(input(&inputs, Side::White), &model, &mut LedgerWork::new()).unwrap();
    let support = state.public_support();
    assert_eq!(support.cells().iter().filter(|cell| **cell).count(), 1);
    assert!(support.cells()[1735]);
    assert!(!support.cells()[577 * 7 + 4]);
    assert_eq!(support.certainty().material, Some(4));
    assert_eq!(support.certainty().potential, Some(7));
    assert_eq!(snapshot(&state), vec![(3, 4, 1.0_f64.to_bits(), vec![1.0_f64.to_bits(), 0.0_f64.to_bits()])]);
    assert_eq!(state.spatial().enemy_cc, 1_u64 << sq("e8").index());
    assert_eq!(state.spatial().unlocated, ["c7", "d7", "e7", "f7"].iter().fold(0, |bits, square| bits | (1_u64 << sq(square).index())));
    let black = initialize_belief(input(&inputs, Side::Black), &model, &mut LedgerWork::new()).unwrap();
    assert_eq!(black.spatial().enemy_cc, 1_u64 << sq("e1").index());
    assert_eq!(black.spatial().unlocated, ["c2", "d2", "e2", "f2"].iter().fold(0, |bits, square| bits | (1_u64 << sq(square).index())));
    assert!(black.public_support().cells()[1735]);
}

#[test]
fn opening_requires_turn_zero_and_bounds_that_contain_four() {
    let profile = rules();
    let tables = tables(&profile);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = calibration(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &ScriptedMarine, &mut LedgerWork::new()).unwrap();
    let inputs = input_pair(&initial(10, 3));
    assert_eq!(initialize_belief(input(&inputs, Side::White), &model, &mut LedgerWork::new()).unwrap_err(), BeliefError::Sequence);
    let mut initial = initial(0, 3);
    initial.w.snapshot.cells[sq("a5").index()] = ObservedCell::Revealed { square: sq("a5"),
        piece: ObservedPiece { color: Side::Black, kind: UnitType::Queen } };
    let inputs = input_pair(&initial);
    assert_eq!(initialize_belief(input(&inputs, Side::White), &model, &mut LedgerWork::new()).unwrap_err(), BeliefError::SpatialConsistency);
}

#[test]
fn board_bounds_reserve_one_unknown_for_unobserved_cc_and_exclude_cc_cost() {
    let profile = rules();
    let mut frame = input(&input_pair(&initial(0, 3)), Side::White);
    assert_eq!(board_bounds(&frame, &profile, &mut LedgerWork::new()).unwrap(),
        BoardBounds { lower: 0, upper: 558, marines: 0 });
    let cc = sq("e8");
    frame.view.cells[cc.index()] = ObservedCell::Revealed { square: cc,
        piece: ObservedPiece { color: Side::Black, kind: UnitType::King } };
    assert_eq!(board_bounds(&frame, &profile, &mut LedgerWork::new()).unwrap(),
        BoardBounds { lower: 0, upper: 558, marines: 0 });
    let marine = sq("c7");
    frame.view.cells[marine.index()] = ObservedCell::Revealed { square: marine,
        piece: ObservedPiece { color: Side::Black, kind: UnitType::Pawn } };
    assert_eq!(board_bounds(&frame, &profile, &mut LedgerWork::new()).unwrap(),
        BoardBounds { lower: 1, upper: 550, marines: 1 });
    for cell in &mut frame.view.cells {
        *cell = ObservedCell::Lit { square: cell.square(), piece: None };
    }
    assert_eq!(board_bounds(&frame, &profile, &mut LedgerWork::new()).unwrap_err(), BeliefError::SpatialConsistency);
}

#[test]
fn turn_open_fast_path_moves_untempered_components_without_accounting_or_grant() {
    let profile = rules();
    let tables = tables(&profile);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = calibration(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &ScriptedMarine, &mut LedgerWork::new()).unwrap();
    let initial = initial(0, 3);
    let mut inputs = input_pair(&initial);
    let mut pair = EconomicBeliefPair::initialize(rules(), &model, &initial, &mut LedgerWork::new()).unwrap();
    let state = pair.state(Side::White).unwrap();
    let pointer = state.components().components().as_ptr();
    let mask = state.public_support().cells().as_ptr();
    inputs.advance(&opened(&initial), &mut LedgerWork::new()).unwrap();
    let frame = input(&inputs, Side::White);
    assert!(frame.innovation.grant.is_none());
    let mut work = LedgerWork::new();
    pair.advance(&opened(&initial), &mut work).unwrap();
    let state = pair.state(Side::White).unwrap();
    assert_eq!(state.components().components().as_ptr(), pointer);
    assert_eq!(state.public_support().cells().as_ptr(), mask);
    assert!(state.public_support().cells()[1735]);
    assert_eq!(state.stamp().turn, 0);
}

#[test]
fn nonsettled_innovation_weights_stationary_support_instead_of_running_accounting() {
    let profile = rules();
    let tables = tables(&profile);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = calibration(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &ScriptedMarine, &mut LedgerWork::new()).unwrap();
    let mut initial = initial(0, 3);
    let square = sq("c7");
    initial.w.snapshot.cells[square.index()] = ObservedCell::Revealed { square,
        piece: ObservedPiece { color: Side::Black, kind: UnitType::Pawn } };
    let mut inputs = input_pair(&initial);
    let mut pair = EconomicBeliefPair::initialize(rules(), &model, &initial, &mut LedgerWork::new()).unwrap();
    let state = pair.state(Side::White).unwrap();
    let old_pointer = state.components().components().as_ptr();
    let mut next = opened(&initial);
    observe(&mut next.w, ObservedCell::Lit { square, piece: None });
    inputs.advance(&next, &mut LedgerWork::new()).unwrap();
    let frame = input(&inputs, Side::White);
    assert_eq!(frame.innovation.values, [0, 0, 1]);
    assert!(frame.innovation.grant.is_none());
    let mut work = LedgerWork::new();
    pair.advance(&next, &mut work).unwrap();
    let state = pair.state(Side::White).unwrap();
    assert!(work.used() > 30_000);
    assert_ne!(state.components().components().as_ptr(), old_pointer);
    assert_eq!(state.public_support().cells().iter().filter(|cell| **cell).count(), 1);
    assert!(state.public_support().cells()[1735]);
    assert_eq!(state.spatial().witnessed & (1_u64 << square.index()), 0);
}

#[test]
fn zero_innovation_with_changed_bounds_does_not_take_fast_path() {
    let profile = rules();
    let tables = tables(&profile);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = calibration(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &ScriptedMarine, &mut LedgerWork::new()).unwrap();
    let mut initial = initial(0, 3);
    let square = sq("a5");
    initial.w.snapshot.cells[square.index()] = ObservedCell::Revealed { square,
        piece: ObservedPiece { color: Side::Black, kind: UnitType::Pawn } };
    let mut inputs = input_pair(&initial);
    let mut pair = EconomicBeliefPair::initialize(rules(), &model, &initial, &mut LedgerWork::new()).unwrap();
    let state = pair.state(Side::White).unwrap();
    let pointer = state.components().components().as_ptr();
    let before = board_bounds(state.frame(), &profile, &mut LedgerWork::new()).unwrap();
    let mut next = opened(&initial);
    observe(&mut next.w, ObservedCell::Unknown { square });
    inputs.advance(&next, &mut LedgerWork::new()).unwrap();
    let frame = input(&inputs, Side::White);
    assert_eq!(frame.innovation.bins, [0; 3]);
    assert_ne!(before, board_bounds(&frame, &profile, &mut LedgerWork::new()).unwrap());
    let mut work = LedgerWork::new();
    pair.advance(&next, &mut work).unwrap();
    let state = pair.state(Side::White).unwrap();
    assert_ne!(state.components().components().as_ptr(), pointer);
    assert!(state.public_support().cells()[1735]);
}

#[test]
fn changed_innovation_with_identical_bounds_does_not_take_fast_path() {
    let profile = rules();
    let tables = tables(&profile);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = calibration(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &ScriptedMarine, &mut LedgerWork::new()).unwrap();
    let mut initial = initial(0, 3);
    let a = sq("a5");
    initial.w.snapshot.cells[a.index()] = ObservedCell::Revealed { square: a,
        piece: ObservedPiece { color: Side::Black, kind: UnitType::Pawn } };
    let mut inputs = input_pair(&initial);
    let mut pair = EconomicBeliefPair::initialize(rules(), &model, &initial, &mut LedgerWork::new()).unwrap();
    let state = pair.state(Side::White).unwrap();
    let pointer = state.components().components().as_ptr();
    let before = board_bounds(state.frame(), &profile, &mut LedgerWork::new()).unwrap();
    let mut next = opened(&initial);
    observe(&mut next.w, ObservedCell::Unknown { square: a });
    let b = sq("b5");
    observe(&mut next.w, ObservedCell::Revealed { square: b,
        piece: ObservedPiece { color: Side::Black, kind: UnitType::Pawn } });
    inputs.advance(&next, &mut LedgerWork::new()).unwrap();
    let frame = input(&inputs, Side::White);
    assert_eq!(before, board_bounds(&frame, &profile, &mut LedgerWork::new()).unwrap());
    assert_eq!(frame.innovation.bins, [1, 0, 0]);
    let mut work = LedgerWork::new();
    pair.advance(&next, &mut work).unwrap();
    let state = pair.state(Side::White).unwrap();
    assert_ne!(state.components().components().as_ptr(), pointer);
    assert_ne!(state.spatial().witnessed & (1_u64 << b.index()), 0);
}

#[test]
fn impossible_nonsettled_bound_refuses_instead_of_preserving_old_singleton() {
    let profile = rules();
    let tables = tables(&profile);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = calibration(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &ScriptedMarine, &mut LedgerWork::new()).unwrap();
    let initial = initial(0, 3);
    let mut pair = EconomicBeliefPair::initialize(rules(), &model, &initial, &mut LedgerWork::new()).unwrap();
    let mut next = opened(&initial);
    observe(&mut next.w, ObservedCell::Revealed { square: sq("a5"),
        piece: ObservedPiece { color: Side::Black, kind: UnitType::Queen } });
    let error = pair.advance(&next, &mut LedgerWork::new()).unwrap_err();
    assert_eq!(error, BeliefError::Accounting(training_native::joint_accounting::JointAccountingError::EmptySupport));
    assert!(pair.is_revoked());
}

#[test]
fn readout_uses_lit_not_revealed_cells_and_leaves_posterior_untouched() {
    let profile = rules();
    let tables = tables(&profile);
    let cold = ReadoutTemperature::from_index(0, &mut LedgerWork::new()).unwrap();
    let hot = ReadoutTemperature::from_index(1000, &mut LedgerWork::new()).unwrap();
    let bins = [
        CalibrationBin { turn_low: 0, turn_high: 45, lit_low: 0, lit_high: 1, temperature: &cold },
        CalibrationBin { turn_low: 0, turn_high: 45, lit_low: 2, lit_high: 64, temperature: &hot },
    ];
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &ScriptedMarine, &mut LedgerWork::new()).unwrap();
    let mut initial = initial(0, 3);
    initial.w.snapshot.cells[sq("a5").index()] = ObservedCell::Revealed { square: sq("a5"),
        piece: ObservedPiece { color: Side::Black, kind: UnitType::Pawn } };
    let state = initialize_belief(input(&input_pair(&initial), Side::White), &model, &mut LedgerWork::new()).unwrap();
    let before = snapshot(&state);
    let mask = state.public_support().cells().to_vec();
    let readout = readout_belief(&state, &model, &mut LedgerWork::new()).unwrap();
    assert_eq!(readout.summary.mean_d, 4.0);
    assert_eq!(readout.summary.mean_potential, 7.0);
    assert_eq!(readout.summary.balance, -4.0);
    assert_eq!(readout.stamp, state.stamp());
    assert_eq!(snapshot(&state), before);
    assert_eq!(state.public_support().cells(), mask);
    let joint = dense(&[(4, 3, 0.9), (8, 3, 0.1)], &[(12, 3)]);
    let probabilities: Vec<_> = joint.probabilities().iter().map(|p| p.to_bits()).collect();
    let a = readout_copy(&joint, 0, &cold, &mut LedgerWork::new()).unwrap();
    let b = readout_copy(&joint, 0, &hot, &mut LedgerWork::new()).unwrap();
    assert!(a.mean_d < b.mean_d);
    assert_eq!(joint.probabilities().iter().map(|p| p.to_bits()).collect::<Vec<_>>(), probabilities);
    assert!(joint.support().cells()[577 * 3 + 12]);
}

#[test]
fn calibration_rejects_gap_overlap_order_and_unpaired_profile() {
    let profile = rules();
    let tables = tables(&profile);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    for intervals in [vec![(0, 44, 0, 64)], vec![(0, 45, 0, 32), (0, 45, 32, 64)],
        vec![(1, 45, 0, 64), (0, 0, 0, 64)]]
    {
        let bins: Vec<_> = intervals.into_iter().map(|(turn_low, turn_high, lit_low, lit_high)|
            CalibrationBin { turn_low, turn_high, lit_low, lit_high, temperature: &temperature }).collect();
        assert!(matches!(NumericalBeliefModel::new(&profile, &tables, &bins, &ScriptedMarine, &mut LedgerWork::new()),
            Err(BeliefError::Model(ModelError::Calibration))));
    }
    let mut other = rules();
    other.income_by_turn[0] = 2;
    let other_tables = build_numeric_economic_tables(&other, 3, &[], &mut LedgerWork::new()).unwrap();
    assert!(matches!(NumericalBeliefModel::new(&profile, &other_tables, &calibration(&temperature), &ScriptedMarine, &mut LedgerWork::new()),
        Err(BeliefError::Model(ModelError::TableProfile))));
    assert!(matches!(NumericalBeliefModel::new(&other, &tables, &calibration(&temperature), &ScriptedMarine, &mut LedgerWork::new()),
        Err(BeliefError::Model(ModelError::Rules))));
}

#[test]
fn detached_opening_raw_fields_and_invalid_stamps_are_rejected() {
    let profile = rules();
    let tables = tables(&profile);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = calibration(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &ScriptedMarine, &mut LedgerWork::new()).unwrap();
    let initial = initial(0, 3);
    let inputs = input_pair(&initial);
    for case in 0..5 {
        let mut frame = input(&inputs, Side::White);
        match case {
            0 => frame.stamp.ordinal += 1,
            1 => frame.view.turn += 1,
            2 => frame.own_units[0].kind = UnitType::Queen,
            3 => frame.stamp.planning_ordinal += 1,
            _ => frame.stamp.phase = BoundaryPhase::TurnOpen,
        }
        assert!(matches!(initialize_belief(frame, &model, &mut LedgerWork::new()),
            Err(BeliefError::Sequence | BeliefError::FrameMismatch)));
    }
}

#[test]
fn settlement_0_to_1_gas_zero_preserves_old_enemy_capacity_and_entitlement() {
    settlement_regression(0, 1, 20);
}

#[test]
fn settlement_10_to_11_gas_zero_uses_input_tier_not_endpoint_tier() {
    settlement_regression(10, 2, 20);
}

#[test]
fn settlement_20_to_21_gas_zero_uses_input_tier_not_endpoint_tier() {
    settlement_regression(20, 3, 28);
}

fn settlement_regression(turn: u32, income: u8, highest_material: usize) {
    let initial = initial(turn, 12);
    let opening = opened(&initial);
    let next = settled(&opening);
    let mut inputs = input_pair(&initial);
    inputs.advance(&opening, &mut LedgerWork::new()).unwrap();
    let before = input(&inputs, Side::White);
    assert!(before.innovation.grant.is_none());
    inputs.advance(&next, &mut LedgerWork::new()).unwrap();
    let frame = input(&inputs, Side::White);
    assert_eq!(frame.view.own.gas, 0);
    assert_eq!(frame.view.own.minerals, 12);
    let grant = frame.innovation.grant.unwrap();
    assert_eq!(grant.credited, 0);
    assert_eq!(grant.entitlement, u32::from(income));
    assert_eq!(frame.own_paid_destroyed, 0);
    assert_eq!(frame.own_paid_wasted, 0);
    assert_eq!(frame.enemy_replacement_loss_lower_bound, 0);
    let prior = dense(&[(4, 0, 1.0)], &[]);
    let profile = rules();
    let tables = tables(&profile);
    let step = NumericAccountingStep {
        context: NumericSourceContext { input_turn: before.stamp.turn, visible_before: 4, marines_before: 4 },
        grant: NumericGrant::AtNativeTurn(grant.settled_turn), witnessed_loss: frame.innovation.values[1] as u16,
        destination_lower: 0, destination_upper: 576,
    };
    let raw = aggregate_accounting(&prior, tables.transitions(), &step, &mut LedgerWork::new()).unwrap();
    let supported: Vec<_> = raw.accounting_cells().iter().enumerate().filter_map(|(index, cell)| cell.then_some(index)).collect();
    assert_eq!(supported, (0..=highest_material).map(|material| 577 * usize::from(income) + material).collect::<Vec<_>>());
    assert!(raw.masses()[577 * usize::from(income) + highest_material] > 0.0);
}

#[test]
fn paired_initialization_and_charged_replay_keep_both_states() {
    let profile = rules();
    let tables = tables(&profile);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = calibration(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &ScriptedMarine, &mut LedgerWork::new()).unwrap();
    let initial = initial(0, 3);
    let mut init_work = LedgerWork::new();
    let mut pair = EconomicBeliefPair::initialize(rules(), &model, &initial, &mut init_work).unwrap();
    assert!(init_work.used() < LEDGER_WORK_LIMIT);
    let white_mask = pair.state(Side::White).unwrap().public_support().cells().as_ptr();
    let black_mask = pair.state(Side::Black).unwrap().public_support().cells().as_ptr();
    assert_ne!(white_mask, black_mask);
    let mut work = LedgerWork::new();
    work.charge(17).unwrap();
    assert_eq!(pair.advance(&initial, &mut work).unwrap(), AdvanceDisposition::Replayed);
    assert!(work.used() > 17);
    assert_eq!(pair.state(Side::White).unwrap().public_support().cells().as_ptr(), white_mask);
    assert_eq!(pair.state(Side::Black).unwrap().public_support().cells().as_ptr(), black_mask);
    assert_eq!(pair.state(Side::White).unwrap().stamp().ordinal, 0);
    assert_eq!(pair.state(Side::Black).unwrap().stamp().ordinal, 0);
}

#[test]
fn after_f1_and_white_success_black_budget_failure_permanently_revokes_both() {
    let profile = rules();
    let tables = tables(&profile);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = calibration(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &ScriptedMarine, &mut LedgerWork::new()).unwrap();
    let initial = initial(0, 3);
    let next = opened(&initial);
    let mut control = input_pair(&initial);
    let mut prefix = LedgerWork::new();
    prefix.charge(17).unwrap();
    assert_eq!(control.advance(&next, &mut prefix).unwrap(), AdvanceDisposition::Advanced);
    let mut complete = EconomicBeliefPair::initialize(rules(), &model, &initial, &mut LedgerWork::new()).unwrap();
    let mut whole = LedgerWork::new();
    whole.charge(17).unwrap();
    complete.advance(&next, &mut whole).unwrap();
    assert_eq!(complete.state(Side::White).unwrap().stamp().ordinal, 1);
    assert_eq!((whole.used() - prefix.used() - 64) % 2, 0);
    let white_prefix = prefix.used() + (whole.used() - prefix.used() - 64) / 2;
    let mut pair = EconomicBeliefPair::initialize(rules(), &model, &initial, &mut LedgerWork::new()).unwrap();
    let mut short = LedgerWork::with_limit(white_prefix).unwrap();
    short.charge(17).unwrap();
    let error = pair.advance(&next, &mut short).unwrap_err();
    assert!(matches!(error, BeliefError::Ledger(ref error) if error.code == LedgerErrorCode::Budget));
    assert_eq!(short.used(), white_prefix);
    assert!(pair.is_revoked());
    for side in [Side::White, Side::Black] {
        assert!(matches!(pair.state(side), Err(BeliefError::Revoked)));
        assert_eq!(pair.readout(side, &mut LedgerWork::new()).unwrap_err(), BeliefError::Revoked);
    }
    assert_eq!(pair.advance(&next, &mut LedgerWork::new()).unwrap_err(), BeliefError::Revoked);
}

#[test]
fn any_f1_failure_permanently_revokes_both_recipients() {
    let profile = rules();
    let tables = tables(&profile);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = calibration(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &ScriptedMarine, &mut LedgerWork::new()).unwrap();
    let initial = initial(0, 3);
    let mut pair = EconomicBeliefPair::initialize(rules(), &model, &initial, &mut LedgerWork::new()).unwrap();
    let mut work = LedgerWork::with_limit(127).unwrap();
    assert!(matches!(pair.advance(&opened(&initial), &mut work), Err(BeliefError::Ledger(ref error)) if error.code == LedgerErrorCode::Budget));
    assert!(pair.is_revoked());
    for side in [Side::White, Side::Black] { assert!(matches!(pair.state(side), Err(BeliefError::Revoked))); }
}

#[test]
fn conflicting_f1_replay_preserves_the_typed_error_and_revokes_both() {
    let profile = rules();
    let tables = tables(&profile);
    let temperature = ReadoutTemperature::from_index(500, &mut LedgerWork::new()).unwrap();
    let bins = calibration(&temperature);
    let model = NumericalBeliefModel::new(&profile, &tables, &bins, &ScriptedMarine, &mut LedgerWork::new()).unwrap();
    let initial = initial(0, 3);
    let mut pair = EconomicBeliefPair::initialize(rules(), &model, &initial, &mut LedgerWork::new()).unwrap();
    let mut control = input_pair(&initial);
    let mut conflicting = initial.clone();
    conflicting.w.snapshot.own.minerals += 1;
    let mut expected_work = LedgerWork::new();
    let expected = control.advance(&conflicting, &mut expected_work).unwrap_err();
    let mut work = LedgerWork::new();
    let actual = pair.advance(&conflicting, &mut work).unwrap_err();
    assert_eq!(actual, BeliefError::Ledger(expected));
    assert_eq!(work.used(), expected_work.used());
    for side in [Side::White, Side::Black] { assert!(matches!(pair.state(side), Err(BeliefError::Revoked))); }
    assert!(pair.is_revoked());
}

#[test]
fn full_support_normalize_reband_expand_refuses_1129672_work_on_one_meter() {
    let profile = rules();
    let tables = build_numeric_economic_tables(&profile, 3, &[], &mut LedgerWork::new()).unwrap();
    let sources: Vec<_> = (0..13).map(|bank| (576, bank, 1.0)).collect();
    let prior = dense(&sources, &[]);
    let step = NumericAccountingStep {
        context: NumericSourceContext { input_turn: 0, visible_before: 0, marines_before: 0 },
        grant: NumericGrant::None, witnessed_loss: 0, destination_lower: 0, destination_upper: 576,
    };
    let raw = aggregate_accounting(&prior, tables.transitions(), &step, &mut LedgerWork::new()).unwrap();
    let code = InnovationCode::from_bins([0; 3], &mut LedgerWork::new()).unwrap();
    let weighted = weight_evidence(raw, &tables, 0, code, &mut LedgerWork::new()).unwrap();
    assert!(weighted.accounting_cells().iter().all(|cell| *cell));
    assert!(weighted.masses().iter().all(|mass| *mass > 0.0));
    let mut work = LedgerWork::new();
    let joint = normalize_weighted(weighted, &mut work).unwrap();
    assert_eq!(work.used(), 390340);
    let banded = reband_joint(joint, &mut work).unwrap();
    let components = banded.components().len() as u64;
    let conditionals = banded.components().iter().map(|component| component.conditional().len() as u64).sum::<u64>();
    assert_eq!((components, conditionals), (247, 7501));
    let complete_invoice = 390340 + 129332 + 248 * components + 28 * conditionals
        + 210796 + 32 * components + 16 * conditionals;
    assert_eq!(complete_invoice, 1129672);
    assert!(complete_invoice > work.limit());
    assert_eq!(work.used(), 790956);
    assert!(matches!(expand_joint(&banded, &mut work), Err(BandError::Work(ref error)) if error.code == LedgerErrorCode::Budget));
    assert_eq!(work.used(), 1009656);
    assert_eq!(work.remaining(), 38920);
    assert_eq!(banded.components().len(), 247);
    assert!(banded.support().cells().iter().all(|cell| *cell));
}

// SPEC: _spec/packages/training/belief-integration.puml
use std::cell::Cell;

use training_native::contracts::{ObservedPiece, OwnInventory, OwnPiece, Promotion, ViewVersion, all_squares};
use training_native::feature_input::{FeatureInput, FeatureInputPair};
use training_native::joint_math::{NumericSupport, normalize_aggregate};
use training_native::ledger::LedgerWork;
use training_native::ledger::contracts::*;
use training_native::numerical_belief::*;

#[derive(Debug)]
struct ScriptCall {
    source: Square,
    enemy: Side,
    diagonal: u64,
    options: MarineOptions,
    outcomes: Vec<MarineOutcome>,
}

struct FiniteScript {
    calls: Vec<ScriptCall>,
    cursor: Cell<usize>,
}

impl FiniteScript {
    fn new(calls: Vec<ScriptCall>) -> Self { Self { calls, cursor: Cell::new(0) } }
    fn complete(&self) { assert_eq!(self.cursor.get(), self.calls.len()); }
}

impl MarineOpportunityProvider for FiniteScript {
    fn visit(
        &self, source: Square, enemy: Side, diagonal: u64, options: MarineOptions,
        work: &mut LedgerWork,
        emit: &mut dyn FnMut(MarineOutcome, &mut LedgerWork) -> BeliefResult<()>,
    ) -> BeliefResult<()> {
        work.charge(32)?;
        let index = self.cursor.get();
        let call = self.calls.get(index).expect("unexpected independent scripted provider call");
        assert_eq!((source, enemy, diagonal, options), (call.source, call.enemy, call.diagonal, call.options));
        self.cursor.set(index + 1);
        for outcome in &call.outcomes {
            work.charge(16)?;
            emit(*outcome, work)?;
        }
        Ok(())
    }
}

fn sq(value: &str) -> Square { Square::parse(value).unwrap() }
fn bit(value: &str) -> u64 { 1_u64 << sq(value).index() }
fn set(values: &[&str]) -> u64 { values.iter().fold(0, |result, value| result | bit(value)) }
fn options(gas: u8) -> MarineOptions { MarineOptions { gas, classical: true, specials: true, before: true } }

fn shared_outcomes(source: &str, side: Side, geometry: u64, configuration: MarineOptions) -> Vec<MarineOutcome> {
    let mut result = Vec::new();
    SharedMarineOpportunities.visit(sq(source), side, geometry, configuration,
        &mut LedgerWork::new(), &mut |outcome, work| {
            work.charge(16)?;
            result.push(outcome);
            Ok(())
        }).unwrap();
    result
}

#[test]
fn concrete_shared_provider_preserves_gas_zero_and_original_double_geometry() {
    for (source, side, zero, special) in [
        ("e2", Side::White, vec!["e2", "e3", "e4"], vec!["e2", "e3", "e4", "e5"]),
        ("e7", Side::Black, vec!["e5", "e6", "e7"], vec!["e4", "e5", "e6", "e7"]),
    ] {
        let actual = shared_outcomes(source, side, 0, options(0));
        let mut destinations: Vec<_> = actual.iter().map(|x| x.destination).collect();
        destinations.sort(); destinations.dedup();
        let mut expected: Vec<_> = zero.iter().map(|x| sq(x)).collect(); expected.sort();
        assert_eq!(destinations, expected);
        let actual = shared_outcomes(source, side, 0, options(1));
        let mut destinations: Vec<_> = actual.iter().map(|x| x.destination).collect();
        destinations.sort(); destinations.dedup();
        let mut expected: Vec<_> = special.iter().map(|x| sq(x)).collect(); expected.sort();
        assert_eq!(destinations, expected);
        assert_eq!(actual, shared_outcomes(source, side, 0, options(3)));
    }
}

#[test]
fn shared_provider_checks_ignored_authored_diagonal_and_preserves_emission_multiplicity() {
    for (source, side, target, arrival) in [("e7", Side::White, "d8", "e8"), ("e2", Side::Black, "d1", "e1")] {
        let without = shared_outcomes(source, side, 0, options(1));
        let with = shared_outcomes(source, side, bit(target), options(1));
        let count = |values: &[MarineOutcome]| values.iter().filter(|x| x.destination == sq(arrival)
            && x.promotion == Some(Promotion::Knight)).count();
        assert_eq!(count(&with), count(&without) + 1);
        let no_classical = MarineOptions { classical: false, ..options(1) };
        assert_eq!(shared_outcomes(source, side, 0, no_classical),
            shared_outcomes(source, side, bit(target), no_classical));
    }
}

#[test]
fn shared_provider_restrictions_filter_authored_actions_without_changing_stay() {
    let stay = MarineOptions { classical: false, specials: false, before: false, gas: 3 };
    assert_eq!(shared_outcomes("e4", Side::White, u64::MAX, stay),
        vec![MarineOutcome { destination: sq("e4"), promotion: None }]);
    let after_only = MarineOptions { classical: false, specials: true, before: false, gas: 1 };
    assert_eq!(shared_outcomes("e4", Side::White, 0, after_only), vec![
        MarineOutcome { destination: sq("e4"), promotion: None },
        MarineOutcome { destination: sq("e5"), promotion: None },
    ]);
    let none = MarineOptions { specials: false, ..options(3) };
    assert_eq!(shared_outcomes("e2", Side::White, u64::MAX, none),
        shared_outcomes("e2", Side::White, u64::MAX, options(0)));
}

fn call(source: &str, destination: &str, options: MarineOptions, diagonal: u64) -> ScriptCall {
    ScriptCall { source: sq(source), enemy: Side::Black, diagonal, options,
        outcomes: vec![MarineOutcome { destination: sq(destination), promotion: None }] }
}

fn promoting_call(source: &str, options: MarineOptions) -> ScriptCall {
    ScriptCall { source: sq(source), enemy: Side::Black, diagonal: 0, options,
        outcomes: vec![MarineOutcome { destination: sq("h1"), promotion: Some(Promotion::Queen) }] }
}

fn rules() -> LedgerRules {
    #[derive(serde::Deserialize)]
    struct RulesOnly { rules: LedgerRules }
    serde_json::from_str::<RulesOnly>(include_str!("fixtures/ledger-boundaries.json")).unwrap().rules
}

fn scripted_frame(phase: BoundaryPhase) -> FeatureInput {
    let boundary = |side: Side| {
        let cc = sq(if side == Side::White { "e1" } else { "e8" });
        let mut cells: Vec<_> = all_squares().into_iter().map(|square| ObservedCell::Unknown { square }).collect();
        cells[cc.index()] = ObservedCell::Lit { square: cc, piece: Some(ObservedPiece { color: side, kind: UnitType::King }) };
        EconomicBoundary {
            version: BoundaryVersion::V1, side, ordinal: 0, phase: BoundaryPhase::Initial,
            turn: 0, planning_ordinal: 0, grant_ordinal: 0, seq_before: 0, seq_through: 0, groups: vec![],
            snapshot: AuthorizedView { version: ViewVersion::V2, side, turn: 0,
                own: OwnInventory { minerals: 3, gas: 1, gas_income: 1, cc_lives: 3,
                    pieces: vec![OwnPiece { square: cc, kind: UnitType::King }], mines: vec![], sieged_tanks: vec![] },
                cells },
        }
    };
    let initial = Pair { w: boundary(Side::White), b: boundary(Side::Black) };
    let inputs = FeatureInputPair::initialize(rules(), &initial, &mut LedgerWork::new()).unwrap();
    let mut frame = inputs.input(Side::White, &mut LedgerWork::new()).unwrap();
    frame.stamp.phase = phase;
    frame
}

fn prior(witnessed: u64, unlocated: u64) -> SpatialState {
    SpatialState { enemy_cc: bit("e8"), witnessed, unlocated }
}

fn empty(square: &str) -> ObservedCell { ObservedCell::Lit { square: sq(square), piece: None } }
fn revealed(square: &str, kind: UnitType) -> ObservedCell {
    ObservedCell::Revealed { square: sq(square), piece: ObservedPiece { color: Side::Black, kind } }
}
fn put(frame: &mut FeatureInput, cell: ObservedCell) { frame.view.cells[cell.square().index()] = cell; }

const RAW_CC: &[&str] = &["d7", "d8", "e7", "e8", "f7", "f8"];
const BEFORE_BIRTHS: &[&str] = &["d7", "d8", "e7", "f7", "f8"];
const AFTER_BIRTHS: &[&str] = &["c6", "c7", "c8", "d6", "d7", "d8", "e6", "e7", "e8", "f6", "f7", "f8", "g6", "g7", "g8"];

#[test]
fn independent_script_keeps_witnessed_unlocated_and_anchor_routes_separate() {
    let mut frame = scripted_frame(BoundaryPhase::Settled);
    frame.innovation.marine_anchors[sq("f7").index()] = true;
    frame.innovation.own_geometry[sq("a4").index()] = true;
    let diagonal = bit("a4");
    let script = FiniteScript::new(vec![
        call("c7", "c6", options(2), diagonal),
        call("d7", "d6", options(2), diagonal),
        call("f7", "f6", options(2), diagonal),
    ]);
    let result = reduce_spatial(prior(bit("c7"), bit("d7")), &frame, 2, false, &script, &mut LedgerWork::new()).unwrap();
    script.complete();
    assert_eq!(result.enemy_cc, set(RAW_CC));
    assert_ne!(result.enemy_cc & bit("e8"), 0);
    assert_eq!(result.witnessed, set(&["c6", "f6", "f7"]));
    assert_eq!(result.unlocated, bit("d6"));
}

#[test]
fn independent_provider_promotions_leave_marine_frontier_but_retained_anchors_remain() {
    let mut frame = scripted_frame(BoundaryPhase::Settled);
    frame.innovation.marine_anchors[sq("f7").index()] = true;
    let mut first = call("c7", "c6", options(1), 0);
    first.outcomes[0].promotion = Some(Promotion::Knight);
    let mut anchor = call("f7", "f6", options(1), 0);
    anchor.outcomes[0].promotion = Some(Promotion::Rook);
    let script = FiniteScript::new(vec![first, call("d7", "d6", options(1), 0), anchor]);
    let result = reduce_spatial(prior(bit("c7"), bit("d7")), &frame, 1, false, &script, &mut LedgerWork::new()).unwrap();
    script.complete();
    assert_eq!(result.witnessed, bit("f7"));
    assert_eq!(result.unlocated, bit("d6"));
    assert_eq!(result.witnessed & set(&["c6", "f6"]), 0);
}

#[test]
fn current_observed_marine_enters_witnessed_and_leaves_only_unlocated() {
    let mut frame = scripted_frame(BoundaryPhase::TurnOpen);
    put(&mut frame, revealed("d7", UnitType::Pawn));
    let script = FiniteScript::new(vec![]);
    let result = reduce_spatial(prior(bit("c7"), set(&["c7", "d7"])), &frame, 1, false, &script, &mut LedgerWork::new()).unwrap();
    script.complete();
    assert_eq!(result.enemy_cc, bit("e8"));
    assert_eq!(result.witnessed, set(&["c7", "d7"]));
    assert_eq!(result.unlocated, bit("c7"));
    assert_eq!(result.witnessed & result.unlocated, bit("c7"));
}

#[test]
fn casualty_value_does_not_erase_unknown_stationary_frontiers() {
    let mut frame = scripted_frame(BoundaryPhase::TurnOpen);
    frame.innovation.values[1] = 9;
    frame.innovation.bins[1] = 3;
    frame.innovation.marine_anchors[sq("f7").index()] = true;
    let script = FiniteScript::new(vec![]);
    let result = reduce_spatial(prior(bit("c7"), bit("d7")), &frame, 1, false, &script, &mut LedgerWork::new()).unwrap();
    script.complete();
    assert_eq!(result.witnessed, set(&["c7", "f7"]));
    assert_eq!(result.unlocated, bit("d7"));
}

#[test]
fn final_pruning_accepts_only_unknown_or_current_matching_enemy_piece() {
    let mut frame = scripted_frame(BoundaryPhase::Initial);
    put(&mut frame, ObservedCell::Lit { square: sq("a2"), piece: Some(ObservedPiece { color: Side::Black, kind: UnitType::Pawn }) });
    put(&mut frame, revealed("a3", UnitType::Pawn));
    put(&mut frame, ObservedCell::Lit { square: sq("a4"), piece: Some(ObservedPiece { color: Side::White, kind: UnitType::Pawn }) });
    put(&mut frame, empty("a5"));
    put(&mut frame, revealed("a6", UnitType::Queen));
    let candidates = set(&["a1", "a2", "a3", "a4", "a5", "a6"]);
    let script = FiniteScript::new(vec![]);
    let result = reduce_spatial(prior(candidates, candidates), &frame, 1, false, &script, &mut LedgerWork::new()).unwrap();
    script.complete();
    assert_eq!(result.witnessed, set(&["a1", "a2", "a3"]));
    assert_eq!(result.unlocated, bit("a1"));
}

#[test]
fn boolean_zero_pmf_bank_support_enables_births_independently_of_components() {
    let mut cells = vec![false; 7501];
    cells[4] = true;
    cells[577 + 4] = true;
    let mut masses = vec![0.0; 7501];
    masses[4] = 1.0;
    let mut setup = LedgerWork::new();
    let support = NumericSupport::from_cells(&cells, &mut setup).unwrap();
    let joint = normalize_aggregate(&masses, &support, &mut setup).unwrap();
    let banded = training_native::banded_joint::reband_joint(joint, &mut setup).unwrap();
    assert!(banded.components().iter().all(|component| component.bank() == 0));
    assert!(banded.support().cells()[577 + 4]);
    let script = FiniteScript::new(BEFORE_BIRTHS.iter().map(|source|
        promoting_call(source, MarineOptions { specials: false, ..options(0) })).collect());
    let frame = scripted_frame(BoundaryPhase::Settled);
    let mut work = LedgerWork::new();
    let can_birth = support_can_birth(banded.support(), &mut work).unwrap();
    assert!(can_birth);
    let result = reduce_spatial(prior(0, 0), &frame, 1, can_birth, &script, &mut work).unwrap();
    script.complete();
    assert_eq!(result.unlocated, set(AFTER_BIRTHS));
    assert_eq!(result.witnessed, 0);
    assert!(work.used() < work.limit());
    let mut cells = vec![false; 7501];
    cells[4] = true;
    let support = NumericSupport::from_cells(&cells, &mut LedgerWork::new()).unwrap();
    assert!(!support_can_birth(&support, &mut LedgerWork::new()).unwrap());
}

#[test]
fn birth_options_bind_remaining_gas_existing_specials_and_after_constraints() {
    let frame = scripted_frame(BoundaryPhase::Settled);
    let mut calls = vec![call("d7", "h5", options(2), 0)];
    for source in BEFORE_BIRTHS {
        calls.push(promoting_call(source, MarineOptions { gas: 1, specials: *source == "d7", ..options(2) }));
        if *source == "d7" {
            calls.push(call("d7", "h4", MarineOptions { gas: 1, classical: false, before: false, ..options(2) }, 0));
        }
    }
    let script = FiniteScript::new(calls);
    let result = reduce_spatial(prior(0, bit("d7")), &frame, 2, true, &script, &mut LedgerWork::new()).unwrap();
    script.complete();
    assert_eq!(result.unlocated, set(AFTER_BIRTHS) | set(&["h4", "h5"]));
    assert_eq!(result.witnessed, 0);
}

#[test]
fn after_births_use_raw_expanded_cc_even_when_all_neighbors_prune() {
    let mut frame = scripted_frame(BoundaryPhase::Settled);
    for square in BEFORE_BIRTHS { put(&mut frame, empty(square)); }
    let script = FiniteScript::new(BEFORE_BIRTHS.iter().map(|source|
        promoting_call(source, MarineOptions { specials: false, ..options(0) })).collect());
    let result = reduce_spatial(prior(0, 0), &frame, 1, true, &script, &mut LedgerWork::new()).unwrap();
    script.complete();
    assert_eq!(result.enemy_cc, bit("e8"));
    assert_eq!(result.unlocated, set(AFTER_BIRTHS) & !set(BEFORE_BIRTHS));
    assert_ne!(result.unlocated & bit("c6"), 0);
    assert_eq!(result.unlocated & bit("d7"), 0);
}

#[test]
fn before_birth_routes_start_from_prior_cc_not_the_pruned_successor_cc() {
    let mut frame = scripted_frame(BoundaryPhase::Settled);
    for square in ["d7", "d8", "e8", "f7", "f8"] { put(&mut frame, empty(square)); }
    let calls = BEFORE_BIRTHS.iter().zip(["a4", "b4", "c4", "d4", "e4"])
        .map(|(source, destination)| call(source, destination, MarineOptions { specials: false, ..options(0) }, 0)).collect();
    let script = FiniteScript::new(calls);
    let result = reduce_spatial(prior(0, 0), &frame, 1, true, &script, &mut LedgerWork::new()).unwrap();
    script.complete();
    assert_eq!(result.enemy_cc, bit("e7"));
    let blocked = set(&["d7", "d8", "e8", "f7", "f8"]);
    assert_eq!(result.unlocated, (set(AFTER_BIRTHS) & !blocked) | set(&["a4", "b4", "c4", "d4", "e4"]));
}

#[test]
fn gas_zero_blocks_births_without_erasing_prior_turn_frontier_transport() {
    let frame = scripted_frame(BoundaryPhase::Settled);
    let script = FiniteScript::new(vec![call("c7", "c6", options(0), 0)]);
    let result = reduce_spatial(prior(bit("c7"), 0), &frame, 0, true, &script, &mut LedgerWork::new()).unwrap();
    script.complete();
    assert_eq!(result.witnessed, bit("c6"));
    assert_eq!(result.unlocated, 0);
}

#[test]
fn birth_terminal_rank_is_excluded_and_scripted_promotions_never_add_marines() {
    let frame = scripted_frame(BoundaryPhase::Settled);
    let sources = ["d2", "d3", "e3", "f2", "f3"];
    let script = FiniteScript::new(sources.iter().map(|source|
        promoting_call(source, MarineOptions { specials: false, ..options(0) })).collect());
    let prior = SpatialState { enemy_cc: bit("e2"), witnessed: 0, unlocated: 0 };
    let result = reduce_spatial(prior, &frame, 1, true, &script, &mut LedgerWork::new()).unwrap();
    script.complete();
    let expected = set(&["c2", "c3", "c4", "d2", "d3", "d4", "e2", "e3", "e4", "f2", "f3", "f4", "g2", "g3", "g4"]);
    assert_eq!(result.unlocated, expected);
    let rank_one = set(&["a1", "b1", "c1", "d1", "e1", "f1", "g1", "h1"]);
    assert_eq!(result.unlocated & rank_one, 0);
}

#[test]
fn cc_consistency_failure_stops_before_any_provider_call() {
    let mut frame = scripted_frame(BoundaryPhase::Settled);
    for square in RAW_CC { put(&mut frame, empty(square)); }
    let script = FiniteScript::new(vec![]);
    let mut work = LedgerWork::new();
    assert_eq!(reduce_spatial(prior(bit("c7"), 0), &frame, 1, true, &script, &mut work).unwrap_err(), BeliefError::SpatialConsistency);
    assert!(work.used() > 0);
    script.complete();
}

#[test]
fn provider_and_emit_share_the_callers_already_spent_budget() {
    let frame = scripted_frame(BoundaryPhase::Settled);
    let script = FiniteScript::new(vec![call("c7", "c6", options(1), 0)]);
    let prefix = 17 + 128 + 32 * 64 + 32 + (32 + 16 * 64 + 32 * 9)
        + 32 * 64 + 64 + 32 + 16 * 23 + 32 + 32 + 16;
    let mut work = LedgerWork::with_limit(prefix + 31).unwrap();
    work.charge(17).unwrap();
    assert!(matches!(reduce_spatial(prior(bit("c7"), 0), &frame, 1, false, &script, &mut work),
        Err(BeliefError::Ledger(ref error)) if error.code == LedgerErrorCode::Budget));
    assert_eq!(work.used(), prefix);
    assert_eq!(work.remaining(), 31);
    script.complete();
}

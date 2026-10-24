// SPEC: _spec/apps/arena/shared418.puml
use serde::Deserialize;
use training_native::contracts::{Action, AuthorizedView, Candidate, ObservedCell, ObservedPiece,
    OwnInventory, OwnPiece, PieceKind, Side, Spend, Square, ViewVersion, all_squares};
use training_native::feature_input::{FeatureInput, FeatureInputPair};
use training_native::features::{NumericalFeatureContext, encode_numerical_features_v3, flatten_features_v3};
use training_native::ledger::LedgerWork;
use training_native::ledger::contracts::{BoundaryPhase, BoundaryVersion, EconomicBoundary, LedgerRules, Pair};

#[derive(Deserialize)]
struct Fixture {
    turn: u32, king: String, balance: f64, uncertainty: f64,
    witnessed: Vec<String>, unlocated: Vec<String>, actions: Vec<Action>, spend: Spend,
    queue: Vec<f64>, positions: Vec<Vec<f64>>, economic: Vec<f64>, promotion: Vec<f64>,
}

fn square(value: &str) -> Square { Square::parse(value).unwrap() }
fn frame(fixture: &Fixture) -> FeatureInput {
    #[derive(Deserialize)]
    struct Rules { rules: LedgerRules }
    let rules = serde_json::from_str::<Rules>(include_str!("../../../packages/training/tests/fixtures/ledger-boundaries.json")).unwrap().rules;
    let make = |side: Side, king: Square| {
        let gas = rules.gas_capacity_at(fixture.turn).unwrap();
        let mut cells: Vec<_> = all_squares().into_iter().map(|square| ObservedCell::Lit { square, piece: None }).collect();
        cells[king.index()] = ObservedCell::Lit { square: king, piece: Some(ObservedPiece { color: side, kind: PieceKind::King }) };
        EconomicBoundary { version: BoundaryVersion::V1, side, ordinal: 0, phase: BoundaryPhase::Initial,
            turn: fixture.turn, planning_ordinal: 0, grant_ordinal: 0, seq_before: 0, seq_through: 0, groups: vec![],
            snapshot: AuthorizedView { version: ViewVersion::V2, side, turn: fixture.turn,
                own: OwnInventory { minerals: 12, gas, gas_income: gas, cc_lives: 3,
                    pieces: vec![OwnPiece { square: king, kind: PieceKind::King }], mines: vec![], sieged_tanks: vec![] }, cells } }
    };
    let initial = Pair { w: make(Side::White, square(&fixture.king)), b: make(Side::Black, square("e8")) };
    let mut work = LedgerWork::new();
    FeatureInputPair::initialize(rules, &initial, &mut work).unwrap().input(Side::White, &mut work).unwrap()
}

#[test]
fn arena_and_training_share_the_same_418_values_and_metered_path() {
    #[derive(Deserialize)]
    struct Fixtures { cases: Vec<Fixture> }
    let fixtures = serde_json::from_str::<Fixtures>(include_str!("../../../packages/training/tests/fixtures/shared418-literals.json")).unwrap();
    for fixture in fixtures.cases {
        let history = frame(&fixture);
        let candidate = Candidate::new(fixture.actions.clone(), fixture.spend, Side::White).unwrap();
        let mask = |values: &[String]| values.iter().fold(0_u64, |bits, value| bits | (1_u64 << square(value).index()));
        let context = NumericalFeatureContext { stamp: history.stamp, side: Side::White,
            balance: fixture.balance, uncertainty: fixture.uncertainty,
            witnessed: mask(&fixture.witnessed), unlocated: mask(&fixture.unlocated) };
        let mut training_work = LedgerWork::new();
        let training = flatten_features_v3(&encode_numerical_features_v3(&history, &candidate, &context, &mut training_work).unwrap(), &mut training_work).unwrap();
        let mut arena_work = LedgerWork::new();
        let arena = arena::feature_adapter::encode_shared418(&history, &candidate, &context, &mut arena_work).unwrap();
        assert_eq!(training.map(f64::to_bits), arena.map(f64::to_bits));
        assert_eq!(training_work.used(), arena_work.used());
        let expected: Vec<_> = fixture.queue.iter().chain(fixture.positions.iter().flatten())
            .chain(fixture.economic.iter()).chain(fixture.promotion.iter()).copied().collect();
        assert_eq!(expected.len(), 418);
        for (actual, expected) in arena.into_iter().zip(expected) {
            assert!((actual - expected).abs() <= 1e-12 * (1.0 + expected.abs()));
        }
    }
}

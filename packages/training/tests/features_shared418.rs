// SPEC: _spec/packages/training/shared418.puml
use serde::Deserialize;
use serde_json::{Value, json};
use training_native::contracts::{Action, Candidate, ObservedPiece, OwnInventory, OwnPiece, Spend,
    ViewVersion, all_squares};
use training_native::feature_input::{FeatureInput, FeatureInputPair};
use training_native::feature_manifest::feature_registry_v3;
use training_native::features::{FeatureBlocksV3, NumericalFeatureContext,
    encode_numerical_features_v3, flatten_features_v3};
use training_native::ledger::LedgerWork;
use training_native::ledger::contracts::*;
use training_native::ledger::history::LastSeenAssertion;

fn sq(value: &str) -> Square { Square::parse(value).unwrap() }
fn mask(values: &[&str]) -> u64 { values.iter().fold(0, |bits, square| bits | 1_u64 << sq(square).index()) }
fn rules() -> LedgerRules {
    #[derive(Deserialize)]
    struct Golden { rules: LedgerRules }
    serde_json::from_str::<Golden>(include_str!("fixtures/ledger-boundaries.json")).unwrap().rules
}
fn view(side: Side, turn: u32, own: &[(&str, UnitType)], enemy: &[(&str, UnitType)], unknown: &[&str]) -> AuthorizedView {
    let mut pieces: Vec<_> = own.iter().map(|(square, kind)| OwnPiece { square: sq(square), kind: *kind }).collect();
    pieces.sort_by_key(|piece| piece.square);
    let mut cells: Vec<_> = all_squares().into_iter().map(|square| ObservedCell::Lit { square, piece: None }).collect();
    for value in unknown { let square = sq(value); cells[square.index()] = ObservedCell::Unknown { square }; }
    for piece in &pieces {
        cells[piece.square.index()] = ObservedCell::Lit { square: piece.square,
            piece: Some(ObservedPiece { color: side, kind: piece.kind }) };
    }
    for (value, kind) in enemy {
        let square = sq(value);
        cells[square.index()] = ObservedCell::Lit { square,
            piece: Some(ObservedPiece { color: side.other(), kind: *kind }) };
    }
    let gas = rules().gas_capacity_at(turn).unwrap();
    AuthorizedView { version: ViewVersion::V2, side, turn, own: OwnInventory {
        minerals: 12, gas, gas_income: gas, cc_lives: 3, pieces, mines: vec![], sieged_tanks: vec![],
    }, cells }
}
fn initialized(white: AuthorizedView) -> FeatureInput {
    let make = |snapshot: AuthorizedView| EconomicBoundary {
        version: BoundaryVersion::V1, side: snapshot.side, ordinal: 0, phase: BoundaryPhase::Initial,
        turn: snapshot.turn, planning_ordinal: 0, grant_ordinal: 0, seq_before: 0, seq_through: 0,
        groups: vec![], snapshot,
    };
    let black = view(Side::Black, white.turn, &[("e8", UnitType::King)], &[], &[]);
    let initial = Pair { w: make(white), b: make(black) };
    let mut work = LedgerWork::new();
    FeatureInputPair::initialize(rules(), &initial, &mut work).unwrap().input(Side::White, &mut work).unwrap()
}
fn history(own: &[(&str, UnitType)], enemy: &[(&str, UnitType)], unknown: &[&str]) -> FeatureInput {
    initialized(view(Side::White, 21, own, enemy, unknown))
}
fn context(history: &FeatureInput) -> NumericalFeatureContext {
    NumericalFeatureContext { stamp: history.stamp, side: history.view.side,
        balance: 2.0, uncertainty: 3.0, witnessed: 0, unlocated: 0 }
}
fn action(value: Value) -> Action { serde_json::from_value(value).unwrap() }
fn classical(from: &str, to: &str) -> Action {
    action(json!({"kind":"classical","timing":"C","color":"w","from":from,"to":to}))
}
fn special(kind: &str, from: &str, to: Option<&str>, phase: &str) -> Action {
    let mut value = json!({"kind":kind,"timing":phase,"color":"w","from":from});
    if let Some(to) = to { value["to"] = json!(to); }
    action(value)
}
fn deploy(from: &str, to: &str, unit: &str) -> Action {
    action(json!({"kind":"deploy","timing":"B","color":"w","from":from,"to":to,"unit":unit}))
}
fn candidate(actions: Vec<Action>) -> Candidate {
    let mut spend = Spend::default();
    for action in &actions {
        spend.gas += match action {
            Action::Classical { .. } => 0, Action::CharonMissiles { .. } => 2, Action::TacticalJump { .. } => 3, _ => 1,
        };
        if let Action::Deploy { unit, .. } = action {
            spend.minerals += match unit {
                training_native::contracts::SpawnPiece::Pawn => 1,
                training_native::contracts::SpawnPiece::Knight | training_native::contracts::SpawnPiece::Bishop => 3,
                training_native::contracts::SpawnPiece::Rook => 5, training_native::contracts::SpawnPiece::Queen => 9,
            };
        }
    }
    Candidate::new(actions, spend, Side::White).unwrap()
}
fn encode(history: &FeatureInput, actions: Vec<Action>) -> FeatureBlocksV3 {
    encode_numerical_features_v3(history, &candidate(actions), &context(history), &mut LedgerWork::new()).unwrap()
}
fn close(actual: f64, expected: f64) {
    assert!((actual - expected).abs() <= 1e-12 * (1.0 + expected.abs()), "{actual} != {expected}");
}

#[derive(Deserialize)]
struct LiteralCase {
    name: String, turn: u32, king: String, balance: f64, uncertainty: f64,
    witnessed: Vec<String>, unlocated: Vec<String>, actions: Vec<Action>, spend: Spend,
    queue: Vec<f64>, positions: Vec<Vec<f64>>, economic: Vec<f64>, promotion: Vec<f64>,
}
fn literal(index: usize) {
    #[derive(Deserialize)]
    struct Fixtures { origin: String, qualification: String, cases: Vec<LiteralCase> }
    let fixtures: Fixtures = serde_json::from_str(include_str!("fixtures/shared418-literals.json")).unwrap();
    assert!(fixtures.origin.contains("Independent"));
    assert!(fixtures.qualification.contains("source-inspection-only"));
    let case = &fixtures.cases[index];
    let history = initialized(view(Side::White, case.turn, &[(&case.king, UnitType::King)], &[], &[]));
    let candidate = Candidate::new(case.actions.clone(), case.spend, Side::White).unwrap();
    let mut context = context(&history);
    context.balance = case.balance; context.uncertainty = case.uncertainty;
    context.witnessed = case.witnessed.iter().fold(0, |m, s| m | (1_u64 << sq(s).index()));
    context.unlocated = case.unlocated.iter().fold(0, |m, s| m | (1_u64 << sq(s).index()));
    assert_eq!(case.queue.len(), 34, "{}", case.name);
    assert_eq!(case.positions.len(), 4);
    assert!(case.positions.iter().all(|position| position.len() == 84));
    assert_eq!(case.economic.len(), 12); assert_eq!(case.promotion.len(), 36);
    let expected: Vec<_> = case.queue.iter().chain(case.positions.iter().flatten())
        .chain(case.economic.iter()).chain(case.promotion.iter()).copied().collect();
    assert_eq!(expected.len(), 418);
    let mut work = LedgerWork::new();
    let blocks = encode_numerical_features_v3(&history, &candidate, &context, &mut work).unwrap();
    let actual = flatten_features_v3(&blocks, &mut work).unwrap();
    for (index, (actual, expected)) in actual.into_iter().zip(expected).enumerate() {
        assert!((actual - expected).abs() < 1e-12, "{} lane {index}: {actual} != {expected}", case.name);
    }
}

#[test]
fn literal_deploy_all_418_coordinates() { literal(0); }
#[test]
fn literal_two_frontiers_all_418_coordinates() { literal(1); }

#[test]
fn pass_uses_caller_budget_below_100k() {
    let h = history(&[("e1", UnitType::King)], &[], &[]);
    let mut work = LedgerWork::with_limit(100_000).unwrap();
    work.charge(17).unwrap();
    let blocks = encode_numerical_features_v3(&h, &candidate(vec![]), &context(&h), &mut work).unwrap();
    assert_eq!(blocks.queue[0], 1.0);
    assert!(work.used() > 17); assert!(work.used() <= 100_000);
}

#[test]
fn flatten_preserves_manifest_order_tails_and_detachment() {
    let mut blocks = FeatureBlocksV3 { queue: [0.0; 34], positions: [[0.0; 84]; 4], economic: [0.0; 12], promotion: [0.0; 36] };
    let registry = feature_registry_v3();
    for (i, value) in blocks.queue.iter_mut().enumerate() { *value = i as f64; }
    for (position, values) in blocks.positions.iter_mut().enumerate() {
        for (i, value) in values.iter_mut().enumerate() { *value = (34 + 84 * position + i) as f64; }
    }
    for (i, value) in blocks.economic.iter_mut().enumerate() { *value = (370 + i) as f64; }
    for (i, value) in blocks.promotion.iter_mut().enumerate() { *value = (382 + i) as f64; }
    let mut work = LedgerWork::new();
    let mut first = flatten_features_v3(&blocks, &mut work).unwrap();
    let before = work.used();
    let second = flatten_features_v3(&blocks, &mut work).unwrap();
    assert_eq!(work.used() - before, 18_594);
    for i in 0..418 { assert_eq!(second[i], registry[i].index as f64); }
    assert_eq!(registry[369].name, "position.3.ix.protectionPaidLoss");
    assert_eq!(registry[417].name, "promotion.visionAdded.unlocated.h3");
    first[417] = -1.0; blocks.queue[0] = -2.0;
    assert_eq!(second[417], 417.0); assert_eq!(second[0], 0.0);
}

#[test]
fn numerical_flatten_requires_finite_values_without_synthetic_magnitude_limits() {
    let mut blocks = FeatureBlocksV3 { queue: [0.0; 34], positions: [[0.0; 84]; 4], economic: [0.0; 12], promotion: [0.0; 36] };
    blocks.economic[0] = 2_000_000.0;
    let mut work = LedgerWork::new();
    assert_eq!(flatten_features_v3(&blocks, &mut work).unwrap()[370], 2_000_000.0);
    blocks.promotion[35] = f64::INFINITY;
    assert_eq!(flatten_features_v3(&blocks, &mut work).unwrap_err().code, LedgerErrorCode::BadInput);
}

#[test]
fn budget_exhaustion_rejects_before_feature_or_flat_allocation() {
    let h = history(&[("e1", UnitType::King)], &[], &[]);
    let mut work = LedgerWork::with_limit(132).unwrap();
    let err = encode_numerical_features_v3(&h, &candidate(vec![]), &context(&h), &mut work).unwrap_err();
    assert_eq!(err.code, LedgerErrorCode::Budget); assert_eq!(work.used(), 0);
    let blocks = encode(&h, vec![]);
    let mut work = LedgerWork::with_limit(18_593).unwrap();
    assert_eq!(flatten_features_v3(&blocks, &mut work).unwrap_err().code, LedgerErrorCode::Budget);
    assert_eq!(work.used(), 0);
    let mut work = LedgerWork::new();
    work.charge(1_048_576 - 132).unwrap();
    let used = work.used();
    assert_eq!(encode_numerical_features_v3(&h, &candidate(vec![]), &context(&h), &mut work).unwrap_err().code, LedgerErrorCode::Budget);
    assert_eq!(work.used(), used);
}

#[test]
fn existing_full_support_invoice_still_exceeds_the_ledger_cap() {
    let mut work = LedgerWork::new();
    assert_eq!(work.limit(), 1_048_576);
    assert_eq!(work.charge(1_129_672).unwrap_err().code, LedgerErrorCode::Budget);
    assert_eq!(work.used(), 0);
}

#[test]
fn rejects_mismatched_boundary_side_version_and_nonfinite_readouts() {
    let mut h = history(&[("e1", UnitType::King)], &[], &[]);
    let c = candidate(vec![]);
    let mut ctx = context(&h); ctx.stamp.ordinal += 1;
    assert_eq!(encode_numerical_features_v3(&h, &c, &ctx, &mut LedgerWork::new()).unwrap_err().code, LedgerErrorCode::Identity);
    ctx = context(&h); ctx.side = Side::Black;
    assert_eq!(encode_numerical_features_v3(&h, &c, &ctx, &mut LedgerWork::new()).unwrap_err().code, LedgerErrorCode::Identity);
    ctx = context(&h); ctx.balance = f64::NAN;
    assert_eq!(encode_numerical_features_v3(&h, &c, &ctx, &mut LedgerWork::new()).unwrap_err().code, LedgerErrorCode::BadInput);
    ctx = context(&h); ctx.uncertainty = -1.0;
    assert_eq!(encode_numerical_features_v3(&h, &c, &ctx, &mut LedgerWork::new()).unwrap_err().code, LedgerErrorCode::BadInput);
    ctx = context(&h); h.version = "wrong";
    assert_eq!(encode_numerical_features_v3(&h, &c, &ctx, &mut LedgerWork::new()).unwrap_err().code, LedgerErrorCode::Unsupported);
}

#[test]
fn accepts_negative_balance_without_clamping_and_rejects_bad_spend_key_fifth_action() {
    let h = history(&[("e1", UnitType::King)], &[], &[]);
    let mut c = candidate(vec![deploy("e1", "e2", "p")]);
    let mut ctx = context(&h); ctx.balance = -576.0; ctx.uncertainty = 288.0;
    let blocks = encode_numerical_features_v3(&h, &c, &ctx, &mut LedgerWork::new()).unwrap();
    close(blocks.economic[2], -48.0); close(blocks.economic[3], 24.0);
    c.own_spend.gas = 0;
    assert!(encode_numerical_features_v3(&h, &c, &ctx, &mut LedgerWork::new()).is_err());
    c = candidate(vec![]); c.key = "not-canonical".into();
    assert!(encode_numerical_features_v3(&h, &c, &ctx, &mut LedgerWork::new()).is_err());
    c = candidate(vec![classical("e1", "e2")]); c.actions.extend(std::iter::repeat_n(classical("e1", "e2"), 4));
    assert!(encode_numerical_features_v3(&h, &c, &ctx, &mut LedgerWork::new()).is_err());
}

#[test]
fn rejects_duplicate_lineage_ids_squares_and_future_memory() {
    let mut h = history(&[("a1", UnitType::King), ("e2", UnitType::Pawn)], &[], &["h8"]);
    let c = candidate(vec![]);
    let id = h.own_units[0].id; h.own_units[1].id = id;
    assert_eq!(encode_numerical_features_v3(&h, &c, &context(&h), &mut LedgerWork::new()).unwrap_err().code, LedgerErrorCode::Identity);
    let mut h = history(&[("a1", UnitType::King), ("e2", UnitType::Pawn)], &[], &["h8"]);
    h.own_units[1].square = h.own_units[0].square;
    assert!(encode_numerical_features_v3(&h, &c, &context(&h), &mut LedgerWork::new()).is_err());
    let mut h = history(&[("a1", UnitType::King)], &[], &["h8"]);
    h.memory[sq("h8").index()] = Some(LastSeenAssertion { square: sq("h8"), kind: UnitType::Pawn, color: Side::Black, last_observed_turn: 22 });
    assert!(encode_numerical_features_v3(&h, &c, &context(&h), &mut LedgerWork::new()).is_err());
}

#[test]
fn b_heads_and_original_rank_double_keep_authored_slots() {
    let h = history(&[("a1", UnitType::King), ("e2", UnitType::Pawn), ("e3", UnitType::Pawn)], &[], &[]);
    let blocks = encode(&h, vec![special("stimStep", "e2", Some("e3"), "B"),
        special("stimStep", "e3", Some("e4"), "B"), classical("e2", "e4")]);
    close(blocks.positions[2][12], 1.0 / 7.0); close(blocks.positions[2][15], 3.0 / 7.0);
    assert_eq!(blocks.positions[2][28], 1.0); assert_eq!(blocks.positions[2][29], 0.0);
    assert_eq!(blocks.positions[2][30], 1.0);
    close(blocks.queue[15], 1.0 / 6.0); close(blocks.queue[16], 1.0 / 6.0);
    assert!(blocks.positions[3].iter().all(|value| *value == 0.0));
}

#[test]
fn f_mine_rebinds_after_classical_but_preserves_authored_coordinates() {
    let h = history(&[("h1", UnitType::King), ("a3", UnitType::Knight)], &[], &[]);
    let blocks = encode(&h, vec![special("spiderMine", "a3", None, "F"), classical("a3", "b5")]);
    close(blocks.queue[17], 1.0 / 6.0); close(blocks.queue[18], 1.0 / 6.0);
    close(blocks.queue[20], 1.0 / 6.0);
    close(blocks.positions[0][12], 2.0 / 7.0); assert_eq!(blocks.positions[0][30], 1.0);
    assert_eq!(blocks.positions[0][40], 1.0);
    assert_eq!(&blocks.positions[0][57..64], &[0.0; 7]);
}

#[test]
fn hypothetical_birth_has_zero_paid_and_distinct_baseline_masks() {
    let h = history(&[("e1", UnitType::King)], &[], &[]);
    let blocks = encode(&h, vec![deploy("e1", "d2", "p"), classical("d2", "d4")]);
    let p = blocks.positions[1];
    assert_eq!(p[28], 0.0); assert_eq!(p[29], 0.0); assert_eq!(p[30], 1.0);
    assert_eq!(p[31], 0.0); assert_eq!(p[55], 0.0); close(p[56], 1.0 / 12.0);
    close(blocks.queue[19], 1.0 / 6.0);
    assert_eq!(blocks.positions[0][42], 1.0);
    assert_eq!(blocks.positions[1][42], 1.0);
}

#[test]
fn deploy_crush_uses_baseline_replacement_not_birth_or_paid_basis() {
    let mut h = history(&[("b2", UnitType::King), ("b3", UnitType::Queen)], &[("b8", UnitType::Rook)], &[]);
    h.own_units.iter_mut().find(|unit| unit.square == sq("b3")).unwrap().paid_basis = 1;
    let blocks = encode(&h, vec![deploy("b2", "b3", "p"), deploy("b2", "b3", "p")]);
    close(blocks.queue[9], 1.0 / 3072.0); close(blocks.queue[10], 9.0 / 2304.0);
    close(blocks.economic[9], (2.0 - 9.0) / 12.0); assert_eq!(blocks.economic[11], 0.0);
    assert_eq!(blocks.positions[1][43], 1.0); assert_eq!(blocks.positions[1][49], 1.0);
}

#[test]
fn unknown_rewrite_uses_effective_origin_but_authored_target_facts() {
    let h = history(&[("a1", UnitType::King), ("e2", UnitType::Pawn)], &[], &["e5"]);
    let blocks = encode(&h, vec![special("stimStep", "e2", Some("e3"), "B"), classical("e2", "e4")]);
    let p = blocks.positions[1];
    assert_eq!(p[28], 1.0); assert_eq!(p[30], 1.0); assert_eq!(p[42], 1.0); assert_eq!(p[41], 0.0);
    close(p[12], 1.0 / 7.0); close(p[15], 3.0 / 7.0);
}

#[test]
fn unknown_rays_and_frozen_enemy_blockers_stay_separate() {
    let h = history(&[("h1", UnitType::King), ("a2", UnitType::Rook)], &[("a7", UnitType::Pawn)], &["a5"]);
    let blocks = encode(&h, vec![classical("a2", "a6")]);
    let p = blocks.positions[0];
    assert_eq!(p[57], 1.0); assert_eq!(p[58], 0.0); assert_eq!(p[59], 0.0); assert_eq!(p[60], 1.0);
    close(p[61], 2.0 / 64.0); close(p[63], 1.0 / 64.0); close(p[81], 4.0 / 7.0);
    let h = history(&[("h1", UnitType::King), ("a2", UnitType::Rook)],
        &[("a6", UnitType::Pawn), ("a7", UnitType::Queen)], &["a5"]);
    let p = encode(&h, vec![classical("a2", "a7")]).positions[0];
    assert_eq!(p[59], 1.0); assert_eq!(p[60], 0.0);
    close(p[62], 1.0 / 64.0); close(p[63], 1.0 / 64.0);
}

#[test]
fn stationary_siege_and_enemy_cc_aim_do_not_move_actor() {
    let mut v = view(Side::White, 21, &[("a1", UnitType::King), ("a2", UnitType::Rook)], &[("a7", UnitType::King)], &[]);
    v.own.sieged_tanks.push(sq("a2"));
    let h = initialized(v);
    let blocks = encode(&h, vec![classical("a2", "a7"), special("siegeMode", "a2", None, "F")]);
    assert_eq!(blocks.positions[0][39], 1.0); assert_eq!(blocks.positions[0][69], 1.0);
    assert_eq!(blocks.positions[1][30], 0.0); assert_eq!(blocks.positions[1][39], 1.0);
    assert_eq!(blocks.economic[10], 0.0);
}

#[test]
fn latest_memory_then_lexical_tie_drives_stale_approach_without_live_enemy() {
    let mut h = history(&[("h1", UnitType::King), ("a2", UnitType::Rook)], &[], &["a7", "b1", "h8"]);
    for (square, turn) in [("a7", 10), ("b1", 10), ("h8", 9)] {
        let square = sq(square);
        h.memory[square.index()] = Some(LastSeenAssertion { square, kind: UnitType::Pawn, color: Side::Black, last_observed_turn: turn });
    }
    let blocks = encode(&h, vec![classical("a2", "a6")]);
    close(blocks.positions[0][65], 4.0 / 7.0);
    close(blocks.positions[0][82], (4.0 / 7.0) * (11.0 / 45.0));
    assert_eq!(blocks.positions[0][68], 0.0);
}

#[test]
fn classical_trade_credits_authored_target_once_and_deduplicates_immediate_actor_risk() {
    let h = history(&[("a1", UnitType::King), ("c3", UnitType::Knight)],
        &[("d5", UnitType::Pawn), ("d8", UnitType::Rook), ("b5", UnitType::Queen)], &[]);
    let blocks = encode(&h, vec![classical("c3", "d5")]);
    close(blocks.economic[10], (1.0 - 3.0) / 12.0); close(blocks.economic[4], -1.0 / 3.0);
    close(blocks.economic[5], -0.5);
    let h = history(&[("a1", UnitType::King), ("c3", UnitType::Knight)], &[("d5", UnitType::Pawn)], &[]);
    let blocks = encode(&h, vec![classical("c3", "d5"), classical("d5", "c3"), classical("c3", "d5")]);
    close(blocks.economic[10], 1.0 / 12.0);
    assert_eq!(blocks.queue[23], 0.0);
}

#[test]
fn promotion_preserves_paid_basis_and_maximum_risk_per_baseline_token() {
    let mut h = history(&[("a1", UnitType::King), ("e6", UnitType::Pawn)],
        &[("d8", UnitType::Pawn), ("a7", UnitType::Rook), ("h8", UnitType::Rook)], &[]);
    h.own_units.iter_mut().find(|unit| unit.square == sq("e6")).unwrap().paid_basis = 1;
    let promote = action(json!({"kind":"classical","timing":"C","color":"w","from":"e7","to":"d8","promotion":"q"}));
    let blocks = encode(&h, vec![special("stimStep", "e6", Some("e7"), "B"), promote,
        special("charonMissiles", "e7", Some("f6"), "F")]);
    close(blocks.positions[1][55], 1.0 / 12.0);
    assert_eq!(blocks.positions[2][36], 1.0); close(blocks.positions[2][55], 1.0 / 12.0);
    close(blocks.economic[10], (1.0 - 9.0) / 12.0);
}

#[test]
fn special_only_trade_is_zero_and_protection_counts_only_baseline_survivors() {
    let h = history(&[("a1", UnitType::King), ("c3", UnitType::Bishop)], &[("c8", UnitType::Rook)], &[]);
    assert_eq!(encode(&h, vec![special("charonMissiles", "c3", Some("c8"), "B")]).economic[10], 0.0);
    let h = history(&[("a1", UnitType::King), ("d3", UnitType::Knight)], &[("d8", UnitType::Rook)], &["d6"]);
    let blocks = encode(&h, vec![classical("d3", "e5")]);
    close(blocks.economic[11], 3.0 / 12.0); close(blocks.positions[0][70], 1.0 / 64.0);
}

#[test]
fn raw_destroyed_and_wasted_ledgers_have_distinct_interactions() {
    let mut h = history(&[("e1", UnitType::King)], &[], &[]);
    h.own_paid_destroyed = 6; h.own_paid_wasted = 3;
    let blocks = encode(&h, vec![deploy("e1", "e2", "p")]);
    let spend = 0.5 * (1.0 / 12.0 + 1.0 / 3.0);
    close(blocks.queue[22], spend * 6.0 / 3072.0);
    close(blocks.queue[32], spend * 3.0 / 3072.0); close(blocks.queue[33], 0.25 * 3.0 / 3072.0);
    assert_eq!(h.own_paid_destroyed, 6); assert_eq!(h.own_paid_wasted, 3);
}

#[test]
fn frontier_channels_use_physical_square_bits_and_last_rank_is_not_a_new_promotion() {
    let h = history(&[("f2", UnitType::King)], &[], &[]);
    let mut ctx = context(&h); ctx.witnessed = mask(&["e2"]); ctx.unlocated = mask(&["e1"]);
    let blocks = encode_numerical_features_v3(&h, &candidate(vec![]), &ctx, &mut LedgerWork::new()).unwrap();
    assert_eq!(&blocks.promotion[..3], &[0.125; 3]); assert_eq!(&blocks.promotion[3..6], &[0.0; 3]);
    for chunk in blocks.promotion.chunks_exact(6).skip(1) { assert_eq!(&chunk[3..6], &[0.0; 3]); }
}

#[test]
fn promotion_horizons_count_opportunities_not_distance_or_future_births() {
    let h = history(&[("f2", UnitType::King)], &[], &[]);
    let mut ctx = context(&h); ctx.witnessed = mask(&["e4"]);
    let blocks = encode_numerical_features_v3(&h, &candidate(vec![]), &ctx, &mut LedgerWork::new()).unwrap();
    assert_eq!(blocks.promotion[0], 0.0);
    assert!(blocks.promotion[1] > 0.0);
    assert!(blocks.promotion[2] >= blocks.promotion[1]);
    assert_eq!(&blocks.promotion[3..6], &[0.0; 3]);
}

#[test]
fn promotion_budget_failure_returns_no_truncated_or_zero_fallback_block() {
    let h = history(&[("f2", UnitType::King)], &[], &[]);
    let mut ctx = context(&h); ctx.witnessed = u64::MAX; ctx.unlocated = u64::MAX;
    let mut work = LedgerWork::with_limit(100_000).unwrap();
    let error = encode_numerical_features_v3(&h, &candidate(vec![]), &ctx, &mut work).unwrap_err();
    assert_eq!(error.code, LedgerErrorCode::Budget);
    assert!(work.used() > 0); assert!(work.used() <= work.limit());
}

#[test]
fn common_route_family_pools_blocker_additions_and_removals_by_destination_file() {
    let h = history(&[("h8", UnitType::King), ("e2", UnitType::Queen)], &[], &[]);
    let mut ctx = context(&h); ctx.witnessed = mask(&["e3", "f3"]);
    let blocks = encode_numerical_features_v3(&h, &candidate(vec![classical("e2", "f2")]), &ctx, &mut LedgerWork::new()).unwrap();
    close(blocks.promotion[6], 1.0 / 8.0); close(blocks.promotion[12], 1.0 / 8.0);
    assert_eq!(blocks.promotion[11], 0.0);
    assert!(blocks.promotion.iter().all(|value| (0.0..=1.0).contains(value) && value * 8.0 == (value * 8.0).round()));
}

#[test]
fn promotion_attack_cover_and_vision_are_local_common_family_differences() {
    let h = history(&[("h8", UnitType::King), ("f4", UnitType::Knight)], &[], &[]);
    let mut ctx = context(&h); ctx.witnessed = mask(&["e2"]);
    let blocks = encode_numerical_features_v3(&h, &candidate(vec![classical("f4", "g2")]), &ctx, &mut LedgerWork::new()).unwrap();
    close(blocks.promotion[18], 1.0 / 8.0); assert_eq!(blocks.promotion[24], 0.0);
    close(blocks.promotion[30], 1.0 / 8.0);
}

#[test]
fn source_map_covers_all_coordinates_and_retains_unexecuted_qualification() {
    let map: Value = serde_json::from_str(include_str!("fixtures/shared418-source-map.json")).unwrap();
    assert_eq!(map["qualification"], "source-inspection-only; uncompiled; no TypeScript runtime oracle");
    let mut covered = [false; 418];
    for block in map["coordinateBlocks"].as_array().unwrap() {
        let start = block["start"].as_u64().unwrap() as usize;
        let end = block["endExclusive"].as_u64().unwrap() as usize;
        assert!(start < end && end <= 418);
        for coordinate in &mut covered[start..end] { assert!(!*coordinate); *coordinate = true; }
        assert!(!block["typescriptSymbol"].as_str().unwrap().is_empty());
        assert!(!block["rustSymbol"].as_str().unwrap().is_empty());
    }
    assert!(covered.into_iter().all(|covered| covered));
}

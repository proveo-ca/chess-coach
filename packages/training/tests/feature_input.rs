// SPEC: _spec/packages/training/burn-compat.puml
use serde::Deserialize;
use serde_json::json;
use training_native::contracts::{ObservedPiece, OwnInventory, OwnPiece, ViewVersion, all_squares};
use training_native::feature_input::*;
use training_native::ledger::LedgerWork;
use training_native::ledger::contracts::*;
use training_native::ledger::history::LedgerPair;

#[derive(Deserialize)]
struct Expected {
    values: [u32; 3],
    bins: [u8; 3],
}

#[derive(Deserialize)]
struct Fixture {
    origin: String,
    initial: Pair<EconomicBoundary>,
    settled: Pair<EconomicBoundary>,
    expected: Pair<Expected>,
}

fn fixture() -> Fixture {
    serde_json::from_str(include_str!("fixtures/feature-input-boundaries.json")).unwrap()
}
fn rules() -> LedgerRules {
    #[derive(Deserialize)]
    struct NativeGolden {
        rules: LedgerRules,
    }
    serde_json::from_str::<NativeGolden>(include_str!("fixtures/ledger-boundaries.json"))
        .unwrap()
        .rules
}
fn sq(value: &str) -> Square {
    Square::parse(value).unwrap()
}
fn reference(ordinal: u32) -> ActionRef {
    ActionRef {
        planning_ordinal: 0,
        accepted_action_ordinal: ordinal,
    }
}
fn before(square: &str) -> UnitSubject {
    UnitSubject::BeforeUnit { square: sq(square) }
}
fn lit(square: &str, kind: Option<UnitType>, side: Side) -> ObservedCell {
    ObservedCell::Lit {
        square: sq(square),
        piece: kind.map(|kind| ObservedPiece { color: side, kind }),
    }
}
fn unknown(square: &str) -> ObservedCell {
    ObservedCell::Unknown { square: sq(square) }
}
fn revealed(square: &str, kind: UnitType) -> ObservedCell {
    ObservedCell::Revealed {
        square: sq(square),
        piece: ObservedPiece {
            color: Side::Black,
            kind,
        },
    }
}
fn view(
    side: Side,
    turn: u32,
    bank: u32,
    units: &[(&str, UnitType)],
    mines: &[&str],
) -> AuthorizedView {
    let mut pieces: Vec<_> = units
        .iter()
        .map(|(square, kind)| OwnPiece {
            square: sq(square),
            kind: *kind,
        })
        .collect();
    pieces.sort_by_key(|piece| piece.square);
    let mut mines: Vec<_> = mines.iter().map(|square| sq(square)).collect();
    mines.sort();
    let mut cells: Vec<_> = all_squares()
        .into_iter()
        .map(|square| ObservedCell::Unknown { square })
        .collect();
    for square in &mines {
        cells[square.index()] = ObservedCell::Lit {
            square: *square,
            piece: None,
        };
    }
    for piece in &pieces {
        cells[piece.square.index()] = ObservedCell::Lit {
            square: piece.square,
            piece: Some(ObservedPiece {
                color: side,
                kind: piece.kind,
            }),
        };
    }
    let capacity = rules().gas_capacity_at(turn).unwrap();
    AuthorizedView {
        version: ViewVersion::V2,
        side,
        turn,
        own: OwnInventory {
            minerals: bank,
            gas: capacity,
            gas_income: capacity,
            cc_lives: 3,
            pieces,
            mines,
            sieged_tanks: vec![],
        },
        cells,
    }
}
fn initial(white: AuthorizedView, black: AuthorizedView) -> Pair<EconomicBoundary> {
    let make = |snapshot: AuthorizedView| EconomicBoundary {
        version: BoundaryVersion::V1,
        side: snapshot.side,
        ordinal: 0,
        phase: BoundaryPhase::Initial,
        turn: snapshot.turn,
        planning_ordinal: 0,
        grant_ordinal: 0,
        seq_before: 0,
        seq_through: 0,
        groups: vec![],
        snapshot,
    };
    Pair {
        w: make(white),
        b: make(black),
    }
}
fn tiny(turn: u32, bank: u32) -> Pair<EconomicBoundary> {
    initial(
        view(Side::White, turn, bank, &[("e1", UnitType::King)], &[]),
        view(Side::Black, turn, bank, &[("e8", UnitType::King)], &[]),
    )
}
fn opened(previous: &Pair<EconomicBoundary>) -> Pair<EconomicBoundary> {
    let make = |before: &EconomicBoundary| {
        let mut next = before.clone();
        next.ordinal += 1;
        next.phase = BoundaryPhase::TurnOpen;
        next.seq_before = before.seq_through;
        next.groups.clear();
        next.snapshot.own.gas = next.snapshot.own.gas_income;
        next
    };
    Pair {
        w: make(&previous.w),
        b: make(&previous.b),
    }
}
fn reseq(boundary: &mut EconomicBoundary) {
    for (index, group) in boundary.groups.iter_mut().enumerate() {
        let number = boundary.seq_before + u32::try_from(index).unwrap() + 1;
        match group {
            AtomicGroup::Admission { seq, .. }
            | AtomicGroup::Effects { seq, .. }
            | AtomicGroup::Vision { seq, .. }
            | AtomicGroup::Settlement { seq, .. } => *seq = number,
        }
    }
    boundary.seq_through = boundary.seq_before + u32::try_from(boundary.groups.len()).unwrap();
}
fn geometry(boundary: &EconomicBoundary) -> OwnGeometry {
    OwnGeometry::from_snapshot(&boundary.snapshot, &mut LedgerWork::new()).unwrap()
}
fn unit(square: &str, kind: UnitType, mode: Option<TankMode>) -> OwnUnitGeometry {
    OwnUnitGeometry {
        square: sq(square),
        kind,
        mode,
    }
}
fn image(mut units: Vec<OwnUnitGeometry>, mines: &[(&str, u32)]) -> OwnGeometry {
    units.sort_by_key(|unit| unit.square);
    OwnGeometry {
        units,
        mines: mines
            .iter()
            .map(|(square, slot)| MineOccurrence {
                square: sq(square),
                slot: *slot,
            })
            .collect(),
        cc_lives: 3,
    }
}
fn effects(before_own: OwnGeometry, after_own: OwnGeometry, facts: Vec<EffectFact>) -> AtomicGroup {
    AtomicGroup::Effects {
        seq: 0,
        before_own,
        after_own,
        facts,
    }
}
fn vision(turn: u32, mut changes: Vec<ObservedCell>) -> AtomicGroup {
    changes.sort_by_key(ObservedCell::square);
    AtomicGroup::Vision {
        seq: 0,
        turn,
        changes,
    }
}
fn witness(square: &str, kind: UnitType) -> EffectFact {
    EffectFact::EnemyDestructionWitnessed {
        square: sq(square),
        kind,
        own_action_ref: None,
    }
}
fn deploy(ordinal: u32, square: &str, kind: &str, minerals: u32) -> AcceptedOwnAction {
    AcceptedOwnAction {
        action_ref: reference(ordinal),
        action: serde_json::from_value(
            json!({"kind":"deploy","timing":"B","color":"w","from":"e1","to":square,"unit":kind}),
        )
        .unwrap(),
        minerals,
        gas: 1,
    }
}
fn admission(actions: Vec<AcceptedOwnAction>) -> AtomicGroup {
    AtomicGroup::Admission { seq: 0, actions }
}
fn finish(
    opening: &Pair<EconomicBoundary>,
    white: Vec<AtomicGroup>,
    black: Vec<AtomicGroup>,
) -> Pair<EconomicBoundary> {
    let make = |previous: &EconomicBoundary, groups: Vec<AtomicGroup>| {
        let profile = rules();
        let mut next = previous.clone();
        next.ordinal += 1;
        next.phase = BoundaryPhase::Settled;
        next.turn += 1;
        next.planning_ordinal += 1;
        next.grant_ordinal += 1;
        next.seq_before = previous.seq_through;
        next.groups = groups;
        let mut own = geometry(previous);
        let mut cells = previous.snapshot.cells.clone();
        let mut bank = previous.snapshot.own.minerals;
        let mut gas = previous.snapshot.own.gas;
        for group in &next.groups {
            match group {
                AtomicGroup::Admission { actions, .. } => {
                    for action in actions {
                        bank -= action.minerals;
                        gas -= action.gas;
                    }
                }
                AtomicGroup::Effects { after_own, .. } => own = after_own.clone(),
                AtomicGroup::Vision { changes, .. } => {
                    for cell in changes {
                        cells[cell.square().index()] = cell.clone();
                    }
                }
                _ => panic!(),
            }
        }
        let mut final_cells = cells.clone();
        for cell in &mut final_cells {
            if matches!(cell, ObservedCell::Lit { piece: Some(piece), .. } if piece.color == previous.side)
                && !own.units.iter().any(|unit| unit.square == cell.square())
            {
                *cell = ObservedCell::Lit {
                    square: cell.square(),
                    piece: None,
                };
            }
        }
        for unit in &own.units {
            final_cells[unit.square.index()] = ObservedCell::Lit {
                square: unit.square,
                piece: Some(ObservedPiece {
                    color: previous.side,
                    kind: unit.kind,
                }),
            };
        }
        let changes: Vec<_> = final_cells
            .iter()
            .zip(&cells)
            .filter(|(left, right)| left != right)
            .map(|(cell, _)| cell.clone())
            .collect();
        if !changes.is_empty() {
            next.groups.push(vision(next.turn, changes));
        }
        let entitlement = profile.income_at(next.turn).unwrap();
        let credited = entitlement.min(profile.mineral_bank_cap - bank);
        let capacity = profile.gas_capacity_at(next.turn).unwrap();
        next.groups.push(AtomicGroup::Settlement {
            seq: 0,
            entitlement,
            credited,
            gas_before_reset: gas,
            next_gas_capacity: capacity,
        });
        next.snapshot.turn = next.turn;
        next.snapshot.cells = final_cells;
        next.snapshot.own.minerals = bank + credited;
        next.snapshot.own.gas = 0;
        next.snapshot.own.gas_income = capacity;
        next.snapshot.own.cc_lives = own.cc_lives;
        next.snapshot.own.pieces = own
            .units
            .iter()
            .map(|unit| OwnPiece {
                square: unit.square,
                kind: unit.kind,
            })
            .collect();
        next.snapshot.own.sieged_tanks = own
            .units
            .iter()
            .filter(|unit| unit.mode == Some(TankMode::Siege))
            .map(|unit| unit.square)
            .collect();
        next.snapshot.own.mines = own.mines.iter().map(|mine| mine.square).collect();
        reseq(&mut next);
        next
    };
    Pair {
        w: make(&opening.w, white),
        b: make(&opening.b, black),
    }
}
fn start(initial: &Pair<EconomicBoundary>) -> FeatureInputPair {
    FeatureInputPair::initialize(rules(), initial, &mut LedgerWork::new()).unwrap()
}
fn advance(input: &mut FeatureInputPair, next: &Pair<EconomicBoundary>) {
    assert_eq!(
        input.advance(next, &mut LedgerWork::new()).unwrap(),
        AdvanceDisposition::Advanced
    );
}
fn read(input: &FeatureInputPair, side: Side) -> FeatureInput {
    input.input(side, &mut LedgerWork::new()).unwrap()
}
fn reject(input: &mut FeatureInputPair, next: &Pair<EconomicBoundary>, code: LedgerErrorCode) {
    assert_eq!(
        input
            .advance(next, &mut LedgerWork::new())
            .unwrap_err()
            .code,
        code
    );
}

#[derive(Clone, Copy, Default)]
struct Scans {
    losses: u64,
    deployments: u64,
    witnesses: u64,
}

fn seed_invoice(view: &AuthorizedView, scans: Scans) -> u64 {
    let units = view.own.pieces.len() as u64;
    let mines = view.own.mines.len() as u64;
    let snapshot = 8 * (64 + units + mines + view.own.sieged_tanks.len() as u64);
    128 + snapshot
        + 16 * 64
        + 32 * 64
        + 64
        + 192 * (units + mines)
        + 32 * (scans.losses + scans.deployments + scans.witnesses)
        + 32 * mines
}
fn innovation_invoice(
    prior: &AuthorizedView,
    current: &AuthorizedView,
    boundary: &EconomicBoundary,
) -> u64 {
    let mut amount = 128 + 768 + 3 * 64 + 100 * 64 + 32 * 64;
    amount += 16
        * (prior.own.pieces.len()
            + prior.own.mines.len()
            + current.own.pieces.len()
            + current.own.mines.len()) as u64;
    for group in &boundary.groups {
        amount += 8;
        match group {
            AtomicGroup::Effects {
                before_own,
                after_own,
                facts,
                ..
            } => {
                amount += 16 * 64 + 128 * facts.len() as u64;
                amount += 16
                    * (before_own.units.len()
                        + before_own.mines.len()
                        + after_own.units.len()
                        + after_own.mines.len()) as u64;
            }
            AtomicGroup::Vision { changes, .. } => amount += 100 * changes.len() as u64,
            _ => {}
        }
    }
    amount
}
fn input_invoice(view: &AuthorizedView, scans: Scans) -> u64 {
    seed_invoice(view, scans)
        + 128
        + 192 * (view.own.pieces.len() + view.own.mines.len()) as u64
        + 128
        + 3 * 64
}

#[test]
fn new_structural_fixture_preserves_transient_assertions_and_counts_each_identical_witness_entry() {
    let case = fixture();
    assert_eq!(
        case.origin,
        "structural-hand-authored; not native execution or authority evidence"
    );
    let mut input = start(&case.initial);
    let initial = read(&input, Side::White);
    assert_eq!(initial.version, FEATURE_INPUT_VERSION);
    assert_eq!(initial.innovation.values, [0, 0, 0]);
    assert!(initial.innovation.grant.is_none());
    advance(&mut input, &opened(&case.initial));
    advance(&mut input, &case.settled);
    for side in [Side::White, Side::Black] {
        let value = read(&input, side);
        assert_eq!(value.innovation.values, case.expected.get(side).values);
        assert_eq!(value.innovation.bins, case.expected.get(side).bins);
        assert_eq!(
            value.innovation.grant,
            Some(FeatureGrant {
                grant_ordinal: 1,
                settled_turn: 1,
                entitlement: 1,
                credited: 1
            })
        );
    }
    let value = read(&input, Side::White);
    assert!(value.innovation.marine_anchors[sq("a6").index()]);
    assert!(value.memory[sq("a6").index()].is_none());
    assert_eq!(
        value.memory[sq("b6").index()].unwrap().kind,
        UnitType::Queen
    );
    assert_eq!(
        value.memory[sq("b6").index()].unwrap().last_observed_turn,
        0
    );
    assert_eq!(
        value.memory[sq("c6").index()].unwrap().last_observed_turn,
        1
    );
    assert_eq!(value.enemy_replacement_loss_lower_bound, 2);
    assert!(value.innovation.own_geometry.iter().all(|bit| !bit));
}

#[test]
fn casualty_before_empty_does_not_invent_erasure_and_nonmatching_casualty_does_not_clear_memory() {
    for (victim, expected) in [(UnitType::Pawn, [0, 1, 0]), (UnitType::Knight, [0, 3, 1])] {
        let mut origin = tiny(0, 3);
        origin.w.snapshot.cells[sq("a6").index()] = lit("a6", Some(UnitType::Pawn), Side::Black);
        let mut input = start(&origin);
        let open = opened(&origin);
        advance(&mut input, &open);
        let own = geometry(&open.w);
        let next = finish(
            &open,
            vec![
                effects(own.clone(), own, vec![witness("a6", victim)]),
                vision(0, vec![lit("a6", None, Side::White)]),
            ],
            vec![],
        );
        advance(&mut input, &next);
        assert_eq!(read(&input, Side::White).innovation.values, expected);
    }
}

#[test]
fn assertion_keys_deduplicate_square_kind_and_turn_without_erasing_transient_marine_anchors() {
    let origin = tiny(0, 3);
    let mut input = start(&origin);
    let open = opened(&origin);
    advance(&mut input, &open);
    let next = finish(
        &open,
        vec![
            vision(0, vec![lit("a6", Some(UnitType::Pawn), Side::Black)]),
            vision(0, vec![unknown("a6")]),
            vision(0, vec![lit("a6", Some(UnitType::Pawn), Side::Black)]),
            vision(0, vec![lit("a6", Some(UnitType::Knight), Side::Black)]),
            vision(0, vec![unknown("a6")]),
            vision(1, vec![lit("a6", Some(UnitType::Pawn), Side::Black)]),
        ],
        vec![],
    );
    advance(&mut input, &next);
    let value = read(&input, Side::White);
    assert_eq!(value.innovation.values, [5, 0, 0]);
    assert_eq!(value.innovation.bins, [2, 0, 0]);
    assert!(value.innovation.marine_anchors[sq("a6").index()]);
    assert_eq!(
        value.memory[sq("a6").index()].unwrap().last_observed_turn,
        1
    );
}

#[test]
fn unchanged_and_revealed_to_lit_enemy_continuity_refreshes_memory_without_new_y1() {
    let mut origin = tiny(0, 3);
    origin.w.snapshot.cells[sq("a6").index()] = revealed("a6", UnitType::Pawn);
    let mut input = start(&origin);
    let initial = read(&input, Side::White);
    assert_eq!(initial.innovation.values, [0, 0, 0]);
    assert!(!initial.ever_lit[sq("a6").index()]);
    let mut open = opened(&origin);
    open.w.groups.push(vision(
        0,
        vec![lit("a6", Some(UnitType::Pawn), Side::Black)],
    ));
    open.w.snapshot.cells[sq("a6").index()] = lit("a6", Some(UnitType::Pawn), Side::Black);
    reseq(&mut open.w);
    advance(&mut input, &open);
    let value = read(&input, Side::White);
    assert_eq!(value.innovation.values, [0, 0, 0]);
    assert!(value.ever_lit[sq("a6").index()]);
    let next = finish(&open, vec![], vec![]);
    advance(&mut input, &next);
    let value = read(&input, Side::White);
    assert_eq!(value.innovation.values, [0, 0, 0]);
    assert!(!value.innovation.marine_anchors[sq("a6").index()]);
    assert_eq!(
        value.memory[sq("a6").index()].unwrap().last_observed_turn,
        1
    );
    assert_eq!(value.memory[sq("a6").index()].unwrap().square, sq("a6"));
}

#[test]
fn stale_memory_outside_the_bitmap_survives_and_can_be_reobserved_without_invalid_indexing() {
    let mut origin = tiny(0, 3);
    origin.w.snapshot.cells[sq("a6").index()] = lit("a6", Some(UnitType::Pawn), Side::Black);
    let mut input = start(&origin);
    let mut open = opened(&origin);
    open.w.groups.push(vision(0, vec![unknown("a6")]));
    open.w.snapshot.cells[sq("a6").index()] = unknown("a6");
    reseq(&mut open.w);
    advance(&mut input, &open);
    for turn in 1..=3 {
        let next = finish(&open, vec![], vec![]);
        advance(&mut input, &next);
        let value = read(&input, Side::White);
        assert_eq!(value.stamp.turn, turn);
        assert_eq!(value.innovation.values, [0, 0, 0]);
        assert_eq!(
            value.memory[sq("a6").index()].unwrap().last_observed_turn,
            0
        );
        open = opened(&next);
        if turn == 3 {
            open.w.groups.push(vision(
                turn,
                vec![lit("a6", Some(UnitType::Knight), Side::Black)],
            ));
            open.w.snapshot.cells[sq("a6").index()] =
                lit("a6", Some(UnitType::Knight), Side::Black);
            reseq(&mut open.w);
        }
        advance(&mut input, &open);
    }
    let value = read(&input, Side::White);
    assert_eq!(value.innovation.values, [3, 0, 0]);
    assert_eq!(
        value.memory[sq("a6").index()].unwrap().last_observed_turn,
        3
    );
    assert!(value.innovation.grant.is_none());
}

#[test]
fn remembered_empty_squares_are_distinct_and_own_occupants_clear_without_y3() {
    for (count, bin) in [(0, 0), (1, 1), (2, 2), (3, 2)] {
        let mut origin = tiny(0, 3);
        origin.w.snapshot.cells[sq("a6").index()] = lit("a6", Some(UnitType::Pawn), Side::Black);
        origin.w.snapshot.cells[sq("b6").index()] = lit("b6", Some(UnitType::Queen), Side::Black);
        origin.w.snapshot.cells[sq("c6").index()] = lit("c6", Some(UnitType::Bishop), Side::Black);
        let mut input = start(&origin);
        let open = opened(&origin);
        advance(&mut input, &open);
        let mut groups = Vec::new();
        if count > 0 {
            groups.push(vision(0, vec![lit("a6", None, Side::White)]));
            groups.push(vision(
                0,
                vec![lit("a6", Some(UnitType::Pawn), Side::Black)],
            ));
            groups.push(vision(0, vec![lit("a6", None, Side::White)]));
        }
        if count >= 2 {
            groups.push(vision(0, vec![lit("b6", None, Side::White)]));
        }
        if count == 3 {
            groups.push(vision(0, vec![lit("c6", None, Side::White)]));
        }
        let next = finish(&open, groups, vec![]);
        advance(&mut input, &next);
        assert_eq!(read(&input, Side::White).innovation.values, [0, 0, count]);
        assert_eq!(read(&input, Side::White).innovation.bins, [0, 0, bin]);
    }
    let mut origin = tiny(0, 3);
    origin.w.snapshot.cells[sq("a6").index()] = lit("a6", Some(UnitType::Pawn), Side::Black);
    let mut input = start(&origin);
    let open = opened(&origin);
    advance(&mut input, &open);
    let next = finish(
        &open,
        vec![
            vision(0, vec![lit("a6", Some(UnitType::Knight), Side::White)]),
            vision(0, vec![unknown("a6")]),
        ],
        vec![],
    );
    advance(&mut input, &next);
    let value = read(&input, Side::White);
    assert_eq!(value.innovation.values, [0, 0, 0]);
    assert!(value.memory[sq("a6").index()].is_none());
    assert!(value.innovation.own_geometry[sq("a6").index()]);
}

#[test]
fn y1_and_y2_bins_cover_zero_three_four_eight_nine_and_exclude_cc_replacement() {
    let cases = [
        (vec![], 0, 0),
        (vec![UnitType::Pawn], 1, 1),
        (vec![UnitType::Knight], 3, 1),
        (vec![UnitType::Pawn, UnitType::Knight], 4, 2),
        (vec![UnitType::Bishop, UnitType::Rook], 8, 2),
        (vec![UnitType::Queen], 9, 3),
        (vec![UnitType::King], 0, 0),
    ];
    for (kinds, expected, bin) in cases {
        let origin = tiny(0, 3);
        let mut input = start(&origin);
        let open = opened(&origin);
        advance(&mut input, &open);
        let names = ["a6", "b6"];
        let cells = kinds
            .iter()
            .zip(names)
            .map(|(kind, square)| lit(square, Some(*kind), Side::Black))
            .collect();
        let mut groups = Vec::new();
        if !kinds.is_empty() {
            groups.push(vision(0, cells));
        }
        let facts: Vec<_> = kinds
            .iter()
            .zip(names)
            .filter(|(kind, _)| **kind != UnitType::King)
            .map(|(kind, square)| witness(square, *kind))
            .collect();
        if !facts.is_empty() {
            let own = geometry(&open.w);
            groups.push(effects(own.clone(), own, facts));
        }
        let next = finish(&open, groups, vec![]);
        advance(&mut input, &next);
        let value = read(&input, Side::White);
        assert_eq!(value.innovation.values[0], expected);
        assert_eq!(value.innovation.bins[0], bin);
        assert_eq!(value.innovation.values[1], expected);
        assert_eq!(value.innovation.bins[1], bin);
    }
}

#[test]
fn geometry_uses_immutable_before_subjects_and_excludes_a_cc_moving_after_another_mover() {
    let origin = initial(
        view(
            Side::White,
            0,
            3,
            &[("a1", UnitType::Pawn), ("e1", UnitType::King)],
            &[],
        ),
        view(Side::Black, 0, 3, &[("e8", UnitType::King)], &[]),
    );
    let mut input = start(&origin);
    let open = opened(&origin);
    advance(&mut input, &open);
    let after = image(
        vec![
            unit("e1", UnitType::Pawn, None),
            unit("h8", UnitType::King, None),
        ],
        &[],
    );
    let next = finish(
        &open,
        vec![effects(
            geometry(&open.w),
            after,
            vec![
                EffectFact::UnitMoved {
                    subject: before("a1"),
                    from: sq("a1"),
                    to: sq("e1"),
                },
                EffectFact::UnitMoved {
                    subject: before("e1"),
                    from: sq("e1"),
                    to: sq("h8"),
                },
            ],
        )],
        vec![],
    );
    advance(&mut input, &next);
    let value = read(&input, Side::White);
    assert!(value.innovation.own_geometry[sq("a1").index()]);
    assert!(value.innovation.own_geometry[sq("e1").index()]);
    assert!(!value.innovation.own_geometry[sq("h8").index()]);
    assert!(
        value
            .own_units
            .windows(2)
            .all(|pair| pair[0].square < pair[1].square)
    );
}

#[test]
fn geometry_includes_intermediate_own_moves_and_transient_born_mines_not_wasted_targets() {
    let origin = initial(
        view(
            Side::White,
            21,
            12,
            &[
                ("a1", UnitType::Pawn),
                ("e1", UnitType::King),
                ("f1", UnitType::Knight),
            ],
            &[],
        ),
        view(Side::Black, 21, 12, &[("e8", UnitType::King)], &[]),
    );
    let mut input = start(&origin);
    let open = opened(&origin);
    advance(&mut input, &open);
    let action: Action =
        serde_json::from_value(json!({"kind":"spiderMine","timing":"B","color":"w","from":"f1"}))
            .unwrap();
    let next = finish(
        &open,
        vec![
            admission(vec![AcceptedOwnAction {
                action_ref: reference(0),
                action,
                minerals: 0,
                gas: 1,
            }]),
            effects(
                geometry(&open.w),
                image(
                    vec![
                        unit("e1", UnitType::King, None),
                        unit("f1", UnitType::Knight, None),
                    ],
                    &[],
                ),
                vec![
                    EffectFact::UnitMoved {
                        subject: before("a1"),
                        from: sq("a1"),
                        to: sq("b1"),
                    },
                    EffectFact::UnitMoved {
                        subject: before("a1"),
                        from: sq("b1"),
                        to: sq("c1"),
                    },
                    EffectFact::UnitDestroyed {
                        subject: before("a1"),
                        square: sq("c1"),
                        kind: UnitType::Pawn,
                    },
                    EffectFact::MineBorn {
                        action_ref: reference(0),
                        square: sq("g2"),
                    },
                    EffectFact::MineRemoved {
                        subject: MineSubject::BornMine {
                            action_ref: reference(0),
                        },
                    },
                ],
            ),
        ],
        vec![],
    );
    advance(&mut input, &next);
    let value = read(&input, Side::White);
    for square in ["a1", "b1", "c1", "f1", "g2"] {
        assert!(value.innovation.own_geometry[sq(square).index()]);
    }
    assert!(!value.innovation.own_geometry[sq("e1").index()]);
    assert!(value.own_mines.is_empty());
    assert_eq!(value.own_paid_destroyed, 0);
}

#[test]
fn mine_identity_survives_occurrence_slot_reassignment() {
    let origin = initial(
        view(
            Side::White,
            0,
            3,
            &[("e1", UnitType::King)],
            &["e3", "e3", "f3"],
        ),
        view(Side::Black, 0, 3, &[("e8", UnitType::King)], &[]),
    );
    let mut input = start(&origin);
    let prior = read(&input, Side::White);
    let survivor = prior.own_mines[1].id;
    assert_ne!(prior.own_mines[0].id, survivor);
    let open = opened(&origin);
    advance(&mut input, &open);
    let next = finish(
        &open,
        vec![effects(
            geometry(&open.w),
            image(
                vec![unit("e1", UnitType::King, None)],
                &[("e3", 0), ("f3", 0)],
            ),
            vec![EffectFact::MineRemoved {
                subject: MineSubject::BeforeMine {
                    square: sq("e3"),
                    slot: 0,
                },
            }],
        )],
        vec![],
    );
    advance(&mut input, &next);
    let current = read(&input, Side::White);
    assert_eq!(
        (
            current.own_mines[0].id,
            current.own_mines[0].square,
            current.own_mines[0].slot
        ),
        (survivor, sq("e3"), 0)
    );
    assert_eq!(current.own_mines[1].id, prior.own_mines[2].id);
    assert!(current.innovation.own_geometry[sq("e3").index()]);
    assert!(current.innovation.own_geometry[sq("f3").index()]);
}

#[test]
fn selected_seed_totals_distinguish_materialized_loss_waste_and_witness_replacement() {
    let origin = tiny(21, 12);
    let mut input = start(&origin);
    let open = opened(&origin);
    advance(&mut input, &open);
    let own = geometry(&open.w);
    let next = finish(
        &open,
        vec![
            admission(vec![deploy(0, "d1", "p", 1), deploy(1, "c1", "p", 1)]),
            effects(
                own.clone(),
                own,
                vec![
                    EffectFact::UnitBorn {
                        action_ref: reference(0),
                        square: sq("d1"),
                        kind: UnitType::Pawn,
                        mode: None,
                    },
                    EffectFact::UnitDestroyed {
                        subject: UnitSubject::BornUnit {
                            action_ref: reference(0),
                        },
                        square: sq("d1"),
                        kind: UnitType::Pawn,
                    },
                    EffectFact::DeploymentUnmaterialized {
                        action_ref: reference(1),
                    },
                    witness("a6", UnitType::Rook),
                ],
            ),
        ],
        vec![],
    );
    advance(&mut input, &next);
    let value = read(&input, Side::White);
    assert_eq!(
        (
            value.own_paid_destroyed,
            value.own_paid_wasted,
            value.enemy_replacement_loss_lower_bound
        ),
        (1, 1, 5)
    );
    assert_eq!(value.innovation.values, [0, 5, 0]);
    assert!(value.innovation.own_geometry[sq("d1").index()]);
    assert!(!value.innovation.own_geometry[sq("c1").index()]);
    assert_eq!(
        value.innovation.grant.unwrap(),
        FeatureGrant {
            grant_ordinal: 1,
            settled_turn: 22,
            entitlement: 3,
            credited: 2
        }
    );
    let expected = input_invoice(
        &next.w.snapshot,
        Scans {
            losses: 1,
            deployments: 2,
            witnesses: 1,
        },
    );
    let mut work = LedgerWork::with_limit(expected).unwrap();
    input.input(Side::White, &mut work).unwrap();
    assert_eq!(work.used(), expected);
}

#[test]
fn established_explicit_birth_and_promotion_modes_and_paid_identity_are_not_reconstructed_from_reports()
 {
    for mode in [TankMode::Tank, TankMode::Siege] {
        let origin = tiny(21, 12);
        let mut input = start(&origin);
        let open = opened(&origin);
        advance(&mut input, &open);
        let after = image(
            vec![
                unit("d1", UnitType::Rook, Some(mode)),
                unit("e1", UnitType::King, None),
            ],
            &[],
        );
        let next = finish(
            &open,
            vec![
                admission(vec![deploy(0, "d1", "r", 5)]),
                effects(
                    geometry(&open.w),
                    after,
                    vec![EffectFact::UnitBorn {
                        action_ref: reference(0),
                        square: sq("d1"),
                        kind: UnitType::Rook,
                        mode: Some(mode),
                    }],
                ),
            ],
            vec![],
        );
        advance(&mut input, &next);
        let value = read(&input, Side::White);
        assert_eq!(
            (
                value.own_units[0].square,
                value.own_units[0].mode,
                value.own_units[0].paid_basis
            ),
            (sq("d1"), Some(mode), 5)
        );
        assert_eq!((value.own_paid_destroyed, value.own_paid_wasted), (0, 0));
        let origin = tiny(21, 12);
        let mut promoted = start(&origin);
        let open = opened(&origin);
        advance(&mut promoted, &open);
        let next = finish(
            &open,
            vec![
                admission(vec![deploy(0, "c7", "p", 1)]),
                effects(
                    geometry(&open.w),
                    image(
                        vec![
                            unit("c7", UnitType::Rook, Some(mode)),
                            unit("e1", UnitType::King, None),
                        ],
                        &[],
                    ),
                    vec![
                        EffectFact::UnitBorn {
                            action_ref: reference(0),
                            square: sq("c7"),
                            kind: UnitType::Pawn,
                            mode: None,
                        },
                        EffectFact::UnitTransformed {
                            subject: UnitSubject::BornUnit {
                                action_ref: reference(0),
                            },
                            from_type: UnitType::Pawn,
                            to_type: UnitType::Rook,
                            to_mode: Some(mode),
                        },
                    ],
                ),
            ],
            vec![],
        );
        advance(&mut promoted, &next);
        let value = read(&promoted, Side::White);
        assert_eq!(
            (
                value.own_units[0].kind,
                value.own_units[0].mode,
                value.own_units[0].paid_basis
            ),
            (UnitType::Rook, Some(mode), 1)
        );
        assert_eq!(value.own_paid_wasted, 0);
    }
}

#[test]
fn initial_and_open_do_not_grant_and_each_checked_tier_settlement_reports_its_own_credit() {
    for (turn, entitlement) in [(0, 1), (10, 2), (20, 3)] {
        let origin = tiny(turn, 3);
        let mut input = start(&origin);
        assert!(read(&input, Side::White).innovation.grant.is_none());
        let open = opened(&origin);
        advance(&mut input, &open);
        assert!(read(&input, Side::White).innovation.grant.is_none());
        let next = finish(&open, vec![], vec![]);
        advance(&mut input, &next);
        assert_eq!(
            read(&input, Side::White).innovation.grant,
            Some(FeatureGrant {
                grant_ordinal: 1,
                settled_turn: turn + 1,
                entitlement,
                credited: entitlement
            })
        );
    }
    let mut origin = tiny(20, 12);
    origin.b.snapshot.own.minerals = 11;
    let mut input = start(&origin);
    let open = opened(&origin);
    advance(&mut input, &open);
    let next = finish(&open, vec![], vec![]);
    advance(&mut input, &next);
    assert_eq!(
        read(&input, Side::White).innovation.grant.unwrap().credited,
        0
    );
    assert_eq!(
        read(&input, Side::Black).innovation.grant.unwrap().credited,
        1
    );
    assert_eq!(
        read(&input, Side::White)
            .innovation
            .grant
            .unwrap()
            .entitlement,
        3
    );
}

#[test]
fn terminal_begin_native_turn_advances_do_not_manufacture_feature_grants() {
    for turn in [0, 10, 20] {
        let origin = tiny(turn, 3);
        let mut input = start(&origin);
        let mut terminal = opened(&origin);
        for side in [Side::White, Side::Black] {
            let boundary = terminal.get_mut(side);
            boundary.turn += 1;
            boundary.snapshot.turn = boundary.turn;
            let before = geometry(origin.get(side));
            let mut after = before.clone();
            after.cc_lives = 0;
            boundary.snapshot.own.cc_lives = 0;
            boundary.groups.push(effects(
                before,
                after,
                vec![EffectFact::CcLivesChanged {
                    before: 3,
                    after: 0,
                }],
            ));
            reseq(boundary);
        }
        advance(&mut input, &terminal);
        let value = read(&input, Side::White);
        assert_eq!(value.stamp.turn, turn + 1);
        assert_eq!(value.stamp.grant_ordinal, 0);
        assert!(value.innovation.grant.is_none());
        assert_eq!(value.innovation.values, [0, 0, 0]);
        assert_eq!(value.view.own.minerals, 3);
        assert_eq!(value.view.own.gas, origin.w.snapshot.own.gas_income);
    }
}

#[test]
fn immediate_replay_validates_first_retains_latest_innovation_and_grant_and_has_no_adapter_refold_fee()
 {
    let case = fixture();
    let mut input = start(&case.initial);
    let open = opened(&case.initial);
    advance(&mut input, &open);
    advance(&mut input, &case.settled);
    let before = read(&input, Side::White);
    let ledger = LedgerPair::initialize(rules(), &case.initial, &mut LedgerWork::new()).unwrap();
    let ledger = ledger.advance(&open, &mut LedgerWork::new()).unwrap();
    let ledger = ledger
        .advance(&case.settled, &mut LedgerWork::new())
        .unwrap();
    let mut old_work = LedgerWork::new();
    ledger.advance(&case.settled, &mut old_work).unwrap();
    let mut work = LedgerWork::with_limit(128 + old_work.used()).unwrap();
    assert_eq!(
        input.advance(&case.settled, &mut work).unwrap(),
        AdvanceDisposition::Replayed
    );
    assert_eq!(work.used(), 128 + old_work.used());
    assert_eq!(read(&input, Side::White), before);
    let mut short = LedgerWork::with_limit(work.used() - 1).unwrap();
    assert_eq!(
        input.advance(&case.settled, &mut short).unwrap_err().code,
        LedgerErrorCode::Budget
    );
    let mut conflicting = case.settled;
    conflicting.w.snapshot.own.minerals = 5;
    reject(&mut input, &conflicting, LedgerErrorCode::Identity);
    assert_eq!(read(&input, Side::White), before);
}

#[test]
fn old_gap_wrong_side_and_invalid_checked_updates_preserve_both_inputs() {
    let origin = tiny(0, 3);
    let mut input = start(&origin);
    let open = opened(&origin);
    advance(&mut input, &open);
    let white = read(&input, Side::White);
    let black = read(&input, Side::Black);
    reject(&mut input, &origin, LedgerErrorCode::Sequence);
    let mut gap = finish(&open, vec![], vec![]);
    gap.w.ordinal += 1;
    gap.b.ordinal += 1;
    reject(&mut input, &gap, LedgerErrorCode::Sequence);
    let mut swapped = finish(&open, vec![], vec![]);
    std::mem::swap(&mut swapped.w, &mut swapped.b);
    reject(&mut input, &swapped, LedgerErrorCode::Identity);
    let mut bad = finish(&open, vec![], vec![]);
    bad.b.snapshot.own.minerals = 5;
    reject(&mut input, &bad, LedgerErrorCode::Conservation);
    assert_eq!(read(&input, Side::White), white);
    assert_eq!(read(&input, Side::Black), black);
    assert_eq!(input.last_boundaries(), &open);
}

#[test]
fn second_seat_adapter_scratch_refusal_occurs_after_checked_ledger_and_white_adapter_without_publication()
 {
    let origin = tiny(0, 3);
    let mut input = start(&origin);
    let open = opened(&origin);
    let baseline = LedgerPair::initialize(rules(), &origin, &mut LedgerWork::new()).unwrap();
    let mut ledger_work = LedgerWork::new();
    baseline.advance(&open, &mut ledger_work).unwrap();
    let scans = Scans::default();
    let before_second_scratch = 128
        + ledger_work.used()
        + seed_invoice(&origin.w.snapshot, scans)
        + seed_invoice(&open.w.snapshot, scans)
        + innovation_invoice(&origin.w.snapshot, &open.w.snapshot, &open.w)
        + seed_invoice(&origin.b.snapshot, scans)
        + seed_invoice(&open.b.snapshot, scans);
    let mut work = LedgerWork::with_limit(before_second_scratch + 1088 - 1).unwrap();
    assert_eq!(
        input.advance(&open, &mut work).unwrap_err().code,
        LedgerErrorCode::Budget
    );
    assert_eq!(work.used(), before_second_scratch);
    assert_eq!(input.last_boundaries(), &origin);
    assert_eq!(read(&input, Side::White).innovation.values, [0, 0, 0]);
    assert_eq!(read(&input, Side::Black).stamp.ordinal, 0);
    advance(&mut input, &open);
    assert_eq!(read(&input, Side::White).stamp.ordinal, 1);
}

#[test]
fn exact_initialization_invoice_adds_prepaid_seeds_and_innovations_to_existing_ledger_work() {
    let mut origin = tiny(21, 12);
    origin.w.snapshot.own.mines = vec![sq("a3"), sq("a3"), sq("h3")];
    let mut ledger_work = LedgerWork::new();
    LedgerPair::initialize(rules(), &origin, &mut ledger_work).unwrap();
    let extra = 128
        + seed_invoice(&origin.w.snapshot, Scans::default())
        + seed_invoice(&origin.b.snapshot, Scans::default())
        + innovation_invoice(&origin.w.snapshot, &origin.w.snapshot, &origin.w)
        + innovation_invoice(&origin.b.snapshot, &origin.b.snapshot, &origin.b);
    let expected = ledger_work.used() + extra;
    let mut exact = LedgerWork::with_limit(expected).unwrap();
    let input = FeatureInputPair::initialize(rules(), &origin, &mut exact).unwrap();
    assert_eq!(exact.used(), expected);
    assert_eq!(input.last_boundaries(), &origin);
    let mut short = LedgerWork::with_limit(expected - 1).unwrap();
    assert_eq!(
        FeatureInputPair::initialize(rules(), &origin, &mut short)
            .unwrap_err()
            .code,
        LedgerErrorCode::Budget
    );
    let mut early = LedgerWork::with_limit(127).unwrap();
    assert_eq!(
        FeatureInputPair::initialize(rules(), &origin, &mut early)
            .unwrap_err()
            .code,
        LedgerErrorCode::Budget
    );
    assert_eq!(early.used(), 0);
}

#[test]
fn exact_advance_invoice_covers_every_group_fact_subject_geometry_observation_and_reconciliation() {
    let case = fixture();
    let open = opened(&case.initial);
    let ledger = LedgerPair::initialize(rules(), &case.initial, &mut LedgerWork::new()).unwrap();
    let ledger = ledger.advance(&open, &mut LedgerWork::new()).unwrap();
    let mut ledger_work = LedgerWork::new();
    ledger.advance(&case.settled, &mut ledger_work).unwrap();
    let expected = 128
        + ledger_work.used()
        + seed_invoice(&open.w.snapshot, Scans::default())
        + seed_invoice(
            &case.settled.w.snapshot,
            Scans {
                witnesses: 2,
                ..Scans::default()
            },
        )
        + innovation_invoice(&open.w.snapshot, &case.settled.w.snapshot, &case.settled.w)
        + seed_invoice(&open.b.snapshot, Scans::default())
        + seed_invoice(&case.settled.b.snapshot, Scans::default())
        + innovation_invoice(&open.b.snapshot, &case.settled.b.snapshot, &case.settled.b);
    let mut input = start(&case.initial);
    advance(&mut input, &open);
    let mut short = LedgerWork::with_limit(expected - 1).unwrap();
    assert_eq!(
        input.advance(&case.settled, &mut short).unwrap_err().code,
        LedgerErrorCode::Budget
    );
    assert_eq!(input.last_boundaries(), &open);
    let mut exact = LedgerWork::with_limit(expected).unwrap();
    advance_with_exact(&mut input, &case.settled, &mut exact);
    assert_eq!(exact.used(), expected);
}

fn advance_with_exact(
    input: &mut FeatureInputPair,
    next: &Pair<EconomicBoundary>,
    work: &mut LedgerWork,
) {
    assert_eq!(
        input.advance(next, work).unwrap(),
        AdvanceDisposition::Advanced
    );
}

#[test]
fn detached_input_invoice_and_conversion_precharge_refuse_before_public_vector_allocation() {
    let origin = tiny(0, 3);
    let input = start(&origin);
    let seed = seed_invoice(&origin.w.snapshot, Scans::default());
    let expected = input_invoice(&origin.w.snapshot, Scans::default());
    let mut exact = LedgerWork::with_limit(expected).unwrap();
    input.input(Side::White, &mut exact).unwrap();
    assert_eq!(exact.used(), expected);
    let mut conversion_refusal = LedgerWork::with_limit(seed + 127).unwrap();
    assert_eq!(
        input
            .input(Side::White, &mut conversion_refusal)
            .unwrap_err()
            .code,
        LedgerErrorCode::Budget
    );
    assert_eq!(conversion_refusal.used(), seed);
    let mut seed_refusal = LedgerWork::with_limit(127).unwrap();
    assert_eq!(
        input
            .input(Side::White, &mut seed_refusal)
            .unwrap_err()
            .code,
        LedgerErrorCode::Budget
    );
    assert_eq!(seed_refusal.used(), 0);
    let mut short = LedgerWork::with_limit(expected - 1).unwrap();
    assert_eq!(
        input.input(Side::White, &mut short).unwrap_err().code,
        LedgerErrorCode::Budget
    );
}

#[test]
fn caller_meter_is_shared_across_initialization_both_seats_readouts_and_refusal_without_reset() {
    let origin = tiny(0, 3);
    let mut measured = LedgerWork::new();
    FeatureInputPair::initialize(rules(), &origin, &mut measured).unwrap();
    let total = measured.used() + input_invoice(&origin.w.snapshot, Scans::default());
    let mut work = LedgerWork::with_limit(total).unwrap();
    let input = FeatureInputPair::initialize(rules(), &origin, &mut work).unwrap();
    input.input(Side::White, &mut work).unwrap();
    assert_eq!(work.used(), total);
    assert_eq!(
        input.input(Side::Black, &mut work).unwrap_err().code,
        LedgerErrorCode::Budget
    );
    assert_eq!(work.used(), total);
    assert_eq!(input.last_boundaries(), &origin);
}

#[test]
fn detached_readout_mutations_do_not_change_checked_state_or_latest_innovation() {
    let case = fixture();
    let mut input = start(&case.initial);
    advance(&mut input, &opened(&case.initial));
    advance(&mut input, &case.settled);
    let expected = read(&input, Side::White);
    let mut detached = read(&input, Side::White);
    detached.view.own.minerals = 0;
    detached.view.cells.clear();
    detached.own_units.clear();
    detached.own_mines.clear();
    detached.memory.fill(None);
    detached.ever_lit.fill(false);
    detached.innovation.values = [999; 3];
    detached.innovation.grant = None;
    detached.innovation.marine_anchors.fill(false);
    detached.innovation.own_geometry.fill(true);
    detached.own_paid_destroyed = u64::MAX;
    detached.own_paid_wasted = u64::MAX;
    detached.enemy_replacement_loss_lower_bound = u64::MAX;
    assert_eq!(read(&input, Side::White), expected);
}

#[test]
fn recipient_hidden_twins_do_not_leak_other_seat_resources_inventory_or_memory_into_selected_input()
{
    let origin = tiny(0, 3);
    let mut twin = origin.clone();
    twin.b.snapshot = view(
        Side::Black,
        0,
        12,
        &[("e8", UnitType::King), ("h8", UnitType::Rook)],
        &["h7", "h7"],
    );
    twin.b.snapshot.own.sieged_tanks = vec![sq("h8")];
    twin.b.snapshot.cells[sq("b2").index()] = lit("b2", Some(UnitType::Queen), Side::White);
    let mut one = start(&origin);
    let mut two = start(&twin);
    assert_eq!(read(&one, Side::White), read(&two, Side::White));
    assert_ne!(read(&one, Side::Black), read(&two, Side::Black));
    let open_one = opened(&origin);
    let open_two = opened(&twin);
    advance(&mut one, &open_one);
    advance(&mut two, &open_two);
    let groups = vec![
        vision(0, vec![lit("a6", Some(UnitType::Pawn), Side::Black)]),
        vision(0, vec![unknown("a6")]),
    ];
    let next_one = finish(&open_one, groups.clone(), vec![]);
    let next_two = finish(&open_two, groups, vec![]);
    advance(&mut one, &next_one);
    advance(&mut two, &next_two);
    assert_eq!(read(&one, Side::White), read(&two, Side::White));
}

#[test]
fn selected_units_sort_detached_file_major_without_changing_lineage_ids_and_support_full_physical_bounds()
 {
    let origin = initial(
        view(
            Side::White,
            0,
            3,
            &[
                ("a1", UnitType::Pawn),
                ("b1", UnitType::Knight),
                ("e1", UnitType::King),
            ],
            &[],
        ),
        view(Side::Black, 0, 3, &[("e8", UnitType::King)], &[]),
    );
    let mut input = start(&origin);
    let prior = read(&input, Side::White);
    let open = opened(&origin);
    advance(&mut input, &open);
    let next = finish(
        &open,
        vec![effects(
            geometry(&open.w),
            image(
                vec![
                    unit("b1", UnitType::Pawn, None),
                    unit("a1", UnitType::Knight, None),
                    unit("e1", UnitType::King, None),
                ],
                &[],
            ),
            vec![
                EffectFact::UnitMoved {
                    subject: before("a1"),
                    from: sq("a1"),
                    to: sq("b1"),
                },
                EffectFact::UnitMoved {
                    subject: before("b1"),
                    from: sq("b1"),
                    to: sq("a1"),
                },
            ],
        )],
        vec![],
    );
    advance(&mut input, &next);
    let value = read(&input, Side::White);
    assert_eq!(value.own_units[0].id, prior.own_units[1].id);
    assert_eq!(value.own_units[1].id, prior.own_units[0].id);
    let mut origin = tiny(0, 3);
    origin.w.snapshot.own.pieces = all_squares()
        .into_iter()
        .map(|square| OwnPiece {
            square,
            kind: UnitType::Pawn,
        })
        .collect();
    origin.w.snapshot.cells = all_squares()
        .into_iter()
        .map(|square| ObservedCell::Lit {
            square,
            piece: Some(ObservedPiece {
                color: Side::White,
                kind: UnitType::Pawn,
            }),
        })
        .collect();
    origin.w.snapshot.own.mines = vec![sq("a1"), sq("a1"), sq("h8")];
    let input = start(&origin);
    let value = read(&input, Side::White);
    assert_eq!((value.own_units.len(), value.own_mines.len()), (64, 3));
    assert!(value.innovation.own_geometry.iter().all(|bit| *bit));
    assert_eq!(value.innovation.values, [0, 0, 0]);
    assert!(value.innovation.marine_anchors.iter().all(|bit| !bit));
}

#[test]
fn later_vision_after_casualty_repopulates_memory_once_while_final_refresh_alone_adds_no_y1() {
    for (kind, turn, value) in [(UnitType::Pawn, 1, 1), (UnitType::Knight, 0, 3)] {
        let mut origin = tiny(0, 3);
        origin.w.snapshot.cells[sq("a6").index()] = lit("a6", Some(UnitType::Pawn), Side::Black);
        let mut input = start(&origin);
        let open = opened(&origin);
        advance(&mut input, &open);
        let own = geometry(&open.w);
        let next = finish(
            &open,
            vec![
                effects(own.clone(), own, vec![witness("a6", UnitType::Pawn)]),
                vision(turn, vec![lit("a6", Some(kind), Side::Black)]),
            ],
            vec![],
        );
        advance(&mut input, &next);
        let result = read(&input, Side::White);
        assert_eq!(result.innovation.values, [value, 1, 0]);
        assert_eq!(result.memory[sq("a6").index()].unwrap().kind, kind);
        assert_eq!(
            result.memory[sq("a6").index()].unwrap().last_observed_turn,
            1
        );
    }
    let origin = tiny(0, 3);
    let mut input = start(&origin);
    let open = opened(&origin);
    advance(&mut input, &open);
    let own = geometry(&open.w);
    let next = finish(
        &open,
        vec![
            vision(0, vec![lit("a6", Some(UnitType::Pawn), Side::Black)]),
            effects(own.clone(), own, vec![witness("a6", UnitType::Pawn)]),
        ],
        vec![],
    );
    advance(&mut input, &next);
    assert_eq!(read(&input, Side::White).innovation.values, [1, 1, 0]);
    assert_eq!(
        read(&input, Side::White).memory[sq("a6").index()]
            .unwrap()
            .last_observed_turn,
        1
    );
}

#[test]
fn black_recipient_innovations_use_its_own_color_and_keep_own_transient_marines_out_of_enemy_anchors()
 {
    let origin = tiny(0, 3);
    let mut input = start(&origin);
    let open = opened(&origin);
    advance(&mut input, &open);
    let own = geometry(&open.b);
    let next = finish(
        &open,
        vec![],
        vec![
            vision(
                0,
                vec![
                    lit("a3", Some(UnitType::Pawn), Side::White),
                    lit("b3", Some(UnitType::Bishop), Side::White),
                    lit("h1", Some(UnitType::Pawn), Side::Black),
                ],
            ),
            effects(own.clone(), own, vec![witness("b3", UnitType::Bishop)]),
            vision(
                0,
                vec![lit("a3", None, Side::Black), unknown("b3"), unknown("h1")],
            ),
        ],
    );
    advance(&mut input, &next);
    let black = read(&input, Side::Black);
    assert_eq!(black.innovation.values, [4, 3, 1]);
    assert!(black.innovation.marine_anchors[sq("a3").index()]);
    assert!(!black.innovation.marine_anchors[sq("h1").index()]);
    assert!(black.innovation.own_geometry[sq("h1").index()]);
    assert!(black.memory[sq("a3").index()].is_none());
    assert!(black.memory[sq("b3").index()].is_none());
    assert_eq!(read(&input, Side::White).innovation.values, [0, 0, 0]);
}

#[test]
fn paid_pawn_identity_survives_promotion_in_a_later_window_with_explicit_mode() {
    for mode in [TankMode::Tank, TankMode::Siege] {
        let origin = tiny(21, 12);
        let mut input = start(&origin);
        let open = opened(&origin);
        advance(&mut input, &open);
        let first = finish(
            &open,
            vec![
                admission(vec![deploy(0, "c7", "p", 1)]),
                effects(
                    geometry(&open.w),
                    image(
                        vec![
                            unit("c7", UnitType::Pawn, None),
                            unit("e1", UnitType::King, None),
                        ],
                        &[],
                    ),
                    vec![EffectFact::UnitBorn {
                        action_ref: reference(0),
                        square: sq("c7"),
                        kind: UnitType::Pawn,
                        mode: None,
                    }],
                ),
            ],
            vec![],
        );
        advance(&mut input, &first);
        let pawn = read(&input, Side::White).own_units[0].id;
        let open = opened(&first);
        advance(&mut input, &open);
        let second = finish(
            &open,
            vec![effects(
                geometry(&open.w),
                image(
                    vec![
                        unit("c7", UnitType::Rook, Some(mode)),
                        unit("e1", UnitType::King, None),
                    ],
                    &[],
                ),
                vec![EffectFact::UnitTransformed {
                    subject: before("c7"),
                    from_type: UnitType::Pawn,
                    to_type: UnitType::Rook,
                    to_mode: Some(mode),
                }],
            )],
            vec![],
        );
        advance(&mut input, &second);
        let value = read(&input, Side::White);
        assert_eq!(
            (
                value.own_units[0].id,
                value.own_units[0].kind,
                value.own_units[0].mode,
                value.own_units[0].paid_basis
            ),
            (pawn, UnitType::Rook, Some(mode), 1)
        );
        assert_eq!((value.own_paid_destroyed, value.own_paid_wasted), (0, 0));
    }
}

#[test]
fn full_observation_change_set_and_last_bitmap_coordinate_stay_bounded() {
    let origin = initial(
        view(Side::White, 0, 3, &[], &[]),
        view(Side::Black, 0, 3, &[("e8", UnitType::King)], &[]),
    );
    let mut input = start(&origin);
    let open = opened(&origin);
    advance(&mut input, &open);
    let changes = all_squares()
        .into_iter()
        .map(|square| ObservedCell::Lit {
            square,
            piece: Some(ObservedPiece {
                color: Side::Black,
                kind: UnitType::Pawn,
            }),
        })
        .collect();
    let next = finish(&open, vec![vision(1, changes)], vec![]);
    advance(&mut input, &next);
    let value = read(&input, Side::White);
    assert_eq!(value.innovation.values, [64, 0, 0]);
    assert_eq!(value.innovation.bins, [3, 0, 0]);
    assert!(value.innovation.marine_anchors.iter().all(|bit| *bit));
    assert!(
        value
            .memory
            .iter()
            .all(|memory| memory.is_some_and(|memory| memory.last_observed_turn == 1))
    );
    let origin = tiny(0, 3);
    let mut input = start(&origin);
    let open = opened(&origin);
    advance(&mut input, &open);
    let next = finish(
        &open,
        vec![vision(
            1,
            vec![lit("h8", Some(UnitType::King), Side::Black)],
        )],
        vec![],
    );
    advance(&mut input, &next);
    assert_eq!(read(&input, Side::White).innovation.values, [0, 0, 0]);
    assert_eq!(
        read(&input, Side::White).memory[sq("h8").index()]
            .unwrap()
            .kind,
        UnitType::King
    );
}

#[test]
fn seed_readout_invoice_includes_siege_membership_three_mine_locators_and_detached_mutations() {
    let mut origin = initial(
        view(
            Side::White,
            21,
            12,
            &[
                ("c2", UnitType::Pawn),
                ("e1", UnitType::King),
                ("f1", UnitType::Rook),
            ],
            &["d3", "d3", "g3"],
        ),
        view(Side::Black, 21, 12, &[("e8", UnitType::King)], &[]),
    );
    origin.w.snapshot.own.sieged_tanks = vec![sq("f1")];
    let input = start(&origin);
    let expected = input_invoice(&origin.w.snapshot, Scans::default());
    let mut work = LedgerWork::with_limit(expected).unwrap();
    let mut detached = input.input(Side::White, &mut work).unwrap();
    assert_eq!(work.used(), expected);
    assert_eq!(detached.own_units[2].mode, Some(TankMode::Siege));
    let mine = detached.own_mines[1].id;
    detached.own_mines[1].slot = 99;
    detached.own_units[2].mode = Some(TankMode::Tank);
    detached.view.own.sieged_tanks.clear();
    let again = read(&input, Side::White);
    assert_eq!((again.own_mines[1].id, again.own_mines[1].slot), (mine, 1));
    assert_eq!(again.own_units[2].mode, Some(TankMode::Siege));
    assert_eq!(again.view.own.sieged_tanks, vec![sq("f1")]);
}

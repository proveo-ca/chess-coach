// SPEC: _spec/packages/training/burn-compat.puml
use serde::Deserialize;
use serde_json::{Value, json};
use training_native::contracts::{ObservedPiece, OwnInventory, OwnPiece, ViewVersion, all_squares};
use training_native::ledger::LedgerWork;
use training_native::ledger::contracts::*;
use training_native::ledger::history::*;

#[derive(Deserialize)]
struct Golden {
    rules: LedgerRules,
    boundaries: Vec<EconomicBoundary>,
}

fn golden() -> Golden {
    serde_json::from_str(include_str!("fixtures/ledger-boundaries.json")).unwrap()
}
fn rules() -> LedgerRules {
    golden().rules
}
fn sq(value: &str) -> Square {
    Square::parse(value).unwrap()
}
fn before(value: &str) -> UnitSubject {
    UnitSubject::BeforeUnit { square: sq(value) }
}
fn reference(planning: u32, ordinal: u32) -> ActionRef {
    ActionRef {
        planning_ordinal: planning,
        accepted_action_ordinal: ordinal,
    }
}

fn view(
    side: Side,
    turn: u32,
    bank: u32,
    pieces: &[(&str, UnitType)],
    mines: &[&str],
) -> AuthorizedView {
    let mut own_pieces: Vec<_> = pieces
        .iter()
        .map(|(square, kind)| OwnPiece {
            square: sq(square),
            kind: *kind,
        })
        .collect();
    own_pieces.sort_by_key(|piece| piece.square);
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
    for piece in &own_pieces {
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
            pieces: own_pieces,
            mines,
            sieged_tanks: vec![],
        },
        cells,
    }
}

fn initial(white: AuthorizedView, black: AuthorizedView) -> Pair<EconomicBoundary> {
    let boundary = |snapshot: AuthorizedView| EconomicBoundary {
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
        w: boundary(white),
        b: boundary(black),
    }
}

fn tiny(turn: u32, banks: (u32, u32)) -> Pair<EconomicBoundary> {
    initial(
        view(Side::White, turn, banks.0, &[("e1", UnitType::King)], &[]),
        view(Side::Black, turn, banks.1, &[("e8", UnitType::King)], &[]),
    )
}

fn with_white(
    turn: u32,
    bank: u32,
    pieces: &[(&str, UnitType)],
    mines: &[&str],
) -> Pair<EconomicBoundary> {
    initial(
        view(Side::White, turn, bank, pieces, mines),
        view(Side::Black, turn, bank, &[("e8", UnitType::King)], &[]),
    )
}

fn open(previous: &Pair<EconomicBoundary>) -> Pair<EconomicBoundary> {
    let next = |before: &EconomicBoundary| {
        let mut boundary = before.clone();
        boundary.ordinal += 1;
        boundary.phase = BoundaryPhase::TurnOpen;
        boundary.seq_before = before.seq_through;
        boundary.groups.clear();
        boundary.snapshot.own.gas = boundary.snapshot.own.gas_income;
        boundary
    };
    Pair {
        w: next(&previous.w),
        b: next(&previous.b),
    }
}

fn geometry(boundary: &EconomicBoundary) -> OwnGeometry {
    OwnGeometry::from_snapshot(&boundary.snapshot, &mut LedgerWork::new()).unwrap()
}

fn unit(square: &str, kind: UnitType) -> OwnUnitGeometry {
    OwnUnitGeometry {
        square: sq(square),
        kind,
        mode: (kind == UnitType::Rook).then_some(TankMode::Tank),
    }
}

fn image(units: Vec<OwnUnitGeometry>, mines: &[(&str, u32)], lives: u32) -> OwnGeometry {
    let mut units = units;
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
        cc_lives: lives,
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

fn admission(actions: Vec<AcceptedOwnAction>) -> AtomicGroup {
    AtomicGroup::Admission { seq: 0, actions }
}
fn vision(turn: u32, changes: Vec<ObservedCell>) -> AtomicGroup {
    AtomicGroup::Vision {
        seq: 0,
        turn,
        changes,
    }
}
fn unknown(square: &str) -> ObservedCell {
    ObservedCell::Unknown { square: sq(square) }
}
fn lit(square: &str, kind: Option<UnitType>, side: Side) -> ObservedCell {
    ObservedCell::Lit {
        square: sq(square),
        piece: kind.map(|kind| ObservedPiece { color: side, kind }),
    }
}

fn accepted(
    planning: u32,
    ordinal: u32,
    action: Value,
    minerals: u32,
    gas: u32,
) -> AcceptedOwnAction {
    AcceptedOwnAction {
        action_ref: reference(planning, ordinal),
        action: serde_json::from_value(action).unwrap(),
        minerals,
        gas,
    }
}

fn deploy(planning: u32, ordinal: u32, square: &str) -> AcceptedOwnAction {
    accepted(
        planning,
        ordinal,
        json!({"kind":"deploy","timing":"B","color":"w","from":"e1","to":square,"unit":"p"}),
        1,
        1,
    )
}

fn reseq(boundary: &mut EconomicBoundary) {
    for (index, group) in boundary.groups.iter_mut().enumerate() {
        let value = boundary.seq_before + u32::try_from(index).unwrap() + 1;
        match group {
            AtomicGroup::Admission { seq, .. }
            | AtomicGroup::Effects { seq, .. }
            | AtomicGroup::Vision { seq, .. }
            | AtomicGroup::Settlement { seq, .. } => *seq = value,
        }
    }
    boundary.seq_through = boundary.seq_before + u32::try_from(boundary.groups.len()).unwrap();
}

fn finish(
    opening: &Pair<EconomicBoundary>,
    white: Vec<AtomicGroup>,
    black: Vec<AtomicGroup>,
) -> Pair<EconomicBoundary> {
    let next = |previous: &EconomicBoundary, groups: Vec<AtomicGroup>| {
        let profile = rules();
        let mut boundary = previous.clone();
        boundary.ordinal += 1;
        boundary.phase = BoundaryPhase::Settled;
        boundary.turn += 1;
        boundary.planning_ordinal += 1;
        boundary.grant_ordinal += 1;
        boundary.seq_before = previous.seq_through;
        boundary.groups = groups;
        boundary.snapshot.turn = boundary.turn;
        let mut minerals = previous.snapshot.own.minerals;
        let mut gas = previous.snapshot.own.gas;
        let mut after = geometry(previous);
        let mut cells = previous.snapshot.cells.clone();
        for group in &boundary.groups {
            match group {
                AtomicGroup::Admission { actions, .. } => {
                    for action in actions {
                        minerals -= action.minerals;
                        gas -= action.gas;
                    }
                }
                AtomicGroup::Effects { after_own, .. } => after = after_own.clone(),
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
                && !after.units.iter().any(|unit| unit.square == cell.square())
            {
                *cell = ObservedCell::Lit {
                    square: cell.square(),
                    piece: None,
                };
            }
        }
        for unit in &after.units {
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
            .filter(|(after, before)| after != before)
            .map(|(cell, _)| cell.clone())
            .collect();
        if !changes.is_empty() {
            boundary.groups.push(vision(boundary.turn, changes));
        }
        let entitlement = profile.income_at(boundary.turn).unwrap();
        let credited = entitlement.min(profile.mineral_bank_cap - minerals);
        let capacity = profile.gas_capacity_at(boundary.turn).unwrap();
        boundary.groups.push(AtomicGroup::Settlement {
            seq: 0,
            entitlement,
            credited,
            gas_before_reset: gas,
            next_gas_capacity: capacity,
        });
        boundary.snapshot.own.minerals = minerals + credited;
        boundary.snapshot.own.gas = 0;
        boundary.snapshot.own.gas_income = capacity;
        boundary.snapshot.own.cc_lives = after.cc_lives;
        boundary.snapshot.own.pieces = after
            .units
            .iter()
            .map(|unit| OwnPiece {
                square: unit.square,
                kind: unit.kind,
            })
            .collect();
        boundary.snapshot.own.sieged_tanks = after
            .units
            .iter()
            .filter(|unit| unit.mode == Some(TankMode::Siege))
            .map(|unit| unit.square)
            .collect();
        boundary.snapshot.own.mines = after.mines.iter().map(|mine| mine.square).collect();
        boundary.snapshot.cells = final_cells;
        reseq(&mut boundary);
        boundary
    };
    Pair {
        w: next(&opening.w, white),
        b: next(&opening.b, black),
    }
}

fn terminal_begin(
    previous: &Pair<EconomicBoundary>,
    white_lives: u32,
    black_lives: u32,
) -> Pair<EconomicBoundary> {
    let mut pair = open(previous);
    for (side, lives) in [(Side::White, white_lives), (Side::Black, black_lives)] {
        let boundary = pair.get_mut(side);
        boundary.turn += 1;
        boundary.snapshot.turn = boundary.turn;
        let before = geometry(previous.get(side));
        let mut after = before.clone();
        after.cc_lives = lives;
        boundary.snapshot.own.cc_lives = lives;
        if before.cc_lives != lives {
            boundary.groups.push(effects(
                before.clone(),
                after,
                vec![EffectFact::CcLivesChanged {
                    before: before.cc_lives,
                    after: lives,
                }],
            ));
        }
        reseq(boundary);
    }
    pair
}

fn start(pair: &Pair<EconomicBoundary>) -> LedgerPair {
    LedgerPair::initialize(rules(), pair, &mut LedgerWork::new()).unwrap()
}
fn reports(ledger: &LedgerPair) -> Pair<SideLedgerReport> {
    ledger.reports(&mut LedgerWork::new()).unwrap()
}
fn step(ledger: &LedgerPair, pair: &Pair<EconomicBoundary>) -> LedgerPair {
    ledger.advance(pair, &mut LedgerWork::new()).unwrap()
}
fn reject(ledger: &LedgerPair, pair: &Pair<EconomicBoundary>, code: LedgerErrorCode) {
    assert_eq!(
        ledger
            .advance(pair, &mut LedgerWork::new())
            .unwrap_err()
            .code,
        code
    );
}

#[test]
fn all_three_fixture_origins_are_actual_endowments_with_zero_paid_basis() {
    let cases = [
        (
            0,
            3,
            vec![("e1", UnitType::King)],
            vec![("e8", UnitType::King)],
            1,
            0,
        ),
        (
            0,
            3,
            vec![
                ("c2", UnitType::Pawn),
                ("d2", UnitType::Pawn),
                ("e1", UnitType::King),
                ("e2", UnitType::Pawn),
                ("f2", UnitType::Pawn),
            ],
            vec![
                ("c7", UnitType::Pawn),
                ("d7", UnitType::Pawn),
                ("e7", UnitType::Pawn),
                ("e8", UnitType::King),
                ("f7", UnitType::Pawn),
            ],
            5,
            4,
        ),
        (
            21,
            12,
            vec![
                ("b1", UnitType::Knight),
                ("c1", UnitType::Bishop),
                ("d1", UnitType::Rook),
                ("e1", UnitType::King),
                ("e2", UnitType::Pawn),
                ("f1", UnitType::Queen),
            ],
            vec![
                ("b8", UnitType::Knight),
                ("c8", UnitType::Bishop),
                ("d8", UnitType::Rook),
                ("e7", UnitType::Pawn),
                ("e8", UnitType::King),
                ("f8", UnitType::Queen),
            ],
            22,
            21,
        ),
    ];
    for (turn, bank, white, black, native_cost, replacement) in cases {
        let pair = initial(
            view(Side::White, turn, bank, &white, &[]),
            view(Side::Black, turn, bank, &black, &[]),
        );
        let ledger = start(&pair);
        for report in [reports(&ledger).w, reports(&ledger).b] {
            assert_eq!(
                (
                    report.calculated.origin.native_turn,
                    report.calculated.origin.minerals
                ),
                (turn, bank)
            );
            assert_eq!(report.calculated.origin.native_unit_cost_sum, native_cost);
            assert_eq!(
                report.calculated.origin.non_cc_replacement_value,
                replacement
            );
            assert_eq!(report.calculated.origin.paid_mineral_basis, 0);
            assert!(
                report
                    .own_units
                    .iter()
                    .all(|unit| unit.paid_mineral_basis == 0)
            );
            assert_eq!(
                (
                    report.calculated.minerals.paid_debits,
                    report.calculated.minerals.actual_credits
                ),
                (0, 0)
            );
            assert_eq!(
                report.calculated.gas.available,
                rules().gas_capacity_at(turn).unwrap()
            );
            assert_eq!(report.calculated.own_material.cc_lives, 3);
        }
        assert_eq!(ledger.rules(), &rules());
        assert_eq!(ledger.last_boundaries(), &pair);
    }
}

#[test]
fn first_and_tier_settlements_explicitly_cover_zero_one_ten_eleven_twenty_twenty_one() {
    for (turn, entitlement, next_capacity) in [(0, 1, 1), (10, 2, 2), (20, 3, 3)] {
        let origin = tiny(turn, (3, 3));
        let mut work = LedgerWork::new();
        let initial = LedgerPair::initialize(rules(), &origin, &mut work).unwrap();
        let initial_report = initial.reports(&mut work).unwrap();
        assert_eq!(
            (
                initial_report.w.grant_ordinal,
                initial_report.w.calculated.minerals.actual_credits
            ),
            (0, 0)
        );
        let opening = open(&origin);
        let opened = initial.advance(&opening, &mut work).unwrap();
        assert_eq!(
            opened
                .reports(&mut work)
                .unwrap()
                .w
                .calculated
                .minerals
                .actual_credits,
            0
        );
        let settlement = finish(&opening, vec![], vec![]);
        let settled = opened.advance(&settlement, &mut work).unwrap();
        let report = settled.reports(&mut work).unwrap().w;
        assert_eq!(
            (
                report.native_turn,
                report.grant_ordinal,
                report.planning_ordinal
            ),
            (turn + 1, 1, 1)
        );
        assert_eq!(
            (
                report.calculated.minerals.nominal_entitlement,
                report.calculated.minerals.actual_credits
            ),
            (entitlement, entitlement)
        );
        assert_eq!(
            report.calculated.minerals.current_bank,
            3 + entitlement as u32
        );
        assert_eq!(report.calculated.gas.available, 0);
        assert_eq!(report.calculated.gas.capacity, next_capacity);
        let next = step(&settled, &open(&settlement));
        let next_report = reports(&next).w;
        assert_eq!(next_report.calculated.gas.available, next_capacity);
        assert_eq!(next_report.calculated.minerals.actual_credits, entitlement);
        assert_eq!(next_report.grant_ordinal, 1);
        let mut wrong_credit = settlement.clone();
        if let AtomicGroup::Settlement { credited, .. } = wrong_credit.w.groups.last_mut().unwrap()
        {
            *credited = 0;
        }
        reject(&opened, &wrong_credit, LedgerErrorCode::Conservation);
        let mut wrong_capacity = settlement.clone();
        wrong_capacity.w.snapshot.own.gas_income = if next_capacity == 1 {
            2
        } else {
            next_capacity - 1
        };
        reject(&opened, &wrong_capacity, LedgerErrorCode::BadInput);
        let mut wrong_tick = settlement;
        wrong_tick.w.turn += 1;
        wrong_tick.w.snapshot.turn += 1;
        wrong_tick.b.turn += 1;
        wrong_tick.b.snapshot.turn += 1;
        reject(&opened, &wrong_tick, LedgerErrorCode::Sequence);
    }
}

#[test]
fn terminal_begin_crossings_zero_one_ten_eleven_twenty_twenty_one_refill_carried_gas_without_grants()
 {
    for (turn, carried) in [(0, 1), (10, 1), (20, 2)] {
        let origin = tiny(turn, (3, 3));
        let initial = start(&origin);
        for lives in [(0, 0), (0, 3), (3, 0)] {
            let terminal = terminal_begin(&origin, lives.0, lives.1);
            let closed = step(&initial, &terminal);
            for report in [reports(&closed).w, reports(&closed).b] {
                assert_eq!(report.native_turn, turn + 1);
                assert_eq!((report.planning_ordinal, report.grant_ordinal), (0, 0));
                assert_eq!(
                    (
                        report.calculated.minerals.current_bank,
                        report.calculated.minerals.actual_credits,
                        report.calculated.minerals.nominal_entitlement
                    ),
                    (3, 0, 0)
                );
                assert_eq!(
                    (
                        report.calculated.gas.available,
                        report.calculated.gas.capacity
                    ),
                    (carried, carried)
                );
                assert!(report.calculated.settlements.is_empty());
            }
            let replayed = step(&closed, &terminal);
            assert_eq!(reports(&closed), reports(&replayed));
            reject(&closed, &open(&terminal), LedgerErrorCode::Sequence);
        }
        let mut invented_tier = terminal_begin(&origin, 0, 3);
        invented_tier.w.snapshot.own.gas_income = if turn == 0 {
            2
        } else {
            rules().gas_capacity_at(turn + 1).unwrap()
        };
        invented_tier.w.snapshot.own.gas = invented_tier.w.snapshot.own.gas_income;
        reject(&initial, &invented_tier, LedgerErrorCode::Conservation);
    }
}

#[test]
fn turn_twenty_one_cap_asymmetry_preserves_zero_credit_grant_and_independent_own_banks() {
    let origin = tiny(20, (12, 11));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let settlement = finish(&opening, vec![], vec![]);
    let settled = step(&opened, &settlement);
    let report = reports(&settled);
    assert_eq!(
        (
            report.w.native_turn,
            report.w.grant_ordinal,
            report.b.grant_ordinal
        ),
        (21, 1, 1)
    );
    assert_eq!(
        (
            report.w.calculated.minerals.nominal_entitlement,
            report.b.calculated.minerals.nominal_entitlement
        ),
        (3, 3)
    );
    assert_eq!(
        (
            report.w.calculated.minerals.actual_credits,
            report.b.calculated.minerals.actual_credits
        ),
        (0, 1)
    );
    assert_eq!(
        (
            report.w.calculated.minerals.cap_discard,
            report.b.calculated.minerals.cap_discard
        ),
        (3, 2)
    );
    assert_eq!(report.w.calculated.minerals.current_bank, 12);
    assert_eq!(reports(&step(&settled, &settlement)), report);
    let mut wrong = settlement.clone();
    if let AtomicGroup::Settlement { credited, .. } = &mut wrong.w.groups[0] {
        *credited = 1;
    }
    reject(&opened, &wrong, LedgerErrorCode::Conservation);
}

#[test]
fn gas_debits_unused_discard_end_reset_and_next_open_refill_do_not_create_wealth() {
    let origin = tiny(21, (12, 12));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let action = accepted(
        0,
        0,
        json!({"kind":"charonMissiles","timing":"F","color":"w","from":"e1","to":"a6"}),
        0,
        2,
    );
    let settlement = finish(&opening, vec![admission(vec![action])], vec![]);
    let settled = step(&opened, &settlement);
    let report = reports(&settled).w;
    assert_eq!(
        (
            report.calculated.gas.accepted_debits,
            report.calculated.gas.unused_discarded,
            report.calculated.gas.available
        ),
        (2, 1, 0)
    );
    assert_eq!(
        (
            report.calculated.minerals.paid_debits,
            report.calculated.minerals.current_bank
        ),
        (0, 12)
    );
    let refilled = step(&settled, &open(&settlement));
    let report = reports(&refilled).w;
    assert_eq!(
        (
            report.calculated.gas.available,
            report.calculated.gas.refill_count
        ),
        (3, 2)
    );
    assert_eq!(
        (
            report.calculated.gas.accepted_debits,
            report.calculated.gas.unused_discarded
        ),
        (2, 1)
    );
    let mut wrong_reset = settlement.clone();
    wrong_reset.w.snapshot.own.gas = 1;
    reject(&opened, &wrong_reset, LedgerErrorCode::Conservation);
    let mut wrong_receipt = settlement;
    if let AtomicGroup::Settlement {
        gas_before_reset, ..
    } = wrong_receipt.w.groups.last_mut().unwrap()
    {
        *gas_before_reset = 0;
    }
    reject(&opened, &wrong_receipt, LedgerErrorCode::Conservation);
}

#[test]
fn materialized_then_destroyed_purchase_is_paid_loss_not_unmaterialized_waste() {
    let origin = tiny(0, (3, 3));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let before = geometry(&opening.w);
    let facts = vec![
        EffectFact::UnitBorn {
            action_ref: reference(0, 0),
            square: sq("d1"),
            kind: UnitType::Pawn,
        },
        EffectFact::UnitDestroyed {
            subject: UnitSubject::BornUnit {
                action_ref: reference(0, 0),
            },
            square: sq("d1"),
            kind: UnitType::Pawn,
        },
    ];
    let settlement = finish(
        &opening,
        vec![
            admission(vec![deploy(0, 0, "d1")]),
            effects(before.clone(), before, facts),
        ],
        vec![],
    );
    let report = reports(&step(&opened, &settlement)).w;
    assert_eq!(
        (
            report.calculated.minerals.paid_debits,
            report.calculated.minerals.destroyed_paid_basis,
            report.calculated.minerals.wasted_paid_basis
        ),
        (1, 1, 0)
    );
    assert_eq!(report.own_lost.count, 1);
    assert_eq!(report.own_lost.units[0].unit.id, "u2");
    assert_eq!(report.own_lost.replacement_value_at_loss, 1);
    assert!(
        matches!(&report.calculated.deployment_receipts[0].disposition, DeploymentDispositionReport::Materialized { unit_id, .. } if unit_id == "u2")
    );
    assert_eq!(report.own_units.len(), 1);
}

#[test]
fn unmaterialized_purchase_has_exact_waste_receipt_and_no_invented_unit_loss() {
    let origin = tiny(0, (3, 3));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let own = geometry(&opening.w);
    let settlement = finish(
        &opening,
        vec![
            admission(vec![deploy(0, 0, "d1")]),
            effects(
                own.clone(),
                own,
                vec![EffectFact::DeploymentUnmaterialized {
                    action_ref: reference(0, 0),
                }],
            ),
        ],
        vec![],
    );
    let report = reports(&step(&opened, &settlement)).w;
    assert_eq!(
        (
            report.calculated.minerals.paid_debits,
            report.calculated.minerals.wasted_paid_basis,
            report.calculated.minerals.destroyed_paid_basis
        ),
        (1, 1, 0)
    );
    assert_eq!(report.own_lost.count, 0);
    assert_eq!(report.calculated.minerals.current_bank, 3);
    assert!(matches!(
        report.calculated.deployment_receipts[0].disposition,
        DeploymentDispositionReport::Unmaterialized { .. }
    ));
}

#[test]
fn deployment_disposition_missing_duplicate_conflicting_or_undeclared_fails_with_specific_codes() {
    let origin = tiny(0, (3, 3));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let own = geometry(&opening.w);
    let missing = finish(&opening, vec![admission(vec![deploy(0, 0, "d1")])], vec![]);
    reject(&opened, &missing, LedgerErrorCode::Conservation);
    let waste = EffectFact::DeploymentUnmaterialized {
        action_ref: reference(0, 0),
    };
    let duplicate = finish(
        &opening,
        vec![
            admission(vec![deploy(0, 0, "d1")]),
            effects(own.clone(), own.clone(), vec![waste.clone(), waste.clone()]),
        ],
        vec![],
    );
    reject(&opened, &duplicate, LedgerErrorCode::Identity);
    let born = EffectFact::UnitBorn {
        action_ref: reference(0, 0),
        square: sq("d1"),
        kind: UnitType::Pawn,
    };
    let conflicting = finish(
        &opening,
        vec![
            admission(vec![deploy(0, 0, "d1")]),
            effects(own.clone(), own.clone(), vec![born.clone(), waste]),
        ],
        vec![],
    );
    reject(&opened, &conflicting, LedgerErrorCode::Identity);
    let undeclared = finish(
        &opening,
        vec![effects(own.clone(), own.clone(), vec![born])],
        vec![],
    );
    reject(&opened, &undeclared, LedgerErrorCode::Provenance);
    let wrong_target = EffectFact::UnitBorn {
        action_ref: reference(0, 0),
        square: sq("c1"),
        kind: UnitType::Pawn,
    };
    let mismatch = finish(
        &opening,
        vec![
            admission(vec![deploy(0, 0, "d1")]),
            effects(own.clone(), own, vec![wrong_target]),
        ],
        vec![],
    );
    reject(&opened, &mismatch, LedgerErrorCode::Provenance);
}

#[test]
fn paid_pawn_promotion_keeps_one_paid_basis_and_nine_replacement_then_loses_each_once() {
    let origin = tiny(0, (3, 3));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let after = image(
        vec![unit("e1", UnitType::King), unit("d8", UnitType::Queen)],
        &[],
        3,
    );
    let subject = UnitSubject::BornUnit {
        action_ref: reference(0, 0),
    };
    let settlement = finish(
        &opening,
        vec![
            admission(vec![deploy(0, 0, "d7")]),
            effects(
                geometry(&opening.w),
                after,
                vec![
                    EffectFact::UnitBorn {
                        action_ref: reference(0, 0),
                        square: sq("d7"),
                        kind: UnitType::Pawn,
                    },
                    EffectFact::UnitMoved {
                        subject: subject.clone(),
                        from: sq("d7"),
                        to: sq("d8"),
                    },
                    EffectFact::UnitTransformed {
                        subject,
                        from_type: UnitType::Pawn,
                        to_type: UnitType::Queen,
                    },
                ],
            ),
        ],
        vec![],
    );
    let promoted = step(&opened, &settlement);
    let report = reports(&promoted).w;
    let queen = report
        .own_units
        .iter()
        .find(|unit| unit.kind == UnitType::Queen)
        .unwrap();
    assert_eq!(
        (
            &*queen.id,
            queen.paid_mineral_basis,
            queen.non_cc_replacement_value
        ),
        ("u2", 1, 9)
    );
    assert_eq!(queen.type_changes.len(), 1);
    assert_eq!(report.calculated.minerals.surviving_paid_basis, 1);
    let opening2 = open(&settlement);
    let opened2 = step(&promoted, &opening2);
    let next = finish(
        &opening2,
        vec![effects(
            geometry(&opening2.w),
            image(vec![unit("e1", UnitType::King)], &[], 3),
            vec![EffectFact::UnitDestroyed {
                subject: before("d8"),
                square: sq("d8"),
                kind: UnitType::Queen,
            }],
        )],
        vec![],
    );
    let report = reports(&step(&opened2, &next)).w;
    assert_eq!(
        (
            report.own_lost.paid_mineral_basis,
            report.own_lost.replacement_value_at_loss
        ),
        (1, 9)
    );
    assert_eq!(report.calculated.minerals.surviving_paid_basis, 0);
    assert_eq!(report.own_lost.units[0].unit.id, "u2");
}

#[test]
fn endowed_loss_and_free_promotion_never_invent_purchase_basis() {
    let origin = with_white(0, 3, &[("e1", UnitType::King), ("c7", UnitType::Pawn)], &[]);
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let settlement = finish(
        &opening,
        vec![effects(
            geometry(&opening.w),
            image(
                vec![unit("e1", UnitType::King), unit("c7", UnitType::Queen)],
                &[],
                3,
            ),
            vec![EffectFact::UnitTransformed {
                subject: before("c7"),
                from_type: UnitType::Pawn,
                to_type: UnitType::Queen,
            }],
        )],
        vec![],
    );
    let report = reports(&step(&opened, &settlement)).w;
    assert_eq!(report.calculated.minerals.paid_debits, 0);
    assert_eq!(report.calculated.own_material.non_cc_replacement_value, 9);
    assert_eq!(report.calculated.own_material.paid_mineral_basis, 0);
    let loss = finish(
        &opening,
        vec![effects(
            geometry(&opening.w),
            image(vec![unit("e1", UnitType::King)], &[], 3),
            vec![EffectFact::UnitDestroyed {
                subject: before("c7"),
                square: sq("c7"),
                kind: UnitType::Pawn,
            }],
        )],
        vec![],
    );
    let report = reports(&step(&opened, &loss)).w;
    assert_eq!(
        (
            report.own_lost.count,
            report.own_lost.paid_mineral_basis,
            report.own_lost.replacement_value_at_loss
        ),
        (1, 0, 1)
    );
}

#[test]
fn immutable_whole_preimage_supports_unit_swaps_without_intermediate_occupancy_rejection() {
    let origin = with_white(
        0,
        3,
        &[
            ("a2", UnitType::Pawn),
            ("b2", UnitType::Knight),
            ("e1", UnitType::King),
        ],
        &[],
    );
    let initial = start(&origin);
    let opening = open(&origin);
    let opened = step(&initial, &opening);
    let after = image(
        vec![
            unit("b2", UnitType::Pawn),
            unit("a2", UnitType::Knight),
            unit("e1", UnitType::King),
        ],
        &[],
        3,
    );
    let settlement = finish(
        &opening,
        vec![effects(
            geometry(&opening.w),
            after,
            vec![
                EffectFact::UnitMoved {
                    subject: before("a2"),
                    from: sq("a2"),
                    to: sq("b2"),
                },
                EffectFact::UnitMoved {
                    subject: before("b2"),
                    from: sq("b2"),
                    to: sq("a2"),
                },
            ],
        )],
        vec![],
    );
    let report = reports(&step(&opened, &settlement)).w;
    assert_eq!(
        report
            .own_units
            .iter()
            .find(|unit| unit.square == sq("b2"))
            .unwrap()
            .id,
        "u1"
    );
    assert_eq!(
        report
            .own_units
            .iter()
            .find(|unit| unit.square == sq("a2"))
            .unwrap()
            .id,
        "u2"
    );
    assert_eq!(report.own_lost.count, 0);
}

#[test]
fn same_cell_birth_then_old_occupant_retirement_keeps_distinct_local_lineages() {
    let origin = with_white(0, 3, &[("c2", UnitType::Pawn), ("e1", UnitType::King)], &[]);
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let own = geometry(&opening.w);
    let settlement = finish(
        &opening,
        vec![
            admission(vec![deploy(0, 0, "c2")]),
            effects(
                own.clone(),
                own,
                vec![
                    EffectFact::UnitBorn {
                        action_ref: reference(0, 0),
                        square: sq("c2"),
                        kind: UnitType::Pawn,
                    },
                    EffectFact::UnitDestroyed {
                        subject: before("c2"),
                        square: sq("c2"),
                        kind: UnitType::Pawn,
                    },
                ],
            ),
        ],
        vec![],
    );
    let report = reports(&step(&opened, &settlement)).w;
    assert_eq!(
        report
            .own_units
            .iter()
            .find(|unit| unit.square == sq("c2"))
            .unwrap()
            .id,
        "u3"
    );
    assert_eq!(report.own_lost.units[0].unit.id, "u1");
    assert_eq!(
        (
            report.calculated.minerals.surviving_paid_basis,
            report.calculated.minerals.destroyed_paid_basis
        ),
        (1, 0)
    );
}

#[test]
fn preimage_binding_survives_another_subject_moving_onto_the_original_square() {
    let origin = with_white(
        0,
        3,
        &[
            ("a2", UnitType::Pawn),
            ("b2", UnitType::Knight),
            ("e1", UnitType::King),
        ],
        &[],
    );
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let after = image(
        vec![unit("b2", UnitType::Pawn), unit("e1", UnitType::King)],
        &[],
        3,
    );
    let settlement = finish(
        &opening,
        vec![effects(
            geometry(&opening.w),
            after,
            vec![
                EffectFact::UnitMoved {
                    subject: before("a2"),
                    from: sq("a2"),
                    to: sq("b2"),
                },
                EffectFact::UnitDestroyed {
                    subject: before("b2"),
                    square: sq("b2"),
                    kind: UnitType::Knight,
                },
            ],
        )],
        vec![],
    );
    let report = reports(&step(&opened, &settlement)).w;
    assert_eq!(
        report
            .own_units
            .iter()
            .find(|unit| unit.square == sq("b2"))
            .unwrap()
            .id,
        "u1"
    );
    assert_eq!(report.own_lost.units[0].unit.id, "u2");
}

#[test]
fn immutable_mine_occurrences_remove_first_or_second_entity_without_set_deduplication() {
    let origin = with_white(0, 3, &[("e1", UnitType::King)], &["e3", "e3", "f3"]);
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    for (slot, removed, survivor) in [(0, "m1", "m2"), (1, "m2", "m1")] {
        let after = image(vec![unit("e1", UnitType::King)], &[("e3", 0), ("f3", 0)], 3);
        let settlement = finish(
            &opening,
            vec![effects(
                geometry(&opening.w),
                after,
                vec![EffectFact::MineRemoved {
                    subject: MineSubject::BeforeMine {
                        square: sq("e3"),
                        slot,
                    },
                }],
            )],
            vec![],
        );
        let report = reports(&step(&opened, &settlement)).w;
        assert_eq!(report.own_mines.removed[0].id, removed);
        assert_eq!(report.own_mines.active[0].id, survivor);
        assert_eq!(report.own_mines.active[0].slot, 0);
        assert_eq!(
            (report.own_lost.count, report.own_lost.paid_mineral_basis),
            (0, 0)
        );
    }
    let facts = vec![
        EffectFact::MineRemoved {
            subject: MineSubject::BeforeMine {
                square: sq("e3"),
                slot: 0,
            },
        },
        EffectFact::MineRemoved {
            subject: MineSubject::BeforeMine {
                square: sq("e3"),
                slot: 1,
            },
        },
    ];
    let settlement = finish(
        &opening,
        vec![effects(
            geometry(&opening.w),
            image(vec![unit("e1", UnitType::King)], &[("f3", 0)], 3),
            facts,
        )],
        vec![],
    );
    let report = reports(&step(&opened, &settlement)).w;
    assert_eq!(report.own_mines.active[0].id, "m3");
    assert_eq!(report.own_mines.removed.len(), 2);
}

#[test]
fn mine_births_mint_local_ids_and_born_subjects_bind_only_after_same_group_creation() {
    let origin = with_white(
        0,
        3,
        &[("b1", UnitType::Knight), ("e1", UnitType::King)],
        &["e3"],
    );
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let action = accepted(
        0,
        0,
        json!({"kind":"spiderMine","timing":"B","color":"w","from":"b1"}),
        0,
        1,
    );
    let own = geometry(&opening.w);
    let born = EffectFact::MineBorn {
        action_ref: reference(0, 0),
        square: sq("e3"),
    };
    let removal = EffectFact::MineRemoved {
        subject: MineSubject::BornMine {
            action_ref: reference(0, 0),
        },
    };
    let settlement = finish(
        &opening,
        vec![
            admission(vec![action.clone()]),
            effects(
                own.clone(),
                own.clone(),
                vec![born.clone(), removal.clone()],
            ),
        ],
        vec![],
    );
    let report = reports(&step(&opened, &settlement)).w;
    assert_eq!(report.own_mines.active[0].id, "m1");
    assert_eq!(report.own_mines.removed[0].id, "m2");
    assert_eq!(report.own_lost.count, 0);
    let early = finish(
        &opening,
        vec![
            admission(vec![action.clone()]),
            effects(
                own.clone(),
                own.clone(),
                vec![removal.clone(), born.clone()],
            ),
        ],
        vec![],
    );
    reject(&opened, &early, LedgerErrorCode::Identity);
    let mut two = own.clone();
    two.mines.push(MineOccurrence {
        square: sq("e3"),
        slot: 1,
    });
    let across = finish(
        &opening,
        vec![
            admission(vec![action]),
            effects(own.clone(), two.clone(), vec![born]),
            effects(two, own, vec![removal]),
        ],
        vec![],
    );
    reject(&opened, &across, LedgerErrorCode::Identity);
}

#[test]
fn retired_units_and_mines_cannot_retire_twice() {
    let origin = with_white(
        0,
        3,
        &[("c2", UnitType::Pawn), ("e1", UnitType::King)],
        &["e3"],
    );
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let unit_death = EffectFact::UnitDestroyed {
        subject: before("c2"),
        square: sq("c2"),
        kind: UnitType::Pawn,
    };
    let mine_death = EffectFact::MineRemoved {
        subject: MineSubject::BeforeMine {
            square: sq("e3"),
            slot: 0,
        },
    };
    for fact in [unit_death, mine_death] {
        let own = geometry(&opening.w);
        let settlement = finish(
            &opening,
            vec![effects(own.clone(), own, vec![fact.clone(), fact])],
            vec![],
        );
        reject(&opened, &settlement, LedgerErrorCode::Identity);
    }
}

#[test]
fn locator_before_image_after_image_and_causal_birth_errors_are_distinct() {
    let origin = with_white(0, 3, &[("c2", UnitType::Pawn), ("e1", UnitType::King)], &[]);
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let own = geometry(&opening.w);
    let move_fact = EffectFact::UnitMoved {
        subject: before("c2"),
        from: sq("c2"),
        to: sq("c3"),
    };
    let mut wrong_before = own.clone();
    wrong_before.units[0].kind = UnitType::Knight;
    let settlement = finish(
        &opening,
        vec![effects(wrong_before, own.clone(), vec![move_fact.clone()])],
        vec![],
    );
    reject(&opened, &settlement, LedgerErrorCode::Identity);
    let settlement = finish(
        &opening,
        vec![effects(own.clone(), own.clone(), vec![move_fact])],
        vec![],
    );
    reject(&opened, &settlement, LedgerErrorCode::Conservation);
    let wrong_from = EffectFact::UnitMoved {
        subject: before("c2"),
        from: sq("d2"),
        to: sq("c3"),
    };
    let settlement = finish(
        &opening,
        vec![effects(own.clone(), own.clone(), vec![wrong_from])],
        vec![],
    );
    reject(&opened, &settlement, LedgerErrorCode::Identity);
    let missing = EffectFact::UnitMoved {
        subject: before("h8"),
        from: sq("h8"),
        to: sq("h7"),
    };
    let settlement = finish(
        &opening,
        vec![effects(own.clone(), own.clone(), vec![missing])],
        vec![],
    );
    reject(&opened, &settlement, LedgerErrorCode::Identity);
    let early = EffectFact::UnitMoved {
        subject: UnitSubject::BornUnit {
            action_ref: reference(0, 0),
        },
        from: sq("d1"),
        to: sq("d2"),
    };
    let settlement = finish(
        &opening,
        vec![
            admission(vec![deploy(0, 0, "d1")]),
            effects(own.clone(), own, vec![early]),
        ],
        vec![],
    );
    reject(&opened, &settlement, LedgerErrorCode::Identity);
}

#[test]
fn transient_path_vision_preserves_square_memory_under_fog_without_minting_enemy_assets() {
    let origin = tiny(0, (3, 3));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let settlement = finish(
        &opening,
        vec![
            vision(0, vec![lit("a6", Some(UnitType::Queen), Side::Black)]),
            vision(0, vec![unknown("a6")]),
        ],
        vec![],
    );
    let remembered = step(&opened, &settlement);
    let report = reports(&remembered).w;
    assert_eq!(report.seen.current_enemy_non_cc_count, 0);
    assert_eq!(report.seen.current_enemy_non_cc_replacement_value, 0);
    assert_eq!(report.seen.stale_assertions.len(), 1);
    assert_eq!(report.seen.stale_assertions[0].last_observed_turn, 0);
    assert!(report.seen.ever_lit.contains(&sq("a6")));
    assert_eq!(report.witnessed_enemy_destruction.count, 0);
    let opening2 = open(&settlement);
    let opened2 = step(&remembered, &opening2);
    let settlement2 = finish(
        &opening2,
        vec![vision(1, vec![lit("a6", None, Side::White)])],
        vec![],
    );
    let cleared = reports(&step(&opened2, &settlement2)).w;
    assert!(cleared.seen.last_seen_assertions.is_empty());
    assert_eq!(cleared.witnessed_enemy_destruction.count, 0);
}

#[test]
fn revealed_enemy_assertions_do_not_light_squares_and_current_sightings_refresh_turn_only() {
    let mut origin = tiny(0, (3, 3));
    origin.w.snapshot.cells[sq("a6").index()] = ObservedCell::Revealed {
        square: sq("a6"),
        piece: ObservedPiece {
            kind: UnitType::Queen,
            color: Side::Black,
        },
    };
    origin.w.snapshot.cells[sq("e8").index()] = lit("e8", Some(UnitType::King), Side::Black);
    let initial = start(&origin);
    let report = reports(&initial).w;
    assert_eq!(
        (
            report.seen.current_enemy_non_cc_count,
            report.seen.current_enemy_non_cc_replacement_value
        ),
        (1, 9)
    );
    assert_eq!(report.seen.current_enemy_cc_squares, vec![sq("e8")]);
    assert!(!report.seen.ever_lit.contains(&sq("a6")));
    let opening = open(&origin);
    let opened = step(&initial, &opening);
    let settlement = finish(&opening, vec![], vec![]);
    let settled = step(&opened, &settlement);
    let report = reports(&settled).w;
    assert_eq!(report.seen.current_enemy_non_cc_replacement_value, 9);
    assert_eq!(report.seen.last_seen_assertions.len(), 2);
    assert!(
        report
            .seen
            .last_seen_assertions
            .iter()
            .all(|assertion| assertion.last_observed_turn == 1)
    );
    assert_eq!(report.witnessed_enemy_destruction.count, 0);
}

#[test]
fn matching_witness_clears_stale_memory_and_later_vision_can_repopulate_it() {
    let mut origin = tiny(0, (3, 3));
    origin.w.snapshot.cells[sq("a6").index()] = lit("a6", Some(UnitType::Queen), Side::Black);
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let own = geometry(&opening.w);
    let witness = EffectFact::EnemyDestructionWitnessed {
        square: sq("a6"),
        kind: UnitType::Queen,
        own_action_ref: None,
    };
    let settlement = finish(
        &opening,
        vec![
            vision(0, vec![unknown("a6")]),
            effects(own.clone(), own.clone(), vec![witness.clone()]),
        ],
        vec![],
    );
    let report = reports(&step(&opened, &settlement)).w;
    assert!(report.seen.last_seen_assertions.is_empty());
    assert_eq!(
        (
            report.witnessed_enemy_destruction.count,
            report.witnessed_enemy_destruction.replacement_value
        ),
        (1, 9)
    );
    assert_eq!(report.witnessed_enemy_destruction.witnesses[0].id, "w1");
    let repopulated = finish(
        &opening,
        vec![
            vision(0, vec![unknown("a6")]),
            effects(own.clone(), own, vec![witness]),
            vision(1, vec![lit("a6", Some(UnitType::Pawn), Side::Black)]),
        ],
        vec![],
    );
    let report = reports(&step(&opened, &repopulated)).w;
    assert_eq!(report.seen.last_seen_assertions[0].kind, UnitType::Pawn);
    assert_eq!(report.seen.current_enemy_non_cc_replacement_value, 1);
    assert_eq!(report.witnessed_enemy_destruction.replacement_value, 9);
}

#[test]
fn witnessed_source_subset_binds_known_own_action_without_claiming_killer_or_enemy_bank() {
    let origin = tiny(0, (3, 3));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let action = accepted(
        0,
        0,
        json!({"kind":"classical","timing":"C","color":"w","from":"e1","to":"e2"}),
        0,
        0,
    );
    let own = geometry(&opening.w);
    let facts = vec![
        EffectFact::EnemyDestructionWitnessed {
            square: sq("a6"),
            kind: UnitType::Queen,
            own_action_ref: Some(reference(0, 0)),
        },
        EffectFact::EnemyDestructionWitnessed {
            square: sq("b6"),
            kind: UnitType::Pawn,
            own_action_ref: None,
        },
    ];
    let settlement = finish(
        &opening,
        vec![
            admission(vec![action]),
            effects(own.clone(), own.clone(), facts),
        ],
        vec![],
    );
    let settled = step(&opened, &settlement);
    let report = reports(&settled).w;
    assert_eq!(
        (
            report.witnessed_enemy_destruction.count,
            report.witnessed_enemy_destruction.replacement_value
        ),
        (2, 10)
    );
    let subset = &report
        .witnessed_enemy_destruction
        .own_action_caused_witnessed_enemy_destruction;
    assert_eq!((subset.count, subset.replacement_value), (1, 9));
    assert_eq!(report.calculated.minerals.current_bank, 4);
    assert_eq!(report.calculated.minerals.actual_credits, 1);
    let text = serde_json::to_string(&report).unwrap();
    for forbidden in [
        "enemyBank",
        "opponentBank",
        "killer",
        "verified",
        "ready",
        "engine:",
    ] {
        assert!(!text.contains(forbidden));
    }
    assert_eq!(reports(&step(&settled, &settlement)).w, report);
    let undeclared = finish(
        &opening,
        vec![effects(
            own.clone(),
            own,
            vec![EffectFact::EnemyDestructionWitnessed {
                square: sq("a6"),
                kind: UnitType::Pawn,
                own_action_ref: Some(reference(0, 0)),
            }],
        )],
        vec![],
    );
    reject(&opened, &undeclared, LedgerErrorCode::Provenance);
}

#[test]
fn transient_own_reveals_timestamp_regressions_and_final_cell_tampering_are_rejected() {
    let origin = tiny(0, (3, 3));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let revealed = ObservedCell::Revealed {
        square: sq("a6"),
        piece: ObservedPiece {
            kind: UnitType::Pawn,
            color: Side::White,
        },
    };
    let own_reveal = finish(
        &opening,
        vec![vision(0, vec![revealed]), vision(0, vec![unknown("a6")])],
        vec![],
    );
    reject(&opened, &own_reveal, LedgerErrorCode::Provenance);
    let reversed = finish(
        &opening,
        vec![
            vision(1, vec![lit("a6", Some(UnitType::Pawn), Side::Black)]),
            vision(0, vec![unknown("a6")]),
        ],
        vec![],
    );
    reject(&opened, &reversed, LedgerErrorCode::Sequence);
    let mut tampered = finish(&opening, vec![], vec![]);
    tampered.w.snapshot.cells[sq("a6").index()] = lit("a6", Some(UnitType::Queen), Side::Black);
    reject(&opened, &tampered, LedgerErrorCode::Provenance);
}

#[test]
fn current_full_byte_replay_is_idempotent_but_conflicting_or_older_ordinals_are_not() {
    let origin = tiny(0, (3, 3));
    let initial = start(&origin);
    let duplicate_initial = step(&initial, &origin);
    assert_eq!(reports(&initial), reports(&duplicate_initial));
    let opening = open(&origin);
    let opened = step(&initial, &opening);
    let mut work = LedgerWork::new();
    let duplicate = opened.advance(&opening, &mut work).unwrap();
    assert!(work.used() > 0);
    assert_eq!(reports(&opened), reports(&duplicate));
    let mut conflict = opening.clone();
    conflict.w.snapshot.own.minerals = 4;
    reject(&opened, &conflict, LedgerErrorCode::Identity);
    reject(&opened, &origin, LedgerErrorCode::Sequence);
    let mut gap = opening.clone();
    gap.w.ordinal = 3;
    gap.b.ordinal = 3;
    reject(&initial, &gap, LedgerErrorCode::Sequence);
}

#[test]
fn pair_seats_phase_clocks_ordinals_grants_sequences_and_turns_require_exact_order() {
    let origin = tiny(0, (3, 3));
    let initial = start(&origin);
    let mut swapped = origin.clone();
    std::mem::swap(&mut swapped.w, &mut swapped.b);
    assert_eq!(
        LedgerPair::initialize(rules(), &swapped, &mut LedgerWork::new())
            .unwrap_err()
            .code,
        LedgerErrorCode::Identity
    );
    let opening = open(&origin);
    let opened = step(&initial, &opening);
    let mut unsynced = opening.clone();
    unsynced.b.ordinal = 2;
    reject(&initial, &unsynced, LedgerErrorCode::Sequence);
    let mut skipped_open = finish(&opening, vec![], vec![]);
    skipped_open.w.ordinal = 1;
    skipped_open.b.ordinal = 1;
    reject(&initial, &skipped_open, LedgerErrorCode::Sequence);
    let mut duplicate_phase = opening.clone();
    duplicate_phase.w.ordinal = 2;
    duplicate_phase.b.ordinal = 2;
    reject(&opened, &duplicate_phase, LedgerErrorCode::Sequence);
    let mut grant = opening.clone();
    grant.w.grant_ordinal = 1;
    grant.w.planning_ordinal = 1;
    grant.b.grant_ordinal = 1;
    grant.b.planning_ordinal = 1;
    reject(&initial, &grant, LedgerErrorCode::Sequence);
    let mut sequence_gap = opening.clone();
    sequence_gap.w.seq_before = 1;
    sequence_gap.w.seq_through = 1;
    reject(&initial, &sequence_gap, LedgerErrorCode::Sequence);
    let mut tick = opening.clone();
    tick.w.turn = 1;
    tick.w.snapshot.turn = 1;
    tick.b.turn = 1;
    tick.b.snapshot.turn = 1;
    reject(&initial, &tick, LedgerErrorCode::Sequence);
}

#[test]
fn contiguous_admission_order_and_before_effects_position_are_enforced() {
    let origin = tiny(21, (12, 12));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let action = accepted(
        0,
        1,
        json!({"kind":"siegeMode","timing":"B","color":"w","from":"e1"}),
        0,
        1,
    );
    let gap = finish(&opening, vec![admission(vec![action])], vec![]);
    reject(&opened, &gap, LedgerErrorCode::Sequence);
    let action = accepted(
        0,
        0,
        json!({"kind":"siegeMode","timing":"B","color":"w","from":"e1"}),
        0,
        1,
    );
    let reordered = finish(
        &opening,
        vec![vision(21, vec![unknown("a6")]), admission(vec![action])],
        vec![],
    );
    reject(&opened, &reordered, LedgerErrorCode::Sequence);
    let mut wrong_window = finish(&opening, vec![], vec![]);
    wrong_window.w.groups.insert(
        0,
        admission(vec![accepted(
            1,
            0,
            json!({"kind":"classical","timing":"C","color":"w","from":"e1","to":"e2"}),
            0,
            0,
        )]),
    );
    reseq(&mut wrong_window.w);
    reject(&opened, &wrong_window, LedgerErrorCode::Sequence);
}

#[test]
fn resource_debits_cannot_exceed_available_gas_or_minerals() {
    let origin = tiny(0, (3, 3));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let mut gas = finish(&opening, vec![], vec![]);
    gas.w.groups.insert(
        0,
        admission(vec![accepted(
            0,
            0,
            json!({"kind":"charonMissiles","timing":"F","color":"w","from":"e1","to":"a6"}),
            0,
            2,
        )]),
    );
    reseq(&mut gas.w);
    reject(&opened, &gas, LedgerErrorCode::Conservation);
    let mut bank = finish(&opening, vec![], vec![]);
    bank.w.groups.insert(
        0,
        admission(vec![accepted(
            0,
            0,
            json!({"kind":"deploy","timing":"B","color":"w","from":"e1","to":"d1","unit":"q"}),
            9,
            1,
        )]),
    );
    reseq(&mut bank.w);
    reject(&opened, &bank, LedgerErrorCode::Conservation);
}

#[test]
fn second_seat_failure_cannot_publish_first_seat_receipts_or_local_id_allocation() {
    let origin = tiny(0, (3, 3));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let before_report = reports(&opened);
    let own = geometry(&opening.w);
    let valid = finish(
        &opening,
        vec![
            admission(vec![deploy(0, 0, "d1")]),
            effects(
                own.clone(),
                own,
                vec![EffectFact::DeploymentUnmaterialized {
                    action_ref: reference(0, 0),
                }],
            ),
        ],
        vec![],
    );
    let mut invalid = valid.clone();
    invalid.b.snapshot.own.minerals = 5;
    reject(&opened, &invalid, LedgerErrorCode::Conservation);
    assert_eq!(reports(&opened), before_report);
    assert_eq!(opened.last_boundaries(), &opening);
    let published = reports(&step(&opened, &valid));
    assert_eq!(published.w.calculated.deployment_receipts.len(), 1);
    assert_eq!(published.w.calculated.minerals.paid_debits, 1);
    assert_eq!(published.b.calculated.minerals.current_bank, 4);
}

#[test]
fn work_exhaustion_at_initial_open_settlement_report_and_duplicate_preserves_predecessors() {
    let origin = tiny(0, (3, 3));
    let mut measured = LedgerWork::new();
    let initial = LedgerPair::initialize(rules(), &origin, &mut measured).unwrap();
    let mut insufficient = LedgerWork::with_limit(measured.used() - 1).unwrap();
    assert_eq!(
        LedgerPair::initialize(rules(), &origin, &mut insufficient)
            .unwrap_err()
            .code,
        LedgerErrorCode::Budget
    );
    let opening = open(&origin);
    let opened = step(&initial, &opening);
    let settlement = finish(&opening, vec![], vec![]);
    for (previous, input) in [
        (&initial, &opening),
        (&opened, &settlement),
        (&opened, &opening),
    ] {
        let before = reports(previous);
        let mut measured = LedgerWork::new();
        previous.advance(input, &mut measured).unwrap();
        let mut insufficient = LedgerWork::with_limit(measured.used() - 1).unwrap();
        assert_eq!(
            previous.advance(input, &mut insufficient).unwrap_err().code,
            LedgerErrorCode::Budget
        );
        assert_eq!(reports(previous), before);
        assert!(insufficient.used() > 0);
    }
    let mut measured = LedgerWork::new();
    opened.reports(&mut measured).unwrap();
    let mut insufficient = LedgerWork::with_limit(measured.used() - 1).unwrap();
    assert_eq!(
        opened.reports(&mut insufficient).unwrap_err().code,
        LedgerErrorCode::Budget
    );
    assert_eq!(opened.last_boundaries(), &opening);
}

#[test]
fn rejected_open_birth_cc_increase_and_wrong_carried_refill_do_not_publish() {
    let origin = tiny(0, (3, 3));
    let initial = start(&origin);
    let mut opening = open(&origin);
    opening.w.snapshot.own.gas = 0;
    reject(&initial, &opening, LedgerErrorCode::Conservation);
    let mut opening = open(&origin);
    let own = geometry(&opening.w);
    opening.w.groups.push(effects(
        own.clone(),
        own,
        vec![EffectFact::UnitBorn {
            action_ref: reference(0, 0),
            square: sq("d1"),
            kind: UnitType::Pawn,
        }],
    ));
    reseq(&mut opening.w);
    reject(&initial, &opening, LedgerErrorCode::Provenance);
    let origin = with_white(0, 3, &[("e1", UnitType::King)], &[]);
    let mut origin = origin;
    origin.w.snapshot.own.cc_lives = 2;
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let mut after = geometry(&opening.w);
    after.cc_lives = 3;
    let settlement = finish(
        &opening,
        vec![effects(
            geometry(&opening.w),
            after,
            vec![EffectFact::CcLivesChanged {
                before: 2,
                after: 3,
            }],
        )],
        vec![],
    );
    reject(&opened, &settlement, LedgerErrorCode::Conservation);
}

#[test]
fn report_root_is_closed_integer_only_scoped_and_contains_no_authority_flags() {
    let report = reports(&start(&tiny(0, (3, 3)))).w;
    let value = serde_json::to_value(&report).unwrap();
    let expected = [
        "boundaryOrdinal",
        "calculated",
        "grantOrdinal",
        "nativeTurn",
        "ownLost",
        "ownMines",
        "ownUnits",
        "planningOrdinal",
        "scope",
        "seen",
        "sequenceThrough",
        "side",
        "witnessedEnemyDestruction",
    ];
    assert_eq!(
        value
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect::<Vec<_>>(),
        expected
    );
    assert_eq!(value["scope"], "record-initial-forward");
    fn integers(value: &Value) {
        match value {
            Value::Number(number) => assert!(number.is_u64()),
            Value::Array(values) => {
                for value in values {
                    integers(value);
                }
            }
            Value::Object(fields) => {
                for (key, value) in fields {
                    assert!(
                        ![
                            "ready",
                            "verified",
                            "trainingReady",
                            "enemyBank",
                            "opponentBank"
                        ]
                        .contains(&key.as_str())
                    );
                    integers(value);
                }
            }
            _ => {}
        }
    }
    integers(&value);
}

#[test]
fn shared_standard_golden_reconciles_native_settlement_and_rejects_nonzero_end_gas() {
    let fixture = golden();
    let mut origin = tiny(0, (3, 3));
    origin.w = fixture.boundaries[0].clone();
    let mut opening = open(&origin);
    opening.w = fixture.boundaries[1].clone();
    let opened = step(&start(&origin), &opening);
    let mut settlement = finish(&opening, vec![], vec![]);
    settlement.w = fixture.boundaries[2].clone();
    let settled = step(&opened, &settlement);
    assert_eq!(reports(&settled).w.calculated.minerals.current_bank, 4);
    assert_eq!(reports(&settled).w.calculated.gas.available, 0);
    settlement.w.snapshot.own.gas = 1;
    reject(&opened, &settlement, LedgerErrorCode::Conservation);
}

#[test]
fn earlier_group_births_use_next_immutable_before_locator_not_a_reused_born_locator() {
    let origin = tiny(0, (3, 3));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let born_image = image(
        vec![unit("e1", UnitType::King), unit("c2", UnitType::Pawn)],
        &[],
        3,
    );
    let moved_image = image(
        vec![unit("e1", UnitType::King), unit("c3", UnitType::Pawn)],
        &[],
        3,
    );
    let birth = EffectFact::UnitBorn {
        action_ref: reference(0, 0),
        square: sq("c2"),
        kind: UnitType::Pawn,
    };
    let movement = EffectFact::UnitMoved {
        subject: before("c2"),
        from: sq("c2"),
        to: sq("c3"),
    };
    let valid = finish(
        &opening,
        vec![
            admission(vec![deploy(0, 0, "c2")]),
            effects(
                geometry(&opening.w),
                born_image.clone(),
                vec![birth.clone()],
            ),
            effects(born_image.clone(), moved_image.clone(), vec![movement]),
        ],
        vec![],
    );
    let report = reports(&step(&opened, &valid)).w;
    let pawn = report
        .own_units
        .iter()
        .find(|unit| unit.kind == UnitType::Pawn)
        .unwrap();
    assert_eq!(
        (&*pawn.id, pawn.square, pawn.paid_mineral_basis),
        ("u2", sq("c3"), 1)
    );
    let reused = EffectFact::UnitMoved {
        subject: UnitSubject::BornUnit {
            action_ref: reference(0, 0),
        },
        from: sq("c2"),
        to: sq("c3"),
    };
    let invalid = finish(
        &opening,
        vec![
            admission(vec![deploy(0, 0, "c2")]),
            effects(geometry(&opening.w), born_image.clone(), vec![birth]),
            effects(born_image, moved_image, vec![reused]),
        ],
        vec![],
    );
    reject(&opened, &invalid, LedgerErrorCode::Identity);
}

#[test]
fn paid_rook_birth_defaults_to_tank_and_causal_mode_changes_reconcile_siege_geometry() {
    let origin = tiny(21, (12, 12));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let action = accepted(
        0,
        0,
        json!({"kind":"deploy","timing":"B","color":"w","from":"e1","to":"d1","unit":"r"}),
        5,
        1,
    );
    let mut rook = unit("d1", UnitType::Rook);
    rook.mode = Some(TankMode::Siege);
    let after = image(vec![unit("e1", UnitType::King), rook], &[], 3);
    let birth = EffectFact::UnitBorn {
        action_ref: reference(0, 0),
        square: sq("d1"),
        kind: UnitType::Rook,
    };
    let mode = EffectFact::UnitModeChanged {
        subject: UnitSubject::BornUnit {
            action_ref: reference(0, 0),
        },
        before: TankMode::Tank,
        after: TankMode::Siege,
    };
    let valid = finish(
        &opening,
        vec![
            admission(vec![action.clone()]),
            effects(
                geometry(&opening.w),
                after.clone(),
                vec![birth.clone(), mode],
            ),
        ],
        vec![],
    );
    let report = reports(&step(&opened, &valid)).w;
    let rook = report
        .own_units
        .iter()
        .find(|unit| unit.kind == UnitType::Rook)
        .unwrap();
    assert_eq!(
        (
            rook.mode,
            rook.paid_mineral_basis,
            rook.non_cc_replacement_value
        ),
        (Some(TankMode::Siege), 5, 5)
    );
    let reverse_mode = EffectFact::UnitModeChanged {
        subject: UnitSubject::BornUnit {
            action_ref: reference(0, 0),
        },
        before: TankMode::Siege,
        after: TankMode::Tank,
    };
    let invalid = finish(
        &opening,
        vec![
            admission(vec![action]),
            effects(geometry(&opening.w), after, vec![birth, reverse_mode]),
        ],
        vec![],
    );
    reject(&opened, &invalid, LedgerErrorCode::Identity);
    let own = geometry(&opening.w);
    let not_rook = finish(
        &opening,
        vec![effects(
            own.clone(),
            own,
            vec![EffectFact::UnitModeChanged {
                subject: before("e1"),
                before: TankMode::Tank,
                after: TankMode::Siege,
            }],
        )],
        vec![],
    );
    reject(&opened, &not_rook, LedgerErrorCode::Identity);
}

#[test]
fn stacked_mine_birth_preserves_old_occurrence_and_next_group_can_remove_only_new_entity() {
    let origin = with_white(
        0,
        3,
        &[("b1", UnitType::Knight), ("e1", UnitType::King)],
        &["b1"],
    );
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let action = accepted(
        0,
        0,
        json!({"kind":"spiderMine","timing":"B","color":"w","from":"b1"}),
        0,
        1,
    );
    let before = geometry(&opening.w);
    let mut stacked = before.clone();
    stacked.mines.push(MineOccurrence {
        square: sq("b1"),
        slot: 1,
    });
    let birth = EffectFact::MineBorn {
        action_ref: reference(0, 0),
        square: sq("b1"),
    };
    let valid = finish(
        &opening,
        vec![
            admission(vec![action.clone()]),
            effects(before.clone(), stacked.clone(), vec![birth.clone()]),
            effects(
                stacked.clone(),
                before.clone(),
                vec![EffectFact::MineRemoved {
                    subject: MineSubject::BeforeMine {
                        square: sq("b1"),
                        slot: 1,
                    },
                }],
            ),
        ],
        vec![],
    );
    let report = reports(&step(&opened, &valid)).w;
    assert_eq!(report.own_mines.active[0].id, "m1");
    assert_eq!(report.own_mines.removed[0].id, "m2");
    let mut three = stacked.clone();
    three.mines.push(MineOccurrence {
        square: sq("b1"),
        slot: 2,
    });
    let duplicate = finish(
        &opening,
        vec![
            admission(vec![action]),
            effects(before, stacked.clone(), vec![birth.clone()]),
            effects(stacked, three, vec![birth]),
        ],
        vec![],
    );
    reject(&opened, &duplicate, LedgerErrorCode::Identity);
}

#[test]
fn terminal_end_still_issues_one_grant_but_cc_receipt_must_match_exact_prior_lives() {
    let origin = tiny(10, (3, 3));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let before = geometry(&opening.w);
    let mut after = before.clone();
    after.cc_lives = 0;
    let terminal = finish(
        &opening,
        vec![effects(
            before.clone(),
            after.clone(),
            vec![EffectFact::CcLivesChanged {
                before: 3,
                after: 0,
            }],
        )],
        vec![],
    );
    let ended = step(&opened, &terminal);
    let report = reports(&ended).w;
    assert_eq!(
        (
            report.native_turn,
            report.grant_ordinal,
            report.calculated.minerals.actual_credits
        ),
        (11, 1, 2)
    );
    assert_eq!(
        (
            report.calculated.own_material.cc_lives,
            report.calculated.gas.available,
            report.calculated.gas.capacity
        ),
        (0, 0, 2)
    );
    assert_eq!(report.own_lost.count, 0);
    reject(&ended, &open(&terminal), LedgerErrorCode::Sequence);
    let wrong_before = finish(
        &opening,
        vec![effects(
            before,
            after,
            vec![EffectFact::CcLivesChanged {
                before: 2,
                after: 0,
            }],
        )],
        vec![],
    );
    reject(&opened, &wrong_before, LedgerErrorCode::Conservation);
}

#[test]
fn moving_enemy_square_assertions_remain_separate_from_current_seen_material_and_losses() {
    let origin = tiny(0, (3, 3));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let settled = finish(
        &opening,
        vec![
            vision(0, vec![lit("a6", Some(UnitType::Queen), Side::Black)]),
            vision(
                0,
                vec![unknown("a6"), lit("a7", Some(UnitType::Queen), Side::Black)],
            ),
        ],
        vec![],
    );
    let report = reports(&step(&opened, &settled)).w;
    assert_eq!(
        (
            report.seen.current_enemy_non_cc_count,
            report.seen.current_enemy_non_cc_replacement_value
        ),
        (1, 9)
    );
    assert_eq!(report.seen.last_seen_assertions.len(), 2);
    assert_eq!(report.seen.stale_assertions.len(), 1);
    assert_eq!(report.witnessed_enemy_destruction.count, 0);
    assert_eq!(report.calculated.minerals.current_bank, 4);
}

#[test]
fn semantically_equal_inputs_produce_identical_local_ids_and_serialized_reports() {
    let origin = with_white(
        0,
        3,
        &[("c2", UnitType::Pawn), ("e1", UnitType::King)],
        &["d3", "d3"],
    );
    let opening = open(&origin);
    let one = step(&start(&origin), &opening);
    let two = step(&start(&origin), &opening);
    let own = geometry(&opening.w);
    let settled = finish(
        &opening,
        vec![
            admission(vec![deploy(0, 0, "d1")]),
            effects(
                own.clone(),
                own,
                vec![
                    EffectFact::DeploymentUnmaterialized {
                        action_ref: reference(0, 0),
                    },
                    EffectFact::EnemyDestructionWitnessed {
                        square: sq("a6"),
                        kind: UnitType::Pawn,
                        own_action_ref: None,
                    },
                ],
            ),
        ],
        vec![],
    );
    let one = step(&one, &settled);
    let two = step(&two, &settled);
    assert_eq!(
        serde_json::to_vec(&reports(&one)).unwrap(),
        serde_json::to_vec(&reports(&two)).unwrap()
    );
    let replayed = step(&one, &settled);
    assert_eq!(
        serde_json::to_vec(&reports(&one)).unwrap(),
        serde_json::to_vec(&reports(&replayed)).unwrap()
    );
}

#[test]
fn sieged_rook_replacement_preserves_square_mode_and_mints_paid_lineage() {
    let origin = with_white(
        21,
        12,
        &[
            ("b1", UnitType::Knight),
            ("c1", UnitType::Bishop),
            ("d1", UnitType::Rook),
            ("e1", UnitType::King),
            ("e2", UnitType::Pawn),
            ("f1", UnitType::Queen),
        ],
        &[],
    );
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let mut sieged_image = geometry(&opening.w);
    sieged_image
        .units
        .iter_mut()
        .find(|unit| unit.square == sq("d1"))
        .unwrap()
        .mode = Some(TankMode::Siege);
    let siege = finish(
        &opening,
        vec![
            admission(vec![accepted(
                0,
                0,
                json!({"kind":"siegeMode","timing":"B","color":"w","from":"d1"}),
                0,
                1,
            )]),
            effects(
                geometry(&opening.w),
                sieged_image,
                vec![EffectFact::UnitModeChanged {
                    subject: before("d1"),
                    before: TankMode::Tank,
                    after: TankMode::Siege,
                }],
            ),
        ],
        vec![],
    );
    let sieged = step(&opened, &siege);
    let replacement_open = open(&siege);
    let replacement_ready = step(&sieged, &replacement_open);
    let own = geometry(&replacement_open.w);
    let retire = EffectFact::UnitDestroyed {
        subject: before("d1"),
        square: sq("d1"),
        kind: UnitType::Rook,
    };
    let birth = EffectFact::UnitBorn {
        action_ref: reference(1, 0),
        square: sq("d1"),
        kind: UnitType::Rook,
    };
    for facts in [vec![retire.clone(), birth.clone()], vec![birth, retire]] {
        let replacement = finish(
            &replacement_open,
            vec![
                admission(vec![accepted(
                    1,
                    0,
                    json!({"kind":"deploy","timing":"B","color":"w","from":"e1","to":"d1","unit":"r"}),
                    5,
                    1,
                )]),
                effects(own.clone(), own.clone(), facts),
            ],
            vec![],
        );
        let replaced = replacement_ready
            .advance(&replacement, &mut LedgerWork::new())
            .unwrap_or_else(|error| {
                assert_eq!(error.code, LedgerErrorCode::Conservation);
                panic!("authorized same-square sieged rook replacement rejected: {error}");
            });
        let report = reports(&replaced).w;
        let rook = report
            .own_units
            .iter()
            .find(|unit| unit.square == sq("d1"))
            .unwrap();
        assert_eq!(
            (&*rook.id, rook.mode, rook.paid_mineral_basis),
            ("u7", Some(TankMode::Siege), 5)
        );
        assert_eq!(
            (
                &*report.own_lost.units[0].unit.id,
                report.own_lost.units[0].unit.paid_mineral_basis
            ),
            ("u3", 0)
        );
        assert_eq!(
            (
                report.calculated.minerals.paid_debits,
                report.calculated.minerals.surviving_paid_basis,
                report.calculated.minerals.destroyed_paid_basis,
                report.calculated.minerals.wasted_paid_basis
            ),
            (5, 5, 0, 0)
        );
        assert_eq!(
            (
                report.calculated.minerals.current_bank,
                report.calculated.gas.accepted_debits,
                report.calculated.gas.available
            ),
            (10, 2, 0)
        );
        assert!(
            matches!(&report.calculated.deployment_receipts[0].disposition, DeploymentDispositionReport::Materialized { unit_id, .. } if unit_id == "u7")
        );
    }
    assert_eq!(
        reports(&replacement_ready)
            .w
            .calculated
            .minerals
            .paid_debits,
        0
    );
}

#[test]
fn profile_turn_limit_rejects_new_open_after_final_settlement() {
    let origin = tiny(44, (3, 3));
    let opening = open(&origin);
    let opened = step(&start(&origin), &opening);
    let final_boundary = finish(&opening, vec![], vec![]);
    let terminal = step(&opened, &final_boundary);
    let before_report = reports(&terminal);
    assert_eq!(
        (
            before_report.w.native_turn,
            before_report.w.grant_ordinal,
            before_report.w.calculated.minerals.actual_credits
        ),
        (45, 1, 3)
    );
    assert_eq!(
        (
            before_report.w.calculated.own_material.cc_lives,
            before_report.b.calculated.own_material.cc_lives
        ),
        (3, 3)
    );
    let mut duplicate_work = LedgerWork::new();
    let duplicate = terminal
        .advance(&final_boundary, &mut duplicate_work)
        .unwrap();
    assert!(duplicate_work.used() > 0);
    assert_eq!(reports(&duplicate), before_report);
    let mut rejected_work = LedgerWork::new();
    let error = match terminal.advance(&open(&final_boundary), &mut rejected_work) {
        Err(error) => error,
        Ok(_) => panic!("expected SEQUENCE for a new ordinal after maxTurn=45"),
    };
    assert_eq!(error.code, LedgerErrorCode::Sequence);
    assert!(rejected_work.used() > 0);
    assert_eq!(terminal.last_boundaries(), &final_boundary);
    assert_eq!(reports(&terminal), before_report);
}

#[test]
fn initial_turn_limit_and_shorter_profile_limit_preserve_charged_terminal_duplicates() {
    for maximum in [45, 1] {
        let mut profile = rules();
        profile.max_turn = maximum;
        profile.income_by_turn.truncate(maximum as usize + 1);
        profile.gas_capacity_by_turn.truncate(maximum as usize + 1);
        let origin = tiny(maximum, (3, 3));
        let initial =
            LedgerPair::initialize(profile.clone(), &origin, &mut LedgerWork::new()).unwrap();
        let before_report = reports(&initial);
        let mut work = LedgerWork::new();
        let duplicate = initial.advance(&origin, &mut work).unwrap();
        assert!(work.used() > 0);
        assert_eq!(reports(&duplicate), before_report);
        reject(&initial, &open(&origin), LedgerErrorCode::Sequence);
        assert_eq!(reports(&initial), before_report);
        assert_eq!(initial.last_boundaries(), &origin);
        assert_eq!(before_report.w.calculated.minerals.actual_credits, 0);
        if maximum == 1 {
            let origin = tiny(0, (3, 3));
            let initial = LedgerPair::initialize(profile, &origin, &mut LedgerWork::new()).unwrap();
            let opening = open(&origin);
            let opened = step(&initial, &opening);
            let final_boundary = finish(&opening, vec![], vec![]);
            let terminal = step(&opened, &final_boundary);
            let report = reports(&terminal);
            assert_eq!(
                (
                    report.w.native_turn,
                    report.w.calculated.minerals.actual_credits
                ),
                (1, 1)
            );
            reject(&terminal, &open(&final_boundary), LedgerErrorCode::Sequence);
            let mut work = LedgerWork::new();
            assert_eq!(
                reports(&terminal.advance(&final_boundary, &mut work).unwrap()),
                report
            );
            assert!(work.used() > 0);
        }
    }
}

#[test]
fn rook_birth_cannot_invent_siege_or_unsiege_from_postimage_or_unrelated_preimage() {
    let birth = EffectFact::UnitBorn {
        action_ref: reference(0, 0),
        square: sq("d1"),
        kind: UnitType::Rook,
    };
    let retire = EffectFact::UnitDestroyed {
        subject: before("d1"),
        square: sq("d1"),
        kind: UnitType::Rook,
    };
    for case in 0..5 {
        let mut origin = match case {
            0 => tiny(21, (12, 12)),
            1 => with_white(
                21,
                12,
                &[("c1", UnitType::Rook), ("e1", UnitType::King)],
                &[],
            ),
            _ => with_white(
                21,
                12,
                &[("d1", UnitType::Rook), ("e1", UnitType::King)],
                &[],
            ),
        };
        if case == 1 {
            origin.w.snapshot.own.sieged_tanks.push(sq("c1"));
        }
        if case >= 3 {
            origin.w.snapshot.own.sieged_tanks.push(sq("d1"));
        }
        let opening = open(&origin);
        let opened = step(&start(&origin), &opening);
        let mut after = geometry(&opening.w);
        let mut claimed = unit(if case == 4 { "c1" } else { "d1" }, UnitType::Rook);
        claimed.mode = Some(if case == 3 {
            TankMode::Tank
        } else {
            TankMode::Siege
        });
        if case == 2 || case == 3 {
            after.units.retain(|unit| unit.square != sq("d1"));
        }
        after.units.push(claimed);
        after.units.sort_by_key(|unit| unit.square);
        let facts = match case {
            0 | 1 => vec![birth.clone()],
            2 | 3 => vec![retire.clone(), birth.clone()],
            _ => vec![
                birth.clone(),
                EffectFact::UnitMoved {
                    subject: UnitSubject::BornUnit {
                        action_ref: reference(0, 0),
                    },
                    from: sq("d1"),
                    to: sq("c1"),
                },
            ],
        };
        let replacement = finish(
            &opening,
            vec![
                admission(vec![accepted(
                    0,
                    0,
                    json!({"kind":"deploy","timing":"B","color":"w","from":"e1","to":"d1","unit":"r"}),
                    5,
                    1,
                )]),
                effects(geometry(&opening.w), after, facts),
            ],
            vec![],
        );
        reject(&opened, &replacement, LedgerErrorCode::Conservation);
        assert_eq!(reports(&opened).w.calculated.minerals.paid_debits, 0);
    }
}

#[test]
fn rook_replacement_obeys_explicit_mode_changes_within_and_between_atomic_groups() {
    for timing in ["B", "F"] {
        for combined in [false, true] {
            for old_mode in [TankMode::Tank, TankMode::Siege] {
                let next_mode = if old_mode == TankMode::Tank {
                    TankMode::Siege
                } else {
                    TankMode::Tank
                };
                let mut origin = with_white(
                    21,
                    12,
                    &[("d1", UnitType::Rook), ("e1", UnitType::King)],
                    &[],
                );
                if old_mode == TankMode::Siege {
                    origin.w.snapshot.own.sieged_tanks.push(sq("d1"));
                }
                let opening = open(&origin);
                let opened = step(&start(&origin), &opening);
                let initial_image = geometry(&opening.w);
                let mut next_image = initial_image.clone();
                next_image
                    .units
                    .iter_mut()
                    .find(|unit| unit.square == sq("d1"))
                    .unwrap()
                    .mode = Some(next_mode);
                let mode = EffectFact::UnitModeChanged {
                    subject: before("d1"),
                    before: old_mode,
                    after: next_mode,
                };
                let retire = EffectFact::UnitDestroyed {
                    subject: before("d1"),
                    square: sq("d1"),
                    kind: UnitType::Rook,
                };
                let birth = EffectFact::UnitBorn {
                    action_ref: reference(0, 1),
                    square: sq("d1"),
                    kind: UnitType::Rook,
                };
                let mut groups = vec![admission(vec![
                    accepted(
                        0,
                        0,
                        json!({"kind":"siegeMode","timing":timing,"color":"w","from":"d1"}),
                        0,
                        1,
                    ),
                    accepted(
                        0,
                        1,
                        json!({"kind":"deploy","timing":timing,"color":"w","from":"e1","to":"d1","unit":"r"}),
                        5,
                        1,
                    ),
                ])];
                if combined {
                    groups.push(effects(
                        initial_image,
                        next_image,
                        vec![mode, retire, birth],
                    ));
                } else {
                    groups.push(effects(initial_image, next_image.clone(), vec![mode]));
                    groups.push(effects(next_image.clone(), next_image, vec![retire, birth]));
                }
                let replacement = finish(&opening, groups, vec![]);
                let report = reports(&step(&opened, &replacement)).w;
                let rook = report
                    .own_units
                    .iter()
                    .find(|unit| unit.kind == UnitType::Rook)
                    .unwrap();
                assert_eq!(
                    (&*rook.id, rook.mode, rook.paid_mineral_basis),
                    ("u3", Some(next_mode), 5)
                );
                assert_eq!(
                    (
                        &*report.own_lost.units[0].unit.id,
                        report.own_lost.paid_mineral_basis
                    ),
                    ("u1", 0)
                );
            }
        }
    }
}

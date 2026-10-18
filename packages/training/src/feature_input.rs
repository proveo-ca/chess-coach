// SPEC: _spec/packages/training/burn-compat.puml
use crate::contracts::ObservedPiece;
use crate::ledger::LedgerWork;
use crate::ledger::contracts::*;
use crate::ledger::history::{LastSeenAssertion, LedgerFeatureParts, LedgerPair};

pub const FEATURE_INPUT_VERSION: &str = "native-feature-input-v1";

const ENTRY: u64 = 128;
const CONVERSION_BASE: u64 = 128;
const CONVERSION_ITEM: u64 = 192;
const SCRATCH: u64 = 128 + 768 + 3 * 64;
const GROUP: u64 = 8;
const FACT: u64 = 128;
const SUBJECT_TABLE: u64 = 16 * 64;
const GEOMETRY: u64 = 16;
const OBSERVATION: u64 = 100;
const RECONCILIATION: u64 = 32;
const DETACHED_INNOVATION: u64 = 128 + 3 * 64;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AdvanceDisposition {
    Advanced,
    Replayed,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OwnUnitId(u32);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OwnMineId(u32);

#[derive(Debug, PartialEq, Eq)]
pub struct FeatureOwnUnit {
    pub id: OwnUnitId,
    pub square: Square,
    pub kind: UnitType,
    pub mode: Option<TankMode>,
    pub paid_basis: u32,
}

#[derive(Debug, PartialEq, Eq)]
pub struct FeatureOwnMine {
    pub id: OwnMineId,
    pub square: Square,
    pub slot: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BoundaryStamp {
    pub ordinal: u32,
    pub phase: BoundaryPhase,
    pub turn: u32,
    pub planning_ordinal: u32,
    pub grant_ordinal: u32,
    pub seq_through: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct FeatureGrant {
    pub grant_ordinal: u32,
    pub settled_turn: u32,
    pub entitlement: u32,
    pub credited: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BoundaryInnovation {
    pub values: [u32; 3],
    pub bins: [u8; 3],
    pub marine_anchors: [bool; 64],
    pub own_geometry: [bool; 64],
    pub grant: Option<FeatureGrant>,
}

#[derive(Debug, PartialEq, Eq)]
pub struct FeatureInput {
    pub version: &'static str,
    pub stamp: BoundaryStamp,
    pub view: AuthorizedView,
    pub own_units: Vec<FeatureOwnUnit>,
    pub own_mines: Vec<FeatureOwnMine>,
    pub memory: [Option<LastSeenAssertion>; 64],
    pub ever_lit: [bool; 64],
    pub own_paid_destroyed: u64,
    pub own_paid_wasted: u64,
    pub enemy_replacement_loss_lower_bound: u64,
    pub innovation: BoundaryInnovation,
}

#[derive(Debug)]
pub struct FeatureInputPair {
    ledger: LedgerPair,
    innovation: Pair<BoundaryInnovation>,
}

impl FeatureInputPair {
    pub fn initialize(
        rules: LedgerRules,
        initial: &Pair<EconomicBoundary>,
        work: &mut LedgerWork,
    ) -> ContractResult<Self> {
        work.charge(ENTRY)?;
        let ledger = LedgerPair::initialize(rules, initial, work)?;
        let white = ledger.feature_parts(Side::White, work)?;
        let w = innovate(ledger.rules(), &white, &white, &initial.w, work)?;
        let black = ledger.feature_parts(Side::Black, work)?;
        let b = innovate(ledger.rules(), &black, &black, &initial.b, work)?;
        Ok(Self {
            ledger,
            innovation: Pair { w, b },
        })
    }

    pub fn advance(
        &mut self,
        next: &Pair<EconomicBoundary>,
        work: &mut LedgerWork,
    ) -> ContractResult<AdvanceDisposition> {
        work.charge(ENTRY)?;
        let ledger = self.ledger.advance(next, work)?;
        if ledger.last_boundaries().w.ordinal == self.ledger.last_boundaries().w.ordinal {
            return Ok(AdvanceDisposition::Replayed);
        }
        let prior = self.ledger.feature_parts(Side::White, work)?;
        let current = ledger.feature_parts(Side::White, work)?;
        let w = innovate(ledger.rules(), &prior, &current, &next.w, work)?;
        let prior = self.ledger.feature_parts(Side::Black, work)?;
        let current = ledger.feature_parts(Side::Black, work)?;
        let b = innovate(ledger.rules(), &prior, &current, &next.b, work)?;
        self.ledger = ledger;
        self.innovation = Pair { w, b };
        Ok(AdvanceDisposition::Advanced)
    }

    pub fn input(&self, side: Side, work: &mut LedgerWork) -> ContractResult<FeatureInput> {
        let parts = self.ledger.feature_parts(side, work)?;
        work.charge(CONVERSION_BASE)?;
        charge_count(work, parts.units.len(), CONVERSION_ITEM)?;
        charge_count(work, parts.mines.len(), CONVERSION_ITEM)?;
        work.charge(DETACHED_INNOVATION)?;
        let stamp = self.last_boundaries().get(side);
        Ok(FeatureInput {
            version: FEATURE_INPUT_VERSION,
            stamp: BoundaryStamp {
                ordinal: stamp.ordinal,
                phase: stamp.phase,
                turn: stamp.turn,
                planning_ordinal: stamp.planning_ordinal,
                grant_ordinal: stamp.grant_ordinal,
                seq_through: stamp.seq_through,
            },
            view: parts.view,
            own_units: parts
                .units
                .into_iter()
                .map(|unit| FeatureOwnUnit {
                    id: OwnUnitId(unit.id),
                    square: unit.square,
                    kind: unit.kind,
                    mode: unit.mode,
                    paid_basis: unit.paid_basis,
                })
                .collect(),
            own_mines: parts
                .mines
                .into_iter()
                .map(|mine| FeatureOwnMine {
                    id: OwnMineId(mine.id),
                    square: mine.occurrence.square,
                    slot: mine.occurrence.slot,
                })
                .collect(),
            memory: parts.memory,
            ever_lit: parts.ever_lit,
            own_paid_destroyed: parts.own_paid_destroyed,
            own_paid_wasted: parts.own_paid_wasted,
            enemy_replacement_loss_lower_bound: parts.enemy_replacement_loss_lower_bound,
            innovation: *self.innovation.get(side),
        })
    }

    pub const fn last_boundaries(&self) -> &Pair<EconomicBoundary> {
        self.ledger.last_boundaries()
    }
    pub const fn rules(&self) -> &LedgerRules {
        self.ledger.rules()
    }
}

#[derive(Clone, Copy)]
struct BornSubject {
    reference: ActionRef,
    square: Square,
    kind: UnitType,
}

struct InnovationScratch<'a> {
    side: Side,
    first_turn: u32,
    last_turn: u32,
    cells: [&'a ObservedCell; 64],
    memory: [Option<LastSeenAssertion>; 64],
    ever_lit: [bool; 64],
    assertions: [bool; 768],
    cleared: [bool; 64],
    output: BoundaryInnovation,
}

impl<'a> InnovationScratch<'a> {
    fn new(
        prior: &'a LedgerFeatureParts,
        current_turn: u32,
        work: &mut LedgerWork,
    ) -> ContractResult<Self> {
        work.charge(SCRATCH)?;
        if prior
            .view
            .turn
            .checked_add(1)
            .is_none_or(|maximum| current_turn > maximum)
            || current_turn < prior.view.turn
        {
            return Err(error(
                LedgerErrorCode::Sequence,
                "Feature assertion window exceeds two checked turns",
            ));
        }
        let mut scratch = Self {
            side: prior.view.side,
            first_turn: prior.view.turn,
            last_turn: current_turn,
            cells: std::array::from_fn(|index| &prior.view.cells[index]),
            memory: prior.memory,
            ever_lit: prior.ever_lit,
            assertions: [false; 768],
            cleared: [false; 64],
            output: BoundaryInnovation {
                values: [0; 3],
                bins: [0; 3],
                marine_anchors: [false; 64],
                own_geometry: [false; 64],
                grant: None,
            },
        };
        for assertion in prior.memory.iter().flatten() {
            if assertion.last_observed_turn >= scratch.first_turn
                && assertion.last_observed_turn <= scratch.last_turn
            {
                let index = scratch.assertion_index(
                    assertion.square,
                    assertion.kind,
                    assertion.last_observed_turn,
                )?;
                scratch.assertions[index] = true;
            }
        }
        Ok(scratch)
    }

    fn assertion_index(&self, square: Square, kind: UnitType, turn: u32) -> ContractResult<usize> {
        let lane = turn
            .checked_sub(self.first_turn)
            .filter(|lane| *lane <= 1 && turn <= self.last_turn)
            .ok_or_else(|| {
                error(
                    LedgerErrorCode::Sequence,
                    "Feature assertion timestamp lies outside its checked window",
                )
            })?;
        let kind = match kind {
            UnitType::Pawn => 0,
            UnitType::Knight => 1,
            UnitType::Bishop => 2,
            UnitType::Rook => 3,
            UnitType::Queen => 4,
            UnitType::King => 5,
        };
        usize::try_from(lane)
            .ok()
            .and_then(|lane| lane.checked_mul(64))
            .and_then(|offset| offset.checked_add(square.index()))
            .and_then(|offset| offset.checked_mul(6))
            .and_then(|offset| offset.checked_add(kind))
            .filter(|index| *index < 768)
            .ok_or_else(|| {
                error(
                    LedgerErrorCode::Sequence,
                    "Feature assertion bitmap index overflow",
                )
            })
    }

    fn observe(
        &mut self,
        cell: &'a ObservedCell,
        turn: u32,
        rules: &LedgerRules,
        is_delta: bool,
    ) -> ContractResult<()> {
        let square = cell.square();
        let index = square.index();
        if matches!(cell, ObservedCell::Lit { .. }) {
            self.ever_lit[index] = true;
        }
        match observed_piece(cell) {
            Some(piece) if piece.color != self.side => {
                let continuous = self.memory[index]
                    .is_some_and(|old| old.kind == piece.kind && old.color == piece.color)
                    && observed_piece(self.cells[index]).is_some_and(|old| old == piece);
                let key = self.assertion_index(square, piece.kind, turn)?;
                if is_delta && !self.assertions[key] && !continuous {
                    self.output.values[0] =
                        checked_add(self.output.values[0], rules.non_cc_replacement(piece.kind))?;
                    if piece.kind == UnitType::Pawn {
                        self.output.marine_anchors[index] = true;
                    }
                }
                self.assertions[key] = true;
                self.memory[index] = Some(LastSeenAssertion {
                    square,
                    kind: piece.kind,
                    color: piece.color,
                    last_observed_turn: turn,
                });
            }
            _ if matches!(cell, ObservedCell::Lit { piece: None, .. }) => {
                if self.memory[index].is_some() && !self.cleared[index] {
                    self.output.values[2] = checked_add(self.output.values[2], 1)?;
                    self.cleared[index] = true;
                }
                self.memory[index] = None;
            }
            Some(piece) => {
                self.memory[index] = None;
                if piece.kind != UnitType::King {
                    self.output.own_geometry[index] = true;
                }
            }
            _ => {}
        }
        self.cells[index] = cell;
        Ok(())
    }

    fn view_geometry(
        &mut self,
        view: &AuthorizedView,
        work: &mut LedgerWork,
    ) -> ContractResult<()> {
        charge_count(work, view.own.pieces.len(), GEOMETRY)?;
        charge_count(work, view.own.mines.len(), GEOMETRY)?;
        for unit in &view.own.pieces {
            if unit.kind != UnitType::King {
                self.output.own_geometry[unit.square.index()] = true;
            }
        }
        for square in &view.own.mines {
            self.output.own_geometry[square.index()] = true;
        }
        Ok(())
    }

    fn geometry(&mut self, geometry: &OwnGeometry, work: &mut LedgerWork) -> ContractResult<()> {
        charge_count(work, geometry.units.len(), GEOMETRY)?;
        charge_count(work, geometry.mines.len(), GEOMETRY)?;
        for unit in &geometry.units {
            if unit.kind != UnitType::King {
                self.output.own_geometry[unit.square.index()] = true;
            }
        }
        for mine in &geometry.mines {
            self.output.own_geometry[mine.square.index()] = true;
        }
        Ok(())
    }

    fn effects(
        &mut self,
        before: &OwnGeometry,
        after: &OwnGeometry,
        facts: &[EffectFact],
        rules: &LedgerRules,
        work: &mut LedgerWork,
    ) -> ContractResult<()> {
        work.charge(SUBJECT_TABLE)?;
        charge_count(work, facts.len(), FACT)?;
        let mut before_units = [None; 64];
        let mut born_units: [Option<BornSubject>; 4] = [None; 4];
        let mut born_mines: [Option<(ActionRef, Square)>; 4] = [None; 4];
        self.geometry(before, work)?;
        self.geometry(after, work)?;
        for unit in &before.units {
            before_units[unit.square.index()] = Some(unit.kind);
        }
        for fact in facts {
            match fact {
                EffectFact::UnitBorn {
                    action_ref,
                    square,
                    kind,
                    ..
                } => {
                    if *kind != UnitType::King {
                        self.output.own_geometry[square.index()] = true;
                    }
                    born_units[action_ref.accepted_action_ordinal as usize] = Some(BornSubject {
                        reference: *action_ref,
                        square: *square,
                        kind: *kind,
                    });
                }
                EffectFact::UnitMoved { subject, from, to } => {
                    let (_, kind) = unit_subject(subject, &before_units, &born_units)?;
                    if kind != UnitType::King {
                        self.output.own_geometry[from.index()] = true;
                        self.output.own_geometry[to.index()] = true;
                    }
                }
                EffectFact::UnitTransformed { subject, .. }
                | EffectFact::UnitModeChanged { subject, .. } => {
                    let (square, kind) = unit_subject(subject, &before_units, &born_units)?;
                    if kind != UnitType::King {
                        self.output.own_geometry[square.index()] = true;
                    }
                }
                EffectFact::UnitDestroyed { square, kind, .. } => {
                    if *kind != UnitType::King {
                        self.output.own_geometry[square.index()] = true;
                    }
                }
                EffectFact::MineBorn { action_ref, square } => {
                    self.output.own_geometry[square.index()] = true;
                    born_mines[action_ref.accepted_action_ordinal as usize] =
                        Some((*action_ref, *square));
                }
                EffectFact::MineRemoved { subject } => {
                    let square = match subject {
                        MineSubject::BeforeMine { square, .. } => *square,
                        MineSubject::BornMine { action_ref } => born_mines
                            .get(action_ref.accepted_action_ordinal as usize)
                            .and_then(|born| *born)
                            .filter(|(reference, _)| reference == action_ref)
                            .map(|(_, square)| square)
                            .ok_or_else(|| {
                                error(
                                    LedgerErrorCode::Identity,
                                    "Feature mine subject has no checked group birth",
                                )
                            })?,
                    };
                    self.output.own_geometry[square.index()] = true;
                }
                EffectFact::EnemyDestructionWitnessed { square, kind, .. } => {
                    self.output.values[1] =
                        checked_add(self.output.values[1], rules.non_cc_replacement(*kind))?;
                    if self.memory[square.index()]
                        .is_some_and(|old| old.kind == *kind && old.color == self.side.other())
                    {
                        self.memory[square.index()] = None;
                    }
                }
                EffectFact::DeploymentUnmaterialized { .. } | EffectFact::CcLivesChanged { .. } => {
                }
            }
        }
        Ok(())
    }
}

fn innovate(
    rules: &LedgerRules,
    prior: &LedgerFeatureParts,
    current: &LedgerFeatureParts,
    boundary: &EconomicBoundary,
    work: &mut LedgerWork,
) -> ContractResult<BoundaryInnovation> {
    let mut scratch = InnovationScratch::new(prior, boundary.turn, work)?;
    scratch.view_geometry(&prior.view, work)?;
    scratch.view_geometry(&current.view, work)?;
    for group in &boundary.groups {
        work.charge(GROUP)?;
        match group {
            AtomicGroup::Effects {
                before_own,
                after_own,
                facts,
                ..
            } => scratch.effects(before_own, after_own, facts, rules, work)?,
            AtomicGroup::Vision { turn, changes, .. } => {
                charge_count(work, changes.len(), OBSERVATION)?;
                for cell in changes {
                    scratch.observe(cell, *turn, rules, true)?;
                }
            }
            AtomicGroup::Settlement {
                entitlement,
                credited,
                ..
            } => {
                scratch.output.grant = Some(FeatureGrant {
                    grant_ordinal: boundary.grant_ordinal,
                    settled_turn: boundary.turn,
                    entitlement: *entitlement,
                    credited: *credited,
                });
            }
            AtomicGroup::Admission { .. } => {}
        }
    }
    charge_count(work, 64, OBSERVATION)?;
    charge_count(work, 64, RECONCILIATION)?;
    for (index, cell) in current.view.cells.iter().enumerate() {
        if scratch.cells[index] != cell {
            return Err(error(
                LedgerErrorCode::Identity,
                "Feature cells disagree with the checked ordered boundary",
            ));
        }
        scratch.observe(cell, boundary.turn, rules, false)?;
        if scratch.memory[index] != current.memory[index]
            || scratch.ever_lit[index] != current.ever_lit[index]
        {
            return Err(error(
                LedgerErrorCode::Identity,
                "Feature observations disagree with checked memory or visibility",
            ));
        }
    }
    scratch.output.bins = [
        value_bin(scratch.output.values[0]),
        value_bin(scratch.output.values[1]),
        match scratch.output.values[2] {
            0 => 0,
            1 => 1,
            _ => 2,
        },
    ];
    Ok(scratch.output)
}

fn unit_subject(
    subject: &UnitSubject,
    before: &[Option<UnitType>; 64],
    born: &[Option<BornSubject>; 4],
) -> ContractResult<(Square, UnitType)> {
    match subject {
        UnitSubject::BeforeUnit { square } => before[square.index()]
            .map(|kind| (*square, kind))
            .ok_or_else(|| {
                error(
                    LedgerErrorCode::Identity,
                    "Feature unit subject has no immutable checked preimage",
                )
            }),
        UnitSubject::BornUnit { action_ref } => born
            .get(action_ref.accepted_action_ordinal as usize)
            .and_then(|born| *born)
            .filter(|born| born.reference == *action_ref)
            .map(|born| (born.square, born.kind))
            .ok_or_else(|| {
                error(
                    LedgerErrorCode::Identity,
                    "Feature unit subject has no checked group birth",
                )
            }),
    }
}

fn observed_piece(cell: &ObservedCell) -> Option<&ObservedPiece> {
    match cell {
        ObservedCell::Lit { piece, .. } => piece.as_ref(),
        ObservedCell::Revealed { piece, .. } => Some(piece),
        _ => None,
    }
}

fn value_bin(value: u32) -> u8 {
    match value {
        0 => 0,
        1..=3 => 1,
        4..=8 => 2,
        _ => 3,
    }
}

fn checked_add(left: u32, right: u32) -> ContractResult<u32> {
    left.checked_add(right).ok_or_else(|| {
        error(
            LedgerErrorCode::Conservation,
            "Feature innovation value overflow",
        )
    })
}

fn charge_count(work: &mut LedgerWork, count: usize, fee: u64) -> ContractResult<()> {
    let amount = u64::try_from(count)
        .ok()
        .and_then(|count| count.checked_mul(fee))
        .ok_or_else(|| error(LedgerErrorCode::Budget, "Feature input invoice overflow"))?;
    work.charge(amount)
}

fn error(code: LedgerErrorCode, message: &'static str) -> LedgerError {
    LedgerError::new(code, message)
}

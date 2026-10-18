// SPEC: _spec/packages/training/burn-compat.puml
use serde::Serialize;

use crate::contracts::{ObservedPiece, SpawnPiece, all_squares};

use super::contracts::*;
use super::work::LedgerWork;

const STATE_BASE: u64 = 128;
const STATE_CELL: u64 = 16;
const STATE_MEMORY: u64 = 32;
const STATE_ITEM: u64 = 192;
const REPORT_ITEM: u64 = 320;
const PROFILE_CLONE: u64 = 64;
const PROFILE_ENTRY: u64 = 8;
const IDENTITY_BYTE: u64 = 1;
const FOLD_FACT: u64 = 64;
const FOLD_ACTION: u64 = 192;
const GEOMETRY_ITEM: u64 = 32;
const RESOLVE_ITEM: u64 = 2;
const ARITHMETIC_ITEM: u64 = 32;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub enum LedgerScope {
    #[serde(rename = "record-initial-forward")]
    RecordInitialForward,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LedgerPosition {
    pub boundary_ordinal: u32,
    pub native_turn: u32,
    pub sequence: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
pub enum EntityOrigin {
    Endowed {},
    Action { action_ref: ActionRef },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeChange {
    pub at: LedgerPosition,
    pub from_type: UnitType,
    pub to_type: UnitType,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnUnitReport {
    pub id: String,
    pub square: Square,
    #[serde(rename = "type")]
    pub kind: UnitType,
    pub mode: Option<TankMode>,
    pub paid_mineral_basis: u32,
    pub non_cc_replacement_value: u32,
    pub native_unit_cost: u32,
    pub origin: EntityOrigin,
    pub born_at: LedgerPosition,
    pub type_changes: Vec<TypeChange>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnLossReport {
    pub unit: OwnUnitReport,
    pub lost_at: LedgerPosition,
    pub replacement_value_at_loss: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnLostReport {
    pub count: u64,
    pub paid_mineral_basis: u64,
    pub replacement_value_at_loss: u64,
    pub units: Vec<OwnLossReport>,
    pub wasted_deployment_paid_basis: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnMineReport {
    pub id: String,
    pub square: Square,
    pub slot: u32,
    pub origin: EntityOrigin,
    pub born_at: LedgerPosition,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemovedMineReport {
    pub id: String,
    pub square: Square,
    pub origin: EntityOrigin,
    pub born_at: LedgerPosition,
    pub removed_at: LedgerPosition,
    pub subject: MineSubject,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnMinesReport {
    pub active: Vec<OwnMineReport>,
    pub removed: Vec<RemovedMineReport>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionReceiptReport {
    pub action_ref: ActionRef,
    pub action: Action,
    pub minerals: u32,
    pub gas: u32,
    pub admitted_at: LedgerPosition,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
pub enum DeploymentDispositionReport {
    Materialized { unit_id: String, at: LedgerPosition },
    Unmaterialized { at: LedgerPosition },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentReceiptReport {
    pub action_ref: ActionRef,
    #[serde(rename = "type")]
    pub kind: UnitType,
    pub minerals: u32,
    pub admitted_at: LedgerPosition,
    pub disposition: DeploymentDispositionReport,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettlementReceiptReport {
    pub at: LedgerPosition,
    pub planning_ordinal: u32,
    pub grant_ordinal: u32,
    pub entitlement: u32,
    pub credited: u32,
    pub cap_discard: u32,
    pub gas_before_reset: u32,
    pub next_gas_capacity: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OriginReport {
    pub native_turn: u32,
    pub minerals: u32,
    pub gas: u32,
    pub gas_capacity: u32,
    pub cc_lives: u32,
    pub native_unit_cost_sum: u64,
    pub non_cc_replacement_value: u64,
    pub paid_mineral_basis: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MineralReport {
    pub origin_bank: u32,
    pub nominal_entitlement: u64,
    pub actual_credits: u64,
    pub paid_debits: u64,
    pub cap_discard: u64,
    pub current_bank: u32,
    pub surviving_paid_basis: u64,
    pub destroyed_paid_basis: u64,
    pub wasted_paid_basis: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GasReport {
    pub origin_available: u32,
    pub available: u32,
    pub capacity: u32,
    pub accepted_debits: u64,
    pub unused_discarded: u64,
    pub refill_count: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnMaterialReport {
    pub native_unit_cost_sum: u64,
    pub non_cc_replacement_value: u64,
    pub paid_mineral_basis: u64,
    pub cc_lives: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CalculatedReport {
    pub origin: OriginReport,
    pub minerals: MineralReport,
    pub gas: GasReport,
    pub own_material: OwnMaterialReport,
    pub accepted_actions: Vec<ActionReceiptReport>,
    pub deployment_receipts: Vec<DeploymentReceiptReport>,
    pub settlements: Vec<SettlementReceiptReport>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastSeenAssertion {
    pub square: Square,
    #[serde(rename = "type")]
    pub kind: UnitType,
    pub color: Side,
    pub last_observed_turn: u32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeenReport {
    pub cells: Vec<ObservedCell>,
    pub ever_lit: Vec<Square>,
    pub current_enemy_non_cc_count: u32,
    pub current_enemy_non_cc_replacement_value: u64,
    pub current_enemy_cc_squares: Vec<Square>,
    pub last_seen_assertions: Vec<LastSeenAssertion>,
    pub stale_assertions: Vec<LastSeenAssertion>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DestructionWitnessReport {
    pub id: String,
    pub square: Square,
    #[serde(rename = "type")]
    pub kind: UnitType,
    pub replacement_value: u32,
    pub own_action_ref: Option<ActionRef>,
    pub at: LedgerPosition,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DestructionTotals {
    pub count: u64,
    pub replacement_value: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WitnessedEnemyDestructionReport {
    pub count: u64,
    pub replacement_value: u64,
    pub own_action_caused_witnessed_enemy_destruction: DestructionTotals,
    pub witnesses: Vec<DestructionWitnessReport>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SideLedgerReport {
    pub side: Side,
    pub scope: LedgerScope,
    pub boundary_ordinal: u32,
    pub native_turn: u32,
    pub planning_ordinal: u32,
    pub grant_ordinal: u32,
    pub sequence_through: u32,
    pub calculated: CalculatedReport,
    pub seen: SeenReport,
    pub witnessed_enemy_destruction: WitnessedEnemyDestructionReport,
    pub own_lost: OwnLostReport,
    pub own_units: Vec<OwnUnitReport>,
    pub own_mines: OwnMinesReport,
}

#[derive(Clone, Debug)]
struct Unit {
    id: u32,
    square: Square,
    kind: UnitType,
    mode: Option<TankMode>,
    paid: u32,
    origin: EntityOrigin,
    born_at: LedgerPosition,
    type_changes: Vec<TypeChange>,
}

#[derive(Clone, Debug)]
struct Mine {
    id: u32,
    square: Square,
    origin: EntityOrigin,
    born_at: LedgerPosition,
}

#[derive(Clone, Debug)]
struct Loss {
    unit: Unit,
    at: LedgerPosition,
    replacement: u32,
}

#[derive(Clone, Debug)]
struct RemovedMine {
    mine: Mine,
    at: LedgerPosition,
    subject: MineSubject,
}

#[derive(Clone, Copy, Debug)]
enum Disposition {
    Materialized { unit_id: u32, at: LedgerPosition },
    Wasted { at: LedgerPosition },
}

#[derive(Clone, Debug)]
struct Deployment {
    reference: ActionRef,
    kind: UnitType,
    minerals: u32,
    admitted_at: LedgerPosition,
    disposition: Option<Disposition>,
}

#[derive(Clone, Debug)]
struct Witness {
    id: u32,
    square: Square,
    kind: UnitType,
    reference: Option<ActionRef>,
    at: LedgerPosition,
}

#[derive(Clone, Debug)]
struct SideState {
    side: Side,
    origin: OriginReport,
    bank: u32,
    gas: u32,
    gas_capacity: u32,
    cc_lives: u32,
    credits: u64,
    debits: u64,
    entitlement: u64,
    cap_discard: u64,
    gas_debits: u64,
    gas_discard: u64,
    gas_refills: u64,
    unit_counter: u32,
    mine_counter: u32,
    witness_counter: u32,
    units: Vec<Unit>,
    mines: Vec<Mine>,
    losses: Vec<Loss>,
    removed_mines: Vec<RemovedMine>,
    actions: Vec<ActionReceiptReport>,
    deployments: Vec<Deployment>,
    settlements: Vec<SettlementReceiptReport>,
    witnesses: Vec<Witness>,
    cells: Vec<ObservedCell>,
    ever_lit: [bool; 64],
    memory: [Option<LastSeenAssertion>; 64],
}

#[derive(Debug)]
pub struct LedgerPair {
    rules: LedgerRules,
    states: Pair<SideState>,
    last: Pair<EconomicBoundary>,
    canonical: Pair<Vec<u8>>,
}

impl LedgerPair {
    pub fn initialize(
        rules: LedgerRules,
        boundaries: &Pair<EconomicBoundary>,
        work: &mut LedgerWork,
    ) -> ContractResult<Self> {
        validate_pair(&rules, boundaries, work)?;
        if boundaries.w.phase != BoundaryPhase::Initial {
            return Err(sequence(
                "Ledger initialization requires initial boundaries",
            ));
        }
        let canonical = canonical_pair(boundaries, work)?;
        let states = Pair {
            w: SideState::initialize(&rules, &boundaries.w, work)?,
            b: SideState::initialize(&rules, &boundaries.b, work)?,
        };
        let last = clone_boundaries(boundaries, work)?;
        Ok(Self {
            rules,
            states,
            last,
            canonical,
        })
    }

    pub fn advance(
        &self,
        boundaries: &Pair<EconomicBoundary>,
        work: &mut LedgerWork,
    ) -> ContractResult<Self> {
        validate_pair(&self.rules, boundaries, work)?;
        let canonical = canonical_pair(boundaries, work)?;
        let current = self.last.w.ordinal;
        if boundaries.w.ordinal == current {
            charge_count(work, canonical.w.len(), IDENTITY_BYTE)?;
            charge_count(work, canonical.b.len(), IDENTITY_BYTE)?;
            if canonical != self.canonical {
                return Err(identity(
                    "Current boundary ordinal has conflicting complete bytes",
                ));
            }
            return self.clone_metered(work);
        }
        if boundaries.w.ordinal < current {
            return Err(sequence("Older boundary ordinals cannot replay"));
        }
        validate_transition(&self.last, boundaries)?;
        if self.states.w.cc_lives == 0
            || self.states.b.cc_lives == 0
            || self.last.w.turn >= self.rules.max_turn
        {
            return Err(sequence("A terminal ledger cannot accept a new boundary"));
        }
        let states = Pair {
            w: self
                .states
                .w
                .advance(&self.rules, &self.last.w, &boundaries.w, work)?,
            b: self
                .states
                .b
                .advance(&self.rules, &self.last.b, &boundaries.b, work)?,
        };
        charge_profile_clone(&self.rules, work)?;
        let rules = self.rules.clone();
        let last = clone_boundaries(boundaries, work)?;
        Ok(Self {
            rules,
            states,
            last,
            canonical,
        })
    }

    pub fn reports(&self, work: &mut LedgerWork) -> ContractResult<Pair<SideLedgerReport>> {
        Ok(Pair {
            w: self.states.w.report(&self.rules, &self.last.w, work)?,
            b: self.states.b.report(&self.rules, &self.last.b, work)?,
        })
    }

    pub const fn rules(&self) -> &LedgerRules {
        &self.rules
    }
    pub const fn last_boundaries(&self) -> &Pair<EconomicBoundary> {
        &self.last
    }

    fn clone_metered(&self, work: &mut LedgerWork) -> ContractResult<Self> {
        charge_profile_clone(&self.rules, work)?;
        self.states.w.charge_state(work, STATE_ITEM)?;
        self.states.b.charge_state(work, STATE_ITEM)?;
        let last = clone_boundaries(&self.last, work)?;
        charge_count(work, self.canonical.w.len(), IDENTITY_BYTE)?;
        charge_count(work, self.canonical.b.len(), IDENTITY_BYTE)?;
        Ok(Self {
            rules: self.rules.clone(),
            states: self.states.clone(),
            last,
            canonical: self.canonical.clone(),
        })
    }
}

fn validate_pair(
    rules: &LedgerRules,
    pair: &Pair<EconomicBoundary>,
    work: &mut LedgerWork,
) -> ContractResult<()> {
    pair.w.validate(rules, work)?;
    pair.b.validate(rules, work)?;
    if pair.w.side != Side::White || pair.b.side != Side::Black {
        return Err(identity(
            "Boundary pair recipients do not match their seats",
        ));
    }
    if pair.w.version != pair.b.version
        || pair.w.phase != pair.b.phase
        || pair.w.ordinal != pair.b.ordinal
        || pair.w.turn != pair.b.turn
        || pair.w.planning_ordinal != pair.b.planning_ordinal
        || pair.w.grant_ordinal != pair.b.grant_ordinal
    {
        return Err(sequence("Boundary pair public clocks are not synchronized"));
    }
    Ok(())
}

fn validate_transition(
    previous: &Pair<EconomicBoundary>,
    next: &Pair<EconomicBoundary>,
) -> ContractResult<()> {
    for side in [Side::White, Side::Black] {
        let before = previous.get(side);
        let after = next.get(side);
        if before.ordinal.checked_add(1) != Some(after.ordinal)
            || after.seq_before != before.seq_through
        {
            return Err(sequence(
                "Boundary ordinal or recipient group sequence is not consecutive",
            ));
        }
        match (before.phase, after.phase) {
            (BoundaryPhase::Initial | BoundaryPhase::Settled, BoundaryPhase::TurnOpen) => {
                if after.planning_ordinal != before.planning_ordinal
                    || after.grant_ordinal != before.grant_ordinal
                {
                    return Err(sequence("Opening a window cannot consume a grant ordinal"));
                }
                let terminal =
                    next.w.snapshot.own.cc_lives == 0 || next.b.snapshot.own.cc_lives == 0;
                let expected_turn = if terminal {
                    before.turn.checked_add(1)
                } else {
                    Some(before.turn)
                };
                if expected_turn != Some(after.turn) {
                    return Err(sequence(
                        "Native Begin turn advance requires a terminal boundary",
                    ));
                }
            }
            (BoundaryPhase::TurnOpen, BoundaryPhase::Settled) => {
                if before.planning_ordinal.checked_add(1) != Some(after.planning_ordinal)
                    || before.grant_ordinal.checked_add(1) != Some(after.grant_ordinal)
                    || before.turn.checked_add(1) != Some(after.turn)
                {
                    return Err(sequence(
                        "Settlement must advance its native turn and both window ordinals once",
                    ));
                }
            }
            _ => return Err(sequence("Ledger boundary phase order is invalid")),
        }
    }
    Ok(())
}

fn canonical_pair(
    pair: &Pair<EconomicBoundary>,
    work: &mut LedgerWork,
) -> ContractResult<Pair<Vec<u8>>> {
    Ok(Pair {
        w: canonical_boundary_bytes(&pair.w, work)?,
        b: canonical_boundary_bytes(&pair.b, work)?,
    })
}

fn clone_boundaries(
    pair: &Pair<EconomicBoundary>,
    work: &mut LedgerWork,
) -> ContractResult<Pair<EconomicBoundary>> {
    work.charge_boundary(&pair.w)?;
    work.charge_boundary(&pair.b)?;
    Ok(pair.clone())
}

fn charge_profile_clone(rules: &LedgerRules, work: &mut LedgerWork) -> ContractResult<()> {
    work.charge(PROFILE_CLONE)?;
    charge_count(work, rules.income_by_turn.len(), PROFILE_ENTRY)?;
    charge_count(work, rules.gas_capacity_by_turn.len(), PROFILE_ENTRY)
}

impl SideState {
    fn initialize(
        rules: &LedgerRules,
        boundary: &EconomicBoundary,
        work: &mut LedgerWork,
    ) -> ContractResult<Self> {
        work.charge(STATE_BASE)?;
        work.charge_snapshot(&boundary.snapshot)?;
        charge_count(work, boundary.snapshot.own.pieces.len(), STATE_ITEM)?;
        charge_count(work, boundary.snapshot.own.mines.len(), STATE_ITEM)?;
        charge_count(work, 64, STATE_CELL + STATE_MEMORY)?;
        let own = &boundary.snapshot.own;
        let at = position(boundary, 0);
        let mut state = Self {
            side: boundary.side,
            origin: OriginReport {
                native_turn: boundary.turn,
                minerals: own.minerals,
                gas: own.gas,
                gas_capacity: own.gas_income,
                cc_lives: own.cc_lives,
                native_unit_cost_sum: 0,
                non_cc_replacement_value: 0,
                paid_mineral_basis: 0,
            },
            bank: own.minerals,
            gas: own.gas,
            gas_capacity: own.gas_income,
            cc_lives: own.cc_lives,
            credits: 0,
            debits: 0,
            entitlement: 0,
            cap_discard: 0,
            gas_debits: 0,
            gas_discard: 0,
            gas_refills: 0,
            unit_counter: 0,
            mine_counter: 0,
            witness_counter: 0,
            units: Vec::with_capacity(own.pieces.len()),
            mines: Vec::with_capacity(own.mines.len()),
            losses: Vec::new(),
            removed_mines: Vec::new(),
            actions: Vec::new(),
            deployments: Vec::new(),
            settlements: Vec::new(),
            witnesses: Vec::new(),
            cells: boundary.snapshot.cells.clone(),
            ever_lit: [false; 64],
            memory: [None; 64],
        };
        for piece in &own.pieces {
            let id = increment(&mut state.unit_counter)?;
            state.origin.native_unit_cost_sum = add(
                state.origin.native_unit_cost_sum,
                u64::from(rules.unit_costs.get(piece.kind)),
            )?;
            state.origin.non_cc_replacement_value = add(
                state.origin.non_cc_replacement_value,
                u64::from(rules.non_cc_replacement(piece.kind)),
            )?;
            state.units.push(Unit {
                id,
                square: piece.square,
                kind: piece.kind,
                mode: (piece.kind == UnitType::Rook).then_some(
                    if own.sieged_tanks.binary_search(&piece.square).is_ok() {
                        TankMode::Siege
                    } else {
                        TankMode::Tank
                    },
                ),
                paid: 0,
                origin: EntityOrigin::Endowed {},
                born_at: at,
                type_changes: Vec::new(),
            });
        }
        for square in &own.mines {
            let id = increment(&mut state.mine_counter)?;
            state.mines.push(Mine {
                id,
                square: *square,
                origin: EntityOrigin::Endowed {},
                born_at: at,
            });
        }
        state.fold_observations(&boundary.snapshot.cells, boundary.turn, work)?;
        state.check_conservation(rules, work)?;
        Ok(state)
    }

    fn charge_state(&self, work: &mut LedgerWork, fee: u64) -> ContractResult<()> {
        work.charge(STATE_BASE)?;
        charge_count(work, self.cells.len(), STATE_CELL)?;
        charge_count(work, 64, STATE_MEMORY)?;
        for count in [
            self.units.len(),
            self.mines.len(),
            self.losses.len(),
            self.removed_mines.len(),
            self.actions.len(),
            self.deployments.len(),
            self.settlements.len(),
            self.witnesses.len(),
        ] {
            charge_count(work, count, fee)?;
        }
        for unit in &self.units {
            charge_count(work, unit.type_changes.len(), fee)?;
        }
        for loss in &self.losses {
            charge_count(work, loss.unit.type_changes.len(), fee)?;
        }
        Ok(())
    }

    fn advance(
        &self,
        rules: &LedgerRules,
        previous: &EconomicBoundary,
        boundary: &EconomicBoundary,
        work: &mut LedgerWork,
    ) -> ContractResult<Self> {
        self.charge_state(work, STATE_ITEM)?;
        let mut state = self.clone();
        let is_open = boundary.phase == BoundaryPhase::TurnOpen;
        if is_open {
            let capacity = previous.snapshot.own.gas_income;
            if boundary.snapshot.own.gas != capacity || boundary.snapshot.own.gas_income != capacity
            {
                return Err(conservation(
                    "Native opening gas must refill exactly to its actual capacity",
                ));
            }
            state.gas = capacity;
            state.gas_capacity = capacity;
            state.gas_refills = add(state.gas_refills, 1)?;
        }
        let mut admissions_closed = false;
        let mut action_ordinal = 0_u32;
        let mut observation_turn = previous.turn;
        for group in &boundary.groups {
            let at = position(boundary, group.seq());
            match group {
                AtomicGroup::Admission { actions, .. } => {
                    if is_open || admissions_closed {
                        return Err(sequence(
                            "Admissions must precede settled effects and vision",
                        ));
                    }
                    for action in actions {
                        if action.action_ref.accepted_action_ordinal != action_ordinal {
                            return Err(sequence(
                                "Accepted action ordinals must be contiguous in admission order",
                            ));
                        }
                        action_ordinal = action_ordinal
                            .checked_add(1)
                            .ok_or_else(|| sequence("Action ordinal overflow"))?;
                        state.admit(action, at, work)?;
                    }
                }
                AtomicGroup::Effects {
                    before_own,
                    after_own,
                    facts,
                    ..
                } => {
                    admissions_closed = true;
                    state.effects(
                        rules,
                        before_own,
                        after_own,
                        facts,
                        at,
                        is_open,
                        previous.planning_ordinal,
                        work,
                    )?;
                }
                AtomicGroup::Vision { turn, changes, .. } => {
                    admissions_closed = true;
                    if *turn < observation_turn {
                        return Err(sequence(
                            "Vision timestamps cannot regress within a boundary",
                        ));
                    }
                    observation_turn = *turn;
                    state.fold_observations(changes, *turn, work)?;
                }
                AtomicGroup::Settlement {
                    entitlement,
                    credited,
                    gas_before_reset,
                    next_gas_capacity,
                    ..
                } => {
                    admissions_closed = true;
                    state.settle(
                        rules,
                        boundary,
                        at,
                        *entitlement,
                        *credited,
                        *gas_before_reset,
                        *next_gas_capacity,
                        work,
                    )?;
                }
            }
        }
        if !is_open {
            charge_count(work, state.deployments.len(), ARITHMETIC_ITEM)?;
            if state
                .deployments
                .iter()
                .any(|receipt| receipt.disposition.is_none())
            {
                return Err(conservation(
                    "Accepted deployment has no unique materialized or wasted disposition",
                ));
            }
        }
        let geometry = state.geometry(work)?;
        let expected = OwnGeometry::from_snapshot(&boundary.snapshot, work)?;
        if geometry != expected
            || state.bank != boundary.snapshot.own.minerals
            || state.gas != boundary.snapshot.own.gas
            || state.gas_capacity != boundary.snapshot.own.gas_income
        {
            return Err(conservation(
                "Final snapshot disagrees with reconstructed own geometry or balances",
            ));
        }
        charge_count(work, 64, STATE_CELL)?;
        if state.cells != boundary.snapshot.cells {
            return Err(provenance(
                "Final authorized cells do not match the ordered vision history",
            ));
        }
        state.fold_observations(&boundary.snapshot.cells, boundary.turn, work)?;
        state.check_conservation(rules, work)?;
        Ok(state)
    }

    fn admit(
        &mut self,
        accepted: &AcceptedOwnAction,
        at: LedgerPosition,
        work: &mut LedgerWork,
    ) -> ContractResult<()> {
        work.charge(FOLD_ACTION)?;
        self.bank = self
            .bank
            .checked_sub(accepted.minerals)
            .ok_or_else(|| conservation("Accepted mineral debit exceeds the available bank"))?;
        self.gas = self
            .gas
            .checked_sub(accepted.gas)
            .ok_or_else(|| conservation("Accepted gas debit exceeds the open available gas"))?;
        self.debits = add(self.debits, u64::from(accepted.minerals))?;
        self.gas_debits = add(self.gas_debits, u64::from(accepted.gas))?;
        self.actions.push(ActionReceiptReport {
            action_ref: accepted.action_ref,
            action: accepted.action.clone(),
            minerals: accepted.minerals,
            gas: accepted.gas,
            admitted_at: at,
        });
        if let Action::Deploy { unit, .. } = accepted.action {
            work.charge(STATE_ITEM)?;
            self.deployments.push(Deployment {
                reference: accepted.action_ref,
                kind: spawn_kind(unit),
                minerals: accepted.minerals,
                admitted_at: at,
                disposition: None,
            });
        }
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    fn settle(
        &mut self,
        rules: &LedgerRules,
        boundary: &EconomicBoundary,
        at: LedgerPosition,
        entitlement: u32,
        credited: u32,
        gas_before_reset: u32,
        next_gas_capacity: u32,
        work: &mut LedgerWork,
    ) -> ContractResult<()> {
        work.charge(STATE_ITEM)?;
        let room = rules
            .mineral_bank_cap
            .checked_sub(self.bank)
            .ok_or_else(|| conservation("Own mineral bank exceeds its cap"))?;
        let expected = entitlement.min(room);
        if entitlement != rules.income_at(boundary.turn)?
            || credited != expected
            || gas_before_reset != self.gas
            || next_gas_capacity != rules.gas_capacity_at(boundary.turn)?
        {
            return Err(conservation(
                "Settlement credit or gas-reset receipt does not balance",
            ));
        }
        let discarded = entitlement
            .checked_sub(credited)
            .ok_or_else(|| conservation("Credited minerals exceed entitlement"))?;
        self.bank = self
            .bank
            .checked_add(credited)
            .ok_or_else(|| conservation("Mineral bank overflow"))?;
        self.credits = add(self.credits, u64::from(credited))?;
        self.entitlement = add(self.entitlement, u64::from(entitlement))?;
        self.cap_discard = add(self.cap_discard, u64::from(discarded))?;
        self.gas_discard = add(self.gas_discard, u64::from(self.gas))?;
        self.gas = 0;
        self.gas_capacity = next_gas_capacity;
        self.settlements.push(SettlementReceiptReport {
            at,
            planning_ordinal: boundary.planning_ordinal,
            grant_ordinal: boundary.grant_ordinal,
            entitlement,
            credited,
            cap_discard: discarded,
            gas_before_reset,
            next_gas_capacity,
        });
        Ok(())
    }

    fn geometry(&self, work: &mut LedgerWork) -> ContractResult<OwnGeometry> {
        charge_count(work, self.units.len(), GEOMETRY_ITEM)?;
        charge_count(work, self.mines.len(), GEOMETRY_ITEM)?;
        let mut units: Vec<_> = self
            .units
            .iter()
            .map(|unit| OwnUnitGeometry {
                square: unit.square,
                kind: unit.kind,
                mode: unit.mode,
            })
            .collect();
        units.sort_by_key(|unit| unit.square);
        let mine_locators = self.mine_locators(work)?;
        Ok(OwnGeometry {
            units,
            mines: mine_locators
                .into_iter()
                .map(|(occurrence, _)| occurrence)
                .collect(),
            cc_lives: self.cc_lives,
        })
    }

    fn mine_locators(&self, work: &mut LedgerWork) -> ContractResult<Vec<(MineOccurrence, u32)>> {
        charge_count(work, self.mines.len(), GEOMETRY_ITEM)?;
        let mut ordered: Vec<_> = self
            .mines
            .iter()
            .map(|mine| (mine.square, mine.id))
            .collect();
        ordered.sort_unstable();
        let mut previous: Option<MineOccurrence> = None;
        let mut result = Vec::with_capacity(ordered.len());
        for (square, id) in ordered {
            let slot = match previous {
                Some(last) if last.square == square => last
                    .slot
                    .checked_add(1)
                    .ok_or_else(|| identity("Mine occurrence slot overflow"))?,
                _ => 0,
            };
            let occurrence = MineOccurrence { square, slot };
            result.push((occurrence, id));
            previous = Some(occurrence);
        }
        Ok(result)
    }

    #[allow(clippy::too_many_arguments)]
    fn effects(
        &mut self,
        rules: &LedgerRules,
        before: &OwnGeometry,
        after: &OwnGeometry,
        facts: &[EffectFact],
        at: LedgerPosition,
        is_open: bool,
        planning: u32,
        work: &mut LedgerWork,
    ) -> ContractResult<()> {
        if self.geometry(work)? != *before {
            return Err(identity(
                "Effects beforeOwn does not match the retained lineage image",
            ));
        }
        charge_count(work, self.units.len(), GEOMETRY_ITEM)?;
        let mut before_units = [None; 64];
        for unit in &self.units {
            before_units[unit.square.index()] = Some(unit.id);
        }
        let before_mines = self.mine_locators(work)?;
        charge_count(work, facts.len(), FOLD_FACT)?;
        let mut born_units: Vec<(ActionRef, u32)> = Vec::new();
        let mut born_mines: Vec<(ActionRef, u32)> = Vec::new();
        for fact in facts {
            match fact {
                EffectFact::UnitBorn {
                    action_ref,
                    square,
                    kind,
                    mode,
                } => {
                    if is_open {
                        return Err(provenance(
                            "Native Begin cannot materialize an admitted deployment",
                        ));
                    }
                    let action = self.action(*action_ref, planning, work)?;
                    if !matches!(&action.action, Action::Deploy { to, unit, .. } if to == square && spawn_kind(*unit) == *kind)
                    {
                        return Err(provenance(
                            "Unit birth does not bind its accepted deployment type and destination",
                        ));
                    }
                    let receipt = self.deployment_index(*action_ref, work)?;
                    if self.deployments[receipt].disposition.is_some() {
                        return Err(identity("Deployment disposition was already recorded"));
                    }
                    work.charge(STATE_ITEM)?;
                    let id = increment(&mut self.unit_counter)?;
                    let paid = self.deployments[receipt].minerals;
                    self.deployments[receipt].disposition =
                        Some(Disposition::Materialized { unit_id: id, at });
                    self.units.push(Unit {
                        id,
                        square: *square,
                        kind: *kind,
                        mode: *mode,
                        paid,
                        origin: EntityOrigin::Action {
                            action_ref: *action_ref,
                        },
                        born_at: at,
                        type_changes: Vec::new(),
                    });
                    born_units.push((*action_ref, id));
                }
                EffectFact::UnitMoved { subject, from, to } => {
                    let id = resolve_unit(subject, &before_units, &born_units, work)?;
                    let unit = self.unit_mut(id, work)?;
                    if unit.square != *from {
                        return Err(identity(
                            "Unit movement source disagrees with its bound lineage",
                        ));
                    }
                    unit.square = *to;
                }
                EffectFact::UnitTransformed {
                    subject,
                    from_type,
                    to_type,
                    to_mode,
                } => {
                    let id = resolve_unit(subject, &before_units, &born_units, work)?;
                    work.charge(STATE_ITEM)?;
                    let unit = self.unit_mut(id, work)?;
                    if unit.kind != *from_type
                        || *from_type != UnitType::Pawn
                        || matches!(to_type, UnitType::Pawn | UnitType::King)
                    {
                        return Err(identity(
                            "Unit transformation disagrees with its pawn lineage",
                        ));
                    }
                    unit.kind = *to_type;
                    unit.mode = *to_mode;
                    unit.type_changes.push(TypeChange {
                        at,
                        from_type: *from_type,
                        to_type: *to_type,
                    });
                }
                EffectFact::UnitModeChanged {
                    subject,
                    before,
                    after,
                } => {
                    let id = resolve_unit(subject, &before_units, &born_units, work)?;
                    let unit = self.unit_mut(id, work)?;
                    if unit.kind != UnitType::Rook || unit.mode != Some(*before) {
                        return Err(identity(
                            "Tank mode change disagrees with the bound rook mode",
                        ));
                    }
                    unit.mode = Some(*after);
                }
                EffectFact::UnitDestroyed {
                    subject,
                    square,
                    kind,
                } => {
                    let id = resolve_unit(subject, &before_units, &born_units, work)?;
                    let index = self.unit_index(id, work)?;
                    let unit = &self.units[index];
                    if unit.square != *square || unit.kind != *kind || *kind == UnitType::King {
                        return Err(identity(
                            "Own destruction disagrees with the bound ordinary lineage",
                        ));
                    }
                    work.charge(STATE_ITEM)?;
                    let unit = self.units.remove(index);
                    self.losses.push(Loss {
                        unit,
                        at,
                        replacement: rules.non_cc_replacement(*kind),
                    });
                }
                EffectFact::DeploymentUnmaterialized { action_ref } => {
                    if is_open {
                        return Err(provenance(
                            "Native Begin cannot dispose an admitted deployment",
                        ));
                    }
                    self.action(*action_ref, planning, work)?;
                    let receipt = self.deployment_index(*action_ref, work)?;
                    if self.deployments[receipt].disposition.is_some() {
                        return Err(identity("Deployment disposition was already recorded"));
                    }
                    self.deployments[receipt].disposition = Some(Disposition::Wasted { at });
                }
                EffectFact::MineBorn { action_ref, square } => {
                    if is_open {
                        return Err(provenance(
                            "Native Begin cannot create an action-bound mine",
                        ));
                    }
                    if !matches!(
                        self.action(*action_ref, planning, work)?.action,
                        Action::SpiderMine { .. }
                    ) {
                        return Err(provenance(
                            "Mine birth requires a known accepted spiderMine action",
                        ));
                    }
                    charge_count(work, self.mines.len(), RESOLVE_ITEM)?;
                    charge_count(work, self.removed_mines.len(), RESOLVE_ITEM)?;
                    let origin = EntityOrigin::Action {
                        action_ref: *action_ref,
                    };
                    if self.mines.iter().any(|mine| mine.origin == origin)
                        || self
                            .removed_mines
                            .iter()
                            .any(|mine| mine.mine.origin == origin)
                    {
                        return Err(identity(
                            "One accepted mine action cannot create two mine entities",
                        ));
                    }
                    work.charge(STATE_ITEM)?;
                    let id = increment(&mut self.mine_counter)?;
                    self.mines.push(Mine {
                        id,
                        square: *square,
                        origin,
                        born_at: at,
                    });
                    born_mines.push((*action_ref, id));
                }
                EffectFact::MineRemoved { subject } => {
                    let id = resolve_mine(subject, &before_mines, &born_mines, work)?;
                    charge_count(work, self.mines.len(), RESOLVE_ITEM)?;
                    let index = self
                        .mines
                        .iter()
                        .position(|mine| mine.id == id)
                        .ok_or_else(|| identity("Mine lineage is absent or already retired"))?;
                    work.charge(STATE_ITEM)?;
                    let mine = self.mines.remove(index);
                    self.removed_mines.push(RemovedMine {
                        mine,
                        at,
                        subject: subject.clone(),
                    });
                }
                EffectFact::CcLivesChanged { before, after } => {
                    if self.cc_lives != *before || after >= before {
                        return Err(conservation(
                            "CC life change must decrease the exact current life count",
                        ));
                    }
                    self.cc_lives = *after;
                }
                EffectFact::EnemyDestructionWitnessed {
                    square,
                    kind,
                    own_action_ref,
                } => {
                    if let Some(reference) = own_action_ref {
                        if is_open {
                            return Err(provenance(
                                "Automatic Begin witness cannot claim a current own action",
                            ));
                        }
                        self.action(*reference, planning, work)?;
                    }
                    work.charge(STATE_ITEM)?;
                    let id = increment(&mut self.witness_counter)?;
                    self.witnesses.push(Witness {
                        id,
                        square: *square,
                        kind: *kind,
                        reference: *own_action_ref,
                        at,
                    });
                    if self.memory[square.index()].is_some_and(|memory| {
                        memory.kind == *kind && memory.color == self.side.other()
                    }) {
                        self.memory[square.index()] = None;
                    }
                }
            }
        }
        let geometry = self.geometry(work)?;
        geometry.validate(rules, work)?;
        if geometry != *after {
            return Err(conservation(
                "Atomic effects do not reconcile to the whole afterOwn image",
            ));
        }
        Ok(())
    }

    fn action(
        &self,
        reference: ActionRef,
        planning: u32,
        work: &mut LedgerWork,
    ) -> ContractResult<&ActionReceiptReport> {
        charge_count(work, self.actions.len(), RESOLVE_ITEM)?;
        if reference.planning_ordinal != planning {
            return Err(provenance(
                "Effect action reference belongs to another planning window",
            ));
        }
        self.actions
            .iter()
            .find(|receipt| receipt.action_ref == reference)
            .ok_or_else(|| provenance("Effect references an undeclared accepted own action"))
    }

    fn deployment_index(
        &self,
        reference: ActionRef,
        work: &mut LedgerWork,
    ) -> ContractResult<usize> {
        charge_count(work, self.deployments.len(), RESOLVE_ITEM)?;
        self.deployments
            .iter()
            .position(|receipt| receipt.reference == reference)
            .ok_or_else(|| provenance("Effect references no paid deployment receipt"))
    }

    fn unit_index(&self, id: u32, work: &mut LedgerWork) -> ContractResult<usize> {
        charge_count(work, self.units.len(), RESOLVE_ITEM)?;
        self.units
            .iter()
            .position(|unit| unit.id == id)
            .ok_or_else(|| identity("Unit lineage is absent or already retired"))
    }

    fn unit_mut(&mut self, id: u32, work: &mut LedgerWork) -> ContractResult<&mut Unit> {
        let index = self.unit_index(id, work)?;
        Ok(&mut self.units[index])
    }

    fn fold_observations(
        &mut self,
        changes: &[ObservedCell],
        turn: u32,
        work: &mut LedgerWork,
    ) -> ContractResult<()> {
        charge_count(work, changes.len(), STATE_CELL + STATE_MEMORY)?;
        for cell in changes {
            let index = cell.square().index();
            let piece: Option<&ObservedPiece> = match cell {
                ObservedCell::Unknown { .. } => None,
                ObservedCell::Lit { piece, .. } => {
                    self.ever_lit[index] = true;
                    piece.as_ref()
                }
                ObservedCell::Revealed { piece, .. } => {
                    if piece.color == self.side {
                        return Err(provenance(
                            "Transient revealed cells cannot contain own pieces",
                        ));
                    }
                    Some(piece)
                }
            };
            match piece {
                Some(piece) if piece.color != self.side => {
                    if self.memory[index].is_some_and(|old| old.last_observed_turn > turn) {
                        return Err(sequence("Enemy observation timestamp regressed"));
                    }
                    self.memory[index] = Some(LastSeenAssertion {
                        square: cell.square(),
                        kind: piece.kind,
                        color: piece.color,
                        last_observed_turn: turn,
                    });
                }
                _ if !matches!(cell, ObservedCell::Unknown { .. }) => self.memory[index] = None,
                _ => {}
            }
            self.cells[index] = cell.clone();
        }
        Ok(())
    }

    fn paid_totals(&self, work: &mut LedgerWork) -> ContractResult<(u64, u64, u64)> {
        charge_count(work, self.units.len(), ARITHMETIC_ITEM)?;
        charge_count(work, self.losses.len(), ARITHMETIC_ITEM)?;
        charge_count(work, self.deployments.len(), ARITHMETIC_ITEM)?;
        let surviving = sum(self.units.iter().map(|unit| u64::from(unit.paid)))?;
        let destroyed = sum(self.losses.iter().map(|loss| u64::from(loss.unit.paid)))?;
        let wasted = sum(self
            .deployments
            .iter()
            .filter(|receipt| matches!(receipt.disposition, Some(Disposition::Wasted { .. })))
            .map(|receipt| u64::from(receipt.minerals)))?;
        Ok((surviving, destroyed, wasted))
    }

    fn check_conservation(&self, rules: &LedgerRules, work: &mut LedgerWork) -> ContractResult<()> {
        work.charge(ARITHMETIC_ITEM)?;
        let balance = add(u64::from(self.origin.minerals), self.credits)?
            .checked_sub(self.debits)
            .ok_or_else(|| conservation("Mineral receipts imply a negative own balance"))?;
        let (surviving, destroyed, wasted) = self.paid_totals(work)?;
        if balance != u64::from(self.bank)
            || self.bank > rules.mineral_bank_cap
            || add(add(surviving, destroyed)?, wasted)? != self.debits
            || add(self.credits, self.cap_discard)? != self.entitlement
        {
            return Err(conservation(
                "Mineral bank, entitlement, or paid lineage does not conserve",
            ));
        }
        Ok(())
    }

    fn report(
        &self,
        rules: &LedgerRules,
        boundary: &EconomicBoundary,
        work: &mut LedgerWork,
    ) -> ContractResult<SideLedgerReport> {
        self.charge_state(work, REPORT_ITEM)?;
        self.check_conservation(rules, work)?;
        let (surviving, destroyed, wasted) = self.paid_totals(work)?;
        let native_cost = sum(self
            .units
            .iter()
            .map(|unit| u64::from(rules.unit_costs.get(unit.kind))))?;
        let replacement = sum(self
            .units
            .iter()
            .map(|unit| u64::from(rules.non_cc_replacement(unit.kind))))?;
        let lost_replacement = sum(self.losses.iter().map(|loss| u64::from(loss.replacement)))?;
        let witness_replacement = sum(self
            .witnesses
            .iter()
            .map(|witness| u64::from(rules.non_cc_replacement(witness.kind))))?;
        let caused_replacement = sum(self
            .witnesses
            .iter()
            .filter(|witness| witness.reference.is_some())
            .map(|witness| u64::from(rules.non_cc_replacement(witness.kind))))?;
        let caused_count = count_u64(
            self.witnesses
                .iter()
                .filter(|witness| witness.reference.is_some())
                .count(),
        )?;
        let mut deployment_receipts = Vec::with_capacity(self.deployments.len());
        for receipt in &self.deployments {
            let disposition = match receipt.disposition {
                Some(Disposition::Materialized { unit_id, at }) => {
                    DeploymentDispositionReport::Materialized {
                        unit_id: format!("u{unit_id}"),
                        at,
                    }
                }
                Some(Disposition::Wasted { at }) => {
                    DeploymentDispositionReport::Unmaterialized { at }
                }
                None => {
                    return Err(conservation(
                        "A published report cannot contain a pending deployment receipt",
                    ));
                }
            };
            deployment_receipts.push(DeploymentReceiptReport {
                action_ref: receipt.reference,
                kind: receipt.kind,
                minerals: receipt.minerals,
                admitted_at: receipt.admitted_at,
                disposition,
            });
        }
        let own_units = self
            .units
            .iter()
            .map(|unit| unit_report(unit, rules))
            .collect();
        let units = self
            .losses
            .iter()
            .map(|loss| OwnLossReport {
                unit: unit_report(&loss.unit, rules),
                lost_at: loss.at,
                replacement_value_at_loss: loss.replacement,
            })
            .collect();
        let locators = self.mine_locators(work)?;
        let mut active = Vec::with_capacity(locators.len());
        for (occurrence, id) in locators {
            charge_count(work, self.mines.len(), RESOLVE_ITEM)?;
            let mine = self
                .mines
                .iter()
                .find(|mine| mine.id == id)
                .ok_or_else(|| identity("Active mine locator has no lineage"))?;
            active.push(OwnMineReport {
                id: format!("m{}", mine.id),
                square: mine.square,
                slot: occurrence.slot,
                origin: mine.origin.clone(),
                born_at: mine.born_at,
            });
        }
        let removed = self
            .removed_mines
            .iter()
            .map(|removed| RemovedMineReport {
                id: format!("m{}", removed.mine.id),
                square: removed.mine.square,
                origin: removed.mine.origin.clone(),
                born_at: removed.mine.born_at,
                removed_at: removed.at,
                subject: removed.subject.clone(),
            })
            .collect();
        let witnesses = self
            .witnesses
            .iter()
            .map(|witness| DestructionWitnessReport {
                id: format!("w{}", witness.id),
                square: witness.square,
                kind: witness.kind,
                replacement_value: rules.non_cc_replacement(witness.kind),
                own_action_ref: witness.reference,
                at: witness.at,
            })
            .collect();
        Ok(SideLedgerReport {
            side: self.side,
            scope: LedgerScope::RecordInitialForward,
            boundary_ordinal: boundary.ordinal,
            native_turn: boundary.turn,
            planning_ordinal: boundary.planning_ordinal,
            grant_ordinal: boundary.grant_ordinal,
            sequence_through: boundary.seq_through,
            calculated: CalculatedReport {
                origin: self.origin.clone(),
                minerals: MineralReport {
                    origin_bank: self.origin.minerals,
                    nominal_entitlement: self.entitlement,
                    actual_credits: self.credits,
                    paid_debits: self.debits,
                    cap_discard: self.cap_discard,
                    current_bank: self.bank,
                    surviving_paid_basis: surviving,
                    destroyed_paid_basis: destroyed,
                    wasted_paid_basis: wasted,
                },
                gas: GasReport {
                    origin_available: self.origin.gas,
                    available: self.gas,
                    capacity: self.gas_capacity,
                    accepted_debits: self.gas_debits,
                    unused_discarded: self.gas_discard,
                    refill_count: self.gas_refills,
                },
                own_material: OwnMaterialReport {
                    native_unit_cost_sum: native_cost,
                    non_cc_replacement_value: replacement,
                    paid_mineral_basis: surviving,
                    cc_lives: self.cc_lives,
                },
                accepted_actions: self.actions.clone(),
                deployment_receipts,
                settlements: self.settlements.clone(),
            },
            seen: self.seen(rules, work)?,
            witnessed_enemy_destruction: WitnessedEnemyDestructionReport {
                count: count_u64(self.witnesses.len())?,
                replacement_value: witness_replacement,
                own_action_caused_witnessed_enemy_destruction: DestructionTotals {
                    count: caused_count,
                    replacement_value: caused_replacement,
                },
                witnesses,
            },
            own_lost: OwnLostReport {
                count: count_u64(self.losses.len())?,
                paid_mineral_basis: destroyed,
                replacement_value_at_loss: lost_replacement,
                units,
                wasted_deployment_paid_basis: wasted,
            },
            own_units,
            own_mines: OwnMinesReport { active, removed },
        })
    }

    fn seen(&self, rules: &LedgerRules, work: &mut LedgerWork) -> ContractResult<SeenReport> {
        charge_count(work, 64, STATE_CELL + STATE_MEMORY)?;
        let mut count = 0_u32;
        let mut replacement = 0_u64;
        let mut command_centers = Vec::new();
        for cell in &self.cells {
            if let Some(piece) = observed_piece(cell).filter(|piece| piece.color != self.side) {
                if piece.kind == UnitType::King {
                    command_centers.push(cell.square());
                } else {
                    count = count
                        .checked_add(1)
                        .ok_or_else(|| conservation("Observed enemy count overflow"))?;
                    replacement =
                        add(replacement, u64::from(rules.non_cc_replacement(piece.kind)))?;
                }
            }
        }
        let assertions = self.memory.iter().flatten().copied().collect();
        let stale = self
            .memory
            .iter()
            .flatten()
            .filter(|assertion| {
                matches!(
                    self.cells[assertion.square.index()],
                    ObservedCell::Unknown { .. }
                )
            })
            .copied()
            .collect();
        Ok(SeenReport {
            cells: self.cells.clone(),
            ever_lit: all_squares()
                .into_iter()
                .filter(|square| self.ever_lit[square.index()])
                .collect(),
            current_enemy_non_cc_count: count,
            current_enemy_non_cc_replacement_value: replacement,
            current_enemy_cc_squares: command_centers,
            last_seen_assertions: assertions,
            stale_assertions: stale,
        })
    }
}

fn observed_piece(cell: &ObservedCell) -> Option<&ObservedPiece> {
    match cell {
        ObservedCell::Lit { piece, .. } => piece.as_ref(),
        ObservedCell::Revealed { piece, .. } => Some(piece),
        _ => None,
    }
}

fn unit_report(unit: &Unit, rules: &LedgerRules) -> OwnUnitReport {
    OwnUnitReport {
        id: format!("u{}", unit.id),
        square: unit.square,
        kind: unit.kind,
        mode: unit.mode,
        paid_mineral_basis: unit.paid,
        non_cc_replacement_value: rules.non_cc_replacement(unit.kind),
        native_unit_cost: rules.unit_costs.get(unit.kind),
        origin: unit.origin.clone(),
        born_at: unit.born_at,
        type_changes: unit.type_changes.clone(),
    }
}

fn resolve_unit(
    subject: &UnitSubject,
    before: &[Option<u32>; 64],
    born: &[(ActionRef, u32)],
    work: &mut LedgerWork,
) -> ContractResult<u32> {
    work.charge(RESOLVE_ITEM)?;
    match subject {
        UnitSubject::BeforeUnit { square } => before[square.index()]
            .ok_or_else(|| identity("Before-unit subject has no immutable preimage lineage")),
        UnitSubject::BornUnit { action_ref } => {
            charge_count(work, born.len(), RESOLVE_ITEM)?;
            born.iter()
                .find(|(reference, _)| reference == action_ref)
                .map(|(_, id)| *id)
                .ok_or_else(|| identity("Born-unit subject must follow its same-group birth"))
        }
    }
}

fn resolve_mine(
    subject: &MineSubject,
    before: &[(MineOccurrence, u32)],
    born: &[(ActionRef, u32)],
    work: &mut LedgerWork,
) -> ContractResult<u32> {
    match subject {
        MineSubject::BeforeMine { square, slot } => {
            charge_count(work, before.len(), RESOLVE_ITEM)?;
            before
                .iter()
                .find(|(occurrence, _)| occurrence.square == *square && occurrence.slot == *slot)
                .map(|(_, id)| *id)
                .ok_or_else(|| identity("Before-mine subject has no immutable occurrence lineage"))
        }
        MineSubject::BornMine { action_ref } => {
            charge_count(work, born.len(), RESOLVE_ITEM)?;
            born.iter()
                .find(|(reference, _)| reference == action_ref)
                .map(|(_, id)| *id)
                .ok_or_else(|| identity("Born-mine subject must follow its same-group birth"))
        }
    }
}

fn spawn_kind(kind: SpawnPiece) -> UnitType {
    match kind {
        SpawnPiece::Pawn => UnitType::Pawn,
        SpawnPiece::Knight => UnitType::Knight,
        SpawnPiece::Bishop => UnitType::Bishop,
        SpawnPiece::Rook => UnitType::Rook,
        SpawnPiece::Queen => UnitType::Queen,
    }
}

fn position(boundary: &EconomicBoundary, sequence: u32) -> LedgerPosition {
    LedgerPosition {
        boundary_ordinal: boundary.ordinal,
        native_turn: boundary.turn,
        sequence,
    }
}

fn increment(counter: &mut u32) -> ContractResult<u32> {
    *counter = counter
        .checked_add(1)
        .ok_or_else(|| identity("Recipient-local lineage counter overflow"))?;
    Ok(*counter)
}

fn add(left: u64, right: u64) -> ContractResult<u64> {
    left.checked_add(right)
        .ok_or_else(|| conservation("Ledger integer total overflow"))
}

fn sum(mut values: impl Iterator<Item = u64>) -> ContractResult<u64> {
    values.try_fold(0, add)
}

fn count_u64(count: usize) -> ContractResult<u64> {
    u64::try_from(count).map_err(|_| conservation("Ledger count overflow"))
}

fn charge_count(work: &mut LedgerWork, count: usize, fee: u64) -> ContractResult<()> {
    let amount = u64::try_from(count)
        .ok()
        .and_then(|count| count.checked_mul(fee))
        .ok_or_else(|| LedgerError::new(LedgerErrorCode::Budget, "History work charge overflow"))?;
    work.charge(amount)
}

fn sequence(message: &'static str) -> LedgerError {
    LedgerError::new(LedgerErrorCode::Sequence, message)
}
fn identity(message: &'static str) -> LedgerError {
    LedgerError::new(LedgerErrorCode::Identity, message)
}
fn conservation(message: &'static str) -> LedgerError {
    LedgerError::new(LedgerErrorCode::Conservation, message)
}
fn provenance(message: &'static str) -> LedgerError {
    LedgerError::new(LedgerErrorCode::Provenance, message)
}

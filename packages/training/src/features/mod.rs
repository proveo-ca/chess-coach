// SPEC: _spec/packages/training/shared418.puml
mod economic;
mod geometry;
mod historical;
mod projection;
pub(crate) mod promotion;

use crate::contracts::{Action, Candidate, ObservedCell, Side, SpecialTiming, Square};
use crate::feature_input::{BoundaryStamp, FEATURE_INPUT_VERSION, FeatureInput};
use crate::ledger::LedgerWork;
use crate::ledger::contracts::{ContractResult, LedgerError, LedgerErrorCode, TankMode};

#[derive(Debug, PartialEq)]
pub struct NumericalFeatureContext {
    pub stamp: BoundaryStamp,
    pub side: Side,
    pub balance: f64,
    pub uncertainty: f64,
    pub witnessed: u64,
    pub unlocated: u64,
}

#[derive(Debug, PartialEq)]
pub struct FeatureBlocksV3 {
    pub queue: [f64; 34],
    pub positions: [[f64; 84]; 4],
    pub economic: [f64; 12],
    pub promotion: [f64; 36],
}

pub fn encode_numerical_features_v3(
    history: &FeatureInput,
    candidate: &Candidate,
    context: &NumericalFeatureContext,
    work: &mut LedgerWork,
) -> ContractResult<FeatureBlocksV3> {
    charge(work, 5)?;
    validate(history, candidate, context, work)?;
    let projection = projection::project(history, candidate, work)?;
    let (queue, positions) = historical::encode(history, candidate, &projection, work)?;
    let economic = economic::encode(&projection, candidate, context, work)?;
    let promotion = promotion::encode(&projection, context, history.view.turn, work)?;
    charge(work, 12)?;
    charge(work, 2048)?;
    work.charge(418 * 3)?;
    let blocks = FeatureBlocksV3 { queue, positions, economic, promotion };
    finite(&blocks, work)?;
    Ok(blocks)
}

pub fn flatten_features_v3(
    blocks: &FeatureBlocksV3,
    work: &mut LedgerWork,
) -> ContractResult<[f64; 418]> {
    work.charge((128 + 12) + (128 + 32 + 418) + (128 + 418 * 32)
        + (128 + 32 + 8 * 418 + 4 * 8) + 418 * 2)?;
    let mut result = [0.0; 418];
    let values = blocks.queue.iter()
        .chain(blocks.positions.iter().flatten())
        .chain(blocks.economic.iter()).chain(blocks.promotion.iter());
    for (index, value) in values.enumerate() {
        if !value.is_finite() { return Err(bad("Feature output must be finite")); }
        result[index] = *value;
    }
    Ok(result)
}

fn finite(blocks: &FeatureBlocksV3, work: &mut LedgerWork) -> ContractResult<()> {
    work.charge(128 + 418 * 2)?;
    if blocks.queue.iter().chain(blocks.positions.iter().flatten())
        .chain(blocks.economic.iter()).chain(blocks.promotion.iter())
        .any(|value| !value.is_finite()) {
        return Err(bad("Feature output must be finite"));
    }
    Ok(())
}

fn validate(
    history: &FeatureInput, candidate: &Candidate, context: &NumericalFeatureContext,
    work: &mut LedgerWork,
) -> ContractResult<()> {
    work.charge(256)?;
    if history.version != FEATURE_INPUT_VERSION {
        return Err(LedgerError::new(LedgerErrorCode::Unsupported, "Unsupported feature input version"));
    }
    if history.stamp != context.stamp || history.view.side != context.side
        || history.stamp.turn != history.view.turn {
        return Err(identity("Numerical feature context disagrees with its boundary"));
    }
    if candidate.actions.len() > 4 || history.own_units.len() > 64
        || history.own_mines.len() > 3 || candidate.key.len() > 2048 {
        return Err(bad("Feature input exceeds physical cardinality"));
    }
    work.charge_snapshot(&history.view)?;
    let units = history.own_units.len() as u64;
    let actions = candidate.actions.len() as u64;
    work.charge(128 + 64 * 16 + units * units * 2 + actions * 2048)?;
    history.view.validate().map_err(|_| bad("Invalid authorized feature view"))?;
    candidate.validate(context.side).map_err(|_| bad("Invalid numerical feature candidate"))?;
    if !context.balance.is_finite() || !context.uncertainty.is_finite()
        || !(-576.0..=576.0).contains(&context.balance)
        || !(0.0..=288.0).contains(&context.uncertainty) {
        return Err(bad("Numerical economic readout exceeds its domain"));
    }
    let mut minerals = 0;
    let mut gas = 0;
    for action in &candidate.actions {
        charge(work, 20)?;
        minerals += match action {
            Action::Deploy { unit, .. } => geometry::native_cost(geometry::spawn_kind(*unit)),
            _ => 0,
        };
        gas += gas_cost(action);
    }
    if candidate.own_spend.minerals != minerals || candidate.own_spend.gas != gas
        || minerals > 12 || gas > 3 {
        return Err(bad("Candidate spend disagrees with native requested costs"));
    }
    if history.own_units.len() != history.view.own.pieces.len()
        || history.own_mines.len() != history.view.own.mines.len() {
        return Err(identity("Feature lineage cardinality disagrees with own inventory"));
    }
    for (index, unit) in history.own_units.iter().enumerate() {
        work.charge(64 + 16 * history.own_units.len() as u64)?;
        if history.own_units[..index].iter().any(|other| other.id == unit.id || other.square == unit.square)
            || !history.view.own.pieces.iter().any(|piece| piece.square == unit.square && piece.kind == unit.kind)
            || unit.paid_basis > 12 || (unit.kind == crate::contracts::PieceKind::King && unit.paid_basis != 0)
            || (unit.kind == crate::contracts::PieceKind::Rook) != unit.mode.is_some()
            || (unit.mode == Some(TankMode::Siege)) != history.view.own.sieged_tanks.contains(&unit.square) {
            return Err(identity("Feature unit lineage disagrees with authorized inventory"));
        }
    }
    for (index, mine) in history.own_mines.iter().enumerate() {
        work.charge(64 + 16 * history.own_mines.len() as u64)?;
        let slot = history.own_mines[..index].iter().filter(|other| other.square == mine.square).count();
        if mine.square != history.view.own.mines[index] || mine.slot as usize != slot
            || history.own_mines[..index].iter().any(|other| other.id == mine.id) {
            return Err(identity("Feature mine lineage disagrees with authorized inventory"));
        }
    }
    for (index, cell) in history.view.cells.iter().enumerate() {
        charge(work, 32)?;
        let memory = history.memory[index];
        if memory.is_some_and(|m| m.square.index() != index || m.color == context.side || m.last_observed_turn > history.view.turn) {
            return Err(identity("Feature memory has an invalid square, side, or age"));
        }
        if matches!(cell, ObservedCell::Lit { .. }) && !history.ever_lit[index] {
            return Err(identity("Feature ever-lit mask omits a lit square"));
        }
        match observed_piece(cell) {
            Some(piece) if piece.color != context.side => {
                if !memory.is_some_and(|m| m.kind == piece.kind && m.color == piece.color) {
                    return Err(identity("Feature memory disagrees with observed enemy"));
                }
            }
            _ if !matches!(cell, ObservedCell::Unknown { .. }) && memory.is_some() => {
                return Err(identity("Feature memory persists on a checked empty or own square"));
            }
            _ => {}
        }
    }
    Ok(())
}

pub(super) fn charge(work: &mut LedgerWork, logical: u64) -> ContractResult<()> {
    work.charge(128 + logical)
}
pub(super) fn bad(message: &'static str) -> LedgerError {
    LedgerError::new(LedgerErrorCode::BadInput, message)
}
fn identity(message: &'static str) -> LedgerError {
    LedgerError::new(LedgerErrorCode::Identity, message)
}
pub(super) fn bit(square: Square) -> u64 { 1_u64 << square.index() }
pub(super) fn observed_piece(cell: &ObservedCell) -> Option<&crate::contracts::ObservedPiece> {
    match cell {
        ObservedCell::Lit { piece, .. } => piece.as_ref(),
        ObservedCell::Revealed { piece, .. } => Some(piece),
        _ => None,
    }
}
pub(super) fn timing(action: &Action) -> usize {
    match action {
        Action::Classical { .. } => 1,
        Action::Deploy { timing, .. } | Action::StimStep { timing, .. }
        | Action::SpiderMine { timing, .. } | Action::CharonMissiles { timing, .. }
        | Action::SiegeMode { timing, .. } | Action::TacticalJump { timing, .. } => {
            if *timing == SpecialTiming::B { 0 } else { 2 }
        }
    }
}
pub(super) fn target(action: &Action) -> Option<Square> {
    match action {
        Action::Classical { to, .. } | Action::Deploy { to, .. }
        | Action::StimStep { to, .. } | Action::CharonMissiles { to, .. }
        | Action::TacticalJump { to, .. } => Some(*to),
        _ => None,
    }
}
pub(super) fn gas_cost(action: &Action) -> u32 {
    match action {
        Action::Classical { .. } => 0,
        Action::CharonMissiles { .. } => 2,
        Action::TacticalJump { .. } => 3,
        _ => 1,
    }
}

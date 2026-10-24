// SPEC: _spec/packages/training/belief-integration.puml
use crate::banded_joint::NumericBandedJoint;
use crate::contracts::{ObservedCell, Side};
use crate::feature_input::{BoundaryStamp, FEATURE_INPUT_VERSION, FeatureInput};
use crate::joint_math::{NumericSupport, SparseCell, SupportRun};
use crate::ledger::LedgerWork;
use crate::ledger::contracts::{BoundaryPhase, EconomicBoundary, TankMode, UnitType};

use super::spatial::observed_piece;
use super::{BeliefError, BeliefResult, CompactPosterior, MarineOpportunityProvider, NumericalBeliefModel,
    SpatialState, board_bounds, reduce_spatial};

#[derive(Debug)]
pub struct BeliefState {
    pub(super) frame: FeatureInput,
    pub(super) posterior: CompactPosterior,
    pub(super) spatial: SpatialState,
}

impl BeliefState {
    pub fn frame(&self) -> &FeatureInput { &self.frame }
    pub fn stamp(&self) -> BoundaryStamp { self.frame.stamp }
    pub fn side(&self) -> Side { self.frame.view.side }
    pub fn components(&self) -> &NumericBandedJoint { self.posterior.banded() }
    pub fn public_support(&self) -> &NumericSupport { self.posterior.banded().support() }
    pub fn posterior(&self) -> &CompactPosterior { &self.posterior }
    pub fn spatial(&self) -> SpatialState { self.spatial }
}

pub fn initialize_belief<M: MarineOpportunityProvider + ?Sized>(
    frame: FeatureInput,
    model: &NumericalBeliefModel<'_, M>,
    work: &mut LedgerWork,
) -> BeliefResult<BeliefState> {
    validate_opening(&frame, model, work)?;
    work.charge(24)?;
    let cells = [SparseCell { bank: 3, material: 4, probability: 1.0 }];
    let runs = [SupportRun { bank: 3, lower: 4, upper: 4 }];
    let posterior = CompactPosterior::from_sparse(&cells, &runs, work)?;
    opening_state(frame, posterior, model, work)
}

fn opening_state<M: MarineOpportunityProvider + ?Sized>(
    frame: FeatureInput,
    posterior: CompactPosterior,
    model: &NumericalBeliefModel<'_, M>,
    work: &mut LedgerWork,
) -> BeliefResult<BeliefState> {
    work.charge(64)?;
    let spatial = if frame.view.side == Side::White {
        SpatialState { enemy_cc: 1 << 39, witnessed: 0,
            unlocated: (1 << 22) | (1 << 30) | (1 << 38) | (1 << 46) }
    } else {
        SpatialState { enemy_cc: 1 << 32, witnessed: 0,
            unlocated: (1 << 17) | (1 << 25) | (1 << 33) | (1 << 41) }
    };
    let spatial = reduce_spatial(spatial, &frame, 1, false, model.marines(), work)?;
    work.charge(64)?;
    Ok(BeliefState { frame, posterior, spatial })
}

fn validate_opening<M: MarineOpportunityProvider + ?Sized>(
    frame: &FeatureInput,
    model: &NumericalBeliefModel<'_, M>,
    work: &mut LedgerWork,
) -> BeliefResult<()> {
    validate_frame(frame, model, work)?;
    work.charge(64 + 8 * 64)?;
    let stamp = frame.stamp;
    if stamp.phase != BoundaryPhase::Initial || stamp.ordinal != 0 || stamp.turn != 0
        || stamp.planning_ordinal != 0 || stamp.grant_ordinal != 0 || stamp.seq_through != 0
        || frame.innovation.values != [0; 3] || frame.innovation.bins != [0; 3]
        || frame.innovation.marine_anchors.iter().any(|value| *value)
    {
        return Err(BeliefError::Sequence);
    }
    let bounds = board_bounds(frame, model.rules(), work)?;
    if bounds.lower > 4 || bounds.upper < 4 { return Err(BeliefError::SpatialConsistency); }
    Ok(())
}

pub(super) fn validate_frame<M: MarineOpportunityProvider + ?Sized>(
    frame: &FeatureInput,
    model: &NumericalBeliefModel<'_, M>,
    work: &mut LedgerWork,
) -> BeliefResult<()> {
    work.charge(128)?;
    let view = &frame.view;
    if frame.version != FEATURE_INPUT_VERSION || view.turn != frame.stamp.turn
        || view.turn > model.rules().max_turn || view.cells.len() != 64
        || frame.own_units.len() > 64 || frame.own_mines.len() > 3
        || frame.own_units.len() != view.own.pieces.len()
        || frame.own_mines.len() != view.own.mines.len()
        || view.own.sieged_tanks.len() > 64
        || frame.stamp.planning_ordinal != frame.stamp.grant_ordinal
        || view.own.minerals > 12 || view.own.gas_income == 0 || view.own.gas_income > 3
        || view.own.gas > view.own.gas_income || view.own.cc_lives > 3
    {
        return Err(BeliefError::FrameMismatch);
    }
    work.charge(32 * 64 + 32 * frame.own_units.len() as u64
        + 32 * frame.own_mines.len() as u64 + 16 * view.own.sieged_tanks.len() as u64)?;
    let mut own_index = 0;
    for (index, cell) in view.cells.iter().enumerate() {
        if cell.square().index() != index { return Err(BeliefError::FrameMismatch); }
        if let Some(piece) = observed_piece(cell) {
            if piece.color == view.side {
                let unit = frame.own_units.get(own_index).ok_or(BeliefError::FrameMismatch)?;
                let visible = &view.own.pieces[own_index];
                if !matches!(cell, ObservedCell::Lit { .. })
                    || unit.square != cell.square() || unit.kind != piece.kind
                    || visible.square != unit.square || visible.kind != unit.kind
                { return Err(BeliefError::FrameMismatch); }
                own_index += 1;
            }
        }
        if let Some(memory) = frame.memory[index] {
            if memory.square.index() != index || memory.color == view.side
                || memory.last_observed_turn > view.turn
            { return Err(BeliefError::FrameMismatch); }
        }
        if matches!(cell, ObservedCell::Lit { .. }) && !frame.ever_lit[index] {
            return Err(BeliefError::FrameMismatch);
        }
    }
    if own_index != frame.own_units.len() { return Err(BeliefError::FrameMismatch); }
    for (index, unit) in frame.own_units.iter().enumerate() {
        if index > 0 && frame.own_units[index - 1].square >= unit.square {
            return Err(BeliefError::FrameMismatch);
        }
        work.charge(16 * view.own.sieged_tanks.len() as u64)?;
        let sieged = view.own.sieged_tanks.contains(&unit.square);
        let expected = if unit.kind == UnitType::Rook {
            Some(if sieged { TankMode::Siege } else { TankMode::Tank })
        } else { None };
        if unit.mode != expected || (sieged && unit.kind != UnitType::Rook) {
            return Err(BeliefError::FrameMismatch);
        }
    }
    if view.own.sieged_tanks.windows(2).any(|pair| pair[0] >= pair[1]) {
        return Err(BeliefError::FrameMismatch);
    }
    for square in &view.own.sieged_tanks {
        work.charge(16 * frame.own_units.len() as u64)?;
        if !frame.own_units.iter().any(|unit| unit.square == *square && unit.kind == UnitType::Rook) {
            return Err(BeliefError::FrameMismatch);
        }
    }
    for (index, mine) in frame.own_mines.iter().enumerate() {
        let slot = if index > 0 && frame.own_mines[index - 1].square == mine.square {
            frame.own_mines[index - 1].slot.checked_add(1)
        } else { Some(0) };
        if mine.square != view.own.mines[index] || slot != Some(mine.slot)
            || (index > 0 && frame.own_mines[index - 1].square > mine.square)
        { return Err(BeliefError::FrameMismatch); }
    }
    let values = frame.innovation.values;
    let bin = |value| match value { 0 => 0, 1..=3 => 1, 4..=8 => 2, _ => 3 };
    let expected_bins = [bin(values[0]), bin(values[1]), values[2].min(2) as u8];
    if expected_bins != frame.innovation.bins { return Err(BeliefError::FrameMismatch); }
    match (frame.stamp.phase, frame.innovation.grant) {
        (BoundaryPhase::Settled, Some(grant)) => {
            if grant.grant_ordinal != frame.stamp.grant_ordinal
                || grant.settled_turn != view.turn
                || grant.entitlement != model.rules().income_at(view.turn)?
                || grant.credited > grant.entitlement
                || view.own.gas != 0
                || view.own.gas_income != model.rules().gas_capacity_at(view.turn)?
            { return Err(BeliefError::FrameMismatch); }
        }
        (BoundaryPhase::Initial | BoundaryPhase::TurnOpen, None) => {}
        _ => return Err(BeliefError::FrameMismatch),
    }
    Ok(())
}

pub(super) fn matches_boundary(
    frame: &FeatureInput,
    boundary: &EconomicBoundary,
    work: &mut LedgerWork,
) -> BeliefResult<()> {
    work.charge(128 + 32 * 64 + 32 * frame.own_units.len() as u64
        + 32 * frame.own_mines.len() as u64)?;
    let stamp = frame.stamp;
    if stamp.ordinal != boundary.ordinal || stamp.phase != boundary.phase
        || stamp.turn != boundary.turn || stamp.planning_ordinal != boundary.planning_ordinal
        || stamp.grant_ordinal != boundary.grant_ordinal || stamp.seq_through != boundary.seq_through
        || frame.view.side != boundary.side || frame.view != boundary.snapshot
    { return Err(BeliefError::FrameMismatch); }
    Ok(())
}

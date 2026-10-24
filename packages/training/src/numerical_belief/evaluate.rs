// SPEC: _spec/packages/training/belief-integration.puml
use crate::accounting_kernel::{MATERIAL_CEILING, NumericGrant};
use crate::contracts::ObservedCell;
use crate::evidence_tables::InnovationCode;
use crate::feature_input::FeatureInput;
use crate::joint_accounting::NumericAccountingStep;
use crate::ledger::LedgerWork;
use crate::ledger::contracts::{BoundaryPhase, LedgerRules, UnitType};
use crate::transition_tables::NumericSourceContext;

use super::spatial::observed_piece;
use super::state::validate_frame;
use super::{BeliefError, BeliefResult, BeliefState, MarineOpportunityProvider, NumericalBeliefModel,
    fused_settlement, fused_stationary, reduce_spatial};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct BoardBounds {
    pub lower: u16,
    pub upper: u16,
    pub marines: u8,
}

pub fn board_bounds(frame: &FeatureInput, rules: &LedgerRules, work: &mut LedgerWork) -> BeliefResult<BoardBounds> {
    work.charge(32)?;
    if frame.view.cells.len() != 64 { return Err(BeliefError::FrameMismatch); }
    let mut lower = 0_u32;
    let mut unknown = 0_u16;
    let mut cc = false;
    let mut marines = 0_u8;
    for (index, cell) in frame.view.cells.iter().enumerate() {
        work.charge(32)?;
        if cell.square().index() != index { return Err(BeliefError::FrameMismatch); }
        if matches!(cell, ObservedCell::Unknown { .. }) {
            unknown += 1;
        } else if let Some(piece) = observed_piece(cell) {
            if piece.color != frame.view.side {
                lower = lower.checked_add(rules.non_cc_replacement(piece.kind))
                    .ok_or(BeliefError::SpatialConsistency)?;
                cc |= piece.kind == UnitType::King;
                marines += u8::from(piece.kind == UnitType::Pawn);
            }
        }
    }
    let hidden = unknown.checked_sub(u16::from(!cc)).ok_or(BeliefError::SpatialConsistency)?;
    let lower = u16::try_from(lower).map_err(|_| BeliefError::SpatialConsistency)?;
    if lower > MATERIAL_CEILING { return Err(BeliefError::SpatialConsistency); }
    let upper = lower.checked_add(9 * hidden).ok_or(BeliefError::SpatialConsistency)?.min(MATERIAL_CEILING);
    Ok(BoardBounds { lower, upper, marines })
}

pub(super) fn advance_with_terminal<M: MarineOpportunityProvider + ?Sized>(
    prior: BeliefState,
    next: FeatureInput,
    model: &NumericalBeliefModel<'_, M>,
    terminal: bool,
    work: &mut LedgerWork,
) -> BeliefResult<BeliefState> {
    validate_frame(&prior.frame, model, work)?;
    validate_frame(&next, model, work)?;
    work.charge(128)?;
    let before = prior.frame.stamp;
    let after = next.stamp;
    if prior.side() != next.view.side || before.ordinal.checked_add(1) != Some(after.ordinal)
        || after.seq_through < before.seq_through
    { return Err(BeliefError::Sequence); }
    let settled = match (before.phase, after.phase) {
        (BoundaryPhase::Initial | BoundaryPhase::Settled, BoundaryPhase::TurnOpen) => {
            let expected_turn = if terminal { before.turn.checked_add(1) } else { Some(before.turn) };
            if expected_turn != Some(after.turn) || before.planning_ordinal != after.planning_ordinal
                || before.grant_ordinal != after.grant_ordinal
            { return Err(BeliefError::Sequence); }
            false
        }
        (BoundaryPhase::TurnOpen, BoundaryPhase::Settled) => {
            if before.turn.checked_add(1) != Some(after.turn)
                || before.planning_ordinal.checked_add(1) != Some(after.planning_ordinal)
                || before.grant_ordinal.checked_add(1) != Some(after.grant_ordinal)
                || after.seq_through <= before.seq_through
            { return Err(BeliefError::Sequence); }
            true
        }
        _ => return Err(BeliefError::Sequence),
    };
    let old_bounds = board_bounds(&prior.frame, model.rules(), work)?;
    let bounds = board_bounds(&next, model.rules(), work)?;
    let gas = u8::try_from(model.rules().gas_capacity_at(before.turn)?)
        .map_err(|_| BeliefError::SpatialConsistency)?;
    let can_birth = if settled { prior.posterior.can_birth(work)? } else { false };
    let spatial = reduce_spatial(prior.spatial, &next, gas, can_birth, model.marines(), work)?;
    work.charge(32)?;
    let unchanged = !settled && old_bounds.lower == bounds.lower && old_bounds.upper == bounds.upper
        && next.innovation.bins == [0; 3];
    let posterior = if unchanged {
        work.charge(32)?;
        prior.posterior
    } else {
        let code = InnovationCode::from_bins(next.innovation.bins, work)?;
        if settled {
            let grant = next.innovation.grant.ok_or(BeliefError::FrameMismatch)?;
            let step = NumericAccountingStep {
                context: NumericSourceContext { input_turn: before.turn,
                    visible_before: old_bounds.lower, marines_before: old_bounds.marines },
                grant: NumericGrant::AtNativeTurn(grant.settled_turn),
                witnessed_loss: u16::try_from(next.innovation.values[1])
                    .map_err(|_| BeliefError::FrameMismatch)?,
                destination_lower: bounds.lower,
                destination_upper: bounds.upper,
            };
            fused_settlement(&prior.posterior, model, &step, after.turn, code, work)?
        } else {
            fused_stationary(&prior.posterior, model, bounds.lower, bounds.upper, after.turn, code, work)?
        }
    };
    work.charge(64)?;
    Ok(BeliefState { frame: next, posterior, spatial })
}

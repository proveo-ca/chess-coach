// SPEC: _spec/packages/training/belief-integration.puml
use crate::banded_joint::readout_banded_runs_copy;
use crate::contracts::{ObservedCell, Side};
use crate::feature_input::BoundaryStamp;
use crate::joint_math::NumericReadout;
use crate::ledger::LedgerWork;

use super::state::validate_frame;
use super::{BeliefError, BeliefResult, BeliefState, MarineOpportunityProvider, NumericalBeliefModel};

#[derive(Debug, PartialEq)]
pub struct BeliefReadout {
    pub stamp: BoundaryStamp,
    pub side: Side,
    pub summary: NumericReadout,
    pub witnessed: u64,
    pub unlocated: u64,
}

pub fn readout_belief<M: MarineOpportunityProvider + ?Sized>(
    state: &BeliefState,
    model: &NumericalBeliefModel<'_, M>,
    work: &mut LedgerWork,
) -> BeliefResult<BeliefReadout> {
    validate_frame(&state.frame, model, work)?;
    let mut lit = 0_u8;
    for cell in &state.frame.view.cells {
        work.charge(16)?;
        lit += u8::from(matches!(cell, ObservedCell::Lit { .. }));
    }
    let temperature = model.temperature(state.frame.stamp.turn, lit, work)?;
    let mut own_replacement = 0_u32;
    for unit in &state.frame.view.own.pieces {
        work.charge(32)?;
        own_replacement = own_replacement.checked_add(model.rules().non_cc_replacement(unit.kind))
            .ok_or(BeliefError::FrameMismatch)?;
    }
    let own_replacement = u16::try_from(own_replacement).map_err(|_| BeliefError::FrameMismatch)?;
    let summary = readout_banded_runs_copy(state.components(), own_replacement, temperature, work)?;
    work.charge(64)?;
    Ok(BeliefReadout { stamp: state.stamp(), side: state.side(), summary,
        witnessed: state.spatial.witnessed, unlocated: state.spatial.unlocated })
}

impl BeliefReadout {
    pub(super) fn copy_charged(&self, work: &mut LedgerWork) -> BeliefResult<Self> {
        work.charge(128 + 8 * 21)?;
        let summary = &self.summary;
        Ok(Self { stamp: self.stamp, side: self.side, witnessed: self.witnessed, unlocated: self.unlocated,
            summary: NumericReadout { mean_d: summary.mean_d, mean_potential: summary.mean_potential,
                quantiles_d: summary.quantiles_d, quantiles_potential: summary.quantiles_potential,
                balance: summary.balance, uncertainty: summary.uncertainty } })
    }
}

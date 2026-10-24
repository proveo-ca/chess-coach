// SPEC: _spec/packages/training/belief-integration.puml, _spec/packages/training/shared418.puml
use crate::contracts::{PieceKind, Promotion, Side, Square};
use crate::features::promotion::marine_opportunities;
use crate::ledger::LedgerWork;

use super::{BeliefError, BeliefResult, MarineOpportunityProvider, MarineOptions, MarineOutcome};

pub struct SharedMarineOpportunities;

impl MarineOpportunityProvider for SharedMarineOpportunities {
    fn visit(
        &self,
        source: Square,
        enemy: Side,
        diagonal_geometry: u64,
        options: MarineOptions,
        work: &mut LedgerWork,
        emit: &mut dyn FnMut(MarineOutcome, &mut LedgerWork) -> BeliefResult<()>,
    ) -> BeliefResult<()> {
        work.charge(128 + 32)?;
        if options.gas > 3 { return Err(BeliefError::SpatialConsistency); }
        let macros = marine_opportunities(source, enemy, u32::from(options.gas), work)?;
        for opportunity in macros {
            work.charge(128 + 64)?;
            if !opportunity.spatial_eligible
                || opportunity.before && !options.before
                || (opportunity.before || opportunity.after) && !options.specials
                || opportunity.classical != 0 && !options.classical
                || opportunity.authored_diagonal_target.is_some_and(|target| {
                    diagonal_geometry & (1_u64 << target.index()) == 0
                })
            {
                continue;
            }
            let promotion = match opportunity.promotion {
                None => None,
                Some(PieceKind::Knight) => Some(Promotion::Knight),
                Some(PieceKind::Bishop) => Some(Promotion::Bishop),
                Some(PieceKind::Rook) => Some(Promotion::Rook),
                Some(PieceKind::Queen) => Some(Promotion::Queen),
                Some(PieceKind::Pawn | PieceKind::King) => return Err(BeliefError::SpatialConsistency),
            };
            work.charge(32)?;
            emit(MarineOutcome { destination: opportunity.arrival, promotion }, work)?;
        }
        Ok(())
    }
}

// SPEC: _spec/packages/training/belief-integration.puml
use crate::contracts::{Promotion, Side, Square};
use crate::ledger::LedgerWork;

use super::BeliefResult;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MarineOptions {
    pub gas: u8,
    pub classical: bool,
    pub specials: bool,
    pub before: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MarineOutcome {
    pub destination: Square,
    pub promotion: Option<Promotion>,
}

pub trait MarineOpportunityProvider {
    fn visit(
        &self,
        source: Square,
        enemy: Side,
        diagonal_geometry: u64,
        options: MarineOptions,
        work: &mut LedgerWork,
        emit: &mut dyn FnMut(MarineOutcome, &mut LedgerWork) -> BeliefResult<()>,
    ) -> BeliefResult<()>;
}

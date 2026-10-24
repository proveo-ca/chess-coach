// SPEC: _spec/packages/training/belief-integration.puml
mod compact;
mod evaluate;
mod fused;
mod marine_adapter;
mod marine_contract;
mod model;
mod pair;
mod readout;
mod spatial;
mod state;

pub use compact::CompactPosterior;
pub use evaluate::{BoardBounds, board_bounds};
pub use fused::{fused_settlement, fused_stationary};
pub use marine_adapter::SharedMarineOpportunities;
pub use marine_contract::{MarineOpportunityProvider, MarineOptions, MarineOutcome};
pub use model::{CalibrationBin, NumericalBeliefModel};
pub use pair::EconomicBeliefPair;
pub use readout::{BeliefReadout, readout_belief};
pub use spatial::{SpatialState, reduce_spatial, support_can_birth};
pub use state::{BeliefState, initialize_belief};

use crate::banded_joint::BandError;
use crate::evidence_tables::EvidenceError;
use crate::joint_accounting::JointAccountingError;
use crate::joint_math::JointMathError;
use crate::ledger::contracts::LedgerError;
use crate::transition_tables::TableError;

#[derive(Debug, PartialEq, Eq)]
pub enum BeliefError {
    Ledger(LedgerError),
    Table(TableError),
    Accounting(JointAccountingError),
    Evidence(EvidenceError),
    Band(BandError),
    Math(JointMathError),
    Model(ModelError),
    Sequence,
    FrameMismatch,
    SpatialConsistency,
    Revoked,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ModelError {
    Rules,
    TableProfile,
    Calibration,
}

pub type BeliefResult<T> = Result<T, BeliefError>;

impl From<LedgerError> for BeliefError {
    fn from(error: LedgerError) -> Self { Self::Ledger(error) }
}
impl From<TableError> for BeliefError {
    fn from(error: TableError) -> Self { Self::Table(error) }
}
impl From<JointAccountingError> for BeliefError {
    fn from(error: JointAccountingError) -> Self { Self::Accounting(error) }
}
impl From<EvidenceError> for BeliefError {
    fn from(error: EvidenceError) -> Self { Self::Evidence(error) }
}
impl From<BandError> for BeliefError {
    fn from(error: BandError) -> Self { Self::Band(error) }
}
impl From<JointMathError> for BeliefError {
    fn from(error: JointMathError) -> Self { Self::Math(error) }
}

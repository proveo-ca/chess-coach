// SPEC: _spec/packages/training/belief-integration.puml
use crate::banded_joint::{NumericBandedJoint, from_sparse_probabilities};
use crate::joint_math::{NumericSupport, SparseCell, SupportRun, SupportRuns};
use crate::ledger::LedgerWork;

use super::BeliefResult;

#[derive(Debug)]
pub struct CompactPosterior {
    banded: NumericBandedJoint,
    runs: SupportRuns,
}

impl CompactPosterior {
    pub fn from_sparse(
        cells: &[SparseCell],
        runs: &[SupportRun],
        work: &mut LedgerWork,
    ) -> BeliefResult<Self> {
        let runs = SupportRuns::from_slice(runs, work)?;
        Self::from_checked_runs(cells, runs, work)
    }

    pub(super) fn from_owned(
        cells: Vec<SparseCell>,
        runs: Vec<SupportRun>,
        work: &mut LedgerWork,
    ) -> BeliefResult<Self> {
        let runs = SupportRuns::from_owned(runs, work)?;
        Self::from_checked_runs(&cells, runs, work)
    }

    fn from_checked_runs(
        cells: &[SparseCell],
        runs: SupportRuns,
        work: &mut LedgerWork,
    ) -> BeliefResult<Self> {
        let support = NumericSupport::from_runs(&runs, work)?;
        let banded = from_sparse_probabilities(cells, support, work)?;
        work.charge(40)?;
        Ok(Self { banded, runs })
    }

    pub fn banded(&self) -> &NumericBandedJoint { &self.banded }
    pub fn support_runs(&self) -> &SupportRuns { &self.runs }

    pub(super) fn can_birth(&self, work: &mut LedgerWork) -> BeliefResult<bool> {
        work.charge(32)?;
        let mut result = false;
        for run in self.runs.runs() {
            work.charge(16)?;
            result |= run.bank >= 1;
        }
        Ok(result)
    }
}

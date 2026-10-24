// SPEC: _spec/packages/training/belief-integration.puml
use std::cell::RefCell;

use crate::contracts::{Candidate, MAX_RETAINED_CANDIDATES, Side};
use crate::feature_input::{AdvanceDisposition, FeatureInputPair};
use crate::features::{NumericalFeatureContext, encode_numerical_features_v3, flatten_features_v3};
use crate::ledger::LedgerWork;
use crate::ledger::contracts::{EconomicBoundary, LedgerRules, Pair};

use super::evaluate::advance_with_terminal;
use super::state::matches_boundary;
use super::{BeliefError, BeliefReadout, BeliefResult, BeliefState, MarineOpportunityProvider,
    ModelError, NumericalBeliefModel, initialize_belief, readout_belief};

pub struct EconomicBeliefPair<'m, 'a, M: MarineOpportunityProvider + ?Sized> {
    inputs: FeatureInputPair,
    states: Option<Pair<BeliefState>>,
    model: &'m NumericalBeliefModel<'a, M>,
    revoked: bool,
    readouts: RefCell<Pair<Option<BeliefReadout>>>,
}

impl<'m, 'a, M: MarineOpportunityProvider + ?Sized> EconomicBeliefPair<'m, 'a, M> {
    pub fn initialize(
        rules: LedgerRules,
        model: &'m NumericalBeliefModel<'a, M>,
        initial: &Pair<EconomicBoundary>,
        work: &mut LedgerWork,
    ) -> BeliefResult<Self> {
        work.charge(128)?;
        work.charge_rules(&rules)?;
        work.charge(256 + 8 * (rules.income_by_turn.len() + rules.gas_capacity_by_turn.len()) as u64)?;
        if &rules != model.rules() { return Err(BeliefError::Model(ModelError::Rules)); }
        let inputs = FeatureInputPair::initialize(rules, initial, work)?;
        let white = inputs.input(Side::White, work)?;
        matches_boundary(&white, &initial.w, work)?;
        let w = initialize_belief(white, model, work)?;
        let black = inputs.input(Side::Black, work)?;
        matches_boundary(&black, &initial.b, work)?;
        let b = initialize_belief(black, model, work)?;
        work.charge(64)?;
        Ok(Self { inputs, states: Some(Pair { w, b }), model, revoked: false,
            readouts: RefCell::new(Pair { w: None, b: None }) })
    }

    pub fn advance(
        &mut self,
        next: &Pair<EconomicBoundary>,
        work: &mut LedgerWork,
    ) -> BeliefResult<AdvanceDisposition> {
        if self.revoked { return Err(BeliefError::Revoked); }
        let disposition = match self.inputs.advance(next, work) {
            Ok(disposition) => disposition,
            Err(error) => {
                self.revoked = true;
                self.states.take();
                *self.readouts.get_mut() = Pair { w: None, b: None };
                return Err(error.into());
            }
        };
        if disposition == AdvanceDisposition::Replayed { return Ok(disposition); }
        self.revoked = true;
        *self.readouts.get_mut() = Pair { w: None, b: None };
        let prior = self.states.take().ok_or(BeliefError::Revoked)?;
        let terminal = next.w.snapshot.own.cc_lives == 0 || next.b.snapshot.own.cc_lives == 0;
        let white = self.inputs.input(Side::White, work)?;
        matches_boundary(&white, &next.w, work)?;
        let w = advance_with_terminal(prior.w, white, self.model, terminal, work)?;
        let black = self.inputs.input(Side::Black, work)?;
        matches_boundary(&black, &next.b, work)?;
        let b = advance_with_terminal(prior.b, black, self.model, terminal, work)?;
        work.charge(64)?;
        self.states = Some(Pair { w, b });
        self.revoked = false;
        Ok(disposition)
    }

    pub fn state(&self, side: Side) -> BeliefResult<&BeliefState> {
        if self.revoked { return Err(BeliefError::Revoked); }
        self.states.as_ref().map(|states| states.get(side)).ok_or(BeliefError::Revoked)
    }

    pub fn readout(&self, side: Side, work: &mut LedgerWork) -> BeliefResult<BeliefReadout> {
        let state = self.state(side)?;
        work.charge(32)?;
        if let Some(readout) = self.readouts.borrow().get(side) {
            return readout.copy_charged(work);
        }
        let readout = readout_belief(state, self.model, work)?;
        let cached = readout.copy_charged(work)?;
        work.charge(32)?;
        *self.readouts.borrow_mut().get_mut(side) = Some(cached);
        Ok(readout)
    }

    pub fn encode_feature_batch(
        &self,
        side: Side,
        candidates: &[Candidate],
        work: &mut LedgerWork,
    ) -> BeliefResult<Vec<[f64; 418]>> {
        work.charge(128)?;
        if candidates.is_empty() || candidates.len() > MAX_RETAINED_CANDIDATES {
            return Err(BeliefError::FrameMismatch);
        }
        let readout = self.readout(side, work)?;
        work.charge(128 + 8 * 32)?;
        let context = NumericalFeatureContext {
            stamp: readout.stamp,
            side: readout.side,
            balance: readout.summary.balance,
            uncertainty: readout.summary.uncertainty,
            witnessed: readout.witnessed,
            unlocated: readout.unlocated,
        };
        let frame = self.state(side)?.frame();
        work.charge(192 + candidates.len() as u64 * 418)?;
        let mut result = Vec::with_capacity(candidates.len());
        for candidate in candidates {
            work.charge(32)?;
            let blocks = encode_numerical_features_v3(frame, candidate, &context, work)?;
            result.push(flatten_features_v3(&blocks, work)?);
        }
        Ok(result)
    }

    pub fn is_revoked(&self) -> bool { self.revoked }
}

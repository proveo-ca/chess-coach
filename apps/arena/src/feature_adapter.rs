// SPEC: _spec/apps/arena/shared418.puml
use training_native::contracts::{Candidate, Side};
use training_native::feature_input::FeatureInput;
use training_native::features::{NumericalFeatureContext, encode_numerical_features_v3, flatten_features_v3};
use training_native::ledger::LedgerWork;
use training_native::ledger::contracts::ContractResult;
use training_native::numerical_belief::{BeliefResult, EconomicBeliefPair, MarineOpportunityProvider};

pub fn encode_shared418(
    history: &FeatureInput,
    candidate: &Candidate,
    context: &NumericalFeatureContext,
    work: &mut LedgerWork,
) -> ContractResult<[f64; 418]> {
    let blocks = encode_numerical_features_v3(history, candidate, context, work)?;
    flatten_features_v3(&blocks, work)
}

pub fn encode_belief_batch<M: MarineOpportunityProvider + ?Sized>(
    beliefs: &EconomicBeliefPair<'_, '_, M>,
    side: Side,
    candidates: &[Candidate],
    work: &mut LedgerWork,
) -> BeliefResult<Vec<[f64; 418]>> {
    beliefs.encode_feature_batch(side, candidates, work)
}

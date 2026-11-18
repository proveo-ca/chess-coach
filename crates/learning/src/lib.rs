// SPEC: _spec/ml-runtime-architecture.puml, _spec/learning.puml
#![forbid(unsafe_code)]

mod accumulation;
mod batch;
mod episode;
mod model;

pub use accumulation::{AccumulatedEpisode, AccumulationError, UpdateProposal};
pub use batch::{
    BatchError, FEATURES, FeatureBatch, HIDDEN_UNITS, MAX_ABS_VALUE, MAX_CANDIDATES, STATE_FEATURES,
};
pub use episode::{
    Episode, EpisodeError, L2, LEARNING_RATE, MAX_SAMPLED_DECISIONS, POLICY_TEMPERATURE,
    SampledDecision,
};
pub use model::PolicyModel;

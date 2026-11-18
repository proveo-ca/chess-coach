// SPEC: _spec/gpu-owner.md
use crate::{
    OwnerError, Result,
    input::{ByteRef, OwnerInput},
    json::{self, Decimal},
};
use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;

pub const VERSION: &str = "chess-coach.gpu-job.v1";
pub const FRAME_BYTES: usize = 1_048_576;
pub const OUTPUT_BYTES: usize = 3 * (FRAME_BYTES + 1);

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Bindings {
    pub source: ByteRef,
    pub tests: ByteRef,
    pub closure: ByteRef,
    pub dependency_lock: ByteRef,
    pub image: ByteRef,
    pub runtime_configuration: ByteRef,
    pub core_rules: ByteRef,
    pub strategic_source: ByteRef,
    pub corpus_manifest: ByteRef,
    pub corpus_source: ByteRef,
    pub recipe: ByteRef,
    pub feature_layout: ByteRef,
    pub fixture_manifest: ByteRef,
    pub host_configuration: ByteRef,
}
impl Bindings {
    pub fn validate(&self) -> Result<()> {
        for reference in [
            &self.source,
            &self.tests,
            &self.closure,
            &self.dependency_lock,
            &self.image,
            &self.runtime_configuration,
            &self.core_rules,
            &self.strategic_source,
            &self.corpus_manifest,
            &self.corpus_source,
            &self.recipe,
            &self.feature_layout,
            &self.fixture_manifest,
            &self.host_configuration,
        ] {
            reference.validate()?;
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ModelConfig {
    pub version: String,
    pub architecture: String,
    pub feature_version: String,
    #[serde(deserialize_with = "json::integer")]
    pub input_features: u32,
    #[serde(deserialize_with = "json::integer")]
    pub hidden_units: u32,
    pub record_sha256: String,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AttemptInput {
    pub version: String,
    pub bindings: Bindings,
    pub model_config: ModelConfig,
    pub record_ref: ByteRef,
    pub initial_state_sha256: String,
    pub expected_descriptor_sha256: String,
    pub initial_model_id: String,
}
impl AttemptInput {
    pub fn parse(input: &OwnerInput) -> Result<Self> {
        let job = &input.job;
        if !job.job_input_ref.matches(job.job_input_json.as_bytes()) {
            return Err(OwnerError("INPUT_HASH"));
        }
        let value: Self = json::decode(job.job_input_json.as_bytes(), 65_536)?;
        value.bindings.validate()?;
        value.record_ref.validate()?;
        let c = &value.model_config;
        if value.version != "chess-coach.gpu-attempt-input.v1"
            || c.version != "chess-coach.model-config.v1"
            || c.architecture != "mlp-relu-32"
            || c.feature_version != "chess-coach.features.v1"
            || c.input_features != 2271
            || c.hidden_units != 32
            || value.record_ref.byte_length == 0
            || value.record_ref.byte_length > FRAME_BYTES as u64
            || c.record_sha256 != value.record_ref.sha256
            || value.initial_model_id != value.record_ref.sha256
            || value.initial_model_id != job.initial_model_id
            || !json::digest(&value.initial_state_sha256)
            || value.expected_descriptor_sha256 != job.expected_descriptor_sha256
            || !json::digest(&value.expected_descriptor_sha256)
        {
            return Err(OwnerError("INPUT_BINDING"));
        }
        Ok(value)
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", deny_unknown_fields)]
pub enum Reply {
    #[serde(rename = "boot")]
    Boot {
        version: String,
        #[serde(rename = "sessionId")]
        session_id: String,
    },
    #[serde(rename = "startup")]
    Startup {
        version: String,
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "attemptId")]
        attempt_id: String,
        #[serde(rename = "inputSha256")]
        input_sha256: String,
        #[serde(rename = "descriptorSha256")]
        descriptor_sha256: String,
        #[serde(rename = "initialModelId")]
        initial_model_id: String,
    },
    #[serde(rename = "attempt-proposal")]
    Proposal {
        version: String,
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "attemptId")]
        attempt_id: String,
        #[serde(rename = "inputSha256")]
        input_sha256: String,
        #[serde(rename = "descriptorSha256")]
        descriptor_sha256: String,
        #[serde(rename = "proposalJson")]
        proposal_json: String,
        #[serde(rename = "proposalSha256")]
        proposal_sha256: String,
    },
}

pub fn start(input: &OwnerInput, elapsed: i64) -> Result<Vec<u8>> {
    if elapsed < 0 {
        return Err(OwnerError("START_CLOCK"));
    }
    let mut bytes=serde_json::to_vec(&serde_json::json!({"version":VERSION,"sessionId":input.ownership.session_id,
        "operation":"run-attempt","attemptId":input.ownership.attempt_id,"inputJson":input.job.job_input_json,
        "inputSha256":input.job.job_input_ref.sha256,"ownerElapsedNs":Decimal(elapsed)})).map_err(|_|OwnerError("START_SERIALIZE"))?;
    if bytes.len() > FRAME_BYTES {
        return Err(OwnerError("START_BOUND"));
    }
    bytes.push(b'\n');
    Ok(bytes)
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Stream {
    pub status: String,
    #[serde(deserialize_with = "json::integer")]
    pub root: u32,
    #[serde(deserialize_with = "json::integer")]
    pub state: u32,
    #[serde(deserialize_with = "json::safe_u64")]
    pub draw_count: u64,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Generator {
    pub status: String,
    #[serde(deserialize_with = "json::optional_u32")]
    pub root: Option<u32>,
    #[serde(deserialize_with = "json::optional_u32")]
    pub state: Option<u32>,
    #[serde(deserialize_with = "json::safe_u64")]
    pub draw_count: u64,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Rng {
    pub selection: Stream,
    #[serde(rename = "environment-settlement")]
    pub environment_settlement: Stream,
    #[serde(rename = "policy-sampling")]
    pub policy_sampling: Stream,
    pub opponent: Stream,
    pub generator: Generator,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Counters {
    #[serde(deserialize_with = "json::integer")]
    pub started: u32,
    #[serde(deserialize_with = "json::integer")]
    pub verified_completed: u32,
    #[serde(deserialize_with = "json::integer")]
    pub eligible_completed: u32,
    #[serde(deserialize_with = "json::integer")]
    pub updates: u32,
    #[serde(rename = "nonzeroPGUpdates", deserialize_with = "json::integer")]
    pub nonzero_pg_updates: u32,
    #[serde(deserialize_with = "json::integer")]
    pub baseline_count: u32,
    #[serde(deserialize_with = "json::integer")]
    pub baseline_sum: i32,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Control {
    #[serde(deserialize_with = "json::u32_list")]
    pub corpus_permutation: Vec<u32>,
    #[serde(deserialize_with = "json::integer")]
    pub corpus_cursor: u32,
    #[serde(deserialize_with = "json::integer")]
    pub corpus_epoch: u32,
    #[serde(deserialize_with = "json::integer")]
    pub schedule_cursor: u32,
    #[serde(deserialize_with = "json::integer")]
    pub live_ordinal: u32,
    #[serde(deserialize_with = "json::integer")]
    pub due_bucket: u32,
    #[serde(deserialize_with = "json::integer")]
    pub fulfilled_bucket: u32,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct JournalRef {
    #[serde(deserialize_with = "json::safe_u64")]
    pub byte_length: u64,
    pub sha256: String,
    #[serde(deserialize_with = "json::safe_u64")]
    pub last_record_ordinal: u64,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TrainingState {
    pub version: String,
    #[serde(deserialize_with = "json::integer")]
    pub master: u32,
    #[serde(deserialize_with = "json::integer")]
    pub initialization_seed: u32,
    pub model_id: String,
    pub counters: Counters,
    pub rng: Rng,
    pub control: Control,
    #[serde(deserialize_with = "required_option")]
    pub journal_ref: Option<JournalRef>,
    pub history_refs: Vec<ByteRef>,
    pub bindings: Bindings,
}

fn required_option<'de, D: serde::Deserializer<'de>, T: Deserialize<'de>>(
    deserializer: D,
) -> std::result::Result<Option<T>, D::Error> {
    Option::<T>::deserialize(deserializer)
}
#[derive(Clone, Debug)]
pub enum Schedule {
    Corpus {
        corpus_index: u32,
        candidate_side: String,
    },
    Live {
        live_ordinal: u32,
        candidate_side: String,
    },
}

#[derive(Deserialize)]
struct ScheduleKind {
    kind: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CorpusSchedule {
    kind: String,
    #[serde(deserialize_with = "json::integer")]
    corpus_index: u32,
    candidate_side: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LiveSchedule {
    kind: String,
    #[serde(deserialize_with = "json::integer")]
    live_ordinal: u32,
    candidate_side: String,
}

impl<'de> Deserialize<'de> for Schedule {
    fn deserialize<D: serde::Deserializer<'de>>(
        deserializer: D,
    ) -> std::result::Result<Self, D::Error> {
        let raw = Box::<RawValue>::deserialize(deserializer)?;
        let kind: ScheduleKind =
            serde_json::from_str(raw.get()).map_err(serde::de::Error::custom)?;
        match kind.kind.as_str() {
            "corpus" => {
                let value: CorpusSchedule =
                    serde_json::from_str(raw.get()).map_err(serde::de::Error::custom)?;
                if value.kind != "corpus" {
                    return Err(serde::de::Error::custom("schedule kind"));
                }
                Ok(Self::Corpus {
                    corpus_index: value.corpus_index,
                    candidate_side: value.candidate_side,
                })
            }
            "live" => {
                let value: LiveSchedule =
                    serde_json::from_str(raw.get()).map_err(serde::de::Error::custom)?;
                if value.kind != "live" {
                    return Err(serde::de::Error::custom("schedule kind"));
                }
                Ok(Self::Live {
                    live_ordinal: value.live_ordinal,
                    candidate_side: value.candidate_side,
                })
            }
            _ => Err(serde::de::Error::custom("schedule kind")),
        }
    }
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Descriptor {
    pub version: String,
    pub attempt_id: String,
    #[serde(deserialize_with = "json::integer")]
    pub master: u32,
    #[serde(deserialize_with = "json::integer")]
    pub started_ordinal: u32,
    pub model_id: String,
    pub frozen_baseline: f64,
    pub schedule: Schedule,
}

pub fn validate_state(s: &TrainingState) -> Result<()> {
    let c = &s.counters;
    let k = &s.control;
    let rng = &s.rng;
    if s.version != "chess-coach.training-state.v1"
        || !(101..=105).contains(&s.master)
        || s.initialization_seed != s.master
        || !json::digest(&s.model_id)
        || c.started > 1000
        || c.nonzero_pg_updates > c.updates
        || c.updates != c.eligible_completed
        || c.updates != c.baseline_count
        || c.updates > c.verified_completed
        || c.verified_completed > c.started
        || c.baseline_sum.unsigned_abs() > c.baseline_count
        || c.started != k.schedule_cursor
        || k.live_ordinal != c.started / 2
        || k.due_bucket != k.schedule_cursor / 100
        || k.fulfilled_bucket > k.due_bucket
        || k.due_bucket > 10
        || k.corpus_cursor > 18
        || k.corpus_epoch > 999
        || k.corpus_permutation.len() != 18
        || s.history_refs.len() != c.verified_completed as usize
    {
        return Err(OwnerError("STATE_COUNTERS"));
    }
    let mut permutation_set = std::collections::HashSet::new();
    for n in &k.corpus_permutation {
        if *n > 17 || !permutation_set.insert(*n) {
            return Err(OwnerError("STATE_PERMUTATION"));
        }
    }
    s.bindings.validate()?;
    for reference in &s.history_refs {
        reference.validate()?;
    }
    if let Some(j) = &s.journal_ref
        && (j.byte_length > json::SAFE_INTEGER
            || j.last_record_ordinal > json::SAFE_INTEGER
            || !json::digest(&j.sha256))
    {
        return Err(OwnerError("STATE_JOURNAL"));
    }
    for (stream, active) in [
        (&rng.selection, true),
        (&rng.environment_settlement, false),
        (&rng.policy_sampling, true),
        (&rng.opponent, true),
    ] {
        if stream.status != if active { "active" } else { "unused" }
            || stream.draw_count > json::SAFE_INTEGER
            || u128::from(stream.state)
                != (u128::from(stream.root) + u128::from(stream.draw_count) * 0x6d2b79f5)
                    & 0xffff_ffff
            || (!active && stream.draw_count != 0)
        {
            return Err(OwnerError("STATE_RNG"));
        }
    }
    if rng.generator.status != "unused"
        || rng.generator.root.is_some()
        || rng.generator.state.is_some()
        || rng.generator.draw_count != 0
    {
        return Err(OwnerError("STATE_RNG_DRAWS"));
    }
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ProposalRaw<'a> {
    version: String,
    #[serde(borrow)]
    descriptor: &'a RawValue,
    initial_model_id: String,
    state: TrainingState,
}

pub fn validate_proposal(
    bytes: &str,
    proposal_sha256: &str,
    descriptor_sha256: &str,
    input: &OwnerInput,
    embedded: &AttemptInput,
) -> Result<()> {
    if bytes.len() > FRAME_BYTES {
        return Err(OwnerError("PROPOSAL_BOUND"));
    }
    if !json::digest(proposal_sha256) || json::sha256(bytes.as_bytes()) != proposal_sha256 {
        return Err(OwnerError("PROPOSAL_SHA256"));
    }
    let raw: ProposalRaw<'_> = json::decode(bytes.as_bytes(), FRAME_BYTES)?;
    if json::sha256(raw.descriptor.get().as_bytes()) != descriptor_sha256
        || descriptor_sha256 != input.job.expected_descriptor_sha256
    {
        return Err(OwnerError("DESCRIPTOR_SHA256"));
    }
    let d: Descriptor =
        serde_json::from_str(raw.descriptor.get()).map_err(|_| OwnerError("DESCRIPTOR_SCHEMA"))?;
    validate_state(&raw.state)?;
    let s = &raw.state;
    if raw.version != "chess-coach.gpu-attempt-proposal.v1"
        || raw.initial_model_id != input.job.initial_model_id
        || d.version != "chess-coach.attempt.v1"
        || d.attempt_id != input.ownership.attempt_id
        || d.master != 101
        || d.started_ordinal != 0
        || d.model_id != raw.initial_model_id
        || !json::identifier(&d.attempt_id, 32)
        || !json::digest(&d.model_id)
        || !json::digest(&raw.initial_model_id)
        || !(-1.0..=1.0).contains(&d.frozen_baseline)
        || s.master != 101
        || s.counters.started != 1
        || s.counters.verified_completed != 1
        || s.bindings != embedded.bindings
    {
        return Err(OwnerError("PROPOSAL_BINDING"));
    }
    match d.schedule {
        Schedule::Corpus {
            corpus_index,
            candidate_side,
        } if corpus_index < 18 && candidate_side == "b" => {}
        Schedule::Live {
            live_ordinal,
            candidate_side,
        } if live_ordinal < 500 && (candidate_side == "w" || candidate_side == "b") => {}
        _ => return Err(OwnerError("PROPOSAL_SCHEDULE")),
    }
    Ok(())
}

#[derive(Default)]
pub struct Receiver {
    offset: usize,
    pub boot: bool,
    pub startup: bool,
    pub proposal_json: Option<String>,
}
impl Receiver {
    pub fn receive(
        &mut self,
        bytes: &[u8],
        write_complete: bool,
        input: &OwnerInput,
        embedded: &AttemptInput,
    ) -> Result<bool> {
        if bytes.len() > OUTPUT_BYTES || self.offset > bytes.len() {
            return Err(OwnerError("WIRE_OUTPUT_BOUND"));
        }
        let mut booted = false;
        while let Some(lf) = bytes[self.offset..].iter().position(|b| *b == b'\n') {
            let end = self.offset + lf;
            let reply: Reply = json::decode(&bytes[self.offset..end], FRAME_BYTES)?;
            self.offset = end + 1;
            match reply {
                Reply::Boot {
                    version,
                    session_id,
                } => {
                    if self.boot || version != VERSION || session_id != input.ownership.session_id {
                        return Err(OwnerError("WIRE_BOOT"));
                    }
                    self.boot = true;
                    booted = true;
                }
                Reply::Startup {
                    version,
                    session_id,
                    attempt_id,
                    input_sha256,
                    descriptor_sha256,
                    initial_model_id,
                } => {
                    if !self.boot
                        || self.startup
                        || !write_complete
                        || version != VERSION
                        || session_id != input.ownership.session_id
                        || attempt_id != input.ownership.attempt_id
                        || input_sha256 != input.job.job_input_ref.sha256
                        || descriptor_sha256 != input.job.expected_descriptor_sha256
                        || initial_model_id != input.job.initial_model_id
                    {
                        return Err(OwnerError("WIRE_STARTUP"));
                    }
                    self.startup = true;
                }
                Reply::Proposal {
                    version,
                    session_id,
                    attempt_id,
                    input_sha256,
                    descriptor_sha256,
                    proposal_json,
                    proposal_sha256,
                } => {
                    if !self.startup
                        || self.proposal_json.is_some()
                        || version != VERSION
                        || session_id != input.ownership.session_id
                        || attempt_id != input.ownership.attempt_id
                        || input_sha256 != input.job.job_input_ref.sha256
                        || descriptor_sha256 != input.job.expected_descriptor_sha256
                    {
                        return Err(OwnerError("WIRE_PROPOSAL"));
                    }
                    validate_proposal(
                        &proposal_json,
                        &proposal_sha256,
                        &descriptor_sha256,
                        input,
                        embedded,
                    )?;
                    self.proposal_json = Some(proposal_json);
                }
            }
        }
        if bytes.len() - self.offset > FRAME_BYTES {
            return Err(OwnerError("WIRE_FRAME_BOUND"));
        }
        Ok(booted)
    }
    pub fn finish(&self, bytes: &[u8]) -> Result<()> {
        if !self.startup || self.proposal_json.is_none() || self.offset != bytes.len() {
            return Err(OwnerError("WIRE_INCOMPLETE"));
        }
        Ok(())
    }
}

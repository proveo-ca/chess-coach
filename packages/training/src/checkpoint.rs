// SPEC: _spec/packages/training/artifact-lifecycle.puml
use sha2::{Digest, Sha256};

use crate::artifact_bytes::{
    ARTIFACT_BYTE_CAP, CHECKPOINT_BYTE_CAP, MAX_SAFE_INTEGER, ArtifactError, ArtifactResult,
    ByteRef, DiagnosticParsed, Float64Hex, decode_canonical, fixed_418, object_wire, required_nullable,
};
use crate::artifacts::{
    ConfigurationWire, CountersWire, ExpectedArtifactBindings, JournalRefWire, ProvenanceBytes,
    ProvenanceWire, VersionsWire, diagnose_manifest, diagnose_training_recipe, is_master, validate_names,
};
use crate::learner_math::Vector418;
use crate::policy_weights::PolicyWeights;

const STEP: u32 = 0x6d2b79f5;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EpisodeStreamLabel { Selection, EnvironmentSettlement, PolicySampling, Opponent }

impl EpisodeStreamLabel {
    fn as_str(self) -> &'static str {
        match self {
            Self::Selection => "selection", Self::EnvironmentSettlement => "environment-settlement",
            Self::PolicySampling => "policy-sampling", Self::Opponent => "opponent",
        }
    }
}

pub fn derive_episode_root(master: u32, label: EpisodeStreamLabel) -> ArtifactResult<u32> {
    if !is_master(master) { return Err(ArtifactError::Rng); }
    let text = format!(r#"["starchess-training-rng-v1",{},"{}"]"#, master, label.as_str());
    let digest = Sha256::digest(text.as_bytes());
    Ok(u32::from_be_bytes([digest[0], digest[1], digest[2], digest[3]]))
}

object_wire! { pub struct StreamStateWire { status: String, root: u32, state: u32, draw_count: u64 } }
object_wire! { pub struct GeneratorStateWire {
    status: String,
    #[serde(deserialize_with = "required_nullable")]
    root: Option<u32>,
    #[serde(deserialize_with = "required_nullable")]
    state: Option<u32>,
    draw_count: u64,
} }
object_wire! { pub struct RngStateWire {
    selection: StreamStateWire,
    #[serde(rename = "environment-settlement")]
    environment_settlement: StreamStateWire,
    #[serde(rename = "policy-sampling")]
    policy_sampling: StreamStateWire,
    opponent: StreamStateWire, generator: GeneratorStateWire,
} }
object_wire! { pub struct HostControlWire {
    corpus_permutation: [u32; 18], corpus_cursor: u32, corpus_epoch: u32,
    schedule_cursor: u32, live_ordinal: u32, due_bucket: u32, fulfilled_bucket: u32,
} }
object_wire! { pub struct CheckpointWire {
    version: String, status: String, master: u32, actual_epoch: u32, counters: CountersWire,
    #[serde(deserialize_with = "fixed_418")]
    weights: Vec<Float64Hex>,
    #[serde(deserialize_with = "fixed_418")]
    ordered_feature_names: Vec<String>, manifest_hash: ByteRef,
    versions: VersionsWire, config: ConfigurationWire, rng: RngStateWire, host_control: HostControlWire,
    journal_ref: JournalRefWire, authorized_history_refs: Vec<ByteRef>,
    #[serde(deserialize_with = "required_nullable")]
    next_model_history: Option<()>,
    provenance_refs: ProvenanceWire,
} }

fn persistent(stream: &StreamStateWire, master: u32, label: EpisodeStreamLabel, unused: bool) -> ArtifactResult<()> {
    let root = derive_episode_root(master, label)?;
    if stream.draw_count > MAX_SAFE_INTEGER || stream.root != root
        || stream.state != root.wrapping_add(STEP.wrapping_mul(stream.draw_count as u32))
        || (unused && (stream.status != "unused" || stream.draw_count != 0))
        || (!unused && stream.status != "active") { return Err(ArtifactError::Rng); }
    Ok(())
}

fn draw(state: &mut u32) -> f64 {
    *state = state.wrapping_add(STEP);
    let mut t = *state;
    t = (t ^ (t >> 15)).wrapping_mul(t | 1);
    t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
    f64::from(t ^ (t >> 14)) / 4_294_967_296.0
}

fn selection_at(master: u32, corpus_started: u32) -> ArtifactResult<([u32; 18], u32, u64)> {
    let mut state = derive_episode_root(master, EpisodeStreamLabel::Selection)?;
    let mut permutation = std::array::from_fn(|index| index as u32);
    let mut count = 0;
    if corpus_started != 0 {
        for _ in 0..=(corpus_started - 1) / 18 {
            permutation = std::array::from_fn(|index| index as u32);
            for index in (1..18).rev() {
                let selected = (draw(&mut state) * (index + 1) as f64).floor() as usize;
                permutation.swap(index, selected);
                count += 1;
            }
        }
    }
    Ok((permutation, state, count))
}

impl CheckpointWire {
    fn validate(&self) -> ArtifactResult<()> {
        if self.version != "starchess-training-checkpoint-v2" || self.status != "diagnostic" || !is_master(self.master)
            || !(1..=1000).contains(&self.actual_epoch) || self.next_model_history.is_some()
            || self.authorized_history_refs.len() > 1000 { return Err(ArtifactError::Schema); }
        self.counters.validate()?;
        self.versions.validate()?;
        self.config.validate()?;
        validate_names(&self.ordered_feature_names)?;
        PolicyWeights::from_wire(&self.weights)?;
        self.provenance_refs.validate()?;
        if self.actual_epoch != self.counters.started || self.actual_epoch != self.counters.verified_completed
            || self.counters.eligible_completed == 0 { return Err(ArtifactError::Counters); }
        if self.manifest_hash != self.provenance_refs.feature_manifest
            || self.journal_ref.reference()? != self.provenance_refs.episode_journal { return Err(ArtifactError::Binding); }
        let rng = &self.rng;
        persistent(&rng.selection, self.master, EpisodeStreamLabel::Selection, false)?;
        persistent(&rng.environment_settlement, self.master, EpisodeStreamLabel::EnvironmentSettlement, true)?;
        persistent(&rng.policy_sampling, self.master, EpisodeStreamLabel::PolicySampling, false)?;
        persistent(&rng.opponent, self.master, EpisodeStreamLabel::Opponent, false)?;
        if rng.generator.status != "unused" || rng.generator.root.is_some() || rng.generator.state.is_some() || rng.generator.draw_count != 0 {
            return Err(ArtifactError::Rng);
        }
        let control = &self.host_control;
        let corpus_started = self.actual_epoch.div_ceil(2);
        let epoch = (corpus_started - 1) / 18;
        let cursor = (corpus_started - 1) % 18 + 1;
        let (permutation, state, draw_count) = selection_at(self.master, corpus_started)?;
        if control.corpus_permutation != permutation || control.corpus_epoch != epoch || control.corpus_cursor != cursor
            || control.schedule_cursor != self.actual_epoch || control.live_ordinal != self.actual_epoch - corpus_started
            || control.due_bucket != self.actual_epoch / 100 || control.fulfilled_bucket != control.due_bucket
            || control.due_bucket == 0 || control.due_bucket > 10 || control.corpus_epoch > 999 {
            return Err(ArtifactError::Counters);
        }
        if rng.selection.state != state || rng.selection.draw_count != draw_count { return Err(ArtifactError::Rng); }
        Ok(())
    }
}

pub fn diagnose_checkpoint(bytes: &[u8]) -> ArtifactResult<DiagnosticParsed<CheckpointWire>> {
    let value: CheckpointWire = decode_canonical(bytes, CHECKPOINT_BYTE_CAP)?;
    value.validate()?;
    Ok(DiagnosticParsed::capture(value, bytes))
}

pub struct CheckpointCommitEvidence<'a> {
    pub expected_byte_ref: &'a ByteRef,
    pub expected_bindings: &'a ExpectedArtifactBindings,
    pub provenance: ProvenanceBytes<'a>,
    pub master: u32,
    pub counters_bytes: &'a [u8],
    pub committed_weights: &'a Vector418,
    pub journal_last_record_ordinal: u64,
    pub accepted_candidate_records: u64,
    pub checked_opponent_draws: u64,
    pub last_completed_eligible: bool,
    pub previous_fulfilled_bucket: u32,
    pub authorized_history_bytes: &'a [&'a [u8]],
}

pub struct ValidatedCheckpoint {
    state: CheckpointWire,
    original: Vec<u8>,
    reference: ByteRef,
}

impl ValidatedCheckpoint {
    pub fn byte_ref(&self) -> &ByteRef { &self.reference }
    pub fn canonical_bytes(&self) -> Vec<u8> { self.original.clone() }
    pub fn diagnostic_weights(&self) -> Vector418 {
        std::array::from_fn(|index| self.state.weights[index].to_f64())
    }
    pub fn staged_fulfilled_bucket(&self) -> u32 { self.state.host_control.fulfilled_bucket }
}

pub fn validate_checkpoint(bytes: &[u8], evidence: Option<&CheckpointCommitEvidence<'_>>) -> ArtifactResult<ValidatedCheckpoint> {
    let evidence = evidence.ok_or(ArtifactError::MissingEvidence)?;
    if bytes.len() > CHECKPOINT_BYTE_CAP { return Err(ArtifactError::Limit); }
    if !evidence.expected_byte_ref.matches(bytes) { return Err(ArtifactError::Binding); }
    let checkpoint = diagnose_checkpoint(bytes)?;
    let state = checkpoint.value();
    evidence.expected_bindings.require(&state.provenance_refs)?;
    evidence.provenance.require(evidence.expected_bindings)?;
    let manifest = diagnose_manifest(evidence.provenance.feature_manifest)?;
    let recipe = diagnose_training_recipe(evidence.provenance.recipe)?;
    if manifest.byte_ref() != &state.manifest_hash || recipe.byte_ref() != evidence.expected_bindings.recipe_ref()
        || recipe.value().configuration != state.config || recipe.value().versions != state.versions
        || state.master != evidence.master || state.journal_ref.last_record_ordinal != evidence.journal_last_record_ordinal
        || evidence.expected_bindings.journal_ref() != &state.journal_ref.reference()? { return Err(ArtifactError::Binding); }
    let counters: CountersWire = decode_canonical(evidence.counters_bytes, ARTIFACT_BYTE_CAP)?;
    counters.validate()?;
    if counters != state.counters || !evidence.last_completed_eligible
        || evidence.previous_fulfilled_bucket >= state.host_control.due_bucket
        || evidence.previous_fulfilled_bucket > 9 { return Err(ArtifactError::Counters); }
    if evidence.accepted_candidate_records > MAX_SAFE_INTEGER || evidence.checked_opponent_draws > MAX_SAFE_INTEGER
        || state.rng.policy_sampling.draw_count != evidence.accepted_candidate_records
        || state.rng.opponent.draw_count != evidence.checked_opponent_draws { return Err(ArtifactError::Rng); }
    if state.weights.iter().zip(evidence.committed_weights).any(|(actual, expected)| actual.bits() != expected.to_bits()) {
        return Err(ArtifactError::Binding);
    }
    if state.authorized_history_refs.len() != evidence.authorized_history_bytes.len() { return Err(ArtifactError::Binding); }
    for (reference, physical) in state.authorized_history_refs.iter().zip(evidence.authorized_history_bytes) {
        if !reference.matches(physical) { return Err(ArtifactError::Binding); }
    }
    let reference = checkpoint.byte_ref().clone();
    Ok(ValidatedCheckpoint { state: checkpoint.into_value(), original: bytes.to_vec(), reference })
}

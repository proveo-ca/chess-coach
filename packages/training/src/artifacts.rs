// SPEC: _spec/packages/training/artifact-lifecycle.puml
use serde::{Deserialize, Deserializer, Serialize};

use crate::artifact_bytes::{
    ARTIFACT_BYTE_CAP, ArtifactError, ArtifactResult, ByteRef, DiagnosticParsed, Float64Hex,
    MAX_SAFE_INTEGER, decode_canonical, fixed_418, object_only, object_wire, required_nullable,
};
use crate::feature_manifest::feature_registry_v3;
use crate::learner_math::Vector418;
use crate::policy_weights::PolicyWeights;

pub(crate) const OPENING_BYTES: &[u8] = br#"{"bank":{"b":3,"w":3},"cc":{"b":"e8","w":"e1"},"marines":{"b":["c7","d7","e7","f7"],"w":["c2","d2","e2","f2"]},"turn":0,"version":"starchess-economic-opening-v1"}"#;
const BANDS: [u16; 19] = [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512];

object_wire! { pub struct ManifestEntryWire { name: String, meaning_id: String, scale_id: String } }
object_wire! { pub struct ScalesWire {
    minerals: u32, gas: u32, turn: u32, cc_lives: u32, max_spawn: u32, paid: u32,
    replacement: u32, coords: u32, squares: u32, actions: u32, pairs: u32,
    relation_pairs: u32, vision_overlap: u32, files: u32,
} }
object_wire! { pub struct ManifestWire {
    version: String, dimension: u32,
    #[serde(deserialize_with = "fixed_418")]
    names: Vec<String>,
    #[serde(deserialize_with = "fixed_418")]
    entries: Vec<ManifestEntryWire>, scales: ScalesWire,
} }

impl ManifestWire {
    pub(crate) fn validate(&self) -> ArtifactResult<()> {
        if self.version != "challenge-feature-manifest-v3" || self.dimension != 418
            || self.names.len() != 418 || self.entries.len() != 418 {
            return Err(ArtifactError::Manifest);
        }
        let scales = &self.scales;
        if [scales.minerals, scales.gas, scales.turn, scales.cc_lives, scales.max_spawn,
            scales.paid, scales.replacement, scales.coords, scales.squares, scales.actions,
            scales.pairs, scales.relation_pairs, scales.vision_overlap, scales.files]
            != [12, 3, 45, 3, 9, 3072, 2304, 7, 64, 4, 6, 4096, 256, 8] {
            return Err(ArtifactError::Manifest);
        }
        validate_names(&self.names)?;
        for (entry, trusted) in self.entries.iter().zip(feature_registry_v3()) {
            if entry.name != trusted.name || entry.meaning_id != trusted.meaning_id || entry.scale_id != trusted.scale_id {
                return Err(ArtifactError::Manifest);
            }
        }
        Ok(())
    }
}

pub(crate) fn validate_names(names: &[String]) -> ArtifactResult<()> {
    if names.len() != 418 || names.iter().zip(feature_registry_v3()).any(|(name, trusted)| name != trusted.name) {
        return Err(ArtifactError::Manifest);
    }
    Ok(())
}

object_wire! { pub struct VersionsWire {
    snapshot: String, observation_codec: String, history: String, batch: String, ledger: String,
    provenance: String, candidate_codec: String, generator: String, projection: String, features: String,
    feature_manifest: String, comparator: String, rng: String, episode_protocol: String,
    checkpoint: String, artifact: String, optimizer: String, loss: String, eligibility: String,
    recipe: String, host_config: String,
} }

impl VersionsWire {
    pub(crate) fn validate(&self) -> ArtifactResult<()> {
        let fields = [
            (&self.snapshot, "challenge-observation-v2"), (&self.observation_codec, "challenge-observation-codec-v2"),
            (&self.history, "challenge-history-v2"), (&self.batch, "challenge-boundary-batch-v1"),
            (&self.ledger, "challenge-economic-ledger-v1"), (&self.provenance, "engine-provenance-v1"),
            (&self.candidate_codec, "challenge-candidate-codec-v1"), (&self.generator, "challenge-composition-v3"),
            (&self.projection, "authorized-own-projection-v1"), (&self.features, "challenge-features-v3"),
            (&self.feature_manifest, "challenge-feature-manifest-v3"), (&self.comparator, "score-desc-key-asc-v1"),
            (&self.rng, "starchess-training-rng-v1"), (&self.episode_protocol, "starchess-training-episode-v2"),
            (&self.checkpoint, "starchess-training-checkpoint-v2"), (&self.artifact, "starchess-training-artifact-v2"),
            (&self.optimizer, "starchess-sgd-float64-v1"), (&self.loss, "starchess-reinforce-sum-v1"),
            (&self.eligibility, "starchess-training-eligibility-v1"), (&self.recipe, "starchess-training-recipe-v2"),
            (&self.host_config, "starchess-training-host-v2"),
        ];
        if fields.iter().any(|(actual, expected)| actual.as_str() != *expected) { return Err(ArtifactError::Schema); }
        Ok(())
    }
}

object_wire! { pub struct ProfilesWire { api: String, provenance: String, quota: String, curriculum: String, validation: String } }
object_wire! { pub struct HostLimitsWire {
    startup_ms: u32, plan_ms: u32, match_ms: u32, max_windows: u32, max_recorded_plies: u32,
    max_proposals: u32, max_ipc_messages: u32, max_progress_bytes: u32, max_completion_bytes: u32,
} }
object_wire! { pub struct ValidationWire { profile: String, eps: [Float64Hex; 1], atol: Float64Hex, rtol: Float64Hex } }
object_wire! { pub struct ConfigurationWire {
    profiles: ProfilesWire, horizon: u32, dimension: u32, unique_cap: u32, work_cap: u32,
    max_generated_actions: u32, family_capacity: u32, composition_capacity: u32, pass_capacity: u32,
    max_started_per_master: u32, masters: [u32; 5], checkpoint_cadence: u32,
    initialization: String, arithmetic: String, optimizer: String, learning_rate: Float64Hex,
    temperature: Float64Hex, l2: Float64Hex, clipping: String, baseline: String, empty_decision: String,
    abort_policy: String, primary_master: u32, opening_ref: ByteRef, host_limits: HostLimitsWire, validation: ValidationWire,
} }

impl ConfigurationWire {
    pub(crate) fn validate(&self) -> ArtifactResult<()> {
        let p = &self.profiles;
        let h = &self.host_limits;
        if p.api != "A" || p.provenance != "A" || p.quota != "B" || p.curriculum != "A" || p.validation != "A"
            || [self.horizon, self.dimension, self.unique_cap, self.work_cap, self.max_generated_actions,
                self.family_capacity, self.composition_capacity, self.pass_capacity, self.max_started_per_master,
                self.checkpoint_cadence, self.primary_master] != [1, 418, 512, 2048, 4, 48, 175, 1, 1000, 100, 101]
            || self.masters != [101, 102, 103, 104, 105]
            || self.initialization != "zeros" || self.arithmetic != "float64-cpu" || self.optimizer != "SGD"
            || self.clipping != "none" || self.baseline != "per-seed-all-history-eligible-mean"
            || self.empty_decision != "diagnostic-only" || self.abort_policy != "stop-all"
            || self.learning_rate.bits() != 0.001_f64.to_bits() || self.temperature.bits() != 1.0_f64.to_bits()
            || self.l2.bits() != 0.0001_f64.to_bits() || !self.opening_ref.matches(OPENING_BYTES)
            || [h.startup_ms, h.plan_ms, h.match_ms, h.max_windows, h.max_recorded_plies, h.max_proposals,
                h.max_ipc_messages, h.max_progress_bytes, h.max_completion_bytes]
                != [10000, 10000, 300000, 64, 128, 4096, 2048, 1048576, 16777216]
            || self.validation.profile != "A" || self.validation.eps[0].bits() != 1e-6_f64.to_bits()
            || self.validation.atol.bits() != 1e-8_f64.to_bits() || self.validation.rtol.bits() != 1e-5_f64.to_bits() {
            return Err(ArtifactError::Schema);
        }
        Ok(())
    }
}

object_wire! { pub struct CountersWire {
    started: u32, verified_completed: u32, eligible_completed: u32, updates: u32,
    nonzero_pg_updates: u32, baseline_count: u32, baseline_sum: i32,
} }

impl CountersWire {
    pub(crate) fn validate(&self) -> ArtifactResult<()> {
        if self.started > 1000 || self.verified_completed > self.started
            || self.eligible_completed > self.verified_completed || self.updates != self.eligible_completed
            || self.baseline_count != self.updates || self.nonzero_pg_updates > self.updates
            || self.baseline_sum.unsigned_abs() > self.baseline_count {
            return Err(ArtifactError::Counters);
        }
        Ok(())
    }
}

object_wire! { pub struct JournalRefWire { byte_length: u64, sha256: String, last_record_ordinal: u64 } }
impl JournalRefWire {
    pub(crate) fn reference(&self) -> ArtifactResult<ByteRef> {
        if self.last_record_ordinal > MAX_SAFE_INTEGER { return Err(ArtifactError::Schema); }
        ByteRef::new(self.byte_length, &self.sha256)
    }
}

object_wire! { pub struct ProvenanceWire {
    source: ByteRef, tests: ByteRef, source_inventory: ByteRef, source_policy: ByteRef,
    dependency_lock: ByteRef, installed_tree: ByteRef, frozen_store: ByteRef, tool_tree: ByteRef,
    image: ByteRef, runtime_configuration: ByteRef, corpus_manifest: ByteRef, corpus_source: ByteRef,
    core_rules: ByteRef, strategic_source: ByteRef, host_configuration: ByteRef, recipe: ByteRef,
    feature_manifest: ByteRef, fixture_manifest: ByteRef, episode_journal: ByteRef,
    #[serde(deserialize_with = "required_nullable")]
    private_provenance_codec: Option<ByteRef>,
} }

impl ProvenanceWire {
    pub(crate) fn validate(&self) -> ArtifactResult<()> {
        if self.private_provenance_codec.is_some() { return Err(ArtifactError::Binding); }
        Ok(())
    }

    fn references(&self) -> [&ByteRef; 19] {
        [&self.source, &self.tests, &self.source_inventory, &self.source_policy, &self.dependency_lock,
            &self.installed_tree, &self.frozen_store, &self.tool_tree, &self.image, &self.runtime_configuration,
            &self.corpus_manifest, &self.corpus_source, &self.core_rules, &self.strategic_source,
            &self.host_configuration, &self.recipe, &self.feature_manifest, &self.fixture_manifest, &self.episode_journal]
    }
}

pub struct ExpectedArtifactBindings {
    provenance: ProvenanceWire,
}

impl ExpectedArtifactBindings {
    pub(crate) fn require(&self, actual: &ProvenanceWire) -> ArtifactResult<()> {
        actual.validate()?;
        if self.provenance != *actual { return Err(ArtifactError::Binding); }
        Ok(())
    }
    pub(crate) fn manifest_ref(&self) -> &ByteRef { &self.provenance.feature_manifest }
    pub(crate) fn recipe_ref(&self) -> &ByteRef { &self.provenance.recipe }
    pub(crate) fn journal_ref(&self) -> &ByteRef { &self.provenance.episode_journal }
}

pub fn decode_expected_artifact_bindings(bytes: &[u8]) -> ArtifactResult<ExpectedArtifactBindings> {
    let provenance: ProvenanceWire = decode_canonical(bytes, ARTIFACT_BYTE_CAP)?;
    provenance.validate()?;
    Ok(ExpectedArtifactBindings { provenance })
}

pub struct ProvenanceBytes<'a> {
    pub source: &'a [u8], pub tests: &'a [u8], pub source_inventory: &'a [u8], pub source_policy: &'a [u8],
    pub dependency_lock: &'a [u8], pub installed_tree: &'a [u8], pub frozen_store: &'a [u8], pub tool_tree: &'a [u8],
    pub image: &'a [u8], pub runtime_configuration: &'a [u8], pub corpus_manifest: &'a [u8], pub corpus_source: &'a [u8],
    pub core_rules: &'a [u8], pub strategic_source: &'a [u8], pub host_configuration: &'a [u8], pub recipe: &'a [u8],
    pub feature_manifest: &'a [u8], pub fixture_manifest: &'a [u8], pub episode_journal: &'a [u8],
}

impl ProvenanceBytes<'_> {
    pub(crate) fn require(&self, expected: &ExpectedArtifactBindings) -> ArtifactResult<()> {
        let bytes = [self.source, self.tests, self.source_inventory, self.source_policy, self.dependency_lock,
            self.installed_tree, self.frozen_store, self.tool_tree, self.image, self.runtime_configuration,
            self.corpus_manifest, self.corpus_source, self.core_rules, self.strategic_source,
            self.host_configuration, self.recipe, self.feature_manifest, self.fixture_manifest, self.episode_journal];
        for (reference, bytes) in expected.provenance.references().into_iter().zip(bytes) {
            if !reference.matches(bytes) { return Err(ArtifactError::Binding); }
        }
        Ok(())
    }
}

object_wire! { pub struct TrainingSummaryWire {
    counters: CountersWire, recipe_ref: ByteRef, recipe_version: String, curriculum_profile: String,
    eligibility_version: String, last_started_ordinal: u32, final_boundary_ordinal: u32,
    final_journal_ref: JournalRefWire, aborted: bool,
} }
object_wire! { pub struct PolicyArtifactWire {
    version: String, status: String, master: u32, dimension: u32, feature_version: String,
    #[serde(deserialize_with = "fixed_418")]
    feature_names: Vec<String>, manifest: ManifestWire,
    #[serde(deserialize_with = "fixed_418")]
    weights: Vec<Float64Hex>, versions: VersionsWire,
    configuration: ConfigurationWire, training_summary: TrainingSummaryWire, provenance_refs: ProvenanceWire,
} }

impl PolicyArtifactWire {
    fn validate(&self) -> ArtifactResult<()> {
        if self.version != "starchess-training-artifact-v2" || self.status != "VALID" || !is_master(self.master)
            || self.dimension != 418 || self.feature_version != "challenge-features-v3" { return Err(ArtifactError::Schema); }
        validate_names(&self.feature_names)?;
        self.manifest.validate()?;
        PolicyWeights::from_wire(&self.weights)?;
        self.versions.validate()?;
        self.configuration.validate()?;
        self.provenance_refs.validate()?;
        let summary = &self.training_summary;
        summary.counters.validate()?;
        if summary.counters.started != 1000 || summary.counters.verified_completed != 1000
            || summary.counters.nonzero_pg_updates == 0 || summary.aborted || summary.last_started_ordinal != 999
            || summary.final_boundary_ordinal > 256 || summary.recipe_version != self.versions.recipe
            || summary.curriculum_profile != self.configuration.profiles.curriculum
            || summary.eligibility_version != self.versions.eligibility {
            return Err(ArtifactError::Counters);
        }
        if summary.recipe_ref != self.provenance_refs.recipe
            || summary.final_journal_ref.reference()? != self.provenance_refs.episode_journal { return Err(ArtifactError::Binding); }
        Ok(())
    }
}

pub(crate) fn is_master(master: u32) -> bool { (101..=105).contains(&master) }

object_wire! { pub struct TrainingRecipeWire {
    version: String, configuration: ConfigurationWire, versions: VersionsWire, economic_pin_ref: ByteRef,
} }
impl TrainingRecipeWire {
    pub(crate) fn validate(&self) -> ArtifactResult<()> {
        if self.version != "starchess-training-recipe-v2" { return Err(ArtifactError::Schema); }
        self.configuration.validate()?;
        self.versions.validate()
    }
}

object_wire! { pub struct EconomicPinWire {
    version: String, economic_artifact_ref: ByteRef, estimator_provenance_ref: ByteRef,
    feature_manifest_ref: ByteRef, amendment_ref: ByteRef,
} }
object_wire! { pub struct EconomicBindingWire {
    version: String, policy_artifact_ref: ByteRef, economic_artifact_ref: ByteRef,
    estimator_provenance_ref: ByteRef, feature_manifest_ref: ByteRef, amendment_ref: ByteRef,
} }
object_wire! { pub struct EstimatorProvenanceWire {
    version: String, economic_artifact_ref: ByteRef, core_rules_ref: ByteRef, fitting_code_ref: ByteRef,
    collection_recipe_ref: ByteRef, fitting_recipe_ref: ByteRef, collection_roster_ref: ByteRef,
    split_roster_ref: ByteRef, label_bytes_ref: ByteRef, fit_journal_ref: ByteRef, calibration_journal_ref: ByteRef,
} }
object_wire! { pub struct EconomicAuthorityWire {
    version: String, contracts_ref: ByteRef, r2_generator_ref: ByteRef, base_ref: ByteRef,
    corrective_ref: ByteRef, r3_seam_ref: ByteRef, r3_native_correction_ref: ByteRef, owned_ingress_ref: ByteRef,
} }

object_wire! { pub struct OpeningBankWire { w: u32, b: u32 } }
object_wire! { pub struct OpeningCcWire { w: String, b: String } }
object_wire! { pub struct OpeningMarinesWire { w: [String; 4], b: [String; 4] } }
object_wire! { pub struct PublicOpeningWire {
    version: String, turn: u32, bank: OpeningBankWire, cc: OpeningCcWire, marines: OpeningMarinesWire,
} }
object_wire! { pub struct EconomicRecipeWire {
    version: String, support_version: String, graph_version: String, innovation_version: String,
    geometry_version: String, calibration_version: String, work_cap: u32, material_ceiling: u32,
    bank_cap: u32, band_starts: [u16; 19], alpha: Float64Hex, minimum_groups: u32, diagnostic_horizons: [u32; 3],
} }

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum EconomicTableWire {
    Transition { level: u32, bank: Option<u32>, band: Option<u32>, tier: Option<u32>, groups: u32,
        rows: Vec<(u32, u32, u32, u32, u32, Float64Hex)> },
    Evidence { level: u32, bank: Option<u32>, band: Option<u32>, tier: Option<u32>, groups: u32,
        rows: Vec<(u32, u32, u32, Float64Hex)> },
}

impl<'de> Deserialize<'de> for EconomicTableWire {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
        enum Wire {
            Transition { level: u32,
                #[serde(deserialize_with = "required_nullable")] bank: Option<u32>,
                #[serde(deserialize_with = "required_nullable")] band: Option<u32>,
                #[serde(deserialize_with = "required_nullable")] tier: Option<u32>, groups: u32,
                rows: Vec<(u32, u32, u32, u32, u32, Float64Hex)> },
            Evidence { level: u32,
                #[serde(deserialize_with = "required_nullable")] bank: Option<u32>,
                #[serde(deserialize_with = "required_nullable")] band: Option<u32>,
                #[serde(deserialize_with = "required_nullable")] tier: Option<u32>, groups: u32,
                rows: Vec<(u32, u32, u32, Float64Hex)> },
        }
        Ok(match object_only(deserializer)? {
            Wire::Transition { level, bank, band, tier, groups, rows } => Self::Transition { level, bank, band, tier, groups, rows },
            Wire::Evidence { level, bank, band, tier, groups, rows } => Self::Evidence { level, bank, band, tier, groups, rows },
        })
    }
}

object_wire! { pub struct EconomicArtifactWire {
    version: String, status: String, opening: PublicOpeningWire, recipe: EconomicRecipeWire,
    tables: Vec<EconomicTableWire>, partition: Vec<[u32; 4]>, temperatures: Vec<Float64Hex>,
} }

impl EconomicArtifactWire {
    fn validate(&self) -> ArtifactResult<()> {
        if self.version != "starchess-economic-artifact-v1" || self.status != "FROZEN" { return Err(ArtifactError::Schema); }
        let expected_opening: PublicOpeningWire = decode_canonical(OPENING_BYTES, ARTIFACT_BYTE_CAP)?;
        if self.opening != expected_opening { return Err(ArtifactError::Schema); }
        let r = &self.recipe;
        if r.version != "starchess-economic-recipe-v1" || r.support_version != "economic-accounting-relaxation-v1"
            || r.graph_version != "positive-headstock-suffix-v1" || r.innovation_version != "authorized-economic-innovation-v1"
            || r.geometry_version != "authorized-promotion-geometry-v1" || r.calibration_version != "starchess-economic-calibration-v1"
            || r.work_cap != 1048576 || r.material_ceiling != 576 || r.bank_cap != 12 || r.band_starts != BANDS
            || r.alpha.bits() != 0.5_f64.to_bits() || r.minimum_groups != 32 || r.diagnostic_horizons != [1, 2, 3]
            || self.tables.len() > 1588 { return Err(ArtifactError::Schema); }
        let mut prior = None;
        let mut row_count = 0;
        for table in &self.tables {
            let (kind, level, bank, band, tier, groups, length) = match table {
                EconomicTableWire::Transition { level, bank, band, tier, groups, rows } => (0, *level, *bank, *band, *tier, *groups, rows.len()),
                EconomicTableWire::Evidence { level, bank, band, tier, groups, rows } => (1, *level, *bank, *band, *tier, *groups, rows.len()),
            };
            row_count += length;
            if row_count > 8192 || level > 3 || groups > 14400
                || bank.is_some() != (level <= 2) || band.is_some() != (level == 0) || tier.is_some() != (level <= 1)
                || bank.is_some_and(|v| v > 12) || band.is_some_and(|v| v > 18) || tier.is_some_and(|v| v > 2)
                || (length == 0) != (groups == 0) { return Err(ArtifactError::Schema); }
            let key = (kind, level, bank, band, tier);
            if prior.is_some_and(|p| p >= key) { return Err(ArtifactError::Schema); }
            prior = Some(key);
            match table {
                EconomicTableWire::Transition { rows, .. } => {
                    let mut previous_outcome = None;
                    for &(s, created, wasted, growth, destroyed, count) in rows {
                        let outcome = (s, created, wasted, growth, destroyed);
                        if previous_outcome.is_some_and(|previous| previous >= outcome) { return Err(ArtifactError::Schema); }
                        previous_outcome = Some(outcome);
                        if ![0, 1, 3, 5, 9].contains(&s) || (created != 0 && created != s) || wasted != s - created
                            || growth > 32 || growth % 2 != 0 || destroyed > 617 || s > bank.unwrap_or(12)
                            || !(count.to_f64() > 0.0 && count.to_f64() <= 14400.0) { return Err(ArtifactError::Schema); }
                        let (low, high) = match band {
                            Some(b) => (BANDS[b as usize] as u32, if b == 18 { 576 } else { BANDS[b as usize + 1] as u32 - 1 }),
                            None => (0, 576),
                        };
                        let max_promotions = 4_u32.min(1 + tier.map_or(3, |t| t + 1) - u32::from(s > 0))
                            .min(high + u32::from(created == 1));
                        let mut feasible = false;
                        for a in 0..=max_promotions {
                            for b in 0..=max_promotions - a {
                                for c in 0..=max_promotions - a - b {
                                    feasible |= 2 * a + 4 * b + 8 * c == growth;
                                }
                            }
                        }
                        if !feasible || destroyed > high + created + growth
                            || i64::from(low) + i64::from(created) + i64::from(growth) - i64::from(destroyed) > 576 {
                            return Err(ArtifactError::Schema);
                        }
                    }
                }
                EconomicTableWire::Evidence { rows, .. } => {
                    let mut previous_outcome = None;
                    for &(a, b, c, count) in rows {
                        let outcome = (a, b, c);
                        if previous_outcome.is_some_and(|previous| previous >= outcome)
                            || a > 3 || b > 3 || c > 2 || count.to_f64() <= 0.0 || count.to_f64() > 14400.0 {
                            return Err(ArtifactError::Schema);
                        }
                        previous_outcome = Some(outcome);
                    }
                }
            }
        }
        if !(3..=12).contains(&self.partition.len()) || self.temperatures.len() != self.partition.len() { return Err(ArtifactError::Schema); }
        let mut tier = 0;
        let mut next_lit = 0;
        for &[turn_low, turn_high, lit_low, lit_high] in &self.partition {
            if tier >= 3 || turn_low != [0, 11, 21][tier] || turn_high != [10, 20, 45][tier] || lit_low != next_lit
                || !matches!((lit_low, lit_high), (0, 15 | 31 | 64) | (16, 31) | (32, 47 | 64) | (48, 64)) {
                return Err(ArtifactError::Schema);
            }
            next_lit = lit_high + 1;
            if next_lit == 65 { tier += 1; next_lit = 0; }
        }
        if tier != 3 || next_lit != 0 { return Err(ArtifactError::Schema); }
        for temperature in &self.temperatures {
            let value = temperature.to_f64();
            if value != 0.25 && value != 4.0 && !(1..1000).any(|i| value == 0.25 * 16.0_f64.powf(f64::from(i) / 1000.0)) {
                return Err(ArtifactError::Schema);
            }
        }
        Ok(())
    }
}

pub fn diagnose_manifest(bytes: &[u8]) -> ArtifactResult<DiagnosticParsed<ManifestWire>> {
    let value: ManifestWire = decode_canonical(bytes, ARTIFACT_BYTE_CAP)?;
    value.validate()?;
    Ok(DiagnosticParsed::capture(value, bytes))
}

pub fn diagnose_policy_artifact(bytes: &[u8]) -> ArtifactResult<DiagnosticParsed<PolicyArtifactWire>> {
    let value: PolicyArtifactWire = decode_canonical(bytes, ARTIFACT_BYTE_CAP)?;
    value.validate()?;
    Ok(DiagnosticParsed::capture(value, bytes))
}

pub fn diagnose_economic_artifact(bytes: &[u8]) -> ArtifactResult<DiagnosticParsed<EconomicArtifactWire>> {
    let value: EconomicArtifactWire = decode_canonical(bytes, ARTIFACT_BYTE_CAP)?;
    value.validate()?;
    Ok(DiagnosticParsed::capture(value, bytes))
}

pub fn diagnose_training_recipe(bytes: &[u8]) -> ArtifactResult<DiagnosticParsed<TrainingRecipeWire>> {
    let value: TrainingRecipeWire = decode_canonical(bytes, ARTIFACT_BYTE_CAP)?;
    value.validate()?;
    Ok(DiagnosticParsed::capture(value, bytes))
}

pub struct ArtifactBundleBytes<'a> {
    pub policy: &'a [u8], pub economic: &'a [u8], pub manifest: &'a [u8], pub pin: &'a [u8],
    pub estimator: &'a [u8], pub binding: &'a [u8], pub authority: &'a [u8], pub recipe: &'a [u8],
}

pub struct ExpectedInferenceBindings<'a> {
    pub policy: &'a ByteRef, pub economic: &'a ByteRef, pub manifest: &'a ByteRef, pub pin: &'a ByteRef,
    pub estimator: &'a ByteRef, pub binding: &'a ByteRef, pub authority: &'a ByteRef, pub recipe: &'a ByteRef,
    pub provenance: &'a ExpectedArtifactBindings,
}

pub struct EstimatorBytes<'a> {
    pub core_rules: &'a [u8], pub fitting_code: &'a [u8], pub collection_recipe: &'a [u8], pub fitting_recipe: &'a [u8],
    pub collection_roster: &'a [u8], pub split_roster: &'a [u8], pub label_bytes: &'a [u8],
    pub fit_journal: &'a [u8], pub calibration_journal: &'a [u8],
}
pub struct AuthorityBytes<'a> {
    pub contracts: &'a [u8], pub r2_generator: &'a [u8], pub base: &'a [u8], pub corrective: &'a [u8],
    pub r3_seam: &'a [u8], pub r3_native_correction: &'a [u8], pub owned_ingress: &'a [u8],
}

pub struct FinalJournalEvidence<'a> {
    pub master: u32, pub counters_bytes: &'a [u8], pub last_record_ordinal: u64,
    pub last_started_ordinal: u32, pub final_boundary_ordinal: u32, pub aborted: bool,
}

pub struct InferenceEvidence<'a> {
    pub provenance: ProvenanceBytes<'a>, pub estimator: EstimatorBytes<'a>, pub authority: AuthorityBytes<'a>,
    pub journal: FinalJournalEvidence<'a>,
}

pub struct AcceptedInferenceArtifact {
    weights: PolicyWeights,
    reference: ByteRef,
    economic_reference: ByteRef,
}

impl AcceptedInferenceArtifact {
    pub fn inference_weights(&self) -> Vector418 { self.weights.detached_copy() }
    pub fn byte_ref(&self) -> &ByteRef { &self.reference }
    pub fn economic_byte_ref(&self) -> &ByteRef { &self.economic_reference }
}

pub fn accept_inference_artifact(
    bytes: &ArtifactBundleBytes<'_>, expected: Option<&ExpectedInferenceBindings<'_>>, evidence: Option<&InferenceEvidence<'_>>,
) -> ArtifactResult<AcceptedInferenceArtifact> {
    let expected = expected.ok_or(ArtifactError::MissingEvidence)?;
    let evidence = evidence.ok_or(ArtifactError::MissingEvidence)?;
    let pairs = [(bytes.policy, expected.policy), (bytes.economic, expected.economic), (bytes.manifest, expected.manifest),
        (bytes.pin, expected.pin), (bytes.estimator, expected.estimator), (bytes.binding, expected.binding),
        (bytes.authority, expected.authority), (bytes.recipe, expected.recipe)];
    for (input, reference) in pairs {
        if input.len() > ARTIFACT_BYTE_CAP { return Err(ArtifactError::Limit); }
        if !reference.matches(input) { return Err(ArtifactError::Binding); }
    }
    let policy = diagnose_policy_artifact(bytes.policy)?;
    diagnose_economic_artifact(bytes.economic)?;
    let manifest = diagnose_manifest(bytes.manifest)?;
    let recipe = diagnose_training_recipe(bytes.recipe)?;
    let pin: EconomicPinWire = decode_canonical(bytes.pin, ARTIFACT_BYTE_CAP)?;
    let binding: EconomicBindingWire = decode_canonical(bytes.binding, ARTIFACT_BYTE_CAP)?;
    let estimator: EstimatorProvenanceWire = decode_canonical(bytes.estimator, ARTIFACT_BYTE_CAP)?;
    let authority: EconomicAuthorityWire = decode_canonical(bytes.authority, ARTIFACT_BYTE_CAP)?;
    if pin.version != "starchess-economic-pin-v1" || binding.version != "starchess-economic-binding-v1"
        || estimator.version != "starchess-estimator-provenance-v1" || authority.version != "starchess-economic-authority-v1" {
        return Err(ArtifactError::Schema);
    }
    for (actual, independent) in [(&pin.economic_artifact_ref, expected.economic), (&pin.estimator_provenance_ref, expected.estimator),
        (&pin.feature_manifest_ref, expected.manifest), (&pin.amendment_ref, expected.authority),
        (&binding.policy_artifact_ref, expected.policy), (&binding.economic_artifact_ref, expected.economic),
        (&binding.estimator_provenance_ref, expected.estimator), (&binding.feature_manifest_ref, expected.manifest),
        (&binding.amendment_ref, expected.authority), (&estimator.economic_artifact_ref, expected.economic),
        (&recipe.value().economic_pin_ref, expected.pin), (expected.provenance.manifest_ref(), expected.manifest),
        (expected.provenance.recipe_ref(), expected.recipe)] {
        if actual != independent { return Err(ArtifactError::Binding); }
    }
    let p = policy.value();
    expected.provenance.require(&p.provenance_refs)?;
    evidence.provenance.require(expected.provenance)?;
    if p.manifest != *manifest.value() || p.configuration != recipe.value().configuration || p.versions != recipe.value().versions
        || estimator.core_rules_ref != p.provenance_refs.core_rules { return Err(ArtifactError::Binding); }
    for (reference, physical) in [(&estimator.core_rules_ref, evidence.estimator.core_rules),
        (&estimator.fitting_code_ref, evidence.estimator.fitting_code), (&estimator.collection_recipe_ref, evidence.estimator.collection_recipe),
        (&estimator.fitting_recipe_ref, evidence.estimator.fitting_recipe), (&estimator.collection_roster_ref, evidence.estimator.collection_roster),
        (&estimator.split_roster_ref, evidence.estimator.split_roster), (&estimator.label_bytes_ref, evidence.estimator.label_bytes),
        (&estimator.fit_journal_ref, evidence.estimator.fit_journal), (&estimator.calibration_journal_ref, evidence.estimator.calibration_journal),
        (&authority.contracts_ref, evidence.authority.contracts), (&authority.r2_generator_ref, evidence.authority.r2_generator),
        (&authority.base_ref, evidence.authority.base), (&authority.corrective_ref, evidence.authority.corrective),
        (&authority.r3_seam_ref, evidence.authority.r3_seam), (&authority.r3_native_correction_ref, evidence.authority.r3_native_correction),
        (&authority.owned_ingress_ref, evidence.authority.owned_ingress)] {
        if !reference.matches(physical) { return Err(ArtifactError::Binding); }
    }
    let counters: CountersWire = decode_canonical(evidence.journal.counters_bytes, ARTIFACT_BYTE_CAP)?;
    counters.validate()?;
    let summary = &p.training_summary;
    if counters != summary.counters || evidence.journal.master != p.master
        || evidence.journal.last_record_ordinal != summary.final_journal_ref.last_record_ordinal
        || evidence.journal.last_started_ordinal != summary.last_started_ordinal
        || evidence.journal.final_boundary_ordinal != summary.final_boundary_ordinal || evidence.journal.aborted != summary.aborted {
        return Err(ArtifactError::Binding);
    }
    Err(ArtifactError::MissingEvidence)
}

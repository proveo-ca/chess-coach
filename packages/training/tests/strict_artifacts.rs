// SPEC: _spec/packages/training/artifact-lifecycle.puml
use serde_json::{Value, json};
use training_native::artifact_bytes::{
    ARTIFACT_BYTE_CAP, ArtifactError, ByteRef, Float64Hex, MAX_SAFE_INTEGER,
    MAX_JSON_ARRAY_LEN, MAX_JSON_DEPTH, MAX_JSON_OBJECT_LEN, MAX_JSON_STRING_BYTES,
};
use training_native::artifacts::{
    accept_inference_artifact, decode_expected_artifact_bindings, diagnose_economic_artifact,
    diagnose_manifest, diagnose_policy_artifact, diagnose_training_recipe,
};
use training_native::policy_weights::PolicyWeights;

pub(crate) mod fixtures {
    use super::*;
    use std::collections::BTreeMap;
    use training_native::artifacts::{
        ArtifactBundleBytes, AuthorityBytes, EstimatorBytes, ExpectedArtifactBindings,
        ExpectedInferenceBindings, FinalJournalEvidence, InferenceEvidence, ProvenanceBytes,
    };
    use training_native::feature_manifest::feature_registry_v3;

    pub fn canonical(value: &Value) -> Vec<u8> {
        fn sorted(value: &Value) -> Value {
            match value {
                Value::Object(map) => {
                    let ordered: BTreeMap<_, _> = map.iter().map(|(key, value)| (key.clone(), sorted(value))).collect();
                    Value::Object(ordered.into_iter().collect())
                }
                Value::Array(values) => values.iter().map(sorted).collect(),
                value => value.clone(),
            }
        }
        serde_json::to_vec(&sorted(value)).unwrap()
    }

    pub fn reference(bytes: &[u8]) -> Value { serde_json::to_value(ByteRef::of_bytes(bytes)).unwrap() }
    pub fn h(value: f64) -> Value { json!({"hex": format!("{:016x}", value.to_bits())}) }
    pub fn counters(started: u32, eligible: u32) -> Value {
        json!({"started": started, "verifiedCompleted": started, "eligibleCompleted": eligible,
            "updates": eligible, "nonzeroPGUpdates": u32::from(eligible > 0), "baselineCount": eligible, "baselineSum": 0})
    }

    pub fn manifest() -> Value {
        let registry = feature_registry_v3();
        json!({"version": "challenge-feature-manifest-v3", "dimension": 418,
            "names": registry.iter().map(|entry| entry.name).collect::<Vec<_>>(),
            "entries": registry.iter().map(|entry| json!({"name": entry.name, "meaningId": entry.meaning_id, "scaleId": entry.scale_id})).collect::<Vec<_>>(),
            "scales": {"minerals":12,"gas":3,"turn":45,"ccLives":3,"maxSpawn":9,"paid":3072,
                "replacement":2304,"coords":7,"squares":64,"actions":4,"pairs":6,"relationPairs":4096,"visionOverlap":256,"files":8}})
    }

    pub fn versions() -> Value {
        json!({"snapshot":"challenge-observation-v2","observationCodec":"challenge-observation-codec-v2",
            "history":"challenge-history-v2","batch":"challenge-boundary-batch-v1","ledger":"challenge-economic-ledger-v1",
            "provenance":"engine-provenance-v1","candidateCodec":"challenge-candidate-codec-v1","generator":"challenge-composition-v3",
            "projection":"authorized-own-projection-v1","features":"challenge-features-v3","featureManifest":"challenge-feature-manifest-v3",
            "comparator":"score-desc-key-asc-v1","rng":"starchess-training-rng-v1","episodeProtocol":"starchess-training-episode-v2",
            "checkpoint":"starchess-training-checkpoint-v2","artifact":"starchess-training-artifact-v2","optimizer":"starchess-sgd-float64-v1",
            "loss":"starchess-reinforce-sum-v1","eligibility":"starchess-training-eligibility-v1","recipe":"starchess-training-recipe-v2",
            "hostConfig":"starchess-training-host-v2"})
    }

    pub fn opening() -> Value {
        json!({"version":"starchess-economic-opening-v1","turn":0,"bank":{"w":3,"b":3},"cc":{"w":"e1","b":"e8"},
            "marines":{"w":["c2","d2","e2","f2"],"b":["c7","d7","e7","f7"]}})
    }

    pub fn configuration() -> Value {
        json!({"profiles":{"api":"A","provenance":"A","quota":"B","curriculum":"A","validation":"A"},
            "horizon":1,"dimension":418,"uniqueCap":512,"workCap":2048,"maxGeneratedActions":4,
            "familyCapacity":48,"compositionCapacity":175,"passCapacity":1,"maxStartedPerMaster":1000,
            "masters":[101,102,103,104,105],"checkpointCadence":100,"initialization":"zeros","arithmetic":"float64-cpu",
            "optimizer":"SGD","learningRate":h(0.001),"temperature":h(1.0),"l2":h(0.0001),"clipping":"none",
            "baseline":"per-seed-all-history-eligible-mean","emptyDecision":"diagnostic-only","abortPolicy":"stop-all",
            "primaryMaster":101,"openingRef":reference(&canonical(&opening())),
            "hostLimits":{"startupMs":10000,"planMs":10000,"matchMs":300000,"maxWindows":64,"maxRecordedPlies":128,
                "maxProposals":4096,"maxIpcMessages":2048,"maxProgressBytes":1048576,"maxCompletionBytes":16777216},
            "validation":{"profile":"A","eps":[h(1e-6)],"atol":h(1e-8),"rtol":h(1e-5)}})
    }

    pub struct Fixture {
        pub policy: Vec<u8>, pub economic: Vec<u8>, pub manifest: Vec<u8>, pub pin: Vec<u8>,
        pub estimator: Vec<u8>, pub binding: Vec<u8>, pub authority: Vec<u8>, pub recipe: Vec<u8>,
        pub provenance: Value, pub counters: Vec<u8>, pub blob: Vec<u8>, pub refs: [ByteRef; 8],
    }

    impl Fixture {
        pub fn new() -> Self {
            let blob = b"independently selected audit bytes".to_vec();
            let audit = reference(&blob);
            let manifest_value = manifest();
            let manifest = canonical(&manifest_value);
            let economic = canonical(&json!({"version":"starchess-economic-artifact-v1","status":"FROZEN","opening":opening(),
                "recipe":{"version":"starchess-economic-recipe-v1","supportVersion":"economic-accounting-relaxation-v1",
                    "graphVersion":"positive-headstock-suffix-v1","innovationVersion":"authorized-economic-innovation-v1",
                    "geometryVersion":"authorized-promotion-geometry-v1","calibrationVersion":"starchess-economic-calibration-v1",
                    "workCap":1048576,"materialCeiling":576,"bankCap":12,
                    "bandStarts":[0,1,2,3,4,6,8,12,16,24,32,48,64,96,128,192,256,384,512],"alpha":h(0.5),
                    "minimumGroups":32,"diagnosticHorizons":[1,2,3]},"tables":[],
                "partition":[[0,10,0,64],[11,20,0,64],[21,45,0,64]],"temperatures":[h(1.0),h(1.0),h(1.0)]}));
            let authority = canonical(&json!({"version":"starchess-economic-authority-v1","contractsRef":audit,"r2GeneratorRef":audit,
                "baseRef":audit,"correctiveRef":audit,"r3SeamRef":audit,"r3NativeCorrectionRef":audit,"ownedIngressRef":audit}));
            let estimator = canonical(&json!({"version":"starchess-estimator-provenance-v1","economicArtifactRef":reference(&economic),
                "coreRulesRef":audit,"fittingCodeRef":audit,"collectionRecipeRef":audit,"fittingRecipeRef":audit,
                "collectionRosterRef":audit,"splitRosterRef":audit,"labelBytesRef":audit,"fitJournalRef":audit,"calibrationJournalRef":audit}));
            let pin = canonical(&json!({"version":"starchess-economic-pin-v1","economicArtifactRef":reference(&economic),
                "estimatorProvenanceRef":reference(&estimator),"featureManifestRef":reference(&manifest),"amendmentRef":reference(&authority)}));
            let recipe = canonical(&json!({"version":"starchess-training-recipe-v2","configuration":configuration(),"versions":versions(),"economicPinRef":reference(&pin)}));
            let provenance = json!({"source":audit,"tests":audit,"sourceInventory":audit,"sourcePolicy":audit,"dependencyLock":audit,
                "installedTree":audit,"frozenStore":audit,"toolTree":audit,"image":audit,"runtimeConfiguration":audit,"corpusManifest":audit,
                "corpusSource":audit,"coreRules":audit,"strategicSource":audit,"hostConfiguration":audit,"recipe":reference(&recipe),
                "featureManifest":reference(&manifest),"fixtureManifest":audit,"episodeJournal":audit,"privateProvenanceCodec":null});
            let counter_value = counters(1000, 500);
            let counters = canonical(&counter_value);
            let mut journal = audit.clone();
            journal["lastRecordOrdinal"] = json!(1234);
            let mut weights = vec![h(0.0); 418];
            weights[0] = h(-0.0);
            weights[417] = h(f64::from_bits(1));
            let policy = canonical(&json!({"version":"starchess-training-artifact-v2","status":"VALID","master":101,
                "dimension":418,"featureVersion":"challenge-features-v3","featureNames":manifest_value["names"],
                "manifest":manifest_value,"weights":weights,"versions":versions(),"configuration":configuration(),
                "trainingSummary":{"counters":counter_value,"recipeRef":reference(&recipe),"recipeVersion":"starchess-training-recipe-v2",
                    "curriculumProfile":"A","eligibilityVersion":"starchess-training-eligibility-v1","lastStartedOrdinal":999,
                    "finalBoundaryOrdinal":128,"finalJournalRef":journal,"aborted":false},"provenanceRefs":provenance}));
            let binding = canonical(&json!({"version":"starchess-economic-binding-v1","policyArtifactRef":reference(&policy),
                "economicArtifactRef":reference(&economic),"estimatorProvenanceRef":reference(&estimator),
                "featureManifestRef":reference(&manifest),"amendmentRef":reference(&authority)}));
            let refs = [&policy, &economic, &manifest, &pin, &estimator, &binding, &authority, &recipe].map(|bytes| ByteRef::of_bytes(bytes));
            Self { policy, economic, manifest, pin, estimator, binding, authority, recipe, provenance, counters, blob, refs }
        }

        pub fn bundle(&self) -> ArtifactBundleBytes<'_> {
            ArtifactBundleBytes { policy:&self.policy, economic:&self.economic, manifest:&self.manifest, pin:&self.pin,
                estimator:&self.estimator, binding:&self.binding, authority:&self.authority, recipe:&self.recipe }
        }

        pub fn expected<'a>(&'a self, provenance: &'a ExpectedArtifactBindings) -> ExpectedInferenceBindings<'a> {
            ExpectedInferenceBindings { policy:&self.refs[0],economic:&self.refs[1],manifest:&self.refs[2],pin:&self.refs[3],
                estimator:&self.refs[4],binding:&self.refs[5],authority:&self.refs[6],recipe:&self.refs[7],provenance }
        }

        pub fn provenance_bytes(&self) -> ProvenanceBytes<'_> {
            ProvenanceBytes { source:&self.blob, tests:&self.blob, source_inventory:&self.blob, source_policy:&self.blob,
                dependency_lock:&self.blob, installed_tree:&self.blob, frozen_store:&self.blob, tool_tree:&self.blob,
                image:&self.blob, runtime_configuration:&self.blob, corpus_manifest:&self.blob, corpus_source:&self.blob,
                core_rules:&self.blob, strategic_source:&self.blob, host_configuration:&self.blob, recipe:&self.recipe,
                feature_manifest:&self.manifest, fixture_manifest:&self.blob, episode_journal:&self.blob }
        }

        pub fn evidence(&self) -> InferenceEvidence<'_> {
            InferenceEvidence { provenance:self.provenance_bytes(),
                estimator:EstimatorBytes {core_rules:&self.blob,fitting_code:&self.blob,collection_recipe:&self.blob,
                    fitting_recipe:&self.blob,collection_roster:&self.blob,split_roster:&self.blob,label_bytes:&self.blob,
                    fit_journal:&self.blob,calibration_journal:&self.blob},
                authority:AuthorityBytes {contracts:&self.blob,r2_generator:&self.blob,base:&self.blob,corrective:&self.blob,
                    r3_seam:&self.blob,r3_native_correction:&self.blob,owned_ingress:&self.blob},
                journal:FinalJournalEvidence {master:101,counters_bytes:&self.counters,last_record_ordinal:1234,
                    last_started_ordinal:999,final_boundary_ordinal:128,aborted:false} }
        }

        pub fn rebind_policy(&mut self) {
            self.refs[0] = ByteRef::of_bytes(&self.policy);
            let mut binding: Value = serde_json::from_slice(&self.binding).unwrap();
            binding["policyArtifactRef"] = reference(&self.policy);
            self.binding = canonical(&binding);
            self.refs[5] = ByteRef::of_bytes(&self.binding);
        }

        pub fn rebind_economic(&mut self) {
            let mut estimator: Value = serde_json::from_slice(&self.estimator).unwrap();
            estimator["economicArtifactRef"] = reference(&self.economic);
            self.estimator = canonical(&estimator);
            let mut pin: Value = serde_json::from_slice(&self.pin).unwrap();
            pin["economicArtifactRef"] = reference(&self.economic);
            pin["estimatorProvenanceRef"] = reference(&self.estimator);
            self.pin = canonical(&pin);
            let mut recipe: Value = serde_json::from_slice(&self.recipe).unwrap();
            recipe["economicPinRef"] = reference(&self.pin);
            self.recipe = canonical(&recipe);
            self.provenance["recipe"] = reference(&self.recipe);
            let mut policy: Value = serde_json::from_slice(&self.policy).unwrap();
            policy["provenanceRefs"] = self.provenance.clone();
            policy["trainingSummary"]["recipeRef"] = reference(&self.recipe);
            self.policy = canonical(&policy);
            let mut binding: Value = serde_json::from_slice(&self.binding).unwrap();
            binding["policyArtifactRef"] = reference(&self.policy);
            binding["economicArtifactRef"] = reference(&self.economic);
            binding["estimatorProvenanceRef"] = reference(&self.estimator);
            self.binding = canonical(&binding);
            self.refs = [&self.policy, &self.economic, &self.manifest, &self.pin,
                &self.estimator, &self.binding, &self.authority, &self.recipe].map(|bytes| ByteRef::of_bytes(bytes));
        }
    }
}

#[test]
fn sha256_and_closed_scalars_preserve_binary64_bits() {
    let reference = ByteRef::of_bytes(b"abc");
    assert_eq!(reference.byte_length(), 3);
    assert_eq!(reference.sha256(), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    assert!(ByteRef::new(MAX_SAFE_INTEGER, &"a".repeat(64)).is_ok());
    assert!(ByteRef::new(MAX_SAFE_INTEGER + 1, &"a".repeat(64)).is_err());
    assert!(ByteRef::new(1, &"A".repeat(64)).is_err());
    for hex in ["0000000000000000", "8000000000000000", "0000000000000001", "8000000000000001", "7fefffffffffffff"] {
        let value = Float64Hex::from_hex(hex).unwrap();
        assert_eq!(value.bits(), u64::from_str_radix(hex, 16).unwrap());
        assert_eq!(serde_json::to_value(value).unwrap(), json!({"hex":hex}));
    }
    for hex in ["7ff0000000000000", "fff0000000000000", "7ff8000000000001", "FFF0000000000000", "0"] {
        assert_eq!(Float64Hex::from_hex(hex), Err(ArtifactError::Float));
    }
    for raw in [r#"{"hex":"0000000000000000","extra":0}"#, r#"["0000000000000000"]"#, r#"{}"#] {
        assert!(serde_json::from_str::<Float64Hex>(raw).is_err());
    }
    for raw in [r#"{"byteLength":-0,"sha256":"a"}"#, r#"{"byteLength":1.0,"sha256":"a"}"#, r#"[1,"a"]"#] {
        assert!(serde_json::from_str::<ByteRef>(raw).is_err());
    }
}

#[test]
fn canonical_visitor_rejects_duplicates_and_alternative_lexemes_before_schema() {
    let escaped_duplicate = br#"{"a":1,"\u0061":2}"#;
    assert!(matches!(decode_expected_artifact_bindings(escaped_duplicate), Err(ArtifactError::Canonical)));
    for raw in [r#"{"a":1,"a":2}"#, r#"{"a":{"b":1,"b":2}}"#, r#"{"b":1,"a":2}"#,
        r#"{"a":1.0}"#, r#"{"a":1e0}"#, r#"{"a":-0}"#, r#"{"a":9007199254740992}"#,
        r#"{"a":"\u0061"}"#, r#"{"a":"\/"}"#, "{}\n", " {}", "\u{feff}{}", "{}{}", "{\"a\":NaN}"] {
        assert!(matches!(decode_expected_artifact_bindings(raw.as_bytes()), Err(ArtifactError::Canonical)), "{raw}");
    }
    assert!(matches!(decode_expected_artifact_bindings(&vec![b' '; ARTIFACT_BYTE_CAP + 1]), Err(ArtifactError::Limit)));
    assert!(matches!(decode_expected_artifact_bindings(b"{}"), Err(ArtifactError::Schema)));
}

#[test]
fn diagnostic_bundle_checks_independent_identity_but_cannot_admit_unhydrated_economics() {
    let fixture = fixtures::Fixture::new();
    let expected_provenance = decode_expected_artifact_bindings(&fixtures::canonical(&fixture.provenance)).unwrap();
    let expected = fixture.expected(&expected_provenance);
    let evidence = fixture.evidence();
    let policy = diagnose_policy_artifact(&fixture.policy).unwrap();
    let economic = diagnose_economic_artifact(&fixture.economic).unwrap();
    assert_eq!(policy.byte_ref(), &ByteRef::of_bytes(&fixture.policy));
    assert_eq!(economic.byte_ref(), &ByteRef::of_bytes(&fixture.economic));
    assert!(matches!(accept_inference_artifact(&fixture.bundle(), Some(&expected), Some(&evidence)), Err(ArtifactError::MissingEvidence)));
    assert!(matches!(accept_inference_artifact(&fixture.bundle(), None, Some(&evidence)), Err(ArtifactError::MissingEvidence)));
    assert!(matches!(accept_inference_artifact(&fixture.bundle(), Some(&expected), None), Err(ArtifactError::MissingEvidence)));
    let mut wrong_journal = fixture.evidence();
    wrong_journal.journal.last_record_ordinal += 1;
    assert!(matches!(accept_inference_artifact(&fixture.bundle(), Some(&expected), Some(&wrong_journal)), Err(ArtifactError::Binding)));
    let mut wrong_bytes = fixture.evidence();
    wrong_bytes.provenance.source = b"substituted";
    assert!(matches!(accept_inference_artifact(&fixture.bundle(), Some(&expected), Some(&wrong_bytes)), Err(ArtifactError::Binding)));
}

#[test]
fn internally_consistent_provenance_substitution_does_not_replace_independent_ids() {
    let mut fixture = fixtures::Fixture::new();
    let independently_selected = decode_expected_artifact_bindings(&fixtures::canonical(&fixture.provenance)).unwrap();
    let mut policy: Value = serde_json::from_slice(&fixture.policy).unwrap();
    policy["provenanceRefs"]["source"] = fixtures::reference(b"substituted");
    fixture.policy = fixtures::canonical(&policy);
    fixture.rebind_policy();
    let expected = fixture.expected(&independently_selected);
    let mut evidence = fixture.evidence();
    evidence.provenance.source = b"substituted";
    assert!(matches!(accept_inference_artifact(&fixture.bundle(), Some(&expected), Some(&evidence)), Err(ArtifactError::Binding)));
}

#[test]
fn final_masters_and_signed_integral_baseline_use_the_legacy_domains() {
    for master in 101..=105 {
        let mut fixture = fixtures::Fixture::new();
        let mut policy: Value = serde_json::from_slice(&fixture.policy).unwrap();
        policy["master"] = json!(master);
        policy["trainingSummary"]["counters"]["baselineSum"] = json!(-500);
        fixture.counters = fixtures::canonical(&policy["trainingSummary"]["counters"]);
        fixture.policy = fixtures::canonical(&policy);
        fixture.rebind_policy();
        let selected = decode_expected_artifact_bindings(&fixtures::canonical(&fixture.provenance)).unwrap();
        let expected = fixture.expected(&selected);
        let mut evidence = fixture.evidence();
        evidence.journal.master = master;
        assert!(diagnose_policy_artifact(&fixture.policy).is_ok());
        assert!(matches!(accept_inference_artifact(&fixture.bundle(), Some(&expected), Some(&evidence)), Err(ArtifactError::MissingEvidence)));
    }
}

#[test]
fn registry_and_every_frozen_configuration_field_are_checked() {
    let fixture = fixtures::Fixture::new();
    let policy: Value = serde_json::from_slice(&fixture.policy).unwrap();
    for key in policy["configuration"].as_object().unwrap().keys() {
        let mut changed = policy.clone();
        let field = &mut changed["configuration"][key];
        *field = match field {
            Value::String(_) => json!("unapproved"), Value::Number(_) => json!(999999),
            Value::Array(_) => json!([]), _ => json!({}),
        };
        assert!(diagnose_policy_artifact(&fixtures::canonical(&changed)).is_err(), "{key}");
    }
    for key in policy["versions"].as_object().unwrap().keys() {
        let mut changed = policy.clone();
        changed["versions"][key] = json!("unapproved");
        assert!(diagnose_policy_artifact(&fixtures::canonical(&changed)).is_err(), "{key}");
    }
    for path in ["profiles", "hostLimits", "validation"] {
        for key in policy["configuration"][path].as_object().unwrap().keys() {
            let mut changed = policy.clone();
            changed["configuration"][path].as_object_mut().unwrap().remove(key);
            assert!(diagnose_policy_artifact(&fixtures::canonical(&changed)).is_err(), "{path}.{key}");
        }
    }
    for key in policy["configuration"]["profiles"].as_object().unwrap().keys() {
        let mut changed = policy.clone();
        changed["configuration"]["profiles"][key] = json!("unapproved");
        assert!(diagnose_policy_artifact(&fixtures::canonical(&changed)).is_err(), "profiles.{key}");
    }
    for (key, value) in policy["configuration"]["hostLimits"].as_object().unwrap() {
        let mut changed = policy.clone();
        changed["configuration"]["hostLimits"][key] = json!(value.as_u64().unwrap() + 1);
        assert!(diagnose_policy_artifact(&fixtures::canonical(&changed)).is_err(), "hostLimits.{key}");
    }
    for (key, value) in [("profile",json!("B")), ("eps",json!([fixtures::h(1e-5)])),
        ("atol",fixtures::h(1e-9)), ("rtol",fixtures::h(1e-6))] {
        let mut changed = policy.clone();
        changed["configuration"]["validation"][key] = value;
        assert!(diagnose_policy_artifact(&fixtures::canonical(&changed)).is_err(), "validation.{key}");
    }
    for key in fixtures::manifest()["scales"].as_object().unwrap().keys() {
        let mut changed = fixtures::manifest();
        changed["scales"][key] = json!(changed["scales"][key].as_u64().unwrap() + 1);
        assert!(diagnose_manifest(&fixtures::canonical(&changed)).is_err(), "scales.{key}");
    }
    let mut manifest = fixtures::manifest();
    manifest["entries"][417]["meaningId"] = json!("promo:0:0:1");
    assert!(matches!(diagnose_manifest(&fixtures::canonical(&manifest)), Err(ArtifactError::Manifest)));
    let mut manifest = fixtures::manifest();
    manifest["scales"]["files"] = json!(7);
    assert!(matches!(diagnose_manifest(&fixtures::canonical(&manifest)), Err(ArtifactError::Manifest)));
    let mut manifest = fixtures::manifest();
    manifest["names"].as_array_mut().unwrap().swap(0, 1);
    assert!(diagnose_manifest(&fixtures::canonical(&manifest)).is_err());
    assert!(diagnose_training_recipe(&fixture.recipe).is_ok());
}

#[test]
fn all_economic_bundle_dtos_reject_unknown_fields_even_with_matching_physical_hashes() {
    for index in 0..8 {
        let mut fixture = fixtures::Fixture::new();
        let bytes = match index {
            0 => &mut fixture.policy, 1 => &mut fixture.economic, 2 => &mut fixture.manifest, 3 => &mut fixture.pin,
            4 => &mut fixture.estimator, 5 => &mut fixture.binding, 6 => &mut fixture.authority, _ => &mut fixture.recipe,
        };
        let mut value: Value = serde_json::from_slice(bytes).unwrap();
        value["unapprovedField"] = json!(null);
        *bytes = fixtures::canonical(&value);
        fixture.refs[index] = ByteRef::of_bytes(bytes);
        let selected = decode_expected_artifact_bindings(&fixtures::canonical(&fixture.provenance)).unwrap();
        let expected = fixture.expected(&selected);
        assert!(matches!(accept_inference_artifact(&fixture.bundle(), Some(&expected), Some(&fixture.evidence())),
            Err(ArtifactError::Schema)), "document={index}");
    }
}

#[test]
fn missing_nullable_unknown_fields_bad_counters_and_weight_shapes_fail_closed() {
    let fixture = fixtures::Fixture::new();
    let original: Value = serde_json::from_slice(&fixture.policy).unwrap();
    let mut changed = original.clone();
    changed["provenanceRefs"].as_object_mut().unwrap().remove("privateProvenanceCodec");
    assert!(diagnose_policy_artifact(&fixtures::canonical(&changed)).is_err());
    let mut changed = original.clone();
    changed["provenanceRefs"]["privateProvenanceCodec"] = fixtures::reference(b"codec");
    assert!(diagnose_policy_artifact(&fixtures::canonical(&changed)).is_err());
    for key in ["rng", "futureQueues", "bias", "opponentKvs"] {
        let mut changed = original.clone();
        changed[key] = json!(null);
        assert!(diagnose_policy_artifact(&fixtures::canonical(&changed)).is_err());
    }
    for (key, value) in [("started", json!(999)), ("verifiedCompleted", json!(999)), ("eligibleCompleted", json!(501)),
        ("updates", json!(499)), ("nonzeroPGUpdates", json!(0)), ("nonzeroPGUpdates", json!(501)),
        ("baselineCount", json!(499)), ("baselineSum", json!(-501))] {
        let mut changed = original.clone();
        changed["trainingSummary"]["counters"][key] = value;
        assert!(diagnose_policy_artifact(&fixtures::canonical(&changed)).is_err(), "{key}");
    }
    for length in [0, 370, 417, 419] {
        let mut changed = original.clone();
        changed["weights"] = json!(vec![fixtures::h(0.0); length]);
        assert!(diagnose_policy_artifact(&fixtures::canonical(&changed)).is_err());
    }
    let mut changed = original.clone();
    changed["weights"][0] = json!({"hex":"7ff8000000000000"});
    assert!(diagnose_policy_artifact(&fixtures::canonical(&changed)).is_err());
    let mut changed = original;
    changed["trainingSummary"]["counters"]["baselineSum"] = fixtures::h(0.0);
    assert!(diagnose_policy_artifact(&fixtures::canonical(&changed)).is_err());
}

#[test]
fn economic_rows_use_legacy_tuples_and_required_nullable_cohorts() {
    let fixture = fixtures::Fixture::new();
    let mut economic: Value = serde_json::from_slice(&fixture.economic).unwrap();
    economic["tables"] = json!([
        {"kind":"transition","level":3,"bank":null,"band":null,"tier":null,"groups":1,"rows":[[0,0,0,0,0,fixtures::h(1.0)]]},
        {"kind":"evidence","level":3,"bank":null,"band":null,"tier":null,"groups":1,"rows":[[0,0,0,fixtures::h(1.0)]]}
    ]);
    assert!(diagnose_economic_artifact(&fixtures::canonical(&economic)).is_ok());
    for key in ["bank", "band", "tier"] {
        let mut changed = economic.clone();
        changed["tables"][0].as_object_mut().unwrap().remove(key);
        assert!(diagnose_economic_artifact(&fixtures::canonical(&changed)).is_err());
    }
    for row in [json!([3,1,2,0,0,fixtures::h(1.0)]), json!([1,1,0,1,0,fixtures::h(1.0)]),
        json!([0,0,0,0,577,fixtures::h(1.0)]), json!([0,0,0,0,0,fixtures::h(0.0)])] {
        let mut changed = economic.clone();
        changed["tables"][0]["rows"][0] = row;
        assert!(diagnose_economic_artifact(&fixtures::canonical(&changed)).is_err());
    }
    let mut changed = economic.clone();
    changed["tables"].as_array_mut().unwrap().reverse();
    assert!(diagnose_economic_artifact(&fixtures::canonical(&changed)).is_err());
    let mut changed = economic.clone();
    changed["partition"][1][0] = json!(10);
    assert!(diagnose_economic_artifact(&fixtures::canonical(&changed)).is_err());
    let mut changed = economic;
    changed["temperatures"][0] = fixtures::h(0.2);
    assert!(diagnose_economic_artifact(&fixtures::canonical(&changed)).is_err());
}

#[test]
fn numerical_weights_are_detached_and_do_not_certify_a_final_artifact() {
    let zero = PolicyWeights::zeros();
    assert!(zero.detached_copy().iter().all(|weight| weight.to_bits() == 0));
    let mut vector = [0.0; 418];
    vector[0] = -0.0;
    vector[417] = f64::from_bits(1);
    let weights = PolicyWeights::from_vector(&vector).unwrap();
    vector[0] = 1.0;
    let mut detached = weights.detached_copy();
    assert_eq!(detached[0].to_bits(), (-0.0_f64).to_bits());
    assert_eq!(detached[417].to_bits(), 1);
    detached[0] = 42.0;
    assert_eq!(weights.detached_copy()[0].to_bits(), (-0.0_f64).to_bits());
    vector[417] = f64::INFINITY;
    assert!(matches!(PolicyWeights::from_vector(&vector), Err(ArtifactError::Float)));
}

#[test]
fn initial_canonical_parse_limits_container_cardinality_depth_and_string_bytes() {
    for (count, limit) in [(MAX_JSON_ARRAY_LEN, false), (MAX_JSON_ARRAY_LEN + 1, true)] {
        let bytes = format!("[{}]", vec!["[]"; count].join(","));
        assert!(bytes.len() < ARTIFACT_BYTE_CAP);
        let error = decode_expected_artifact_bindings(bytes.as_bytes()).err().unwrap();
        assert_eq!(error, if limit { ArtifactError::Limit } else { ArtifactError::Schema });
    }
    for (count, limit) in [(MAX_JSON_OBJECT_LEN, false), (MAX_JSON_OBJECT_LEN + 1, true)] {
        let fields = (0..count).map(|index| format!("\"k{index:03}\":0")).collect::<Vec<_>>().join(",");
        let bytes = format!("{{{fields}}}");
        let error = decode_expected_artifact_bindings(bytes.as_bytes()).err().unwrap();
        assert_eq!(error, if limit { ArtifactError::Limit } else { ArtifactError::Schema });
    }
    for (depth, limit) in [(MAX_JSON_DEPTH, false), (MAX_JSON_DEPTH + 1, true)] {
        let bytes = format!("{}0{}", "[".repeat(depth), "]".repeat(depth));
        let error = decode_expected_artifact_bindings(bytes.as_bytes()).err().unwrap();
        assert_eq!(error, if limit { ArtifactError::Limit } else { ArtifactError::Schema });
    }
    for (length, limit) in [(MAX_JSON_STRING_BYTES, false), (MAX_JSON_STRING_BYTES + 1, true)] {
        for bytes in [format!("\"{}\"", "a".repeat(length)), format!("{{\"{}\":0}}", "a".repeat(length))] {
            let error = decode_expected_artifact_bindings(bytes.as_bytes()).err().unwrap();
            assert_eq!(error, if limit { ArtifactError::Limit } else { ArtifactError::Schema });
        }
    }
}

#[test]
fn economic_outcome_rows_are_strictly_lexicographic_without_the_count_coordinate() {
    let fixture = fixtures::Fixture::new();
    let mut economic: Value = serde_json::from_slice(&fixture.economic).unwrap();
    economic["tables"] = json!([
        {"kind":"transition","level":3,"bank":null,"band":null,"tier":null,"groups":1,
            "rows":[[0,0,0,0,2,fixtures::h(0.5)],[0,0,0,0,10,fixtures::h(0.5)]]},
        {"kind":"evidence","level":3,"bank":null,"band":null,"tier":null,"groups":1,
            "rows":[[0,0,2,fixtures::h(0.5)],[0,1,0,fixtures::h(0.5)]]}
    ]);
    assert!(diagnose_economic_artifact(&fixtures::canonical(&economic)).is_ok());
    for index in 0..2 {
        let mut descending = economic.clone();
        descending["tables"][index]["rows"].as_array_mut().unwrap().reverse();
        assert!(matches!(diagnose_economic_artifact(&fixtures::canonical(&descending)), Err(ArtifactError::Schema)));
        for count in [0.5, 1.0] {
            let mut duplicate = economic.clone();
            let mut row = duplicate["tables"][index]["rows"][0].clone();
            let count_index = row.as_array().unwrap().len() - 1;
            row[count_index] = fixtures::h(count);
            duplicate["tables"][index]["rows"][1] = row;
            assert!(matches!(diagnose_economic_artifact(&fixtures::canonical(&duplicate)), Err(ArtifactError::Schema)));
        }
    }
}

#[test]
fn maximum_sparse_row_wire_shape_fits_the_initial_json_budget() {
    let fixture = fixtures::Fixture::new();
    let mut economic: Value = serde_json::from_slice(&fixture.economic).unwrap();
    let mut rows = Vec::with_capacity(8192);
    'outcomes: for growth in (0_u32..=28).step_by(2).chain(std::iter::once(32)) {
        for destroyed in 0..=576 + growth {
            rows.push(json!([0,0,0,growth,destroyed,fixtures::h(1.0)]));
            if rows.len() == 8192 { break 'outcomes; }
        }
    }
    assert_eq!(rows.len(), 8192);
    economic["tables"] = json!([{"kind":"transition","level":3,"bank":null,"band":null,"tier":null,
        "groups":8192,"rows":rows}]);
    let bytes = fixtures::canonical(&economic);
    assert!(bytes.len() < ARTIFACT_BYTE_CAP);
    assert!(diagnose_economic_artifact(&bytes).is_ok());
}

#[test]
fn empty_incomplete_and_full_sized_diagnostic_cohorts_never_certify_fitted_inference() {
    let mut cohorts = Vec::with_capacity(794);
    for bank in 0..13 {
        for band in 0..19 {
            for tier in 0..3 { cohorts.push((0, Some(bank), Some(band), Some(tier))); }
        }
    }
    for bank in 0..13 {
        for tier in 0..3 { cohorts.push((1, Some(bank), None, Some(tier))); }
    }
    for bank in 0..13 { cohorts.push((2, Some(bank), None, None)); }
    cohorts.push((3, None, None, None));
    assert_eq!(cohorts.len(), 794);
    let mut full_sized = Vec::with_capacity(1588);
    for kind in ["transition", "evidence"] {
        for &(level, bank, band, tier) in &cohorts {
            full_sized.push(json!({"kind":kind,"level":level,"bank":bank,"band":band,"tier":tier,"groups":0,"rows":[]}));
        }
    }
    let transition = json!({"kind":"transition","level":3,"bank":null,"band":null,"tier":null,"groups":32,
        "rows":[[0,0,0,0,0,fixtures::h(32.0)]]});
    let evidence = json!({"kind":"evidence","level":3,"bank":null,"band":null,"tier":null,"groups":32,
        "rows":[[0,0,0,fixtures::h(32.0)]]});
    let all_empty = json!(full_sized);
    full_sized[793] = transition.clone();
    full_sized[1587] = evidence.clone();
    for tables in [json!([]), json!([transition.clone()]), json!([transition,evidence]), all_empty, json!(full_sized)] {
        let mut fixture = fixtures::Fixture::new();
        let mut economic: Value = serde_json::from_slice(&fixture.economic).unwrap();
        economic["tables"] = tables;
        fixture.economic = fixtures::canonical(&economic);
        assert!(diagnose_economic_artifact(&fixture.economic).is_ok());
        fixture.rebind_economic();
        let selected = decode_expected_artifact_bindings(&fixtures::canonical(&fixture.provenance)).unwrap();
        let expected = fixture.expected(&selected);
        assert!(matches!(accept_inference_artifact(&fixture.bundle(), Some(&expected), Some(&fixture.evidence())),
            Err(ArtifactError::MissingEvidence)));
    }
}

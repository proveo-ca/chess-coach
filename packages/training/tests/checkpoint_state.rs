// SPEC: _spec/packages/training/artifact-lifecycle.puml
#[path = "strict_artifacts.rs"]
mod artifact_cases;

use artifact_cases::fixtures::{self, Fixture, canonical, counters, reference};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use training_native::artifact_bytes::{
    ARTIFACT_BYTE_CAP, ArtifactError, ByteRef, CHECKPOINT_BYTE_CAP, MAX_SAFE_INTEGER,
    MAX_JSON_ARRAY_LEN, MAX_JSON_NODES,
};
use training_native::artifacts::{decode_expected_artifact_bindings, diagnose_policy_artifact};
use training_native::checkpoint::{
    CheckpointCommitEvidence, EpisodeStreamLabel, derive_episode_root, diagnose_checkpoint, validate_checkpoint,
};

fn independent_root(master: u32, label: &str) -> u32 {
    let text = serde_json::to_vec(&json!(["starchess-training-rng-v1", master, label])).unwrap();
    let digest = Sha256::digest(&text);
    u32::from_be_bytes(digest[..4].try_into().unwrap())
}

fn independent_stream(master: u32, label: &str, count: u64, unused: bool) -> Value {
    let root = independent_root(master, label);
    let state = ((u128::from(root) + 0x6d2b79f5_u128 * u128::from(count)) & 0xffffffff) as u32;
    json!({"status":if unused { "unused" } else { "active" },"root":root,"state":state,"drawCount":count})
}

fn independent_selection(master: u32, corpus_started: u32) -> (Vec<u32>, u64) {
    let root = independent_root(master, "selection");
    let mut permutation = Vec::new();
    let mut count = 0_u64;
    for _ in 0..=(corpus_started - 1) / 18 {
        permutation = (0..18).collect();
        for index in (1..18).rev() {
            count += 1;
            let state = ((u128::from(root) + 0x6d2b79f5_u128 * u128::from(count)) & 0xffffffff) as u32;
            let mut t = (state ^ (state >> 15)).wrapping_mul(state | 1);
            t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
            let output = t ^ (t >> 14);
            let selected = ((u64::from(output) * (index + 1) as u64) >> 32) as usize;
            permutation.swap(index, selected);
        }
    }
    (permutation, count)
}

fn checkpoint(fixture: &Fixture, started: u32, master: u32) -> Value {
    let corpus_started = started.div_ceil(2);
    let (permutation, selection_count) = independent_selection(master, corpus_started);
    let mut journal = reference(&fixture.blob);
    journal["lastRecordOrdinal"] = json!(1234);
    json!({"version":"starchess-training-checkpoint-v2","status":"diagnostic","master":master,"actualEpoch":started,
        "counters":counters(started, started / 2),"weights":vec![fixtures::h(0.0);418],
        "orderedFeatureNames":fixtures::manifest()["names"],"manifestHash":reference(&fixture.manifest),
        "versions":fixtures::versions(),"config":fixtures::configuration(),
        "rng":{"selection":independent_stream(master,"selection",selection_count,false),
            "environment-settlement":independent_stream(master,"environment-settlement",0,true),
            "policy-sampling":independent_stream(master,"policy-sampling",123,false),
            "opponent":independent_stream(master,"opponent",456,false),
            "generator":{"status":"unused","root":null,"state":null,"drawCount":0}},
        "hostControl":{"corpusPermutation":permutation,"corpusCursor":(corpus_started-1)%18+1,
            "corpusEpoch":(corpus_started-1)/18,"scheduleCursor":started,"liveOrdinal":started-corpus_started,
            "dueBucket":started/100,"fulfilledBucket":started/100},
        "journalRef":journal,"authorizedHistoryRefs":[reference(b"public history")],"nextModelHistory":null,
        "provenanceRefs":fixture.provenance})
}

#[test]
fn derived_roots_match_sha256_of_exact_legacy_json_for_all_twenty_streams() {
    let labels = [(EpisodeStreamLabel::Selection,"selection"), (EpisodeStreamLabel::EnvironmentSettlement,"environment-settlement"),
        (EpisodeStreamLabel::PolicySampling,"policy-sampling"), (EpisodeStreamLabel::Opponent,"opponent")];
    let mut roots = Vec::new();
    for master in 101..=105 {
        for &(label, text) in &labels {
            let root = derive_episode_root(master, label).unwrap();
            assert_eq!(root, independent_root(master, text));
            assert!(!roots.contains(&root));
            roots.push(root);
        }
    }
    assert_eq!(roots.len(), 20);
    assert_eq!(derive_episode_root(106, EpisodeStreamLabel::Selection), Err(ArtifactError::Rng));
}

#[test]
fn selection_control_reconstructs_delayed_boundaries_and_epoch_transitions() {
    let fixture = Fixture::new();
    for master in 101..=105 {
        for started in [100, 101, 107, 108, 109, 144, 145, 999, 1000] {
            let value = checkpoint(&fixture, started, master);
            assert!(diagnose_checkpoint(&canonical(&value)).is_ok(), "master={master},started={started}");
        }
    }
    let value = checkpoint(&fixture, 1000, 101);
    assert_eq!(value["rng"]["selection"]["drawCount"], json!(476));
    assert_eq!(value["hostControl"]["corpusCursor"], json!(14));
    assert_eq!(value["hostControl"]["corpusEpoch"], json!(27));
}

#[test]
fn checkpoint_reload_retains_original_bytes_bits_and_staged_bucket_without_publication() {
    let fixture = Fixture::new();
    let mut value = checkpoint(&fixture, 101, 101);
    value["weights"][0] = fixtures::h(-0.0);
    value["weights"][417] = fixtures::h(f64::from_bits(1));
    let bytes = canonical(&value);
    let expected_ref = ByteRef::of_bytes(&bytes);
    let expected = decode_expected_artifact_bindings(&canonical(&fixture.provenance)).unwrap();
    let counter_bytes = canonical(&value["counters"]);
    let mut committed_weights = [0.0; 418];
    committed_weights[0] = -0.0;
    committed_weights[417] = f64::from_bits(1);
    let histories: [&[u8]; 1] = [b"public history"];
    let evidence = CheckpointCommitEvidence {
        expected_byte_ref:&expected_ref,expected_bindings:&expected,provenance:fixture.provenance_bytes(),master:101,
        counters_bytes:&counter_bytes,committed_weights:&committed_weights,journal_last_record_ordinal:1234,
        accepted_candidate_records:123,checked_opponent_draws:456,last_completed_eligible:true,
        previous_fulfilled_bucket:0,authorized_history_bytes:&histories,
    };
    let validated = validate_checkpoint(&bytes, Some(&evidence)).unwrap();
    assert_eq!(validated.byte_ref(), &expected_ref);
    assert_eq!(validated.canonical_bytes(), bytes);
    assert_eq!(validated.staged_fulfilled_bucket(), 1);
    assert_eq!(validated.diagnostic_weights()[0].to_bits(), (-0.0_f64).to_bits());
    assert_eq!(validated.diagnostic_weights()[417].to_bits(), 1);
    let mut detached = validated.canonical_bytes();
    detached[0] = b'[';
    assert_eq!(validated.canonical_bytes(), bytes);
    assert!(matches!(validate_checkpoint(&bytes, None), Err(ArtifactError::MissingEvidence)));
    assert!(diagnose_policy_artifact(&bytes).is_err());
}

#[test]
fn independent_commit_and_ack_evidence_cannot_be_replaced_by_self_consistent_checkpoint_metadata() {
    let fixture = Fixture::new();
    let value = checkpoint(&fixture, 100, 101);
    let bytes = canonical(&value);
    let expected_ref = ByteRef::of_bytes(&bytes);
    let expected = decode_expected_artifact_bindings(&canonical(&fixture.provenance)).unwrap();
    let counter_bytes = canonical(&value["counters"]);
    let weights = [0.0; 418];
    let histories: [&[u8]; 1] = [b"public history"];
    let make_evidence = || CheckpointCommitEvidence {
        expected_byte_ref:&expected_ref,expected_bindings:&expected,provenance:fixture.provenance_bytes(),master:101,
        counters_bytes:&counter_bytes,committed_weights:&weights,journal_last_record_ordinal:1234,
        accepted_candidate_records:123,checked_opponent_draws:456,last_completed_eligible:true,
        previous_fulfilled_bucket:0,authorized_history_bytes:&histories,
    };
    assert!(validate_checkpoint(&bytes, Some(&make_evidence())).is_ok());
    let mut evidence = make_evidence();
    evidence.accepted_candidate_records += 1;
    assert!(matches!(validate_checkpoint(&bytes, Some(&evidence)), Err(ArtifactError::Rng)));
    let mut evidence = make_evidence();
    evidence.checked_opponent_draws -= 1;
    assert!(matches!(validate_checkpoint(&bytes, Some(&evidence)), Err(ArtifactError::Rng)));
    let mut evidence = make_evidence();
    evidence.journal_last_record_ordinal += 1;
    assert!(matches!(validate_checkpoint(&bytes, Some(&evidence)), Err(ArtifactError::Binding)));
    let mut evidence = make_evidence();
    evidence.last_completed_eligible = false;
    assert!(matches!(validate_checkpoint(&bytes, Some(&evidence)), Err(ArtifactError::Counters)));
    let mut evidence = make_evidence();
    evidence.previous_fulfilled_bucket = 1;
    assert!(matches!(validate_checkpoint(&bytes, Some(&evidence)), Err(ArtifactError::Counters)));
    let mut evidence = make_evidence();
    evidence.master = 102;
    assert!(matches!(validate_checkpoint(&bytes, Some(&evidence)), Err(ArtifactError::Binding)));
    let wrong_history: [&[u8]; 1] = [b"other history"];
    let mut evidence = make_evidence();
    evidence.authorized_history_bytes = &wrong_history;
    assert!(matches!(validate_checkpoint(&bytes, Some(&evidence)), Err(ArtifactError::Binding)));
    let mut wrong_weights = weights;
    wrong_weights[0] = -0.0;
    let mut evidence = make_evidence();
    evidence.committed_weights = &wrong_weights;
    assert!(matches!(validate_checkpoint(&bytes, Some(&evidence)), Err(ArtifactError::Binding)));
}

#[test]
fn closed_checkpoint_schema_requires_explicit_null_and_exact_stream_records() {
    let fixture = Fixture::new();
    let value = checkpoint(&fixture, 100, 101);
    let mut changed = value.clone();
    changed.as_object_mut().unwrap().remove("nextModelHistory");
    assert!(diagnose_checkpoint(&canonical(&changed)).is_err());
    let mut changed = value.clone();
    changed["nextModelHistory"] = json!({});
    assert!(diagnose_checkpoint(&canonical(&changed)).is_err());
    for key in ["root", "state", "drawCount", "status"] {
        let mut changed = value.clone();
        changed["rng"]["generator"].as_object_mut().unwrap().remove(key);
        assert!(diagnose_checkpoint(&canonical(&changed)).is_err());
    }
    for stream in ["selection", "environment-settlement", "policy-sampling", "opponent"] {
        for key in ["root", "state", "drawCount", "status"] {
            let mut changed = value.clone();
            changed["rng"][stream].as_object_mut().unwrap().remove(key);
            assert!(diagnose_checkpoint(&canonical(&changed)).is_err());
        }
        let mut changed = value.clone();
        changed["rng"][stream]["extra"] = json!(0);
        assert!(diagnose_checkpoint(&canonical(&changed)).is_err());
    }
    for key in ["privateScfen", "resumeToken", "economicArtifact", "trainingSummary"] {
        let mut changed = value.clone();
        changed[key] = json!(null);
        assert!(diagnose_checkpoint(&canonical(&changed)).is_err());
    }
    let mut changed = value.clone();
    changed["authorizedHistoryRefs"] = json!(vec![reference(b"history");1001]);
    assert!(diagnose_checkpoint(&canonical(&changed)).is_err());
    let mut changed = value;
    changed["rng"]["generator"]["root"] = json!(0);
    assert!(diagnose_checkpoint(&canonical(&changed)).is_err());
    assert!(matches!(diagnose_checkpoint(&vec![b' ';CHECKPOINT_BYTE_CAP+1]), Err(ArtifactError::Limit)));
}

#[test]
fn rng_state_checks_use_modulo_uint32_even_at_max_safe_draw_count() {
    let fixture = Fixture::new();
    let mut value = checkpoint(&fixture, 100, 105);
    value["rng"]["policy-sampling"] = independent_stream(105, "policy-sampling", MAX_SAFE_INTEGER, false);
    value["rng"]["opponent"] = independent_stream(105, "opponent", MAX_SAFE_INTEGER - 1, false);
    assert!(diagnose_checkpoint(&canonical(&value)).is_ok());
    let mut changed = value.clone();
    changed["rng"]["opponent"]["state"] = json!(value["rng"]["opponent"]["state"].as_u64().unwrap() ^ 1);
    assert!(matches!(diagnose_checkpoint(&canonical(&changed)), Err(ArtifactError::Rng)));
    let mut changed = value.clone();
    changed["rng"]["policy-sampling"]["drawCount"] = json!(MAX_SAFE_INTEGER + 1);
    assert!(diagnose_checkpoint(&canonical(&changed)).is_err());
    let mut changed = value;
    changed["rng"]["environment-settlement"] = independent_stream(105, "environment-settlement", 1, true);
    assert!(matches!(diagnose_checkpoint(&canonical(&changed)), Err(ArtifactError::Rng)));
}

#[test]
fn selection_and_save_control_cannot_erase_consumed_slots_or_advance_publication() {
    let fixture = Fixture::new();
    let value = checkpoint(&fixture, 101, 101);
    for (key, replacement) in [("corpusCursor",json!(0)), ("corpusEpoch",json!(0)), ("scheduleCursor",json!(100)),
        ("liveOrdinal",json!(49)), ("dueBucket",json!(2)), ("fulfilledBucket",json!(0))] {
        let mut changed = value.clone();
        changed["hostControl"][key] = replacement;
        assert!(diagnose_checkpoint(&canonical(&changed)).is_err(), "{key}");
    }
    let mut changed = value.clone();
    changed["hostControl"]["corpusPermutation"].as_array_mut().unwrap().swap(0, 1);
    assert!(diagnose_checkpoint(&canonical(&changed)).is_err());
    let mut changed = value.clone();
    changed["counters"]["verifiedCompleted"] = json!(100);
    assert!(diagnose_checkpoint(&canonical(&changed)).is_err());
    let mut changed = value.clone();
    changed["rng"]["selection"]["drawCount"] = json!(52);
    assert!(diagnose_checkpoint(&canonical(&changed)).is_err());
    assert!(diagnose_checkpoint(&canonical(&checkpoint(&fixture, 99, 101))).is_err());
}

#[test]
fn initial_checkpoint_parse_shares_one_node_budget_across_sibling_arrays() {
    let group = format!("[{}]", vec!["0"; MAX_JSON_ARRAY_LEN].join(","));
    let group_count = MAX_JSON_NODES / MAX_JSON_ARRAY_LEN + 1;
    assert!(group_count < MAX_JSON_ARRAY_LEN);
    let bytes = format!("[{}]", vec![group; group_count].join(","));
    assert!(bytes.len() < ARTIFACT_BYTE_CAP);
    assert!(bytes.len() < CHECKPOINT_BYTE_CAP);
    for _ in 0..2 {
        assert!(matches!(diagnose_checkpoint(bytes.as_bytes()), Err(ArtifactError::Limit)));
        assert!(matches!(decode_expected_artifact_bindings(bytes.as_bytes()), Err(ArtifactError::Limit)));
        let fixture = Fixture::new();
        assert!(diagnose_checkpoint(&canonical(&checkpoint(&fixture, 100, 101))).is_ok());
    }
}

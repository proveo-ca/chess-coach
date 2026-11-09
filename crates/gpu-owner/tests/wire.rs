// SPEC: _spec/gpu-owner.md
use chess_coach_gpu_owner::{
    input::OwnerInput,
    json,
    wire::{self, AttemptInput, Receiver},
};
use serde_json::{Value, json};

struct Fixture {
    input: OwnerInput,
    embedded: AttemptInput,
    proposal: Value,
    descriptor: String,
}
fn root(label: &str) -> u32 {
    u32::from_str_radix(
        &json::sha256(format!("[\"starchess-training-rng-v1\",101,\"{label}\"]").as_bytes())[..8],
        16,
    )
    .unwrap()
}
fn stream(label: &str, draws: u64) -> Value {
    let root = root(label);
    let state = ((u128::from(root) + u128::from(draws) * 0x6d2b79f5) & 0xffff_ffff) as u32;
    json!({"status":if label=="environment-settlement"{"unused"}else{"active"},"root":root,"state":state,"drawCount":draws})
}
fn permutation() -> Vec<u32> {
    let mut state = root("selection");
    let mut p: Vec<u32> = (0..18).collect();
    for i in (1..18).rev() {
        state = state.wrapping_add(0x6d2b79f5);
        let mut t = state;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        let n = t ^ (t >> 14);
        let j = ((u64::from(n) * (i as u64 + 1)) >> 32) as usize;
        p.swap(i, j);
    }
    p
}
fn fixture() -> Fixture {
    let model = json::sha256(b"fixture-model");
    let reference = json!({"byteLength":1,"sha256":"0".repeat(64)});
    let mut bindings = json!({});
    for name in [
        "source",
        "tests",
        "closure",
        "dependencyLock",
        "image",
        "runtimeConfiguration",
        "coreRules",
        "strategicSource",
        "corpusManifest",
        "corpusSource",
        "recipe",
        "featureLayout",
        "fixtureManifest",
        "hostConfiguration",
    ] {
        bindings[name] = reference.clone();
    }
    let p = permutation();
    let descriptor = json!({"version":"chess-coach.attempt.v1","attemptId":"attempt","master":101,"startedOrdinal":0,"modelId":model,"frozenBaseline":0,"schedule":{"kind":"corpus","corpusIndex":p[0],"candidateSide":"b"}});
    let descriptor = serde_json::to_string(&descriptor).unwrap();
    let descriptor_sha = json::sha256(descriptor.as_bytes());
    let proposal = json!({"version":"chess-coach.gpu-attempt-proposal.v1","descriptor":serde_json::from_str::<Value>(&descriptor).unwrap(),"initialModelId":model,
        "state":{"version":"chess-coach.training-state.v1","master":101,"initializationSeed":101,"modelId":model,
            "counters":{"started":1,"verifiedCompleted":1,"eligibleCompleted":0,"updates":0,"nonzeroPGUpdates":0,"baselineCount":0,"baselineSum":0},
            "rng":{"selection":stream("selection",17),"environment-settlement":stream("environment-settlement",0),"policy-sampling":stream("policy-sampling",0),"opponent":stream("opponent",0),
                "generator":{"status":"unused","root":null,"state":null,"drawCount":0}},
            "control":{"corpusPermutation":p,"corpusCursor":1,"corpusEpoch":0,"scheduleCursor":1,"liveOrdinal":0,"dueBucket":0,"fulfilledBucket":0},
            "journalRef":{"byteLength":1,"sha256":"0".repeat(64),"lastRecordOrdinal":1},"historyRefs":[reference],"bindings":bindings}});
    let embedded = json!({"version":"chess-coach.gpu-attempt-input.v1","bindings":bindings,"modelConfig":{"version":"chess-coach.model-config.v1","architecture":"mlp-relu-32","featureVersion":"chess-coach.features.v1","inputFeatures":2271,"hiddenUnits":32,"recordSha256":model},
        "recordRef":{"byteLength":1,"sha256":model},"initialStateSha256":"0".repeat(64),"expectedDescriptorSha256":descriptor_sha,"initialModelId":model});
    let input_json = serde_json::to_string(&embedded).unwrap();
    let file = json!({"path":"/fixture/file","byteLength":0,"sha256":"0".repeat(64)});
    let input:OwnerInput=serde_json::from_str(&serde_json::to_string(&json!({"version":"chess-coach.gpu-owner.v1","ownership":{"sessionId":"session","attemptId":"attempt","containerName":"container","ownershipToken":"0".repeat(32)},
        "outsideControl":{"admissionReceipt":file,"expectedSelfEnvelope":{"cpus":[0],"cpuQuota":100000,"memoryMaxBytes":"1","aggregateParent":"/fixture/cg/aggregate","aggregateCpus":[0,1,2,3,4],"aggregateCpuQuota":500000,"aggregateMemoryMaxBytes":"24000000000"}},
        "docker":{"executable":file,"anonymousConfigDirectory":"/fixture/config","endpointUnixSocket":"/fixture/socket","cgroupParentArgument":"fixture.slice"},
        "observation":{"procRoot":"/fixture/proc","cgroupRoot":"/fixture/cg","approvedJobParentAbsolutePath":"/fixture/cg/aggregate/jobs","expectedOutsideControlCgroupAbsolutePath":"/fixture/cg/aggregate/control"},
        "job":{"imageId":format!("sha256:{}","0".repeat(64)),"runtimeClosure":file,"gpuProfile":{"mode":"legacy-nvidia-device-request.v1","cpus":[1,2,3,4],"injectionInventory":file},"stateHostSource":"/fixture/state","jobInputJson":input_json,
            "jobInputRef":{"byteLength":input_json.len(),"sha256":json::sha256(input_json.as_bytes())},"expectedDescriptorSha256":descriptor_sha,"initialModelId":model},
        "cooperative":{"selectedUuid":"GPU-12345678-1234-1234-1234-123456789abc","startupMinFreeBytes":"1000","runningStopBelowFreeBytes":"500","samplePeriodNs":"1000","maxSampleAgeNs":"2000"},
        "telemetry":{"kind":"registered-nvidia-smi-query.v1","executable":file,"runtimeClosure":file,"expectedDriver":"fixture","queryBudgetNs":"100","refreshIntervalNs":"100","schedulingReserveNs":"100"},"evidence":{"exclusivePacketRoot":"/fixture/evidence"}})).unwrap()).unwrap();
    let embedded = AttemptInput::parse(&input).unwrap();
    Fixture {
        input,
        embedded,
        proposal,
        descriptor,
    }
}
fn check(f: &Fixture, text: &str) -> chess_coach_gpu_owner::Result<()> {
    wire::validate_proposal(
        text,
        &json::sha256(text.as_bytes()),
        &f.input.job.expected_descriptor_sha256,
        &f.input,
        &f.embedded,
    )
}
fn frame(value: Value) -> Vec<u8> {
    let mut bytes = serde_json::to_vec(&value).unwrap();
    bytes.push(b'\n');
    bytes
}
fn boot() -> Vec<u8> {
    frame(json!({"version":wire::VERSION,"sessionId":"session","kind":"boot"}))
}
fn startup(f: &Fixture) -> Vec<u8> {
    frame(
        json!({"version":wire::VERSION,"sessionId":"session","kind":"startup","attemptId":"attempt","inputSha256":f.input.job.job_input_ref.sha256,"descriptorSha256":f.input.job.expected_descriptor_sha256,"initialModelId":f.input.job.initial_model_id}),
    )
}

#[test]
fn exact_original_descriptor_token_excludes_only_outer_whitespace() {
    let f = fixture();
    let text = serde_json::to_string(&f.proposal).unwrap();
    check(&f, &text).unwrap();
    check(&f, &format!(" \n{text}\t")).unwrap();
    check(
        &f,
        &text.replace("\"descriptor\":", "\"\\u0064escriptor\" : \n"),
    )
    .unwrap();
    let pretty = serde_json::to_string_pretty(&f.proposal["descriptor"]).unwrap();
    let changed = text.replacen(&f.descriptor, &pretty, 1);
    assert!(check(&f, &changed).is_err());
    let mut input = f.input.clone();
    input.job.expected_descriptor_sha256 = json::sha256(pretty.as_bytes());
    wire::validate_proposal(
        &changed,
        &json::sha256(changed.as_bytes()),
        &input.job.expected_descriptor_sha256,
        &input,
        &f.embedded,
    )
    .unwrap();
    let escaped = f.descriptor.replace("\"master\"", "\"\\u006daster\"");
    assert!(check(&f, &text.replacen(&f.descriptor, &escaped, 1)).is_err());
}

#[test]
fn duplicate_decoded_keys_reject_before_raw_token_acceptance() {
    let f = fixture();
    let text = serde_json::to_string(&f.proposal).unwrap();
    let duplicate = text.replace(
        "\"descriptor\":",
        &format!("\"\\u0064escriptor\":{},\"descriptor\":", f.descriptor),
    );
    assert!(check(&f, &duplicate).is_err());
    let duplicate = text.replace("\"master\":101", "\"master\":101,\"\\u006daster\":101");
    assert!(check(&f, &duplicate).is_err());
    assert!(
        wire::validate_proposal(
            &text,
            &"0".repeat(64),
            &f.input.job.expected_descriptor_sha256,
            &f.input,
            &f.embedded
        )
        .is_err()
    );
}

#[test]
fn rejects_complete_state_and_first_attempt_contradictions() {
    let f = fixture();
    check(&f, &serde_json::to_string(&f.proposal).unwrap()).unwrap();
    let mutations = vec![
        ("/version", json!("wrong")),
        ("/initialModelId", json!("1".repeat(64))),
        ("/descriptor/version", json!("wrong")),
        ("/descriptor/attemptId", json!("other")),
        ("/descriptor/master", json!(102)),
        ("/descriptor/startedOrdinal", json!(1)),
        ("/descriptor/modelId", json!("1".repeat(64))),
        ("/descriptor/frozenBaseline", json!(2)),
        ("/descriptor/schedule/kind", json!("live")),
        ("/descriptor/schedule/candidateSide", json!("w")),
        ("/descriptor/schedule/corpusIndex", json!(99)),
        ("/state/version", json!("wrong")),
        ("/state/master", json!(102)),
        ("/state/initializationSeed", json!(102)),
        ("/state/modelId", json!("bad")),
        ("/state/counters/started", json!(0)),
        ("/state/counters/started", json!(1001)),
        ("/state/counters/verifiedCompleted", json!(0)),
        ("/state/counters/verifiedCompleted", json!(2)),
        ("/state/counters/eligibleCompleted", json!(1)),
        ("/state/counters/updates", json!(1)),
        ("/state/counters/nonzeroPGUpdates", json!(1)),
        ("/state/counters/baselineCount", json!(1)),
        ("/state/counters/baselineSum", json!(1)),
        ("/state/bindings/source/byteLength", json!(-1)),
        ("/state/control/corpusCursor", json!(19)),
        ("/state/control/corpusEpoch", json!(1000)),
        ("/state/control/scheduleCursor", json!(0)),
        ("/state/control/liveOrdinal", json!(1)),
        ("/state/control/dueBucket", json!(1)),
        ("/state/control/fulfilledBucket", json!(1)),
        ("/state/control/corpusPermutation", json!(vec![0; 18])),
        ("/state/control/corpusPermutation", json!([0, 1])),
        ("/state/rng/selection/status", json!("unused")),
        ("/state/rng/selection/root", json!(0)),
        ("/state/rng/selection/state", json!(0)),
        ("/state/rng/selection/drawCount", json!(16)),
        ("/state/rng/environment-settlement/status", json!("active")),
        ("/state/rng/environment-settlement/root", json!(0)),
        ("/state/rng/environment-settlement/state", json!(0)),
        ("/state/rng/environment-settlement/drawCount", json!(1)),
        ("/state/rng/policy-sampling/status", json!("unused")),
        ("/state/rng/policy-sampling/root", json!(0)),
        ("/state/rng/policy-sampling/state", json!(0)),
        ("/state/rng/policy-sampling/drawCount", json!(1)),
        ("/state/rng/opponent/status", json!("unused")),
        ("/state/rng/opponent/root", json!(0)),
        ("/state/rng/opponent/state", json!(0)),
        ("/state/rng/opponent/drawCount", json!(1)),
        ("/state/rng/generator/status", json!("active")),
        ("/state/rng/generator/root", json!(0)),
        ("/state/rng/generator/state", json!(0)),
        ("/state/rng/generator/drawCount", json!(1)),
        ("/state/journalRef", json!(false)),
        ("/state/journalRef/byteLength", json!(-1)),
        ("/state/journalRef/lastRecordOrdinal", json!(-1)),
        ("/state/journalRef/sha256", json!("bad")),
        ("/state/historyRefs", json!([])),
        ("/state/historyRefs/0/byteLength", json!(-1)),
        ("/state/historyRefs/0/sha256", json!("bad")),
        ("/state/bindings/source/sha256", json!("1".repeat(64))),
    ];
    assert_eq!(mutations.len(), 61);
    for (index, (pointer, value)) in mutations.into_iter().enumerate() {
        let mut candidate = f.proposal.clone();
        *candidate.pointer_mut(pointer).unwrap() = value;
        let text = serde_json::to_string(&candidate).unwrap();
        let mut input = f.input.clone();
        input.job.expected_descriptor_sha256 = json::sha256(
            serde_json::to_string(&candidate["descriptor"])
                .unwrap()
                .as_bytes(),
        );
        assert!(
            wire::validate_proposal(
                &text,
                &json::sha256(text.as_bytes()),
                &input.job.expected_descriptor_sha256,
                &input,
                &f.embedded
            )
            .is_err(),
            "mutation {index}: {pointer}"
        );
    }
}

#[test]
fn nested_fields_are_closed_and_nullable_fields_are_required() {
    let f = fixture();
    for pointer in [
        "",
        "/descriptor",
        "/descriptor/schedule",
        "/state",
        "/state/counters",
        "/state/control",
        "/state/rng",
        "/state/rng/selection",
        "/state/rng/generator",
        "/state/journalRef",
        "/state/historyRefs/0",
        "/state/bindings",
        "/state/bindings/source",
    ] {
        let mut candidate = f.proposal.clone();
        candidate
            .pointer_mut(pointer)
            .unwrap()
            .as_object_mut()
            .unwrap()
            .insert("unexpected".into(), json!(0));
        assert!(
            check(&f, &serde_json::to_string(&candidate).unwrap()).is_err(),
            "{pointer}"
        );
    }
    for (pointer, key) in [
        ("/state", "journalRef"),
        ("/state/rng/generator", "root"),
        ("/state/rng/generator", "state"),
    ] {
        let mut candidate = f.proposal.clone();
        candidate
            .pointer_mut(pointer)
            .unwrap()
            .as_object_mut()
            .unwrap()
            .remove(key);
        assert!(
            check(&f, &serde_json::to_string(&candidate).unwrap()).is_err(),
            "{pointer}/{key}"
        );
    }
}

#[test]
fn receiver_checks_structural_rng_prefixes_without_replaying_curriculum() {
    let f = fixture();
    let mut value = f.proposal.clone();
    value["state"]["control"]["corpusCursor"] = json!(0);
    value["state"]["control"]["corpusEpoch"] = json!(999);
    value["state"]["control"]["corpusPermutation"] = json!((0..18).collect::<Vec<u32>>());
    value["state"]["journalRef"] = Value::Null;
    value["state"]["historyRefs"][0]["byteLength"] = json!(0);
    for label in ["selection", "policy-sampling", "opponent"] {
        let count = 9_007_199_254_740_991u64;
        let root = 7u32;
        let state = ((u128::from(root) + u128::from(count) * 0x6d2b79f5) & 0xffff_ffff) as u32;
        value["state"]["rng"][label] =
            json!({"status":"active","root":root,"state":state,"drawCount":count});
    }
    value["descriptor"]["frozenBaseline"] = json!(0.5);
    value["descriptor"]["schedule"]["corpusIndex"] = json!(17);
    let mut input = f.input.clone();
    input.job.expected_descriptor_sha256 = json::sha256(
        serde_json::to_string(&value["descriptor"])
            .unwrap()
            .as_bytes(),
    );
    let text = serde_json::to_string(&value).unwrap();
    wire::validate_proposal(
        &text,
        &json::sha256(text.as_bytes()),
        &input.job.expected_descriptor_sha256,
        &input,
        &f.embedded,
    )
    .unwrap();
}

#[test]
fn startup_requires_completed_write_and_closed_stdin_not_queue_intent() {
    let f = fixture();
    let mut receiver = Receiver::default();
    let mut output = boot();
    assert!(
        receiver
            .receive(&output, false, &f.input, &f.embedded)
            .unwrap()
    );
    output.extend(startup(&f));
    assert!(
        receiver
            .receive(&output, false, &f.input, &f.embedded)
            .is_err()
    );
    let mut receiver = Receiver::default();
    let mut output = boot();
    receiver
        .receive(&output, false, &f.input, &f.embedded)
        .unwrap();
    output.extend(startup(&f));
    receiver
        .receive(&output, true, &f.input, &f.embedded)
        .unwrap();
    assert!(receiver.startup);
    assert!(receiver.finish(&output).is_err());
    let proposal_json = serde_json::to_string(&f.proposal).unwrap();
    output.extend(frame(json!({"version":wire::VERSION,"sessionId":"session","kind":"attempt-proposal","attemptId":"attempt","inputSha256":f.input.job.job_input_ref.sha256,
        "descriptorSha256":f.input.job.expected_descriptor_sha256,"proposalSha256":json::sha256(proposal_json.as_bytes()),"proposalJson":proposal_json})));
    receiver
        .receive(&output, true, &f.input, &f.embedded)
        .unwrap();
    receiver.finish(&output).unwrap();
    assert!(receiver.proposal_json.is_some());
    output.extend(boot());
    assert!(
        receiver
            .receive(&output, true, &f.input, &f.embedded)
            .is_err()
    );
}

#[test]
fn start_serializes_exact_bound_identity_and_decimal_elapsed() {
    let f = fixture();
    let bytes = wire::start(&f.input, 123).unwrap();
    assert!(bytes.ends_with(b"\n"));
    let value: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(value["ownerElapsedNs"], "123");
    assert_eq!(value["inputJson"], f.input.job.job_input_json);
    assert_eq!(value.as_object().unwrap().len(), 7);
    assert!(wire::start(&f.input, -1).is_err());
}

fn zero_integer_proposal(f: &Fixture) -> Value {
    let mut proposal = f.proposal.clone();
    proposal["descriptor"]["schedule"]["corpusIndex"] = json!(0);
    proposal["state"]["control"]["corpusPermutation"] = json!((0..18).collect::<Vec<u32>>());
    proposal["state"]["control"]["corpusCursor"] = json!(0);
    proposal["state"]["journalRef"]["byteLength"] = json!(0);
    proposal["state"]["journalRef"]["lastRecordOrdinal"] = json!(0);
    proposal["state"]["historyRefs"][0]["byteLength"] = json!(0);
    for label in [
        "selection",
        "environment-settlement",
        "policy-sampling",
        "opponent",
    ] {
        proposal["state"]["rng"][label]["root"] = json!(0);
        proposal["state"]["rng"][label]["state"] = json!(0);
        proposal["state"]["rng"][label]["drawCount"] = json!(0);
    }
    proposal
}

fn negative_zero_integer_literals(text: &str) -> String {
    text.replace(":0,", ":-0,")
        .replace(":0}", ":-0}")
        .replace("[0,", "[-0,")
        .replace("\"frozenBaseline\":-0", "\"frozenBaseline\":0")
}

fn literal_at(value: &Value, pointer: &str, token: &str) -> String {
    let mut value = value.clone();
    *value.pointer_mut(pointer).unwrap() = json!("__INTEGER_TOKEN__");
    serde_json::to_string(&value)
        .unwrap()
        .replace("\"__INTEGER_TOKEN__\"", token)
}

#[test]
fn literal_negative_zero_integer_fields_preserve_structural_state_and_exact_descriptor_bytes() {
    let f = fixture();
    let proposal = zero_integer_proposal(&f);
    let canonical = serde_json::to_string(&proposal).unwrap();
    let canonical_descriptor = serde_json::to_string(&proposal["descriptor"]).unwrap();
    let canonical_pin = json::sha256(canonical_descriptor.as_bytes());
    let mut input = f.input.clone();
    input.job.expected_descriptor_sha256 = canonical_pin.clone();
    wire::validate_proposal(
        &canonical,
        &json::sha256(canonical.as_bytes()),
        &canonical_pin,
        &input,
        &f.embedded,
    )
    .unwrap();
    let text = negative_zero_integer_literals(&canonical);
    let descriptor = negative_zero_integer_literals(&canonical_descriptor);
    assert!(text.contains("\"historyRefs\":[{\"byteLength\":-0"));
    assert!(text.contains("\"corpusPermutation\":[-0,1"));
    assert!(text.contains("\"baselineSum\":-0"));
    assert!(text.contains("\"root\":-0"));
    assert!(text.contains("\"state\":-0"));
    assert!(text.contains("\"drawCount\":-0"));
    assert!(descriptor.contains("\"startedOrdinal\":-0"));
    assert!(descriptor.contains("\"corpusIndex\":-0"));
    assert!(descriptor.contains("\"frozenBaseline\":0,"));
    assert_eq!(
        wire::validate_proposal(
            &text,
            &json::sha256(text.as_bytes()),
            &canonical_pin,
            &input,
            &f.embedded
        )
        .unwrap_err(),
        chess_coach_gpu_owner::OwnerError("DESCRIPTOR_SHA256")
    );
    let pin = json::sha256(descriptor.as_bytes());
    assert_ne!(pin, canonical_pin);
    input.job.expected_descriptor_sha256 = pin.clone();
    wire::validate_proposal(
        &text,
        &json::sha256(text.as_bytes()),
        &pin,
        &input,
        &f.embedded,
    )
    .unwrap();
    let original: wire::TrainingState =
        serde_json::from_str(&serde_json::to_string(&proposal["state"]).unwrap()).unwrap();
    let changed: wire::TrainingState = serde_json::from_str(&negative_zero_integer_literals(
        &serde_json::to_string(&proposal["state"]).unwrap(),
    ))
    .unwrap();
    wire::validate_state(&changed).unwrap();
    assert_eq!(
        serde_json::to_value(changed).unwrap(),
        serde_json::to_value(original).unwrap()
    );
}

#[test]
fn literal_negative_zero_live_schedule_uses_the_exact_new_descriptor_pin() {
    let f = fixture();
    let mut proposal = zero_integer_proposal(&f);
    proposal["descriptor"]["schedule"] = json!({"kind":"live","liveOrdinal":0,"candidateSide":"w"});
    let canonical = serde_json::to_string(&proposal).unwrap();
    let canonical_descriptor = serde_json::to_string(&proposal["descriptor"]).unwrap();
    let old_pin = json::sha256(canonical_descriptor.as_bytes());
    let descriptor = negative_zero_integer_literals(&canonical_descriptor);
    let text = canonical.replacen(&canonical_descriptor, &descriptor, 1);
    assert!(descriptor.contains("\"liveOrdinal\":-0"));
    let mut input = f.input.clone();
    input.job.expected_descriptor_sha256 = old_pin.clone();
    assert_eq!(
        wire::validate_proposal(
            &text,
            &json::sha256(text.as_bytes()),
            &old_pin,
            &input,
            &f.embedded
        )
        .unwrap_err(),
        chess_coach_gpu_owner::OwnerError("DESCRIPTOR_SHA256")
    );
    let pin = json::sha256(descriptor.as_bytes());
    input.job.expected_descriptor_sha256 = pin.clone();
    wire::validate_proposal(
        &text,
        &json::sha256(text.as_bytes()),
        &pin,
        &input,
        &f.embedded,
    )
    .unwrap();
}

#[test]
fn typed_wire_integer_fields_reject_fraction_exponent_and_coercion_tokens() {
    let f = fixture();
    let proposal = zero_integer_proposal(&f);
    for pointer in [
        "/master",
        "/initializationSeed",
        "/counters/started",
        "/counters/verifiedCompleted",
        "/counters/eligibleCompleted",
        "/counters/updates",
        "/counters/nonzeroPGUpdates",
        "/counters/baselineCount",
        "/counters/baselineSum",
        "/control/corpusPermutation/0",
        "/control/corpusCursor",
        "/control/corpusEpoch",
        "/control/scheduleCursor",
        "/control/liveOrdinal",
        "/control/dueBucket",
        "/control/fulfilledBucket",
        "/rng/selection/root",
        "/rng/selection/state",
        "/rng/selection/drawCount",
        "/rng/environment-settlement/root",
        "/rng/environment-settlement/state",
        "/rng/environment-settlement/drawCount",
        "/rng/policy-sampling/root",
        "/rng/policy-sampling/state",
        "/rng/policy-sampling/drawCount",
        "/rng/opponent/root",
        "/rng/opponent/state",
        "/rng/opponent/drawCount",
        "/rng/generator/root",
        "/rng/generator/state",
        "/rng/generator/drawCount",
        "/journalRef/byteLength",
        "/journalRef/lastRecordOrdinal",
        "/historyRefs/0/byteLength",
        "/bindings/source/byteLength",
    ] {
        for token in ["-0.0", "-0e0", "0.0", "0e0", "1.0", "1e0", "true", "\"0\""] {
            let text = literal_at(&proposal["state"], pointer, token);
            assert_eq!(
                json::decode::<wire::TrainingState>(text.as_bytes(), wire::FRAME_BYTES)
                    .unwrap_err(),
                chess_coach_gpu_owner::OwnerError("JSON_SCHEMA"),
                "{pointer} = {token}"
            );
        }
    }
    for pointer in ["/master", "/startedOrdinal", "/schedule/corpusIndex"] {
        for token in ["-0.0", "-0e0", "1.0", "1e0", "true", "\"0\""] {
            let text = literal_at(&proposal["descriptor"], pointer, token);
            assert!(
                serde_json::from_str::<wire::Descriptor>(&text).is_err(),
                "{pointer} = {token}"
            );
        }
    }
    let model: Value =
        serde_json::from_str::<Value>(&f.input.job.job_input_json).unwrap()["modelConfig"].clone();
    for pointer in ["/inputFeatures", "/hiddenUnits"] {
        let text = literal_at(&model, pointer, "-0");
        let parsed: wire::ModelConfig = serde_json::from_str(&text).unwrap();
        assert_eq!(
            if pointer == "/inputFeatures" {
                parsed.input_features
            } else {
                parsed.hidden_units
            },
            0
        );
        for token in ["-0.0", "-0e0", "1.0", "1e0", "true", "\"0\""] {
            assert!(
                serde_json::from_str::<wire::ModelConfig>(&literal_at(&model, pointer, token))
                    .is_err(),
                "{pointer} = {token}"
            );
        }
    }
    let unsafe_count = literal_at(
        &proposal["state"],
        "/historyRefs/0/byteLength",
        "9007199254740992",
    );
    assert!(
        json::decode::<wire::TrainingState>(unsafe_count.as_bytes(), wire::FRAME_BYTES).is_err()
    );
    let decimal_input = literal_at(
        &serde_json::from_str::<Value>(&f.input.job.job_input_json).unwrap(),
        "/modelConfig/inputFeatures",
        "2271.0",
    );
    let mut input = f.input.clone();
    input.job.job_input_json = decimal_input;
    input.job.job_input_ref.byte_length = input.job.job_input_json.len() as u64;
    input.job.job_input_ref.sha256 = json::sha256(input.job.job_input_json.as_bytes());
    assert!(AttemptInput::parse(&input).is_err());
}

#[test]
fn raw_schedule_decoding_keeps_variants_fields_and_integer_grammar_closed() {
    assert!(matches!(
        serde_json::from_str::<wire::Schedule>(
            r#"{"corpusIndex":-0,"candidateSide":"b","kind":"corpus"}"#
        )
        .unwrap(),
        wire::Schedule::Corpus {
            corpus_index: 0,
            ..
        }
    ));
    assert!(matches!(
        serde_json::from_str::<wire::Schedule>(
            r#"{"kind":"live","liveOrdinal":-0,"candidateSide":"w"}"#
        )
        .unwrap(),
        wire::Schedule::Live {
            live_ordinal: 0,
            ..
        }
    ));
    for field in ["corpusIndex", "liveOrdinal"] {
        let kind = if field == "corpusIndex" {
            "corpus"
        } else {
            "live"
        };
        for token in [
            "-0.0",
            "-0e0",
            "0.0",
            "1.0",
            "1e0",
            "-1",
            "4294967296",
            "true",
            "\"0\"",
        ] {
            let text =
                format!("{{\"kind\":\"{kind}\",\"{field}\":{token},\"candidateSide\":\"b\"}}");
            assert!(
                serde_json::from_str::<wire::Schedule>(&text).is_err(),
                "{text}"
            );
        }
    }
    for text in [
        r#"{"kind":"other","corpusIndex":0,"candidateSide":"b"}"#,
        r#"{"kind":"corpus","liveOrdinal":0,"candidateSide":"b"}"#,
        r#"{"kind":"live","corpusIndex":0,"candidateSide":"b"}"#,
        r#"{"kind":"corpus","corpusIndex":0,"candidateSide":"b","extra":0}"#,
        r#"{"kind":"live","liveOrdinal":0,"candidateSide":"b","extra":0}"#,
        r#"{"kind":"corpus","candidateSide":"b"}"#,
        r#"{"kind":"live","candidateSide":"w"}"#,
        r#"{"kind":"corpus","corpusIndex":0}"#,
        r#"{"corpusIndex":0,"candidateSide":"b"}"#,
        r#"{"kind":"corpus","kind":"live","corpusIndex":0,"candidateSide":"b"}"#,
    ] {
        assert!(
            serde_json::from_str::<wire::Schedule>(text).is_err(),
            "{text}"
        );
    }
    let generator: wire::Generator =
        serde_json::from_str(r#"{"status":"unused","root":-0,"state":-0,"drawCount":-0}"#).unwrap();
    assert_eq!(generator.root, Some(0));
    assert_eq!(generator.state, Some(0));
    assert_eq!(generator.draw_count, 0);
    for text in [
        r#"{"status":"unused","state":null,"drawCount":0}"#,
        r#"{"status":"unused","root":null,"drawCount":0}"#,
    ] {
        assert!(serde_json::from_str::<wire::Generator>(text).is_err());
    }
}

// SPEC: _spec/learning-runtime.puml
use std::io::{BufReader, Cursor};
use std::sync::OnceLock;

use burn::module::Module;
use burn::store::ModuleRecord;
use burn::tensor::{Bytes, Device, FloatDType};
use chess_coach_learning::{FEATURES, PolicyModel};
use chess_coach_policy_io::channel::{LearningChannel, parameter_sha256, run_channel};
use chess_coach_policy_io::{FrozenPolicy, ModelConfig, ScoreRequest};
use serde_json::{Value, json};

fn device() -> Device {
    static DEVICE: OnceLock<Device> = OnceLock::new();
    DEVICE
        .get_or_init(|| {
            let mut device = Device::flex();
            device.configure(FloatDType::F64).unwrap();
            device.seed(42);
            device
        })
        .clone()
}

fn setup() -> (LearningChannel, String) {
    let device = device();
    let bytes = PolicyModel::new(&device)
        .into_record()
        .into_bytes()
        .unwrap();
    let config = ModelConfig::for_record(&bytes);
    let id = config.record_sha256.clone();
    (
        LearningChannel::from_record(&bytes, config, device, "test".into()).unwrap(),
        id,
    )
}

fn request(id: &str, ordinal: usize, command: Value) -> Vec<u8> {
    serde_json::to_vec(&json!({ "version": "chess-coach.learning-channel.v1", "sessionId": "test", "ordinal": ordinal, "modelId": id, "command": command })).unwrap()
}

fn score_request(id: &str) -> Value {
    let mut values = vec![0.0; FEATURES * 2];
    values[0] = 1.0;
    values[FEATURES] = -1.0;
    json!({ "version": "chess-coach.inference.v1", "featureVersion": "chess-coach.features.v1", "requestId": "test:plan:0:w", "modelId": id,
        "rows": 2, "values": values })
}

fn call(channel: &mut LearningChannel, id: &str, ordinal: usize, command: Value) -> Value {
    serde_json::from_slice(&channel.handle_json(&request(id, ordinal, command)).unwrap()).unwrap()
}

#[test]
fn acknowledged_frozen_episode_emits_only_a_reloadable_uncommitted_proposal() {
    let (mut channel, id) = setup();
    assert_eq!(
        call(&mut channel, &id, 0, json!({"kind":"begin","baseline":0.0}))["result"]["kind"],
        "begun"
    );
    let batch = score_request(&id);
    let before = call(
        &mut channel,
        &id,
        1,
        json!({"kind":"score","request":batch}),
    );
    assert_eq!(before["result"]["response"]["logits"], json!([0.0, 0.0]));
    assert_eq!(
        call(
            &mut channel,
            &id,
            2,
            json!({"kind":"acknowledge","request":batch,"selected":0,"journalDigest":"a".repeat(64)})
        )["result"]["sampledDecisions"],
        1
    );
    let after = call(
        &mut channel,
        &id,
        3,
        json!({"kind":"score","request":batch}),
    );
    assert_eq!(before["result"], after["result"]);
    let proposed = call(
        &mut channel,
        &id,
        4,
        json!({"kind":"finish","returnValue":1}),
    );
    let result = &proposed["result"];
    assert_eq!(result["kind"], "proposed");
    assert_eq!(result["sampledDecisions"], 1);
    let record: Vec<u8> = serde_json::from_value(result["record"].clone()).unwrap();
    let config: ModelConfig = serde_json::from_value(result["config"].clone()).unwrap();
    let device = device();
    let reloaded = PolicyModel::new(&device)
        .try_load_record(ModuleRecord::from_bytes(Bytes::from_bytes_vec(record.clone())).unwrap())
        .unwrap();
    assert_eq!(
        result["parameterSha256"],
        parameter_sha256(&reloaded).unwrap()
    );
    let frozen = FrozenPolicy::from_record(&record, config.clone(), device).unwrap();
    let mut request: ScoreRequest = serde_json::from_value(batch).unwrap();
    request.model_id = config.record_sha256;
    let scores = frozen.score(request).unwrap().logits;
    assert!(scores[0] > scores[1]);
    assert_eq!(
        call(&mut channel, &id, 5, json!({"kind":"close"}))["result"]["kind"],
        "closed"
    );
    assert!(channel.handle_json(&request_bytes(&id)).is_err());
}

fn request_bytes(id: &str) -> Vec<u8> {
    request(id, 6, json!({"kind":"close"}))
}

#[test]
fn empty_completion_is_diagnostic_and_cannot_invent_an_l2_record() {
    let (mut channel, id) = setup();
    call(&mut channel, &id, 0, json!({"kind":"begin","baseline":0.0}));
    assert_eq!(
        call(
            &mut channel,
            &id,
            1,
            json!({"kind":"finish","returnValue":-1})
        )["result"],
        json!({"kind":"diagnostic"})
    );
    assert!(
        channel
            .handle_json(&request(
                &id,
                2,
                json!({"kind":"score","request":score_request(&id)})
            ))
            .is_err()
    );
}

#[test]
fn malformed_binding_phase_ack_or_replay_fails_closed_without_a_proposal() {
    for kind in [
        "before-begin",
        "bad-session",
        "bad-model",
        "bad-ordinal",
        "unknown",
        "selected",
        "duplicate",
    ] {
        let (mut channel, id) = setup();
        let mut ordinal = 0;
        if kind != "before-begin" {
            call(&mut channel, &id, 0, json!({"kind":"begin","baseline":0.0}));
            ordinal = 1;
        }
        let mut value: Value = serde_json::from_slice(&request(&id, ordinal, json!({"kind":"acknowledge","request":score_request(&id),"selected":0,"journalDigest":"a".repeat(64)}))).unwrap();
        match kind {
            "bad-session" => value["sessionId"] = json!("other"),
            "bad-model" => value["modelId"] = json!("0".repeat(64)),
            "bad-ordinal" => value["ordinal"] = json!(2),
            "unknown" => value["trusted"] = json!(true),
            "selected" => value["command"]["selected"] = json!(2),
            "duplicate" => {
                channel
                    .handle_json(&serde_json::to_vec(&value).unwrap())
                    .unwrap();
                value["ordinal"] = json!(2);
            }
            _ => {}
        }
        assert!(
            channel
                .handle_json(&serde_json::to_vec(&value).unwrap())
                .is_err(),
            "{kind}"
        );
        assert!(
            channel
                .handle_json(&request(
                    &id,
                    ordinal + 1,
                    json!({"kind":"finish","returnValue":1})
                ))
                .is_err()
        );
    }
}

#[test]
fn framed_channel_requires_close_eof_and_bounded_complete_input() {
    for kind in ["empty", "partial", "oversized", "trailing", "clean"] {
        let (mut channel, id) = setup();
        let mut bytes = Vec::new();
        if matches!(kind, "trailing" | "clean") {
            for (ordinal, command) in [
                json!({"kind":"begin","baseline":0.0}),
                json!({"kind":"finish","returnValue":0}),
                json!({"kind":"close"}),
            ]
            .into_iter()
            .enumerate()
            {
                bytes.extend(request(&id, ordinal, command));
                bytes.push(b'\n');
            }
            if kind == "trailing" {
                bytes.push(b'x');
            }
        } else if kind == "partial" {
            bytes.push(b'{');
        } else if kind == "oversized" {
            bytes.resize(chess_coach_policy_io::MAX_MESSAGE_BYTES + 2, b'x');
        }
        let result = run_channel(
            &mut BufReader::new(Cursor::new(bytes)),
            &mut Vec::new(),
            &mut channel,
        );
        assert_eq!(result.is_ok(), kind == "clean", "{kind}");
    }
}

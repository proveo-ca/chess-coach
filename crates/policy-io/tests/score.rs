// SPEC: _spec/policy-io.puml
use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::OnceLock;

use burn::module::Module;
use burn::optim::{GradientsParams, SgdConfig};
use burn::tensor::{Device, FloatDType, Tensor, TensorData};
use chess_coach_learning::{FEATURES, FeatureBatch, HIDDEN_UNITS, PolicyModel};
use chess_coach_policy_io::{
    FeatureVersion, FrozenPolicy, MAX_MESSAGE_BYTES, MAX_RECORD_BYTES, ModelConfig, RequestVersion,
    ScoreRequest, ScoreResponse,
};
use serde_json::json;
use sha2::{Digest, Sha256};

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

fn feature_values() -> Vec<f64> {
    let mut values = vec![0.0; 2 * FEATURES];
    values[0] = 1.0;
    values[1] = 2.0;
    values[FEATURES] = 3.0;
    values[FEATURES + 1] = 4.0;
    values
}

fn trained_model(learning_rate: f64) -> PolicyModel {
    let device = device().autodiff();
    let model = PolicyModel::new(&device);
    let features =
        Tensor::<2>::from_data(TensorData::new(feature_values(), [2, FEATURES]), &device);
    let targets = Tensor::<2>::from_data([[1.0_f64], [-1.0_f64]], &device);
    let residual = model.forward(features) - targets;
    let loss = (residual.clone() * residual).sum() / 4.0;
    let gradients = GradientsParams::from_grads(loss.backward(), &model);
    let mut optimizer = SgdConfig::new().init();
    optimizer.step(learning_rate, model, gradients).valid()
}

fn native_record() -> Vec<u8> {
    trained_model(0.125)
        .into_record()
        .into_bytes()
        .unwrap()
        .to_vec()
}

fn frozen(bytes: &[u8], device: Device) -> std::io::Result<FrozenPolicy> {
    FrozenPolicy::from_record(bytes, ModelConfig::for_record(bytes), device)
}

#[test]
fn json_preserves_f64_subnormals_and_fraction_bits() {
    let mut input = request(&"a".repeat(64));
    input.values[..6].copy_from_slice(&[
        -0.0,
        f64::from_bits(1),
        f64::MIN_POSITIVE,
        1.0 / 3.0,
        -1_000_000.0,
        1_000_000.0,
    ]);
    let bytes = serde_json::to_vec(&input).unwrap();
    let output: ScoreRequest = serde_json::from_slice(&bytes).unwrap();
    for (expected, actual) in input.values.iter().zip(output.values) {
        assert_eq!(expected.to_bits(), actual.to_bits());
    }
}

#[test]
fn rejects_nonfinite_record_parameters_and_output_overflow() {
    let bad = trained_model(f64::INFINITY)
        .into_record()
        .into_bytes()
        .unwrap();
    assert!(frozen(&bad, device()).is_err());
    let huge = trained_model(1e307).into_record().into_bytes().unwrap();
    let policy = frozen(&huge, device()).unwrap();
    let mut input = request(policy.model_id());
    input.values.fill(1_000_000.0);
    assert!(policy.score(input).is_err());
}

fn request(model_id: &str) -> ScoreRequest {
    ScoreRequest {
        version: RequestVersion::V1,
        feature_version: FeatureVersion::V1,
        request_id: "fixture-1".into(),
        model_id: model_id.into(),
        rows: 2,
        values: feature_values(),
    }
}

#[test]
fn native_checkpoint_identity_and_nonzero_scores_round_trip() {
    let model = trained_model(0.125);
    let expected = model
        .logits(&FeatureBatch::new(feature_values(), 2).unwrap(), &device())
        .into_data()
        .try_to_vec::<f64>()
        .unwrap();
    assert!(expected.iter().any(|value| *value != 0.0));
    let bytes = model.into_record().into_bytes().unwrap().to_vec();
    let model_id = format!("{:x}", Sha256::digest(&bytes));
    let policy = frozen(&bytes, device()).unwrap();
    assert_eq!(policy.model_id(), model_id);
    let input = serde_json::to_vec(&request(&model_id)).unwrap();
    let result: ScoreResponse =
        serde_json::from_slice(&policy.score_json(&input).unwrap()).unwrap();
    assert_eq!(result.logits, expected);
    assert_eq!(result.request_id, "fixture-1");
    assert_eq!(result.model_id, model_id);
}

#[test]
fn rejects_record_size_corruption_and_autodiff_devices() {
    for bytes in [vec![], vec![0; 32], vec![0; MAX_RECORD_BYTES + 1]] {
        assert!(frozen(&bytes, device()).is_err());
    }
    assert!(frozen(&native_record(), device().autodiff()).is_err());
}

#[test]
fn rejects_shape_domain_model_and_request_identity_mismatches() {
    let policy = frozen(&native_record(), device()).unwrap();
    for rows in [0, 513, usize::MAX] {
        let mut input = request(policy.model_id());
        input.rows = rows;
        assert!(policy.score(input).is_err());
    }
    for value in [f64::NAN, f64::INFINITY, -1_000_001.0, 1_000_001.0] {
        let mut input = request(policy.model_id());
        input.values[0] = value;
        assert!(policy.score(input).is_err());
    }
    for id in ["".to_owned(), "bad id".to_owned(), "x".repeat(65)] {
        let mut input = request(policy.model_id());
        input.request_id = id;
        assert!(policy.score(input).is_err());
    }
    let mut input = request(policy.model_id());
    input.model_id = "0".repeat(64);
    assert!(policy.score(input).is_err());
    let mut input = request(policy.model_id());
    input.values.pop();
    assert!(policy.score(input).is_err());
}

#[test]
fn rejects_oversize_unknown_fields_versions_and_trailing_messages() {
    let policy = frozen(&native_record(), device()).unwrap();
    assert!(
        policy
            .score_json(&vec![b' '; MAX_MESSAGE_BYTES + 1])
            .is_err()
    );
    let base = serde_json::to_value(request(policy.model_id())).unwrap();
    let mut extra = base.clone();
    extra["hiddenState"] = json!({});
    assert!(
        policy
            .score_json(&serde_json::to_vec(&extra).unwrap())
            .is_err()
    );
    let mut wrong_version = base.clone();
    wrong_version["version"] = json!("legacy");
    assert!(
        policy
            .score_json(&serde_json::to_vec(&wrong_version).unwrap())
            .is_err()
    );
    let mut json = serde_json::to_vec(&base).unwrap();
    json.extend_from_slice(b"\n{}");
    assert!(policy.score_json(&json).is_err());
    let mut wrong_features = base;
    wrong_features["featureVersion"] = json!("legacy");
    assert!(
        policy
            .score_json(&serde_json::to_vec(&wrong_features).unwrap())
            .is_err()
    );
}

#[test]
fn accepts_the_maximum_candidate_count() {
    let policy = frozen(&native_record(), device()).unwrap();
    let mut input = request(policy.model_id());
    input.rows = 512;
    input.values = vec![0.0; 512 * FEATURES];
    let result = policy.score(input).unwrap();
    assert_eq!(result.logits.len(), 512);
    assert!(
        result
            .logits
            .iter()
            .all(|value| value.is_finite() && *value == result.logits[0])
    );
}

#[test]
#[cfg_attr(
    feature = "gpu-cuda",
    ignore = "host-only CUDA policy-score subprocess; never run in sbx"
)]
fn binary_scores_one_json_request_and_emits_no_logits_on_failure() {
    let bytes = native_record();
    let mut file = tempfile::NamedTempFile::new().unwrap();
    file.write_all(&bytes).unwrap();
    let id = format!("{:x}", Sha256::digest(&bytes));
    let mut config = tempfile::NamedTempFile::new().unwrap();
    serde_json::to_writer(&mut config, &ModelConfig::for_record(&bytes)).unwrap();
    let expected = frozen(&bytes, device())
        .unwrap()
        .score(request(&id))
        .unwrap()
        .logits;
    for valid in [true, false] {
        let input = request(if valid { &id } else { "mismatch" });
        let mut child = Command::new(env!("CARGO_BIN_EXE_policy-score"))
            .arg(config.path())
            .arg(file.path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        child
            .stdin
            .take()
            .unwrap()
            .write_all(&serde_json::to_vec(&input).unwrap())
            .unwrap();
        let output = child.wait_with_output().unwrap();
        if valid {
            assert!(output.status.success(), "{:?}", output.stderr);
            let response: ScoreResponse = serde_json::from_slice(&output.stdout).unwrap();
            assert_eq!(response.logits, expected);
        } else {
            assert!(!output.status.success());
            assert!(output.stdout.is_empty());
        }
    }
}

#[test]
fn model_metadata_binds_dimensions_feature_version_and_record_bytes() {
    let bytes = native_record();
    let mut config = ModelConfig::for_record(&bytes);
    config.input_features = 418;
    assert!(FrozenPolicy::from_record(&bytes, config, device()).is_err());
    let mut config = ModelConfig::for_record(&bytes);
    config.record_sha256 = "0".repeat(64);
    assert!(FrozenPolicy::from_record(&bytes, config, device()).is_err());
    let mut config = ModelConfig::for_record(&bytes);
    config.hidden_units = HIDDEN_UNITS + 1;
    assert!(FrozenPolicy::from_record(&bytes, config, device()).is_err());
    let mut json = serde_json::to_value(ModelConfig::for_record(&bytes)).unwrap();
    json["featureVersion"] = json!("legacy");
    assert!(serde_json::from_value::<ModelConfig>(json).is_err());
    let layout: serde_json::Value =
        serde_json::from_str(include_str!("../../../schemas/feature-layout.json")).unwrap();
    assert_eq!(layout["dimension"], FEATURES);
    assert_eq!(
        layout["version"],
        serde_json::to_value(FeatureVersion::V1).unwrap()
    );
}

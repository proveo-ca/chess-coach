// SPEC: _spec/gpu-readiness.puml, _spec/learning-runtime.puml
#![cfg(feature = "gpu-cuda")]

use std::fs;
use std::path::Path;
use std::process::Command;
use std::sync::OnceLock;

use burn::module::{Module, ModuleMapper, ModuleVisitor, Param};
use burn::optim::{GradientsParams, SgdConfig};
use burn::store::ModuleRecord;
use burn::tensor::{Bytes, DType, Device, FloatDType, Tensor, TensorData};
use chess_coach_learning::{
    Episode, FEATURES, FeatureBatch, HIDDEN_UNITS, LEARNING_RATE, PolicyModel, SampledDecision,
};
use chess_coach_policy_io::channel::{
    ChannelCommand, ChannelReply, ChannelRequest, ChannelResult, ChannelVersion, LearningChannel,
    parameter_sha256,
};
use chess_coach_policy_io::{
    FeatureVersion, FrozenPolicy, MAX_MESSAGE_BYTES, ModelConfig, RequestVersion, ScoreRequest,
    ScoreResponse, selected_f64_device,
};

const SESSION_ID: &str = "cuda-redundant-fixture";

fn device() -> Device {
    static DEVICE: OnceLock<Device> = OnceLock::new();
    DEVICE
        .get_or_init(|| {
            let device = selected_f64_device().unwrap();
            assert_eq!(device, Device::cuda(0));
            assert!(!device.is_autodiff());
            assert_eq!(device.settings().float_dtype, FloatDType::F64);
            device.seed(42);
            device
        })
        .clone()
}

fn fixture_model(device: &Device) -> PolicyModel {
    struct Fixture;
    impl ModuleMapper for Fixture {
        fn map_float<const D: usize>(&mut self, param: Param<Tensor<D>>) -> Param<Tensor<D>> {
            param.map(|tensor| {
                let dims = tensor.dims();
                let mut values = vec![0.0_f64; dims.iter().product()];
                if dims.as_slice() == [FEATURES, HIDDEN_UNITS] {
                    values[0] = 1.0;
                    values[HIDDEN_UNITS + 1] = 1.0;
                } else if dims.as_slice() == [HIDDEN_UNITS, 1] {
                    values[0] = 0.25;
                    values[1] = 0.5;
                } else {
                    assert_eq!(dims.as_slice(), [HIDDEN_UNITS]);
                }
                let require_grad = tensor.is_require_grad();
                Tensor::from_data(TensorData::new(values, dims), &tensor.device())
                    .set_require_grad(require_grad)
            })
        }
    }
    PolicyModel::new(device).map(&mut Fixture)
}

fn assert_model_device(model: &PolicyModel, device: &Device) {
    struct Check<'a>(&'a Device, usize);
    impl ModuleVisitor for Check<'_> {
        fn visit_float<const D: usize>(&mut self, param: &Param<Tensor<D>>) {
            let tensor = param.val();
            assert_eq!(tensor.device(), *self.0);
            assert_eq!(tensor.dtype(), DType::F64);
            self.1 += 1;
        }
    }
    let mut check = Check(device, 0);
    model.visit(&mut check);
    assert_eq!(check.1, 3);
    assert!(model.has_finite_f64_parameters());
}

fn feature_values() -> Vec<f64> {
    let mut values = vec![0.0; 2 * FEATURES];
    values[0] = 1.0;
    values[1] = 2.0;
    values[FEATURES] = 3.0;
    values[FEATURES + 1] = 4.0;
    values
}

fn logits(model: &PolicyModel, device: &Device) -> Vec<f64> {
    let tensor = model.logits(&FeatureBatch::new(feature_values(), 2).unwrap(), device);
    assert_eq!(tensor.dtype(), DType::F64);
    assert_eq!(tensor.device(), *device);
    let values = tensor.into_data().try_to_vec::<f64>().unwrap();
    assert_eq!(values.len(), 2);
    assert!(values.iter().all(|value| value.is_finite()));
    assert!(values.iter().any(|value| *value != 0.0));
    values
}

fn score_request(model_id: &str, request_id: &str) -> ScoreRequest {
    ScoreRequest {
        version: RequestVersion::V1,
        feature_version: FeatureVersion::V1,
        request_id: request_id.into(),
        model_id: model_id.into(),
        rows: 2,
        values: feature_values(),
    }
}

fn reload_and_score(record: &[u8], config: ModelConfig) -> (String, Vec<f64>) {
    let device = device();
    let model = PolicyModel::new(&device)
        .try_load_record(
            ModuleRecord::from_bytes(Bytes::from_bytes_vec(record.to_vec())).unwrap(),
        )
        .unwrap();
    assert_model_device(&model, &device);
    let expected = logits(&model, &device);
    let digest = parameter_sha256(&model).unwrap();
    let policy = FrozenPolicy::from_record(record, config, device).unwrap();
    let request = score_request(policy.model_id(), "cuda:score");
    let output = policy
        .score_json(&serde_json::to_vec(&request).unwrap())
        .unwrap();
    let response: ScoreResponse = serde_json::from_slice(&output).unwrap();
    assert_eq!(response.request_id, request.request_id);
    assert_eq!(response.model_id, request.model_id);
    assert_eq!(response.logits, expected);
    (digest, response.logits)
}

fn channel_input(model_id: &str) -> Vec<u8> {
    let commands = [
        ChannelCommand::Begin { baseline: 0.25 },
        ChannelCommand::Score {
            request: score_request(model_id, "cuda:score"),
        },
        ChannelCommand::Acknowledge {
            request: score_request(model_id, "cuda:decision:0"),
            selected: 0,
            journal_digest: "a".repeat(64),
        },
        ChannelCommand::Acknowledge {
            request: score_request(model_id, "cuda:decision:1"),
            selected: 1,
            journal_digest: "b".repeat(64),
        },
        ChannelCommand::Score {
            request: score_request(model_id, "cuda:score"),
        },
        ChannelCommand::Finish { return_value: 1 },
        ChannelCommand::Close,
    ];
    let mut input = Vec::new();
    for (ordinal, command) in commands.into_iter().enumerate() {
        let request = ChannelRequest {
            version: ChannelVersion::V1,
            session_id: SESSION_ID.into(),
            ordinal,
            model_id: model_id.into(),
            command,
        };
        input.extend(serde_json::to_vec(&request).unwrap());
        input.push(b'\n');
    }
    input
}

fn check_channel_output(output: &[u8], initial: &[u8]) -> (String, Vec<f64>, f64) {
    assert!(output.len() <= 7 * (MAX_MESSAGE_BYTES + 1));
    let replies = output
        .strip_suffix(b"\n")
        .unwrap()
        .split(|byte| *byte == b'\n')
        .map(|frame| serde_json::from_slice::<ChannelReply>(frame).unwrap())
        .collect::<Vec<_>>();
    assert_eq!(replies.len(), 7);
    let initial_config = ModelConfig::for_record(initial);
    for (ordinal, reply) in replies.iter().enumerate() {
        assert_eq!(reply.session_id, SESSION_ID);
        assert_eq!(reply.ordinal, ordinal);
        assert_eq!(reply.model_id, initial_config.record_sha256);
    }
    assert!(matches!(&replies[0].result, ChannelResult::Begun));
    for (index, sampled, digest) in [(2, 1, "a"), (3, 2, "b")] {
        let ChannelResult::Acknowledged {
            journal_digest,
            sampled_decisions,
        } = &replies[index].result
        else {
            panic!("Expected an acknowledged sampled decision");
        };
        assert_eq!(*sampled_decisions, sampled);
        assert_eq!(*journal_digest, digest.repeat(64));
    }
    let (_, initial_scores) = reload_and_score(initial, initial_config);
    for index in [1, 4] {
        let ChannelResult::Scored { response } = &replies[index].result else {
            panic!("Expected frozen scores");
        };
        assert_eq!(response.logits, initial_scores);
    }
    assert!(matches!(&replies[6].result, ChannelResult::Closed));
    let ChannelResult::Proposed {
        record,
        config,
        sampled_decisions,
        objective,
        nonzero_policy_gradient,
        parameter_sha256: digest,
    } = replies.into_iter().nth(5).unwrap().result
    else {
        panic!("Expected an uncommitted proposal");
    };
    assert_eq!(sampled_decisions, 2);
    assert!(objective.is_finite());
    assert!(nonzero_policy_gradient);
    let (reloaded_digest, scores) = reload_and_score(&record, config);
    assert_eq!(reloaded_digest, digest);
    assert_ne!(scores, initial_scores);
    (digest, scores, objective)
}

#[test]
#[ignore = "host-only CUDA F64 qualification; never run in sbx"]
fn cuda_f64_nonzero_native_scores_round_trip() {
    let device = device();
    let model = fixture_model(&device);
    assert_model_device(&model, &device);
    let expected = logits(&model, &device);
    let expected_digest = parameter_sha256(&model).unwrap();
    let record = model.into_record().into_bytes().unwrap();
    let (digest, scores) = reload_and_score(&record, ModelConfig::for_record(&record));
    assert_eq!(digest, expected_digest);
    assert_eq!(scores, expected);
}

#[test]
#[ignore = "host-only CUDA F64 qualification; never run in sbx"]
fn cuda_f64_direct_sgd_changes_policy_parameters() {
    let device = device().autodiff();
    let model = fixture_model(&device);
    assert_model_device(&model, &device);
    let before_digest = parameter_sha256(&model).unwrap();
    let before_scores = logits(&model, &device);
    let batch = FeatureBatch::new(feature_values(), 2).unwrap();
    let episode = Episode::new(
        vec![
            SampledDecision::new(batch.clone(), 0).unwrap(),
            SampledDecision::new(batch, 1).unwrap(),
        ],
        0.25,
        1,
    )
    .unwrap();
    let objective = episode.objective(&model, &device).unwrap();
    assert_eq!(objective.dtype(), DType::F64);
    assert!(objective.clone().into_data().try_to_vec::<f64>().unwrap()[0].is_finite());
    let gradients = GradientsParams::from_grads(objective.backward(), &model);
    struct Check<'a> {
        gradients: &'a GradientsParams,
        device: &'a Device,
        count: usize,
        nonzero: bool,
    }
    impl ModuleVisitor for Check<'_> {
        fn visit_float<const D: usize>(&mut self, param: &Param<Tensor<D>>) {
            let gradient = self.gradients.get::<D>(param.id).unwrap();
            assert_eq!(gradient.dtype(), DType::F64);
            assert_eq!(gradient.dims(), param.val().dims());
            assert_eq!(gradient.device().without_autodiff(), *self.device);
            let values = gradient.into_data().try_to_vec::<f64>().unwrap();
            assert!(values.iter().all(|value| value.is_finite()));
            self.nonzero |= values.iter().any(|value| *value != 0.0);
            self.count += 1;
        }
    }
    let inference_device = device.without_autodiff();
    let mut check = Check {
        gradients: &gradients,
        device: &inference_device,
        count: 0,
        nonzero: false,
    };
    model.visit(&mut check);
    assert_eq!(check.count, 3);
    assert_eq!(gradients.len(), 3);
    assert!(check.nonzero);
    let mut optimizer = SgdConfig::new().init();
    let updated = optimizer.step(LEARNING_RATE, model, gradients).valid();
    assert_model_device(&updated, &inference_device);
    let updated_digest = parameter_sha256(&updated).unwrap();
    assert_ne!(updated_digest, before_digest);
    let updated_scores = logits(&updated, &inference_device);
    assert_ne!(updated_scores, before_scores);
    let record = updated.into_record().into_bytes().unwrap();
    let (digest, scores) = reload_and_score(&record, ModelConfig::for_record(&record));
    assert_eq!(digest, updated_digest);
    assert_eq!(scores, updated_scores);
}

#[test]
#[ignore = "host-only CUDA F64 qualification; never run in sbx"]
fn cuda_f64_redundant_learning_channels_agree_and_reload() {
    let record = fixture_model(&device()).into_record().into_bytes().unwrap();
    let config = ModelConfig::for_record(&record);
    let input = channel_input(&config.record_sha256);
    let mut results = Vec::new();
    for _ in 0..2 {
        let mut channel =
            LearningChannel::from_record(&record, config.clone(), device(), SESSION_ID.into())
                .unwrap();
        let mut output = Vec::new();
        for frame in input.strip_suffix(b"\n").unwrap().split(|byte| *byte == b'\n') {
            output.extend(channel.handle_json(frame).unwrap());
            output.push(b'\n');
        }
        assert!(channel.closed());
        results.push(check_channel_output(&output, &record));
    }
    assert_eq!(results[0], results[1]);
}

#[test]
#[ignore = "host-only CUDA policy-channel subprocess qualification; never run in sbx"]
fn cuda_f64_policy_channel_subprocesses_agree_and_reload() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(2)
        .unwrap()
        .join("_work/gpu-owner-recovery/scratch");
    fs::create_dir_all(&root).unwrap();
    let directory = tempfile::Builder::new()
        .prefix("cuda-policy-channel-")
        .tempdir_in(root)
        .unwrap();
    let record = fixture_model(&device()).into_record().into_bytes().unwrap();
    let config = ModelConfig::for_record(&record);
    let record_path = directory.path().join("record.bin");
    let config_path = directory.path().join("config.json");
    let input_path = directory.path().join("requests.ndjson");
    fs::write(&record_path, &*record).unwrap();
    fs::write(&config_path, serde_json::to_vec(&config).unwrap()).unwrap();
    fs::write(&input_path, channel_input(&config.record_sha256)).unwrap();
    let mut results = Vec::new();
    for _ in 0..2 {
        let output = Command::new(env!("CARGO_BIN_EXE_policy-channel"))
            .arg(&config_path)
            .arg(&record_path)
            .arg(SESSION_ID)
            .stdin(fs::File::open(&input_path).unwrap())
            .output()
            .unwrap();
        assert!(output.status.success(), "{:?}", output.stderr);
        results.push(check_channel_output(&output.stdout, &record));
    }
    assert_eq!(results[0], results[1]);
}

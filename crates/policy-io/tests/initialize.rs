// SPEC: _spec/learning-runtime.puml
use std::process::Command;
use std::sync::OnceLock;

use burn::module::{Module, ModuleVisitor, Param};
use burn::store::ModuleRecord;
use burn::tensor::{Bytes, Device, FloatDType, Tensor};
use chess_coach_learning::{FEATURES, PolicyModel};
use chess_coach_policy_io::{
    FeatureVersion, FrozenPolicy, ModelConfig, RequestVersion, ScoreRequest,
};

fn device() -> Device {
    static DEVICE: OnceLock<Device> = OnceLock::new();
    DEVICE
        .get_or_init(|| {
            let mut device = Device::flex();
            device.configure(FloatDType::F64).unwrap();
            device
        })
        .clone()
}

fn parameters(model: &PolicyModel) -> Vec<Vec<f64>> {
    struct Read(Vec<Vec<f64>>);
    impl ModuleVisitor for Read {
        fn visit_float<const D: usize>(&mut self, param: &Param<Tensor<D>>) {
            self.0
                .push(param.val().into_data().try_to_vec::<f64>().unwrap());
        }
    }
    let mut read = Read(vec![]);
    model.visit(&mut read);
    read.0
}

#[test]
fn each_master_uses_its_exact_burn_seed_and_zero_output_head_without_rollout_draws() {
    let device = device();
    let mut prior = None;
    for master in 101..=105 {
        device.seed(master);
        let expected = parameters(&PolicyModel::new(&device));
        for _ in 0..2 {
            let result = Command::new(env!("CARGO_BIN_EXE_policy-initialize"))
                .arg(master.to_string())
                .env("RAYON_NUM_THREADS", "2")
                .output()
                .unwrap();
            assert!(result.status.success());
            assert!(result.stderr.is_empty());
            let config = ModelConfig::for_record(&result.stdout);
            let model = PolicyModel::new(&device)
                .try_load_record(
                    ModuleRecord::from_bytes(Bytes::from_bytes_vec(result.stdout.clone())).unwrap(),
                )
                .unwrap();
            let actual = parameters(&model);
            assert_eq!(actual, expected);
            let policy =
                FrozenPolicy::from_record(&result.stdout, config.clone(), device.clone()).unwrap();
            let request = ScoreRequest {
                version: RequestVersion::V1,
                feature_version: FeatureVersion::V1,
                request_id: "initial".into(),
                model_id: config.record_sha256,
                rows: 1,
                values: vec![1.0; FEATURES],
            };
            assert_eq!(policy.score(request).unwrap().logits, [0.0]);
        }
        if let Some(prior) = prior {
            assert_ne!(prior, expected);
        }
        prior = Some(expected);
    }
}

#[test]
fn initialization_rejects_nonselected_seeds_and_executable_selectors_without_output() {
    for args in [
        vec![],
        vec!["100"],
        vec!["106"],
        vec!["42"],
        vec!["101.0"],
        vec!["101", "/other/model"],
    ] {
        let result = Command::new(env!("CARGO_BIN_EXE_policy-initialize"))
            .args(args)
            .output()
            .unwrap();
        assert!(!result.status.success());
        assert!(result.stdout.is_empty());
    }
}

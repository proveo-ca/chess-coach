// SPEC: _spec/policy-io.puml
use burn::module::Module;
use burn::tensor::Device;
use chess_coach_learning::PolicyModel;
use chess_coach_policy_io::channel::parameter_sha256;
use chess_coach_policy_io::{FrozenPolicy, ModelConfig};

#[test]
fn rejects_a_default_f32_device_instead_of_silently_changing_precision() {
    let device = Device::flex();
    let model = PolicyModel::new(&device);
    assert!(!model.has_finite_f64_parameters());
    assert!(parameter_sha256(&model).is_err());
    let record = model.into_record().into_bytes().unwrap();
    assert!(FrozenPolicy::from_record(&record, ModelConfig::for_record(&record), device).is_err());
}

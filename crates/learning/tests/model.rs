// SPEC: _spec/architecture.puml
mod common;

use burn::module::Module;
use burn::optim::{GradientsParams, SgdConfig};
use burn::store::ModuleRecord;
use burn::tensor::{DType, Device, Tensor, TensorData};
use chess_coach_learning::{BatchError, FEATURES, FeatureBatch, MAX_CANDIDATES, PolicyModel};
use common::{controlled_model, device};

fn values<const D: usize>(tensor: Tensor<D>) -> Vec<f64> {
    assert_eq!(tensor.dtype(), DType::F64);
    tensor.into_data().try_to_vec::<f64>().unwrap()
}

fn fixture() -> FeatureBatch {
    let mut values = vec![0.0; FEATURES * 2];
    values[0] = 1.0;
    values[1] = 2.0;
    values[FEATURES] = 3.0;
    values[FEATURES + 1] = 4.0;
    FeatureBatch::new(values, 2).unwrap()
}

#[test]
fn validates_shape_before_backend_work() {
    for rows in [0, MAX_CANDIDATES + 1, usize::MAX] {
        assert_eq!(FeatureBatch::new(vec![], rows), Err(BatchError::Shape));
    }
    assert_eq!(
        FeatureBatch::new(vec![0.0; FEATURES - 1], 1),
        Err(BatchError::Shape)
    );
    assert_eq!(
        FeatureBatch::new(vec![0.0; FEATURES + 1], 1),
        Err(BatchError::Shape)
    );
    assert!(FeatureBatch::new(vec![0.0; FEATURES * MAX_CANDIDATES], MAX_CANDIDATES).is_ok());
}

#[test]
fn rejects_nonfinite_or_out_of_range_features() {
    for bad in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        let mut input = vec![0.0; FEATURES];
        input[17] = bad;
        assert_eq!(FeatureBatch::new(input, 1), Err(BatchError::NonFinite));
    }
    for bad in [-1_000_000.000_1, 1_000_000.000_1] {
        let mut input = vec![0.0; FEATURES];
        input[17] = bad;
        assert_eq!(FeatureBatch::new(input, 1), Err(BatchError::OutOfRange));
    }
}

#[test]
fn accepts_inclusive_feature_bounds_and_normalizes_negative_zero() {
    let mut input = vec![-0.0; FEATURES];
    input[0] = -1_000_000.0;
    input[1] = 1_000_000.0;
    let batch = FeatureBatch::new(input, 1).unwrap();
    assert_eq!(batch.rows(), 1);
    assert_eq!(batch.values()[2].to_bits(), 0.0_f64.to_bits());
}

#[test]
fn zero_output_head_returns_one_zero_logit_per_candidate() {
    let device = device();
    let model = PolicyModel::new(&device);
    assert_eq!(values(model.logits(&fixture(), &device)), [0.0, 0.0]);
}

fn updated_fixture_model(device: &Device) -> PolicyModel {
    let model = controlled_model(device);
    let input = Tensor::<2>::from_data(
        TensorData::new(fixture().values().to_vec(), [2, FEATURES]),
        device,
    );
    let target = Tensor::<2>::from_data([[1.0_f64], [-1.0_f64]], device);
    let residual = model.forward(input.clone()) - target.clone();
    let loss = (residual.clone() * residual).sum().div_scalar(4.0);
    assert_eq!(values(loss.clone()), [0.5]);
    let gradients = GradientsParams::from_grads(loss.backward(), &model);
    let mut optimizer = SgdConfig::new().init();
    let updated = optimizer.step(0.125, model, gradients);
    assert_eq!(
        values(updated.forward(input).squeeze_dim::<1>(1)),
        [-0.375, -0.875]
    );
    updated
}

#[test]
fn burn_autodiff_and_sgd_match_the_synthetic_golden_update() {
    let _ = updated_fixture_model(&device().autodiff());
}

#[test]
fn burn_native_record_round_trip_preserves_logits() {
    let training_device = device().autodiff();
    let model = updated_fixture_model(&training_device).valid();
    let device = training_device.without_autodiff();
    let expected = values(model.logits(&fixture(), &device));
    assert_eq!(expected, [-0.375, -0.875]);
    let bytes = model.into_record().into_bytes().unwrap();
    let restored = PolicyModel::new(&device).load_record(ModuleRecord::from_bytes(bytes).unwrap());
    assert_eq!(values(restored.logits(&fixture(), &device)), expected);
}

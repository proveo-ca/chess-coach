// SPEC: _spec/packages/training/burn-compat.puml
use burn::module::Module;
use burn::optim::{GradientsParams, SgdConfig};
use burn::tensor::{DType, Device, FloatDType, Tensor, TensorData};

use crate::model::SyntheticLinear;
use crate::synthetic_batch::SyntheticBatch;
use crate::{COLUMNS, F64Runtime};

fn fixture() -> Vec<f64> {
    let mut values = vec![0.0; 2 * COLUMNS];
    values[0] = 1.0;
    values[1] = 2.0;
    values[COLUMNS] = 3.0;
    values[COLUMNS + 1] = 4.0;
    values
}

fn data<const D: usize>(tensor: Tensor<D>) -> Vec<f64> {
    assert_eq!(tensor.dtype(), DType::F64);
    tensor.into_data().try_to_vec::<f64>().unwrap()
}

fn close(actual: &[f64], expected: &[f64]) {
    assert_eq!(actual.len(), expected.len());
    for (actual, expected) in actual.iter().zip(expected) {
        assert!((actual - expected).abs() <= 1e-12);
    }
}

fn loss(model: &SyntheticLinear, device: &Device) -> Tensor<1> {
    let values = fixture();
    let batch = SyntheticBatch::new(&values, 2).unwrap();
    let input = Tensor::<2>::from_data(
        TensorData::new(batch.normalized_values(), [batch.rows(), COLUMNS]),
        device,
    );
    let targets = Tensor::<2>::from_data([[1.0_f64], [-1.0_f64]], device);
    assert_eq!(input.dtype(), DType::F64);
    assert_eq!(targets.dtype(), DType::F64);
    let residual = model.forward(input) - targets;
    let loss = (residual.clone() * residual).sum().div_scalar(4.0_f64);
    assert_eq!(loss.dtype(), DType::F64);
    assert_eq!(loss.dims(), [1]);
    assert!(data(loss.clone())[0].is_finite());
    loss
}

fn step(model: SyntheticLinear, device: &Device) -> SyntheticLinear {
    let grads = loss(&model, device).backward();
    let grads = GradientsParams::from_grads(grads, &model);
    let mut optimizer = SgdConfig::new().init();
    optimizer.step(0.125, model, grads)
}

pub(crate) fn updated_model() -> SyntheticLinear {
    let runtime = F64Runtime::initialize().unwrap();
    let device = runtime.device().clone().autodiff();
    assert!(!runtime.device().is_autodiff());
    updated_model_on(&device)
}

fn updated_model_on(device: &Device) -> SyntheticLinear {
    assert!(device.is_autodiff());
    assert_eq!(device.settings().float_dtype, FloatDType::F64);
    let model = SyntheticLinear::new(device);
    let mut initial_weights = vec![0.0; COLUMNS];
    initial_weights[0] = 0.5;
    initial_weights[1] = -0.25;
    close(&data(model.weight.val()), &initial_weights);
    close(&data(model.bias.val()), &[0.125]);
    let input = Tensor::<2>::from_data(TensorData::new(fixture(), [2, COLUMNS]), device);
    close(&data(model.forward(input)), &[0.125, 0.625]);
    let loss = loss(&model, device);
    close(&data(loss.clone()), &[0.8515625]);
    let grads = loss.backward();
    let weight_grad = model.weight.val().grad(&grads).unwrap();
    let bias_grad = model.bias.val().grad(&grads).unwrap();
    assert_eq!(weight_grad.dims(), [COLUMNS, 1]);
    assert_eq!(bias_grad.dims(), [1]);
    let mut expected_grad = vec![0.0; COLUMNS];
    expected_grad[0] = 2.0;
    expected_grad[1] = 2.375;
    close(&data(weight_grad), &expected_grad);
    close(&data(bias_grad), &[0.375]);
    let grads = GradientsParams::from_grads(grads, &model);
    let mut optimizer = SgdConfig::new().init();
    let updated = optimizer.step(0.125, model, grads);
    let mut expected_weight = vec![0.0; COLUMNS];
    expected_weight[0] = 0.25;
    expected_weight[1] = -0.546875;
    close(&data(updated.weight.val()), &expected_weight);
    close(&data(updated.bias.val()), &[0.078125]);
    updated
}

#[test]
fn synthetic_gradients_match_independent_central_differences() {
    let runtime = F64Runtime::initialize().unwrap();
    let device = runtime.device().clone().autodiff();
    let model = SyntheticLinear::new(&device);
    let grads = loss(&model, &device).backward();
    let weights = data(model.weight.val().grad(&grads).unwrap());
    let bias = data(model.bias.val().grad(&grads).unwrap());
    let objective = |parameters: [f64; 3]| {
        let [a, b, bias] = parameters;
        let first = a + 2.0 * b + bias - 1.0;
        let second = 3.0 * a + 4.0 * b + bias + 1.0;
        (first * first + second * second) / 4.0
    };
    let initial = [0.5, -0.25, 0.125];
    for (index, actual) in [weights[0], weights[1], bias[0]].into_iter().enumerate() {
        let mut upper = initial;
        let mut lower = initial;
        upper[index] += 1e-6;
        lower[index] -= 1e-6;
        let numerical = (objective(upper) - objective(lower)) / 2e-6;
        assert!((actual - numerical).abs() < 1e-8);
    }
}

#[test]
fn inference_snapshot_isolated_from_later_fixed_update_and_public_baseline() {
    let runtime = F64Runtime::initialize().unwrap();
    let device = runtime.device().clone().autodiff();
    let trained = updated_model_on(&device);
    let snapshot = crate::SyntheticInferenceContext::snapshot(trained.valid()).unwrap();
    let values = fixture();
    let before = snapshot.score(&values, 2).unwrap();
    close(&before, &[-0.765625, -1.359375]);
    let updated = step(trained, &device);
    let later = crate::SyntheticInferenceContext::snapshot(updated.valid()).unwrap();
    let after = snapshot.score(&values, 2).unwrap();
    assert_eq!(
        before.iter().map(|value| value.to_bits()).collect::<Vec<_>>(),
        after.iter().map(|value| value.to_bits()).collect::<Vec<_>>()
    );
    assert_ne!(later.score(&values, 2).unwrap(), after);
    close(&crate::score_synthetic_f64(&values, 2).unwrap(), &[0.125, 0.625]);
    assert!(!runtime.device().is_autodiff());
}

// SPEC: _spec/learning-runtime.puml
mod common;

use burn::module::{Module, ModuleMapper, ModuleVisitor, Param};
use burn::optim::GradientsParams;
use burn::tensor::{Device, Tensor, TensorData};
use chess_coach_learning::{
    Episode, FEATURES, FeatureBatch, HIDDEN_UNITS, PolicyModel, SampledDecision,
};
use common::device;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Layer {
    Hidden,
    Bias,
    Output,
}

fn layer(dims: &[usize]) -> Layer {
    if dims == [FEATURES, HIDDEN_UNITS] {
        Layer::Hidden
    } else if dims == [HIDDEN_UNITS] {
        Layer::Bias
    } else {
        assert_eq!(dims, [HIDDEN_UNITS, 1]);
        Layer::Output
    }
}

fn fixture(device: &Device, active: bool) -> PolicyModel {
    struct Fixture(bool);
    impl ModuleMapper for Fixture {
        fn map_float<const D: usize>(&mut self, param: Param<Tensor<D>>) -> Param<Tensor<D>> {
            param.map(|tensor| {
                let dims = tensor.dims();
                let values = (0..dims.iter().product::<usize>())
                    .map(|index| match layer(&dims) {
                        Layer::Hidden => {
                            let magnitude = ((index % 13) + 1) as f64 * 0.0001;
                            if index % 2 == 0 {
                                magnitude
                            } else {
                                -magnitude
                            }
                        }
                        Layer::Bias => {
                            let magnitude = 1.25 + index as f64 * 0.01;
                            if self.0 { magnitude } else { -magnitude }
                        }
                        Layer::Output => (index as f64 + 1.0) * 0.002 - 0.025,
                    })
                    .collect::<Vec<_>>();
                let require_grad = tensor.is_require_grad();
                Tensor::from_data(TensorData::new(values, dims), &tensor.device())
                    .set_require_grad(require_grad)
            })
        }
    }
    common::controlled_model(device).map(&mut Fixture(active))
}

fn episode() -> Episode {
    let mut features = Vec::with_capacity(3 * FEATURES);
    for row in 0..3 {
        for column in 0..FEATURES {
            features.push(((column * 13 + row * 7) % 19) as f64 * 0.05 - 0.45 + row as f64 * 0.1);
        }
    }
    let features = FeatureBatch::new(features, 3).unwrap();
    Episode::new(
        vec![
            SampledDecision::new(features.clone(), 0).unwrap(),
            SampledDecision::new(features, 2).unwrap(),
        ],
        0.25,
        1,
    )
    .unwrap()
}

fn objective(episode: &Episode, model: &PolicyModel, device: &Device) -> f64 {
    let value = episode
        .objective(model, device)
        .unwrap()
        .into_data()
        .try_to_vec::<f64>()
        .unwrap()[0];
    assert!(value.is_finite());
    value
}

fn perturb(model: PolicyModel, target: Layer, index: usize, delta: f64) -> PolicyModel {
    struct Perturb(Layer, usize, f64);
    impl ModuleMapper for Perturb {
        fn map_float<const D: usize>(&mut self, param: Param<Tensor<D>>) -> Param<Tensor<D>> {
            param.map(|tensor| {
                let dims = tensor.dims();
                if layer(&dims) != self.0 {
                    return tensor;
                }
                let device = tensor.device();
                let mut values = tensor.into_data().try_to_vec::<f64>().unwrap();
                values[self.1] += self.2;
                Tensor::from_data(TensorData::new(values, dims), &device)
            })
        }
    }
    model.map(&mut Perturb(target, index, delta))
}

fn sweep(device: Device, active: bool) {
    let device = device.autodiff();
    let model = fixture(&device, active);
    let episode = episode();
    let grads = GradientsParams::from_grads(
        episode.objective(&model, &device).unwrap().backward(),
        &model,
    );
    struct Read<'a> {
        grads: &'a GradientsParams,
        values: Vec<(Layer, Vec<f64>)>,
    }
    impl ModuleVisitor for Read<'_> {
        fn visit_float<const D: usize>(&mut self, param: &Param<Tensor<D>>) {
            self.values.push((
                layer(&param.val().dims()),
                self.grads
                    .get::<D>(param.id)
                    .unwrap()
                    .into_data()
                    .try_to_vec::<f64>()
                    .unwrap(),
            ));
        }
    }
    let mut read = Read {
        grads: &grads,
        values: vec![],
    };
    model.visit(&mut read);
    let device = device.without_autodiff();
    let model = model.valid();
    let coordinates = (0..FEATURES)
        .map(|index| (Layer::Hidden, index * HIDDEN_UNITS + index % HIDDEN_UNITS))
        .chain((0..HIDDEN_UNITS).map(|index| (Layer::Bias, index)))
        .chain((0..HIDDEN_UNITS).map(|index| (Layer::Output, index)))
        .collect::<Vec<_>>();
    assert_eq!(coordinates.len(), 2335);
    for (target, index) in coordinates {
        let expected = read
            .values
            .iter()
            .find(|(kind, _)| *kind == target)
            .unwrap()
            .1[index];
        let plus = objective(
            &episode,
            &perturb(model.clone(), target, index, 1e-6),
            &device,
        );
        let minus = objective(
            &episode,
            &perturb(model.clone(), target, index, -1e-6),
            &device,
        );
        let central = (plus - minus) / (2.0 * 1e-6);
        let error = (expected - central).abs();
        let tolerance = 1e-8 + 1e-5 * expected.abs().max(central.abs());
        assert!(
            expected.is_finite() && central.is_finite() && error <= tolerance,
            "active={active} {target:?}[{index}]: Burn={expected} central={central} error={error} limit={tolerance}"
        );
    }
}

#[test]
fn feature_complete_sweep_for_active_relu_checks_2335_coordinates() {
    sweep(device(), true);
}

#[test]
fn feature_complete_sweep_for_inactive_relu_checks_2335_coordinates() {
    sweep(device(), false);
}

#[cfg(feature = "gpu-cuda")]
fn cuda_device() -> Device {
    static DEVICE: std::sync::OnceLock<Device> = std::sync::OnceLock::new();
    DEVICE
        .get_or_init(|| {
            let mut device = Device::cuda(0);
            device.configure(burn::tensor::FloatDType::F64).unwrap();
            assert!(!device.is_autodiff());
            assert_eq!(device.settings().float_dtype, burn::tensor::FloatDType::F64);
            device.seed(42);
            device
        })
        .clone()
}

#[cfg(feature = "gpu-cuda")]
#[test]
#[ignore = "host-only CUDA F64 qualification; never run in sbx"]
fn cuda_feature_complete_sweep_for_active_relu_checks_2335_coordinates() {
    sweep(cuda_device(), true);
}

#[cfg(feature = "gpu-cuda")]
#[test]
#[ignore = "host-only CUDA F64 qualification; never run in sbx"]
fn cuda_feature_complete_sweep_for_inactive_relu_checks_2335_coordinates() {
    sweep(cuda_device(), false);
}

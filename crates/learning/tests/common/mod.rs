// SPEC: _spec/representation.puml
use std::sync::OnceLock;

use burn::module::{Module, ModuleMapper, Param};
use burn::tensor::{Device, FloatDType, Tensor, TensorData};
use chess_coach_learning::{FEATURES, HIDDEN_UNITS, PolicyModel};

pub fn device() -> Device {
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

pub fn controlled_model(device: &Device) -> PolicyModel {
    struct Fixture;
    impl ModuleMapper for Fixture {
        fn map_float<const D: usize>(&mut self, param: Param<Tensor<D>>) -> Param<Tensor<D>> {
            param.map(|tensor| {
                let dims = tensor.dims();
                let device = tensor.device();
                let require_grad = tensor.is_require_grad();
                let mut values = vec![0.0_f64; dims.iter().product()];
                if dims.as_slice() == [FEATURES, HIDDEN_UNITS] {
                    values[0] = 1.0;
                    values[HIDDEN_UNITS + 1] = 1.0;
                }
                Tensor::from_data(TensorData::new(values, dims), &device)
                    .set_require_grad(require_grad)
            })
        }
    }
    PolicyModel::new(device).map(&mut Fixture)
}

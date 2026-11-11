// SPEC: _spec/representation.puml
use burn::module::{Module, ModuleMapper, Param};
use burn::tensor::{Device, FloatDType, Tensor, TensorData};
use chess_coach_learning::{FEATURES, FeatureBatch, HIDDEN_UNITS, PolicyModel, STATE_FEATURES};

#[test]
fn nonlinear_candidate_preferences_can_reverse_with_state() {
    let mut device = Device::flex();
    device.configure(FloatDType::F64).unwrap();
    struct Xor;
    impl ModuleMapper for Xor {
        fn map_float<const D: usize>(&mut self, param: Param<Tensor<D>>) -> Param<Tensor<D>> {
            param.map(|tensor| {
                let dims = tensor.dims();
                let device = tensor.device();
                let mut values = vec![0.0_f64; dims.iter().product()];
                if dims.as_slice() == [FEATURES, HIDDEN_UNITS] {
                    for row in [0, STATE_FEATURES] {
                        values[row * HIDDEN_UNITS] = 1.0;
                        values[row * HIDDEN_UNITS + 1] = 1.0;
                    }
                } else if dims.as_slice() == [HIDDEN_UNITS] {
                    values[1] = -1.0;
                } else if dims.as_slice() == [HIDDEN_UNITS, 1] {
                    values[0] = 1.0;
                    values[1] = -2.0;
                }
                Tensor::from_data(TensorData::new(values, dims), &device)
            })
        }
    }
    let model = PolicyModel::new(&device).map(&mut Xor);
    let mut values = vec![0.0; 4 * FEATURES];
    values[FEATURES + STATE_FEATURES] = 1.0;
    values[2 * FEATURES] = 1.0;
    values[3 * FEATURES] = 1.0;
    values[3 * FEATURES + STATE_FEATURES] = 1.0;
    let batch = FeatureBatch::new(values, 4).unwrap();
    let logits = model
        .logits(&batch, &device)
        .into_data()
        .try_to_vec::<f64>()
        .unwrap();
    assert_eq!(logits, [0.0, 1.0, 1.0, 0.0]);
}

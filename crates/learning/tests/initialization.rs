// SPEC: _spec/representation.puml
use burn::module::{Module, ModuleVisitor, Param};
use burn::optim::{GradientsParams, SgdConfig};
use burn::tensor::{Device, FloatDType, Tensor, TensorData};
use chess_coach_learning::{FEATURES, FeatureBatch, HIDDEN_UNITS, PolicyModel};

fn hidden_values(model: &PolicyModel) -> Vec<f64> {
    #[derive(Default)]
    struct Values(Vec<f64>);
    impl ModuleVisitor for Values {
        fn visit_float<const D: usize>(&mut self, param: &Param<Tensor<D>>) {
            if param.val().dims().as_slice() == [FEATURES, HIDDEN_UNITS] {
                self.0 = param.val().into_data().try_to_vec::<f64>().unwrap();
            }
        }
    }
    let mut values = Values::default();
    model.visit(&mut values);
    values.0
}

#[test]
fn seeded_hidden_initialization_is_reproducible_and_learns_after_the_zero_head_step() {
    let mut device = Device::flex();
    device.configure(FloatDType::F64).unwrap();
    let device = device.autodiff();
    let mut values = vec![0.0; 2 * FEATURES];
    values[0] = 1.0;
    values[1] = 2.0;
    values[FEATURES] = 3.0;
    values[FEATURES + 1] = 4.0;
    let batch = FeatureBatch::new(values.clone(), 2).unwrap();
    let input = Tensor::<2>::from_data(TensorData::new(values, [2, FEATURES]), &device);
    let target = Tensor::<2>::from_data([[1.0_f64], [-1.0_f64]], &device);
    let mut outputs = Vec::new();
    for _ in 0..2 {
        device.seed(42);
        let mut model = PolicyModel::new(&device);
        let initial = hidden_values(&model);
        assert!(initial.iter().any(|value| *value != 0.0));
        assert_eq!(
            model
                .logits(&batch, &device)
                .into_data()
                .try_to_vec::<f64>()
                .unwrap(),
            [0.0, 0.0]
        );
        let mut optimizer = SgdConfig::new().init();
        for step in 0..2 {
            let residual = model.forward(input.clone()) - target.clone();
            let loss = (residual.clone() * residual).sum() / 4.0;
            let gradients = GradientsParams::from_grads(loss.backward(), &model);
            model = optimizer.step(0.125, model, gradients);
            if step == 0 {
                assert_eq!(hidden_values(&model), initial);
            }
        }
        assert_ne!(hidden_values(&model), initial);
        assert!(model.has_finite_f64_parameters());
        outputs.push(
            model
                .logits(&batch, &device)
                .into_data()
                .try_to_vec::<f64>()
                .unwrap(),
        );
    }
    assert_eq!(outputs[0], outputs[1]);
}

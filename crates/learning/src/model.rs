// SPEC: _spec/ml-runtime-architecture.puml, _spec/learning.puml, _spec/representation.puml
use burn::module::Module;
use burn::nn::{Initializer, Linear, LinearConfig};
use burn::tensor::activation::relu;
use burn::tensor::{DType, Device, Tensor, TensorData};

use crate::{FEATURES, FeatureBatch, HIDDEN_UNITS};

#[derive(Module, Debug)]
pub struct PolicyModel {
    hidden: Linear,
    output: Linear,
}

impl PolicyModel {
    pub fn new(device: &Device) -> Self {
        Self {
            hidden: LinearConfig::new(FEATURES, HIDDEN_UNITS).init(device),
            output: LinearConfig::new(HIDDEN_UNITS, 1)
                .with_bias(false)
                .with_initializer(Initializer::Zeros)
                .init(device),
        }
    }

    pub fn forward(&self, features: Tensor<2>) -> Tensor<2> {
        self.output.forward(relu(self.hidden.forward(features)))
    }

    pub fn logits(&self, batch: &FeatureBatch, device: &Device) -> Tensor<1> {
        let input = Tensor::from_data(
            TensorData::new(batch.values().to_vec(), [batch.rows(), FEATURES]),
            device,
        );
        self.forward(input).squeeze_dim(1)
    }

    pub(crate) fn squared_norm(&self) -> Tensor<1> {
        let hidden = self.hidden.weight.val();
        let output = self.output.weight.val();
        let bias = self.hidden.bias.as_ref().unwrap().val();
        (hidden.clone() * hidden).sum()
            + (output.clone() * output).sum()
            + (bias.clone() * bias).sum()
    }

    pub fn has_finite_f64_parameters(&self) -> bool {
        fn finite<const D: usize>(tensor: Tensor<D>) -> bool {
            tensor.dtype() == DType::F64
                && tensor
                    .into_data()
                    .try_to_vec::<f64>()
                    .is_ok_and(|values| values.into_iter().all(f64::is_finite))
        }
        self.output.bias.is_none()
            && self.hidden.weight.val().dims() == [FEATURES, HIDDEN_UNITS]
            && self.output.weight.val().dims() == [HIDDEN_UNITS, 1]
            && self
                .hidden
                .bias
                .as_ref()
                .is_some_and(|bias| bias.val().dims() == [HIDDEN_UNITS] && finite(bias.val()))
            && finite(self.hidden.weight.val())
            && finite(self.output.weight.val())
    }
}

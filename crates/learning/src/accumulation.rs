// SPEC: _spec/learning-runtime.puml
use burn::module::{Module, ModuleVisitor, Param};
use burn::optim::{GradientsAccumulator, GradientsParams, SgdConfig};
use burn::tensor::activation::log_softmax;
use burn::tensor::{DType, Device, FloatDType, Tensor};

use crate::{
    FeatureBatch, L2, LEARNING_RATE, MAX_SAMPLED_DECISIONS, POLICY_TEMPERATURE, PolicyModel,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccumulationError {
    Device,
    Model,
    Baseline,
    Selected,
    DecisionLimit,
    Return,
    NonFinite,
    Gradient,
    Closed,
}

pub struct UpdateProposal {
    pub model: PolicyModel,
    pub sampled_decisions: usize,
    pub objective: f64,
    pub nonzero_policy_gradient: bool,
}

pub struct AccumulatedEpisode {
    model: PolicyModel,
    device: Device,
    baseline: f64,
    sampled_decisions: usize,
    negative_log_probability_sum: f64,
    gradients: GradientsAccumulator<PolicyModel>,
    failed: bool,
}

fn values<const D: usize>(tensor: Tensor<D>) -> Result<Vec<f64>, AccumulationError> {
    if tensor.dtype() != DType::F64 {
        return Err(AccumulationError::NonFinite);
    }
    let values = tensor
        .into_data()
        .try_to_vec::<f64>()
        .map_err(|_| AccumulationError::NonFinite)?;
    if values.iter().any(|value| !value.is_finite()) {
        return Err(AccumulationError::NonFinite);
    }
    Ok(values)
}

fn check_gradients(model: &PolicyModel, grads: &GradientsParams) -> Result<(), AccumulationError> {
    struct Check<'a> {
        grads: &'a GradientsParams,
        valid: bool,
        count: usize,
    }
    impl ModuleVisitor for Check<'_> {
        fn visit_float<const D: usize>(&mut self, param: &Param<Tensor<D>>) {
            self.count += 1;
            self.valid &= self
                .grads
                .get::<D>(param.id)
                .is_some_and(|grad| grad.dims() == param.val().dims() && values(grad).is_ok());
        }
    }
    let mut check = Check {
        grads,
        valid: true,
        count: 0,
    };
    model.visit(&mut check);
    if !check.valid || check.count != 3 || grads.len() != check.count {
        return Err(AccumulationError::Gradient);
    }
    Ok(())
}

impl AccumulatedEpisode {
    pub fn new(
        model: PolicyModel,
        device: Device,
        frozen_baseline: f64,
    ) -> Result<Self, AccumulationError> {
        if !device.is_autodiff() || device.settings().float_dtype != FloatDType::F64 {
            return Err(AccumulationError::Device);
        }
        if !model.has_finite_f64_parameters() {
            return Err(AccumulationError::Model);
        }
        struct Placement<'a> {
            device: &'a Device,
            valid: bool,
        }
        impl ModuleVisitor for Placement<'_> {
            fn visit_float<const D: usize>(&mut self, param: &Param<Tensor<D>>) {
                self.valid &= param.is_require_grad() && param.val().device() == *self.device;
            }
        }
        let mut placement = Placement {
            device: &device,
            valid: true,
        };
        model.visit(&mut placement);
        if !placement.valid {
            return Err(AccumulationError::Device);
        }
        if !frozen_baseline.is_finite() || !(-1.0..=1.0).contains(&frozen_baseline) {
            return Err(AccumulationError::Baseline);
        }
        Ok(Self {
            model,
            device,
            baseline: frozen_baseline,
            sampled_decisions: 0,
            negative_log_probability_sum: 0.0,
            gradients: GradientsAccumulator::new(),
            failed: false,
        })
    }

    pub fn acknowledge(
        &mut self,
        features: &FeatureBatch,
        selected: usize,
    ) -> Result<(), AccumulationError> {
        if self.failed {
            return Err(AccumulationError::Closed);
        }
        let result = self.accumulate(features, selected);
        if result.is_err() {
            self.failed = true;
        }
        result
    }

    fn accumulate(
        &mut self,
        features: &FeatureBatch,
        selected: usize,
    ) -> Result<(), AccumulationError> {
        if selected >= features.rows() {
            return Err(AccumulationError::Selected);
        }
        if self.sampled_decisions >= MAX_SAMPLED_DECISIONS {
            return Err(AccumulationError::DecisionLimit);
        }
        let logits = self.model.logits(features, &self.device) / POLICY_TEMPERATURE;
        values(logits.clone())?;
        let log_probabilities = log_softmax(logits, 0);
        values(log_probabilities.clone())?;
        let loss = log_probabilities.narrow(0, selected, 1) * -1.0;
        let sum = self.negative_log_probability_sum + values(loss.clone())?[0];
        if !sum.is_finite() {
            return Err(AccumulationError::NonFinite);
        }
        let gradients = GradientsParams::from_grads(loss.backward(), &self.model);
        check_gradients(&self.model, &gradients)?;
        self.gradients.accumulate(&self.model, gradients);
        let accumulated = self.gradients.grads();
        check_gradients(&self.model, &accumulated)?;
        self.gradients.accumulate(&self.model, accumulated);
        self.negative_log_probability_sum = sum;
        self.sampled_decisions += 1;
        Ok(())
    }

    pub fn finish(mut self, return_value: i8) -> Result<Option<UpdateProposal>, AccumulationError> {
        if self.failed {
            return Err(AccumulationError::Closed);
        }
        if !(-1..=1).contains(&return_value) {
            return Err(AccumulationError::Return);
        }
        if self.sampled_decisions == 0 {
            return Ok(None);
        }
        let advantage = f64::from(return_value) - self.baseline;
        let regularization = self.model.squared_norm() * (L2 / 2.0);
        let objective =
            advantage * self.negative_log_probability_sum + values(regularization.clone())?[0];
        if !objective.is_finite() {
            return Err(AccumulationError::NonFinite);
        }
        let regularization = GradientsParams::from_grads(regularization.backward(), &self.model);
        check_gradients(&self.model, &regularization)?;
        let mut policy = self.gradients.grads();
        struct Scale<'a> {
            source: &'a mut GradientsParams,
            target: GradientsParams,
            advantage: f64,
            nonzero: bool,
            valid: bool,
        }
        impl ModuleVisitor for Scale<'_> {
            fn visit_float<const D: usize>(&mut self, param: &Param<Tensor<D>>) {
                let Some(grad) = self.source.remove::<D>(param.id) else {
                    self.valid = false;
                    return;
                };
                let gradient = grad * self.advantage;
                match values(gradient.clone()) {
                    Ok(values) => self.nonzero |= values.iter().any(|value| *value != 0.0),
                    Err(_) => self.valid = false,
                }
                self.target.register(param.id, gradient);
            }
        }
        let mut scaled = Scale {
            source: &mut policy,
            target: GradientsParams::new(),
            advantage,
            nonzero: false,
            valid: true,
        };
        self.model.visit(&mut scaled);
        if !scaled.valid {
            return Err(AccumulationError::Gradient);
        }
        let nonzero_policy_gradient = scaled.nonzero;
        let mut combined = GradientsAccumulator::new();
        combined.accumulate(&self.model, scaled.target);
        combined.accumulate(&self.model, regularization);
        let gradients = combined.grads();
        check_gradients(&self.model, &gradients)?;
        let mut optimizer = SgdConfig::new().init();
        let updated = optimizer.step(LEARNING_RATE, self.model, gradients);
        if !updated.has_finite_f64_parameters() {
            return Err(AccumulationError::NonFinite);
        }
        Ok(Some(UpdateProposal {
            model: updated,
            sampled_decisions: self.sampled_decisions,
            objective,
            nonzero_policy_gradient,
        }))
    }
}

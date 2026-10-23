// SPEC: _spec/packages/training/burn-compat.puml
use burn::tensor::{DType, Tensor, TensorData};

use crate::model::SyntheticLinear;
use crate::runtime::{F64Runtime, backend};
use crate::synthetic_batch::SyntheticBatch;
use crate::{ErrorCode, ScoreError};

pub struct SyntheticInferenceContext {
    runtime: F64Runtime,
    model: SyntheticLinear,
}

impl SyntheticInferenceContext {
    pub fn new() -> Result<Self, ScoreError> {
        backend(|| {
            let runtime = F64Runtime::initialize()?;
            let model = SyntheticLinear::new(runtime.device());
            Ok(Self { runtime, model })
        })
    }

    pub fn score(&self, values: &[f64], rows: usize) -> Result<Vec<f64>, ScoreError> {
        self.score_batch(SyntheticBatch::new(values, rows)?)
    }

    pub(crate) fn score_batch(&self, batch: SyntheticBatch<'_>) -> Result<Vec<f64>, ScoreError> {
        backend(|| {
            let input = Tensor::<2>::from_data(
                TensorData::new(batch.normalized_values(), [batch.rows(), crate::COLUMNS]),
                self.runtime.device(),
            );
            if input.dtype() != DType::F64
                || self.model.weight.val().dtype() != DType::F64
                || self.model.bias.val().dtype() != DType::F64
            {
                return Err(ScoreError::new(
                    ErrorCode::BackendFailure,
                    "Flex model must use f64",
                ));
            }
            let output = self.model.forward(input);
            if output.dtype() != DType::F64 || output.dims() != [batch.rows(), 1] {
                return Err(ScoreError::new(
                    ErrorCode::BackendFailure,
                    "unexpected Flex output dtype or shape",
                ));
            }
            let mut scores = output.into_data().try_to_vec::<f64>().map_err(|_| {
                ScoreError::new(ErrorCode::BackendFailure, "cannot read Flex f64 output")
            })?;
            if scores.len() != batch.rows() || scores.iter().any(|score| !score.is_finite()) {
                return Err(ScoreError::new(
                    ErrorCode::BackendFailure,
                    "Flex output must contain finite row scores",
                ));
            }
            for score in &mut scores {
                if *score == 0.0 {
                    *score = 0.0;
                }
            }
            Ok(scores)
        })
    }

    #[cfg(test)]
    pub(crate) fn snapshot(model: SyntheticLinear) -> Result<Self, ScoreError> {
        assert!(!model.weight.val().is_require_grad());
        assert!(!model.bias.val().is_require_grad());
        Ok(Self {
            runtime: F64Runtime::initialize()?,
            model,
        })
    }
}

pub fn score_synthetic_f64(values: &[f64], rows: usize) -> Result<Vec<f64>, ScoreError> {
    let batch = SyntheticBatch::new(values, rows)?;
    SyntheticInferenceContext::new()?.score_batch(batch)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::COLUMNS;

    fn bits(values: Vec<f64>) -> Vec<u64> {
        values.into_iter().map(f64::to_bits).collect()
    }

    #[test]
    fn explicit_context_matches_wrapper_bits_and_repeated_scores() {
        let context = SyntheticInferenceContext::new().unwrap();
        let mut values = vec![0.0; 3 * COLUMNS];
        values[0] = 1.0;
        values[COLUMNS] = 1.0 + 2.0_f64.powi(-30);
        values[2 * COLUMNS] = -0.25;
        let first = context.score(&values, 3).unwrap();
        assert_eq!(first[1] - first[0], 2.0_f64.powi(-31));
        assert_eq!(bits(first.clone()), bits(score_synthetic_f64(&values, 3).unwrap()));
        assert_eq!(bits(first), bits(context.score(&values, 3).unwrap()));
        assert!(!context.runtime.device().is_autodiff());
        assert!(!context.model.weight.val().is_require_grad());
        assert!(!context.model.bias.val().is_require_grad());
        assert_eq!(context.model.weight.val().dims(), [COLUMNS, 1]);
        assert_eq!(context.model.bias.val().dims(), [1]);
    }

    #[test]
    fn explicit_context_preserves_input_errors_and_zero_normalization() {
        let context = SyntheticInferenceContext::new().unwrap();
        assert_eq!(context.score(&[], 0).unwrap_err().code, ErrorCode::Shape);
        let mut values = vec![-0.0; COLUMNS];
        values[0] = -0.25;
        assert_eq!(context.score(&values, 1).unwrap()[0].to_bits(), 0.0_f64.to_bits());
        values[0] = f64::NAN;
        assert_eq!(context.score(&values, 1).unwrap_err().code, ErrorCode::NonFinite);
        values[0] = crate::MAX_ABS_VALUE + 1.0;
        assert_eq!(context.score(&values, 1).unwrap_err().code, ErrorCode::BadRequest);
    }
}

// SPEC: _spec/packages/training/burn-compat.puml
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::OnceLock;

use burn::tensor::{Device, FloatDType};

use crate::{ErrorCode, ScoreError};

pub struct F64Runtime {
    device: Device,
}

impl F64Runtime {
    pub fn initialize() -> Result<Self, ScoreError> {
        backend(|| {
            static DEVICE: OnceLock<Result<Device, ScoreError>> = OnceLock::new();
            let device = DEVICE
                .get_or_init(|| {
                    let mut device = Device::flex();
                    device.configure(FloatDType::F64).map_err(|_| {
                        ScoreError::new(ErrorCode::BackendFailure, "cannot configure Flex f64")
                    })?;
                    Ok(device)
                })
                .clone()?;
            Ok(Self { device })
        })
    }

    pub(crate) fn device(&self) -> &Device {
        &self.device
    }
}

pub(crate) fn backend<T>(action: impl FnOnce() -> Result<T, ScoreError>) -> Result<T, ScoreError> {
    catch_unwind(AssertUnwindSafe(action)).unwrap_or_else(|_| {
        Err(ScoreError::new(
            ErrorCode::BackendFailure,
            "Burn Flex execution failed",
        ))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use burn::tensor::{DType, Tensor};

    #[test]
    fn repeated_initialization_configures_inference_before_tensor_creation() {
        for _ in 0..2 {
            let runtime = F64Runtime::initialize().unwrap();
            assert!(!runtime.device().is_autodiff());
            assert_eq!(runtime.device().settings().float_dtype, FloatDType::F64);
            let tensor = Tensor::<1>::from_data([1.0_f64 + 2.0_f64.powi(-30)], runtime.device());
            assert_eq!(tensor.dtype(), DType::F64);
            assert_eq!(tensor.into_data().try_to_vec::<f64>().unwrap(), [1.0 + 2.0_f64.powi(-30)]);
        }
    }

    #[test]
    fn backend_panics_become_scoring_errors() {
        let result: Result<(), ScoreError> = backend(|| panic!("synthetic backend failure"));
        let error = result.unwrap_err();
        assert_eq!(error.code, ErrorCode::BackendFailure);
        assert_eq!(error.message, "Burn Flex execution failed");
    }
}

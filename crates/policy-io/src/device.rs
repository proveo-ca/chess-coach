// SPEC: _spec/gpu-readiness.puml
use std::io;

use burn::tensor::{Device, FloatDType};

pub fn selected_f64_device() -> io::Result<Device> {
    #[cfg(feature = "gpu-cuda")]
    let mut device = Device::cuda(0);
    #[cfg(not(feature = "gpu-cuda"))]
    let mut device = Device::flex();
    device
        .configure(FloatDType::F64)
        .map_err(|error| io::Error::other(error.to_string()))?;
    Ok(device)
}

#[cfg(all(test, not(feature = "gpu-cuda")))]
mod tests {
    use super::*;

    #[test]
    fn default_device_preserves_flex_f64_inference_configuration() {
        let device = selected_f64_device().unwrap();
        assert_eq!(device, Device::flex());
        assert_eq!(device.settings().float_dtype, FloatDType::F64);
        assert!(!device.is_autodiff());
    }
}

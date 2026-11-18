// SPEC: _spec/policy-io.puml
use std::io::{self, Write};

use burn::module::Module;
use burn::tensor::{Device, FloatDType};
use chess_coach_learning::PolicyModel;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut device = Device::flex();
    device.configure(FloatDType::F64)?;
    device.seed(42);
    let bytes = PolicyModel::new(&device).into_record().into_bytes()?;
    io::stdout().lock().write_all(&bytes)?;
    Ok(())
}

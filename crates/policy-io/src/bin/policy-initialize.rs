// SPEC: _spec/learning-runtime.puml
use std::io::{self, Write};

use burn::module::Module;
use burn::tensor::{Device, FloatDType};
use chess_coach_learning::PolicyModel;
use chess_coach_policy_io::MAX_RECORD_BYTES;

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    if args.len() != 1 || !["101", "102", "103", "104", "105"].contains(&args[0].as_str()) {
        return Err("Usage: policy-initialize MASTER_101_TO_105".into());
    }
    let master: u64 = args[0].parse()?;
    let mut device = Device::flex();
    device.configure(FloatDType::F64)?;
    device.seed(master);
    let model = PolicyModel::new(&device);
    if !model.has_finite_f64_parameters() {
        return Err("Invalid initial model parameters".into());
    }
    let record = model.into_record().into_bytes()?;
    if record.len() > MAX_RECORD_BYTES {
        return Err("Initial model record exceeds byte bound".into());
    }
    io::stdout().lock().write_all(&record)?;
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(2);
    }
}

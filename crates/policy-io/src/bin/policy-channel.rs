// SPEC: _spec/learning-runtime.puml
use std::fs::File;
use std::io::{self, Read};

use burn::tensor::{Device, FloatDType};
use chess_coach_policy_io::channel::{LearningChannel, run_channel};
use chess_coach_policy_io::{MAX_CONFIG_BYTES, MAX_RECORD_BYTES, ModelConfig};

fn read(path: &std::ffi::OsStr, limit: usize) -> io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    File::open(path)?
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)?;
    if bytes.len() > limit {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Input exceeds byte bound",
        ));
    }
    Ok(bytes)
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args = std::env::args_os().skip(1).collect::<Vec<_>>();
    if args.len() != 3 {
        return Err("Usage: policy-channel CONFIG_JSON NATIVE_RECORD SESSION_ID".into());
    }
    let config: ModelConfig = serde_json::from_slice(&read(&args[0], MAX_CONFIG_BYTES)?)?;
    let record = read(&args[1], MAX_RECORD_BYTES)?;
    let session_id = args[2]
        .to_str()
        .ok_or("Invalid session identifier")?
        .to_owned();
    let mut device = Device::flex();
    device.configure(FloatDType::F64)?;
    let mut channel = LearningChannel::from_record(&record, config, device, session_id)?;
    run_channel(
        &mut io::stdin().lock(),
        &mut io::stdout().lock(),
        &mut channel,
    )?;
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(2);
    }
}

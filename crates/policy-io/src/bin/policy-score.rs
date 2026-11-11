// SPEC: _spec/policy-io.puml
use std::fs::File;
use std::io::{self, Read, Write};

use chess_coach_policy_io::{
    FrozenPolicy, MAX_CONFIG_BYTES, MAX_MESSAGE_BYTES, MAX_RECORD_BYTES, ModelConfig,
    selected_f64_device,
};

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args_os().skip(1);
    let config_path = args
        .next()
        .ok_or("Usage: policy-score CONFIG_JSON NATIVE_RECORD")?;
    let path = args
        .next()
        .ok_or("Usage: policy-score CONFIG_JSON NATIVE_RECORD")?;
    if args.next().is_some() {
        return Err("Usage: policy-score CONFIG_JSON NATIVE_RECORD".into());
    }
    let mut config = Vec::new();
    File::open(config_path)?
        .take(MAX_CONFIG_BYTES as u64 + 1)
        .read_to_end(&mut config)?;
    if config.len() > MAX_CONFIG_BYTES {
        return Err("Model configuration exceeds byte limit".into());
    }
    let config: ModelConfig = serde_json::from_slice(&config)?;
    let mut bytes = Vec::new();
    File::open(path)?
        .take(MAX_RECORD_BYTES as u64 + 1)
        .read_to_end(&mut bytes)?;
    let device = selected_f64_device()?;
    let policy = FrozenPolicy::from_record(&bytes, config, device)?;
    let mut request = Vec::new();
    io::stdin()
        .lock()
        .take(MAX_MESSAGE_BYTES as u64 + 1)
        .read_to_end(&mut request)?;
    let response = policy.score_json(&request)?;
    let mut output = io::stdout().lock();
    output.write_all(&response)?;
    output.write_all(b"\n")?;
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(2);
    }
}

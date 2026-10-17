// SPEC: _spec/apps/arena/burn-compat.puml
#![forbid(unsafe_code)]

use std::io::{self, Write};
use std::process::ExitCode;

const HELP: &str = "Usage: arena smoke\n       arena --help\n\nRun one synthetic Burn Flex compatibility window.\nNON_ADMITTED; no learned model or full runner.\n";

fn main() -> ExitCode {
    let arguments: Vec<_> = std::env::args_os().skip(1).collect();
    if arguments.len() != 1 {
        eprintln!("Expected exactly one command: smoke, --help, or -h");
        return ExitCode::from(2);
    }
    if arguments[0] == "--help" || arguments[0] == "-h" {
        return match io::stdout().lock().write_all(HELP.as_bytes()) {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => {
                eprintln!("Cannot write help: {error}");
                ExitCode::FAILURE
            }
        };
    }
    if arguments[0] != "smoke" {
        eprintln!("Unknown command; expected smoke, --help, or -h");
        return ExitCode::from(2);
    }
    let result = arena::run_smoke().and_then(|report| {
        let mut json = serde_json::to_vec(&report)
            .map_err(|error| format!("Cannot encode smoke report: {error}"))?;
        json.push(b'\n');
        io::stdout()
            .lock()
            .write_all(&json)
            .map_err(|error| format!("Cannot write smoke report: {error}"))
    });
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("Arena smoke failed: {error}");
            ExitCode::FAILURE
        }
    }
}

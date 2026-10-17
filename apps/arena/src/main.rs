// SPEC: _spec/apps/arena/burn-compat.puml
#![forbid(unsafe_code)]

use std::io::{self, Write};
use std::process::ExitCode;

const HELP: &str = "Usage: arena smoke\n       arena run --config <file>\n       arena suite --config <file> --out <fresh-dir>\n       arena replay --record <file>\n       arena --help\n\nsmoke: one synthetic Burn Flex compatibility window.\nrun/suite: native full-match baseline orchestration; no learned model.\nNON_ADMITTED. Exit 2: invalid configuration/options; exit 1: runtime/replay/case failure.\n";

fn main() -> ExitCode {
    let arguments: Vec<_> = std::env::args_os().skip(1).collect();
    if arguments
        .first()
        .is_some_and(|arg| arg == "run" || arg == "suite" || arg == "replay")
    {
        let strings: Result<Vec<_>, _> = arguments
            .into_iter()
            .map(|argument| argument.into_string())
            .collect();
        return match strings {
            Ok(arguments) => ExitCode::from(arena::cli::main(&arguments) as u8),
            Err(_) => {
                eprintln!("Command arguments must be UTF-8");
                ExitCode::from(2)
            }
        };
    }
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

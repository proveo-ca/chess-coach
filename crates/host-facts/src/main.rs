// SPEC: _spec/host-entrypoint.puml
#![forbid(unsafe_code)]

use std::io::Write;
use std::process::ExitCode;

fn main() -> ExitCode {
    let arguments: Vec<_> = std::env::args_os().skip(1).collect();
    if arguments.len() == 1 && arguments[0] == "--help" {
        println!("host-docker-runtime-facts --confirm-host");
        return ExitCode::SUCCESS;
    }
    if arguments.len() != 1 || arguments[0] != "--confirm-host" {
        eprintln!("HOST_FACTS_ARGUMENTS: require exactly --confirm-host");
        return ExitCode::from(2);
    }
    let report = chess_coach_host_facts::collect();
    let bytes = match chess_coach_host_facts::encode_report(&report) {
        Ok(bytes) => bytes,
        Err(_) => {
            eprintln!("HOST_FACTS_REPORT_BOUND");
            return ExitCode::FAILURE;
        }
    };
    if std::io::stdout().lock().write_all(&bytes).is_err() {
        return ExitCode::FAILURE;
    }
    if report.passed() {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}

// SPEC: _spec/packages/training/burn-compat.puml, _spec/apps/arena/burn-compat.puml
#![forbid(unsafe_code)]

use std::process::ExitCode;

fn main() -> ExitCode {
    if std::env::args_os().skip(1).collect::<Vec<_>>() != ["check"] {
        eprintln!("usage: cargo xtask check");
        return ExitCode::from(2);
    }
    xtask::check()
}

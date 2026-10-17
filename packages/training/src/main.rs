// SPEC: _spec/packages/training/burn-compat.puml
#![forbid(unsafe_code)]

use std::io::Write;
use std::process::ExitCode;

use training_native::ErrorCode;
use training_native::protocol::{Reply, process, read_bounded};

fn main() -> ExitCode {
    let reply = if std::env::args_os().len() != 1 {
        Reply::failure(
            None,
            ErrorCode::BadRequest,
            "CLI arguments are not supported",
        )
    } else {
        match read_bounded(std::io::stdin().lock()) {
            Ok(bytes) => process(&bytes),
            Err(error) => Reply::failure(None, error.code, error.message),
        }
    };
    let exit_code = reply.exit_code();
    let mut bytes = match serde_json::to_vec(&reply) {
        Ok(bytes) => bytes,
        Err(error) => {
            eprintln!("cannot encode reply: {error}");
            return ExitCode::from(1);
        }
    };
    bytes.push(b'\n');
    let mut stdout = std::io::stdout().lock();
    if let Err(error) = stdout.write_all(&bytes).and_then(|()| stdout.flush()) {
        eprintln!("cannot write reply: {error}");
        return ExitCode::from(1);
    }
    ExitCode::from(exit_code)
}

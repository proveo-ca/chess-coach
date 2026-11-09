// SPEC: _spec/gpu-owner.md
use std::process::Command;

#[test]
fn bounded_help_is_the_only_enabled_cli_operation() {
    let result = Command::new(env!("CARGO_BIN_EXE_host-gpu-owner"))
        .arg("--help")
        .env_clear()
        .output()
        .unwrap();
    assert!(result.status.success());
    assert!(result.stdout.len() < 1024);
    assert!(result.stderr.is_empty());
}

#[test]
fn operational_arguments_and_environment_cannot_enable_main() {
    for args in [
        vec![],
        vec!["--manifest", "/must-not-be-opened"],
        vec!["--help", "extra"],
        vec![
            "--input-manifest",
            "{}",
            "--expected-manifest-sha256",
            "bad",
        ],
    ] {
        let result = Command::new(env!("CARGO_BIN_EXE_host-gpu-owner"))
            .args(args)
            .env_clear()
            .env("GPU_OWNER_ENABLED", "1")
            .env("CHESS_COACH_GPU_OWNER_ENABLED", "1")
            .output()
            .unwrap();
        assert_eq!(result.status.code(), Some(2));
        assert!(result.stdout.is_empty());
        assert_eq!(result.stderr, b"SOURCE_ONLY_DISABLED\n");
    }
}

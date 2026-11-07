// SPEC: _spec/host-entrypoint.puml
use std::process::{Command, Stdio};

#[test]
fn cli_help_and_argument_rejection_never_collect_host_metadata() {
    let binary = env!("CARGO_BIN_EXE_host-docker-runtime-facts");
    let help = Command::new(binary)
        .arg("--help")
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert!(help.status.success());
    assert_eq!(help.stdout, b"host-docker-runtime-facts --confirm-host\n");
    assert!(help.stderr.is_empty());
    for arguments in [
        vec![],
        vec!["--socket", "/other"],
        vec!["--confirm-host", "--confirm-host"],
        vec!["--confirm-host", "run"],
    ] {
        let result = Command::new(binary)
            .args(arguments)
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert_eq!(result.status.code(), Some(2));
        assert!(result.stdout.is_empty());
        assert_eq!(
            result.stderr,
            b"HOST_FACTS_ARGUMENTS: require exactly --confirm-host\n"
        );
    }
}

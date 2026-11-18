// SPEC: _spec/gate-closure.puml
use std::path::Path;

fn native_recipe_is_partitioned(source: &str) -> bool {
    let builds: Vec<_> = source
        .lines()
        .filter(|line| line.starts_with("RUN ") && line.contains("cargo "))
        .collect();
    let copies: Vec<_> = source
        .lines()
        .filter(|line| line.starts_with("COPY --from=native "))
        .collect();
    builds
        == [
            "RUN --network=none cargo build --release --target x86_64-unknown-linux-gnu --locked --offline --jobs 2 --bin policy-score --bin policy-channel --bin policy-initialize",
        ]
        && copies
            == [
                "COPY --from=native /build/native/target/x86_64-unknown-linux-gnu/release/policy-score /usr/local/bin/policy-score",
                "COPY --from=native /build/native/target/x86_64-unknown-linux-gnu/release/policy-channel /usr/local/bin/policy-channel",
                "COPY --from=native /build/native/target/x86_64-unknown-linux-gnu/release/policy-initialize /usr/local/bin/policy-initialize",
            ]
        && !source.contains("host-docker-runtime-facts")
        && !source.contains("--workspace")
}

fn source() -> String {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap();
    std::fs::read_to_string(root.join("tooling/runtime/Dockerfile")).unwrap()
}

#[test]
fn application_recipe_builds_and_copies_only_the_three_policy_binaries() {
    assert!(native_recipe_is_partitioned(&source()));
}

#[test]
fn application_recipe_refuses_host_tool_copy_or_workspace_wide_native_build() {
    let original = source();
    assert!(!native_recipe_is_partitioned(&original.replace(
        "--bin policy-score --bin policy-channel --bin policy-initialize",
        "--workspace"
    )));
    assert!(!native_recipe_is_partitioned(
        &(original
            + "\nCOPY --from=native /build/native/target/release/host-docker-runtime-facts /usr/local/bin/host-docker-runtime-facts\n")
    ));
}

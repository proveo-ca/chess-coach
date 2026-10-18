// SPEC: _spec/packages/training/burn-compat.puml, _spec/apps/arena/burn-compat.puml
#![forbid(unsafe_code)]

mod identity;
mod invoices;
mod preservation;
mod runner;

use std::path::Path;
#[cfg(test)]
use std::path::PathBuf;
use std::process::ExitCode;

use serde_json::{Value, json};

use runner::Gate;

const VERIFICATION_VERSION: &str = "rust-training-verification-v6";
const VERIFICATION_SCOPE: &str = "native-accounting-kernel";
const NODE_VERSION_PROBE: &str = "import * as nodeModule from 'node:module'; console.log(JSON.stringify({version:process.version,registerHooks:typeof nodeModule.registerHooks==='function'}));";
const NOT_ESTABLISHED: &[&str] = &[
    "full-training-closure",
    "genuine-native-authority",
    "whole-decision-adequacy",
    "calibration",
    "training-readiness",
];

pub fn check() -> ExitCode {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let root = match root.canonicalize() {
        Ok(root) => root,
        Err(error) => return initialization_failure(error.to_string()),
    };
    let mut gate = match Gate::new(root) {
        Ok(gate) => gate,
        Err(error) => return initialization_failure(error),
    };
    verify(&mut gate)
}

fn verify(gate: &mut Gate) -> ExitCode {
    let before = identity::training_identity(&gate.root);
    let mut error = before.as_ref().err().cloned();
    let mut complete = false;
    if error.is_none() {
        match fixed_checks(gate) {
            Ok(()) => complete = true,
            Err(failed) => error = Some(failed),
        }
    }
    let after = identity::training_identity(&gate.root);
    if let Err(failed) = identity::unchanged(&before, &after) {
        error = Some(match error {
            Some(previous) => format!("{previous}; {failed}"),
            None => failed,
        });
    }
    let eligible = complete && error.is_none();
    let mut receipt = json!({
        "version": VERIFICATION_VERSION,
        "scope": VERIFICATION_SCOPE,
        "notEstablished": NOT_ESTABLISHED,
        "directory": gate.directory,
        "inputSha256": before.ok(),
        "inputSha256After": after.as_ref().ok(),
        "identityError": after.err(),
        "identityPolicy": "sorted length-framed paths and bytes; source/config/tests/locks; excludes Markdown, target, node_modules, .generated and external theme bytes",
        "reviewEligible": eligible,
        "status": if eligible { "PASS" } else { "STOP" },
        "results": gate.results,
        "buildEnvironment": runner::build_environment(),
        "error": error,
    });
    if let Err(failed) = runner::write_new_json(&gate.directory.join("receipt.json"), &receipt) {
        eprintln!("STOP: cannot persist receipt: {failed}");
        receipt["reviewEligible"] = json!(false);
        receipt["status"] = json!("STOP");
        receipt["error"] = json!(format!("Cannot persist receipt: {failed}"));
        println!("{receipt:#}");
        return ExitCode::FAILURE;
    }
    println!("{receipt:#}");
    if eligible {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}

fn initialization_failure(error: String) -> ExitCode {
    println!("{:#}", initialization_receipt(error));
    ExitCode::FAILURE
}

fn initialization_receipt(error: String) -> Value {
    json!({
        "version": VERIFICATION_VERSION,
        "scope": VERIFICATION_SCOPE,
        "notEstablished": NOT_ESTABLISHED,
        "directory": null,
        "inputSha256": null,
        "reviewEligible": false,
        "status": "STOP",
        "results": [],
        "error": error,
    })
}

fn fixed_checks(gate: &mut Gate) -> Result<(), String> {
    let rustc = gate.command("version-rustc", &["rustc", "--version"])?;
    gate.validate(exact_rust_version(&rustc, "rustc"))?;
    let cargo = gate.command("version-cargo", &["cargo", "--version"])?;
    gate.validate(exact_rust_version(&cargo, "cargo"))?;
    let node = gate.command(
        "version-node",
        &["node", "--input-type=module", "--eval", NODE_VERSION_PROBE],
    )?;
    gate.validate(node_version(&node))?;
    gate.command("version-pnpm", &["pnpm", "--version"])?;
    gate.command("version-tsgo", &["pnpm", "exec", "tsgo", "--version"])?;
    gate.command("version-oxlint", &["pnpm", "exec", "oxlint", "--version"])?;
    if let Some(cc) = std::env::var_os("CC") {
        let cc = cc.into_string().map_err(|_| "CC is not UTF-8")?;
        if !runner::safe_environment_value(&cc) {
            return Err(
                "CC contains a potentially sensitive value; not recorded or executed".into(),
            );
        }
        gate.command("version-cc", &[&cc, "--version"])?;
    }
    legacy_preservation(gate, false)?;
    let old_lock = gate.command("baseline-lock", &["git", "show", "HEAD:pnpm-lock.yaml"])?;
    gate.validate(
        read_text(&gate.root.join("pnpm-lock.yaml"))
            .and_then(|current| preservation::lock(&old_lock, &current)),
    )?;
    let old_package = gate.command("baseline-package", &["git", "show", "HEAD:package.json"])?;
    gate.validate(
        read_json(&gate.root.join("package.json")).and_then(|current| {
            let previous = serde_json::from_str(&old_package).map_err(|error| error.to_string())?;
            preservation::root_package(&previous, &current)
        }),
    )?;
    gate.validate(
        if gate.root.join("packages/training/package.json").exists() {
            Err("packages/training must remain a Rust-only package".into())
        } else {
            Ok(())
        },
    )?;
    let old_index = gate.command(
        "baseline-spec-index",
        &["git", "show", "HEAD:_spec/.spec-index.json"],
    )?;
    gate.validate(
        read_json(&gate.root.join("_spec/.spec-index.json")).and_then(|current| {
            let previous = serde_json::from_str(&old_index).map_err(|error| error.to_string())?;
            preservation::spec_index(&gate.root, &previous, &current)
        }),
    )?;
    gate.command(
        "lint-engine",
        &[
            "pnpm",
            "exec",
            "oxlint",
            "--deny-warnings",
            "-c",
            "oxlint.training.json",
            "apps/arena/engine",
        ],
    )?;
    gate.command(
        "types-engine",
        &["pnpm", "--dir", "apps/arena", "run", "typecheck"],
    )?;
    gate.command("rust-format", &["cargo", "fmt", "--all", "--", "--check"])?;
    gate.command(
        "rust-check",
        &[
            "cargo",
            "check",
            "--workspace",
            "--all-targets",
            "--frozen",
            "--offline",
        ],
    )?;
    gate.command(
        "rust-lint",
        &[
            "cargo",
            "clippy",
            "--workspace",
            "--all-targets",
            "--frozen",
            "--offline",
            "--",
            "-D",
            "warnings",
        ],
    )?;
    let tree = gate.command(
        "selected-native-dependencies",
        &[
            "cargo",
            "tree",
            "-p",
            "training-native",
            "--frozen",
            "--offline",
            "--edges",
            "normal,build",
            "--prefix",
            "none",
        ],
    )?;
    gate.validate(invoices::selected_dependencies(&tree))?;
    gate.command(
        "rust-build",
        &["cargo", "build", "--workspace", "--frozen", "--offline"],
    )?;
    let rust = gate.command(
        "rust-tests",
        &[
            "cargo",
            "test",
            "--workspace",
            "--all-targets",
            "--frozen",
            "--offline",
            "--",
            "--test-threads=2",
        ],
    )?;
    let rust = gate
        .validate(gate.last_stderr())
        .map(|stderr| format!("{rust}\n{stderr}"))?;
    let counts = gate.validate(invoices::rust(&rust))?;
    gate.validate(invoices::required_rust_binaries(&counts))?;
    gate.tests(counts.total, Some(counts.binaries))?;
    let node = gate.command(
        "engine-tests",
        &["pnpm", "--dir", "apps/arena", "run", "test:engine"],
    )?;
    let count = gate.validate(invoices::node_tap(&node))?;
    gate.tests(count, None)?;
    let core_json = gate.directory.join("core.json");
    let output_arg = format!("--outputFile={}", core_json.display());
    gate.command(
        "core-tests",
        &[
            "pnpm",
            "--dir",
            "packages/starchess-core",
            "exec",
            "vitest",
            "run",
            "--reporter=json",
            &output_arg,
        ],
    )?;
    let count = gate.validate(read_json(&core_json).and_then(|json| invoices::core(&json)))?;
    gate.tests(count, None)?;
    gate.command(
        "diagram-training",
        &["plantuml", "-checkonly", preservation::TRAINING_SPEC],
    )?;
    gate.command(
        "diagram-arena",
        &["plantuml", "-checkonly", preservation::ARENA_SPEC],
    )?;
    render_diagram(gate, "render-training", preservation::TRAINING_SPEC)?;
    render_diagram(gate, "render-arena", preservation::ARENA_SPEC)?;
    legacy_preservation(gate, true)?;
    gate.command("whitespace", &["git", "diff", "--check"])?;
    Ok(())
}

fn render_diagram(gate: &mut Gate, id: &str, spec: &str) -> Result<(), String> {
    let directory = runner::fresh_directory(&gate.directory, id)?;
    let output = directory
        .to_str()
        .ok_or("Diagram output path is not UTF-8")?;
    gate.command(id, &["plantuml", "-tsvg", "-o", output, spec])?;
    gate.validate(diagram_svg(&directory.join("burn-compat.svg")))
}

fn diagram_svg(path: &Path) -> Result<(), String> {
    let metadata = std::fs::symlink_metadata(path).map_err(|error| error.to_string())?;
    if !metadata.is_file() || metadata.len() == 0 || metadata.len() > 4 * 1024 * 1024 {
        return Err("Diagram renderer omitted a bounded regular SVG file".into());
    }
    let text = read_text(path)?;
    if !text.contains("<svg ") || !text.trim_end().ends_with("</svg>") {
        return Err("Diagram renderer did not produce SVG".into());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn legacy_preservation(gate: &mut Gate, after: bool) -> Result<(), String> {
    let mut tracked_args = vec!["git", "diff", "--name-only", "HEAD", "--"];
    tracked_args.extend_from_slice(preservation::LEGACY_PATHS);
    let tracked = gate.command(
        if after {
            "legacy-preservation-after"
        } else {
            "legacy-preservation"
        },
        &tracked_args,
    )?;
    let mut untracked_args = vec!["git", "ls-files", "--others", "--exclude-standard", "--"];
    untracked_args.extend_from_slice(preservation::LEGACY_PATHS);
    let untracked = gate.command(
        if after {
            "legacy-untracked-after"
        } else {
            "legacy-untracked"
        },
        &untracked_args,
    )?;
    gate.validate(preservation::legacy_sources(&tracked, &untracked))
}

fn exact_rust_version(text: &str, tool: &str) -> Result<(), String> {
    let mut parts = text.split_whitespace();
    if parts.next() == Some(tool) && parts.next() == Some("1.95.0") {
        Ok(())
    } else {
        Err(format!("{tool} 1.95.0 is required"))
    }
}

fn node_version(text: &str) -> Result<(), String> {
    let probe: Value = serde_json::from_str(text)
        .map_err(|_| "Node version/capability probe is not JSON".to_owned())?;
    let fields = probe
        .as_object()
        .filter(|fields| fields.len() == 2)
        .ok_or("Node version/capability probe has an invalid shape")?;
    let major = fields
        .get("version")
        .and_then(Value::as_str)
        .unwrap_or("")
        .strip_prefix('v')
        .and_then(|version| version.split('.').next())
        .and_then(|major| major.parse::<u32>().ok());
    if major.is_some_and(|major| major >= 22)
        && fields.get("registerHooks") == Some(&Value::Bool(true))
    {
        Ok(())
    } else {
        Err("Node >=22 with node:module.registerHooks is required for F1 verification".into())
    }
}

fn read_text(path: &Path) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|error| format!("{}: {error}", path.display()))
}

fn read_json(path: &Path) -> Result<Value, String> {
    let text = read_text(path)?;
    serde_json::from_str(&text).map_err(|error| format!("{}: {error}", path.display()))
}

#[cfg(test)]
pub(crate) fn test_directory() -> PathBuf {
    runner::fresh_directory(&std::env::temp_dir(), "xtask-test-").unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions_reject_lookalikes_and_old_node() {
        assert!(exact_rust_version("rustc 1.95.0 (hash date)", "rustc").is_ok());
        assert!(exact_rust_version("rustc 1.95.01", "rustc").is_err());
        assert!(exact_rust_version("cargo 1.95.0", "rustc").is_err());
        for version in ["v22.15.0", "v22.23.2", "v24.0.0"] {
            assert!(
                node_version(&json!({"version":version,"registerHooks":true}).to_string()).is_ok()
            );
        }
        for invalid in [
            json!({"version":"v20.0.0","registerHooks":true}),
            json!({"version":"v22.0.0","registerHooks":false}),
            json!({"version":"v23.0.0","registerHooks":false}),
            json!({"version":"v22.23.2"}),
            json!({"version":"v22.23.2","registerHooks":"true"}),
            json!({"version":"v22.23.2","registerHooks":true,"extra":true}),
        ] {
            assert!(node_version(&invalid.to_string()).is_err());
        }
        assert!(node_version("v22.23.2").is_err());
        assert!(node_version("").is_err());
    }

    #[test]
    fn rendered_diagram_requires_bounded_svg_and_private_permissions() {
        let root = test_directory();
        let path = root.join("diagram.svg");
        assert!(diagram_svg(&path).is_err());
        std::fs::write(&path, "not SVG").unwrap();
        assert!(diagram_svg(&path).is_err());
        std::fs::write(&path, "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>\n").unwrap();
        assert!(diagram_svg(&path).is_ok());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                std::fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        std::fs::OpenOptions::new()
            .write(true)
            .open(&path)
            .unwrap()
            .set_len(4 * 1024 * 1024 + 1)
            .unwrap();
        assert!(diagram_svg(&path).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn missing_input_retains_a_stop_receipt_without_running_commands() {
        let root = test_directory();
        let mut gate = Gate::new(root.clone()).unwrap();
        assert_eq!(verify(&mut gate), ExitCode::FAILURE);
        let receipt = read_json(&gate.directory.join("receipt.json")).unwrap();
        let initialized = initialization_receipt("fixture initialization failure".into());
        for value in [&receipt, &initialized] {
            assert_eq!(value["version"], "rust-training-verification-v6");
            assert_eq!(value["scope"], "native-accounting-kernel");
            assert_eq!(
                value["notEstablished"],
                json!([
                    "full-training-closure",
                    "genuine-native-authority",
                    "whole-decision-adequacy",
                    "calibration",
                    "training-readiness"
                ])
            );
            assert_eq!(value["reviewEligible"], false);
            assert_eq!(value["status"], "STOP");
            assert_eq!(value["results"], json!([]));
        }
        assert_eq!(receipt["reviewEligible"], false);
        assert_eq!(receipt["status"], "STOP");
        assert_eq!(receipt["inputSha256"], Value::Null);
        assert_eq!(receipt["results"], json!([]));
        assert!(receipt["error"].as_str().unwrap().contains("Cargo.toml"));
        std::fs::remove_dir_all(gate.directory).unwrap();
        std::fs::remove_dir_all(root).unwrap();
    }
}

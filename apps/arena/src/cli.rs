// SPEC: _spec/apps/arena/burn-compat.puml
use crate::record::{MAX_RECORD_BYTES, MatchSpec, RunRecord, RunStop};
use crate::replay::{VerificationKind, replay_record};
use crate::run::run_match;
use crate::schedule::{SuiteSpec, run_suite};
use serde::{Serialize, de::DeserializeOwned};
use std::fs::{DirBuilder, File, OpenOptions};
use std::io::{self, Read, Write};
use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
use std::path::{Component, Path, PathBuf};

const CONFIG_LIMIT: usize = 64 * 1024;

enum Command {
    Run { config: PathBuf },
    Suite { config: PathBuf, out: PathBuf },
    Replay { record: PathBuf },
}

pub fn main(args: &[String]) -> i32 {
    let command = match parse(args) {
        Ok(command) => command,
        Err(message) => {
            eprintln!("{message}");
            return 2;
        }
    };
    match command {
        Command::Run { config } => {
            let spec: MatchSpec =
                match read_json(&config, CONFIG_LIMIT).and_then(|spec: MatchSpec| {
                    spec.validate()?;
                    Ok(spec)
                }) {
                    Ok(spec) => spec,
                    Err(message) => {
                        eprintln!("{message}");
                        return 2;
                    }
                };
            match run_match(&spec) {
                Ok(record) => {
                    let code = if matches!(record.stop, RunStop::Terminal | RunStop::WindowLimit) {
                        0
                    } else {
                        1
                    };
                    emit(&record).map_or_else(
                        |message| {
                            eprintln!("{message}");
                            1
                        },
                        |()| code,
                    )
                }
                Err(message) => {
                    eprintln!("{message}");
                    2
                }
            }
        }
        Command::Suite { config, out } => {
            let spec: SuiteSpec =
                match read_json(&config, CONFIG_LIMIT).and_then(|spec: SuiteSpec| {
                    spec.validate()?;
                    Ok(spec)
                }) {
                    Ok(spec) => spec,
                    Err(message) => {
                        eprintln!("{message}");
                        return 2;
                    }
                };
            let directory = match fresh_directory(&out) {
                Ok(directory) => directory,
                Err(message) => {
                    eprintln!("{message}");
                    return 2;
                }
            };
            let result = (|| {
                let suite = run_suite(&spec)?;
                for (index, record) in suite.records.iter().enumerate() {
                    write_new(&directory.join(format!("case-{index:04}.json")), record)?;
                }
                write_new(&directory.join("summary.json"), &suite.summary)?;
                emit(&suite.summary)?;
                Ok::<_, String>(if suite.summary.evaluation.failed_unverified == 0 {
                    0
                } else {
                    1
                })
            })();
            result.unwrap_or_else(|message| {
                eprintln!("{message}");
                1
            })
        }
        Command::Replay { record } => {
            let report = match read_json::<RunRecord>(&record, MAX_RECORD_BYTES) {
                Ok(record) => match replay_record(&record) {
                    Ok(verified) => ReplayReport {
                        version: "arena-replay-v1",
                        assurance: "NON_ADMITTED",
                        learned: false,
                        model_artifact: None,
                        verified: true,
                        classification: Some(verified.kind()),
                        verified_prefix_windows: verified.completed_windows(),
                        error: None,
                    },
                    Err(error) => replay_error(error.message, error.verified_prefix_windows),
                },
                Err(message) => replay_error(message, 0),
            };
            let code = i32::from(!report.verified);
            emit(&report).map_or_else(
                |message| {
                    eprintln!("{message}");
                    1
                },
                |()| code,
            )
        }
    }
}

fn parse(args: &[String]) -> Result<Command, String> {
    let command = args.first().ok_or("Expected run, suite, or replay")?;
    let allowed: &[&str] = match command.as_str() {
        "run" => &["--config"],
        "suite" => &["--config", "--out"],
        "replay" => &["--record"],
        _ => return Err("Expected run, suite, or replay".into()),
    };
    let mut options = std::collections::BTreeMap::new();
    for pair in args[1..].chunks(2) {
        if pair.len() != 2
            || !allowed.contains(&pair[0].as_str())
            || pair[1].is_empty()
            || pair[1].starts_with("--")
        {
            return Err("Expected explicit command options with one path each".into());
        }
        if options.insert(pair[0].as_str(), pair[1].as_str()).is_some() {
            return Err(format!("Duplicate option: {}", pair[0]));
        }
    }
    if options.len() != allowed.len() {
        return Err("Missing required command option".into());
    }
    Ok(match command.as_str() {
        "run" => Command::Run {
            config: options["--config"].into(),
        },
        "suite" => Command::Suite {
            config: options["--config"].into(),
            out: options["--out"].into(),
        },
        _ => Command::Replay {
            record: options["--record"].into(),
        },
    })
}

fn read_json<T: DeserializeOwned>(path: &Path, limit: usize) -> Result<T, String> {
    if !std::fs::metadata(path)
        .map_err(|e| format!("Cannot inspect {}: {e}", path.display()))?
        .is_file()
    {
        return Err("JSON input must be a regular file".into());
    }
    let file = File::open(path).map_err(|e| format!("Cannot open {}: {e}", path.display()))?;
    let metadata = file.metadata().map_err(|e| e.to_string())?;
    if !metadata.is_file() {
        return Err("JSON input must be a regular file".into());
    }
    if metadata.len() > limit as u64 {
        return Err(format!("{} exceeds {limit} bytes", path.display()));
    }
    let mut bytes = Vec::new();
    file.take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Cannot read {}: {e}", path.display()))?;
    if bytes.len() > limit {
        return Err(format!("{} exceeds {limit} bytes", path.display()));
    }
    if bytes
        .iter()
        .copied()
        .find(|byte| !byte.is_ascii_whitespace())
        .is_none_or(|byte| byte != b'{')
    {
        return Err("Expected a closed JSON object".into());
    }
    serde_json::from_slice(&bytes).map_err(|e| format!("Invalid {}: {e}", path.display()))
}

struct BoundedJson(Vec<u8>);

impl Write for BoundedJson {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        if bytes.len() > MAX_RECORD_BYTES.saturating_sub(self.0.len()) {
            return Err(io::Error::other("JSON output exceeds 16 MiB"));
        }
        self.0.extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

fn encode(value: &impl Serialize) -> Result<Vec<u8>, String> {
    let mut writer = BoundedJson(Vec::new());
    serde_json::to_writer(&mut writer, value).map_err(|e| format!("Cannot encode report: {e}"))?;
    writer.write_all(b"\n").map_err(|e| e.to_string())?;
    Ok(writer.0)
}

fn emit(value: &impl Serialize) -> Result<(), String> {
    let bytes = encode(value)?;
    let mut stdout = io::stdout().lock();
    stdout
        .write_all(&bytes)
        .and_then(|()| stdout.flush())
        .map_err(|e| format!("Cannot write report: {e}"))
}

fn fresh_directory(path: &Path) -> Result<PathBuf, String> {
    let Some(Component::Normal(name)) = path.components().next_back() else {
        return Err("Output must name a fresh directory".into());
    };
    let parent = path
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let parent = parent
        .canonicalize()
        .map_err(|e| format!("Cannot resolve output parent: {e}"))?;
    let destination = parent.join(name);
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .map_err(|e| e.to_string())?;
    validate_output_destination(&root, &destination)?;
    DirBuilder::new()
        .mode(0o700)
        .create(&destination)
        .map_err(|e| {
            format!(
                "Cannot create fresh output directory {}: {e}",
                destination.display()
            )
        })?;
    Ok(destination)
}

fn validate_output_destination(root: &Path, destination: &Path) -> Result<(), String> {
    if destination.components().any(|component| matches!(component, Component::Normal(part) if part == "_spec" || part == "evidence" || part == "datasets")) {
        return Err("Output cannot enter specification, evidence, or dataset roots".into());
    }
    for legacy in [
        "packages/starchess-core",
        "packages/starchess-arena",
        "packages/starchess-training",
        "apps/server",
        "apps/web",
        "apps/starchess",
        "scripts",
    ] {
        if destination.starts_with(root.join(legacy)) {
            return Err("Output cannot enter legacy source roots".into());
        }
    }
    Ok(())
}

fn write_new(path: &Path, value: &impl Serialize) -> Result<(), String> {
    let bytes = encode(value)?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
        .map_err(|e| format!("Cannot exclusively create {}: {e}", path.display()))?;
    file.write_all(&bytes)
        .and_then(|()| file.flush())
        .map_err(|e| format!("Cannot write {}: {e}", path.display()))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReplayReport {
    version: &'static str,
    assurance: &'static str,
    learned: bool,
    model_artifact: Option<()>,
    verified: bool,
    classification: Option<VerificationKind>,
    verified_prefix_windows: u32,
    error: Option<String>,
}

fn replay_error(message: String, verified_prefix_windows: u32) -> ReplayReport {
    ReplayReport {
        version: "arena-replay-v1",
        assurance: "NON_ADMITTED",
        learned: false,
        model_artifact: None,
        verified: false,
        classification: None,
        verified_prefix_windows,
        error: Some(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::symlink;

    #[test]
    fn n1_output_destination_rejects_every_protected_root_including_scripts() {
        let fixture = tempfile::tempdir().unwrap();
        let root = fixture.path().canonicalize().unwrap();
        for protected in [
            "packages/starchess-core",
            "packages/starchess-arena",
            "packages/starchess-training",
            "apps/server",
            "apps/starchess",
            "apps/web",
            "scripts",
            "_spec/evidence",
            "_spec/corpora",
            "_spec/_refactors/r4-invocation-checkpoint",
            "_spec/_plans/burn-flex-compat.md",
            "_spec/ml/R4.md",
            "_spec/ml/projects.yaml",
            "_spec/ml/overview.puml",
            "_spec/ml/overview.svg",
            "_spec/ml/e2e",
            "_spec/ml/starchess-arena",
            "_spec/ml/starchess-core",
            "_spec/ml/starchess-training",
            "_spec/ml/starchess",
            "_spec/ml/verification",
            "evidence",
            "datasets",
        ] {
            assert!(
                validate_output_destination(&root, &root.join(protected).join("fresh")).is_err(),
                "Accepted protected root: {protected}"
            );
        }
        assert!(validate_output_destination(&root, &root.join("outputs/fresh")).is_ok());
        assert!(validate_output_destination(&root, &root.join("scripts-other/fresh")).is_ok());
        assert!(std::fs::read_dir(&root).unwrap().next().is_none());
    }

    #[test]
    fn n1_output_destination_rejects_canonical_script_aliases_without_creating_outputs() {
        let fixture = tempfile::tempdir().unwrap();
        let root = fixture.path().canonicalize().unwrap();
        let scripts = root.join("scripts");
        std::fs::create_dir(&scripts).unwrap();
        let alias = root.join("alias");
        symlink(&scripts, &alias).unwrap();
        let destination = alias.canonicalize().unwrap().join("fresh");
        assert!(validate_output_destination(&root, &destination).is_err());
        assert!(!scripts.join("fresh").exists());
    }
}

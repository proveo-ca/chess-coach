// SPEC: _spec/packages/training/burn-compat.puml, _spec/apps/arena/burn-compat.puml
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

const REQUIRED: &[&str] = &[
    "Cargo.toml",
    "Cargo.lock",
    "rust-toolchain.toml",
    ".cargo/config.toml",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "oxlint.training.json",
    "_spec/.spec-index.json",
    "_spec/packages/training/burn-compat.puml",
    "_spec/apps/arena/burn-compat.puml",
    "packages/training/Cargo.toml",
    "packages/training/src",
    "packages/training/tests",
    "apps/arena/Cargo.toml",
    "apps/arena/package.json",
    "apps/arena/src",
    "apps/arena/tests",
    "apps/arena/engine",
    "tooling/xtask/Cargo.toml",
    "tooling/xtask/src",
    "packages/starchess-core/package.json",
    "packages/starchess-core/tsconfig.json",
    "packages/starchess-core/src",
];

pub(crate) fn training_identity(root: &Path) -> Result<String, String> {
    for relative in REQUIRED {
        fs::symlink_metadata(root.join(relative))
            .map_err(|error| format!("{relative}: {error}"))?;
    }
    let mut inputs: Vec<PathBuf> = [
        ".cargo",
        "packages/training",
        "apps/arena",
        "tooling/xtask",
        "packages/starchess-core",
    ]
    .into_iter()
    .map(PathBuf::from)
    .collect();
    inputs.extend(REQUIRED.iter().map(PathBuf::from));
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let name = entry.file_name();
        let name = name.to_str().ok_or("Non-UTF-8 root filename")?;
        if name.starts_with("tsconfig") && name.ends_with(".json") {
            inputs.push(PathBuf::from(name));
        }
    }
    digest(root, &inputs)
}

fn digest(root: &Path, inputs: &[PathBuf]) -> Result<String, String> {
    let mut files = BTreeSet::new();
    for input in inputs {
        visit(root, input, &mut files)?;
    }
    let mut hash = Sha256::new();
    for relative in files {
        let name = relative.to_str().ok_or("Non-UTF-8 source path")?.as_bytes();
        let bytes = fs::read(root.join(&relative))
            .map_err(|error| format!("{}: {error}", relative.display()))?;
        hash.update((name.len() as u64).to_be_bytes());
        hash.update(name);
        hash.update((bytes.len() as u64).to_be_bytes());
        hash.update(&bytes);
    }
    Ok(format!("{:x}", hash.finalize()))
}

fn visit(root: &Path, relative: &Path, files: &mut BTreeSet<PathBuf>) -> Result<(), String> {
    if relative.components().any(|part| {
        matches!(
            part.as_os_str().to_str(),
            Some("target" | "node_modules" | ".generated" | ".git")
        )
    }) || relative
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
    {
        return Ok(());
    }
    let metadata = fs::symlink_metadata(root.join(relative))
        .map_err(|error| format!("{}: {error}", relative.display()))?;
    if metadata.file_type().is_symlink() {
        return Err(format!(
            "Source symlink is not supported: {}",
            relative.display()
        ));
    }
    if metadata.is_dir() {
        for child in fs::read_dir(root.join(relative))
            .map_err(|error| format!("{}: {error}", relative.display()))?
        {
            let child = child.map_err(|error| error.to_string())?;
            visit(root, &relative.join(child.file_name()), files)?;
        }
    } else if metadata.is_file() {
        files.insert(relative.to_path_buf());
    } else {
        return Err(format!(
            "Source input is not a regular file: {}",
            relative.display()
        ));
    }
    Ok(())
}

pub(crate) fn unchanged(
    before: &Result<String, String>,
    after: &Result<String, String>,
) -> Result<(), String> {
    match (before, after) {
        (Ok(before), Ok(after)) if before == after => Ok(()),
        (Ok(_), Ok(_)) => {
            Err("Source/config/test/dependency identity changed during verification".into())
        }
        (_, Err(error)) => Err(format!("Final input identity unavailable: {error}")),
        (Err(error), _) => Err(format!("Initial input identity unavailable: {error}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identity_binds_bytes_names_additions_and_deletions() {
        let root = crate::test_directory();
        fs::create_dir(root.join("src")).unwrap();
        let inputs = [PathBuf::from("src")];
        fs::write(root.join("src/a.rs"), b"ab").unwrap();
        let before = digest(&root, &inputs).unwrap();
        fs::write(root.join("src/a.rs"), b"ac").unwrap();
        assert_ne!(before, digest(&root, &inputs).unwrap());
        fs::write(root.join("src/a.rs"), b"ab").unwrap();
        fs::write(root.join("src/b.rs"), b"").unwrap();
        assert_ne!(before, digest(&root, &inputs).unwrap());
        fs::remove_file(root.join("src/b.rs")).unwrap();
        assert_eq!(before, digest(&root, &inputs).unwrap());
        fs::rename(root.join("src/a.rs"), root.join("src/b.rs")).unwrap();
        assert_ne!(before, digest(&root, &inputs).unwrap());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn identity_sorts_deduplicates_and_excludes_outputs_and_markdown() {
        let root = crate::test_directory();
        fs::create_dir(root.join("src")).unwrap();
        fs::write(root.join("src/z.rs"), b"z").unwrap();
        fs::write(root.join("src/a.rs"), b"a").unwrap();
        let input = [PathBuf::from("src")];
        let before = digest(&root, &input).unwrap();
        let reversed = [
            PathBuf::from("src/z.rs"),
            PathBuf::from("src/a.rs"),
            PathBuf::from("src"),
        ];
        assert_eq!(before, digest(&root, &reversed).unwrap());
        for excluded in ["target", "node_modules", ".generated"] {
            fs::create_dir(root.join("src").join(excluded)).unwrap();
            fs::write(root.join("src").join(excluded).join("out"), b"generated").unwrap();
        }
        fs::write(root.join("src/README.md"), b"documentation").unwrap();
        assert_eq!(before, digest(&root, &input).unwrap());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn missing_inputs_and_changed_identity_fail_closed() {
        let root = crate::test_directory();
        assert!(training_identity(&root).is_err());
        assert!(digest(&root, &[PathBuf::from("missing")]).is_err());
        assert!(unchanged(&Ok("a".into()), &Ok("b".into())).is_err());
        assert!(unchanged(&Ok("a".into()), &Err("missing".into())).is_err());
        assert!(unchanged(&Err("missing".into()), &Ok("a".into())).is_err());
        assert!(unchanged(&Ok("a".into()), &Ok("a".into())).is_ok());
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn source_symlinks_fail_instead_of_escaping_identity() {
        let root = crate::test_directory();
        std::os::unix::fs::symlink("/dev/null", root.join("source.rs")).unwrap();
        assert!(digest(&root, &[PathBuf::from("source.rs")]).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}

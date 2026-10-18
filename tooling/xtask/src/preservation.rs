// SPEC: _spec/packages/training/burn-compat.puml, _spec/apps/arena/burn-compat.puml
use std::collections::BTreeSet;
use std::path::{Component, Path};

use serde_json::Value as Json;
use serde_yaml::{Mapping, Value as Yaml};

pub(crate) const TRAINING_SPEC: &str = "_spec/packages/training/burn-compat.puml";
pub(crate) const ARENA_SPEC: &str = "_spec/apps/arena/burn-compat.puml";
pub(crate) const LEGACY_PATHS: &[&str] = &[
    "packages/starchess-core",
    "packages/starchess-arena",
    "packages/starchess-training",
    "apps/server",
    "apps/starchess",
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
];
const DEV_TOOLS: &[&str] = &["@typescript/native-preview", "oxlint", "tsx", "@types/node"];

pub(crate) fn legacy_sources(tracked: &str, untracked: &str) -> Result<(), String> {
    if tracked.trim().is_empty() && untracked.trim().is_empty() {
        Ok(())
    } else {
        Err("Protected legacy sources, consumers, contracts, corpora or evidence changed".into())
    }
}

pub(crate) fn lock(previous: &str, current: &str) -> Result<(), String> {
    let previous: Yaml =
        serde_yaml::from_str(previous).map_err(|error| format!("Baseline pnpm lock: {error}"))?;
    let current: Yaml =
        serde_yaml::from_str(current).map_err(|error| format!("Current pnpm lock: {error}"))?;
    let previous_root = mapping(&previous, "baseline lock")?;
    let current_root = mapping(&current, "current lock")?;
    for (key, value) in previous_root {
        if !matches!(key.as_str(), Some("packages" | "snapshots" | "importers"))
            && current_root.get(key) != Some(value)
        {
            return Err("Existing pnpm lock settings changed".into());
        }
    }
    for section in ["packages", "snapshots", "importers"] {
        let before = mapping(&previous[section], section)?;
        let after = mapping(&current[section], section)?;
        for (key, value) in before {
            if section == "importers" && key.as_str() == Some(".") {
                preserve_root_importer(value, after.get(key).ok_or("Missing root importer")?)?;
            } else if after.get(key) != Some(value) {
                return Err(format!(
                    "Existing dependency changed: {section}/{}",
                    key.as_str().unwrap_or("<non-string>")
                ));
            }
        }
        if section == "importers" {
            for key in after.keys() {
                if key.as_str() == Some("packages/training") {
                    return Err("Rust-only training crate has an npm importer".into());
                }
                if !before.contains_key(key) && !matches!(key.as_str(), Some("." | "apps/arena")) {
                    return Err("Unexpected new pnpm importer".into());
                }
            }
        }
    }
    Ok(())
}

fn preserve_root_importer(previous: &Yaml, current: &Yaml) -> Result<(), String> {
    let previous = mapping(previous, "baseline root importer")?;
    let current = mapping(current, "current root importer")?;
    for (key, value) in previous {
        if key.as_str() != Some("devDependencies") && current.get(key) != Some(value) {
            return Err("Existing root importer dependency section changed".into());
        }
    }
    for key in current.keys() {
        if key.as_str() != Some("devDependencies") && !previous.contains_key(key) {
            return Err("Root importer may add only development tools".into());
        }
    }
    let empty = Mapping::new();
    let before = previous
        .get(Yaml::String("devDependencies".into()))
        .map(|value| mapping(value, "old root dev tools"))
        .transpose()?
        .unwrap_or(&empty);
    let after = current
        .get(Yaml::String("devDependencies".into()))
        .map(|value| mapping(value, "root dev tools"))
        .transpose()?
        .unwrap_or(&empty);
    for (key, value) in before {
        if after.get(key) != Some(value) {
            return Err("Existing root dev dependency changed, including nx".into());
        }
    }
    for key in after.keys() {
        if !before.contains_key(key) && !key.as_str().is_some_and(|key| DEV_TOOLS.contains(&key)) {
            return Err("Root importer added a non-approved development tool".into());
        }
    }
    Ok(())
}

pub(crate) fn root_package(previous: &Json, current: &Json) -> Result<(), String> {
    for section in ["dependencies", "optionalDependencies", "peerDependencies"] {
        if previous.get(section) != current.get(section) {
            return Err(format!("Root npm {section} changed"));
        }
    }
    let empty = serde_json::Map::new();
    let before = previous
        .get("devDependencies")
        .map(|value| {
            value
                .as_object()
                .ok_or("Invalid baseline root devDependencies")
        })
        .transpose()?
        .unwrap_or(&empty);
    let after = current
        .get("devDependencies")
        .map(|value| value.as_object().ok_or("Invalid root devDependencies"))
        .transpose()?
        .unwrap_or(&empty);
    for (key, value) in before {
        if after.get(key) != Some(value) {
            return Err(format!("Existing root npm dependency changed: {key}"));
        }
    }
    for key in after.keys() {
        if !before.contains_key(key) && !DEV_TOOLS.contains(&key.as_str()) {
            return Err(format!("Unapproved new root npm development tool: {key}"));
        }
    }
    Ok(())
}

pub(crate) fn spec_index(root: &Path, previous: &Json, current: &Json) -> Result<(), String> {
    let before = previous
        .get("specs")
        .and_then(Json::as_array)
        .ok_or("Missing baseline specs")?;
    let after = current
        .get("specs")
        .and_then(Json::as_array)
        .ok_or("Missing current specs")?;
    let is_owner = |entry: &&Json| {
        matches!(
            entry.get("spec").and_then(Json::as_str),
            Some(TRAINING_SPEC | ARENA_SPEC)
        )
    };
    let previous_other: Vec<_> = before.iter().filter(|entry| !is_owner(entry)).collect();
    let current_other: Vec<_> = after.iter().filter(|entry| !is_owner(entry)).collect();
    if previous_other != current_other || after.iter().filter(is_owner).count() != 2 {
        return Err(
            "Existing non-rebuild spec entries must remain unchanged, with exactly two rebuild owners".into(),
        );
    }
    let mut before_other = previous.clone();
    let mut after_other = current.clone();
    before_other
        .as_object_mut()
        .ok_or("Invalid baseline spec index")?
        .remove("specs");
    after_other
        .as_object_mut()
        .ok_or("Invalid current spec index")?
        .remove("specs");
    if before_other != after_other {
        return Err("Existing spec index metadata or unresolved pointers changed".into());
    }
    let mut owners = BTreeSet::new();
    for entry in after.iter().filter(is_owner) {
        if entry.get("fingerprint") != Some(&Json::Null) {
            return Err("Rebuild spec fingerprints must remain null".into());
        }
        let spec = entry
            .get("spec")
            .and_then(Json::as_str)
            .ok_or("Missing new spec owner")?;
        if ![TRAINING_SPEC, ARENA_SPEC].contains(&spec) || !owners.insert(spec) {
            return Err("Unexpected or duplicate new spec owner".into());
        }
        let text = crate::read_text(&root.join(spec))?;
        let claimed: BTreeSet<_> = text
            .lines()
            .filter_map(|line| line.trim().strip_prefix("' covers:").map(str::trim))
            .collect();
        let indexed = entry
            .get("covers")
            .and_then(Json::as_array)
            .ok_or("Missing new spec covers")?;
        let mut indexed_set = BTreeSet::new();
        for path in indexed {
            let path = path.as_str().ok_or("Invalid new coverage path")?;
            if !indexed_set.insert(path) {
                return Err("Duplicate new spec coverage path".into());
            }
            let relative = Path::new(path);
            if !relative
                .components()
                .all(|part| matches!(part, Component::Normal(_)))
                || !root.join(relative).is_file()
            {
                return Err(format!(
                    "New spec coverage must name an existing literal source/config file: {path}"
                ));
            }
            if relative.extension().is_some_and(|extension| {
                matches!(
                    extension.to_str(),
                    Some("rs" | "ts" | "mts" | "cts" | "mjs")
                )
            }) {
                let source = crate::read_text(&root.join(relative))?;
                let first = source.lines().next().unwrap_or("");
                let refs = first
                    .strip_prefix("// SPEC: ")
                    .ok_or_else(|| format!("Missing top-line SPEC pointer: {path}"))?;
                if !refs
                    .split(',')
                    .map(str::trim)
                    .any(|pointer| pointer == spec)
                {
                    return Err(format!(
                        "Coverage source does not point back to {spec}: {path}"
                    ));
                }
            }
        }
        if claimed.is_empty() || claimed != indexed_set {
            return Err(format!("PUML covers and spec index disagree: {spec}"));
        }
    }
    Ok(())
}

fn mapping<'a>(value: &'a Yaml, label: &str) -> Result<&'a Mapping, String> {
    value
        .as_mapping()
        .ok_or_else(|| format!("Missing or invalid YAML map: {label}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const LOCK: &str = "lockfileVersion: '9.0'\nimporters:\n  .:\n    devDependencies:\n      nx: {specifier: '^21.6.11', version: 21.6.11}\n  packages/starchess-core: {}\npackages:\n  a@1: {resolution: {integrity: abc}}\nsnapshots:\n  a@1: {}\n";

    #[test]
    fn legacy_preservation_rejects_tracked_and_untracked_additions() {
        assert!(legacy_sources("", "").is_ok());
        assert!(legacy_sources("packages/starchess-core/src/index.ts\n", "").is_err());
        assert!(legacy_sources("", "_spec/corpora/new.json\n").is_err());
        assert!(legacy_sources("_spec/ml/R4.md\n", "new.ts\n").is_err());
        for path in [
            "packages/starchess-core",
            "_spec/evidence",
            "_spec/corpora",
            "_spec/ml/R4.md",
        ] {
            assert!(LEGACY_PATHS.contains(&path));
        }
    }

    #[test]
    fn lock_preserves_semantics_and_allows_only_new_bridge_importer_and_tools() {
        let old: Yaml = serde_yaml::from_str(LOCK).unwrap();
        let mut new = old.clone();
        new["importers"]["apps/arena"] = Yaml::Mapping(Mapping::new());
        new["importers"]["."]["devDependencies"]["tsx"] =
            serde_yaml::from_str("{specifier: 4.23.12, version: 4.23.12}").unwrap();
        new["packages"]["tsx@4.23.12"] = Yaml::Mapping(Mapping::new());
        assert!(lock(LOCK, &serde_yaml::to_string(&new).unwrap()).is_ok());
    }

    #[test]
    fn lock_rejects_changed_resolution_snapshot_importer_nx_and_unapproved_tools() {
        for path in [
            ["packages", "a@1", "resolution"],
            ["snapshots", "a@1", "dependencies"],
            ["importers", "packages/starchess-core", "dependencies"],
            ["importers", ".", "devDependencies"],
        ] {
            let mut changed: Yaml = serde_yaml::from_str(LOCK).unwrap();
            changed[path[0]][path[1]][path[2]] = Yaml::String("changed".into());
            assert!(lock(LOCK, &serde_yaml::to_string(&changed).unwrap()).is_err());
        }
        for importer in ["packages/training", "apps/unrelated"] {
            let mut changed: Yaml = serde_yaml::from_str(LOCK).unwrap();
            changed["importers"][importer] = Yaml::Mapping(Mapping::new());
            assert!(lock(LOCK, &serde_yaml::to_string(&changed).unwrap()).is_err());
        }
        let changed = LOCK.replace("nx: {", "unapproved: {");
        assert!(lock(LOCK, &changed).is_err());
        assert!(lock(LOCK, "{}").is_err());
    }

    #[test]
    fn root_package_preserves_nx_and_rejects_runtime_or_unapproved_additions() {
        let old = json!({"devDependencies": {"nx": "^21.6.11"}});
        let mut new = old.clone();
        new["devDependencies"]["tsx"] = json!("4.23.12");
        assert!(root_package(&old, &new).is_ok());
        new["devDependencies"]["nx"] = json!("^22");
        assert!(root_package(&old, &new).is_err());
        let mut new = old.clone();
        new["dependencies"] = json!({"tsx": "4.23.12"});
        assert!(root_package(&old, &new).is_err());
        let mut new = old.clone();
        new["devDependencies"]["bun"] = json!("1");
        assert!(root_package(&old, &new).is_err());
    }

    #[test]
    fn index_preserves_prefix_and_checks_literal_coverage_and_pointers() {
        let root = crate::test_directory();
        for owner in [TRAINING_SPEC, ARENA_SPEC] {
            std::fs::create_dir_all(root.join(owner).parent().unwrap()).unwrap();
            std::fs::write(
                root.join(owner),
                "' covers: source.rs\n@startuml\n@enduml\n",
            )
            .unwrap();
        }
        std::fs::write(
            root.join("source.rs"),
            format!("// SPEC: {TRAINING_SPEC}, {ARENA_SPEC}\n"),
        )
        .unwrap();
        let old = json!({"version": 1, "specs": vec![json!({"spec": "old", "covers": []}); 43], "unresolved": []});
        let mut new = old.clone();
        for owner in [TRAINING_SPEC, ARENA_SPEC] {
            new["specs"]
                .as_array_mut()
                .unwrap()
                .push(json!({"spec": owner, "covers": ["source.rs"], "fingerprint": null}));
        }
        assert!(spec_index(&root, &old, &new).is_ok());
        assert!(spec_index(&root, &new, &new).is_ok());
        let mut extra = new.clone();
        extra["specs"]
            .as_array_mut()
            .unwrap()
            .push(json!({"spec": "unexpected", "covers": []}));
        assert!(spec_index(&root, &old, &extra).is_err());
        let mut changed = new.clone();
        changed["specs"][0]["covers"] = json!(["changed"]);
        assert!(spec_index(&root, &old, &changed).is_err());
        let mut changed = new.clone();
        changed["unresolved"] = json!(["changed"]);
        assert!(spec_index(&root, &old, &changed).is_err());
        let mut changed = new.clone();
        changed["specs"][43]["covers"] = json!(["missing.rs"]);
        assert!(spec_index(&root, &old, &changed).is_err());
        std::fs::write(root.join("source.rs"), "// no pointer\n").unwrap();
        assert!(spec_index(&root, &old, &new).is_err());
        let mut javascript = new.clone();
        for (index, owner) in [TRAINING_SPEC, ARENA_SPEC].iter().enumerate() {
            std::fs::write(
                root.join(owner),
                "' covers: source.mjs\n@startuml\n@enduml\n",
            )
            .unwrap();
            javascript["specs"][43 + index]["covers"] = json!(["source.mjs"]);
        }
        std::fs::write(
            root.join("source.mjs"),
            format!("// SPEC: {TRAINING_SPEC}, {ARENA_SPEC}\n"),
        )
        .unwrap();
        assert!(spec_index(&root, &old, &javascript).is_ok());
        std::fs::write(root.join("source.mjs"), "// no pointer\n").unwrap();
        assert!(spec_index(&root, &old, &javascript).is_err());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn geometry_import_boundary_allows_only_native_planning_helpers() {
        let repository = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .unwrap();
        let fixture = crate::test_directory();
        let source = fixture.join("apps/arena/engine/feature-geometry.ts");
        std::fs::create_dir_all(source.parent().unwrap()).unwrap();
        let configuration = fixture.join("oxlint.training.json");
        std::fs::copy(repository.join("oxlint.training.json"), &configuration).unwrap();
        let mut gate = crate::runner::Gate::new(repository).unwrap();
        let cases = [
            ("@chess-coach/starchess-core/planning-v1", true),
            ("@chess-coach/starchess-core", false),
            ("@chess-coach/starchess-core/board/vision", false),
            ("@chess-coach/starchess-core/planning-v1/extra", false),
            ("@CHESS-COACH/starchess-core/planning-v1", false),
            ("@chess-coach/starchess-arena/observations", false),
            ("@chess-coach/starchess-training/candidates", false),
            ("node:fs", false),
            ("fs", false),
            ("fs/promises", false),
            ("child_process", false),
            ("./economic-wire", false),
            ("./session", false),
            ("../host", false),
            ("unapproved-package", false),
        ];
        for (index, (module, allowed)) in cases.iter().enumerate() {
            std::fs::write(
                &source,
                format!("import * as probe from {module:?};\nexport {{ probe }};\n"),
            )
            .unwrap();
            let name = format!("geometry-import-{index}");
            let result = gate.command(
                &name,
                &[
                    "pnpm",
                    "exec",
                    "oxlint",
                    "--no-ignore",
                    "--deny-warnings",
                    "-c",
                    configuration.to_str().unwrap(),
                    source.to_str().unwrap(),
                ],
            );
            if *allowed {
                result.unwrap();
            } else {
                assert!(result.is_err(), "accepted {module}");
                assert_eq!(gate.results.last().unwrap()["exit"], json!(1));
                let stdout =
                    std::fs::read_to_string(gate.directory.join(format!("{name}.stdout"))).unwrap();
                let stderr = gate.last_stderr().unwrap();
                assert!(
                    stdout.contains("no-restricted-imports")
                        || stderr.contains("no-restricted-imports"),
                    "wrong refusal for {module}: {stdout}{stderr}"
                );
            }
        }
        std::fs::remove_dir_all(gate.directory).unwrap();
        std::fs::remove_dir_all(fixture).unwrap();
    }
}

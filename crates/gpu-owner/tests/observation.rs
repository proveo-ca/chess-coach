// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
#![forbid(unsafe_code)]

#[allow(dead_code)]
mod support;

use chess_coach_gpu_owner::{OwnerError, input::OwnerInput, observe::Observer};
use std::{
    collections::BTreeMap,
    fs,
    os::unix::fs::{MetadataExt, symlink},
    path::{Path, PathBuf},
};
use support::Fixture;

const PID: u32 = u32::MAX - 1;
const CONTROLS: [&str; 7] = [
    "cpu.max",
    "memory.max",
    "memory.swap.max",
    "pids.max",
    "cpuset.cpus.effective",
    "cgroup.procs",
    "cgroup.threads",
];

fn fixture() -> (Fixture, OwnerInput, Observer) {
    let fixture = Fixture::new("normal");
    let input: OwnerInput = serde_json::from_value(fixture.manifest.clone()).unwrap();
    let observer = Observer::new(&input).unwrap();
    (fixture, input, observer)
}

fn cgroup(path: &Path, procs: &str) {
    fs::create_dir(path).unwrap();
    for (name, value) in [
        ("cpu.max", "400000 100000\n"),
        ("memory.max", "8589934592\n"),
        ("memory.swap.max", "0\n"),
        ("pids.max", "512\n"),
        ("cpuset.cpus.effective", "1,2,3,4\n"),
        ("cgroup.procs", procs),
        ("cgroup.threads", procs),
    ] {
        fs::write(path.join(name), value).unwrap();
    }
}

fn leaf(input: &OwnerInput, relative: &str) -> PathBuf {
    let mut path = PathBuf::from(&input.observation.approved_job_parent_absolute_path);
    let parts: Vec<_> = relative.split('/').collect();
    for (index, part) in parts.iter().enumerate() {
        path.push(part);
        let procs = if index + 1 == parts.len() {
            format!("{PID}\n")
        } else {
            String::new()
        };
        cgroup(&path, &procs);
    }
    let proc = Path::new(&input.observation.proc_root).join(PID.to_string());
    fs::create_dir_all(&proc).unwrap();
    let hierarchy = path
        .to_str()
        .unwrap()
        .strip_prefix(&input.observation.cgroup_root)
        .unwrap();
    fs::write(proc.join("cgroup"), format!("0::{hierarchy}\n")).unwrap();
    path
}

fn remove_cgroup(path: &Path) {
    for control in CONTROLS {
        fs::remove_file(path.join(control)).unwrap();
    }
    fs::remove_dir(path).unwrap();
}

fn identity(path: &Path) -> (u64, u64) {
    let metadata = fs::metadata(path).unwrap();
    (metadata.dev(), metadata.ino())
}

fn directory_fds(root: &Path) -> BTreeMap<u32, (u64, u64)> {
    fs::read_dir("/proc/self/fd")
        .unwrap()
        .filter_map(|entry| {
            let entry = entry.unwrap();
            let target = fs::read_link(entry.path()).ok()?;
            let metadata = fs::metadata(entry.path()).ok()?;
            if target.starts_with(root) && metadata.is_dir() {
                Some((
                    entry.file_name().to_str().unwrap().parse().unwrap(),
                    (metadata.dev(), metadata.ino()),
                ))
            } else {
                None
            }
        })
        .collect()
}

#[test]
fn unbound_observer_does_not_claim_disappearance() {
    let (_fixture, _input, observer) = fixture();
    assert_eq!(observer.bound_path(), None);
    assert!(!observer.gone().unwrap());
}

#[test]
fn an_empty_retained_nested_leaf_is_not_gone() {
    let (_fixture, input, mut observer) = fixture();
    let path = leaf(&input, "a/b/leaf");
    observer.bind(PID, &input).unwrap();
    fs::write(path.join("cgroup.procs"), "").unwrap();
    fs::write(path.join("cgroup.threads"), "").unwrap();
    observer.stable().unwrap();
    assert!(!observer.gone().unwrap());
}

#[test]
fn renamed_ancestor_with_empty_replacement_faults_while_owned_leaf_survives() {
    let (fixture, input, mut observer) = fixture();
    let path = leaf(&input, "a/leaf");
    observer.bind(PID, &input).unwrap();
    let ancestor = path.parent().unwrap();
    let relocated = fixture.root.join("relocated");
    fs::rename(ancestor, &relocated).unwrap();
    fs::create_dir(ancestor).unwrap();
    assert!(relocated.join("leaf").is_dir());
    assert!(observer.stable().is_err());
    assert!(observer.gone().is_err());
}

#[test]
fn replacement_of_an_inner_ancestor_faults() {
    let (fixture, input, mut observer) = fixture();
    let path = leaf(&input, "a/b/leaf");
    observer.bind(PID, &input).unwrap();
    let ancestor = path.parent().unwrap();
    let relocated = fixture.root.join("relocated-b");
    fs::rename(ancestor, &relocated).unwrap();
    fs::create_dir(ancestor).unwrap();
    assert!(relocated.join("leaf").is_dir());
    assert!(observer.gone().is_err());
}

#[test]
fn replacement_of_an_outer_ancestor_faults() {
    let (fixture, input, mut observer) = fixture();
    let path = leaf(&input, "a/b/leaf");
    observer.bind(PID, &input).unwrap();
    let ancestor = path.parent().unwrap().parent().unwrap();
    let relocated = fixture.root.join("relocated-a");
    fs::rename(ancestor, &relocated).unwrap();
    fs::create_dir(ancestor).unwrap();
    assert!(relocated.join("b/leaf").is_dir());
    assert!(observer.gone().is_err());
}

#[test]
fn missing_intermediate_ancestor_faults_instead_of_reporting_gone() {
    let (fixture, input, mut observer) = fixture();
    let path = leaf(&input, "a/leaf");
    observer.bind(PID, &input).unwrap();
    let relocated = fixture.root.join("relocated");
    fs::rename(path.parent().unwrap(), &relocated).unwrap();
    assert!(relocated.join("leaf").is_dir());
    assert!(observer.gone().is_err());
}

#[test]
fn honest_nested_leaf_removal_reports_gone_and_keeps_the_leaf_inode_pinned() {
    let (fixture, input, mut observer) = fixture();
    let path = leaf(&input, "a/b/leaf");
    let expected = identity(&path);
    observer.bind(PID, &input).unwrap();
    assert!(
        directory_fds(&fixture.root)
            .values()
            .any(|id| *id == expected)
    );
    remove_cgroup(&path);
    observer.stable().unwrap();
    assert!(observer.gone().unwrap());
    assert!(
        directory_fds(&fixture.root)
            .values()
            .any(|id| *id == expected)
    );
    assert_eq!(observer.bound_path(), path.to_str());
}

#[test]
fn honest_direct_child_removal_reports_gone() {
    let (_fixture, input, mut observer) = fixture();
    let path = leaf(&input, "leaf");
    observer.bind(PID, &input).unwrap();
    assert!(!observer.gone().unwrap());
    remove_cgroup(&path);
    observer.stable().unwrap();
    assert!(observer.gone().unwrap());
}

fn retained_renamed_leaf_faults(relative: &str) {
    let (_fixture, input, mut observer) = fixture();
    let path = leaf(&input, relative);
    observer.bind(PID, &input).unwrap();
    let retained = path.with_file_name("retained-leaf");
    fs::rename(&path, &retained).unwrap();
    assert!(!path.exists());
    assert!(retained.is_dir());
    observer.stable().unwrap();
    assert_eq!(observer.gone().unwrap_err(), OwnerError("C8_DISAPPEARANCE"));
}

#[test]
fn renaming_a_direct_child_leaf_does_not_prove_namespace_removal() {
    retained_renamed_leaf_faults("leaf");
}

#[test]
fn renaming_a_nested_leaf_does_not_prove_namespace_removal() {
    retained_renamed_leaf_faults("a/b/leaf");
}

#[test]
fn intermediate_symlink_substitution_faults() {
    let (fixture, input, mut observer) = fixture();
    let path = leaf(&input, "a/leaf");
    observer.bind(PID, &input).unwrap();
    let ancestor = path.parent().unwrap();
    let relocated = fixture.root.join("relocated");
    fs::rename(ancestor, &relocated).unwrap();
    symlink(&relocated, ancestor).unwrap();
    assert!(relocated.join("leaf").is_dir());
    assert!(observer.stable().is_err());
    assert!(observer.gone().is_err());
}

#[test]
fn root_and_approved_parent_replacements_never_report_gone() {
    for relative in [
        "proc",
        "cgroup",
        "cgroup/aggregate",
        "cgroup/aggregate/jobs",
    ] {
        let (fixture, input, mut observer) = fixture();
        let path = leaf(&input, "a/leaf");
        observer.bind(PID, &input).unwrap();
        let target = fixture.root.join(relative);
        let relocated = fixture.root.join("relocated");
        fs::rename(&target, &relocated).unwrap();
        fs::create_dir(&target).unwrap();
        let retained = match path.strip_prefix(&target) {
            Ok(relative) => relocated.join(relative),
            Err(_) => path,
        };
        assert!(retained.is_dir());
        assert!(observer.stable().is_err());
        assert!(observer.gone().is_err());
    }
}

#[test]
fn repeated_binding_retains_the_same_custody_without_accumulating_fds() {
    let (fixture, input, mut observer) = fixture();
    let path = leaf(&input, "a/b/leaf");
    let before = directory_fds(&fixture.root);
    observer.bind(PID, &input).unwrap();
    let bound = directory_fds(&fixture.root);
    assert_eq!(bound.len(), before.len() + 3);
    for expected in [
        identity(&path),
        identity(path.parent().unwrap()),
        identity(path.parent().unwrap().parent().unwrap()),
    ] {
        assert_eq!(bound.values().filter(|id| **id == expected).count(), 1);
    }
    for _ in 0..32 {
        observer.bind(PID, &input).unwrap();
        assert_eq!(directory_fds(&fixture.root), bound);
    }
    assert_eq!(observer.bound_path(), path.to_str());
    assert!(!observer.gone().unwrap());
}

#[test]
fn replacing_the_leaf_rejects_rebinding_and_preserves_established_custody() {
    let (fixture, input, mut observer) = fixture();
    let path = leaf(&input, "a/leaf");
    observer.bind(PID, &input).unwrap();
    let before = directory_fds(&fixture.root);
    let relocated = fixture.root.join("retained-leaf");
    fs::rename(&path, &relocated).unwrap();
    cgroup(&path, &format!("{PID}\n"));
    assert_eq!(
        observer.bind(PID, &input).unwrap_err(),
        OwnerError("C8_REBOUND")
    );
    assert_eq!(directory_fds(&fixture.root), before);
    assert_eq!(observer.bound_path(), path.to_str());
    assert!(relocated.is_dir());
    assert_eq!(observer.gone().unwrap_err(), OwnerError("C8_REPLACED"));
}

#[test]
fn changing_the_bound_path_rejects_rebinding() {
    let (fixture, input, mut observer) = fixture();
    let original = leaf(&input, "a/leaf");
    observer.bind(PID, &input).unwrap();
    let before = directory_fds(&fixture.root);
    let replacement = leaf(&input, "b/leaf");
    assert_eq!(
        observer.bind(PID, &input).unwrap_err(),
        OwnerError("C8_REBOUND")
    );
    assert_eq!(directory_fds(&fixture.root), before);
    assert_eq!(observer.bound_path(), original.to_str());
    assert!(replacement.is_dir());
    assert!(!observer.gone().unwrap());
}

#[test]
fn failed_validation_does_not_establish_custody_or_leak_fds() {
    let (fixture, input, mut observer) = fixture();
    let path = leaf(&input, "a/b/leaf");
    fs::write(path.join("pids.max"), "513\n").unwrap();
    let before = directory_fds(&fixture.root);
    assert_eq!(observer.bind(PID, &input).unwrap_err(), OwnerError("C8_C2"));
    assert_eq!(observer.bound_path(), None);
    assert_eq!(directory_fds(&fixture.root), before);
    assert!(!observer.gone().unwrap());
    fs::write(path.join("pids.max"), "512\n").unwrap();
    observer.bind(PID, &input).unwrap();
    assert_eq!(observer.bound_path(), path.to_str());
}

#[test]
fn failed_revalidation_does_not_replace_established_custody() {
    let (fixture, input, mut observer) = fixture();
    let path = leaf(&input, "a/b/leaf");
    observer.bind(PID, &input).unwrap();
    let before = directory_fds(&fixture.root);
    fs::write(path.join("pids.max"), "513\n").unwrap();
    assert_eq!(observer.bind(PID, &input).unwrap_err(), OwnerError("C8_C2"));
    assert_eq!(directory_fds(&fixture.root), before);
    assert_eq!(observer.bound_path(), path.to_str());
    fs::write(path.join("pids.max"), "512\n").unwrap();
    observer.bind(PID, &input).unwrap();
    assert_eq!(directory_fds(&fixture.root), before);
}

#[test]
fn replacing_an_ancestor_cannot_rebind_even_when_the_leaf_identity_matches() {
    let (fixture, input, mut observer) = fixture();
    let path = leaf(&input, "a/leaf");
    let expected = identity(&path);
    observer.bind(PID, &input).unwrap();
    let ancestor = path.parent().unwrap();
    let relocated = fixture.root.join("relocated");
    fs::rename(ancestor, &relocated).unwrap();
    cgroup(ancestor, "");
    fs::rename(relocated.join("leaf"), &path).unwrap();
    assert_eq!(identity(&path), expected);
    assert!(observer.bind(PID, &input).is_err());
    assert_eq!(observer.bound_path(), path.to_str());
    assert!(observer.gone().is_err());
}

#[test]
fn leaf_symlink_substitution_faults_instead_of_reporting_gone() {
    let (fixture, input, mut observer) = fixture();
    let path = leaf(&input, "a/leaf");
    observer.bind(PID, &input).unwrap();
    let relocated = fixture.root.join("retained-leaf");
    fs::rename(&path, &relocated).unwrap();
    symlink(&relocated, &path).unwrap();
    assert!(relocated.is_dir());
    assert!(observer.gone().is_err());
}

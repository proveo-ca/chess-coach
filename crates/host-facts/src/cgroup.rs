// SPEC: _spec/host-entrypoint.puml
use rustix::fd::OwnedFd;
use rustix::fs::{AtFlags, Mode, OFlags, Statx, StatxFlags, open, openat, statx};
use serde::Serialize;
use std::fs::File;
use std::io::Read;
use std::path::{Component, Path};

pub(crate) struct ObservationDirectory {
    directory: OwnedFd,
    _parents: Vec<OwnedFd>,
}

impl ObservationDirectory {
    fn open(root: &Path) -> Result<Self, &'static str> {
        let flags = OFlags::PATH | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC;
        let mut parents = vec![open(root, flags, Mode::empty()).map_err(|_| "CGROUP_DIRECTORY")?];
        for component in ["sys", "fs"] {
            let parent = parents.last().ok_or("CGROUP_DIRECTORY")?;
            parents.push(
                openat(parent, component, flags, Mode::empty()).map_err(|_| "CGROUP_DIRECTORY")?,
            );
        }
        let parent = parents.last().ok_or("CGROUP_DIRECTORY")?;
        let directory =
            openat(parent, "cgroup", flags, Mode::empty()).map_err(|_| "CGROUP_DIRECTORY")?;
        Ok(Self {
            directory,
            _parents: parents,
        })
    }

    fn mount_id(&self) -> Result<u64, &'static str> {
        checked_mount_id(statx(
            &self.directory,
            c"",
            AtFlags::EMPTY_PATH | AtFlags::NO_AUTOMOUNT,
            StatxFlags::MNT_ID,
        ))
    }
}

fn checked_mount_id(metadata: rustix::io::Result<Statx>) -> Result<u64, &'static str> {
    let metadata = metadata.map_err(|_| "CGROUP_MOUNT_ID")?;
    if metadata.stx_mask & StatxFlags::MNT_ID.bits() == 0 || metadata.stx_mnt_id == 0 {
        return Err("CGROUP_MOUNT_ID");
    }
    Ok(metadata.stx_mnt_id)
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CgroupFacts {
    self_membership: Option<String>,
    mount: Option<MountFacts>,
    exposes_cgroup_v2: Option<bool>,
    controllers: Option<Controllers>,
    subtree_control: Option<Controllers>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MountFacts {
    mountpoint: String,
    major_minor: String,
    filesystem_type: String,
    mount_options: String,
}

#[derive(Serialize)]
#[serde(untagged)]
enum Controllers {
    Known(Vec<String>),
    Unavailable {
        #[serde(rename = "unavailableErrno")]
        unavailable_errno: i32,
    },
}

enum ReadError {
    Io(i32),
    Bound,
    Text,
}

impl ReadError {
    fn code(&self) -> &'static str {
        match self {
            Self::Io(_) => "CGROUP_READ",
            Self::Bound => "CGROUP_BYTE_BOUND",
            Self::Text => "CGROUP_TEXT",
        }
    }
}

fn read_bounded(root: &Path, path: &str, limit: usize) -> Result<String, ReadError> {
    let descriptor = open(
        root.join(path),
        OFlags::RDONLY | OFlags::CLOEXEC | OFlags::NOFOLLOW,
        Mode::empty(),
    )
    .map_err(|error| ReadError::Io(error.raw_os_error()))?;
    read_descriptor(descriptor, limit)
}

fn read_descriptor(descriptor: OwnedFd, limit: usize) -> Result<String, ReadError> {
    let mut bytes = Vec::new();
    File::from(descriptor)
        .take((limit + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| ReadError::Io(error.raw_os_error().unwrap_or(0)))?;
    if bytes.len() > limit {
        return Err(ReadError::Bound);
    }
    String::from_utf8(bytes).map_err(|_| ReadError::Text)
}

fn decode_mountpoint(encoded: &str) -> Result<String, &'static str> {
    let mut decoded = Vec::with_capacity(encoded.len());
    let mut pending = encoded.as_bytes();
    while let Some((&byte, rest)) = pending.split_first() {
        if byte == b'\\' {
            let escape = rest.get(..3).ok_or("CGROUP_MOUNTINFO")?;
            decoded.push(match escape {
                b"040" => b' ',
                b"011" => b'\t',
                b"012" => b'\n',
                b"134" => b'\\',
                _ => return Err("CGROUP_MOUNTINFO"),
            });
            pending = &rest[3..];
        } else {
            if byte == 0 {
                return Err("CGROUP_MOUNTINFO");
            }
            decoded.push(byte);
            pending = rest;
        }
    }
    String::from_utf8(decoded).map_err(|_| "CGROUP_MOUNTINFO")
}

fn mount_projection(text: &str, visible_id: u64) -> Result<MountFacts, &'static str> {
    let mut selected: Option<MountFacts> = None;
    for line in text.lines() {
        let (head, tail) = line.split_once(" - ").ok_or("CGROUP_MOUNTINFO")?;
        let head: Vec<_> = head.split_whitespace().collect();
        let tail: Vec<_> = tail.split_whitespace().collect();
        if head.len() < 6 || tail.len() < 3 {
            return Err("CGROUP_MOUNTINFO");
        }
        let id = head[0].parse::<u64>().map_err(|_| "CGROUP_MOUNTINFO")?;
        head[1].parse::<u64>().map_err(|_| "CGROUP_MOUNTINFO")?;
        if id == 0 {
            return Err("CGROUP_MOUNTINFO");
        }
        if id == visible_id {
            if selected.is_some() {
                return Err("CGROUP_MOUNT_DUPLICATE");
            }
            let mountpoint = decode_mountpoint(head[4])?;
            let path = Path::new(&mountpoint);
            if !path.is_absolute()
                || path
                    .components()
                    .any(|component| matches!(component, Component::CurDir | Component::ParentDir))
                || !Path::new("/sys/fs/cgroup").starts_with(path)
                || head[2].len() > 32
                || head[5].len() > 256
                || tail[0].len() > 64
                || head[5].bytes().any(|value| value.is_ascii_control())
                || tail[0].bytes().any(|value| value.is_ascii_control())
            {
                return Err("CGROUP_MOUNTINFO");
            }
            let (major, minor) = head[2].split_once(':').ok_or("CGROUP_MOUNTINFO")?;
            major.parse::<u32>().map_err(|_| "CGROUP_MOUNTINFO")?;
            minor.parse::<u32>().map_err(|_| "CGROUP_MOUNTINFO")?;
            selected = Some(MountFacts {
                mountpoint,
                major_minor: head[2].into(),
                filesystem_type: tail[0].into(),
                mount_options: head[5].into(),
            });
        }
    }
    selected.ok_or("CGROUP_MOUNT_NOT_FOUND")
}

fn controllers(directory: &ObservationDirectory, name: &str) -> Result<Controllers, &'static str> {
    let descriptor = openat(
        &directory.directory,
        name,
        OFlags::RDONLY | OFlags::CLOEXEC | OFlags::NOFOLLOW,
        Mode::empty(),
    );
    let text = match descriptor
        .map_err(|error| ReadError::Io(error.raw_os_error()))
        .and_then(|descriptor| read_descriptor(descriptor, 65_536))
    {
        Ok(text) => text,
        Err(ReadError::Io(errno)) => {
            return Ok(Controllers::Unavailable {
                unavailable_errno: errno,
            });
        }
        Err(error) => return Err(error.code()),
    };
    let mut values = Vec::new();
    for token in text.split_whitespace() {
        if values.len() >= 32
            || token.len() > 32
            || !token.as_bytes().first().is_some_and(u8::is_ascii_lowercase)
            || !token
                .bytes()
                .all(|value| value.is_ascii_lowercase() || value.is_ascii_digit() || value == b'_')
            || values.iter().any(|value| value == token)
        {
            return Err("CGROUP_CONTROLLER_FORMAT");
        }
        values.push(token.to_owned());
    }
    Ok(Controllers::Known(values))
}

pub(crate) fn collect(
    root: &Path,
    result: &mut CgroupFacts,
) -> Result<ObservationDirectory, &'static str> {
    *result = CgroupFacts::default();
    result.self_membership =
        Some(read_bounded(root, "proc/self/cgroup", 65_536).map_err(|error| error.code())?);
    let directory = ObservationDirectory::open(root)?;
    let visible_id = directory.mount_id()?;
    let mounts =
        read_bounded(root, "proc/self/mountinfo", 262_144).map_err(|error| error.code())?;
    let mount = mount_projection(&mounts, visible_id)?;
    result.exposes_cgroup_v2 = Some(mount.filesystem_type == "cgroup2");
    result.mount = Some(mount);
    result.controllers = Some(controllers(&directory, "cgroup.controllers")?);
    result.subtree_control = Some(controllers(&directory, "cgroup.subtree_control")?);
    Ok(directory)
}

#[cfg(test)]
fn fixture_mount_id(root: &Path) -> u64 {
    let directory = open(
        root.join("sys/fs/cgroup"),
        OFlags::PATH | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
        Mode::empty(),
    )
    .unwrap();
    let metadata = statx(&directory, c"", AtFlags::EMPTY_PATH, StatxFlags::MNT_ID).unwrap();
    assert_ne!(metadata.stx_mask & StatxFlags::MNT_ID.bits(), 0);
    metadata.stx_mnt_id
}

#[cfg(test)]
pub(crate) fn fixture(root: &Path) {
    std::fs::create_dir_all(root.join("proc/self")).unwrap();
    std::fs::create_dir_all(root.join("sys/fs/cgroup")).unwrap();
    std::fs::write(root.join("proc/self/cgroup"), "0::/synthetic-self\n").unwrap();
    let id = fixture_mount_id(root);
    let parent_id = id.checked_add(1).unwrap();
    std::fs::write(root.join("proc/self/mountinfo"), format!("{parent_id} 0 0:1 / / rw - tmpfs CANARY_SOURCE rw,CANARY_SUPEROPTION\n{id} {parent_id} 0:2 / /sys/fs/cgroup ro - cgroup2 CANARY_SOURCE rw,CANARY_SUPEROPTION\n")).unwrap();
    std::fs::write(
        root.join("sys/fs/cgroup/cgroup.controllers"),
        "cpu memory pids\n",
    )
    .unwrap();
    std::fs::write(
        root.join("sys/fs/cgroup/cgroup.subtree_control"),
        "cpu memory\n",
    )
    .unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cgroup_projection_reads_only_selected_fixture_files_and_omits_sources() {
        let root = tempfile::tempdir_in("/tmp/opencode").unwrap();
        fixture(root.path());
        let mut result = CgroupFacts::default();
        collect(root.path(), &mut result).unwrap();
        let encoded = serde_json::to_string(&result).unwrap();
        assert!(encoded.contains("synthetic-self"));
        assert!(encoded.contains("\"exposesCgroupV2\":true"));
        assert!(!encoded.contains("CANARY"));
    }

    #[test]
    fn cgroup_missing_v2_files_remain_unavailable_not_qualified() {
        let root = tempfile::tempdir_in("/tmp/opencode").unwrap();
        fixture(root.path());
        std::fs::remove_file(root.path().join("sys/fs/cgroup/cgroup.controllers")).unwrap();
        std::fs::write(
            root.path().join("proc/self/mountinfo"),
            format!(
                "{} 0 0:1 / / rw - tmpfs ignored rw\n",
                fixture_mount_id(root.path())
            ),
        )
        .unwrap();
        let mut result = CgroupFacts::default();
        collect(root.path(), &mut result).unwrap();
        let encoded = serde_json::to_string(&result).unwrap();
        assert!(encoded.contains("\"exposesCgroupV2\":false"));
        assert!(encoded.contains("unavailableErrno"));
    }

    #[test]
    fn cgroup_byte_bound_and_malformed_controllers_preserve_prior_facts() {
        let root = tempfile::tempdir_in("/tmp/opencode").unwrap();
        fixture(root.path());
        std::fs::write(root.path().join("proc/self/mountinfo"), vec![b'x'; 262_145]).unwrap();
        let mut result = CgroupFacts::default();
        assert!(matches!(
            collect(root.path(), &mut result),
            Err("CGROUP_BYTE_BOUND")
        ));
        assert!(result.self_membership.is_some());
        fixture(root.path());
        std::fs::write(
            root.path().join("sys/fs/cgroup/cgroup.controllers"),
            "cpu cpu",
        )
        .unwrap();
        assert!(matches!(
            collect(root.path(), &mut result),
            Err("CGROUP_CONTROLLER_FORMAT")
        ));
        assert!(result.mount.is_some());
    }

    #[test]
    fn cgroup_mount_selection_uses_fd_identity_not_equal_path_order() {
        let hidden = "41 1 0:2 / /sys/fs/cgroup ro - cgroup2 CANARY_SOURCE rw";
        let visible = "42 41 0:3 / /sys/fs/cgroup rw - tmpfs CANARY_SOURCE rw";
        for rows in [[hidden, visible], [visible, hidden]] {
            let result = mount_projection(&rows.join("\n"), 42).unwrap();
            assert_eq!(result.filesystem_type, "tmpfs");
            let encoded = serde_json::to_string(&result).unwrap();
            assert!(!encoded.contains("CANARY"));
            assert!(!encoded.contains("mountId"));
            assert!(!encoded.contains("42"));
        }
    }

    #[test]
    fn cgroup_hidden_child_cannot_override_the_pinned_ancestor_mount() {
        let rows = "1 0 0:1 / / rw - tmpfs ignored rw\n2 1 0:2 / /sys ro - sysfs ignored ro\n3 2 0:3 / /sys/fs/cgroup ro - cgroup2 ignored ro\n4 1 0:4 / /sys rw - tmpfs ignored rw\n";
        let result = mount_projection(rows, 4).unwrap();
        assert_eq!(result.mountpoint, "/sys");
        assert_eq!(result.filesystem_type, "tmpfs");
    }

    #[test]
    fn cgroup_mount_binding_rejects_missing_duplicate_malformed_and_inconsistent_rows() {
        for rows in [
            "1 0 0:1 / / rw - tmpfs ignored rw",
            "9 1 0:2 / /sys/fs/cgroup ro - cgroup2 ignored ro\n9 1 0:3 / /sys rw - tmpfs ignored rw",
            "invalid 0 0:1 / / rw - tmpfs ignored rw",
            "9 invalid 0:1 / / rw - tmpfs ignored rw",
            "0 0 0:1 / / rw - tmpfs ignored rw",
            "9 1 0:2 / /sys/fs/cgroup-other ro - cgroup2 ignored ro",
            "9 1 0:2 / /sys/fs/cgroup/child ro - cgroup2 ignored ro",
            "9 1 0:2 / sys/fs/cgroup ro - cgroup2 ignored ro",
            r"9 1 0:2 / /sys\040shadow ro - cgroup2 ignored ro",
            r"9 1 0:2 / /sys\000 ro - cgroup2 ignored ro",
            "9 1 invalid:2 / /sys/fs/cgroup ro - cgroup2 ignored ro",
            "9 1 0:2 / /sys/fs/cgroup ro",
        ] {
            assert!(mount_projection(rows, 9).is_err(), "{rows}");
        }
    }

    #[test]
    fn cgroup_mountpoint_escaping_is_decoded_before_ancestry_checks() {
        assert_eq!(
            decode_mountpoint(r"/with\040space\134slash\011tab\012line").unwrap(),
            "/with space\\slash\ttab\nline"
        );
        assert_eq!(
            decode_mountpoint(r"/invalid\077escape"),
            Err("CGROUP_MOUNTINFO")
        );
        assert_eq!(decode_mountpoint("/incomplete\\"), Err("CGROUP_MOUNTINFO"));
        assert_eq!(decode_mountpoint("/nul\0"), Err("CGROUP_MOUNTINFO"));
    }

    #[test]
    fn cgroup_statx_requires_a_supported_nonzero_ordinary_mount_id() {
        let root = tempfile::tempdir_in("/tmp/opencode").unwrap();
        fixture(root.path());
        let directory = ObservationDirectory::open(root.path()).unwrap();
        let mut metadata = statx(
            &directory.directory,
            c"",
            AtFlags::EMPTY_PATH,
            StatxFlags::MNT_ID,
        )
        .unwrap();
        assert_ne!(metadata.stx_mask & 0x1000, 0);
        assert_eq!(directory.mount_id().unwrap(), fixture_mount_id(root.path()));
        metadata.stx_mask &= !0x1000;
        assert_eq!(checked_mount_id(Ok(metadata)), Err("CGROUP_MOUNT_ID"));
        metadata.stx_mask |= 0x1000;
        metadata.stx_mnt_id = 0;
        assert_eq!(checked_mount_id(Ok(metadata)), Err("CGROUP_MOUNT_ID"));
        assert_eq!(
            checked_mount_id(Err(rustix::io::Errno::NOSYS)),
            Err("CGROUP_MOUNT_ID")
        );
    }

    #[test]
    fn cgroup_controller_reads_stay_with_the_pinned_directory_after_replacement() {
        let root = tempfile::tempdir_in("/tmp/opencode").unwrap();
        fixture(root.path());
        let directory = ObservationDirectory::open(root.path()).unwrap();
        std::fs::rename(
            root.path().join("sys/fs/cgroup"),
            root.path().join("sys/fs/old-cgroup"),
        )
        .unwrap();
        std::fs::create_dir(root.path().join("sys/fs/cgroup")).unwrap();
        std::fs::write(
            root.path().join("sys/fs/cgroup/cgroup.controllers"),
            "replacement",
        )
        .unwrap();
        let result = controllers(&directory, "cgroup.controllers").unwrap();
        assert_eq!(
            serde_json::to_string(&result).unwrap(),
            r#"["cpu","memory","pids"]"#
        );
    }

    #[test]
    fn cgroup_failed_binding_leaves_the_view_unknown_and_retains_partial_facts() {
        let root = tempfile::tempdir_in("/tmp/opencode").unwrap();
        fixture(root.path());
        let mut result = CgroupFacts::default();
        let _guard = collect(root.path(), &mut result).unwrap();
        assert_eq!(result.exposes_cgroup_v2, Some(true));
        let missing_id = fixture_mount_id(root.path()).checked_add(1).unwrap();
        std::fs::write(
            root.path().join("proc/self/mountinfo"),
            format!("{missing_id} 0 0:1 / / rw - cgroup2 ignored rw\n"),
        )
        .unwrap();
        assert!(matches!(
            collect(root.path(), &mut result),
            Err("CGROUP_MOUNT_NOT_FOUND")
        ));
        assert!(result.exposes_cgroup_v2.is_none());
        assert!(result.mount.is_none());
        assert!(result.controllers.is_none());
        assert!(result.self_membership.is_some());
    }

    #[test]
    fn cgroup_directory_symlinks_block_before_mount_binding() {
        let root = tempfile::tempdir_in("/tmp/opencode").unwrap();
        fixture(root.path());
        std::fs::rename(root.path().join("sys"), root.path().join("old-sys")).unwrap();
        std::os::unix::fs::symlink("old-sys", root.path().join("sys")).unwrap();
        let mut result = CgroupFacts::default();
        assert!(matches!(
            collect(root.path(), &mut result),
            Err("CGROUP_DIRECTORY")
        ));
        assert!(result.self_membership.is_some());
        assert!(result.exposes_cgroup_v2.is_none());
    }
}

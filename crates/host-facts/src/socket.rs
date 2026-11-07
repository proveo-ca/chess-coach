// SPEC: _spec/host-entrypoint.puml
use rustix::fd::{AsRawFd, OwnedFd};
use rustix::fs::{FileType, Mode, OFlags, fstat, open, openat};
use std::path::Path;

#[derive(Debug)]
pub(crate) enum ProbeError {
    Absent,
    Unsafe,
    Access,
}

pub(crate) struct PinnedSocket {
    socket: OwnedFd,
    _directories: Vec<OwnedFd>,
}

impl PinnedSocket {
    pub(crate) fn open(root: &Path, components: &[&str]) -> Result<Self, ProbeError> {
        let directory_flags = OFlags::PATH | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC;
        let mut directories =
            vec![open(root, directory_flags, Mode::empty()).map_err(probe_error)?];
        let (leaf, parents) = components.split_last().ok_or(ProbeError::Unsafe)?;
        for component in parents {
            let parent = directories.last().ok_or(ProbeError::Unsafe)?;
            let directory =
                openat(parent, *component, directory_flags, Mode::empty()).map_err(probe_error)?;
            directories.push(directory);
        }
        let parent = directories.last().ok_or(ProbeError::Unsafe)?;
        let socket = openat(
            parent,
            *leaf,
            OFlags::PATH | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::empty(),
        )
        .map_err(probe_error)?;
        let metadata = fstat(&socket).map_err(probe_error)?;
        if FileType::from_raw_mode(metadata.st_mode) != FileType::Socket {
            return Err(ProbeError::Unsafe);
        }
        Ok(Self {
            socket,
            _directories: directories,
        })
    }

    pub(crate) fn descriptor_path(&self) -> String {
        format!("/proc/self/fd/{}", self.socket.as_raw_fd())
    }
}

fn probe_error(error: rustix::io::Errno) -> ProbeError {
    if error == rustix::io::Errno::NOENT {
        ProbeError::Absent
    } else {
        ProbeError::Access
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::os::unix::fs::symlink;
    use std::os::unix::net::{UnixListener, UnixStream};

    fn assert_original_receives(
        pin: &PinnedSocket,
        original: &UnixListener,
        replacement: &UnixListener,
    ) {
        original.set_nonblocking(true).unwrap();
        replacement.set_nonblocking(true).unwrap();
        let mut client = UnixStream::connect(pin.descriptor_path()).unwrap();
        client.write_all(b"probe").unwrap();
        let (mut accepted, _) = original.accept().unwrap();
        accepted
            .set_read_timeout(Some(std::time::Duration::from_secs(1)))
            .unwrap();
        let mut message = [0; 5];
        accepted.read_exact(&mut message).unwrap();
        assert_eq!(&message, b"probe");
        assert!(
            matches!(replacement.accept(), Err(error) if error.kind() == std::io::ErrorKind::WouldBlock)
        );
    }

    #[test]
    fn socket_pin_survives_leaf_replacement_without_reaching_replacement() {
        let directory = tempfile::tempdir_in("/tmp/opencode").unwrap();
        let socket = directory.path().join("socket");
        let original = UnixListener::bind(&socket).unwrap();
        let pin = PinnedSocket::open(directory.path(), &["socket"]).unwrap();
        std::fs::rename(&socket, directory.path().join("old-socket")).unwrap();
        let replacement = UnixListener::bind(&socket).unwrap();
        assert_original_receives(&pin, &original, &replacement);
    }

    #[test]
    fn socket_pin_survives_parent_replacement_without_reaching_replacement() {
        let directory = tempfile::tempdir_in("/tmp/opencode").unwrap();
        let parent = directory.path().join("parent");
        std::fs::create_dir(&parent).unwrap();
        let original = UnixListener::bind(parent.join("socket")).unwrap();
        let pin = PinnedSocket::open(directory.path(), &["parent", "socket"]).unwrap();
        std::fs::rename(&parent, directory.path().join("old-parent")).unwrap();
        std::fs::create_dir(&parent).unwrap();
        let replacement = UnixListener::bind(parent.join("socket")).unwrap();
        assert_original_receives(&pin, &original, &replacement);
    }

    #[test]
    fn socket_pin_survives_unlink_without_reaching_replacement() {
        let directory = tempfile::tempdir_in("/tmp/opencode").unwrap();
        let socket = directory.path().join("socket");
        let original = UnixListener::bind(&socket).unwrap();
        let pin = PinnedSocket::open(directory.path(), &["socket"]).unwrap();
        std::fs::remove_file(&socket).unwrap();
        let replacement = UnixListener::bind(&socket).unwrap();
        assert_original_receives(&pin, &original, &replacement);
    }

    #[test]
    fn socket_probe_blocks_symlink_leaf_parent_wrong_kind_and_absence() {
        let directory = tempfile::tempdir_in("/tmp/opencode").unwrap();
        assert!(matches!(
            PinnedSocket::open(directory.path(), &["missing"]),
            Err(ProbeError::Absent)
        ));
        let _listener = UnixListener::bind(directory.path().join("socket")).unwrap();
        symlink("socket", directory.path().join("link")).unwrap();
        assert!(matches!(
            PinnedSocket::open(directory.path(), &["link"]),
            Err(ProbeError::Unsafe)
        ));
        std::fs::write(directory.path().join("file"), b"synthetic").unwrap();
        assert!(matches!(
            PinnedSocket::open(directory.path(), &["file"]),
            Err(ProbeError::Unsafe)
        ));
        std::fs::create_dir(directory.path().join("parent")).unwrap();
        symlink("parent", directory.path().join("parent-link")).unwrap();
        assert!(PinnedSocket::open(directory.path(), &["parent-link", "socket"]).is_err());
    }
}

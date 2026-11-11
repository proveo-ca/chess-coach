// SPEC: _spec/gpu-owner.md
use crate::{OwnerError, Result, linux};
use rustix::fs::{Mode, OFlags};
use serde::Serialize;
use std::{fs::File, io::Write, path::Path};

pub const FILE_BYTES: u64 = 64 * 1024 * 1024;
pub const ATTEMPT_BYTES: u64 = 512 * 1024 * 1024;
pub const PACKET_BYTES: u64 = 4 * 1024 * 1024 * 1024;
pub const ENTRIES: u64 = 16_384;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Phase {
    Working,
    Cleanup,
}

pub struct Evidence {
    root: File,
    path: String,
    identity: linux::Identity,
    pub bytes: u64,
    pub entries: u64,
    pub failed: bool,
}
impl Evidence {
    pub fn create(path: &str) -> Result<Self> {
        crate::input::absolute(path)?;
        let path = Path::new(path);
        let parent = path
            .parent()
            .and_then(Path::to_str)
            .ok_or(OwnerError("EVIDENCE_PARENT"))?;
        let parent = linux::open_directory(parent)?;
        let leaf = path.file_name().ok_or(OwnerError("EVIDENCE_NAME"))?;
        rustix::fs::mkdirat(&parent, leaf, Mode::from_bits_truncate(0o700))
            .map_err(|_| OwnerError("EVIDENCE_EXCLUSIVE"))?;
        let root = File::from(
            rustix::fs::openat(
                &parent,
                leaf,
                OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                Mode::empty(),
            )
            .map_err(|_| OwnerError("EVIDENCE_OPEN"))?,
        );
        let identity = linux::Identity::of(&root)?;
        Ok(Self {
            root,
            path: path.to_str().ok_or(OwnerError("EVIDENCE_PATH"))?.into(),
            identity,
            bytes: 0,
            entries: 1,
            failed: false,
        })
    }
    pub fn write(&mut self, name: &str, bytes: &[u8], phase: Phase) -> Result<()> {
        if self.failed {
            return if phase == Phase::Cleanup {
                Ok(())
            } else {
                Err(OwnerError("EVIDENCE_FAILED"))
            };
        }
        let result = self.write_inner(name, bytes);
        if result.is_err() {
            self.failed = true;
        }
        result
    }
    fn write_inner(&mut self, name: &str, bytes: &[u8]) -> Result<()> {
        if linux::Identity::of(&self.root)? != self.identity
            || linux::Identity::of(
                &linux::open_directory(&self.path).map_err(|_| OwnerError("EVIDENCE_PATH"))?,
            )? != self.identity
        {
            return Err(OwnerError("EVIDENCE_REPLACED"));
        }
        if name.is_empty()
            || name.len() > 128
            || !name
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
        {
            return Err(OwnerError("EVIDENCE_NAME"));
        }
        let length = bytes.len() as u64;
        if length > FILE_BYTES
            || self
                .bytes
                .checked_add(length)
                .is_none_or(|n| n > ATTEMPT_BYTES || n > PACKET_BYTES)
            || self.entries >= ENTRIES
        {
            return Err(OwnerError("EVIDENCE_BOUND"));
        }
        self.bytes += length;
        self.entries += 1;
        let mut file = File::from(
            rustix::fs::openat(
                &self.root,
                name,
                OFlags::WRONLY | OFlags::CREATE | OFlags::EXCL | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                Mode::from_bits_truncate(0o600),
            )
            .map_err(|_| OwnerError("EVIDENCE_OPEN"))?,
        );
        file.write_all(bytes)
            .map_err(|_| OwnerError("EVIDENCE_WRITE"))?;
        file.sync_all().map_err(|_| OwnerError("EVIDENCE_SYNC"))?;
        self.root
            .sync_all()
            .map_err(|_| OwnerError("EVIDENCE_SYNC"))
    }
    pub fn json<T: Serialize>(&mut self, name: &str, value: &T, phase: Phase) -> Result<()> {
        if self.failed {
            return if phase == Phase::Cleanup {
                Ok(())
            } else {
                Err(OwnerError("EVIDENCE_FAILED"))
            };
        }
        let bytes = match serde_json::to_vec(value) {
            Ok(v) => v,
            Err(_) => {
                self.failed = true;
                return Err(OwnerError("EVIDENCE_SERIALIZE"));
            }
        };
        self.write(name, &bytes, phase)
    }
}

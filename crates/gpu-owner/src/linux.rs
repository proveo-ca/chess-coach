// SPEC: _spec/gpu-owner.md
use crate::{
    OwnerError, Result,
    input::{self, FileExpectation},
};
use rustix::{
    event::{PollFd, PollFlags},
    fs::{Mode, OFlags},
    time::{ClockId, Timespec},
};
use sha2::{Digest, Sha256};
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
    os::{
        fd::{AsRawFd, BorrowedFd},
        unix::fs::MetadataExt,
    },
};

pub trait Clock {
    fn now_ns(&self) -> Result<i64>;
}
#[derive(Default)]
pub struct Boottime;
impl Clock for Boottime {
    fn now_ns(&self) -> Result<i64> {
        let t = rustix::time::clock_gettime(ClockId::Boottime);
        i64::try_from(i128::from(t.tv_sec) * 1_000_000_000 + i128::from(t.tv_nsec))
            .map_err(|_| OwnerError("CLOCK"))
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Budget {
    pub origin_ns: i64,
    pub cold_ns: i64,
    pub work_ns: i64,
    pub cleanup_ns: i64,
}
impl Budget {
    pub fn capture(clock: &impl Clock) -> Result<Self> {
        let s = clock.now_ns()?;
        if !(0..=i64::MAX - crate::policy::CLEANUP_NS).contains(&s) {
            return Err(OwnerError("ORIGIN"));
        }
        Ok(Self {
            origin_ns: s,
            cold_ns: s + crate::policy::COLD_NS,
            work_ns: s + crate::policy::WORK_NS,
            cleanup_ns: s + crate::policy::CLEANUP_NS,
        })
    }
    pub fn before(&self, clock: &impl Clock, deadline: i64) -> Result<i64> {
        let now = clock.now_ns()?;
        if now < self.origin_ns {
            Err(OwnerError("CLOCK"))
        } else if now >= deadline {
            Err(OwnerError("DEADLINE"))
        } else {
            Ok(now)
        }
    }
}

pub struct Watch<'a> {
    pub fd: BorrowedFd<'a>,
    pub events: PollFlags,
}
pub trait Waiter {
    fn wait_until(&mut self, deadline: i64, watches: &[Watch<'_>]) -> Result<Vec<PollFlags>>;
}
#[derive(Default)]
pub struct LinuxWaiter;
impl Waiter for LinuxWaiter {
    fn wait_until(&mut self, deadline: i64, watches: &[Watch<'_>]) -> Result<Vec<PollFlags>> {
        use rustix::time::{
            Itimerspec, TimerfdClockId, TimerfdFlags, TimerfdTimerFlags, timerfd_create,
            timerfd_settime,
        };
        if Boottime.now_ns()? >= deadline {
            return Err(OwnerError("DEADLINE"));
        }
        let timer = timerfd_create(
            TimerfdClockId::Boottime,
            TimerfdFlags::CLOEXEC | TimerfdFlags::NONBLOCK,
        )
        .map_err(|_| OwnerError("TIMERFD"))?;
        let spec = Itimerspec {
            it_interval: Timespec {
                tv_sec: 0,
                tv_nsec: 0,
            },
            it_value: Timespec {
                tv_sec: deadline / 1_000_000_000,
                tv_nsec: deadline % 1_000_000_000,
            },
        };
        timerfd_settime(&timer, TimerfdTimerFlags::ABSTIME, &spec)
            .map_err(|_| OwnerError("TIMERFD"))?;
        let mut fds = Vec::with_capacity(watches.len() + 1);
        fds.push(PollFd::new(&timer, PollFlags::IN));
        for watch in watches {
            fds.push(PollFd::from_borrowed_fd(watch.fd, watch.events));
        }
        loop {
            match rustix::event::poll(&mut fds, None) {
                Ok(_) => break,
                Err(rustix::io::Errno::INTR) => continue,
                Err(_) => return Err(OwnerError("POLL")),
            }
        }
        if !fds[0].revents().is_empty() || Boottime.now_ns()? >= deadline {
            return Err(OwnerError("DEADLINE"));
        }
        Ok(fds[1..].iter().map(PollFd::revents).collect())
    }
}

pub fn open_directory(path: &str) -> Result<File> {
    walk(path, OFlags::RDONLY | OFlags::DIRECTORY)
}
pub fn open_regular(path: &str) -> Result<File> {
    let file = walk(path, OFlags::RDONLY | OFlags::NONBLOCK)?;
    if !file
        .metadata()
        .map_err(|_| OwnerError("FILE_STAT"))?
        .is_file()
    {
        return Err(OwnerError("NOT_REGULAR"));
    }
    Ok(file)
}
fn walk(path: &str, leaf_flags: OFlags) -> Result<File> {
    input::absolute(path)?;
    let mut fd = rustix::fs::open(
        "/",
        OFlags::RDONLY | OFlags::DIRECTORY | OFlags::CLOEXEC | OFlags::NOFOLLOW,
        Mode::empty(),
    )
    .map_err(|_| OwnerError("OPEN_ROOT"))?;
    let parts: Vec<_> = path[1..].split('/').collect();
    for (i, part) in parts.iter().enumerate() {
        let flags = if i + 1 == parts.len() {
            leaf_flags
        } else {
            OFlags::RDONLY | OFlags::DIRECTORY
        };
        fd = rustix::fs::openat(
            &fd,
            *part,
            flags | OFlags::CLOEXEC | OFlags::NOFOLLOW,
            Mode::empty(),
        )
        .map_err(|_| OwnerError("OPEN_NOFOLLOW"))?;
    }
    Ok(File::from(fd))
}

pub fn read_bounded(path: &str, bound: usize) -> Result<Vec<u8>> {
    let file = open_regular(path)?;
    let mut bytes = Vec::new();
    file.take(bound as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| OwnerError("FILE_READ"))?;
    if bytes.len() > bound {
        return Err(OwnerError("FILE_BOUND"));
    }
    Ok(bytes)
}

pub fn verified_file(
    expectation: &FileExpectation,
    mut check: impl FnMut() -> Result<()>,
) -> Result<File> {
    expectation.validate()?;
    check()?;
    let mut file = open_regular(&expectation.path)?;
    if file.metadata().map_err(|_| OwnerError("FILE_STAT"))?.len() != expectation.byte_length {
        return Err(OwnerError("FILE_LENGTH"));
    }
    let mut hasher = Sha256::new();
    let mut received = 0u64;
    let mut buffer = [0u8; 65536];
    loop {
        check()?;
        let n = file
            .read(&mut buffer)
            .map_err(|_| OwnerError("FILE_READ"))?;
        received = received
            .checked_add(n as u64)
            .ok_or(OwnerError("FILE_LENGTH"))?;
        if received > expectation.byte_length {
            return Err(OwnerError("FILE_LENGTH"));
        }
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    check()?;
    if received != expectation.byte_length
        || format!("{:x}", hasher.finalize()) != expectation.sha256
    {
        return Err(OwnerError("FILE_SHA256"));
    }
    file.seek(SeekFrom::Start(0))
        .map_err(|_| OwnerError("FILE_REWIND"))?;
    Ok(file)
}

pub struct Executable {
    file: File,
    path: String,
}
impl Executable {
    pub fn open(expectation: &FileExpectation, check: impl FnMut() -> Result<()>) -> Result<Self> {
        let file = verified_file(expectation, check)?;
        let metadata = file.metadata().map_err(|_| OwnerError("EXECUTABLE_STAT"))?;
        if metadata.mode() & 0o111 == 0 || metadata.mode() & 0o022 != 0 {
            return Err(OwnerError("EXECUTABLE_MODE"));
        }
        let path = format!("/proc/{}/fd/{}", std::process::id(), file.as_raw_fd());
        Ok(Self { file, path })
    }
    pub fn path(&self) -> &str {
        &self.path
    }
    pub fn file(&self) -> &File {
        &self.file
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Identity {
    pub device: u64,
    pub inode: u64,
}
impl Identity {
    pub fn of(file: &File) -> Result<Self> {
        let m = file.metadata().map_err(|_| OwnerError("IDENTITY"))?;
        Ok(Self {
            device: m.dev(),
            inode: m.ino(),
        })
    }
}

pub fn empty_private_directory(path: &str) -> Result<File> {
    let file = open_directory(path)?;
    if file
        .metadata()
        .map_err(|_| OwnerError("DIRECTORY_STAT"))?
        .mode()
        & 0o777
        != 0o700
    {
        return Err(OwnerError("DIRECTORY_MODE"));
    }
    let entries = std::fs::read_dir(format!(
        "/proc/{}/fd/{}",
        std::process::id(),
        file.as_raw_fd()
    ))
    .map_err(|_| OwnerError("DIRECTORY_READ"))?;
    if entries.into_iter().next().is_some() {
        return Err(OwnerError("DIRECTORY_NOT_EMPTY"));
    }
    Ok(file)
}

pub fn socket_path(path: &str) -> Result<()> {
    use std::os::unix::fs::FileTypeExt;
    input::absolute(path)?;
    let parent = std::path::Path::new(path)
        .parent()
        .and_then(|p| p.to_str())
        .ok_or(OwnerError("SOCKET_PATH"))?;
    let directory = if parent == "/" {
        File::from(
            rustix::fs::open(
                "/",
                OFlags::RDONLY | OFlags::DIRECTORY | OFlags::CLOEXEC | OFlags::NOFOLLOW,
                Mode::empty(),
            )
            .map_err(|_| OwnerError("SOCKET_PATH"))?,
        )
    } else {
        open_directory(parent)?
    };
    let leaf = std::path::Path::new(path)
        .file_name()
        .ok_or(OwnerError("SOCKET_PATH"))?;
    let pinned = format!(
        "/proc/{}/fd/{}/{}",
        std::process::id(),
        directory.as_raw_fd(),
        leaf.to_string_lossy()
    );
    if !std::fs::symlink_metadata(pinned)
        .map_err(|_| OwnerError("SOCKET_PATH"))?
        .file_type()
        .is_socket()
    {
        return Err(OwnerError("SOCKET_TYPE"));
    }
    Ok(())
}

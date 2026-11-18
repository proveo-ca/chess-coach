// SPEC: _spec/gpu-owner.md
use crate::{
    OwnerError, Result,
    linux::{Executable, Watch},
};
use rustix::{
    event::{PollFd, PollFlags},
    fs::OFlags,
    process::{Pid, Signal},
};
use std::{
    io::{Read, Write},
    os::{
        fd::{AsFd, OwnedFd},
        unix::process::CommandExt,
    },
    process::{Child, ChildStderr, ChildStdin, ChildStdout, Command, ExitStatus, Stdio},
    sync::Arc,
};

#[derive(Clone, Copy)]
pub struct Limits {
    pub stdout: usize,
    pub stderr: usize,
    pub pending: usize,
}
impl Default for Limits {
    fn default() -> Self {
        Self {
            stdout: 64 * 1024 * 1024,
            stderr: 65536,
            pending: 1024 * 1024,
        }
    }
}

pub struct Stream {
    pub prefix: Vec<u8>,
    pub received: u64,
    pub eof: bool,
    cap: usize,
}
impl Stream {
    fn new(cap: usize) -> Self {
        Self {
            prefix: Vec::new(),
            received: 0,
            eof: false,
            cap,
        }
    }
    fn read(&mut self, reader: &mut impl Read) -> Result<bool> {
        let mut bytes = [0u8; 65536];
        for _ in 0..16 {
            match reader.read(&mut bytes) {
                Ok(0) => {
                    self.eof = true;
                    return Ok(false);
                }
                Ok(n) => {
                    self.received = self
                        .received
                        .checked_add(n as u64)
                        .ok_or(OwnerError("OUTPUT_ACCOUNT"))?;
                    let keep = n.min(self.cap.saturating_sub(self.prefix.len()));
                    self.prefix.extend_from_slice(&bytes[..keep]);
                    if keep < n {
                        return Err(OwnerError("OUTPUT_BOUND"));
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => return Ok(false),
                Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(_) => return Err(OwnerError("PIPE_READ")),
            }
        }
        Ok(true)
    }
}

pub struct Process {
    child: Child,
    executable: Arc<Executable>,
    pidfd: Option<OwnedFd>,
    stdin: Option<ChildStdin>,
    stdout_pipe: Option<ChildStdout>,
    stderr_pipe: Option<ChildStderr>,
    pub stdout: Stream,
    pub stderr: Stream,
    pending: Vec<u8>,
    written: usize,
    pending_bound: usize,
    queued: bool,
    pub write_complete: bool,
    pub status: Option<ExitStatus>,
    pub failure: Option<OwnerError>,
    stopped: bool,
    forced: bool,
}

impl Process {
    pub fn spawn(
        executable: Arc<Executable>,
        args: &[String],
        interactive: bool,
        limits: Limits,
    ) -> Result<Self> {
        if limits.pending > 1024 * 1024
            || limits.stdout > 64 * 1024 * 1024
            || limits.stderr > 64 * 1024 * 1024
        {
            return Err(OwnerError("PROCESS_LIMITS"));
        }
        let mut command = Command::new(executable.path());
        command
            .args(args)
            .env_clear()
            .env("LANG", "C")
            .env("LC_ALL", "C")
            .env("TZ", "UTC")
            .stdin(if interactive {
                Stdio::piped()
            } else {
                Stdio::null()
            })
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .process_group(0);
        let mut child = command.spawn().map_err(|_| OwnerError("SPAWN"))?;
        let pid = Pid::from_child(&child);
        let pidfd = rustix::process::pidfd_open(pid, rustix::process::PidfdFlags::empty());
        let mut process = Self {
            stdin: child.stdin.take(),
            stdout_pipe: child.stdout.take(),
            stderr_pipe: child.stderr.take(),
            child,
            executable,
            pidfd: None,
            stdout: Stream::new(limits.stdout),
            stderr: Stream::new(limits.stderr),
            pending: Vec::new(),
            written: 0,
            pending_bound: limits.pending,
            queued: false,
            write_complete: !interactive,
            status: None,
            failure: None,
            stopped: false,
            forced: false,
        };
        match pidfd {
            Ok(fd) => process.pidfd = Some(fd),
            Err(_) => process.failure = Some(OwnerError("PIDFD")),
        }
        if let Some(pipe) = &process.stdin
            && nonblocking(pipe).is_err()
        {
            process.failure = Some(OwnerError("PIPE_NONBLOCK"));
            process.stdin.take();
        }
        if let Some(pipe) = &process.stdout_pipe
            && nonblocking(pipe).is_err()
        {
            process.failure = Some(OwnerError("PIPE_NONBLOCK"));
            process.stdout_pipe.take();
        }
        if let Some(pipe) = &process.stderr_pipe
            && nonblocking(pipe).is_err()
        {
            process.failure = Some(OwnerError("PIPE_NONBLOCK"));
            process.stderr_pipe.take();
        }
        if process.failure.is_some()
            && let Err(error) = process.kill_owned()
        {
            process.failure = Some(error);
        }
        Ok(process)
    }
    pub fn pid(&self) -> u32 {
        self.child.id()
    }
    pub fn executable(&self) -> &Arc<Executable> {
        &self.executable
    }
    pub fn queue_and_close(&mut self, bytes: Vec<u8>) -> Result<()> {
        if self.queued || self.stdin.is_none() || bytes.len() > self.pending_bound {
            return Err(OwnerError("STDIN_BOUND"));
        }
        self.pending = bytes;
        self.queued = true;
        self.write_complete = false;
        Ok(())
    }
    pub fn watches(&self) -> Vec<Watch<'_>> {
        self.watches_for(true)
    }
    pub fn cleanup_watches(&self) -> Vec<Watch<'_>> {
        self.watches_for(false)
    }
    fn watches_for(&self, writing: bool) -> Vec<Watch<'_>> {
        let mut watches = Vec::new();
        if self.status.is_none()
            && let Some(fd) = &self.pidfd
        {
            watches.push(Watch {
                fd: fd.as_fd(),
                events: PollFlags::IN,
            });
        }
        if !self.stdout.eof
            && let Some(pipe) = &self.stdout_pipe
        {
            watches.push(Watch {
                fd: pipe.as_fd(),
                events: PollFlags::IN,
            });
        }
        if !self.stderr.eof
            && let Some(pipe) = &self.stderr_pipe
        {
            watches.push(Watch {
                fd: pipe.as_fd(),
                events: PollFlags::IN,
            });
        }
        if writing
            && self.queued
            && let Some(pipe) = &self.stdin
        {
            watches.push(Watch {
                fd: pipe.as_fd(),
                events: PollFlags::OUT,
            });
        }
        watches
    }
    pub fn pump(&mut self) -> Result<()> {
        self.pump_inner(false)
    }
    pub fn cleanup_pump(&mut self) -> Result<()> {
        self.pump_inner(true)
    }
    fn pump_inner(&mut self, cleanup: bool) -> Result<()> {
        let mut error = None;
        if !cleanup
            && self.queued
            && !self.forced
            && let Some(pipe) = &mut self.stdin
        {
            for _ in 0..16 {
                if self.written == self.pending.len() {
                    self.stdin.take();
                    self.write_complete = true;
                    break;
                }
                match pipe.write(&self.pending[self.written..]) {
                    Ok(0) => {
                        error = Some(OwnerError("PIPE_WRITE"));
                        break;
                    }
                    Ok(n) => self.written += n,
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => break,
                    Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
                    Err(_) => {
                        error = Some(OwnerError("PIPE_WRITE"));
                        break;
                    }
                }
            }
        }
        let (drain_error, _) = self.drain_pipes();
        if let Some(e) = drain_error {
            error.get_or_insert(e);
        }
        if self.status.is_none() {
            let exited = if let Some(fd) = &self.pidfd {
                let mut poll = [PollFd::new(fd, PollFlags::IN)];
                rustix::event::poll(
                    &mut poll,
                    Some(&rustix::time::Timespec {
                        tv_sec: 0,
                        tv_nsec: 0,
                    }),
                )
                .map_err(|_| OwnerError("PIDFD_POLL"))?;
                !poll[0].revents().is_empty()
            } else {
                self.stopped
            };
            if exited {
                let (drain_error, exhausted) = self.drain_pipes();
                if let Some(e) = drain_error {
                    error.get_or_insert(e);
                }
                if !exhausted || error.is_some() {
                    if !self.stdout.eof || !self.stderr.eof {
                        self.forced = true;
                    }
                    self.stop_group()?;
                    self.status = self.child.try_wait().map_err(|_| OwnerError("REAP"))?;
                }
            }
        }
        if self.status.is_some() {
            self.pidfd.take();
        }
        if let Some(e) = error {
            self.failure.get_or_insert(e);
            return Err(e);
        }
        if !cleanup && let Some(e) = self.failure {
            return Err(e);
        }
        Ok(())
    }
    fn drain_pipes(&mut self) -> (Option<OwnerError>, bool) {
        let mut error = None;
        let mut exhausted = false;
        if let Some(pipe) = &mut self.stdout_pipe
            && !self.stdout.eof
        {
            match self.stdout.read(pipe) {
                Ok(quota) => exhausted |= quota,
                Err(e) => {
                    error.get_or_insert(e);
                }
            }
        }
        if let Some(pipe) = &mut self.stderr_pipe
            && !self.stderr.eof
        {
            match self.stderr.read(pipe) {
                Ok(quota) => exhausted |= quota,
                Err(e) => {
                    error.get_or_insert(e);
                }
            }
        }
        if self.stdout.eof {
            self.stdout_pipe.take();
        }
        if self.stderr.eof {
            self.stderr_pipe.take();
        }
        (error, exhausted)
    }
    fn stop_group(&mut self) -> Result<()> {
        if self.stopped {
            return Ok(());
        }
        let pid = Pid::from_child(&self.child);
        match rustix::process::kill_process_group(pid, Signal::KILL) {
            Ok(()) | Err(rustix::io::Errno::SRCH) => self.stopped = true,
            Err(_) => return Err(OwnerError("GROUP_KILL")),
        }
        Ok(())
    }
    pub fn kill_owned(&mut self) -> Result<()> {
        if self.status.is_none() {
            self.stop_group()?;
            self.forced = true;
        }
        self.stdin.take();
        Ok(())
    }
    pub fn complete(&self) -> bool {
        self.status.is_some() && self.stdout.eof && self.stderr.eof
    }
    pub fn natural_clean(&self) -> bool {
        self.complete()
            && !self.forced
            && self.failure.is_none()
            && self.write_complete
            && self.status.is_some_and(|s| s.success())
    }
}

fn nonblocking(fd: &impl AsFd) -> Result<()> {
    let flags = rustix::fs::fcntl_getfl(fd).map_err(|_| OwnerError("PIPE_FLAGS"))?;
    rustix::fs::fcntl_setfl(fd, flags | OFlags::NONBLOCK).map_err(|_| OwnerError("PIPE_FLAGS"))
}

pub struct Detached {
    pub role: String,
    pub process: Process,
}

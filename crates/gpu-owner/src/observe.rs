// SPEC: _spec/gpu-owner.md
use crate::{
    OwnerError, Result,
    input::{self, OwnerInput},
    linux::{self, Identity},
};
use std::{
    collections::{BTreeSet, VecDeque},
    fs::File,
    os::{fd::AsRawFd, unix::fs::MetadataExt},
};

pub fn parse_cpuset(value: &str) -> Result<Vec<u32>> {
    let value = value.trim_end_matches('\n');
    if value.is_empty() {
        return Err(OwnerError("CPUSET"));
    }
    let mut cpus = BTreeSet::new();
    for part in value.split(',') {
        let mut range = part.split('-');
        let first = integer(range.next().ok_or(OwnerError("CPUSET"))?)?;
        let last = match range.next() {
            Some(s) => integer(s)?,
            None => first,
        };
        if range.next().is_some() || first > last || last > u32::MAX as u64 || last - first > 4096 {
            return Err(OwnerError("CPUSET"));
        }
        for cpu in first..=last {
            if !cpus.insert(cpu as u32) || cpus.len() > 4096 {
                return Err(OwnerError("CPUSET"));
            }
        }
    }
    Ok(cpus.into_iter().collect())
}

fn integer(value: &str) -> Result<u64> {
    if value.is_empty()
        || (value.len() > 1 && value.starts_with('0'))
        || !value.bytes().all(|b| b.is_ascii_digit())
    {
        return Err(OwnerError("CGROUP_INTEGER"));
    }
    value.parse().map_err(|_| OwnerError("CGROUP_INTEGER"))
}
fn text(path: &str) -> Result<String> {
    String::from_utf8(linux::read_bounded(path, 65536)?).map_err(|_| OwnerError("CGROUP_UTF8"))
}
fn scalar(path: &str, name: &str) -> Result<u64> {
    integer(text(&format!("{path}/{name}"))?.trim_end_matches('\n'))
}
fn quota(path: &str) -> Result<(u64, u64)> {
    let text = text(&format!("{path}/cpu.max"))?;
    let parts: Vec<_> = text.trim_end_matches('\n').split(' ').collect();
    if parts.len() != 2 {
        return Err(OwnerError("CGROUP_CPU_MAX"));
    }
    let period = integer(parts[1])?;
    if period == 0 {
        return Err(OwnerError("CGROUP_CPU_MAX"));
    }
    let quota = if parts[0] == "max" {
        u64::MAX
    } else {
        integer(parts[0])?
    };
    if quota == 0 {
        return Err(OwnerError("CGROUP_CPU_MAX"));
    }
    Ok((quota, period))
}
fn memory(path: &str) -> Result<u64> {
    let value = text(&format!("{path}/memory.max"))?;
    if value == "max\n" || value == "max" {
        Ok(u64::MAX)
    } else {
        integer(value.trim_end_matches('\n'))
    }
}
fn effective(path: &str) -> Result<Vec<u32>> {
    parse_cpuset(&text(&format!("{path}/cpuset.cpus.effective"))?)
}

fn membership(proc_root: &str, pid: u32) -> Result<String> {
    let value = text(&format!("{proc_root}/{pid}/cgroup"))?;
    if !value.ends_with('\n') || value[..value.len() - 1].contains('\n') {
        return Err(OwnerError("PROC_CGROUP"));
    }
    let path = value
        .strip_prefix("0::")
        .and_then(|v| v.strip_suffix('\n'))
        .ok_or(OwnerError("PROC_CGROUP"))?;
    input::absolute(path)?;
    Ok(path.into())
}

struct Bound {
    path: String,
    file: File,
    identity: Identity,
    ancestors: Vec<(String, File, Identity)>,
}
impl Bound {
    fn stable(&self) -> Result<()> {
        if Identity::of(&self.file)? != self.identity {
            return Err(OwnerError("C8_REPLACED"));
        }
        for (path, file, identity) in &self.ancestors {
            if Identity::of(file)? != *identity
                || Identity::of(&linux::open_directory(path)?)? != *identity
            {
                return Err(OwnerError("C8_REPLACED"));
            }
        }
        Ok(())
    }
    fn present(&self) -> Result<()> {
        self.stable()?;
        if Identity::of(&linux::open_directory(&self.path)?)? != self.identity {
            return Err(OwnerError("C8_REPLACED"));
        }
        self.stable()
    }
}

pub struct Observer {
    proc_root: String,
    cgroup_root: String,
    parent: String,
    outside: String,
    aggregate: String,
    roots: Vec<(String, File, Identity)>,
    bound: Option<Bound>,
}
impl Observer {
    pub fn new(input: &OwnerInput) -> Result<Self> {
        let o = &input.observation;
        let aggregate = &input
            .outside_control
            .expected_self_envelope
            .aggregate_parent;
        if !input::below(&o.approved_job_parent_absolute_path, &o.cgroup_root)
            || !input::below(
                &o.expected_outside_control_cgroup_absolute_path,
                &o.cgroup_root,
            )
            || !(input::below(aggregate, &o.cgroup_root) || aggregate == &o.cgroup_root)
        {
            return Err(OwnerError("OBSERVATION_PATH"));
        }
        let mut roots = Vec::new();
        for path in [
            &o.proc_root,
            &o.cgroup_root,
            &o.approved_job_parent_absolute_path,
            aggregate,
            &o.expected_outside_control_cgroup_absolute_path,
        ] {
            let file = linux::open_directory(path)?;
            let identity = Identity::of(&file)?;
            roots.push((path.clone(), file, identity));
        }
        let observer = Self {
            proc_root: o.proc_root.clone(),
            cgroup_root: o.cgroup_root.clone(),
            parent: o.approved_job_parent_absolute_path.clone(),
            outside: o.expected_outside_control_cgroup_absolute_path.clone(),
            aggregate: aggregate.clone(),
            roots,
            bound: None,
        };
        observer.check_outside(input)?;
        Ok(observer)
    }
    pub fn stable(&self) -> Result<()> {
        for (path, file, identity) in &self.roots {
            if Identity::of(file)? != *identity
                || Identity::of(&linux::open_directory(path)?)? != *identity
            {
                return Err(OwnerError("OBSERVATION_REPLACED"));
            }
        }
        if let Some(bound) = &self.bound {
            bound.stable()?;
        }
        Ok(())
    }
    fn host_path(&self, hierarchy: &str) -> String {
        format!("{}{}", self.cgroup_root, hierarchy)
    }
    pub fn check_outside(&self, input: &OwnerInput) -> Result<()> {
        self.stable()?;
        if self.host_path(&membership(&self.proc_root, std::process::id())?) != self.outside {
            return Err(OwnerError("OUTSIDE_MEMBERSHIP"));
        }
        let e = &input.outside_control.expected_self_envelope;
        if effective(&self.outside)? != e.cpus
            || quota(&self.outside)? != (e.cpu_quota, 100000)
            || memory(&self.outside)? != e.memory_max_bytes.0 as u64
            || effective(&self.aggregate)? != e.aggregate_cpus
            || quota(&self.aggregate)? != (e.aggregate_cpu_quota, 100000)
            || memory(&self.aggregate)? != e.aggregate_memory_max_bytes.0 as u64
        {
            return Err(OwnerError("OUTSIDE_ENVELOPE"));
        }
        self.stable()
    }
    pub fn bind(&mut self, pid: u32, input: &OwnerInput) -> Result<()> {
        self.check_outside(input)?;
        if pid == 0 {
            return Err(OwnerError("C8_PID"));
        }
        let path = self.host_path(&membership(&self.proc_root, pid)?);
        if !input::below(&path, &self.parent)
            || input::below(&path, &self.outside)
            || input::below(&self.outside, &path)
        {
            return Err(OwnerError("C8_PARENT"));
        }
        let mut ancestors = Vec::new();
        let mut current = std::path::Path::new(&path)
            .parent()
            .ok_or(OwnerError("C8_ANCESTOR"))?;
        while current != std::path::Path::new(&self.parent) {
            let ancestor = current.to_str().ok_or(OwnerError("C8_ANCESTOR"))?;
            if !input::below(ancestor, &self.parent) {
                return Err(OwnerError("C8_PARENT"));
            }
            let file = linux::open_directory(ancestor)?;
            let identity = Identity::of(&file)?;
            ancestors.push((ancestor.to_owned(), file, identity));
            current = current.parent().ok_or(OwnerError("C8_ANCESTOR"))?;
        }
        ancestors.reverse();
        let file = linux::open_directory(&path)?;
        let identity = Identity::of(&file)?;
        if let Some(old) = &self.bound
            && (old.path != path || old.identity != identity)
        {
            return Err(OwnerError("C8_REBOUND"));
        }
        let bound = Bound {
            path,
            file,
            identity,
            ancestors,
        };
        bound.present()?;
        self.stable()?;
        self.check_leaf(&bound.path, pid, input)?;
        bound.present()?;
        self.stable()?;
        if self.bound.is_none() {
            self.bound = Some(bound);
        }
        Ok(())
    }
    fn check_leaf(&self, path: &str, pid: u32, input: &OwnerInput) -> Result<()> {
        if quota(path)? != (400000, 100000)
            || memory(path)? != 8_589_934_592
            || scalar(path, "memory.swap.max")? != 0
            || scalar(path, "pids.max")? != 512
            || effective(path)? != input.job.gpu_profile.cpus
        {
            return Err(OwnerError("C8_C2"));
        }
        let mut current = std::path::Path::new(path)
            .parent()
            .ok_or(OwnerError("C8_ANCESTOR"))?;
        loop {
            let ancestor = current.to_str().ok_or(OwnerError("C8_ANCESTOR"))?;
            if !(ancestor == self.aggregate || input::below(ancestor, &self.aggregate)) {
                return Err(OwnerError("C8_ANCESTOR"));
            }
            let (q, p) = quota(ancestor)?;
            if u128::from(q) * 100000 < 400000 * u128::from(p)
                || memory(ancestor)? < 8_589_934_592
                || !input
                    .job
                    .gpu_profile
                    .cpus
                    .iter()
                    .all(|cpu| effective(ancestor).is_ok_and(|cpus| cpus.contains(cpu)))
            {
                return Err(OwnerError("C8_STRICT_ANCESTOR"));
            }
            if ancestor == self.aggregate {
                break;
            }
            current = current.parent().ok_or(OwnerError("C8_ANCESTOR"))?;
        }
        let mut queue = VecDeque::from([path.to_string()]);
        let mut directories = 0usize;
        let mut tasks = BTreeSet::new();
        let mut processes = BTreeSet::new();
        let mut found = false;
        while let Some(path) = queue.pop_front() {
            directories += 1;
            if directories > 513 {
                return Err(OwnerError("C8_DESCENDANTS"));
            }
            let file = linux::open_directory(&path)?;
            for line in text(&format!("{path}/cgroup.procs"))?.lines() {
                let task = integer(line)?;
                if task == 0
                    || task > u32::MAX as u64
                    || !processes.insert(task)
                    || processes.len() > 512
                {
                    return Err(OwnerError("C8_TASKS"));
                }
                if self.host_path(&membership(&self.proc_root, task as u32)?) != path {
                    return Err(OwnerError("C8_TASK_MEMBERSHIP"));
                }
                if task == u64::from(pid) {
                    found = true;
                }
            }
            for line in text(&format!("{path}/cgroup.threads"))?.lines() {
                let task = integer(line)?;
                if task == 0 || task > u32::MAX as u64 || !tasks.insert(task) || tasks.len() > 512 {
                    return Err(OwnerError("C8_TASKS"));
                }
                if self.host_path(&membership(&self.proc_root, task as u32)?) != path {
                    return Err(OwnerError("C8_TASK_MEMBERSHIP"));
                }
            }
            let entries = std::fs::read_dir(format!(
                "/proc/{}/fd/{}",
                std::process::id(),
                file.as_raw_fd()
            ))
            .map_err(|_| OwnerError("C8_READ_DIR"))?;
            let mut count = 0;
            for entry in entries {
                count += 1;
                if count > 16384 {
                    return Err(OwnerError("C8_ENTRIES"));
                }
                let entry = entry.map_err(|_| OwnerError("C8_READ_DIR"))?;
                let kind = entry.file_type().map_err(|_| OwnerError("C8_READ_DIR"))?;
                if kind.is_symlink() {
                    return Err(OwnerError("C8_SYMLINK"));
                }
                if kind.is_dir() {
                    let name = entry.file_name();
                    let name = name.to_str().ok_or(OwnerError("C8_UTF8"))?;
                    queue.push_back(format!("{path}/{name}"));
                    if queue.len() + directories > 513 {
                        return Err(OwnerError("C8_DESCENDANTS"));
                    }
                }
            }
        }
        if !found || !tasks.contains(&u64::from(pid)) {
            return Err(OwnerError("C8_INIT_MEMBERSHIP"));
        }
        Ok(())
    }
    pub fn bound_path(&self) -> Option<&str> {
        self.bound.as_ref().map(|bound| bound.path.as_str())
    }
    pub fn gone(&self) -> Result<bool> {
        self.stable()?;
        let Some(bound) = &self.bound else {
            return Ok(false);
        };
        let directory = match bound.ancestors.last() {
            Some((_, file, _)) => file,
            None => {
                &self
                    .roots
                    .iter()
                    .find(|(path, _, _)| path == &self.parent)
                    .ok_or(OwnerError("C8_PARENT"))?
                    .1
            }
        };
        let name = bound
            .path
            .rsplit('/')
            .next()
            .ok_or(OwnerError("C8_PARENT"))?;
        let gone = match rustix::fs::openat(
            directory,
            name,
            rustix::fs::OFlags::RDONLY
                | rustix::fs::OFlags::DIRECTORY
                | rustix::fs::OFlags::NOFOLLOW
                | rustix::fs::OFlags::CLOEXEC,
            rustix::fs::Mode::empty(),
        ) {
            Ok(fd) => {
                if Identity::of(&File::from(fd))? != bound.identity {
                    return Err(OwnerError("C8_REPLACED"));
                }
                false
            }
            Err(rustix::io::Errno::NOENT) => {
                if bound
                    .file
                    .metadata()
                    .map_err(|_| OwnerError("C8_DISAPPEARANCE"))?
                    .nlink()
                    != 0
                {
                    return Err(OwnerError("C8_DISAPPEARANCE"));
                }
                true
            }
            Err(_) => return Err(OwnerError("C8_DISAPPEARANCE")),
        };
        self.stable()?;
        Ok(gone)
    }
}

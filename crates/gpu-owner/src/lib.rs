#![forbid(unsafe_code)]
// SPEC: _spec/gpu-owner.md

pub mod docker;
pub mod evidence;
pub mod input;
pub mod json;
pub mod linux;
pub mod observe;
pub mod owner;
pub mod policy;
pub mod process;
pub mod telemetry;
pub mod wire;

use std::fmt;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct OwnerError(pub &'static str);

impl fmt::Display for OwnerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.0)
    }
}

impl std::error::Error for OwnerError {}

pub type Result<T> = std::result::Result<T, OwnerError>;

pub use owner::{RawLaunchRequest, Report, run_once, run_once_with};

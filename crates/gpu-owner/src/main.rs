#![forbid(unsafe_code)]
// SPEC: _spec/gpu-owner.md

fn main() {
    let mut args = std::env::args_os().skip(1);
    if args.next().as_deref() == Some(std::ffi::OsStr::new("--help")) && args.next().is_none() {
        println!("host-gpu-owner --help\nSource-only recovery. Operational entrypoint disabled.");
        return;
    }
    eprintln!("SOURCE_ONLY_DISABLED");
    std::process::exit(2);
}

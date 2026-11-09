// SPEC: _spec/recovery.md
import { fileURLToPath } from "node:url";
export async function driver(mode: "cc" | "c++" | "ar") {
  const executable = fileURLToPath(new URL("./cache/mise/data/installs/zig/0.15.2/zig", import.meta.url));
  const args = process.argv.slice(2);
  const child = Bun.spawn([executable, mode, ...(mode === "ar" ? [] : ["-target", "x86_64-linux-gnu"]), ...args],
    { stdin: "inherit", stdout: "inherit", stderr: "inherit", env: process.env });
  process.exitCode = await child.exited;
}

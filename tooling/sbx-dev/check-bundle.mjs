#!/usr/bin/env bun
// SPEC: _spec/tooling/bun-first-party-tooling.puml
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { spawn } from "node:child_process";

export async function checkBundle(path, expected) {
  if (!/^[0-9a-f]{64}$/.test(expected)) throw new Error("invalid lowercase SHA-256");
  const details = await lstat(path);
  if (!details.isFile() || details.isSymbolicLink() || details.size > 2 * 1024**3) {
    throw new Error("archive is not a regular file within the 2 GiB cap");
  }
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  if (digest.digest("hex") !== expected) throw new Error("archive digest mismatch");
  const names = new Set();
  const tools = new Set();
  let total = 0;
  await new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/tar", [
      "--list", "--verbose", "--numeric-owner", "--full-time", "--quoting-style=escape",
      "--absolute-names", "--force-local", "--file", path,
    ], { env: { PATH: "/usr/bin:/bin", LC_ALL: "C", TZ: "UTC" }, stdio: ["ignore", "pipe", "pipe"], detached: true });
    let pending = "";
    let bytes = 0;
    let failure;
    const stop = (error) => {
      failure ??= error;
      if (child.pid) {
        try { process.kill(-child.pid, "SIGKILL"); } catch (signalError) {
          if (signalError.code !== "ESRCH") failure = signalError;
        }
      }
    };
    const timer = setTimeout(() => stop(new Error("archive listing deadline exceeded")), 30000);
    child.stdout.on("data", (chunk) => {
      if (failure) return;
      try {
        bytes += chunk.length;
        if (bytes > 8 * 1024**2) throw new Error("archive listing exceeds cap");
        pending += chunk.toString("ascii");
        let newline;
        while ((newline = pending.indexOf("\n")) >= 0) {
          const line = pending.slice(0, newline);
          pending = pending.slice(newline + 1);
          const match = /^([-d][rwx-]{9})\s+\d+\/\d+\s+(\d+)\s+\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} (.+)$/.exec(line);
          if (!match) throw new Error("unsafe or unsupported archive metadata");
          const [, mode, length, name] = match;
          const normalized = mode[0] === "d" ? name.replace(/\/+$/, "") : name;
          const size = Number(length);
          if (name.length > 256 || !normalized || names.has(normalized) || !normalized.split("/").every((part) => /^[A-Za-z0-9_.+-]+$/.test(part) && part !== "." && part !== "..")) {
            throw new Error("unsafe or duplicate bundle member");
          }
          names.add(normalized);
          total += size;
          if (!Number.isSafeInteger(size) || names.size > 20000 || total > 4 * 1024**3) throw new Error("expanded bundle exceeds cap");
          if (mode[0] === "-" && mode.includes("x") && ["bin/rustc", "bin/cargo"].includes(normalized)) tools.add(normalized);
        }
        if (pending.length > 1024) throw new Error("archive metadata line exceeds cap");
      } catch (error) { stop(error); }
    });
    child.stderr.on("data", () => stop(new Error("archive listing refused")));
    child.on("error", stop);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (failure || code !== 0 || pending) reject(failure ?? new Error("archive listing failed"));
      else resolve();
    });
  });
  for (const tool of ["bin/rustc", "bin/cargo"]) if (!tools.has(tool)) throw new Error(`bundle must contain executable ${tool}`);
}

if (import.meta.main) {
  try {
    if (process.argv.length !== 4) throw new Error("usage: check-bundle.mjs ARCHIVE SHA256_LOWERCASE");
    await checkBundle(process.argv[2], process.argv[3]);
    console.log("BUNDLE=HASH_AND_LAYOUT_OK");
  } catch (error) {
    console.error(`STOP: ${error.message}`);
    process.exitCode = 2;
  }
}

#!/usr/bin/env bun
// SPEC: _spec/tooling/bun-first-party-tooling.puml, _spec/tooling/sbx-dev/preparation-workflow.puml
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { runBounded } from "../native-ingress/f9-diagnose.mjs";

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
  const listing = await runBounded(["/usr/bin/tar",
    "--list", "--verbose", "--numeric-owner", "--full-time", "--quoting-style=escape",
    "--absolute-names", "--force-local", "--file", path], {
    milliseconds: 30000, cap: 8 * 1024**2, env: { PATH: "/usr/bin:/bin", LC_ALL: "C", TZ: "UTC" },
  });
  if (!listing.ok || listing.stderr || !listing.stdout.endsWith("\n")) throw new Error("archive listing refused");
  for (const line of listing.stdout.slice(0, -1).split("\n")) {
    if (line.length > 1024) throw new Error("archive metadata line exceeds cap");
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

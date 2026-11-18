#!/usr/local/bin/bun --no-env-file
// SPEC: _spec/gpu-owner.md, _spec/gpu-owner.puml
import { appendFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";

const cfg = __TRUSTED_FIXTURE_CONFIGURATION__;
try {
  const expected = [`--id=${cfg.uuid}`, "--query-gpu=uuid,driver_version,memory.total,memory.used,memory.free", "--format=csv,noheader,nounits"];
  if (JSON.stringify(Bun.argv.slice(2)) !== JSON.stringify(expected)) throw new Error("fixture telemetry query");
  if (JSON.stringify(Object.keys(process.env).sort()) !== JSON.stringify(["LANG", "LC_ALL", "TZ"])) throw new Error("fixture telemetry clearenv");
  appendFileSync(cfg.telemetryEvents, JSON.stringify({ pid: process.pid, args: Bun.argv.slice(2) }) + "\n", { mode: 0o600 });
  if (cfg.mode === "state-replaced-before-create" && !existsSync(cfg.stateReplaced)) {
    renameSync(cfg.stateSource, cfg.preservedState);
    mkdirSync(cfg.stateSource, { mode: 0o700 });
    writeFileSync(cfg.stateReplaced, "replaced\n", { mode: 0o600 });
  }
  if (cfg.mode === "stalled-query") await new Promise(() => { setInterval(() => {}, 1000); });
  const line = cfg.mode === "malformed-query" ? "malformed\n" : `${cfg.uuid}, 999.0, 1024, 1, ${cfg.mode === "low-query" ? 599 : 900}\n`;
  await Bun.write(Bun.stdout, line);
} catch (error) { await Bun.write(Bun.stderr, String(error) + "\n"); process.exitCode = 92; }

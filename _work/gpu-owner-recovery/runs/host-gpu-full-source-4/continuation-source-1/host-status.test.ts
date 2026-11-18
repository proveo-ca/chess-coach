// SPEC: _spec/gpu-full-qualification.puml
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
const script = await readFile(new URL("./host-status.fish", import.meta.url), "utf8");
test("status command reads only full-two metadata and a bounded receipt", () => {
  expect(script.match(/\bdocker\b/g)).toHaveLength(2);
  expect(script).toContain("docker --host=unix:///var/run/docker.sock ps --all --no-trunc");
  expect(script).toContain("--filter label=chess-coach.gpu-full=host-gpu-full-2");
  expect(script).toContain("command head -c 4096"); expect(script).toContain("5s head -c 2097152");
  expect(script).toContain("test -f \"$receipt\"; and not test -L \"$receipt\"");
  expect(script).not.toMatch(/\b(?:mkdir|rm|tee|cargo|rustc|nvidia-smi|llvm-config)\b/);
  expect(script).not.toContain("host-command.fish"); expect(script).not.toContain("HOST_GPU_FULL_EXIT=");
  expect(script).toContain("FULL2_STATUS_ONLY_EXIT="); expect(script).not.toContain("host-gpu-full-1");
});
test("literal delivery adds no shell write or extra operation", () => {
  expect(script).not.toContain("'"); expect(script).not.toContain("\u0000");
  expect(script).toContain("set -l docker_exit $pipestatus[1]"); expect(script).toContain("string match -qr \"^[0-9]+\\$\"");
  expect(script.match(/\bdocker --host=/g)).toHaveLength(1);
});

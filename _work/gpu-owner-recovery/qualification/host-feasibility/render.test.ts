// SPEC: _spec/gpu-feasibility.puml
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { renderFeasibilityPacket } from "./render";

test("rendering prepares inert JavaScript and Fish without activating any entrypoint", async () => {
  const packet = await renderFeasibilityPacket(), { host, driver, plan } = packet.programs;
  expect(packet.command).toStartWith("fish --no-config -c ");
  for (const token of ["MISE_AUTO_INSTALL false", "MISE_EXEC_AUTO_INSTALL false", "core:bun@1.4.0 core:rust@1.95.0", "--no-env-file --no-install", "HOST_GPU_FEASIBILITY_EXIT=", "--signal=TERM --kill-after=90s 510s", "HOST_FEASIBILITY_STARTED_MS", "fish --no-config -n -c"]) expect(packet.command).toContain(token);
  expect(driver).toContain('await runFeasibilityDriver(JSON.parse(await Bun.file("/evidence/plan.json").text()))');
  expect(host).toContain("await runFeasibilityHost("); expect(host).toContain(plan.selectedUuid);
  for (const program of [host, driver]) {
    expect(Buffer.byteLength(program)).toBeLessThan(120000); expect(program).not.toContain("command-supervisor.ts\")]" );
    expect(program).not.toContain("import.meta.main"); expect(program).not.toContain("async function runBounded(");
  }
  const source = await readFile(new URL("./render.ts", import.meta.url), "utf8");
  expect(source).not.toMatch(/outdir:|outfile:|write:\s*false|Bun\.spawn|execSync/);
});

test("the source packet remains deterministic for the frozen reported build metadata", async () => {
  const first = await renderFeasibilityPacket(), second = await renderFeasibilityPacket();
  expect(first).toEqual(second); expect(first.programs.plan.hostExecutionApproved).toBe(false); expect(first.programs.plan.kernelJitCompilationAuthorized).toBe(false);
});

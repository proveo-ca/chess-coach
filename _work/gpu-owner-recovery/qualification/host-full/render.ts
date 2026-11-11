// SPEC: _spec/gpu-full-qualification.puml
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";
import { quoteFish as q } from "../host-receive/bootstrap";
import { fullPlan } from "./plan";

async function bundle(file: string) {
  const result = await Bun.build({ entrypoints: [fileURLToPath(new URL(file, import.meta.url))], target: "bun", sourcemap: "none", minify: { whitespace: true, syntax: true, identifiers: false } });
  if (!result.success || result.outputs.length !== 1) throw Error("FULL_BUNDLE_FAILED:" + file + ":" + result.logs.join("\n"));
  const text = await result.outputs[0]!.text(), scan = new Bun.Transpiler({ loader: "js", target: "bun" }).scan(text);
  if (scan.imports.some(row => !builtinModules.includes(row.path.replace(/^node:/, "")))) throw Error("ONLY_BUILTIN_BUNDLE_IMPORTS_ALLOWED");
  return text;
}
export async function renderFullPacket() {
  const plan = await fullPlan(), driver = await bundle("./driver.ts") + '\nawait runFullDriver(JSON.parse(await Bun.file("/evidence/plan.json").text()));';
  const host = await bundle("./runtime.ts") + `\nawait runFullHost(${JSON.stringify(plan)},${JSON.stringify(driver)});`;
  const worker = ["set -gx MISE_AUTO_INSTALL false", "set -gx MISE_EXEC_AUTO_INSTALL false", "set -gx MISE_TASK_RUN_AUTO_INSTALL false",
    `command mise exec core:bun@1.4.0 core:rust@1.95.0 -- bun --no-env-file --no-install --eval ${q(host)} -- ${q(plan.grant)} < /dev/null`].join("; ");
  const checked = `set -gx HOST_FULL_STARTED_MS (command date +%s%3N); or exit $status; set -l program ${q(worker)}; fish --no-config -n -c "$program" > ${q(plan.evidence + "/syntax.stdout")} 2> ${q(plan.evidence + "/syntax.stderr")}; or exit $status; fish --no-config -c "$program"`;
  const parent = [`set -l evidence ${q(plan.evidence)}`, 'command mkdir -- "$evidence"; or exit 1',
    `command timeout --signal=TERM --kill-after=90s 990s fish --no-config -c ${q(checked)} > "$evidence/worker.stdout" 2> "$evidence/worker.stderr"`,
    'set -l code $status', 'for stream in stdout stderr; if test (command wc -c < "$evidence/worker.$stream") -gt 65536; set code 1; end; end',
    'printf \'%s\\n\' $code > "$evidence/command.exit"; or exit 1', 'command cat -- "$evidence/worker.stdout"; command cat -- "$evidence/worker.stderr" >&2',
    'if test -f "$evidence/receipt.json"; command cat -- "$evidence/receipt.json"; end', 'printf \'HOST_GPU_FULL_EXIT=%s\\n\' $code', 'exit $code'].join("; ");
  if ([host, driver, worker, checked, parent].some(text => Buffer.byteLength(text) >= 120000)) throw Error("FULL_FISH_ARGUMENT_SIZE_LIMIT");
  return { command: "fish --no-config -c " + q(parent), programs: { plan, host, driver } };
}

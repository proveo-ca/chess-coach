// SPEC: _spec/gpu-host-build.puml
import { readFile } from "node:fs/promises";
import { quoteFish as q } from "../host-receive/bootstrap";
import plan from "./plan.json";

export async function buildPrograms() {
  const transpiler = new Bun.Transpiler({ loader: "ts", target: "bun" });
  const native = transpiler.transformSync(await readFile(new URL("./driver.ts", import.meta.url), "utf8")) + `\nawait runNativeBuild(${JSON.stringify(plan)});`;
  const host = transpiler.transformSync(await readFile(new URL("./build.ts", import.meta.url), "utf8")) + `\nawait runHostBuild(${JSON.stringify(plan)},${JSON.stringify(native)});`;
  if (Buffer.byteLength(host) > 131072) throw Error("INLINE_HOST_BUILD_PROGRAM_SIZE_LIMIT");
  return { native, host };
}

export async function renderHostBuild() {
  const { host } = await buildPrograms();
  const worker = ["set -gx MISE_AUTO_INSTALL false", "set -gx MISE_EXEC_AUTO_INSTALL false", "set -gx MISE_TASK_RUN_AUTO_INSTALL false",
    `command mise exec core:bun@1.4.0 core:rust@1.95.0 -- bun --no-env-file --no-install --eval ${q(host)} -- ${q(plan.grant)} < /dev/null`].join("; ");
  const checked = `set -gx HOST_NATIVE_BUILD_STARTED_MS (command date +%s%3N); or exit $status; set -l program ${q(worker)}; fish --no-config -n -c "$program" > ${q(plan.evidence + "/syntax.stdout")} 2> ${q(plan.evidence + "/syntax.stderr")}; or exit $status; fish --no-config -c "$program"`;
  const parent = [`set -l evidence ${q(plan.evidence)}`, 'command mkdir -- "$evidence"; or exit 1',
    `command timeout --signal=TERM --kill-after=120s 4080s fish --no-config -c ${q(checked)} > "$evidence/worker.stdout" 2> "$evidence/worker.stderr"`,
    'set -l code $status', 'for stream in stdout stderr; if test (command wc -c < "$evidence/worker.$stream") -gt 65536; set code 1; end; end',
    'printf \'%s\\n\' $code > "$evidence/command.exit"; or exit 1', 'command cat -- "$evidence/worker.stdout"; command cat -- "$evidence/worker.stderr" >&2',
    'if test -f "$evidence/receipt.json"; command cat -- "$evidence/receipt.json"; end', 'printf \'HOST_NATIVE_BUILD_EXIT=%s\\n\' $code', 'exit $code'].join("; ");
  return "fish --no-config -c " + q(parent);
}

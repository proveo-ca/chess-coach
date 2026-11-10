// SPEC: _spec/gpu-host-build-inventory.puml
import { readFile } from "node:fs/promises";
import plan from "./plan-run2.json";
import { quoteFish as q } from "../host-receive/bootstrap";

export async function inventoryProgram() {
  const source = await readFile(new URL("./collector.ts", import.meta.url), "utf8");
  const program = new Bun.Transpiler({ loader: "ts", target: "bun" }).transformSync(source) + `\nawait runHostInventory(${JSON.stringify(plan)});`;
  if (Buffer.byteLength(program) > 65536) throw Error("INLINE_INVENTORY_PROGRAM_SIZE_LIMIT");
  return program;
}

export async function renderHostBuildInventory() {
  const js = await inventoryProgram();
  const worker = ["set -gx MISE_AUTO_INSTALL false", "set -gx MISE_EXEC_AUTO_INSTALL false", "set -gx MISE_TASK_RUN_AUTO_INSTALL false",
    `command mise exec core:bun@1.4.0 core:rust@1.95.0 -- bun --no-env-file --no-install --eval ${q(js)} -- ${q(plan.grant)} < /dev/null`].join("; ");
  const checked = `set -l program ${q(worker)}; fish --no-config -n -c "$program" > ${q(plan.evidence + "/syntax.stdout")} 2> ${q(plan.evidence + "/syntax.stderr")}; or exit $status; fish --no-config -c "$program"`;
  const parent = [`set -l evidence ${q(plan.evidence)}`, 'command mkdir -- "$evidence"; or exit 1',
    `command timeout --signal=TERM --kill-after=5s 55s fish --no-config -c ${q(checked)} > "$evidence/worker.stdout" 2> "$evidence/worker.stderr"`,
    'set -l code $status', 'for stream in stdout stderr; if test (command wc -c < "$evidence/worker.$stream") -gt 65536; set code 1; end; end',
    'printf \'%s\\n\' $code > "$evidence/command.exit"; or exit 1',
    'if test -f "$evidence/syntax.stderr"; command cat -- "$evidence/syntax.stderr" >&2; end',
    'command cat -- "$evidence/worker.stdout"; command cat -- "$evidence/worker.stderr" >&2',
    'if test -f "$evidence/receipt.json"; command cat -- "$evidence/receipt.json"; end',
    'printf \'HOST_BUILD_INVENTORY_EXIT=%s\\n\' $code', 'exit $code'].join("; ");
  return "fish --no-config -c " + q(parent);
}

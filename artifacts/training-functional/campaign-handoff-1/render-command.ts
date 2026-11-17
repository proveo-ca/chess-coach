// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import type { FrozenPlan } from "./preflight";
import type { CampaignPlan } from "../campaign-plan";

export function projectHostPlan(plan: CampaignPlan, requestSha256: string): FrozenPlan {
  if (!plan.budget || !/^[a-f0-9]{64}$/.test(requestSha256)) throw new Error("HOST plan: SOURCE_PACKET");
  const runsParent = plan.root.slice(0, plan.root.lastIndexOf("/")), nodes = new Map<string, "directory" | "executable">([[runsParent, "directory"]]);
  for (const name of ["app", "reference", "qualification-inputs"]) nodes.set(`${plan.retainedPreparedInputs}/${name}`, "directory");
  for (const name of ["score", "channel"]) nodes.set(`${plan.retainedPreparedInputs}/app/artifacts/training-functional/qualification-policy-${name}.ts`, "executable");
  for (const mount of plan.mounts.filter(m => m.readonly && !m.source.startsWith(plan.inputs + "/"))) {
    const executable = mount.source === plan.cachedBun || ["policy-score", "policy-channel", "policy-initialize"].some(s => mount.source.endsWith("/" + s));
    nodes.set(mount.source, executable ? "executable" : "directory");
  }
  return { version: "chess-coach.campaign-host-preflight.v1", host: plan.host, cachedBun: plan.cachedBun, runsParent, requestSha256,
    minimumUsableBytes: String(plan.budget.minimumFreeBytes), minimumFreeEntries: String(plan.storageAdmission.requiredFreeEntries),
    freshRoots: [plan.delivery, plan.inputs, plan.root], retained: [...nodes].map(([path, kind]) => ({ path, kind })) };
}

export function renderHostCommand(source: Uint8Array, plan: FrozenPlan, publicationCommit: string): string {
  if (!(source instanceof Uint8Array) || source.byteLength === 0 || source.byteLength > 16384 || !/^[a-f0-9]{40}$/.test(publicationCommit) ||
    typeof plan.cachedBun !== "string" || !plan.cachedBun.startsWith("/") || plan.cachedBun.length > 512 || /[\0\r\n]/.test(plan.cachedBun)) throw new Error("HOST command: ENVELOPE");
  const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64"), sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const planBytes = Buffer.from(JSON.stringify(plan)), payload = Bun.gzipSync(Uint8Array.from(source)), planPayload = Bun.gzipSync(planBytes);
  if (planBytes.byteLength > 16384) throw new Error("HOST command: PLAN_BOUND");
  const program = `const{createHash}=require("node:crypto");const sha=b=>createHash("sha256").update(b).digest("hex");` +
    `if(Bun.version!=="1.4.0"||process.platform!=="linux"||process.execPath!==${JSON.stringify(plan.cachedBun)})throw new Error("HOST_CONTEXT");` +
    `const compressed=Buffer.from("${encode(payload)}","base64"),packedPlan=Buffer.from("${encode(planPayload)}","base64");` +
    `if(sha(compressed)!=="${sha(payload)}"||sha(packedPlan)!=="${sha(planPayload)}")throw new Error("TRANSPORT_HASH");` +
    `const source=Bun.gunzipSync(compressed),planBytes=Bun.gunzipSync(packedPlan);` +
    `if(source.length!==${source.byteLength}||sha(source)!=="${sha(source)}"||planBytes.length!==${planBytes.byteLength}||sha(planBytes)!=="${sha(planBytes)}")throw new Error("SOURCE_PLAN_HASH");` +
    `const plan=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(planBytes));` +
    `const js=new Bun.Transpiler({loader:"ts"}).transformSync(new TextDecoder("utf-8",{fatal:true}).decode(source));` +
    `const inspector=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));` +
    `const report=await inspector.inspect(inspector.metadataIO(),plan);` +
    `console.log("Executor: "+JSON.stringify({publicationCommit:"${publicationCommit}",sourceSha256:"${sha(source)}",planSha256:"${sha(planBytes)}",report}));` +
    `process.exitCode=report.status==="PASS_METADATA_PRECONDITIONS"?0:1;`;
  const quoted = program.replace(/[\\"$`]/g, c => "\\" + c);
  const executable = plan.cachedBun.replace(/[\\"$`]/g, c => "\\" + c);
  const body = `set -euo pipefail\nB="${executable}"\ntest -x "$B"\ncd /\nexec env -i PATH=/usr/local/bin:/usr/bin:/bin BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 "$B" --no-env-file --no-install -e "${quoted}"\n`;
  if (body.includes("'")) throw new Error("HOST command: INTERIOR_SINGLE_QUOTE");
  return `# SPEC: _spec/runtime-protocol.puml\nenv -i PATH=/usr/local/bin:/usr/bin:/bin bash --noprofile --norc -c '\n${body}'\n`;
}

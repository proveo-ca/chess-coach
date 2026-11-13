// SPEC: _spec/runtime-protocol.puml
import { createDeliveryRuntime } from "./delivery-bootstrap.ts";
import type { DeliveryPins, DeliveryRuntime } from "./delivery-bootstrap.ts";

export const fishQuote = (text: string): string => "'" + text.replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";

export type PublishedPacket = { readonly status: "LEAD_VERIFIED_NORMAL_COMMIT_AND_HTTPS_PUSH"; readonly commitOid: string; readonly packetGitBlobOid: string; readonly packetSha256: string; readonly packetBytes: number };

export async function renderDelivery(pins: DeliveryPins, scope: "OFFLINE_SYNTHETIC_NONRUNNING" | "PUBLISHED_OPERATOR_ONLY", publication?: PublishedPacket) {
  const api: DeliveryRuntime = await createDeliveryRuntime(); api.checkPins(pins);
  const synthetic = scope === "OFFLINE_SYNTHETIC_NONRUNNING";
  api.need(synthetic || scope === "PUBLISHED_OPERATOR_ONLY", "explicit-delivery-render-scope-required");
  if (!synthetic) {
    api.need(api.constants.blockers.length === 0, `PRODUCTION_DELIVERY_BLOCKED:${api.constants.blockers.join(",")}`);
    api.need(publication?.status === "LEAD_VERIFIED_NORMAL_COMMIT_AND_HTTPS_PUSH" && publication.commitOid === pins.commitOid && publication.packetGitBlobOid === pins.gitBlobOid && publication.packetSha256 === pins.sha256 && publication.packetBytes === pins.bytes, "successful-committed-packet-and-https-publication-required");
  }
  const inline = `(${createDeliveryRuntime.toString()})().then(api=>api.runProduction(${JSON.stringify(pins)})).then(result=>{if(result.failure!==null)process.exitCode=1;}).catch(()=>{process.stderr.write("DELIVERY_BLOCKED_OR_FAILED\\n");process.exitCode=1;})`;
  const body = [
    ...(synthetic ? ["# OFFLINE_SYNTHETIC_NONRUNNING: syntax fixture only; no publication pins or operator command.", "exit 1"] : []),
    "begin",
    "  set -lx MISE_AUTO_INSTALL false",
    "  set -lx MISE_TASK_RUN_AUTO_INSTALL false",
    "  set -lx MISE_EXEC_AUTO_INSTALL false",
    `  test (pwd -P) = ${fishQuote(api.constants.HOSTROOT)}; or exit 1`,
    "  command mise exec core:bun@1.4.0 -- bun --no-env-file --no-install --eval " + fishQuote(inline),
    "end"
  ].join("\n") + "\n";
  api.need(Buffer.byteLength(inline) + 1 <= 131072 && Buffer.byteLength(body) + 1 <= 131072, "linux-literal-argument-cap");
  return { scope, body, inline, runnableOperatorCommand: !synthetic, blockers: api.constants.blockers };
}

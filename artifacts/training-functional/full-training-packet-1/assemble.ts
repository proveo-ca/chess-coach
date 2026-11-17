// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual as same } from "node:util";
import { campaignCheck as check, campaignPlan, CAMPAIGN_ADDITIONS, CAMPAIGN_PACKET, extendCampaignSource, SELECTED_CAMPAIGN_BUDGET } from "../campaign-plan";
import type { SourceRow } from "../campaign-plan";
import type { BindingDocument, PreparedInputManifest } from "../qualification-operator";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function read(path: string): Uint8Array {
  check(/^[a-zA-Z0-9_./-]+$/.test(path) && path.split("/").every(p => p && p !== "." && p !== ".."), "LOCAL_ASSEMBLY_PATH");
  const physical = resolve(root, path), stat = lstatSync(physical);
  check(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 16 * 1048576, "LOCAL_ASSEMBLY_FILE"); return readFileSync(physical);
}
function pin(path: string): SourceRow { const bytes = read(path); return { path, byteLength: bytes.byteLength, sha256: sha(bytes) }; }
function json<T>(path: string): T { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(read(path))) as T; }
function equalPin(row: SourceRow): void { check(same(pin(row.path), row), `LOCAL_SOURCE_DRIFT:${row.path}`); }
function write(name: string, value: unknown): SourceRow {
  const path = `${CAMPAIGN_PACKET}/${name}`; writeFileSync(resolve(root, path), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 }); return pin(path);
}
export function assembleCampaignPacket() {
  const verification = json<{ status: string; sourcePinsAfter: SourceRow[]; sourcePinsMatch: boolean }>(`${CAMPAIGN_PACKET}/verification.json`);
  check(verification.status === "PASS_SOURCE_ONLY_CAMPAIGN_PACKET_VERIFICATION" && verification.sourcePinsMatch, "VERIFICATION_REQUIRED");
  for (const row of verification.sourcePinsAfter) equalPin(row);
  const original = "artifacts/training-functional/qualification-packet-1/source-3", sourcePath = `${original}/source-manifest.json`, documentPath = `${original}/binding-documents.json`;
  check(pin(sourcePath).sha256 === "9820e6bfb34f5891117379b207cfd193330d5bd1efbf6c8d36f6ff6e0328836b" &&
    pin(documentPath).sha256 === "5cd45f5cad1b5f08e07a54cbfd68834ff00eda4f0d6c40f02922bac07d3ca7fe", "IMMUTABLE_GENERATION");
  const originalSource = json<{ files: SourceRow[] }>(sourcePath), originalDocuments = json<{ scope: string; documents: BindingDocument[] }>(documentPath);
  for (const row of originalSource.files) equalPin(row);
  for (const row of originalDocuments.documents) equalPin(row.source);
  const source = extendCampaignSource(originalSource.files, CAMPAIGN_ADDITIONS.map(pin));
  const sourceRef = write("source-manifest.json", source), plan = campaignPlan(SELECTED_CAMPAIGN_BUDGET);
  const replacements = new Map<string, SourceRow>([["source", sourceRef], ["tests", pin(`${CAMPAIGN_PACKET}/verification.json`)],
    ["runtimeConfiguration", pin(`${CAMPAIGN_PACKET}/runtime-configuration.json`)], ["recipe", pin(`${CAMPAIGN_PACKET}/plan.json`)]]);
  const documents = { scope: originalDocuments.scope, generation: "full-training-packet-1", documents: originalDocuments.documents.map(row => ({ ...row,
    source: replacements.get(row.role) ?? { ...row.source } })) };
  const documentsRef = write("binding-documents.json", documents);
  const retained = json<PreparedInputManifest>("artifacts/training-functional/qualification-result-1/returned-2/input-manifest.json");
  const dependencies = retained.source.filter(row => row.path.startsWith("node_modules/zod/"));
  check(dependencies.length === 840 && retained.source.length === 948 && originalSource.files.every(row => retained.source.some(r => same(r, row))), "RETAINED_PHYSICAL_SOURCE");
  const prepared: PreparedInputManifest = { version: "chess-coach.qualification-inputs.v1", documents: documents.documents,
    source: [...source.files, ...dependencies].sort((a, b) => a.path.localeCompare(b.path)), reference: retained.reference.map(row => ({ ...row })) };
  const preparedRef = write("input-manifest.json", prepared);
  const bare = ({ path: _path, ...value }: SourceRow) => value;
  const request = { version: "chess-coach.training-campaign-request.v1", plan, preparedInputManifest: bare(preparedRef), sourceManifest: bare(sourceRef),
    bindingDocuments: bare(documentsRef), verification: bare(pin(`${CAMPAIGN_PACKET}/verification.json`)), trainingExecutionAuthorized: false, publicationAuthorized: false };
  const requestRef = write("request.json", request);
  const record = { status: "PASS_LOCAL_PACKET_ASSEMBLY_NOT_HOST_PREPARATION", source: sourceRef, bindingDocuments: documentsRef, preparedInputManifest: preparedRef, request: requestRef,
    executionFiles: source.fileCount, physicalRows: prepared.source.length, retainedDependencyRows: dependencies.length, documentRoles: prepared.documents.length,
    replacedDocumentRoles: [...replacements.keys()], retainedReferenceRows: prepared.reference.length, originalExecutionFilesRehashed: 108, originalDocumentsRehashed: 14,
    retainedHostDependencyAndReferencePayloadsRehashed: false, rootsHostChecked: false, trainingExecutionAuthorized: false, trainingExecuted: false, publicationPerformed: false };
  write("assembly.json", record); return record;
}
if (import.meta.main) console.log("Executor: " + JSON.stringify(assembleCampaignPacket()));

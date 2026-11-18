// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { isDeepStrictEqual as same } from "node:util";
import { campaignPlan, CAMPAIGN_ADDITIONS, extendCampaignSource, SELECTED_CAMPAIGN_BUDGET } from "../campaign-plan";
import type { SourceRow } from "../campaign-plan";
import type { BindingDocument, PreparedInputManifest } from "../qualification-operator";
import { ensure, HARNESS_ARCHIVE, PACKET1, PACKET2, readBytes, REPOSITORY, sha, writeNew } from "./preserve";
import { PROCEED_DECISION, VOLUME_EVIDENCE } from "./prepare-metadata";

export const ORIGINAL = "artifacts/training-functional/qualification-packet-1/source-3";
export const RETAINED_INPUTS = "artifacts/training-functional/qualification-result-1/returned-2/input-manifest.json";
export const VERIFICATION_STATUS = "PASS_SOURCE_ONLY_V2_CAMPAIGN_PACKET_VERIFICATION";
export type AssemblyIO = { read(path: string): Uint8Array; writeNew(path: string, bytes: Uint8Array): void };
export const localAssemblyIO: AssemblyIO = { read: readBytes, writeNew };
export function bytesFrom(io: Pick<AssemblyIO, "read">, path: string): Uint8Array {
  ensure(/^[a-zA-Z0-9_./-]+$/.test(path) && !path.startsWith("/") && path.split("/").every(p => p && p !== "." && p !== ".."), "ASSEMBLY_PATH");
  const bytes = io.read(path); ensure(bytes instanceof Uint8Array && bytes.length <= 4 * 1048576, "ASSEMBLY_BOUND"); return bytes;
}
export function jsonFrom<T>(io: Pick<AssemblyIO, "read">, path: string): T { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytesFrom(io, path))) as T; }
export function pinFrom(io: Pick<AssemblyIO, "read">, path: string): SourceRow { const bytes = bytesFrom(io, path); return { path, byteLength: bytes.length, sha256: sha(bytes) }; }
function requirePin(io: Pick<AssemblyIO, "read">, row: SourceRow) { ensure(same(pinFrom(io, row.path), row), `ASSEMBLY_PIN:${row.path}`); }
export function verificationPaths(io: Pick<AssemblyIO, "read"> = localAssemblyIO): string[] {
  const prior = jsonFrom<{ sourcePinsAfter: SourceRow[] }>(io, `${PACKET1}/verification.json`);
  return [...new Set([...prior.sourcePinsAfter.map(row => row.path), ...["preserve.ts", "prepare-metadata.ts", "assemble.ts", "verify.ts", "verify-source.ts",
    "assemble.test.ts", "tsconfig.json", "plan.json", "runtime-configuration.json", "storage-assessment.json", "preservation.json"].map(name => `${PACKET2}/${name}`),
    PROCEED_DECISION, `${VOLUME_EVIDENCE}/user-report.json`, `${VOLUME_EVIDENCE}/observation.json`, `${VOLUME_EVIDENCE}/verification.json`,
    RETAINED_INPUTS, `${PACKET1}/verification.json`, `${PACKET1}/checks-2/receipt.json`,
    `${PACKET2}/test-harness-preservation.json`, `${PACKET2}/test-harness-adjustment.json`, HARNESS_ARCHIVE,
    "tsconfig.json", "tsconfig.tests.json", "packages/runtime/tests/storage-bounds.test.ts",
    ...["fixture.ts", "repository-scratch.ts", "training-fixture.ts", "match-fixture.ts"].map(name => `packages/runtime/tests/${name}`),
    ...["contracts", "policy", "runtime", "starchess-core"].map(name => `packages/${name}/package.json`),
    "_spec/qualification-bootstrap.puml", "packages/runtime/tests/training-coordinator.test.ts",
    ...new Bun.Glob("artifacts/training-functional/*.ts").scanSync({ cwd: REPOSITORY, onlyFiles: true, followSymlinks: false }),
    "packages/contracts/node_modules/zod/package.json", "node_modules/typescript/package.json"])] .sort((a, b) => a.localeCompare(b));
}
export function checkSourceVerification(io: Pick<AssemblyIO, "read">): void {
  const verification = jsonFrom<{ status: string; sourcePinsBefore: SourceRow[]; sourcePinsAfter: SourceRow[]; sourcePinsMatch: boolean }>(io, `${PACKET2}/verification.json`);
  ensure(verification.status === VERIFICATION_STATUS && verification.sourcePinsMatch && same(verification.sourcePinsBefore, verification.sourcePinsAfter), "VERIFICATION_REQUIRED");
  ensure(same(verification.sourcePinsAfter.map(row => row.path), verificationPaths(io)), "VERIFICATION_COVERAGE");
  for (const row of verification.sourcePinsAfter) requirePin(io, row);
}
export function assembleCampaignPacket2(io: AssemblyIO = localAssemblyIO) {
  checkSourceVerification(io);
  const originalSourceRef = pinFrom(io, `${ORIGINAL}/source-manifest.json`), originalDocumentsRef = pinFrom(io, `${ORIGINAL}/binding-documents.json`);
  ensure(originalSourceRef.sha256 === "9820e6bfb34f5891117379b207cfd193330d5bd1efbf6c8d36f6ff6e0328836b" &&
    originalDocumentsRef.sha256 === "5cd45f5cad1b5f08e07a54cbfd68834ff00eda4f0d6c40f02922bac07d3ca7fe", "IMMUTABLE_QUALIFICATION_GENERATION");
  const originalSource = jsonFrom<{ files: SourceRow[] }>(io, originalSourceRef.path), originalDocuments = jsonFrom<{ scope: string; documents: BindingDocument[] }>(io, originalDocumentsRef.path);
  for (const row of originalSource.files) requirePin(io, row);
  for (const row of originalDocuments.documents) requirePin(io, row.source);
  const plan = campaignPlan(SELECTED_CAMPAIGN_BUDGET, 2), recipe = jsonFrom<{ plan: unknown }>(io, `${PACKET2}/plan.json`);
  ensure(plan.version === "chess-coach.training-campaign-plan.v2" && same(recipe.plan, plan), "V2_RECIPE");
  const runtime = jsonFrom<Record<string, unknown>>(io, `${PACKET2}/runtime-configuration.json`);
  ensure(runtime.version === "chess-coach.campaign-runtime-configuration.v2" && runtime.entryPolicy === plan.entryPolicy && runtime.root === plan.root &&
    same(runtime.budget, plan.budget) && same(runtime.resources, plan.resources) && same(runtime.limits, plan.limits) &&
    same(runtime.storageAdmission, plan.storageAdmission) && same(runtime.mounts, plan.mounts), "V2_RUNTIME_CONFIGURATION");
  const write = (name: string, value: unknown): SourceRow => { const path = `${PACKET2}/${name}`;
    io.writeNew(path, Buffer.from(JSON.stringify(value, null, 2) + "\n")); return pinFrom(io, path); };
  const source = extendCampaignSource(originalSource.files, CAMPAIGN_ADDITIONS.map(path => pinFrom(io, path))), sourceRef = write("source-manifest.json", source);
  const replacements = new Map<string, SourceRow>([["source", sourceRef], ["tests", pinFrom(io, `${PACKET2}/verification.json`)],
    ["runtimeConfiguration", pinFrom(io, `${PACKET2}/runtime-configuration.json`)], ["recipe", pinFrom(io, `${PACKET2}/plan.json`)]]);
  const documents = { scope: originalDocuments.scope, generation: "full-training-packet-2", documents: originalDocuments.documents.map(row => ({ ...row, source: replacements.get(row.role) ?? { ...row.source } })) };
  const documentsRef = write("binding-documents.json", documents), retained = jsonFrom<PreparedInputManifest>(io, RETAINED_INPUTS);
  const dependencies = retained.source.filter(row => row.path.startsWith("node_modules/zod/"));
  ensure(dependencies.length === 840 && retained.source.length === 948 && originalSource.files.every(row => retained.source.some(other => same(other, row))), "RETAINED_PHYSICAL_SOURCE");
  const prepared: PreparedInputManifest = { version: "chess-coach.qualification-inputs.v1", documents: documents.documents,
    source: [...source.files, ...dependencies].sort((a, b) => a.path.localeCompare(b.path)), reference: retained.reference.map(row => ({ ...row })) };
  const preparedRef = write("input-manifest.json", prepared), bare = ({ path: _path, ...value }: SourceRow) => value;
  const request = { version: "chess-coach.training-campaign-request.v2", plan, preparedInputManifest: bare(preparedRef), sourceManifest: bare(sourceRef),
    bindingDocuments: bare(documentsRef), verification: bare(pinFrom(io, `${PACKET2}/verification.json`)), trainingExecutionAuthorized: false, publicationAuthorized: false };
  const requestRef = write("request.json", request), record = { status: "PASS_LOCAL_V2_PACKET_ASSEMBLY_NOT_HOST_PREPARATION", source: sourceRef,
    bindingDocuments: documentsRef, preparedInputManifest: preparedRef, request: requestRef, executionFiles: source.fileCount, physicalRows: prepared.source.length,
    retainedDependencyRows: dependencies.length, documentRoles: prepared.documents.length, replacedDocumentRoles: [...replacements.keys()], retainedReferenceRows: prepared.reference.length,
    originalExecutionFilesRehashed: 108, originalDocumentsRehashed: 14, retainedHostDependencyAndReferencePayloadsRehashed: false, rootsHostChecked: false,
    entryAllocationGuaranteed: false, trainingExecutionAuthorized: false, trainingExecuted: false, publicationPerformed: false };
  write("assembly.json", record); return record;
}
if (import.meta.main) {
  try { ensure(Bun.argv.length === 2, "ASSEMBLY_ARGUMENTS"); console.log("Executor: " + JSON.stringify(assembleCampaignPacket2())); }
  catch (error) { console.error("Executor: " + String(error)); process.exitCode = 1; }
}

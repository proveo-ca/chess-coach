// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { isDeepStrictEqual as same } from "node:util";
import { campaignPlan, CAMPAIGN_ADDITIONS, extendCampaignSource, SELECTED_CAMPAIGN_BUDGET } from "../campaign-plan";
import type { SourceRow } from "../campaign-plan";
import { decodeCampaignRequest } from "../campaign-operator";
import type { BindingDocument, PreparedInputManifest } from "../qualification-operator";
import { checkSourceVerification, bytesFrom, jsonFrom, localAssemblyIO, ORIGINAL, pinFrom, RETAINED_INPUTS } from "./assemble";
import type { AssemblyIO } from "./assemble";
import { checkPreservedPacket1, checkTestHarnessAdjustment, ensure, PACKET1, PACKET2, pin } from "./preserve";
import { packetMetadata } from "./prepare-metadata";

export function verifyCampaignPacket2(io: AssemblyIO = localAssemblyIO) {
  const preservation = checkPreservedPacket1(); checkTestHarnessAdjustment(); checkSourceVerification(io);
  const original = jsonFrom<{ files: SourceRow[] }>(io, `${ORIGINAL}/source-manifest.json`), plan = campaignPlan(SELECTED_CAMPAIGN_BUDGET, 2);
  const source = jsonFrom<ReturnType<typeof extendCampaignSource>>(io, `${PACKET2}/source-manifest.json`);
  ensure(same(source, extendCampaignSource(original.files, CAMPAIGN_ADDITIONS.map(path => pinFrom(io, path)))), "CURRENT_WORKER_SOURCE");
  for (const row of source.files) ensure(same(pinFrom(io, row.path), row), `WORKER_SOURCE:${row.path}`);
  const documents = jsonFrom<{ generation: string; documents: BindingDocument[] }>(io, `${PACKET2}/binding-documents.json`);
  const oldDocuments = jsonFrom<{ documents: BindingDocument[] }>(io, `${ORIGINAL}/binding-documents.json`), retained = jsonFrom<PreparedInputManifest>(io, RETAINED_INPUTS);
  const roles = new Map<string, string>([["source", "source-manifest.json"], ["tests", "verification.json"], ["runtimeConfiguration", "runtime-configuration.json"], ["recipe", "plan.json"]]);
  ensure(documents.generation === "full-training-packet-2" && documents.documents.length === 14 && oldDocuments.documents.length === 14, "DOCUMENT_GENERATION");
  const expectedDocuments = oldDocuments.documents.map(row => ({ ...row, source: roles.has(row.role) ? pinFrom(io, `${PACKET2}/${roles.get(row.role)!}`) : row.source }));
  ensure(same(documents.documents, expectedDocuments), "FOUR_REPLACEMENTS_TEN_PRESERVED");
  for (const row of documents.documents) ensure(same(pinFrom(io, row.source.path), row.source), `DOCUMENT_BYTES:${row.role}`);
  const prepared = jsonFrom<PreparedInputManifest>(io, `${PACKET2}/input-manifest.json`), dependencies = retained.source.filter(row => row.path.startsWith("node_modules/zod/"));
  ensure(same(prepared, { version: "chess-coach.qualification-inputs.v1", documents: documents.documents,
    source: [...source.files, ...dependencies].sort((a, b) => a.path.localeCompare(b.path)), reference: retained.reference }), "PHYSICAL_ROWS");
  ensure(source.fileCount === 112 && prepared.source.length === 952 && dependencies.length === 840 && prepared.reference.length === 9, "CLOSURE_COUNTS");
  const metadata = packetMetadata();
  ensure(same(jsonFrom(io, `${PACKET2}/plan.json`), metadata.recipe) && same(jsonFrom(io, `${PACKET2}/runtime-configuration.json`), metadata.runtime) &&
    same(jsonFrom(io, `${PACKET2}/storage-assessment.json`), metadata.storage), "V2_METADATA_AND_ACKNOWLEDGEMENT");
  const request = decodeCampaignRequest(bytesFrom(io, `${PACKET2}/request.json`)), bare = ({ path: _path, ...value }: SourceRow) => value;
  ensure(request.version === "chess-coach.training-campaign-request.v2" && same(request.plan, plan) &&
    same(request.preparedInputManifest, bare(pinFrom(io, `${PACKET2}/input-manifest.json`))) && same(request.sourceManifest, bare(pinFrom(io, `${PACKET2}/source-manifest.json`))) &&
    same(request.bindingDocuments, bare(pinFrom(io, `${PACKET2}/binding-documents.json`))) && same(request.verification, bare(pinFrom(io, `${PACKET2}/verification.json`))), "REQUEST_JOIN");
  const prior = jsonFrom<{ files: SourceRow[] }>(io, `${PACKET1}/source-manifest.json`), workerDeltas = source.files.filter(row => !prior.files.some(old => same(old, row)));
  ensure(same(workerDeltas.map(row => row.path).sort(), ["artifacts/training-functional/campaign-plan.ts", "artifacts/training-functional/campaign-operator.ts"].sort()), "ONLY_TWO_WORKER_DELTAS");
  return { status: "PASS_ASSEMBLED_V2_PACKET_PINS_MEMBERSHIP_POLICY_AND_PRESERVATION", request: pinFrom(io, `${PACKET2}/request.json`),
    verification: pinFrom(io, `${PACKET2}/verification.json`), preservation: pin(`${PACKET2}/preservation.json`),
    preservedWorkerSourceFiles: preservation.workerSource.length, unchangedPacket1Files: preservation.packet1Files.length,
    workerDeltas, executionFiles: 112, physicalSourceRows: 952, retainedDependencyRows: 840, bindingRoles: 14,
    replacedBindingRoles: 4, unchangedBindingRoles: 10, referenceRows: 9, allLocalExecutionAndDocumentBytesRehashed: true,
    retainedHostDependencyAndReferencePayloadsRehashed: false, rootsHostChecked: false, entryAllocationGuaranteed: false,
    directoryUsabilityVerified: false, selinuxCompatibilityVerified: false, hostPreparationExecuted: false, trainingExecuted: false,
    trainingExecutionAuthorized: false, publicationPerformed: false };
}
if (import.meta.main) {
  try { ensure(Bun.argv.length === 2, "VERIFY_ARGUMENTS"); console.log("Executor: " + JSON.stringify(verifyCampaignPacket2())); }
  catch (error) { console.error("Executor: " + String(error)); process.exitCode = 1; }
}

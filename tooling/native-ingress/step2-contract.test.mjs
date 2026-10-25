// SPEC: _spec/tooling/native-ingress/step2.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const json = name => JSON.parse(fs.readFileSync(new URL('../../_spec/tooling/native-ingress/' + name, import.meta.url), 'utf8'));
const rust = json('rust-runtime-inputs.receipt.json');
const sdk = json('gnu-sdk-subset-catalog.receipt.json');
const membership = json('gnu-sdk-manifest-membership.receipt.json');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const plan = fs.readFileSync(new URL('../../_spec/_plans/native-ingress-step2.md', import.meta.url), 'utf8');
const selectionBlock = plan.match(/<!-- BEGIN EXECUTION PROVIDER SELECTION -->\n```json\n([\s\S]*?)\n```\n<!-- END EXECUTION PROVIDER SELECTION -->/);

test('closed role set contains one SDK and exactly five frozen Rust inputs', () => {
  assert.deepEqual(['gnu-sdk', ...rust.inputs.map(value => value.role)],
    ['gnu-sdk', 'cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview']);
  assert.equal(rust.inputs.reduce((n, value) => n + value.byteLength, 0), 127772720);
  assert.equal(rust.inputs.reduce((n, value) => n + 2 * value.byteLength + 2, 0), 255545450);
  assert.equal(rust.inputs.reduce((n, value) => n + 2 * (Math.ceil(value.byteLength / 65536) + 1), 0), 3916);
  for (const input of rust.inputs) {
    assert.equal(input.incomingSha256, input.readbackSha256);
    assert.match(input.incomingSha256, /^[a-f0-9]{64}$/);
    assert.equal(input.finalMetadata.size, String(input.byteLength));
  }
});

test('literal SDK payload observations fit the proposed disjoint format budgets', () => {
  const groups = { elf: [], rel: [], ar: [], text: [] };
  for (const row of sdk.selectedRegularMetadata) {
    const name = row[0];
    const kind = name.endsWith('.a') ? 'ar' : name.endsWith('.o') ? 'rel'
      : /\/sysroot\/usr\/lib\/lib[cm]\.so$|\/sysroot\/lib\/libgcc_s\.so$/.test(name) ? 'text' : 'elf';
    groups[kind].push(row);
  }
  assert.deepEqual(Object.values(groups).map(values => values.length), [28, 10, 4, 3]);
  assert.equal(sdk.selectedRegularMetadata.length, 45);
  assert.equal(sdk.selectedRegularMetadata.reduce((n, row) => n + row[3], 0), 184285137);
  assert.ok(groups.elf.every(row => row[3] <= 67108864));
  assert.ok(groups.ar.every(row => row[3] <= 8388608));
  assert.ok(groups.text.every(row => row[3] <= 1048576));
});

test('all legacy manifest classifications remain unresolved preparation context', () => {
  assert.equal(membership.manifest.totalReferences, 190);
  assert.equal(membership.manifest.histogram.REGULAR_FILE, 152);
  assert.equal(membership.manifest.absentNames.length, 38);
  assert.equal(membership.manifest.histogram.ABSENT_FROM_ARCHIVE, 38);
  for (const receipt of [membership, sdk, rust]) {
    assert.equal(receipt.nativeQualified, false);
    assert.equal(receipt.rustReady, false);
    assert.equal(receipt.trainingReady, false);
    assert.equal(receipt.installedUsability, false);
  }
  assert.equal(membership.relocationReady, false);
  assert.equal(sdk.roleSatisfied, false);
});

test('reused frozen parser and transport bytes remain pinned', () => {
  for (const [name, expected] of [
    ['elf-metadata', 'b223a655eae572137891a2c6efafee16887a2478fc91052f0092b48dfd65de85'],
    ['tar-inventory', '050d629963fdf89bd5dff7639260c7de30b08be46320b7b6bb7ed4dac6bb8139'],
    ['gnu-sdk-inventory', 'bd2fc43633ca3b8f0c485eddb68a1b7505002edecd70eee4bf9cc661f588ef29'],
    ['xz-staging', 'f75c21a58bb67e6ab3f8b1dafd090e11ac2d3a70f017da35afb81b00761b71b4'],
  ]) assert.equal(sha(fs.readFileSync(new URL('./' + name + '.mjs', import.meta.url))), expected);
});

test('plan separates input observations, execution qualification and training acceptance', () => {
  for (const phrase of ['No production entry point accepts arbitrary URLs', 'role', 'same-FD',
    'no decoded-archive spool', '38 absences', 'enforceable offline execution', 'No step receipt grants training authority']) {
    assert.ok(plan.toLowerCase().includes(phrase.toLowerCase()), phrase);
  }
  assert.ok(plan.includes('Rust1.95.0'));
  assert.ok(plan.includes('Burn=0.22.0'));
  assert.ok(plan.includes('inclusive1048576'));
});

test('integrated owner pointers and exact coverage index agree', () => {
  const spec = '_spec/tooling/native-ingress/step2.puml';
  const files = ['step2-contract.test', 'sdk-payload-inspection', 'sdk-payload-inspection.test',
    'sdk-payload-inspection-operation', 'sdk-payload-inspection-operation.test', 'rust-xz-prefixes',
    'rust-xz-prefixes.test', 'rust-xz-prefixes-operation', 'containment-metadata',
    'containment-metadata.test', 'containment-metadata-operation', 'own-cgroup-locator',
    'own-cgroup-locator.test', 'own-cgroup-locator-operation', 'elf-requirements-v4',
    'elf-requirements-v4.test', 'sdk-payload-inspection-v2-operation',
    'sdk-payload-inspection-v2-operation.test', 'rust-component-layout',
    'rust-component-layout.test', 'rust-component-layout-operation',
    'rust-component-layout-operation.test', 'elf-requirements-v5', 'elf-requirements-v5.test',
    'rust-payload-inspection', 'rust-payload-inspection.test',
    'rust-payload-inspection-operation', 'rust-payload-inspection-operation.test',
    'host-runtime-providers', 'host-runtime-providers.test',
    'host-runtime-providers-operation', 'host-runtime-providers-operation.test',
    'evidence-publication', 'evidence-publication.test', 'toolchain-evidence',
    'toolchain-evidence.test', 'toolchain-evidence-operation',
    'toolchain-evidence-operation.test', 'split-evidence-publication',
    'split-evidence-publication.test', 'split-toolchain-evidence',
    'split-toolchain-evidence.test', 'split-toolchain-evidence-operation',
    'split-toolchain-evidence-operation.test', 'rust-archive-evidence-operation',
    'rust-archive-evidence-operation.test'].map(name => 'tooling/native-ingress/' + name + '.mjs');
  const diagram = fs.readFileSync(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(fs.readFileSync(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(value => value.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) {
    assert.ok(diagram.includes("' covers: " + file + '\n'));
    assert.ok(fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8').startsWith('// SPEC: ' + spec + '\n'));
  }
});

test('selected Docker route grants neither qualification nor compiler execution', () => {
  assert.ok(selectionBlock);
  assert.deepEqual(JSON.parse(selectionBlock[1]), {
    provider: 'docker-managed-jobs', selected: true, qualified: false,
    compilerExecutionAllowed: false, controllerEndpoint: 'unix:///var/run/docker.sock',
    localImagesObserved: 0, rawDelegationRequired: false,
    agentSessionMigrationAllowed: false, privilegedContainerAllowed: false,
    imageAcquisitionAllowed: false,
  });
});

test('Docker admission contract preserves independent enforcement gates', () => {
  for (const gate of ['Image admission', 'Job policy', 'Filesystem map', 'Enforcement fixtures',
    'Clock and cleanup', 'Compiler admission']) assert.ok(plan.includes('**' + gate + ':**'), gate);
  for (const requirement of ['immutable image/rootfs content identity', 'whole rootfs',
    'finite memory, pids and CPU limits', 'swap', 'pull-never', 'network-none', 'read-only rootfs',
    'cap-drop-all', 'no-new-privileges', 'including image defaults', 'AF_UNIX',
    'cgroup-empty evidence', 'blocked daemon communication', 'independent external lifecycle enforcement']) {
    assert.ok(plan.includes(requirement), requirement);
  }
});

test('Docker selection preserves custody and rejects host-control shortcuts', () => {
  for (const prohibition of ['host PID/IPC/network', 'host-root mounts', 'writable cgroup mounts',
    "controller's Docker socket", 'Never mount source writable', 'No pulls, Dockerfile RUN',
    'retain failed/partial evidence', 'Node timers and successful finite fixtures do not prove a hard deadline']) {
    assert.ok(plan.includes(prohibition), prohibition);
  }
  assert.ok(plan.includes('agent-visible versus daemon-host path mapping'));
  assert.ok(plan.includes('A C supervisor is not an unconditional bootstrap dependency'));
  assert.ok(plan.includes('No launcher or generic provider framework'));
});

test('current navigation and diagram show selected but unqualified Docker jobs', () => {
  const navigation = fs.readFileSync(new URL('../../_spec/_plans/PLAN-ml-adjutant.md', import.meta.url), 'utf8');
  const diagram = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/step2.puml', import.meta.url), 'utf8');
  assert.ok(navigation.includes('Docker-managed build jobs instead of pending raw delegation'));
  assert.ok(diagram.includes('Docker-managed jobs selected, not qualified'));
  assert.ok(diagram.includes('local image inventory empty'));
  assert.ok(diagram.includes('Config intent is not enforcement evidence'));
  assert.ok(diagram.includes('No candidate -> direct route stays blocked'));
});

test('Rust layout preparation keeps fixed ceilings and atomic data-only publication', () => {
  for (const requirement of ['fixed268435456 bytes', '45000ms including3000ms cleanup',
    'one outer300000ms clock', 'at least75000ms remaining', '1GiB/role;2GiB/batch',
    '4MiB/role;8MiB/batch', '1MiB/file;4MiB/batch', '16MiB',
    'original feed event arrays/objects by identity', 'Preserve unsupported manifest lines as opaque data',
    'all five core passes', 'ten archive FD closes', 'no adaptive memory/time increase or retry',
    'no extraction, installer equivalence']) assert.ok(plan.includes(requirement), requirement);
});

test('reported Docker capabilities do not grant image or execution admission', () => {
  const daemon = json('docker-daemon-metadata.receipt.json');
  assert.equal(daemon.endpoint, JSON.parse(selectionBlock[1]).controllerEndpoint);
  assert.equal(daemon.scope, 'REPORTED_CAPABILITIES_NOT_ENFORCEMENT_OR_EXECUTABLE_ADMISSION');
  assert.equal(daemon.cgroupVersion, '2');
  assert.equal(daemon.architecture, 'x86_64');
  for (const key of ['daemonMutated', 'containersCreated', 'containersStarted', 'imagesAcquired',
    'compilerExecuted', 'effectiveLimitsVerified', 'dockerProviderQualified',
    'nativeQualified', 'rustReady', 'trainingReady']) assert.equal(daemon[key], false, key);
});

test('Rust layout receipt preserves successful data scope without runtime admission', () => {
  const layout = json('rust-component-layout.receipt.json');
  assert.equal(layout.status, 'RUST_COMPONENT_LAYOUT_DATA');
  assert.equal(layout.roles.reduce((n, row) => n + row.expandedBytes, 0), 642746880);
  assert.equal(layout.roles.reduce((n, row) => n + row.entries, 0), 263);
  assert.equal(layout.roles.reduce((n, row) => n + row.regularFiles, 0), 215);
  assert.equal(layout.roles.reduce((n, row) => n + row.declarationCount, 0), 157);
  assert.ok(layout.roles.every(row => row.installerVersion === '3\n'));
  assert.equal(layout.unknownManifestLines, 0);
  assert.deepEqual(layout.recognizedDestinationConflicts, []);
  assert.equal(layout.counts.archivePasses, 10);
  assert.equal(layout.counts.archiveCloseAttempts, 10);
  assert.equal(layout.runtimeInspectionCandidates.length, 13);
  assert.equal(layout.runtimeInspectionCandidates.reduce((n, row) => n + row.size, 0), 457372178);
  assert.equal(layout.runtimeInspectionCandidates.filter(row => row.size > 67108864).length, 2);
  assert.ok(layout.runtimeInspectionCandidates.every(row => row.size <= 268435456 && !row.path.endsWith('.py')));
  for (const key of ['completeInstallMap', 'completeInstallerInterpretation', 'archiveExtracted',
    'filesInstalled', 'rustExecuted', 'pythonRuntimeInvoked', 'pythonFreeSubsetVerified',
    'runtimeProvidersQualified', 'imagePrepared', 'dockerProviderQualified',
    'nativeQualified', 'rustReady', 'trainingReady']) assert.equal(layout[key], false, key);
});

test('Rust payload receipt preserves unresolved provider and runtime boundaries', () => {
  const payload = json('rust-payload-inspection.receipt.json');
  assert.equal(payload.status, 'RUST_PAYLOAD_DATA_INSPECTED');
  assert.equal(payload.targetCount, 13);
  assert.deepEqual(payload.formatCounts, { ELF_EXEC_DSO: 12, LINKER_TEXT: 1 });
  assert.equal(payload.capturedBytes, 457372178);
  assert.equal(payload.declaredEdgeCount, 69);
  assert.equal(payload.allDependencyEdgesStatus, 'UNRESOLVED');
  assert.equal(payload.counts.completedCorePasses, 5);
  assert.equal(payload.counts.archiveCloseAttempts, 10);
  assert.equal(payload.counts.stageCloses, 50);
  assert.equal(payload.repoCapture.closes, 10);
  assert.equal(payload.resourceAccounting.buffersErased, 13);
  assert.equal(Buffer.byteLength(payload.llvmLinkerText.text), 42);
  assert.deepEqual(payload.llvmLinkerText.references, ['libLLVM.so.22.1-rust-1.95.0-stable']);
  assert.equal(payload.llvmLinkerText.evaluated, false);
  assert.equal(payload.llvmLinkerText.hostResolutionAttempted, false);
  assert.equal(payload.decoderExecuted, true);
  for (const key of ['candidateInvocationAttempted', 'candidateExecuted', 'archiveExtracted',
    'filesInstalled', 'rustExecuted', 'pythonRuntimeInvoked', 'pythonFreeSubsetVerified',
    'runtimeProvidersQualified', 'loaderClosureVerified', 'abiVerified', 'imagePrepared',
    'dockerProviderQualified', 'installedUsability', 'nativeQualified', 'rustReady', 'trainingReady']) {
    assert.equal(payload[key], false, key);
  }
});

test('HOST candidate observation retains the seven-file data-only boundary', () => {
  for (const requirement of ['exactly seven roles', 'HOST_LIBGCC_S', 'Admit1..8MiB/file and32MiB aggregate',
    'seven successes require14 positive closes', 'no-follow/nonblocking read-only opens',
    'One10s cooperative helper clock reserves2s cleanup after8s work',
    'Any failure suppresses all seven candidate records',
    'Their initial hashes and metadata are observations',
    'Do not claim atomic seven-file snapshots']) assert.ok(plan.includes(requirement), requirement);
});

test('retention gap remains explicit and preserved HOST bytes match the original observation', () => {
  const retention = json('evidence-retention.receipt.json');
  assert.equal(retention.missingManagedResults.length, 3);
  assert.ok(retention.missingManagedResults.every(row => row.error === 'ENOENT'));
  assert.equal(retention.missingCauseKnown, false);
  assert.equal(retention.rawEvidenceSetComplete, false);
  assert.equal(retention.consumedOperationsRepeated, false);
  assert.equal(retention.missingResultsReconstructed, false);
  assert.equal(retention.retainedDataDeletedByThisWork, false);
  const preserved = retention.preservedResult;
  const bytes = fs.readFileSync(new URL('../../' + preserved.path, import.meta.url));
  assert.equal(bytes.length, preserved.byteLength);
  assert.equal(sha(bytes), preserved.sha256);
  const observed = JSON.parse(bytes);
  assert.equal(observed.status, 'HOST_RUNTIME_CANDIDATES_OBSERVED');
  assert.equal(observed.candidates.length, 7);
  assert.equal(observed.counts.closesCompleted, 14);
  assert.equal(observed.runtimeProvidersQualified, false);
});

test('fresh evidence requires exclusive repository publication before downstream use', () => {
  for (const requirement of ['each new role gets40s including3s cleanup', 'Require>=70s remaining',
    '8675 namespace entries and7106 regular-file body hashes', 'original-order event projection without bodyOffset',
    'Reserve only `_spec/tooling/native-ingress/toolchain-evidence-collection-v1.result.json` exclusively before any archive read',
    'Reject EEXIST', 'fsync/close the parent directory', 'publicationAccepted:true',
    'valid-looking result file alone grants no acceptance', 'no self-digest',
    'not crash-atomic commit']) assert.ok(plan.includes(requirement), requirement);
});

test('V1 deadline STOP retains its empty reservation without acceptance or retry', () => {
  const stopped = json('toolchain-evidence-collection-v1.stop.json');
  assert.equal(stopped.status, 'STOP');
  assert.equal(stopped.error, 'E_DEADLINE');
  assert.equal(stopped.role, 'gnu-sdk');
  assert.equal(stopped.publicationAccepted, false);
  assert.equal(stopped.collectionCounts.completedCorePasses, 0);
  assert.equal(stopped.publicationCounts.writtenBytes, 0);
  assert.equal(stopped.publicationCounts.closes, 2);
  assert.equal(stopped.reservedObject.size, '0');
  assert.equal(stopped.reservedObject.mode, '33152');
  assert.equal(stopped.consumed, true);
  assert.equal(stopped.retryAuthorized, false);
  assert.equal(stopped.reservedObjectDeletionAuthorized, false);
});

test('approved split preparation keeps independent profiles and joint-evidence gates', () => {
  for (const requirement of ['The user selected Split bounded collections',
    '120s | 40s each', '300s /10s /30s', '150s | 70s',
    'gnu-evidence-collection-v1.result.json', 'rust-evidence-collection-v1.result.json',
    'Rust cargo at index0 still requires offset-aware metadata hashes',
    'One accepted partition is not joint completion',
    'both accepted receipts, both exact hash-matching full files',
    'no old physical collector closure is reused']) assert.ok(plan.includes(requirement), requirement);
});

test('per-archive successor preserves accepted GNU and consumed Rust failure boundaries', () => {
  const accepted = json('gnu-evidence-collection-v1.receipt.json');
  const stopped = json('rust-evidence-collection-v1.stop.json');
  assert.equal(accepted.publicationAccepted, true);
  assert.equal(accepted.result.byteLength, 2829942);
  assert.equal(accepted.result.sha256, '01c24e73a65148b8a70c3c1d4034f86dcac8040859bc206b5cf40b784776cc22');
  assert.equal(accepted.jointEvidenceSetComplete, false);
  assert.equal(stopped.publicationAccepted, false);
  assert.equal(stopped.error, 'E_DEADLINE');
  assert.equal(stopped.role, 'rustc');
  assert.equal(stopped.consumed, true);
  assert.equal(stopped.retryAuthorized, false);
  assert.equal(stopped.reservedObjectDeletionAuthorized, false);
  for (const requirement of ['The user selected Per-archive',
    'Each new role gets120000ms including3000ms cleanup', 'Require>=150000ms remaining',
    'five static', 'rust-archive-{role}-v1.result.json', 'preserve every other writer byte',
    'one input/expectation/target subset', 'without consuming a waiting role',
    'all five accepted archive result/receipt pairs']) assert.ok(plan.toLowerCase().includes(requirement.toLowerCase()), requirement);
});

test('accepted fresh evidence set preserves exact Rust bytes and declaration-only qualification', () => {
  const set = json('toolchain-evidence-set-v1.receipt.json');
  assert.equal(set.freshRawEvidenceSetValidated, true);
  assert.deepEqual(set.rustResults.map(row => row.role), ['cargo', 'rustc', 'rust-std', 'rustfmt-preview', 'clippy-preview']);
  let resultBytes = 0, receiptBytes = 0;
  for (const row of set.rustResults) {
    const basename = 'rust-archive-' + row.role + '-v1';
    const result = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/' + basename + '.result.json', import.meta.url));
    const receipt = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/' + basename + '.receipt.json', import.meta.url));
    assert.equal(result.length, row.byteLength);
    assert.equal(sha(result), row.sha256);
    assert.equal(receipt.length, row.receiptBytes);
    assert.equal(sha(receipt), row.receiptSha256);
    const accepted = JSON.parse(receipt), data = JSON.parse(result);
    assert.equal(accepted.publicationAccepted, true);
    assert.equal(accepted.artifactRole, row.role);
    assert.equal(accepted.sha256, row.sha256);
    assert.equal(accepted.jointEvidenceSetComplete, false);
    assert.equal(data.collection.artifactCount, 1);
    assert.equal(data.collection.roles[0].role, row.role);
    for (const key of ['entries', 'regularFiles', 'expandedBytes', 'selectedPayloads']) assert.equal(data.collection[key], row[key]);
    resultBytes += result.length; receiptBytes += receipt.length;
  }
  assert.equal(resultBytes, set.rustResultBytes);
  assert.equal(receiptBytes, set.rustCompactReceiptBytes);
  assert.deepEqual(set.declarationComparison.missingNames, []);
  assert.deepEqual(set.declarationComparison.missingVersions, []);
  assert.deepEqual(set.declarationComparison.ambiguousProviders, []);
  assert.equal(set.declarationComparison.dependencyQualificationStatus, 'UNRESOLVED');
  for (const key of ['historicalMissingRawResultsRestored', 'atomicSnapshotClaimed', 'failedReservationsReusedOrDeleted',
    'archiveExtracted', 'compilerExecuted', 'rustExecuted', 'pythonRuntimeInvoked', 'sourceAuthenticated',
    'runtimeProvidersQualified', 'abiVerified', 'pythonFreeSubsetVerified', 'imagePrepared',
    'dockerProviderQualified', 'nativeQualified', 'rustReady', 'trainingReady']) assert.equal(set[key], false, key);
});

test('finite same-domain declaration comparison reproduces counts without qualifying loading or ABI', () => {
  const set = json('toolchain-evidence-set-v1.receipt.json');
  const collections = [json('gnu-evidence-collection-v1.result.json').collection,
    ...set.rustResults.map(row => json('rust-archive-' + row.role + '-v1.result.json').collection)];
  const rows = collections.flatMap(collection => collection.roles.flatMap(role => role.selected
    .filter(member => member.kind === 'ELF_EXEC_DSO')
    .map(member => ({ domain: member.domain, requirements: member.metadata.requirements }))));
  rows.push(...json('host-runtime-providers.result.json').candidates
    .map(candidate => ({ domain: 'HOST', requirements: candidate.requirements })));
  let neededEdges = 0, versionReferences = 0;
  assert.equal(rows.length, set.declarationComparison.consumerCount);
  for (const domain of ['HOST', 'TARGET']) {
    const providers = new Map();
    for (const row of rows.filter(value => value.domain === domain)) {
      const soname = row.requirements.dynamic.soname;
      if (soname !== null) {
        assert.equal(providers.has(soname), false, domain + ':' + soname);
        providers.set(soname, row.requirements);
      }
    }
    assert.deepEqual([...providers.keys()].sort(), set.declarationComparison.providerNames[domain]);
    for (const consumer of rows.filter(value => value.domain === domain)) {
      for (const needed of consumer.requirements.dynamic.needed) {
        neededEdges++;
        assert.ok(providers.has(needed), domain + ':' + needed);
      }
      for (const need of consumer.requirements.requirements.versionNeeds) {
        const provider = providers.get(need.file);
        assert.ok(provider, domain + ':' + need.file);
        const definitions = new Map(provider.requirements.versionDefinitions.map(row => [row.names[0], row.hash]));
        for (const auxiliary of need.aux) {
          versionReferences++;
          assert.equal(definitions.get(auxiliary.name), auxiliary.hash, domain + ':' + need.file + ':' + auxiliary.name);
        }
      }
    }
  }
  assert.equal(neededEdges, set.declarationComparison.neededEdges);
  assert.equal(versionReferences, set.declarationComparison.versionReferences);
  for (const key of ['symbolBindingsVerified', 'relocationsVerified', 'loaderClosureVerified',
    'privateAbiCoherenceVerified', 'hostTargetPromotion']) assert.equal(set.declarationComparison[key], false);
  assert.equal(set.declarationComparison.dependencyQualificationStatus, 'UNRESOLVED');
});

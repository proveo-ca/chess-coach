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
    'rust-archive-evidence-operation.test', 'toolchain-member-plan',
    'toolchain-member-plan.test', 'rust-helper-evidence-operation',
    'rust-helper-evidence-operation.test', 'gnu-preparation-evidence-operation',
    'gnu-preparation-evidence-operation.test', 'gnu-preparation-plan',
    'gnu-preparation-plan.test', 'toolchain-provider-plan',
    'toolchain-provider-plan.test', 'bootlin-directory-metadata',
    'bootlin-directory-metadata.test', 'bootlin-directory-metadata-v2',
    'bootlin-directory-metadata-v2.test', 'gcc-context-registration.test', 'bootlin-gcc-notices-source',
    'bootlin-gcc-notices-source.test', 'bootlin-gcc-copying-head',
    'bootlin-gcc-copying-head.test', 'bootlin-gcc-notices-v2',
    'bootlin-gcc-notices-v2.test', 'candidate-image-manifest',
    'candidate-image-manifest.test'].map(name => 'tooling/native-ingress/' + name + '.mjs');
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

test('member dispositions remain pure proposals with explicit licensing and namespace limits', () => {
  for (const phrase of ['pure deterministic evidence-to-report module', 'callerInputsAuthenticated:false',
    'Every one of8675 namespace identities receives exactly one disposition',
    'UNREVIEWED_OMIT_NOT_RUNTIME_PROOF', 'Apply C++/LTO exclusions before generic wrapper-alias matching',
    'join all157 declarations', 'LICENSE_DATA_CANDIDATE', 'GNU C/GCC license/source-context gap',
    'all190 sdk-relocs lines', '152 regular matches/38 absences', 'all1434 regular GNU sysroot headers',
    'requiresApprovedSysrootMapping:true', 'DECLARED_MEMBER_MATCH_NOT_LINKER_PROOF',
    'no global basename search or host discovery']) assert.ok(plan.includes(phrase), phrase);
});

test('parent member-report cleanup distinguishes abort flags, ownership snapshots and reservation close failures', () => {
  const canonical = fs.readFileSync(new URL('../../_spec/_plans/ml-runtime-redesign.md', import.meta.url), 'utf8');
  const match = canonical.match(/function abortPublications\(code, publishers\) \{[\s\S]*?\n\}\n(?=const inputPins = \[)/);
  assert.ok(match);
  const classify = Function(match[0] + '\nreturn abortPublications;')();
  assert.equal(classify('E_PUBLICATION_CLOSE', [null, null]), true);
  assert.equal(classify('E_PUBLICATION_EXISTS', [null, null]), false);
  let aborts = 0, snapshots = 0;
  const clean = { abort() { aborts++; return { counts: {}, closeFailed: false, cleanupUncertain: false }; },
    snapshot() { snapshots++; return { ownedFDCount: 0, closeFailed: false, cleanupUncertain: false }; } };
  assert.equal(classify('E_HASH', [clean, clean]), false);
  assert.equal(aborts, 2); assert.equal(snapshots, 2);
  assert.equal(classify('E_HASH', [{ ...clean, snapshot: () => ({ ownedFDCount: 1, closeFailed: false, cleanupUncertain: false }) }]), true);
  assert.equal(classify('E_HASH', [{ ...clean, abort: () => ({ closeFailed: true, cleanupUncertain: true }) }]), true);
  assert.equal(classify('E_HASH', [{ ...clean, abort() { throw Error('close'); } }, clean]), true);
  assert.equal(aborts, 4);
});

test('published member report and sidecar stay proposed data after terminal acceptance', () => {
  const bytes = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/toolchain-member-plan-v1.result.json', import.meta.url));
  const sidecar = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/toolchain-member-plan-v1.receipt.json', import.meta.url));
  assert.equal(bytes.length, 5679112);
  assert.equal(sha(bytes), '2c4cd5218dce220e55dabe96345b97cc777c2cdc10c6e18b8d53f1357d2a94da');
  assert.equal(sidecar.length, 3573);
  assert.equal(sha(sidecar), '81989c8cf46e321780bfd17df4f4acf599f4b047b96a1aad30415a077b9184bf');
  const report = JSON.parse(bytes), receipt = JSON.parse(sidecar);
  assert.equal(report.members.length, 8675);
  assert.equal(new Set(report.members.map(row => row.artifactRole + ':' + row.index)).size, 8675);
  assert.equal(report.rustDeclarations.length, 157);
  assert.equal(report.linkerInputReferences.length, 8);
  assert.ok(report.linkerInputReferences.every(row => row.status === 'DECLARED_MEMBER_MATCH_NOT_LINKER_PROOF' && row.mappingApproved === false));
  assert.deepEqual(report.proposedDestinationCollisions, []);
  assert.equal(report.headerAliasClosure.regularHeaderCount, 1434);
  assert.equal(report.headerAliasClosure.aliasReferenceCount, 1);
  assert.equal(report.gnuRelocation.unresolvedWholeSdkContext, 38);
  assert.equal(receipt.parentTerminalSuccessRequired, true);
  assert.equal(receipt.status, 'PROPOSED_DATA_WRITTEN_PENDING_TERMINAL_ACCEPTANCE');
  assert.equal(Object.hasOwn(receipt, 'publicationAccepted'), false);
  for (const key of ['copyAuthorized', 'imagePrepared', 'runtimeProvidersQualified', 'pythonFreeSubsetVerified',
    'abiVerified', 'rustReady', 'trainingReady', 'callerInputsAuthenticated']) assert.equal(report[key], false, key);
  const rust = json('rust-archive-rustc-v1.result.json').collection.roles[0];
  const helpers = report.members.filter(row => row.disposition === 'CANDIDATE_NEEDS_QUALIFICATION');
  assert.equal(helpers.length, 6);
  const unobserved = helpers.filter(row => !rust.selected.some(observation => observation.kind === 'ELF_EXEC_DSO'
    && observation.size === row.size && observation.bodySha256 === row.bodySha256
    && observation.metadata.requirements.inputSha256 === row.bodySha256));
  assert.equal(unobserved.length, 3);
  assert.equal(new Set(unobserved.map(row => row.bodySha256)).size, 3);
});

test('supplemental helper scope and private-header gap preserve consumed evidence and runtime boundaries', () => {
  for (const phrase of ['runRegisteredRustHelperEvidenceV1', 'total selected6995632 bytes',
    'each<=8MiB and aggregate<=24MiB', '383472 bytes/383488 requested bytes',
    'SOURCE_RUSTC_TAR binds only this new instance', 'path/kind/index:null',
    'rust-helper-evidence-v1.result.json', '150 regular files/2907751 bytes',
    'include-fixed/ prefix contains only its750-byte README',
    'preserve that report and record the omission gap']) assert.ok(plan.includes(phrase), phrase);
});

test('accepted supplemental helper evidence stays static and preserves exact body and publication accounting', () => {
  const full = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/rust-helper-evidence-v1.result.json', import.meta.url));
  const compact = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/rust-helper-evidence-v1.receipt.json', import.meta.url));
  assert.equal(full.length, 55014); assert.equal(sha(full), '003b26c6cd849670f5ef28f775466f0e1e0e09fa154058c70cf130e9587269d2');
  assert.equal(compact.length, 8366); assert.equal(sha(compact), 'bb2ded89b133162c44104b6650475e60d1d1ada17c58c7bd2d4f14fb14256053');
  const data = JSON.parse(full), accepted = JSON.parse(compact), selected = data.collection.roles[0].selected;
  assert.equal(accepted.publicationAccepted, true); assert.equal(accepted.sha256, sha(full));
  assert.equal(selected.length, 3); assert.deepEqual(selected.map(row => row.index), [28, 63, 70]);
  assert.equal(selected.reduce((n, row) => n + row.size, 0), 6995632);
  assert.equal(data.collection.resourceAccounting.maxAdditionalElfSnapshotBytes, 8388608);
  assert.equal(data.collection.declaredNeededEdges.length, 16);
  assert.ok(data.collection.declaredNeededEdges.every(edge => edge.status === 'UNRESOLVED'));
  assert.equal(accepted.repoCapture.closes, 16); assert.equal(accepted.repoCapture.readBytes, 383472);
  assert.equal(accepted.collectionCounts.archivePasses, 2); assert.equal(accepted.collectionCounts.archiveCloseAttempts, 2);
  assert.equal(accepted.collectionCounts.ownedChildren, 0); assert.equal(accepted.collectionCounts.stageCloses, 10);
  assert.equal(accepted.publicationCounts.closes, 3); assert.equal(accepted.publicationCounts.fsyncs, 4);
  for (const member of selected) {
    assert.equal(member.metadata.requirements.inputSha256, member.bodySha256);
    assert.equal(member.metadata.requirements.byteLength, member.size);
    assert.equal(member.qualified, false); assert.equal(member.roleSatisfied, false);
  }
  for (const key of ['rustReady', 'trainingReady', 'nativeQualified', 'runtimeProvidersQualified',
    'abiVerified', 'pythonFreeSubsetVerified', 'imagePrepared', 'compilerExecuted',
    'memberExecuted', 'jointEvidenceSetComplete']) assert.equal(data[key], false, key);
});

test('GNU preparation-context profile separates raw text from parsing and private headers from use approval', () => {
  for (const phrase of ['runRegisteredGnuPreparationEvidenceV1', 'PREPARATION_TEXT', 'domain:DISTRIBUTION_DATA',
    'new selected total12234 bytes', 'BOM preservation', 'interpreted:false/urlsFollowed:false',
    'exactly three means new selected targets', '15 source captures301950 bytes/301965 requested',
    'accepted-GNU DATA capture2829942 bytes/2829943 requested', 'C_HEADER_CANDIDATE data',
    'gnu-preparation-evidence-v1.result.json', 'sourceContext remains UNQUALIFIED']) assert.ok(plan.includes(phrase), phrase);
});

test('accepted GNU preparation evidence binds raw text and every private-header candidate without use authority', () => {
  const full = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/gnu-preparation-evidence-v1.result.json', import.meta.url));
  const compact = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/gnu-preparation-evidence-v1.receipt.json', import.meta.url));
  assert.equal(full.length, 2724242); assert.equal(sha(full), '3ae1a4949a913b972695a32dfab2076354e49a70a960021a34050c63a9bb281b');
  assert.equal(compact.length, 8583); assert.equal(sha(compact), 'dc06975401c17e41b24e75beb37eb8de2bcf3c30066773aaf53defdcf6dd30b6');
  const data = JSON.parse(full), receipt = JSON.parse(compact);
  const old = json('gnu-evidence-collection-v1.result.json').collection.roles[0];
  const role = data.collection.roles[0], prefix = role.expectedRoot + '/lib/gcc/x86_64-buildroot-linux-gnu/15.3.0/include/';
  assert.equal(receipt.publicationAccepted, true); assert.equal(receipt.sha256, sha(full));
  assert.equal(receipt.byteLength, full.length); assert.equal(receipt.mockOnly, false);
  assert.deepEqual(role.members, old.members);
  const headers = old.members.filter(row => row.type === 'file' && row.path.startsWith(prefix));
  assert.equal(headers.length, 150); assert.equal(headers.reduce((n, row) => n + row.size, 0), 2907751);
  assert.deepEqual(data.headerLedger, headers.map(row => ({ artifactRole: 'gnu-sdk', index: row.index,
    path: row.path, bodyOffset: row.bodyOffset, size: row.size, bodySha256: row.bodySha256,
    domain: 'TARGET', disposition: 'C_HEADER_CANDIDATE',
    proposedRelativeDestination: 'gnu/' + row.path.slice(role.expectedRoot.length + 1),
    copyAuthorized: false, includeClosureVerified: false })));
  assert.deepEqual(role.selected.map(row => row.index), [8379, 8391, 8412]);
  assert.deepEqual(role.selected.map(row => row.size), [750, 10391, 1093]);
  for (const row of role.selected) {
    assert.equal(row.kind, 'PREPARATION_TEXT'); assert.equal(row.domain, 'DISTRIBUTION_DATA');
    const text = row.metadata.observation;
    assert.equal(text.state, 'GNU_PREPARATION_RAW_TEXT_DATA');
    assert.equal(text.interpreted, false); assert.equal(text.urlsFollowed, false);
    assert.equal(Buffer.byteLength(text.text), row.size); assert.equal(sha(Buffer.from(text.text)), row.bodySha256);
    assert.equal(row.bodySha256, old.members[row.index - 1].bodySha256);
  }
  assert.equal(data.totalTextCaptures, 5); assert.equal(data.totalCapturedTextBytes, 21680);
  assert.equal(data.collection.resourceAccounting.buffersAllocated, 5);
  assert.equal(data.collection.resourceAccounting.buffersErased, 5);
  assert.equal(data.actualElfInspections, 0); assert.equal(data.pluginSummary.regularFiles, 560);
  assert.equal(data.pluginSummary.bytes, 9731900); assert.equal(data.pluginSummary.admitted, false);
  assert.equal(data.includeFixedContext.headersInferred, false);
  assert.equal(receipt.repoCapture.readBytes, 301950); assert.equal(receipt.repoCapture.requestedBytes, 301965);
  assert.equal(receipt.repoCapture.closes, 15); assert.equal(receipt.repoCapture.ownedFds, 0);
  assert.equal(receipt.acceptedDataCapture.readBytes, 2829942); assert.equal(receipt.acceptedDataCapture.closes, 1);
  assert.equal(receipt.collectionCounts.archivePasses, 2); assert.equal(receipt.collectionCounts.archiveCloseAttempts, 2);
  assert.equal(receipt.collectionCounts.ownedChildren, 0); assert.equal(receipt.collectionCounts.stageCloses, 10);
  assert.equal(receipt.publicationCounts.closes, 3); assert.equal(receipt.publicationCounts.fsyncs, 4);
  for (const key of ['copyAuthorized', 'sourceAuthenticated', 'licenseComplianceVerified', 'licensePermissionClassified',
    'includeClosureVerified', 'sysrootClosureVerified', 'relocationReady', 'pythonFreeSubsetVerified', 'abiVerified',
    'runtimeProvidersQualified', 'imagePrepared', 'nativeQualified', 'rustReady', 'trainingReady', 'csvParsed',
    'shellEvaluated', 'urlsFollowed', 'compilerExecuted', 'memberExecuted']) assert.equal(data[key], false, key);
});

test('GNU preparation proposal launcher preserves checked cleanup and fixed retained-data publication scope', () => {
  const canonical = fs.readFileSync(new URL('../../_spec/_plans/ml-runtime-redesign.md', import.meta.url), 'utf8');
  const block = canonical.match(/<!-- BEGIN STEP2 GNU PREPARATION PLAN PUBLICATION V1 -->\n```sh\n([\s\S]*?)```\n<!-- END STEP2 GNU PREPARATION PLAN PUBLICATION V1 -->/);
  assert.ok(block);
  const cleanup = /function abortPublications\(code, publishers\) \{[\s\S]*?\n\}/;
  assert.equal(block[1].match(cleanup)[0], canonical.match(cleanup)[0]);
  for (const phrase of ['captures !== 6', 'captureCloses !== 6', 'returned !== 5607927',
    'requested !== 5607933', 'allocated !== 5607933', 'allocated + length + 1 > 8388608',
    'bytes.length !== 136598', '7d34c5e0308dc8397a221618dbd6e85f7c253b0ccfa8d806cb458a6b5e544f6e',
    'result.counts.closes !== 3', 'result.counts.fsyncs !== 4', 'gnu-preparation-plan-v1.result.json']) {
    assert.ok(block[1].includes(phrase), phrase);
  }
  assert.equal(/\b(?:spawn|execFile|unlinkSync|rmSync|fetch)\s*\(/u.test(block[1]), false);
  assert.ok(plan.includes('APPEND_ONLY_REFERENCE_NOT_READ_OR_REVERIFIED'));
  assert.ok(plan.includes('domain:UNRESOLVED'));
});

test('published GNU preparation proposal preserves literal declaration and candidate-only semantics', () => {
  const full = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/gnu-preparation-plan-v1.result.json', import.meta.url));
  const compact = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/gnu-preparation-plan-v1.receipt.json', import.meta.url));
  assert.equal(full.length, 136598); assert.equal(sha(full), '7d34c5e0308dc8397a221618dbd6e85f7c253b0ccfa8d806cb458a6b5e544f6e');
  assert.equal(compact.length, 2450); assert.equal(sha(compact), '11a3ce916d224de9d66772628b6ef774a56f61a416335fdf5e76e49fcebbb881');
  const report = JSON.parse(full), receipt = JSON.parse(compact);
  assert.equal(receipt.publicationAccepted, true); assert.equal(receipt.result.sha256, sha(full));
  assert.equal(receipt.captureCounts.captures, 6); assert.equal(receipt.captureCounts.captureCloses, 6);
  assert.equal(receipt.publicationCounts.closes, 3); assert.equal(receipt.publicationCounts.fsyncs, 4);
  assert.equal(report.headerSelectionSupplement.count, 150); assert.equal(report.distributionDeclarations.rowCount, 30);
  const rows = report.distributionDeclarations.rows;
  assert.equal(rows.filter(row => row.packageLabel === 'gcc-final').length, 2);
  assert.ok(rows.every(row => row.domain === 'UNRESOLVED' && row.sourceKind === 'DISTRIBUTION_DECLARATION'));
  assert.ok(report.headerSelectionSupplement.records.every(row => row.copyAuthorized === false && row.includeClosureVerified === false));
  for (const row of rows) assert.equal(sha(Buffer.from(row.rawRecord)), row.rawRecordSha256);
  for (const key of ['copyAuthorized', 'sourceAuthenticated', 'publisherAuthenticated', 'licenseComplianceVerified',
    'includeClosureVerified', 'abiVerified', 'imagePrepared', 'nativeQualified', 'rustReady', 'trainingReady']) assert.equal(report[key], false, key);
});

test('directory discovery launcher pins preparation context before the closed metadata-only collector', () => {
  const canonical = fs.readFileSync(new URL('../../_spec/_plans/ml-runtime-redesign.md', import.meta.url), 'utf8');
  const block = canonical.match(/<!-- BEGIN STEP2 BOOTLIN DIRECTORIES V1 -->\n```sh\n([\s\S]*?)```\n<!-- END STEP2 BOOTLIN DIRECTORIES V1 -->/);
  assert.ok(block);
  const cleanup = /function abortPublications\(code, publishers\) \{[\s\S]*?\n\}/;
  assert.equal(block[1].match(cleanup)[0], canonical.match(cleanup)[0]);
  for (const phrase of ['E_POLICY_PIN', 'E_README_PIN', 'captures !== 3', 'captureCloses !== 3',
    'returned !== 2761894', 'requested !== 2761897', 'allocated !== 2761897',
    'c.fetchCalls !== 2', 'c.retainedBytes > 131072', 'c.releases !== 2', 'c.clearedTimers !== 3',
    'bytes.length > 1048576', 'published.counts.closes !== 3', 'published.counts.fsyncs !== 4']) {
    assert.ok(block[1].includes(phrase), phrase);
  }
  assert.ok(block[1].indexOf("fail('E_README_PIN')") < block[1].indexOf('await module.collectRegisteredBootlinDirectoriesV1()'));
  assert.ok(block[1].includes('module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(started)'));
  assert.equal(/\b(?:spawn|execFile|unlinkSync|rmSync|fetch)\s*\(/u.test(block[1]), false);
  assert.ok(plan.includes('this profile claims neither cap+1 transport reads nor wire/hard-RSS bounds'));
  assert.ok(plan.includes('No directory entry authorizes a bundle download'));
});

test('directory private clock bridge admits one parent origin and reads actual time after initialization', () => {
  const canonical = fs.readFileSync(new URL('../../_spec/_plans/ml-runtime-redesign.md', import.meta.url), 'utf8');
  const bridge = canonical.match(/const clockBridge = `([\s\S]*?)`;/)[1];
  assert.equal(Buffer.byteLength(bridge), 794);
  assert.equal(sha(bridge), '28bbe878605dc95eaa7d15d27e1ae9d162c86a755e7d76f8f8e69a97291cf334');
  const make = (now) => Function('NOW', 'CLOCK', 'fail', bridge.replace('export function ', 'function ')
    + '\nreturn {bind:SOURCE_BIND_PARENT_CLOCK_ORIGIN,read:SOURCE_CAPTURE_NOW};')(now, null, code => { throw new Error(code); });
  let time = 9000;
  const clock = make(() => time);
  assert.throws(() => clock.read(), /E_CLOCK/);
  clock.bind(0);
  assert.throws(() => clock.bind(1), /E_CLOCK/);
  assert.equal(clock.read(), 0); assert.equal(clock.read(), 9000);
  time = 27000; assert.equal(clock.read(), 27000);
  time = -1; assert.throws(() => clock.read(), /E_CLOCK/);
  assert.throws(() => make(() => 10000).bind(0), /E_CLOCK/);
});

test('transformed directory collector clips timers to the original parent and refuses late Fetch admission', async () => {
  const canonical = fs.readFileSync(new URL('../../_spec/_plans/ml-runtime-redesign.md', import.meta.url), 'utf8');
  const bridge = canonical.match(/const clockBridge = `([\s\S]*?)`;/)[1];
  const raw = fs.readFileSync(new URL('./bootlin-directory-metadata.mjs', import.meta.url), 'utf8');
  assert.equal(sha(raw), '1a625ec28479ac28efeaa19a51095924f7db5c48524a1cd74570e0c4b7f3890f');
  const originalNow = 'now: () => Reflect.apply(NOW, CLOCK, []),';
  assert.equal(raw.split(originalNow).length, 2);
  const routed = raw.replace(originalNow, 'now: () => SOURCE_CAPTURE_NOW(),');
  assert.equal(sha(routed), 'cd06ea9e8e07d5a4514131dbc0240e3af4d96691a586592df151199c6e747ec6');
  const transformed = routed + bridge;
  assert.equal(Buffer.byteLength(transformed), 20434);
  assert.equal(sha(transformed), '4962a642a0933ec0149a521a548cccd526715ccf624762e5f678b1c3efc79738');
  const uri = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
  for (const scenario of ['clipped', 'expired']) {
    const fixtureText = `
export const caps = {time:9000,armed:[],timers:new Map(),calls:[],next:0,jump:false,skip:0};
caps.now = () => {
  if (caps.jump) { if (caps.skip) caps.skip--; else { caps.time=26999;caps.jump=false; } }
  return caps.time;
};
caps.setTimeout = (callback,delay) => {
  const id=++caps.next;caps.armed.push({id,delay,due:caps.time+delay});caps.timers.set(id,callback);return id;
};
caps.clearTimeout = id => {
  caps.timers.delete(id);
  if (id===2 && ${JSON.stringify(scenario)}==='clipped') { caps.jump=true;caps.skip=1; }
};
caps.fetch = (url,options) => {
  caps.calls.push({url,options});let reads=0;
  const reader={read() {
    if (reads++===0) return Promise.resolve({done:false,value:new Uint8Array([60,112,47,62])});
    if (caps.calls.length===1) caps.time=18999;
    return Promise.resolve({done:true,value:undefined});
  },cancel(){return Promise.resolve();},releaseLock(){}};
  return Promise.resolve({status:200,url,redirected:false,type:'basic',
    headers:[['content-type','text/html']],body:{getReader:()=>reader,cancel:()=>Promise.resolve()}});
};
`;
    const fixtureUri = uri(fixtureText), { caps } = await import(fixtureUri);
    let testSource = transformed;
    for (const [before, after] of [
      ['const FETCH = globalThis.fetch;', 'const FETCH = TEST_CAPS.fetch;'],
      ['const NOW = performance.now;', 'const NOW = TEST_CAPS.now;'],
      ['const CLOCK = performance;', 'const CLOCK = TEST_CAPS;'],
      ['const SET_TIMEOUT = globalThis.setTimeout;', 'const SET_TIMEOUT = TEST_CAPS.setTimeout;'],
      ['const CLEAR_TIMEOUT = globalThis.clearTimeout;', 'const CLEAR_TIMEOUT = TEST_CAPS.clearTimeout;'],
    ]) {
      assert.equal(testSource.split(before).length, 2);
      testSource = testSource.replace(before, after);
    }
    const module = await import(uri('import {caps as TEST_CAPS} from ' + JSON.stringify(fixtureUri) + ';\n' + testSource));
    module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(0);
    if (scenario === 'expired') caps.time = 27000;
    const result = await module.collectRegisteredBootlinDirectoriesV1();
    assert.equal(caps.timers.size, 0);
    if (scenario === 'clipped') {
      assert.equal(result.exitCode, 0); assert.equal(caps.calls.length, 2);
      assert.deepEqual(caps.armed.map(timer => timer.delay), [21000, 10000, 1]);
      assert.deepEqual(caps.armed.map(timer => timer.due), [30000, 19000, 27000]);
    } else {
      assert.equal(result.exitCode, 1); assert.equal(result.data.error, 'E_DEADLINE');
      assert.equal(caps.calls.length, 0); assert.deepEqual(caps.armed.map(timer => timer.delay), [3000]);
    }
  }
});

test('consumed directory discovery STOP preserves the exact limit refusal without partial metadata acceptance', () => {
  const bytes = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/bootlin-source-license-directories-v1.stop.json', import.meta.url));
  assert.equal(bytes.length, 711); assert.equal(sha(bytes), '7d618e43bf118fb794f515fd06ade2051fb3bbc79827cb6998feba3a79392e6f');
  const stop = JSON.parse(bytes), collection = stop.collectionStop, counts = collection.counts;
  assert.equal(stop.status, 'STOP'); assert.equal(stop.publicationAccepted, false);
  assert.equal(stop.error, 'E_DIRECTORY_COLLECTION'); assert.equal(collection.error, 'E_LIMIT');
  assert.equal(stop.cleanupUncertain, true); assert.equal(collection.cleanupUncertain, true);
  assert.equal(stop.captures, 3); assert.equal(stop.captureCloses, 3);
  assert.equal(counts.fetchCalls, 1); assert.equal(counts.requestsAttempted, 1);
  assert.equal(counts.deliveredBytes, 71655); assert.equal(counts.retainedBytes, 64261);
  assert.equal(counts.rejectedChunks, 1); assert.equal(counts.eofObservations, 0);
  assert.equal(counts.completedObservations, 0); assert.equal(counts.activeTimers, 0);
  assert.equal(counts.cancellations, 1); assert.equal(counts.releases, 1);
  assert.equal(counts.transportClosedVerified, false);
  for (const key of ['observations', 'bodyUtf8', 'exposedHeaders']) assert.equal(Object.hasOwn(collection, key), false);
  const canonical = fs.readFileSync(new URL('../../_spec/_plans/ml-runtime-redesign.md', import.meta.url), 'utf8');
  const command = canonical.match(/<!-- BEGIN STEP2 BOOTLIN DIRECTORIES V1 -->\n```sh\n([\s\S]*?)```\n<!-- END STEP2 BOOTLIN DIRECTORIES V1 -->/)[1];
  assert.equal(Buffer.byteLength(command), 13034);
  assert.equal(sha(command), 'dc847bd7d54e1b171588ad15e75f7ae0984ef9ecc59be012014625cf470db043');
});

test('selected fresh directory V2 raises only approved retention bounds without renewing V1 or clocks', () => {
  for (const phrase of ['New bounded profile:1MiB per directory/2MiB aggregate/16MiB full result',
    'unchanged10s request/27s work/30s outer/3s cleanup',
    'V2 success cannot resolve or supersede V1', 'never imports or invokes that consumed module/entry',
    'collectRegisteredBootlinDirectoriesV2', 'no callable V1 entry',
    'bootlin-source-license-directories-v2.{result,receipt,stop}.json']) assert.ok(plan.includes(phrase), phrase);
  const raw = fs.readFileSync(new URL('./bootlin-directory-metadata.mjs', import.meta.url));
  assert.equal(raw.length, 19649);
  assert.equal(sha(raw), '1a625ec28479ac28efeaa19a51095924f7db5c48524a1cd74570e0c4b7f3890f');
});

test('fresh directory V2 launcher imports only the new pinned graph and reserves independent paths', () => {
  const canonical = fs.readFileSync(new URL('../../_spec/_plans/ml-runtime-redesign.md', import.meta.url), 'utf8');
  const block = canonical.match(/<!-- BEGIN STEP2 BOOTLIN DIRECTORIES V2 -->\n```sh\n([\s\S]*?)```\n<!-- END STEP2 BOOTLIN DIRECTORIES V2 -->/)[1];
  const cleanup = /function abortPublications\(code, publishers\) \{[\s\S]*?\n\}/;
  assert.equal(block.match(cleanup)[0], canonical.match(cleanup)[0]);
  for (const phrase of ['adapter.buildBootlinDirectoryMetadataV2Source(rawV1)',
    "Buffer.from(graph.sourceText).toString('base64')", 'module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(started)',
    'await module.collectRegisteredBootlinDirectoriesV2()', 'captures !== 4', 'captureCloses !== 4',
    'returned !== 2767654', 'requested !== 2767658', 'allocated !== 2767658',
    'c.retainedBytes > 2097152', 'body.length > 1048576', 'bytes.length > 16777216',
    'published.counts.closes !== 3', 'published.counts.fsyncs !== 4']) assert.ok(block.includes(phrase), phrase);
  assert.ok(block.indexOf("fail('E_README_PIN')") < block.indexOf('module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(started)'));
  assert.ok(block.indexOf('module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(started)') < block.indexOf('await module.collectRegisteredBootlinDirectoriesV2()'));
  assert.equal(block.includes("rawV1.toString('base64')"), false);
  assert.equal(block.includes('bootlin-source-license-directories-v1.result.json'), false);
  assert.equal(/\b(?:spawn|execFile|unlinkSync|rmSync|fetch)\s*\(/u.test(block), false);
});

test('accepted directory V2 preserves both exact bodies without qualifying source or resolving V1 uncertainty', () => {
  const full = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/bootlin-source-license-directories-v2.result.json', import.meta.url));
  const compact = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/bootlin-source-license-directories-v2.receipt.json', import.meta.url));
  assert.equal(full.length, 138884); assert.equal(sha(full), 'c5cdf65b6ad92de0eeb379017bff4464bed8136340394b1dc8f3b36c67699f61');
  assert.equal(compact.length, 3905); assert.equal(sha(compact), 'e01edd22690836b1274646e62086dd27593c20965ca3c395202f1e3924251979');
  const report = JSON.parse(full), receipt = JSON.parse(compact), data = report.collection;
  assert.equal(receipt.publicationAccepted, true); assert.equal(receipt.result.sha256, sha(full));
  assert.equal(data.profile, 'registered-bootlin-directories-v2'); assert.equal(data.mockOnly, false);
  assert.equal(data.cleanupUncertain, false);
  assert.deepEqual(data.observations.map(row => row.observedBodyBytes), [71655, 54483]);
  assert.deepEqual(data.observations.map(row => row.bodySha256), [
    '3ec2ebb752d98768658645ad0beeb02d6c3152c5c0e7fb73d1e567f1c3a5f177',
    'beb1ac11371a08f2ad5f85b9a25d8c1a38624acfe9b69c85c56e6f6afdafb738',
  ]);
  for (const row of data.observations) {
    assert.equal(row.eof, true); assert.equal(row.interpreted, false); assert.equal(row.urlsFollowed, false);
    assert.equal(sha(Buffer.from(row.bodyUtf8)), row.bodySha256);
    assert.equal(row.bodyUtf8.split('href="gcc-final-15.3.0/"').length, 2);
  }
  assert.equal(receipt.captureCounts.captures, 4); assert.equal(receipt.captureCounts.captureCloses, 4);
  assert.equal(receipt.publicationCounts.closes, 3); assert.equal(receipt.publicationCounts.fsyncs, 4);
  assert.equal(data.counts.fetchCalls, 2); assert.equal(data.counts.eofObservations, 2);
  assert.equal(data.counts.retainedBytes, 126138); assert.equal(data.counts.cancellations, 0);
  assert.equal(data.counts.releases, 2); assert.equal(data.counts.activeTimers, 0);
  for (const key of ['sourceAuthenticated', 'publisherAuthenticated', 'licenseComplianceVerified',
    'runtimeProvidersQualified', 'pythonFreeSubsetVerified', 'abiVerified', 'imagePrepared', 'nativeQualified',
    'rustReady', 'trainingReady']) assert.equal(report[key], false, key);
  assert.equal(json('bootlin-source-license-directories-v1.stop.json').cleanupUncertain, true);
});

test('accepted GCC context preserves directory evidence and both declarations without fetching notice files', () => {
  const full = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/bootlin-gcc-final-context-v1.result.json', import.meta.url));
  const compact = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/bootlin-gcc-final-context-v1.receipt.json', import.meta.url));
  assert.equal(full.length, 14690); assert.equal(sha(full), 'b020748b1a6cae8254e82486821682d79e747918a8a0128a897fa33c94806c7b');
  assert.equal(compact.length, 4474); assert.equal(sha(compact), '166c641800914834ce3d39df367021ac8a8e67d38b4c43a055c78322bd0c3519');
  const report = JSON.parse(full), receipt = JSON.parse(compact), observations = report.collection.observations;
  assert.equal(receipt.publicationAccepted, true); assert.equal(receipt.result.sha256, sha(full));
  assert.deepEqual(observations.map(row => row.observedBodyBytes), [2349, 1867]);
  assert.deepEqual(observations.map(row => row.bodySha256), [
    'c14dd86c50fbc18db9fc3ed0bd06d90f1af66d45564c7ff80b63e94bfd8fb76c',
    'bc44d5fff09beba4b68c3ad6ac6ae914e26f8174f32c85322c721f0f355f8f1c',
  ]);
  for (const row of observations) { assert.equal(row.eof, true); assert.equal(sha(Buffer.from(row.bodyUtf8)), row.bodySha256); }
  for (const name of ['COPYING', 'COPYING.LIB', 'COPYING.RUNTIME', 'COPYING3', 'COPYING3.LIB']) {
    assert.equal(observations[1].bodyUtf8.split('href="' + name + '"').length, 2);
  }
  assert.deepEqual(report.packageContext.declarationRows.map(row => row.ordinal), [1, 8]);
  assert.equal(report.packageContext.domain, 'UNRESOLVED');
  assert.equal(receipt.captureCounts.captures, 6); assert.equal(receipt.captureCounts.captureCloses, 6);
  assert.equal(receipt.publicationCounts.closes, 3); assert.equal(receipt.publicationCounts.fsyncs, 4);
  assert.equal(report.collection.counts.fetchCalls, 2); assert.equal(report.collection.counts.retainedBytes, 4216);
  assert.equal(report.collection.cleanupUncertain, false);
  for (const key of ['sourceAuthenticated', 'publisherAuthenticated', 'licenseComplianceVerified', 'runtimeProvidersQualified',
    'pythonFreeSubsetVerified', 'abiVerified', 'imagePrepared', 'nativeQualified', 'rustReady', 'trainingReady']) assert.equal(report[key], false, key);
});

test('selected five-notice scope preserves passive-text controls, original clocks and retained reservations', () => {
  for (const phrase of ['five fixed GETs', 'permits FF page separators as passive text',
    'Keep1MiB/file,2MiB aggregate,16MiB full result,10s/request,27s original work and30s outer including3s cleanup',
    'enforce declared US-ASCII against actual bytes including BOM bytes',
    'Never precreate both terminal files or roll back/delete any reservation',
    'bootlin-gcc-notices-v1.result.json', 'LICENSE_NOTICE_TEXT/PUBLIC_LICENSE_NOTICE_TEXT']) assert.ok(plan.includes(phrase), phrase);
  assert.equal(sha(fs.readFileSync(new URL('./bootlin-directory-metadata.mjs', import.meta.url))),
    '1a625ec28479ac28efeaa19a51095924f7db5c48524a1cd74570e0c4b7f3890f');
});

test('notice parent packet binds historical context before five fixed passive acquisitions', () => {
  const canonical = fs.readFileSync(new URL('../../_spec/_plans/ml-runtime-redesign.md', import.meta.url), 'utf8');
  const block = canonical.match(/<!-- BEGIN STEP2 GCC NOTICES V1 -->\n```sh\n([\s\S]*?)```\n<!-- END STEP2 GCC NOTICES V1 -->/)[1];
  const cleanup = /function abortPublications\(code, publishers\) \{[\s\S]*?\n\}/;
  assert.equal(block.match(cleanup)[0], canonical.match(cleanup)[0]);
  for (const phrase of ['noticeAdapter.buildBootlinGccNoticesSource(base.sourceText)',
    'HISTORICAL_PINNED_CONTEXT_NOT_CURRENT_FILESYSTEM_PROOF', 'captures !== 5', 'captureCloses !== 5',
    'returned !== 64809', 'requested !== 64814', 'allocated !== 64814', 'c.fetchCalls !== 5',
    'c.eofObservations !== 5', 'c.releases !== 5', 'c.clearedTimers !== 6',
    'c.retainedBytes > 2097152', 'body.length < 1', 'body.length > 1048576',
    'bytes.length > 16777216', 'published.counts.closes !== 3', 'published.counts.fsyncs !== 4']) assert.ok(block.includes(phrase), phrase);
  assert.ok(block.indexOf("catalog.bodyUtf8.split('href=") < block.indexOf('module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(started)'));
  assert.ok(block.indexOf('module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(started)') < block.indexOf('await module.collectRegisteredBootlinGccNoticesV1()'));
  assert.equal(block.includes('bootlin-source-license-directories-v1.result.json'), false);
  assert.equal(/\b(?:spawn|execFile|unlinkSync|rmSync|fetch)\s*\(/u.test(block), false);
});

test('consumed notice STOP withholds all headers and bodies without diagnosing an unobserved media cause', () => {
  const bytes = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/bootlin-gcc-notices-v1.stop.json', import.meta.url));
  assert.equal(bytes.length, 691); assert.equal(sha(bytes), 'bd09f82704201cb7cc47687787c734b54c4efcc67158df3dee527a05751d2542');
  const stop = JSON.parse(bytes), data = stop.collectionStop, counts = data.counts;
  assert.equal(stop.status, 'STOP'); assert.equal(stop.publicationAccepted, false);
  assert.equal(stop.error, 'E_NOTICE_COLLECTION'); assert.equal(data.error, 'E_HEADERS');
  assert.equal(stop.cleanupUncertain, true); assert.equal(data.cleanupUncertain, true);
  assert.equal(stop.captures, 5); assert.equal(stop.captureCloses, 5);
  assert.equal(counts.fetchCalls, 1); assert.equal(counts.readAttempts, 0);
  assert.equal(counts.deliveredBytes, 0); assert.equal(counts.retainedBytes, 0);
  assert.equal(counts.eofObservations, 0); assert.equal(counts.completedObservations, 0);
  assert.equal(counts.cancellations, 1); assert.equal(counts.releases, 0);
  assert.equal(counts.activeTimers, 0); assert.equal(counts.transportClosedVerified, false);
  for (const key of ['observations', 'bodyUtf8', 'exposedHeaders', 'statusCode']) assert.equal(Object.hasOwn(data, key), false);
  const canonical = fs.readFileSync(new URL('../../_spec/_plans/ml-runtime-redesign.md', import.meta.url), 'utf8');
  const command = canonical.match(/<!-- BEGIN STEP2 GCC NOTICES V1 -->\n```sh\n([\s\S]*?)```\n<!-- END STEP2 GCC NOTICES V1 -->/)[1];
  assert.equal(Buffer.byteLength(command), 14403);
  assert.equal(sha(command), '1eed27daa40fa8fe9c6d25d584f3e0bfba1a319a90f05b4c013bfbb506fa53e9');
});

test('separate COPYING HEAD plan observes metadata without notice-body admission or runtime route selection', () => {
  for (const phrase of ['one separately registered HEAD', 'zero authored body-reader calls',
    'regardless of MIME/charset or HTTP status100..599', 'not a GET retry or new notice acceptance profile',
    'No route, materialization, host mount, Docker import/job, compiler probe or verification-harness change is selected']) {
    assert.ok(plan.includes(phrase), phrase);
  }
});

test('COPYING HEAD parent packet binds the original clock and body-free metadata custody', () => {
  const canonical = fs.readFileSync(new URL('../../_spec/_plans/ml-runtime-redesign.md', import.meta.url), 'utf8');
  const block = canonical.match(/<!-- BEGIN STEP2 COPYING HEAD V1 -->\n```sh\n([\s\S]*?)```\n<!-- END STEP2 COPYING HEAD V1 -->/)[1];
  const cleanup = /function abortPublications\(code, publishers\) \{[\s\S]*?\n\}/;
  assert.equal(block.match(cleanup)[0], canonical.match(cleanup)[0]);
  for (const phrase of ['captures !== 3', 'captureCloses !== 3', 'returned !== 49881',
    'requested !== 49884', 'allocated !== 49884', 'data.mockOnly !== false',
    "data.method !== 'HEAD'", 'data.responseBodyNullObserved !== true', 'c.authoredBodyReads !== 0',
    'c.fetchCalls !== 1', 'c.cancelCalls !== 0', 'c.releaseCalls !== 0', 'c.timersCleared !== 2',
    'data.exposedHeaderCount > 64', 'data.headerBytes > 16384', 'bytes.length > 65536',
    'published.counts.closes !== 3', 'published.counts.fsyncs !== 4']) assert.ok(block.includes(phrase), phrase);
  assert.ok(block.indexOf("catalog.bodyUtf8.split('href=\"COPYING\"')") < block.indexOf('module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(started)'));
  assert.ok(block.indexOf('module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(started)') < block.indexOf('await module.collectRegisteredBootlinGccCopyingHeadV1()'));
  assert.equal(/\.(?:getReader|read|text|json|arrayBuffer)\s*\(/u.test(block), false);
  assert.equal(/\b(?:spawn|execFile|unlinkSync|rmSync|fetch)\s*\(/u.test(block), false);
});

test('COPYING HEAD terminal encoding preserves untrusted Unicode headers as escaped ASCII', () => {
  const canonical = fs.readFileSync(new URL('../../_spec/_plans/ml-runtime-redesign.md', import.meta.url), 'utf8');
  const block = canonical.match(/<!-- BEGIN STEP2 COPYING HEAD V1 -->\n```sh\n([\s\S]*?)```\n<!-- END STEP2 COPYING HEAD V1 -->/)[1];
  const terminal = block.slice(block.indexOf('const terminal = JSON.stringify('));
  const suffix = terminal.match(/\}\)(\.replace\([^\n]*\) \+ '\\n')/)[1];
  assert.equal(suffix, ".replace(/[^\\x00-\\x7f]/g,c => '\\\\u' + c.charCodeAt(0).toString(16).padStart(4,'0')) + '\\n'");
  const encode = Function('value', 'return JSON.stringify(value)' + suffix + ';');
  const input = { selectedHeaders: [['content-type', 'text/plain; x=é\ufeff']], controls: '\u0001\r\n' };
  const text = encode(input);
  assert.equal(/[^\x00-\x7f]/u.test(text), false);
  assert.equal(Buffer.byteLength(text, 'utf8'), text.length);
  assert.equal(text.endsWith('\n'), true);
  assert.deepEqual(JSON.parse(text), input);
});

test('accepted COPYING HEAD records unexposed media without accepting notice content or diagnosing GET', () => {
  const full = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/bootlin-gcc-copying-head-v1.result.json', import.meta.url));
  const compact = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/bootlin-gcc-copying-head-v1.receipt.json', import.meta.url));
  assert.equal(full.length, 3193); assert.equal(sha(full), '02937e1d5b1e1804476db7b8eea6b14707bb96e8e6556e151d2aea4fc288c339');
  assert.equal(compact.length, 2447); assert.equal(sha(compact), '4d4c25252596f28a4d091016594b29a30c2591348049abe85f59ade7cd1d9f34');
  const report = JSON.parse(full), receipt = JSON.parse(compact), data = report.collection;
  assert.equal(receipt.publicationAccepted, true); assert.equal(receipt.result.sha256, sha(full));
  assert.equal(data.mockOnly, false); assert.equal(data.method, 'HEAD'); assert.equal(data.statusCode, 200);
  assert.equal(data.responseBodyNullObserved, true); assert.equal(data.exposedHeaderCount, 7); assert.equal(data.headerBytes, 179);
  assert.equal(data.exposedHeaders.some(([name]) => name.toLowerCase() === 'content-type'), false);
  assert.equal(data.exposedHeaders.find(([name]) => name.toLowerCase() === 'content-length')[1], '18002');
  assert.equal(data.counts.fetchCalls, 1); assert.equal(data.counts.authoredBodyReads, 0);
  assert.equal(data.counts.cancelCalls, 0); assert.equal(data.counts.releaseCalls, 0);
  assert.equal(data.counts.timersCleared, 2); assert.equal(data.counts.activeTimers, 0); assert.equal(data.cleanupUncertain, false);
  assert.equal(receipt.captureCounts.captures, 3); assert.equal(receipt.captureCounts.captureCloses, 3);
  assert.equal(receipt.publicationCounts.closes, 3); assert.equal(receipt.publicationCounts.fsyncs, 4);
  for (const key of ['noticeQualified', 'noBodyWireProved', 'rawWireHeadersObserved', 'transportClosureVerified', 'sourceAuthenticated',
    'publisherAuthenticated', 'licenseComplianceVerified', 'nativeQualified', 'rustReady', 'trainingReady']) assert.equal(data[key], false, key);
  assert.equal(json('bootlin-gcc-notices-v1.stop.json').collectionStop.error, 'E_HEADERS');
});

test('fresh absent-media notice decision preserves strict present-header and body rules', () => {
  const canonical = fs.readFileSync(new URL('../../_spec/_plans/ml-runtime-redesign.md', import.meta.url), 'utf8');
  for (const phrase of ['genuinely unexposed Content-Type', 'exposed empty/whitespace/unsupported media still fail',
    'record contentTypeExposed plus nullable declaredContentType', 'No present media rule, byte decoder, FF/body/header/read/output/node cap']) {
    assert.ok(canonical.includes(phrase), phrase);
  }
});

test('unified runtime proposal binds eight TARGET bodies without applying HOST promotion or filesystem aliases', () => {
  const layout = fs.readFileSync(new URL('../../_spec/_plans/native-ingress-runtime-layout.md', import.meta.url), 'utf8');
  const role = json('gnu-evidence-collection-v1.result.json').collection.roles[0];
  const candidates = role.selected.filter(row => row.kind === 'ELF_EXEC_DSO' && row.domain === 'TARGET');
  assert.equal(candidates.length, 8); assert.equal(candidates.reduce((n, row) => n + row.size, 0), 6183544);
  const prefix = role.expectedRoot + '/x86_64-buildroot-linux-gnu/sysroot/';
  for (const row of candidates) {
    assert.ok(layout.includes('| ' + row.index + ' | ' + row.path.slice(prefix.length) + ' | ' + row.bodyOffset
      + ' | ' + row.size + ' | `' + row.bodySha256 + '` |'));
  }
  for (const index of [516, 4121]) {
    const alias = role.members[index - 1];
    assert.equal(alias.type, 'symlink'); assert.equal(alias.linkpath, 'lib'); assert.equal(alias.linkFollowed, false);
    assert.ok(layout.includes('index' + index));
  }
  for (const phrase of ['Planning only', 'qualificationStatus:UNRESOLVED', 'allowedForExecution:false',
    'hostTargetPromotion:false', 'not a host-path mount']) assert.ok(layout.includes(phrase), phrase);
});

test('notice V2 parent imports only fresh graph and records missing media without empty-value fallback', () => {
  const canonical = fs.readFileSync(new URL('../../_spec/_plans/ml-runtime-redesign.md', import.meta.url), 'utf8');
  const block = canonical.match(/<!-- BEGIN STEP2 GCC NOTICES V2 -->\n```sh\n([\s\S]*?)```\n<!-- END STEP2 GCC NOTICES V2 -->/)[1];
  const cleanup = /function abortPublications\(code, publishers\) \{[\s\S]*?\n\}/;
  assert.equal(block.match(cleanup)[0], canonical.match(cleanup)[0]);
  for (const phrase of ['v2Adapter.buildBootlinGccNoticesV2Source(noticeBase.sourceText)',
    'captures !== 7', 'captureCloses !== 7', 'returned !== 72261', 'requested !== 72268', 'allocated !== 72268',
    'c.fetchCalls !== 5', 'c.eofObservations !== 5', 'c.clearedTimers !== 6', 'body.length < 1',
    'body.length > 1048576', 'c.retainedBytes > 2097152', 'bytes.length > 16777216',
    "o.contentTypeExposed !== media.has('content-type')", 'o.declaredContentType.length === 0',
    'o.declaredContentType !== null', 'HISTORICAL_CONTEXT_NOT_GET_HEAD_EQUIVALENCE_OR_SOURCE_AUTHENTICATION',
    'published.counts.closes !== 3', 'published.counts.fsyncs !== 4']) assert.ok(block.includes(phrase), phrase);
  assert.ok(block.indexOf('head.exposedHeaders.some(') < block.indexOf('module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(started)'));
  assert.ok(block.indexOf('module.SOURCE_BIND_PARENT_CLOCK_ORIGIN(started)') < block.indexOf('await module.collectRegisteredBootlinGccNoticesV2()'));
  assert.equal(block.includes('bootlin-gcc-notices-v1.result.json'), false);
  assert.equal(/\b(?:spawn|execFile|unlinkSync|rmSync|fetch)\s*\(/u.test(block), false);
});

test('accepted notice V2 preserves all five passive bodies and their actual unexposed media declarations', () => {
  const full = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/bootlin-gcc-notices-v2.result.json', import.meta.url));
  const compact = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/bootlin-gcc-notices-v2.receipt.json', import.meta.url));
  assert.equal(full.length, 108099); assert.equal(sha(full), '2d907e7bb2520918e6d27920cee0d1aba731a382056141cdf18f7d9b3198d2ed');
  assert.equal(compact.length, 7711); assert.equal(sha(compact), 'e9bdd8ae3b269827307cbd04e51035edf98faa30893cd6e5976d5d835bdf287f');
  const report = JSON.parse(full), receipt = JSON.parse(compact), data = report.collection;
  assert.equal(receipt.publicationAccepted, true); assert.equal(receipt.result.sha256, sha(full));
  assert.deepEqual(report.noticeContext.targetNames, ['COPYING', 'COPYING.LIB', 'COPYING.RUNTIME', 'COPYING3', 'COPYING3.LIB']);
  assert.deepEqual(data.observations.map(row => row.observedBodyBytes), [18002, 26527, 3324, 35147, 7639]);
  assert.deepEqual(data.observations.map(row => (row.bodyUtf8.match(/\f/g) ?? []).length), [5, 9, 0, 0, 0]);
  for (const row of data.observations) {
    assert.equal(row.eof, true); assert.equal(row.sourceKind, 'PUBLIC_LICENSE_NOTICE_TEXT');
    assert.equal(row.interpreted, false); assert.equal(row.urlsFollowed, false);
    assert.equal(row.contentTypeExposed, false); assert.equal(row.declaredContentType, null);
    assert.equal(Buffer.byteLength(row.bodyUtf8), row.observedBodyBytes); assert.equal(sha(Buffer.from(row.bodyUtf8)), row.bodySha256);
  }
  assert.equal(data.counts.fetchCalls, 5); assert.equal(data.counts.eofObservations, 5);
  assert.equal(data.counts.retainedBytes, 90639); assert.equal(data.counts.cancellations, 0);
  assert.equal(data.counts.releases, 5); assert.equal(data.counts.clearedTimers, 6); assert.equal(data.counts.activeTimers, 0);
  assert.equal(data.cleanupUncertain, false); assert.equal(data.transportClosureVerified, false);
  assert.equal(receipt.captureCounts.captures, 7); assert.equal(receipt.captureCounts.captureCloses, 7);
  assert.equal(receipt.publicationCounts.closes, 3); assert.equal(receipt.publicationCounts.fsyncs, 4);
  for (const key of ['sourceAuthenticated', 'publisherAuthenticated', 'licenseComplianceVerified', 'noticeApplicabilityVerified',
    'copyAuthorized', 'runtimeProvidersQualified', 'pythonFreeSubsetVerified', 'abiVerified', 'imagePrepared',
    'nativeQualified', 'rustReady', 'trainingReady']) assert.equal(report[key], false, key);
  assert.equal(json('bootlin-gcc-notices-v1.stop.json').cleanupUncertain, true);
});

test('candidate image planning preserves incomplete authority and explicit missing inputs', () => {
  for (const phrase of ['candidate-image-manifest source/test unit', 'all four complete lengths/hashes before JSON parsing',
    'every8675 original member identity/disposition', 'additional-HOST candidate records',
    'PROPOSED_INCOMPLETE with materializationAuthorized:false', 'unspecified job limits',
    'never fabricated archive spans or legal-applicability claims']) assert.ok(plan.includes(phrase), phrase);
});

test('candidate proposal publication rejects promotion and retains fixed metadata-only capture bounds', () => {
  const canonical = fs.readFileSync(new URL('../../_spec/_plans/ml-runtime-redesign.md', import.meta.url), 'utf8');
  const block = canonical.match(/<!-- BEGIN STEP2 CANDIDATE IMAGE PROPOSAL V1 -->\n```sh\n([\s\S]*?)```\n<!-- END STEP2 CANDIDATE IMAGE PROPOSAL V1 -->/)[1];
  const cleanup = /function abortPublications\(code, publishers\) \{[\s\S]*?\n\}/;
  assert.equal(block.match(cleanup)[0], canonical.match(cleanup)[0]);
  for (const phrase of ['allocated + length + 1 > 16777216', 'captures !== 6', 'captureCloses !== 6',
    'returned !== 8814212', 'requested !== 8814218', 'allocated !== 8814218',
    'bytes.length !== 12731738', 'a106e1d71c2cf9833ef5eea5ce136d0d38e337f78020d66ec278a0bb3a26af88',
    'published.counts.closes !== 3', 'published.counts.fsyncs !== 4']) assert.ok(block.includes(phrase), phrase);
  const predicate = block.match(/if \(report\.status !== 'PROPOSED_INCOMPLETE'[\s\S]*?\) fail\('E_REPORT'\);/)[0];
  const enforce = Function('report', 'fail', predicate);
  const report = { status: 'PROPOSED_INCOMPLETE', materializationAuthorized: false, closedRootfs: false, trainingReady: false,
    counts: { sourceIdentities: 8675, candidatePlacements: 1714 }, runtimeRoleCandidates: Array(8),
    rootAliasProposals: Array(2), externalNoticeRecords: Array(5), missing: Array(14),
    jobResourceProfile: { memoryBytes: null, cpu: null, pids: null, swapBytes: null } };
  const fail = code => { throw new Error(code); };
  enforce(report, fail);
  for (const changed of [{ materializationAuthorized: true }, { status: 'READY' }, { closedRootfs: true },
    { trainingReady: true }, { jobResourceProfile: { ...report.jobResourceProfile, cpu: 2 } }]) {
    assert.throws(() => enforce({ ...report, ...changed }, fail), /E_REPORT/);
  }
  assert.equal(/\b(?:spawn|execFile|unlinkSync|rmSync|fetch)\s*\(/u.test(block), false);
});

test('published candidate image manifest remains incomplete and cannot authorize materialization', () => {
  const full = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/candidate-image-manifest-v1.proposal.json', import.meta.url));
  const compact = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/candidate-image-manifest-v1.receipt.json', import.meta.url));
  assert.equal(full.length, 12731738); assert.equal(sha(full), 'a106e1d71c2cf9833ef5eea5ce136d0d38e337f78020d66ec278a0bb3a26af88');
  assert.equal(compact.length, 3573); assert.equal(sha(compact), 'bdc3f848e7a56a3a1420fb0e98458bbc98c1b858ace7ab526593ebca9305f220');
  const proposal = JSON.parse(full), receipt = JSON.parse(compact);
  assert.equal(receipt.publicationAccepted, true); assert.equal(receipt.result.sha256, sha(full));
  assert.equal(proposal.status, 'PROPOSED_INCOMPLETE'); assert.equal(proposal.sourceIdentityLedger.length, 8675);
  assert.equal(proposal.candidatePlacements.length, 1714); assert.equal(proposal.runtimeRoleCandidates.length, 8);
  assert.equal(proposal.rootAliasProposals.length, 2); assert.equal(proposal.externalNoticeRecords.length, 5);
  assert.equal(proposal.missing.length, 14); assert.ok(proposal.missing.every(row => row.status === 'MISSING' && row.resolved === false));
  assert.ok(proposal.runtimeRoleCandidates.every(row => row.sourceDomain === 'TARGET' && row.proposedDomain === 'HOST'
    && row.allowedForExecution === false && row.hostTargetPromotion === false));
  for (const key of ['memoryBytes', 'cpu', 'pids', 'swapBytes']) assert.equal(proposal.jobResourceProfile[key], null);
  for (const key of ['materializationAuthorized', 'closedRootfs', 'imageComplete', 'copyAuthorized', 'executionAllowed',
    'sourceAuthenticated', 'publisherAuthenticated', 'licenseComplianceVerified', 'pythonFreeSubsetVerified',
    'runtimeProvidersQualified', 'symbolBindingsVerified', 'abiVerified', 'imagePrepared', 'nativeQualified', 'rustReady', 'trainingReady']) {
    assert.equal(proposal[key], false, key);
  }
  assert.equal(receipt.captureCounts.captures, 6); assert.equal(receipt.captureCounts.captureCloses, 6);
  assert.equal(receipt.publicationCounts.closes, 3); assert.equal(receipt.publicationCounts.fsyncs, 4);
});

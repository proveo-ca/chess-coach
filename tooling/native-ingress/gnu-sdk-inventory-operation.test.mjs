// SPEC: _spec/tooling/native-ingress/gnu-sdk-inventory.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { runRegisteredGnuSdkInventory } from './gnu-sdk-inventory-operation.mjs';

const digest = x => createHash('sha256').update(x).digest('hex');
const source = fs.readFileSync(new URL('./gnu-sdk-inventory-operation.mjs', import.meta.url), 'utf8');

test('SDK operation imports inertly and exposes no caller-selected path or execution profile', () => {
  assert.equal(typeof runRegisteredGnuSdkInventory, 'function');
  assert.equal(runRegisteredGnuSdkInventory.length, 0);
  assert.doesNotMatch(source, /await runRegisteredGnuSdkInventory|process\.argv|process\.env/);
});
test('every captured source reference matches exact repository bytes', () => {
  const descriptors = [...source.matchAll(/\['([a-z-]+)', (\d+), '([0-9a-f]{64})'\]/g)];
  assert.deepEqual(descriptors.map(x => x[1]), ['tar-inventory', 'elf-metadata', 'xz-staging', 'gnu-sdk-inventory']);
  for (const [, name, size, sha] of descriptors) {
    const bytes = fs.readFileSync(new URL('./' + name + '.mjs', import.meta.url));
    assert.equal(bytes.length, Number(size));
    assert.equal(digest(bytes), sha);
  }
});
test('both deterministic dependency links match independently registered byte images', () => {
  for (const [name, dependency, size, sha] of [
    ['xz-staging', 'elf-metadata', 43154, '89b6c5e3dcbf902937f81fc642d7238bd4ec4ca3c94f6b61f4d069efdce8c5f2'],
    ['gnu-sdk-inventory', 'tar-inventory', 44002, '53d5fcc40eadb1e149340ccd7f93edbdd980f48f98ea06751f3780dea39f3078'],
  ]) {
    const raw = fs.readFileSync(new URL('./' + name + '.mjs', import.meta.url), 'utf8');
    const bytes = fs.readFileSync(new URL('./' + dependency + '.mjs', import.meta.url));
    const needle = "from './" + dependency + ".mjs'";
    assert.equal(raw.split(needle).length, 2);
    const linked = Buffer.from(raw.replace(needle, "from 'data:text/javascript;base64," + bytes.toString('base64') + "'"));
    assert.equal(linked.length, size);
    assert.equal(digest(linked), sha);
    assert.ok(source.includes(sha));
  }
});
test('the consumed qualification receipt is referenced as data rather than rerun', () => {
  const bytes = fs.readFileSync(new URL('../../_spec/tooling/native-ingress/xz-qualification.receipt.json', import.meta.url));
  assert.equal(bytes.length, 4239);
  assert.equal(digest(bytes), 'e45d65231c0815ab2b895c0d74467500a0e6caf33cc0a4ee342b20489ce6b233');
  assert.ok(source.includes(digest(bytes)));
  assert.doesNotMatch(source, /stageXzImages\(|runRegisteredXzQualification\(|runXzFixtures\(/);
});
test('the SDK operator contains no extraction, installation, network or deletion methods', () => {
  assert.doesNotMatch(source, /\b(?:fetch|unlink|rmSync|rmdir|mkdirSync|writeFileSync|writeSync|rename|execFileSync)\s*\(/);
  assert.match(source, /archiveExtracted: false, filesInstalled: false, pythonRuntimeInvoked: false/);
  assert.match(source, /pythonFreeSubsetVerified: false, nativeQualified: false, rustReady: false, trainingReady: false/);
});
test('source/test pointers, owner covers and exact index entry agree', () => {
  const spec = '_spec/tooling/native-ingress/gnu-sdk-inventory.puml';
  const files = ['gnu-sdk-inventory.mjs', 'gnu-sdk-inventory.test.mjs', 'gnu-sdk-inventory-operation.mjs', 'gnu-sdk-inventory-operation.test.mjs'].map(x => 'tooling/native-ingress/' + x);
  const diagram = fs.readFileSync(new URL('../../' + spec, import.meta.url), 'utf8');
  const index = JSON.parse(fs.readFileSync(new URL('../../_spec/.spec-index.json', import.meta.url), 'utf8'));
  assert.deepEqual(index.specs.filter(x => x.spec === spec), [{ spec, covers: files, fingerprint: null }]);
  for (const file of files) {
    assert.ok(diagram.includes("' covers: " + file + '\n'));
    assert.ok(fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8').startsWith('// SPEC: ' + spec + '\n'));
  }
});

// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, symlink, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { assertImageArchive, evidenceBudget, scanTarFile } from './tar.mjs';
import { evidenceLimits } from './evidence-limits.mjs';

const sha = (data) => createHash('sha256').update(data).digest('hex');
function header({ path, data = Buffer.alloc(0), type = '0', target = '', prefix = '', mode = 0o644 }) {
  const block = Buffer.alloc(512);
  block.write(path, 0, 100);
  for (const [offset, width, value] of [[100, 8, mode], [108, 8, 0], [116, 8, 0], [124, 12, data.length], [136, 12, 0]]) block.write(value.toString(8).padStart(width - 1, '0') + '\0', offset, width);
  block.fill(32, 148, 156);
  block.write(type, 156);
  block.write(target, 157, 100);
  block.write('ustar\0', 257);
  block.write('00', 263);
  block.write(prefix, 345, 155);
  const sum = block.reduce((total, byte) => total + byte, 0);
  block.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return block;
}
function tar(entries) {
  return Buffer.concat([...entries.flatMap((entry) => {
    const data = Buffer.from(entry.data ?? '');
    return [header({ ...entry, data }), data, Buffer.alloc((512 - data.length % 512) % 512)];
  }), Buffer.alloc(1024)]);
}
function paxRecord(key, value) {
  const body = ` ${key}=${value}\n`;
  let length = Buffer.byteLength(body) + 1;
  while (String(length).length + Buffer.byteLength(body) !== length) length = String(length).length + Buffer.byteLength(body);
  return `${length}${body}`;
}
function saved({ blob = false, gzip = false, empty = false, repeat = false, changeConfig = (value) => value, changeManifest = (value) => value, changeLayer = (value) => value } = {}) {
  const raw = tar(empty ? [] : [{ path: 'payload', data: 'layer payload' }]);
  const layer = changeLayer(gzip ? gzipSync(raw) : raw);
  const config = Buffer.from(JSON.stringify(changeConfig({ rootfs: { type: 'layers', diff_ids: Array(repeat ? 2 : 1).fill(`sha256:${sha(raw)}`) } })));
  const configName = blob ? `blobs/sha256/${sha(config)}` : `${sha(config)}.json`;
  const layerName = blob ? `blobs/sha256/${sha(layer)}` : 'legacy/layer.tar';
  const manifest = changeManifest([{ Config: configName, RepoTags: null, Layers: Array(repeat ? 2 : 1).fill(layerName) }]);
  return { image: `sha256:${sha(config)}`, entries: [{ path: layerName, data: layer }, { path: configName, data: config }, { path: 'manifest.json', data: JSON.stringify(manifest) }] };
}
function ociSaved({ badBinding = false, badDescriptor = false, repeatEmpty = false, badSecondDiffId = false } = {}) {
  const savedImage = saved({ blob: true, gzip: true, empty: repeatEmpty, repeat: repeatEmpty, changeConfig: (config) => badSecondDiffId ? { ...config, rootfs: { ...config.rootfs, diff_ids: [config.rootfs.diff_ids[0], `sha256:${'dead'.repeat(16)}`] } } : config });
  const descriptor = (entry, mediaType) => ({ mediaType, digest: `sha256:${sha(entry.data)}`, size: Buffer.byteLength(entry.data) });
  const manifest = { schemaVersion: 2, mediaType: 'application/vnd.oci.image.manifest.v1+json', config: descriptor(savedImage.entries[1], 'application/vnd.oci.image.config.v1+json'), layers: Array.from({ length: repeatEmpty ? 2 : 1 }, () => descriptor(savedImage.entries[0], 'application/vnd.oci.image.layer.v1.tar+gzip')) };
  if (badBinding) manifest.config = descriptor(savedImage.entries[0], 'application/vnd.oci.image.config.v1+json');
  if (badDescriptor) manifest.layers[0].size++;
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const manifestEntry = { path: `blobs/sha256/${sha(manifestBytes)}`, data: manifestBytes };
  const provenanceBytes = Buffer.from(JSON.stringify({ predicateType: 'https://slsa.dev/provenance/v1', predicate: {} }));
  const provenance = { path: `blobs/sha256/${sha(provenanceBytes)}`, data: provenanceBytes };
  const index = Buffer.from(JSON.stringify({ schemaVersion: 2, mediaType: 'application/vnd.oci.image.index.v1+json', manifests: [{ ...descriptor(manifestEntry, manifest.mediaType), platform: { os: 'linux', architecture: 'amd64' } }, { ...descriptor(provenance, 'application/vnd.in-toto+json'), platform: { os: 'unknown', architecture: 'unknown' } }] }));
  return { image: `sha256:${sha(index)}`, entries: [...savedImage.entries, manifestEntry, provenance, { path: `blobs/sha256/${sha(index)}`, data: index }, { path: 'oci-layout', data: '{"imageLayoutVersion":"1.0.0"}' }] };
}
async function fixture(action) {
  const directory = await mkdtemp(join(tmpdir(), 'tar-evidence-test-'));
  const path = join(directory, 'image.tar');
  try { await action(path, directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

for (const options of [{}, { blob: true }, { blob: true, gzip: true }]) {
  test(`valid Docker save archive ${JSON.stringify(options)}`, () => fixture(async (path) => {
    const image = saved(options);
    const bytes = tar(image.entries);
    await writeFile(path, bytes);
    assert.deepEqual(await assertImageArchive(path, image.image), { sha256: sha(bytes), bytes: bytes.length });
  }));
}
for (const options of [{}, { blob: true, gzip: true }]) test(`accepts repeated empty layer with identical positional diff_ids ${JSON.stringify(options)}`, () => fixture(async (path) => {
  const image = saved({ ...options, empty: true, repeat: true });
  const bytes = tar(image.entries);
  await writeFile(path, bytes);
  assert.deepEqual(await assertImageArchive(path, image.image), { sha256: sha(bytes), bytes: bytes.length });
}));
test('accepts OCI repeated empty layer descriptors with identical positional diff_ids', () => fixture(async (path) => {
  const image = ociSaved({ repeatEmpty: true });
  const bytes = tar(image.entries);
  await writeFile(path, bytes);
  assert.deepEqual(await assertImageArchive(path, image.image), { sha256: sha(bytes), bytes: bytes.length });
}));
test('rejects OCI repeated layer whose second positional diff_id differs', () => fixture(async (path) => {
  const image = ociSaved({ repeatEmpty: true, badSecondDiffId: true });
  await writeFile(path, tar(image.entries));
  await assert.rejects(assertImageArchive(path, image.image), /ordered layer diff_id mismatch/);
}));
test('uses the selected larger evidence limits profile', () => {
  assert.deepEqual(evidenceLimits, {
    fileBytes: 16 * 1024 ** 2,
    retainedBytes: 64 * 1024 ** 2,
    archiveBytes: 512 * 1024 ** 2,
    scanBytes: 2 * 1024 ** 3,
    metadataBytes: 16 * 1024 ** 2,
    entries: 262144,
    pathBytes: 4096,
  });
});
test('USTAR prefix and checksummed PAX path/link metadata', () => fixture(async (path) => {
  const longName = `root/${'long'.repeat(40)}`;
  await writeFile(path, tar([
    { path: 'file', prefix: 'root', data: 'bytes' },
    { path: 'PaxHeaders/first', type: 'x', data: paxRecord('path', longName) },
    { path: 'placeholder', data: 'long bytes' },
    { path: 'PaxHeaders/second', type: 'x', data: paxRecord('linkpath', '../external') },
    { path: 'root/link', type: '2', target: 'placeholder' },
  ]));
  const { entries } = await scanTarFile(path);
  assert.equal(entries.get('root/file').sha256, sha('bytes'));
  assert.equal(entries.get(longName).sha256, sha('long bytes'));
  assert.equal(entries.get('root/link').target, '../external');
}));
test('scans many custom global PAX headers within the aggregate metadata budget', () => fixture(async (path) => {
  const headers = Array.from({ length: 1000 }, (_, index) => ({ path: `PaxHeaders/global-${index}`, type: 'g', data: Array.from({ length: 32 }, (_, key) => paxRecord(`custom.${index}.${key}`, 'ignored')).join('') }));
  const files = headers.map((_, index) => ({ path: `file-${index}`, data: 'payload' }));
  const entries = headers.flatMap((header, index) => [header, files[index]]);
  const bytes = tar(entries);
  await writeFile(path, bytes);
  const budget = evidenceBudget();
  const scanned = await scanTarFile(path, { budget });
  assert.equal(scanned.entries.size, files.length);
  assert.equal(budget.entries, entries.length);
  assert.equal(budget.scan, bytes.length);
  assert.equal(budget.retained, 0);
  assert.equal(budget.metadata, headers.reduce((sum, header) => sum + Buffer.byteLength(header.data), 0) + files.reduce((sum, file) => sum + Buffer.byteLength(file.path) + 160, 0));
  for (const file of files) assert.equal(scanned.entries.get(file.path).sha256, sha(file.data));
  await assert.rejects(scanTarFile(path, { limits: { ...evidenceLimits, metadataBytes: budget.metadata - 1 } }), /metadata resource limit/);
}));
test('ignores custom global/local PAX keys without prototype mutation and retains local layout', () => fixture(async (path) => {
  await writeFile(path, tar([
    { path: 'PaxHeaders/global', type: 'g', data: paxRecord('__proto__', 'polluted') + paxRecord('constructor', 'ignored') },
    { path: 'PaxHeaders/local', type: 'x', data: paxRecord('toString', 'ignored') + paxRecord('path', 'actual/path') },
    { path: 'placeholder', data: 'content' },
  ]));
  const scanned = await scanTarFile(path);
  assert.equal(scanned.entries.get('actual/path').sha256, sha('content'));
  assert.equal(scanned.entries.size, 1);
  assert.equal(Object.hasOwn(Object.prototype, 'polluted'), false);
}));
test('rejects duplicate custom PAX keys within a global header', () => fixture(async (path) => {
  await writeFile(path, tar([{ path: 'PaxHeaders/global', type: 'g', data: paxRecord('custom.key', 'first') + paxRecord('custom.key', 'second') }]));
  await assert.rejects(scanTarFile(path), /duplicate PAX key/);
}));
test('Docker OCI image index ID binds extensionless config, layers, and provenance blobs', () => fixture(async (path) => {
  const image = ociSaved();
  const bytes = tar(image.entries);
  await writeFile(path, bytes);
  assert.deepEqual(await assertImageArchive(path, image.image), { sha256: sha(bytes), bytes: bytes.length });
}));
for (const [label, options, pattern] of [
  ['OCI config binding', { badBinding: true }, /config binding/],
  ['OCI descriptor size', { badDescriptor: true }, /descriptor content/],
]) test(label, () => fixture(async (path) => {
  const image = ociSaved(options);
  await writeFile(path, tar(image.entries));
  await assert.rejects(assertImageArchive(path, image.image), pattern);
}));
test('requires Docker save manifest even when OCI blobs exist', () => fixture(async (path) => {
  const image = ociSaved();
  await writeFile(path, tar(image.entries.filter((entry) => entry.path !== 'manifest.json')));
  await assert.rejects(assertImageArchive(path, image.image), /Docker save manifest/);
}));
test('rejects reordered distinct layers', () => fixture(async (path) => {
  const first = tar([{ path: 'first', data: 'one' }]);
  const second = tar([{ path: 'second', data: 'two' }]);
  const config = JSON.stringify({ rootfs: { type: 'layers', diff_ids: [`sha256:${sha(first)}`, `sha256:${sha(second)}`] } });
  await writeFile(path, tar([{ path: 'first/layer.tar', data: first }, { path: 'second/layer.tar', data: second }, { path: 'config.json', data: config }, { path: 'manifest.json', data: JSON.stringify([{ Config: 'config.json', Layers: ['second/layer.tar', 'first/layer.tar'] }]) }]));
  await assert.rejects(assertImageArchive(path, `sha256:${sha(config)}`), /ordered layer diff_id/);
}));
test('requires OCI descriptors and Docker save references in the same order', () => fixture(async (path) => {
  const rawLayers = [tar([{ path: 'first', data: 'one' }]), tar([{ path: 'second', data: 'two' }])];
  const blob = (data) => ({ path: `blobs/sha256/${sha(data)}`, data });
  const descriptor = (entry, mediaType) => ({ mediaType, digest: `sha256:${sha(entry.data)}`, size: entry.data.length });
  const layers = rawLayers.map((raw) => blob(gzipSync(raw)));
  const config = blob(Buffer.from(JSON.stringify({ rootfs: { type: 'layers', diff_ids: rawLayers.map((raw) => `sha256:${sha(raw)}`) } })));
  const manifest = blob(Buffer.from(JSON.stringify({ schemaVersion: 2, mediaType: 'application/vnd.oci.image.manifest.v1+json', config: descriptor(config, 'application/vnd.oci.image.config.v1+json'), layers: layers.map((layer) => descriptor(layer, 'application/vnd.oci.image.layer.v1.tar+gzip')) })));
  await writeFile(path, tar([...layers, config, manifest, { path: 'manifest.json', data: JSON.stringify([{ Config: config.path, Layers: layers.map((layer) => layer.path).reverse() }]) }]));
  await assert.rejects(assertImageArchive(path, `sha256:${sha(manifest.data)}`), /OCI Docker save layer binding/);
}));
for (const [label, entries, pattern] of [
  ['parent traversal', [{ path: '../escape' }], /unsafe path/],
  ['absolute path', [{ path: '/escape' }], /unsafe path/],
  ['prefix traversal', [{ path: 'file', prefix: '../escape' }], /unsafe path/],
  ['duplicate path aliases', [{ path: 'root/file' }, { path: './root/file' }], /duplicate path/],
  ['special entry', [{ path: 'device', type: '3' }], /entry type/],
  ['directory payload', [{ path: 'root', type: '5', data: 'bad' }], /non-file payload/],
  ['PAX traversal', [{ path: 'PaxHeaders/p', type: 'x', data: paxRecord('path', '../escape') }, { path: 'safe' }], /unsafe path/],
  ['PAX malformed length', [{ path: 'PaxHeaders/p', type: 'x', data: '20 path=safe\n' }, { path: 'safe' }], /PAX truncation/],
  ['PAX duplicate key', [{ path: 'PaxHeaders/p', type: 'x', data: paxRecord('path', 'a') + paxRecord('path', 'b') }, { path: 'safe' }], /duplicate PAX key/],
  ['PAX dangling header', [{ path: 'PaxHeaders/p', type: 'x', data: paxRecord('path', 'a') }], /end marker/],
]) test(label, () => fixture(async (path) => {
  await writeFile(path, tar(entries));
  await assert.rejects(scanTarFile(path), pattern);
}));
for (const [label, mutate, pattern] of [
  ['checksum corruption', (bytes) => { bytes[0] ^= 1; return bytes; }, /checksum/],
  ['malformed numeric field', (bytes) => { bytes[124] = 57; const block = bytes.subarray(0, 512); block.fill(32, 148, 156); block.write(block.reduce((n, b) => n + b, 0).toString(8).padStart(6, '0') + '\0 ', 148); return bytes; }, /numeric field/],
  ['nonzero padding', (bytes) => { bytes[513] = 1; return bytes; }, /padding/],
  ['truncated payload', (bytes) => bytes.subarray(0, 512), /truncated entry/],
  ['missing terminator', (bytes) => bytes.subarray(0, bytes.length - 1024), /end marker/],
  ['single zero terminator', (bytes) => bytes.subarray(0, bytes.length - 512), /truncated archive/],
  ['trailing data', (bytes) => Buffer.concat([bytes, Buffer.alloc(512, 1)]), /after end marker/],
]) test(label, () => fixture(async (path) => {
  await writeFile(path, mutate(tar([{ path: 'a', data: 'x' }])));
  await assert.rejects(scanTarFile(path), pattern);
}));
for (const [label, options, pattern] of [
  ['config digest', {}, /config image ID/],
  ['ordered diff_ids', { changeConfig: (c) => ({ ...c, rootfs: { ...c.rootfs, diff_ids: [`sha256:${'0'.repeat(64)}`] } }) }, /diff_id mismatch/],
  ['repeated layer with different second diff_id', { repeat: true, changeConfig: (c) => ({ ...c, rootfs: { ...c.rootfs, diff_ids: [c.rootfs.diff_ids[0], `sha256:${'dead'.repeat(16)}`] } }) }, /ordered layer diff_id mismatch/],
  ['missing layer', { changeManifest: (m) => [{ ...m[0], Layers: ['missing/layer.tar'] }] }, /diff_id mismatch/],
  ['multiple images', { changeManifest: (m) => [...m, ...m] }, /exactly one/],
  ['layer mutation', { changeLayer: (b) => Buffer.from(b.map((value, index) => index === 512 ? value ^ 1 : value)) }, /diff_id mismatch/],
]) test(`reject ${label}`, () => fixture(async (path) => {
  const image = saved(options);
  await writeFile(path, tar(image.entries));
  await assert.rejects(assertImageArchive(path, label === 'config digest' ? `sha256:${'0'.repeat(64)}` : image.image), pattern);
}));
test('checks compressed blob filename against raw payload hash', () => fixture(async (path) => {
  const image = saved({ blob: true, gzip: true });
  const falseName = `blobs/sha256/${'0'.repeat(64)}`;
  const actualName = image.entries[0].path;
  image.entries[0].path = falseName;
  image.entries[2].data = image.entries[2].data.replace(actualName, falseName);
  await writeFile(path, tar(image.entries));
  await assert.rejects(assertImageArchive(path, image.image), /blob content hash/);
}));
test('gzip expansion uses aggregate scan budget', () => fixture(async (path) => {
  const image = saved({ blob: true, gzip: true });
  const bytes = tar(image.entries);
  await writeFile(path, bytes);
  await assert.rejects(assertImageArchive(path, image.image, { limits: { ...evidenceLimits, scanBytes: bytes.length } }), /scan resource limit/);
}));
for (const [field, maximum, options, pattern] of [
  ['archiveBytes', 1024, {}, /archive size/],
  ['entries', 1, {}, /entries resource/],
  ['metadataBytes', 1, {}, /metadata resource/],
  ['pathBytes', 1, {}, /unsafe path/],
  ['fileBytes', 1, { retain: () => true }, /file limit/],
  ['retainedBytes', 1, { retain: () => true }, /retained resource/],
]) test(`bounded ${field}`, () => fixture(async (path) => {
  await writeFile(path, tar([{ path: 'first', data: 'two' }, { path: 'second', data: 'two' }]));
  await assert.rejects(scanTarFile(path, { ...options, limits: { ...evidenceLimits, [field]: maximum } }), pattern);
}));
test('refuses symlink archive descriptors', () => fixture(async (path, directory) => {
  await writeFile(path, tar([]));
  const link = join(directory, 'link');
  await symlink(path, link);
  await assert.rejects(scanTarFile(link), { code: 'ELOOP' });
}));
test('detects growth on the same descriptor during scan', () => fixture(async (path) => {
  await writeFile(path, tar([{ path: 'a', data: 'a' }]));
  await assert.rejects(scanTarFile(path, { inspect: () => appendFile(path, Buffer.alloc(512)) }), /changed during scan/);
}));

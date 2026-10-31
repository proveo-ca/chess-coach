import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, openSync, readSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const pins = {
  CONTROLLER: [2730, 'e9a7b287b3188ce69639632bb116ca7edf4ca2fe12bbc4071bc90fc6bb864c9b'],
  ENTRY: [1163, '4c80a50b1095bfe4049d1449b53c95f7c5cb153ca005e2511965dd20cd41e64e'],
  PARENT: [4955, '725eca59ec9cd85124579380d85780a9d92b25e01100779e83b16a0aa08cdd28'],
};
const documentPath = fileURLToPath(new URL('../_spec/_plans/native-ingress-root-metadata-checked-packet.md', import.meta.url));
function readSnapshot() {
  const fd = openSync(documentPath, 'r');
  try {
    const bytes = Buffer.alloc(32769);
    let at = 0;
    while (at < bytes.length) {
      const count = readSync(fd, bytes, at, bytes.length - at, null);
      if (count === 0) break;
      at += count;
    }
    if (at > 32768) throw Error('document');
    return bytes.subarray(0, at);
  } finally { closeSync(fd); }
}
const snapshot = readSnapshot();
const stop = '{"protocol":"F9_ROOT_METADATA_V1","status":"STOP","reason":"CONTROLLER"}\n';

function checkedBlocks(document) {
  if (!Buffer.isBuffer(document) || document.length < 1 || document.length > 32768) throw Error('document');
  const blocks = {};
  for (const [name, [size, digest]] of Object.entries(pins)) {
    const begin = Buffer.from(`<!-- BEGIN F9 ROOT METADATA ${name} -->\n\`\`\`js\n`);
    const end = Buffer.from(`\`\`\`\n<!-- END F9 ROOT METADATA ${name} -->`);
    const start = document.indexOf(begin);
    if (start < 0 || start !== document.lastIndexOf(begin)) throw Error(name);
    const from = start + begin.length;
    const to = document.indexOf(end, from);
    if (to < from || to !== document.lastIndexOf(end)) throw Error(name);
    const bytes = document.subarray(from, to);
    if (bytes.length !== size || bytes.at(-1) !== 10 ||
        !Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes) ||
        createHash('sha256').update(bytes).digest('hex') !== digest) throw Error(name);
    blocks[name] = bytes;
  }
  return blocks;
}

const blocks = checkedBlocks(snapshot);

function checkedArgument(encoded, name) {
  const [length, digest] = pins[name];
  if (typeof encoded !== 'string' || encoded.length !== Math.ceil(length / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw Error(name);
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length !== length || bytes.toString('base64') !== encoded || bytes.at(-1) !== 10 ||
      !Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes) ||
      createHash('sha256').update(bytes).digest('hex') !== digest) throw Error(name);
  return bytes;
}

function fakeHandoff(args) {
  if (args.length !== 2) return { status: 'STOP', spawn: null };
  try {
    const entry = checkedArgument(args[0], 'ENTRY');
    checkedArgument(args[1], 'CONTROLLER');
    return {
      status: 'HANDED_OFF',
      spawn: { path: '/usr/local/bin/node', argv: ['--no-warnings', '--eval', entry.toString('utf8'), '--', args[1]],
        settings: { shell: false, cwd: '/', env: {}, stdio: ['ignore', 'pipe', 'pipe'] } },
    };
  } catch { return { status: 'STOP', spawn: null }; }
}

function fakeCapture(events, { shortWrite = false } = {}) {
  let stdout = Buffer.alloc(0);
  let stderr = 0;
  let stdoutEnd = false;
  let stderrEnd = false;
  let exited = false;
  let code;
  let signal;
  let refused = false;
  for (const [kind, value] of events) {
    if (kind === 'stdout') {
      if (stdout.length + stderr + value.length > 1024) refused = true;
      else stdout = Buffer.concat([stdout, value]);
    } else if (kind === 'stderr') {
      stderr += value.length;
      if (stdout.length + stderr > 1024) refused = true;
    } else if (kind === 'stdoutEnd') stdoutEnd = true;
    else if (kind === 'stderrEnd') stderrEnd = true;
    else if (kind === 'exit') { exited = true; [code, signal] = value; }
    else if (kind === 'timeout' || kind === 'error') refused = true;
    else if (kind === 'close') {
      if (refused || !stdoutEnd || !stderrEnd || !exited || code !== 0 || signal !== null || stderr) return stop;
      try {
        const raw = stdout.toString('ascii');
        if (stdout.length === 0 || stdout.some(byte => byte > 127) ||
            !raw.endsWith('\n') || raw.indexOf('\n') !== raw.length - 1) throw Error();
        const result = JSON.parse(raw.slice(0, -1));
        if (!result || Object.keys(result).join() !== 'protocol,status,reason,tmp,parent,root' ||
            result.protocol !== 'F9_ROOT_METADATA_V1' || result.status !== 'OBSERVED' || result.reason !== 'OK' ||
            JSON.stringify(result) + '\n' !== raw) throw Error();
        for (const [name, uid, mode] of [['tmp', '0', '1777'], ['parent', '1000', '0755'], ['root', '1000', '0700']]) {
          const item = result[name];
          if (!item || Object.keys(item).join() !== 'type,uid,mode,dev,ino' || item.type !== 'directory' ||
              item.uid !== uid || item.mode !== mode ||
              !/^(0|[1-9][0-9]*)$/.test(item.dev) || !/^(0|[1-9][0-9]*)$/.test(item.ino)) throw Error();
        }
        return shortWrite ? raw.slice(0, -1) : raw;
      } catch { return stop; }
    }
  }
  return null;
}

function goodArgs() {
  return [blocks.ENTRY.toString('base64'), blocks.CONTROLLER.toString('base64')];
}

function observed() {
  return JSON.stringify({
    protocol: 'F9_ROOT_METADATA_V1', status: 'OBSERVED', reason: 'OK',
    tmp: { type: 'directory', uid: '0', mode: '1777', dev: '1', ino: '1' },
    parent: { type: 'directory', uid: '1000', mode: '0755', dev: '1', ino: '2' },
    root: { type: 'directory', uid: '1000', mode: '0700', dev: '1', ino: '3' },
  }) + '\n';
}

function events(line = observed()) {
  return [['stdout', Buffer.from(line)], ['stdoutEnd'], ['stderrEnd'], ['exit', [0, null]], ['close']];
}

test('fence identities are independently pinned before synthetic startup', () => {
  assert.deepEqual(Object.keys(blocks), Object.keys(pins));
  for (const name of Object.keys(pins)) {
    const begin = `<!-- BEGIN F9 ROOT METADATA ${name} -->\n\`\`\`js\n`;
    const end = `\`\`\`\n<!-- END F9 ROOT METADATA ${name} -->`;
    for (const mutation of [
      snapshot.subarray(0, snapshot.indexOf(begin)),
      Buffer.concat([snapshot, Buffer.from(begin)]),
      Buffer.concat([snapshot, Buffer.from(end)]),
      Buffer.from(snapshot.toString().replace(end, '')),
      Buffer.from(snapshot.toString().replace(begin, '')),
    ]) assert.throws(() => checkedBlocks(mutation));
    const altered = Buffer.from(snapshot);
    altered[altered.indexOf(begin) + Buffer.byteLength(begin) + 12] ^= 1;
    assert.throws(() => checkedBlocks(altered));
  }
  const invalid = Buffer.from(snapshot);
  invalid[invalid.indexOf(blocks.PARENT) + 15] = 255;
  assert.throws(() => checkedBlocks(invalid));
  assert.throws(() => checkedBlocks(Buffer.alloc(32769)));
});

test('checked snapshot stays bound to test-local handoff arguments', () => {
  const changedDocument = Buffer.from(snapshot);
  changedDocument[changedDocument.indexOf(blocks.CONTROLLER) + 20] ^= 1;
  assert.throws(() => checkedBlocks(changedDocument));
  const result = fakeHandoff(goodArgs());
  assert.equal(result.status, 'HANDED_OFF');
  assert.deepEqual(result.spawn, {
    path: '/usr/local/bin/node',
    argv: ['--no-warnings', '--eval', blocks.ENTRY.toString('utf8'), '--', blocks.CONTROLLER.toString('base64')],
    settings: { shell: false, cwd: '/', env: {}, stdio: ['ignore', 'pipe', 'pipe'] },
  });
});

test('test-local handoff refuses missing, extra, noncanonical and altered arguments', () => {
  const [entry, controller] = goodArgs();
  for (const args of [[], [entry], [entry, controller, 'extra'], [entry + '!', controller],
    [entry.replace(/.$/, 'A'), controller], [entry, controller + '!'],
    [entry, controller.replace(/.$/, 'A')], [entry.slice(0, -4), controller]]) {
    assert.deepEqual(fakeHandoff(args), { status: 'STOP', spawn: null });
  }
});

test('test-local stream model forwards only after complete synthetic events', () => {
  assert.equal(fakeCapture(events().slice(0, -1)), null);
  assert.equal(fakeCapture(events()), observed());
});

test('test-local stream model refuses incomplete and invalid outcomes', () => {
  const valid = events();
  for (const sequence of [
    valid.filter(([kind]) => kind !== 'stdoutEnd'), valid.filter(([kind]) => kind !== 'stderrEnd'),
    valid.filter(([kind]) => kind !== 'exit'),
    valid.map(([kind, value]) => kind === 'exit' ? [kind, [1, null]] : [kind, value]),
    valid.map(([kind, value]) => kind === 'exit' ? [kind, [null, 'SIGKILL']] : [kind, value]),
    [['stderr', Buffer.from('x')], ...valid], [['timeout'], ...valid], [['error'], ...valid],
    events(observed() + observed()), events('x'.repeat(1025)), events(observed().slice(0, -1)),
    events(observed().replace('"dev":"1"', '"dev":"01"')),
    events(observed().replace('"status":"OBSERVED"', '"status":"STOP"')),
    events(observed().replace('"dev":"1"', '"dev":"é"')),
  ]) assert.equal(fakeCapture(sequence), stop);
});

test('partial synthetic write never yields a complete positive record', () => {
  const partial = fakeCapture(events(), { shortWrite: true });
  assert.equal(partial, observed().slice(0, -1));
  assert.notEqual(partial, observed());
});

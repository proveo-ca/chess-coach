// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase2.puml
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import { basename, join } from 'node:path';

export const logLimit = 8 * 1024 * 1024;

export async function runLogged(executable, args, { cwd, directory, prefix, limit = logLimit, testReport } = {}) {
  mkdirSync(directory, { recursive: true, mode: 0o755 });
  const streams = {};
  try {
    for (const name of ['stdout', 'stderr']) {
      const path = join(directory, `${prefix}.${name}.log`);
      streams[name] = { path, fd: openSync(path, 'wx', 0o644), hash: createHash('sha256'), observedBytes: 0, bytes: 0 };
    }
  } catch (error) {
    for (const stream of Object.values(streams)) closeSync(stream.fd);
    throw error;
  }
  const started = new Date().toISOString();
  let error;
  const child = spawn(executable, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const name of ['stdout', 'stderr']) {
    child[name].on('data', (chunk) => {
      const stream = streams[name];
      stream.observedBytes += chunk.length;
      const retained = chunk.subarray(0, Math.max(0, limit - stream.bytes));
      try {
        if (retained.length) {
          let written = 0;
          while (written < retained.length) {
            const count = writeSync(stream.fd, retained, written, retained.length - written);
            stream.hash.update(retained.subarray(written, written + count));
            stream.bytes += count;
            written += count;
          }
        }
      } catch (cause) {
        error ??= String(cause);
        child.kill('SIGTERM');
      }
    });
  }
  child.on('error', (cause) => { error ??= String(cause); });
  const completed = await new Promise((accept) => child.on('close', (exitCode, signal) => accept({ exitCode, signal })));
  const logs = {};
  for (const [name, stream] of Object.entries(streams)) {
    closeSync(stream.fd);
    logs[name] = { path: stream.path, bytes: stream.bytes, observedBytes: stream.observedBytes, truncated: stream.observedBytes > stream.bytes, sha256: stream.hash.digest('hex') };
  }
  const record = { executable, args, cwd, started, finished: new Date().toISOString(), ...completed, error: error ?? null, logs };
  if (testReport && completed.exitCode === 0 && !error) {
    try {
      const bytes = readFileSync(testReport);
      const report = JSON.parse(bytes);
      record.tests = {
        path: testReport, sha256: createHash('sha256').update(bytes).digest('hex'), success: report.success,
        total: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests, pending: report.numPendingTests, todo: report.numTodoTests,
      };
      if (report.success !== true || !Number.isInteger(report.numTotalTests) || report.numTotalTests < 1 || report.numFailedTests !== 0) record.error = 'Vitest JSON report did not record a successful nonempty suite';
    } catch (cause) { record.error = String(cause); }
  }
  console.log(`${basename(executable)}: exit=${record.exitCode} signal=${record.signal ?? 'none'}${record.tests ? ` tests=${record.tests.passed}/${record.tests.total}` : ''} logs=${directory}/${prefix} truncated=${Object.values(logs).some((log) => log.truncated)}`);
  return record;
}

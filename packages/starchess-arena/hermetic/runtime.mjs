// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase2.puml
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyDependencies } from './closure.mjs';
import { dependencyManifest, sha256, treeManifest } from './manifest.mjs';
import { outputTarget } from './policy.mjs';

const records = [];
const output = outputTarget;
const arena = '/app/packages/starchess-arena';
const tsx = `${arena}/node_modules/.bin/tsx`;

function execute(executable, args, cwd = '/app') {
  const started = new Date().toISOString();
  const result = spawnSync(executable, args, { cwd, stdio: 'inherit', env: process.env });
  records.push({ executable, args, cwd, started, finished: new Date().toISOString(), exitCode: result.status, signal: result.signal });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed: ${executable} (exit ${result.status}, signal ${result.signal})`);
}

function preflight() {
  if (process.getuid() !== 10001 || process.getgid() !== 10001) throw new Error('Runtime UID/GID mismatch');
  for (const path of ['/tmp/home', '/tmp/cache', '/tmp/config', '/tmp/data', '/tmp/pnpm']) mkdirSync(path, { recursive: true });
  const expected = JSON.parse(readFileSync('/hermetic-evidence/dependencies.json', 'utf8'));
  const actual = dependencyManifest();
  if (actual.installedSha256 !== expected.installedSha256 || actual.frozenStore.sha256 !== expected.frozenStore.sha256 || actual.tools.sha256 !== expected.tools.sha256) throw new Error('Dependency artifact manifest mismatch');
  const source = JSON.parse(readFileSync('/hermetic-evidence/source.json', 'utf8'));
  const observed = treeManifest('/app', { exclude: (path) => path.split('/').includes('node_modules') || path === '_spec/evidence/ml-adjutant-phase2' || path.startsWith('_spec/evidence/ml-adjutant-phase2/') });
  if (observed.sha256 !== source.sha256) throw new Error('Captured source manifest mismatch');
  return { dependencies: verifyDependencies(), installedSha256: actual.installedSha256, frozenStoreSha256: actual.frozenStore.sha256, toolsSha256: actual.tools.sha256, sourceSha256: source.sha256 };
}

function tests(name) {
  const directory = `/app/packages/${name}`;
  const config = `/tmp/${name}.vitest.mts`;
  writeFileSync(config, `import base from '${directory}/vitest.config.ts';\nexport default { ...base, cacheDir: '/tmp/cache/${name}', test: { ...base.test, cache: false } };\n`);
  execute(`${directory}/node_modules/.bin/vitest`, ['run', '--config', config, '--configLoader', 'native', '--maxWorkers', '2'], directory);
}

const [command = 'verify', ...args] = process.argv.slice(2);
if (!['preflight', 'verify', 'code'].includes(command)) throw new Error('Usage: runtime.mjs preflight | verify | code <captured .ts> [args]');
const assurance = preflight();
if (command === 'preflight') console.log(JSON.stringify(assurance, null, 2));
else if (command === 'code') {
  const [relative, ...codeArgs] = args;
  if (!relative || !relative.endsWith('.ts') || relative.startsWith('/') || relative.split('/').some((part) => ['..', 'node_modules', ''].includes(part))) throw new Error('Code command requires a captured repository-relative TypeScript file');
  const path = resolve('/app', relative);
  if (!existsSync(path)) throw new Error('Code file is not captured');
  execute(tsx, [path, ...codeArgs]);
} else {
  if (args.length) throw new Error('verify accepts no arguments');
  if (readdirSync(output).length) throw new Error('Verification requires a fresh empty output mount');
  try {
    execute(tsx, [`${arena}/src/cli/challenge.ts`, '--suite', 'all', '--rerun', '--out', `${output}/baseline-report.json`]);
    const baseline = JSON.parse(readFileSync(`${output}/baseline-report.json`, 'utf8'));
    if (baseline.rows?.length !== 54 || baseline.deterministicRerun?.comparisons?.length !== 54 || !baseline.executionIntegrity || baseline.deterministicRerun.equal !== true) throw new Error('Baseline did not verify 54 + 54 executions');
    execute(tsx, ['/app/scripts/challenge-contract-evidence.ts']);
    if (existsSync(`${output}/verification.json`)) throw new Error('Diagnostic must not publish verification.json before checks pass');
    for (const file of ['contract-report.json', 'pin-migration.json', 'coverage.json']) {
      if (!existsSync(`${output}/${file}`)) throw new Error(`Diagnostic did not generate ${file}`);
    }
    for (const name of ['starchess-core', 'starchess-arena']) execute(`/app/packages/${name}/node_modules/.bin/tsc`, ['-p', 'tsconfig.json', '--noEmit'], `/app/packages/${name}`);
    tests('starchess-core');
    tests('starchess-arena');
    const after = preflight();
    if (JSON.stringify(after) !== JSON.stringify(assurance)) throw new Error('Execution artifacts changed');
    const artifacts = readdirSync(output).sort().filter((file) => file !== 'verification.json').map((file) => ({ path: file, sha256: sha256(readFileSync(`${output}/${file}`)) }));
    writeFileSync(`${output}/verification.json`, JSON.stringify({ version: 'hermetic-verification-v1', passed: true, assurance, commands: records, artifacts }, null, 2) + '\n');
  } catch (error) {
    writeFileSync(`${output}/hermetic-failure.json`, JSON.stringify({ version: 1, passed: false, error: String(error), assurance, commands: records }, null, 2) + '\n');
    throw error;
  } finally {
    for (const file of readdirSync(output)) chmodSync(`${output}/${file}`, 0o644);
  }
}

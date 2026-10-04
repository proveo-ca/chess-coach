// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyDependencies } from './closure.mjs';
import { dependencyManifest, treeManifest } from './manifest.mjs';
import { outputTarget } from './policy.mjs';
import { runLogged } from './logged-command.mjs';
import { excludedSource, workspacePackages } from './workspace-policy.mjs';
import { verificationCommands, VERIFICATION_VERSION, ASSERTION_FLOORS_VERSION, VITEST_FLOORS } from './verification-plan.mjs';

const records = [];
const output = outputTarget;
const arena = '/app/packages/starchess-arena';
const tsx = `${arena}/node_modules/.bin/tsx`;

async function execute(executable, args, cwd = '/app', testReport) {
  const record = await runLogged(executable, args, { cwd, directory: `${output}/logs`, prefix: `command-${String(records.length + 1).padStart(2, '0')}`, testReport });
  records.push(record);
  if (record.error || record.exitCode !== 0) throw new Error(`Command failed: ${executable} (exit ${record.exitCode}, signal ${record.signal}); logs: ${output}/logs`);
}

export function initializeTemporaryDirectories() {
  for (const path of ['/tmp/opencode', '/tmp/home', '/tmp/cache', '/tmp/config', '/tmp/data', '/tmp/pnpm']) mkdirSync(path, { recursive: true });
}

function preflight() {
  if (process.getuid() !== 10001 || process.getgid() !== 10001) throw new Error('Runtime UID/GID mismatch');
  initializeTemporaryDirectories();
  const expected = JSON.parse(readFileSync('/hermetic-evidence/dependencies.json', 'utf8'));
  const actual = dependencyManifest();
  if (actual.installedSha256 !== expected.installedSha256 || actual.frozenStore.sha256 !== expected.frozenStore.sha256 || actual.tools.sha256 !== expected.tools.sha256) throw new Error('Dependency artifact manifest mismatch');
  const source = JSON.parse(readFileSync('/hermetic-evidence/source.json', 'utf8'));
  const observed = treeManifest('/app', { exclude: excludedSource });
  if (observed.sha256 !== source.sha256) throw new Error('Captured source manifest mismatch');
  return { dependencies: verifyDependencies(), installedSha256: actual.installedSha256, frozenStoreSha256: actual.frozenStore.sha256, toolsSha256: actual.tools.sha256, sourceSha256: source.sha256 };
}

function configureTests(name) {
  const directory = `/app/packages/${name}`;
  const config = `/tmp/${name}.vitest.mts`;
  writeFileSync(config, `import base from '${directory}/vitest.config.ts';\nexport default { ...base, cacheDir: '/tmp/cache/${name}', test: { ...base.test, cache: false } };\n`);
}

function makeEvidenceReadable() {
  for (const entry of treeManifest(output).entries) {
    if (entry.type === 'symlink') throw new Error('Symlink in output evidence');
    if (entry.path !== '.') chmodSync(`${output}/${entry.path}`, entry.type === 'directory' ? 0o755 : 0o644);
  }
}

export async function main(argv) {
  const [command = 'verify', ...args] = argv;
  if (!['preflight', 'verify', 'code'].includes(command)) throw new Error('Usage: runtime.mjs preflight | verify | code <captured .ts> [args]');
  const assurance = preflight();
  if (command === 'preflight') console.log(JSON.stringify(assurance, null, 2));
  else if (command === 'code') {
    const [relative, ...codeArgs] = args;
    if (!relative || !relative.endsWith('.ts') || relative.startsWith('/') || relative.split('/').some((part) => ['..', 'node_modules', ''].includes(part))) throw new Error('Code command requires a captured repository-relative TypeScript file');
    const path = resolve('/app', relative);
    if (!existsSync(path)) throw new Error('Code file is not captured');
    try { await execute(tsx, [path, ...codeArgs]); }
    catch (error) {
      writeFileSync(`${output}/hermetic-failure.json`, JSON.stringify({ passed: false, error: String(error), assurance, commands: records }, null, 2) + '\n');
      throw error;
    } finally { makeEvidenceReadable(); }
  } else {
    if (args.length) throw new Error('verify accepts no arguments');
    if (readdirSync(output).length) throw new Error('Verification requires a fresh empty output mount');
    try {
      for (const name of workspacePackages) configureTests(name);
      const plan = verificationCommands('/app');
      for (const [index, command] of plan.entries()) {
        await execute(command.executable, command.args, command.cwd, command.executable.endsWith('/vitest') ? command.args.at(-1) : undefined);
        if (index === 0) {
          const baseline = JSON.parse(readFileSync(`${output}/baseline-report.json`, 'utf8'));
          if (baseline.version !== 'phase2-baseline-report-v2' || baseline.pins?.version !== 'challenge-execution-pins-v3' || baseline.rows?.length !== 54 || baseline.deterministicRerun?.comparisons?.length !== 54 || baseline.executionIntegrity !== true || baseline.deterministicRerun.equal !== true) throw new Error('Baseline did not verify 54 + 54 executions');
        }
        if (index === 1) {
          if (existsSync(`${output}/verification.json`)) throw new Error('Diagnostic must not publish verification.json before checks pass');
          for (const file of ['contract-report.json', 'pin-migration.json', 'coverage.json', 'r2-composition-report.json']) {
            if (!existsSync(`${output}/${file}`)) throw new Error(`Diagnostic did not generate ${file}`);
          }
        }
        if (index === 10) {
          const bytes = readFileSync(records[index].logs.stdout.path);
          const closure = JSON.parse(bytes.toString('utf8'));
          if (closure.version !== 'public-closure-v1' || closure.passed !== true) throw new Error('Public closure did not pass');
          writeFileSync(`${output}/public-closure-report.json`, bytes, { flag: 'wx' });
        }
      }
      const after = preflight();
      if (JSON.stringify(after) !== JSON.stringify(assurance)) throw new Error('Execution artifacts changed');
      makeEvidenceReadable();
      const artifacts = treeManifest(output, { exclude: (path) => path === 'verification.json' }).entries.filter((entry) => entry.type === 'file');
      writeFileSync(`${output}/verification.json`, JSON.stringify({ version: VERIFICATION_VERSION, assertionFloorsVersion: ASSERTION_FLOORS_VERSION, assertionFloors: VITEST_FLOORS, passed: true, assurance, commands: records, artifacts }, null, 2) + '\n');
    } catch (error) {
      writeFileSync(`${output}/hermetic-failure.json`, JSON.stringify({ version: 1, passed: false, error: String(error), assurance, commands: records }, null, 2) + '\n');
      throw error;
    } finally {
      makeEvidenceReadable();
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => { console.error(String(error)); process.exitCode = 1; });
}

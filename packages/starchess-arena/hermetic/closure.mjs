// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import pins from './pins.json' with { type: 'json' };

export function verifyTools() {
  const actual = { node: process.versions.node, pnpm: execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim() };
  if (actual.node !== pins.node || actual.pnpm !== pins.pnpm) throw new Error('Tool version mismatch');
  return actual;
}

export function verifyDependencies() {
  const result = { tools: verifyTools(), packages: {}, lockSha256: createHash('sha256').update(readFileSync('/app/pnpm-lock.yaml')).digest('hex') };
  const capture = JSON.parse(readFileSync('/hermetic-evidence/capture.json', 'utf8'));
  for (const entry of capture.dependencyFiles) {
    if (createHash('sha256').update(readFileSync(`/app/${entry.path}`)).digest('hex') !== entry.sha256) throw new Error(`Frozen input changed: ${entry.path}`);
  }
  for (const name of ['starchess-core', 'starchess-arena']) {
    const require = createRequire(`/app/packages/${name}/package.json`);
    const manifest = JSON.parse(readFileSync(`/app/packages/${name}/package.json`, 'utf8'));
    const versions = {};
    for (const [dependency, specifier] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
      const resolved = `/app/packages/${name}/node_modules/${dependency}/package.json`;
      versions[dependency] = JSON.parse(readFileSync(resolved, 'utf8')).version;
      if (specifier === 'workspace:*' && realpathSync(resolved) !== '/app/packages/starchess-core/package.json') throw new Error('Workspace link mismatch');
    }
    execFileSync(`/app/packages/${name}/node_modules/.bin/tsc`, ['--version']);
    execFileSync(`/app/packages/${name}/node_modules/.bin/vitest`, ['--version']);
    result.packages[name] = versions;
  }
  const installed = readdirSync('/app/node_modules/.pnpm');
  if (installed.some((entry) => /^(nx@|@nx\+|workerd@|wrangler@|@storybook\+)/.test(entry))) throw new Error('Unrelated workspace dependency installed');
  if (existsSync('/app/node_modules/nx')) throw new Error('Root nx installed');
  const require = createRequire('/app/packages/starchess-arena/package.json');
  const esbuild = require(require.resolve('esbuild', { paths: [require.resolve('tsx/package.json')] }));
  esbuild.transformSync('const number: number = 1', { loader: 'ts' });
  return result;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = process.argv[2] === 'tools' ? verifyTools() : verifyDependencies();
  if (process.argv[2] === 'record') writeFileSync('/hermetic-evidence/closure.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}

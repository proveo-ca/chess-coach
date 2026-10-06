// SPEC: _spec/packages/starchess-training/candidate-generation.puml
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { workspacePackages, evidenceNamespace } from './workspace-policy.mjs';

export const VERIFICATION_VERSION = 'hermetic-verification-v3';
export const ASSERTION_FLOORS_VERSION = 'r2-assertion-floors-v3';
export const VITEST_FLOORS = Object.freeze({ 'vitest-starchess-core.json': 475, 'vitest-starchess-arena.json': 1914, 'vitest-starchess-training.json': 57 });
export const outputTarget = `/app/${evidenceNamespace}`;
export const requiredArtifacts = Object.freeze(['baseline-report.json', 'contract-report.json', 'coverage.json', 'pin-migration.json', 'r2-composition-report.json', 'public-closure-report.json', ...Object.keys(VITEST_FLOORS)]);

export function strictInputs(root) {
  const files = [];
  const walk = (relative) => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const path = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && /\.tsx?$/.test(entry.name)) files.push(`/app/${path}`);
      else if (entry.isSymbolicLink()) throw new Error(`Symlink in strict verification inputs: ${path}`);
    }
  };
  for (const name of workspacePackages.slice(0, 2)) walk(`packages/${name}/src/__tests__`);
  return [...files.sort(), '/app/scripts/challenge-contract-evidence.ts', '/app/scripts/challenge-validate-baseline.ts'];
}

export function verificationCommands(root) {
  const arena = '/app/packages/starchess-arena';
  return [
    { executable: `${arena}/node_modules/.bin/tsx`, cwd: '/app', args: [`${arena}/src/cli/challenge.ts`, '--suite', 'all', '--rerun', '--out', `${outputTarget}/baseline-report.json`] },
    { executable: `${arena}/node_modules/.bin/tsx`, cwd: '/app', args: ['/app/scripts/challenge-contract-evidence.ts'] },
    ...workspacePackages.map((name) => ({ executable: `/app/packages/${name}/node_modules/.bin/tsc`, cwd: `/app/packages/${name}`, args: ['-p', 'tsconfig.json', '--noEmit'] })),
    { executable: `${arena}/node_modules/.bin/tsc`, cwd: arena, args: ['--noEmit', '--allowImportingTsExtensions', '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--strict', '--skipLibCheck', ...strictInputs(root)] },
    ...workspacePackages.map((name) => ({ executable: `/app/packages/${name}/node_modules/.bin/vitest`, cwd: `/app/packages/${name}`, args: ['run', '--config', `/tmp/${name}.vitest.mts`, '--configLoader', 'native', '--maxWorkers', '2', '--reporter=default', '--reporter=json', '--outputFile', `${outputTarget}/vitest-${name}.json`] })),
    { executable: '/usr/local/bin/node', cwd: '/app', args: ['--test', `${arena}/hermetic/evidence-bundle.test.mjs`, `${arena}/hermetic/image-measurement.test.mjs`, `${arena}/hermetic/tar.test.mjs`] },
    { executable: '/usr/local/bin/node', cwd: '/app', args: ['/app/scripts/check-public-closure.mjs'] },
  ];
}

// SPEC: _spec/packages/starchess-training/candidate-generation.puml
export const workspacePackages = Object.freeze(['starchess-core', 'starchess-arena', 'starchess-training']);
export const workspaceTargets = Object.freeze(Object.fromEntries(workspacePackages.map((name) => [`@chess-coach/${name}`, `packages/${name}`])));
export const dependencyInputs = Object.freeze(['pnpm-lock.yaml', ...workspacePackages.map((name) => `packages/${name}/package.json`)]);
export const installedRoots = Object.freeze(['/app/node_modules', ...workspacePackages.map((name) => `/app/packages/${name}/node_modules`)]);
export const evidenceNamespace = '_spec/evidence/ml-adjutant-r2-refresh';
export const excludedSource = (path) => path.split('/').includes('node_modules') || path === evidenceNamespace || path.startsWith(`${evidenceNamespace}/`);
export function workspaceManifestTarget(name) {
  if (!Object.hasOwn(workspaceTargets, name)) throw new Error(`Unselected workspace dependency: ${name}`);
  return `/app/${workspaceTargets[name]}/package.json`;
}

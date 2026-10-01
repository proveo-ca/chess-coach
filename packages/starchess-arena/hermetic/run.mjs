// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { execFileSync } from 'node:child_process';
import { chmodSync, createReadStream, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareContext } from './context.mjs';
import { assertContainerPolicy, imagePattern, runArguments } from './policy.mjs';
import { runLogged } from './logged-command.mjs';
import pins from './pins.json' with { type: 'json' };

const temporaryRoot = '/tmp/opencode';
const json = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
function docker(args, inherit = false) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe', maxBuffer: 64 * 1024 * 1024 });
}
function host() {
  const version = JSON.parse(docker(['version', '--format', '{{json .}}']));
  const init = version.Server.Components.find((component) => component.Name === 'docker-init');
  if (init?.Version !== pins.dockerInit || init?.Details?.GitCommit !== pins.dockerInitGitCommit) throw new Error(`Host docker-init must be ${pins.dockerInit}@${pins.dockerInitGitCommit}; measured ${init?.Version}@${init?.Details?.GitCommit}`);
  if (version.Server.Os !== 'linux' || version.Server.Arch !== 'amd64') throw new Error('Requires Linux/amd64 Docker daemon');
  return version;
}
function inspectImage(image) {
  if (!imagePattern.test(image)) throw new Error('Expected immutable image ID');
  const [inspection] = JSON.parse(docker(['image', 'inspect', image]));
  if (inspection.Os !== 'linux' || inspection.Architecture !== 'amd64') throw new Error('Image platform mismatch');
  return inspection;
}
function freshWork(prefix) {
  if (!existsSync(temporaryRoot) || !lstatSync(temporaryRoot).isDirectory() || realpathSync(temporaryRoot) !== temporaryRoot) throw new Error('Verified /tmp/opencode parent is required');
  return mkdtempSync(join(temporaryRoot, prefix));
}
export function freshOutput(path) {
  const absolute = resolve(path);
  if (/[,\n\r]/.test(absolute)) throw new Error('Output path contains Docker mount delimiters');
  const parent = dirname(absolute);
  if (realpathSync(parent) !== parent) throw new Error('Output parent must have canonical ancestors');
  let privateParent = false;
  for (let ancestor = parent; ; ancestor = dirname(ancestor)) {
    const stat = lstatSync(ancestor);
    if (stat.isDirectory() && stat.uid === process.getuid() && (stat.mode & 0o077) === 0) privateParent = true;
    if (ancestor === dirname(ancestor)) break;
  }
  if (!privateParent) throw new Error('Output requires a private host-owned ancestor (mode 0700)');
  if (!existsSync(absolute)) mkdirSync(absolute, { mode: 0o777 });
  if (!lstatSync(absolute).isDirectory() || lstatSync(absolute).isSymbolicLink() || realpathSync(absolute) !== absolute || readdirSync(absolute).length) throw new Error('Output must be a fresh empty real directory');
  chmodSync(absolute, 0o777);
  return absolute;
}
function measurements(image) {
  const code = `const fs = require('node:fs'); const crypto = require('node:crypto'); const result = {}; for (const name of ['tools', 'dependencies', 'source', 'capture', 'closure']) { const file = '/hermetic-evidence/' + name + '.json'; if (!fs.existsSync(file)) continue; const bytes = fs.readFileSync(file); const value = JSON.parse(bytes); result[name] = { manifestSha256: crypto.createHash('sha256').update(bytes).digest('hex') }; if (name === 'tools' || name === 'closure') result[name].actual = value; if (name === 'dependencies') Object.assign(result[name], { installedSha256: value.installedSha256, frozenStoreSha256: value.frozenStore.sha256, toolTreeSha256: value.tools.sha256 }); if (name === 'source') result[name].sourceSha256 = value.sha256; if (name === 'capture') Object.assign(result[name], { inputs: value.dependencyFiles, controlSha256: value.control.sha256 }); } console.log(JSON.stringify(result));`;
  return JSON.parse(docker(['run', '--rm', '--pull=never', '--platform', pins.platform, '--network=none', '--read-only', '--user', '10001:10001',
    '--security-opt', 'no-new-privileges=true', '--cap-drop=ALL', '--cpus=2', '--memory=4g', '--memory-swap=4g', '--pids-limit=256',
    '--tmpfs', '/tmp:rw,nosuid,nodev,size=1073741824,mode=1777', '--entrypoint', 'node', image, '-e', code]));
}

export async function main(argv) {
  const [command, ...input] = argv;
  if (!command || command === '--help') {
    console.log('Usage: node packages/starchess-arena/hermetic/run.mjs build [--dependencies] [--from-dependencies sha256:...] | preflight --image sha256:... [--out empty-directory] | run --image sha256:... [--out empty-directory] [-- code repository-file.ts args...] | export --image sha256:...');
    return;
  }
  if (!['build', 'preflight', 'run', 'export'].includes(command)) throw new Error('Unsupported command');
  const options = {};
  let runtime = [];
  for (let i = 0; i < input.length; i++) {
    const arg = input[i];
    if (arg === '--') { runtime = input.slice(i + 1); break; }
    if (arg === '--dependencies') { options.dependencies = true; continue; }
    if (!['--image', '--out', '--from-dependencies'].includes(arg) || !input[i + 1] || input[i + 1].startsWith('--') || options[arg.slice(2)]) throw new Error(`Invalid option: ${arg}`);
    options[arg.slice(2)] = input[++i];
  }
  if (command !== 'build' && !options.image) throw new Error('--image is required');
  if (command !== 'build' && (options.dependencies || options['from-dependencies']) || command === 'build' && (options.image || options.out || runtime.length) ||
      command === 'export' && (options.out || runtime.length) || command === 'preflight' && runtime.length) throw new Error('Option does not apply to command');
  const observedHost = host();
  const work = freshWork(`starchess-hermetic-${command}-`);
  if (command === 'build') {
    const context = join(work, 'context');
    mkdirSync(context);
    const capture = prepareContext(context, options.dependencies === true);
    const iid = join(work, 'image-id');
    let frozenDependency;
    const extra = [];
    if (options['from-dependencies']) {
      const image = options['from-dependencies'];
      const inspection = inspectImage(image);
      const measured = measurements(image);
      if (measured.source || !measured.dependencies || measured.tools?.actual.node !== pins.node || measured.tools?.actual.pnpm !== pins.pnpm ||
          measured.closure?.actual.lockSha256 !== capture.dependencyFiles.find((entry) => entry.path === 'pnpm-lock.yaml').sha256 ||
          JSON.stringify(measured.capture?.inputs) !== JSON.stringify(capture.dependencyFiles) || measured.capture?.controlSha256 !== capture.control.sha256) throw new Error('Frozen dependency image does not match this source lock, manifests, tools, and hermetic infrastructure');
      const tag = `starchess-hermetic-dependencies:${image.slice(7)}`;
      docker(['image', 'tag', image, tag]);
      const [tagged] = JSON.parse(docker(['image', 'inspect', tag]));
      if (tagged.Id !== inspection.Id) throw new Error('Frozen dependency local tag mismatch');
      frozenDependency = { image, localBuildReference: tag, inspection, measurements: measured };
      extra.push('--network=none', '--build-arg', `FROZEN_DEPENDENCIES=${tag}`);
    }
    const target = options.dependencies ? frozenDependency ? 'frozen' : 'dependencies' : 'runtime';
    const args = ['build', '--platform', pins.platform, '--pull=false', '--target', target, ...extra, '--iidfile', iid, '--file', join(context, 'Dockerfile'), context];
    const buildLog = await runLogged('docker', args, { directory: work, prefix: 'build' });
    if (buildLog.error || buildLog.exitCode !== 0) {
      json(join(work, 'build-failure.json'), { passed: false, buildLog });
      throw new Error(`Docker build failed; logs: ${work}`);
    }
    const image = readFileSync(iid, 'utf8').trim();
    const measured = measurements(image);
    if (frozenDependency && measured.dependencies.manifestSha256 !== frozenDependency.measurements.dependencies.manifestSha256) throw new Error('Frozen dependency artifact changed during build');
    const envelope = { version: 1, kind: options.dependencies ? 'dependency-build' : 'source-image-build', image, pins, host: observedHost, buildArguments: args,
      imageInspection: inspectImage(image), measurements: measured, frozenDependency, capture, buildLog };
    json(join(work, 'build.json'), envelope);
    console.log(JSON.stringify({ image, evidence: join(work, 'build.json'), context }, null, 2));
    return;
  }
  const imageInspection = inspectImage(options.image);
  const measured = measurements(options.image);
  if (measured.tools?.actual.node !== pins.node || measured.tools?.actual.pnpm !== pins.pnpm ||
      measured.tools?.actual.pins.basePlatformDigest !== pins.basePlatformDigest) throw new Error('Image tool pins mismatch');
  const envelope = { version: 1, requestedCommand: command, runtimeCommand: runtime.length ? runtime : command === 'run' ? ['verify'] : null, image: options.image, pins, host: observedHost, imageInspection, measurements: measured };
  if (command === 'export') {
    const archive = join(work, 'image.tar');
    docker(['image', 'save', '--output', archive, options.image], true);
    const hash = createHash('sha256');
    for await (const bytes of createReadStream(archive)) hash.update(bytes);
    const digest = hash.digest('hex');
    writeFileSync(join(work, 'image.tar.sha256'), `${digest}  image.tar\n`);
    json(join(work, 'export.json'), { ...envelope, archive, archiveSha256: digest, archiveBytes: lstatSync(archive).size });
    console.log(JSON.stringify({ archive, sha256: digest, evidence: join(work, 'export.json') }, null, 2));
    return;
  }
  const dependencyPreflight = command === 'preflight' && !measured.source;
  if (!measured.source && !dependencyPreflight) throw new Error('Run requires a final frozen source image');
  if (!dependencyPreflight && (imageInspection.Config.User !== '10001:10001' || JSON.stringify(imageInspection.Config.Entrypoint) !== JSON.stringify(['node', '/app/packages/starchess-arena/hermetic/runtime.mjs']))) throw new Error('Final image runtime configuration mismatch');
  const output = freshOutput(options.out ?? join(work, 'output'));
  const args = runArguments(options.image, output, command === 'preflight' ? ['preflight'] : runtime.length ? runtime : ['verify']);
  if (dependencyPreflight) {
    args.splice(args.indexOf(options.image), 0, '--entrypoint', 'node');
    args.splice(args.indexOf(options.image) + 1, 1, '/hermetic/probe.mjs');
  }
  const container = docker(['create', ...args.slice(1)]).trim();
  const evidence = join(work, 'execution.json');
  let initialInspection;
  let finalInspection;
  let executionLog;
  let failure;
  try {
    [initialInspection] = JSON.parse(docker(['container', 'inspect', container]));
    assertContainerPolicy(initialInspection, output);
    if (initialInspection.Image !== imageInspection.Id) throw new Error('Container image ID mismatch');
    json(evidence, { ...envelope, output, container, arguments: args, initialContainerInspection: initialInspection, status: 'created', passed: false });
    executionLog = await runLogged('docker', ['start', '--attach', container], { directory: work, prefix: 'execution' });
    [finalInspection] = JSON.parse(docker(['container', 'inspect', container]));
    assertContainerPolicy(finalInspection, output);
    if (executionLog.error || executionLog.exitCode !== 0 || finalInspection.State.ExitCode !== 0 || finalInspection.State.OOMKilled || finalInspection.State.Error) throw new Error(`Container failed: ${JSON.stringify(finalInspection.State)}; logs: ${work}`);
  } catch (error) {
    failure = error;
  } finally {
    json(evidence, { ...envelope, output, container, arguments: args, initialContainerInspection: initialInspection, finalContainerInspection: finalInspection, executionLog, status: failure ? 'failed' : 'passed', passed: !failure, error: failure ? String(failure) : null });
    docker(['container', 'rm', container]);
  }
  console.log(JSON.stringify({ output, evidence, passed: !failure }, null, 2));
  if (failure) throw failure;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => { console.error(error); process.exitCode = 1; });
}

// SPEC: _spec/packages/starchess-arena/ml-adjutant-policy-contracts.puml
import { isAbsolute } from 'node:path';
import pins from './pins.json' with { type: 'json' };

export const outputTarget = '/app/_spec/evidence/ml-adjutant-phase2';
export const imagePattern = /^sha256:[0-9a-f]{64}$/;
export const tmpfsOptions = 'rw,nosuid,nodev,size=1073741824,mode=1777';

export function runArguments(image, output, command = ['verify']) {
  if (!imagePattern.test(image)) throw new Error('Use the immutable Docker image ID (sha256 + 64 hex digits)');
  if (!isAbsolute(output) || /[,\n\r]/.test(output)) throw new Error('Output must be an absolute path without mount grammar delimiters');
  if (!command.length || !['verify', 'preflight', 'code'].includes(command[0])) throw new Error('Unsupported runtime command');
  return [
    'run', '--pull=never', '--platform', pins.platform, '--init',
    '--network=none', '--read-only', '--user', '10001:10001',
    '--security-opt', 'no-new-privileges=true', '--cap-drop=ALL',
    '--cpus=2', '--memory=4g', '--memory-swap=4g', '--pids-limit=256',
    '--tmpfs', `/tmp:${tmpfsOptions}`,
    '--mount', `type=bind,source=${output},target=${outputTarget},bind-propagation=rprivate`,
    '--env', 'HERMETIC_OUTPUT_DIRECTORY=' + outputTarget,
    '--workdir', '/app', image, ...command,
  ];
}

export function assertContainerPolicy(inspect, validatedOutput) {
  const host = inspect.HostConfig;
  const config = inspect.Config;
  const binds = inspect.Mounts.filter((mount) => mount.Type === 'bind');
  if (host.NetworkMode !== 'none' || !host.ReadonlyRootfs || host.Privileged || !host.Init ||
      config.User !== '10001:10001' || host.NanoCpus !== 2_000_000_000 ||
      host.Memory !== 4 * 1024 ** 3 || host.MemorySwap !== host.Memory || host.PidsLimit !== 256 ||
      !host.CapDrop?.includes('ALL') || host.CapAdd?.length ||
      host.SecurityOpt?.length !== 1 || host.SecurityOpt[0] !== 'no-new-privileges=true' ||
      binds.length !== 1 || binds[0].Destination !== outputTarget || binds[0].Source !== validatedOutput || !binds[0].RW ||
      binds[0].Propagation !== 'rprivate' ||
      inspect.Mounts.length !== 2 || inspect.Mounts.some((mount) => !(
        (mount.Type === 'bind' && mount.Destination === outputTarget && mount.Source === validatedOutput && mount.RW === true) ||
        (mount.Type === 'tmpfs' && mount.Destination === '/tmp')
      )) ||
      Object.keys(host.Tmpfs ?? {}).join() !== '/tmp' || host.Tmpfs['/tmp'] !== tmpfsOptions) {
    throw new Error('Docker container policy mismatch');
  }
}

// SPEC: _spec/packages/starchess-training/r4-host-verification.puml
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blockedResult, diagnose, KIND, OPEN_GATES, parseArgs } from './r4-host-verify-lib.mjs';

export async function main(argv) {
  let options;
  try { options = parseArgs(argv); }
  catch (error) {
    return { exitCode: 2, result: { kind: KIND, status: 'INVALID_ARGUMENTS', diagnosticsComplete: false,
      checksPassed: false, r4Acceptance: 'NOT_ESTABLISHED', openGates: [...OPEN_GATES], errors: [error.message], commands: [] } };
  }
  if (options.mode === 'accept') return { exitCode: 2, result: blockedResult(options) };
  const controller = new AbortController();
  const interrupt = signal => controller.abort(signal);
  const sigint = () => interrupt('SIGINT');
  const sigterm = () => interrupt('SIGTERM');
  process.on('SIGINT', sigint);
  process.on('SIGTERM', sigterm);
  try {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const result = await diagnose(resolve(root), options, controller.signal);
    return { exitCode: result.checksPassed ? 0 : 1, result };
  } catch (error) {
    return { exitCode: 1, result: { kind: KIND, status: 'DIAGNOSTICS_FAILED', diagnosticsComplete: false,
      checksPassed: false, r4Acceptance: 'NOT_ESTABLISHED', openGates: [...OPEN_GATES], errors: [error.message], commands: [] } };
  } finally {
    process.removeListener('SIGINT', sigint);
    process.removeListener('SIGTERM', sigterm);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { exitCode, result } = await main(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exitCode = exitCode;
}

// SPEC: _spec/recovery.md
import { closeSync } from "node:fs";

const keepAlive = setInterval(() => {}, 60_000);
let received = false;
process.on("message", async message => {
  if (received) return;
  received = true;
  let exitCode = -1, failure: string | null = null;
  try {
    const { argv, cwd, environment } = message as { argv: string[]; cwd: string; environment: Record<string, string> };
    const child = Bun.spawn(argv, { cwd, env: environment, stdin: "ignore", stdout: "inherit", stderr: "inherit" });
    closeSync(1); closeSync(2);
    exitCode = await child.exited;
  } catch (error) {
    failure = String(error);
    for (const fd of [1, 2]) { try { closeSync(fd); } catch {} }
  }
  process.send?.({ kind: "command-exit", exitCode, failure });
});
process.on("disconnect", () => {
  clearInterval(keepAlive);
  try { process.kill(-process.pid, "SIGKILL"); } catch { process.exit(1); }
});

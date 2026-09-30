// SPEC: _spec/packages/starchess-arena/ml-adjutant-phase1.puml
import { randomUUID } from "node:crypto";
import { closeSync, fsyncSync, linkSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export const publishReport = (path: string, report: unknown): void => {
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  const fd = openSync(temporary, "wx", 0o600);
  try {
    writeFileSync(fd, `${JSON.stringify(report, null, 2)}\n`);
    fsyncSync(fd);
  } catch (error) {
    closeSync(fd);
    unlinkSync(temporary);
    throw error;
  }
  closeSync(fd);
  try { linkSync(temporary, path); }
  finally { unlinkSync(temporary); }
};

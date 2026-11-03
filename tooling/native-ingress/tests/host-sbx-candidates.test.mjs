// SPEC: _spec/tooling/bun-first-party-tooling.puml
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkedRecord, directoryFd, fileFd, MAX_FILE, MAX_RECORD, MAX_TOTAL, verify } from "../host-sbx-provenance-candidate.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const GUARD = path.join(ROOT, "host-sbx-guard-candidate.sh");
const PROVENANCE = path.join(ROOT, "host-sbx-provenance-candidate.mjs");
const READINESS = path.join(ROOT, "host-sbx-readiness.sh");
const INVENTORY = path.join(ROOT, "host-sbx-boundary-inventory.sh");
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const pin = (data) => ({ sha256: sha256(data), bytes: Buffer.byteLength(data) });
const recordFor = (inputs) => JSON.stringify({ schema: "f9-offline-bytes-v1", inputs });
let base, inputs, record, bin, marker, env, entries;

beforeEach(() => {
  base = fs.mkdtempSync("/tmp/opencode/host-sbx-candidates-");
  inputs = path.join(base, "inputs");
  record = path.join(base, "record.json");
  bin = path.join(base, "bin");
  marker = path.join(base, "called");
  fs.mkdirSync(inputs);
  fs.mkdirSync(bin);
  for (const name of ["sbx", "mise", "cargo", "systemctl", "sudo", "getent", "findmnt", "curl", ["py", "thon"].join(""), ["py", "thon3"].join(""), "preflight", "verifier"]) {
    fs.writeFileSync(path.join(bin, name), `#!${process.execPath}\nimport { appendFileSync } from "node:fs";\nappendFileSync(process.env.POISON_MARKER, "called\\n");\nprocess.exit(97);\n`, { mode: 0o755 });
  }
  fs.symlinkSync(process.execPath, path.join(bin, "bun"));
  env = { ...process.env, PATH: bin, POISON_MARKER: marker };
  entries = {};
  for (const [name, data] of [["source.bin", "source fixture"], ["tool.bin", "tool fixture"]]) {
    fs.writeFileSync(path.join(inputs, name), data);
    entries[name] = pin(data);
  }
  fs.writeFileSync(record, recordFor(entries));
});

afterEach(() => {
  mock.restore();
  try {
    expect(fs.existsSync(marker)).toBe(false);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

function run(command, options = {}) {
  const result = spawnSync(command[0], command.slice(1), { env, encoding: "utf8", timeout: 5000, ...options });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return result;
}

function invoke({ guard = false, source = inputs, trust = record, anchor = sha256(fs.readFileSync(trust)), offline = true, extra = [] } = {}) {
  const command = guard ? ["/usr/bin/bash", "-p", GUARD, "--offline-check"] : [process.execPath, PROVENANCE, ...(offline ? ["--offline-only"] : [])];
  return run([...command, "--inputs", source, "--trust-record", trust, "--expected-record-sha256", anchor, ...extra]);
}

function refused(result) {
  expect(result.status).toBe(2);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("STOP:");
  expect(result.stdout + result.stderr).not.toContain("PASS");
  expect(result.stdout + result.stderr).not.toContain("OFFLINE_PINNED_BYTES_ONLY");
}

function runnerArgs() {
  return ["--inputs", inputs, "--evidence", base, "--preflight", path.join(bin, "preflight"), "--verifier", path.join(bin, "verifier"), "--patch", path.join(base, "patch"), "--filter", "exec.exec_test_original_custody*"];
}

describe("offline candidate boundary", () => {
  test("inventory reports candidates without executing providers", () => {
    const result = run(["/usr/bin/bash", "--noprofile", "--norc", INVENTORY]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const lines = result.stdout.trimEnd().split("\n");
    expect(lines.shift()).toBe("F9_HOST_BOUNDARY_INVENTORY_V1");
    for (const [label, values] of [["UNIT_FILE", ["FILE_CANDIDATE", "UNSEEN"]], ["SLICE_FILE", ["FILE_CANDIDATE", "UNSEEN"]], ["HOME_DIR", ["DIRECTORY_CANDIDATE", "UNSEEN"]], ["RUNTIME_DIR", ["DIRECTORY_CANDIDATE", "UNSEEN"]]]) {
      expect(values.map((value) => `${label}=${value}`)).toContain(lines.shift());
    }
    expect(lines).toEqual(["INVENTORY=COMPLETE", "BOUNDARY=UNVERIFIED"]);
    refused(run(["/usr/bin/bash", "--noprofile", "--norc", INVENTORY, "unexpected"]));
  });

  test("readiness always stops despite claimed provider environment", () => {
    const result = run(["/usr/bin/bash", "-p", READINESS], { env: { ...env, F9_DEDICATED_USER: "candidate", F9_DEDICATED_UNIT: "candidate.service", F9_INPUTS: inputs, F9_EVIDENCE: base, F9_HOST_GUARD: path.join(bin, "sbx"), F9_PROVENANCE_VERIFIER: path.join(bin, "verifier") } });
    expect(result.status).toBe(2);
    expect(result.stdout).toContain("RESULT=STOP\n");
    expect(result.stdout).toContain("SBX=PATH_CANDIDATE\n");
    expect(result.stdout + result.stderr).not.toContain("PASS");
  });

  test("runner mode unconditionally refuses before all providers", () => {
    refused(run(["/usr/bin/bash", "-p", GUARD, ...runnerArgs()]));
    refused(run(["/usr/bin/bash", "-p", GUARD]));
    refused(run(["/usr/bin/bash", "-p", GUARD, ...runnerArgs(), "--offline-check"]));
    refused(run(["/usr/bin/bash", "-p", GUARD, ...runnerArgs().slice(0, -1), "different-filter"]));
  });

  test("old candidate pins never authenticate", () => {
    for (const pins of [{ linux: "a".repeat(64), llvm: "a".repeat(64), patch: "a".repeat(64), tools: "a".repeat(64), zig: "a".repeat(64) }, {}]) {
      fs.writeFileSync(record, JSON.stringify({ schema: "f9-host-sbx-candidate-v0", pins }));
      refused(invoke());
      refused(invoke({ trust: record, source: base }));
    }
  });

  test("comparator and guard return only the offline byte label", () => {
    for (const guard of [false, true]) {
      const result = invoke({ guard });
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toBe("OFFLINE_PINNED_BYTES_ONLY\n");
    }
    refused(run(["/usr/bin/bash", "-p", GUARD, ...runnerArgs()]));
  });

  test("offline mode and exact CLI arguments remain mandatory", () => {
    refused(invoke({ offline: false }));
    refused(invoke({ extra: ["--allow-vm"] }));
    refused(invoke({ extra: ["positional"] }));
    refused(invoke({ guard: true, extra: ["extra"] }));
    refused(run([process.execPath, PROVENANCE, "--offline-only"]));
    const alias = path.join(base, "guard");
    fs.symlinkSync(GUARD, alias);
    refused(run(["/usr/bin/bash", "-p", alias, "--offline-check", "--inputs", inputs, "--trust-record", record, "--expected-record-sha256", sha256(fs.readFileSync(record))]));
  });

  test("tampered bytes, size, exact file set and wrong raw record pin refuse", () => {
    fs.writeFileSync(path.join(inputs, "source.bin"), "source fixturE");
    refused(invoke({ guard: true }));
    fs.writeFileSync(path.join(inputs, "source.bin"), "source fixture!");
    refused(invoke());
    fs.writeFileSync(path.join(inputs, "source.bin"), "source fixture");
    fs.writeFileSync(path.join(inputs, "extra"), "unlisted");
    refused(invoke());
    fs.unlinkSync(path.join(inputs, "extra"));
    fs.unlinkSync(path.join(inputs, "source.bin"));
    refused(invoke());
    fs.writeFileSync(path.join(inputs, "source.bin"), "source fixture");
    refused(invoke({ anchor: "0".repeat(64) }));
    refused(invoke({ anchor: "A".repeat(64) }));
    refused(invoke({ anchor: `${sha256(fs.readFileSync(record))}\n` }));
    const oldPin = sha256(fs.readFileSync(record));
    fs.appendFileSync(record, "\n");
    refused(invoke({ anchor: oldPin }));
    expect(invoke().status).toBe(0);
  });

  test("canonical absolute paths and an external record are mandatory", () => {
    for (const source of ["inputs", `${inputs}/`, `${base}//inputs`, `${base}/./inputs`, `${inputs}/../inputs`, "/"]) refused(invoke({ source }));
    for (const trust of ["record.json", `${base}/./record.json`, `${base}//record.json`]) refused(invoke({ trust, anchor: sha256(fs.readFileSync(record)) }));
    const inside = path.join(inputs, "record.json");
    fs.copyFileSync(record, inside);
    refused(invoke({ trust: inside }));
    refused(invoke({ trust: inputs, anchor: "0".repeat(64) }));
    expect(() => verify(`${inputs}\0`, record, "0".repeat(64))).toThrow("use canonical absolute paths");
  });

  test("symlinks at leaf and ancestor components refuse for inputs and record", () => {
    const alias = path.join(base, "alias");
    fs.symlinkSync(inputs, alias);
    refused(invoke({ source: alias }));
    const rootAlias = path.join(base, "root-alias");
    fs.symlinkSync(base, rootAlias);
    refused(invoke({ source: path.join(rootAlias, "inputs") }));
    refused(invoke({ trust: path.join(rootAlias, "record.json") }));
    const recordAlias = path.join(base, "record-alias.json");
    fs.symlinkSync(record, recordAlias);
    refused(invoke({ trust: recordAlias }));
    fs.unlinkSync(path.join(inputs, "tool.bin"));
    fs.symlinkSync(record, path.join(inputs, "tool.bin"));
    refused(invoke());
    fs.unlinkSync(path.join(inputs, "tool.bin"));
    fs.mkdirSync(path.join(inputs, "tool.bin"));
    refused(invoke());
    refused(invoke({ trust: base, anchor: "0".repeat(64) }));
  });

  test("empty files, binary bytes and multichunk files compare exactly", () => {
    for (const name of Object.keys(entries)) fs.unlinkSync(path.join(inputs, name));
    const data = Buffer.alloc(2 * 1024 * 1024 + 17, 0xff);
    data[1024 * 1024] = 0;
    fs.writeFileSync(path.join(inputs, "binary"), data);
    fs.writeFileSync(path.join(inputs, "empty"), "");
    fs.writeFileSync(record, recordFor({ binary: pin(data), empty: pin("") }));
    expect(invoke().status).toBe(0);
    data[1024 * 1024] = 1;
    fs.writeFileSync(path.join(inputs, "binary"), data);
    refused(invoke());
  });

  test("32 inputs and an 8192-byte record succeed, one extra byte refuses", () => {
    for (const name of Object.keys(entries)) fs.unlinkSync(path.join(inputs, name));
    const pins = {};
    for (let i = 0; i < 32; i++) {
      fs.writeFileSync(path.join(inputs, `f${i}`), "");
      pins[`f${i}`] = pin("");
    }
    const data = recordFor(pins);
    fs.writeFileSync(record, data.padEnd(MAX_RECORD, " "));
    expect(invoke().status).toBe(0);
    fs.appendFileSync(record, " ");
    refused(invoke());
  });
});

describe("strict bounded JSON records", () => {
  test("duplicate decoded keys refuse at every object level", () => {
    const hash = "a".repeat(64);
    for (const data of [
      '{"schema":"f9-offline-bytes-v1","inputs":{},"inputs":{}}',
      '{"schema":"f9-offline-bytes-v1","schema":"f9-offline-bytes-v1","inputs":{}}',
      String.raw`{"schema":"f9-offline-bytes-v1","inputs":{},"\u0069nputs":{}}`,
      `{"schema":"f9-offline-bytes-v1","inputs":{"a":{"sha256":"${hash}","bytes":0},"a":{"sha256":"${hash}","bytes":0}}}`,
      String.raw`{"schema":"f9-offline-bytes-v1","inputs":{"a":{"sha256":"${hash}","bytes":0},"\u0061":{"sha256":"${hash}","bytes":0}}}`,
      String.raw`{"schema":"f9-offline-bytes-v1","inputs":{"a":{"sha256":"${hash}","bytes":0,"\u0062ytes":0}}}`,
      `{"schema":"f9-offline-bytes-v1","inputs":{"a":{"sha256":"${hash}","sha256":"${hash}","bytes":0}}}`,
    ]) {
      fs.writeFileSync(record, data);
      refused(invoke());
      expect(() => checkedRecord(Buffer.from(data))).toThrow("duplicate record key");
    }
  });

  test("sizes must be bounded literal JSON integers", () => {
    for (const value of ["true", "false", "null", '"1"', "{}", "[]", "1.0", "1e0", "1E+0", "0.0", "0e0", "-1", "2147483649", "9007199254740993", "1e999", "NaN", "Infinity", "+1", "01"]) {
      fs.writeFileSync(record, `{"schema":"f9-offline-bytes-v1","inputs":{"source.bin":{"sha256":"${sha256("source fixture")}","bytes":${value}}}}`);
      refused(invoke());
    }
    expect(checkedRecord(Buffer.from(recordFor({ a: { sha256: "a".repeat(64), bytes: MAX_FILE }, b: { sha256: "b".repeat(64), bytes: MAX_TOTAL - MAX_FILE } }))).a.bytes).toBe(MAX_FILE);
    expect(() => checkedRecord(Buffer.from(recordFor({ a: { sha256: "a".repeat(64), bytes: MAX_FILE }, b: { sha256: "b".repeat(64), bytes: MAX_FILE }, c: { sha256: "c".repeat(64), bytes: 1 } })))).toThrow("input limit exceeded");
  });

  test("exact schema, entry keys, input count, names and hashes refuse invalid values", () => {
    const good = { schema: "f9-offline-bytes-v1", inputs: entries };
    const invalid = [null, [], 1, true, {}, { inputs: entries }, { schema: good.schema }, { ...good, allow_vm: true }, { ...good, schema: "other" }, { ...good, inputs: {} }, { ...good, inputs: [] }, { ...good, inputs: null }, { ...good, inputs: 1 }, { ...good, inputs: Object.fromEntries(Array.from({ length: 33 }, (_, i) => [`f${i}`, pin("")])) }];
    for (const name of ["", ".", "..", "../file", "a/b", "a\\b", "-file", "a".repeat(129), "a\n", "é"]) invalid.push({ ...good, inputs: { [name]: pin("") } });
    for (const entry of [null, [], 0, { sha256: "a".repeat(64) }, { bytes: 0 }, { ...pin(""), extra: true }, { bytes: 0, sha256: "A".repeat(64) }, { bytes: 0, sha256: `${"a".repeat(64)}\n` }, { bytes: 0, sha256: 1 }]) invalid.push({ ...good, inputs: { a: entry } });
    for (const hash of ["", "a".repeat(63), "a".repeat(65), "g".repeat(64)]) invalid.push({ ...good, inputs: { a: { bytes: 0, sha256: hash } } });
    for (const value of invalid) {
      fs.writeFileSync(record, JSON.stringify(value));
      refused(invoke());
    }
  });

  test("malformed JSON and invalid UTF-8 refuse", () => {
    for (const data of [Buffer.from(""), Buffer.from("{no}"), Buffer.from(`${recordFor(entries)} garbage`), Buffer.from('{"schema":"f9-offline-bytes-v1","inputs":{},}'), Buffer.from([0xff, 0xfe, 0xff]), Buffer.from('{"a":"\\x41"}'), Buffer.from("[".repeat(100) + "0" + "]".repeat(100))]) {
      fs.writeFileSync(record, data);
      refused(invoke());
    }
  });

  test("escaped keys decode and prototype-like names remain ordinary input names", () => {
    const data = String.raw`{"schema":"f9-offline-bytes-v1","inputs":{"\u0061":{"sha256":"${sha256("")}","\u0062ytes":0},"constructor":{"sha256":"${sha256("")}","bytes":0}}}`;
    expect(Object.keys(checkedRecord(Buffer.from(data)))).toEqual(["a", "constructor"]);
  });

  test("maximum-length names and negative zero remain valid integer pins", () => {
    const name = "a".repeat(128);
    const data = `{"schema":"f9-offline-bytes-v1","inputs":{"${name}":{"sha256":"${sha256("")}","bytes":-0}}}`;
    expect(checkedRecord(Buffer.from(data))[name].bytes === 0).toBe(true);
  });
});

describe("descriptor-relative bounded reads", () => {
  test("every proc-relative open retains its parent and sets nofollow flags", () => {
    const open = fs.openSync;
    let directories = 0, files = 0;
    spyOn(fs, "openSync").mockImplementation((target, flags, ...args) => {
      const match = /^\/proc\/self\/fd\/(\d+)\//.exec(String(target));
      if (match) {
        expect(fs.fstatSync(Number(match[1])).isDirectory()).toBe(true);
        expect(flags & fs.constants.O_NOFOLLOW).not.toBe(0);
        if (flags & fs.constants.O_DIRECTORY) directories++;
        else {
          files++;
          expect(flags & fs.constants.O_NONBLOCK).not.toBe(0);
        }
      }
      return open(target, flags, ...args);
    });
    verify(inputs, record, sha256(fs.readFileSync(record)));
    expect(directories).toBeGreaterThan(0);
    expect(files).toBe(3);
  });

  test.each(["input ancestor", "record ancestor", "input directory"])("holds the original descriptor after renaming %s", (kind) => {
    const container = path.join(base, "container");
    fs.mkdirSync(container);
    let source = inputs, trust = record;
    let target;
    if (kind === "input ancestor") {
      source = path.join(container, "inputs");
      fs.renameSync(inputs, source);
      target = container;
    } else if (kind === "record ancestor") {
      trust = path.join(container, "record.json");
      fs.renameSync(record, trust);
      target = container;
    } else target = inputs;
    const anchor = sha256(fs.readFileSync(trust));
    const open = fs.openSync;
    let moved = false;
    spyOn(fs, "openSync").mockImplementation((name, flags, ...args) => {
      const fd = open(name, flags, ...args);
      if (!moved && (flags & fs.constants.O_DIRECTORY) && fs.readlinkSync(`/proc/self/fd/${fd}`) === target) {
        moved = true;
        fs.renameSync(target, `${target}-moved`);
        fs.symlinkSync(bin, target);
      }
      return fd;
    });
    expect(() => verify(source, trust, anchor)).not.toThrow();
    expect(moved).toBe(true);
  });

  test("record growth after fstat stays within 8193 bytes and refuses", () => {
    const read = fs.readSync;
    let requested = 0, grown = false;
    spyOn(fs, "readSync").mockImplementation((fd, buffer, offset, length, position) => {
      if (fs.readlinkSync(`/proc/self/fd/${fd}`) === record) {
        if (!grown) {
          grown = true;
          fs.appendFileSync(record, " ".repeat(MAX_RECORD));
        }
        requested += length;
      }
      return read(fd, buffer, offset, length, position);
    });
    expect(() => verify(inputs, record, sha256(fs.readFileSync(record)))).toThrow("record too large");
    expect(requested).toBe(MAX_RECORD + 1);
  });

  test.each(["grow", "shrink"])("input %s after fstat refuses with bounded reads", (operation) => {
    const target = path.join(inputs, "source.bin");
    const read = fs.readSync;
    const anchor = sha256(fs.readFileSync(record));
    let changed = false, maximum = 0;
    spyOn(fs, "readSync").mockImplementation((fd, buffer, offset, length, position) => {
      if (fs.readlinkSync(`/proc/self/fd/${fd}`) === target) {
        maximum = Math.max(maximum, length);
        if (!changed) {
          changed = true;
          if (operation === "grow") fs.appendFileSync(target, "!");
          else fs.truncateSync(target, 1);
        }
      }
      return read(fd, buffer, offset, length, position);
    });
    expect(() => verify(inputs, record, anchor)).toThrow(operation === "grow" ? "input size changed" : "input digest mismatch");
    expect(changed).toBe(true);
    expect(maximum).toBeLessThanOrEqual(entries["source.bin"].bytes + 1);
  });

  test("oversized sparse record refuses before reading", () => {
    fs.truncateSync(record, MAX_RECORD + 1);
    const read = spyOn(fs, "readSync");
    expect(() => verify(inputs, record, "0".repeat(64))).toThrow("record too large");
    expect(read).not.toHaveBeenCalled();
  });

  test("short record reads accumulate all raw bytes before comparison", () => {
    const anchor = sha256(fs.readFileSync(record));
    const read = fs.readSync;
    spyOn(fs, "readSync").mockImplementation((fd, buffer, offset, length, position) => read(fd, buffer, offset, Math.min(length, 3), position));
    expect(() => verify(inputs, record, anchor)).not.toThrow();
  });

  test("refusal paths close every descriptor opened by the comparator", () => {
    const opened = new Set();
    const open = fs.openSync;
    const close = fs.closeSync;
    const anchor = sha256(fs.readFileSync(record));
    spyOn(fs, "openSync").mockImplementation((...args) => {
      const fd = open(...args);
      opened.add(fd);
      return fd;
    });
    spyOn(fs, "closeSync").mockImplementation((fd) => {
      close(fd);
      opened.delete(fd);
    });
    const alias = path.join(base, "alias");
    fs.symlinkSync(inputs, alias);
    expect(() => verify(alias, record, anchor)).toThrow();
    expect(opened.size).toBe(0);
    fs.writeFileSync(path.join(inputs, "source.bin"), "source fixturE");
    expect(() => verify(inputs, record, anchor)).toThrow("input digest mismatch");
    expect(opened.size).toBe(0);
    fs.unlinkSync(path.join(inputs, "source.bin"));
    fs.mkdirSync(path.join(inputs, "source.bin"));
    expect(() => verify(inputs, record, anchor)).toThrow("not a regular file");
    expect(opened.size).toBe(0);
    fs.truncateSync(record, MAX_RECORD + 1);
    expect(() => verify(inputs, record, anchor)).toThrow("record too large");
    expect(opened.size).toBe(0);
  });

  test("file descriptor helpers refuse invalid names and nonregular entries", () => {
    const fd = directoryFd(inputs);
    try {
      for (const name of [".", "..", "../record.json", "a/b", "a\n"]) expect(() => fileFd(fd, name)).toThrow("invalid file name");
      fs.mkdirSync(path.join(inputs, "directory"));
      expect(() => fileFd(fd, "directory")).toThrow("not a regular file");
    } finally {
      fs.closeSync(fd);
    }
  });
});

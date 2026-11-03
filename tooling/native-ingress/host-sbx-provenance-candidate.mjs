#!/usr/bin/env bun
// SPEC: _spec/tooling/bun-first-party-tooling.puml
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

export const MAX_RECORD = 8192;
export const MAX_FILE = 2 * 1024 ** 3;
export const MAX_TOTAL = 4 * 1024 ** 3;
const NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}(?![\s\S])/;
const DIGEST = /^[0-9a-f]{64}(?![\s\S])/;
const DIRECTORY_FLAGS = fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW;
const FILE_FLAGS = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK;

class JsonNumber {
  constructor(token) {
    this.token = token;
  }
}

function uniqueJson(data) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  JSON.parse(text);
  let offset = 0;
  const whitespace = () => {
    while (/[\t\n\r ]/.test(text[offset] ?? "!")) offset++;
  };
  const string = () => {
    const start = offset++;
    while (text[offset] !== '"') {
      if (text[offset] === "\\") offset++;
      offset++;
    }
    offset++;
    return JSON.parse(text.slice(start, offset));
  };
  const value = (depth) => {
    if (depth > 8) throw new Error("unexpected record nesting");
    whitespace();
    if (text[offset] === '"') return string();
    if (text[offset] === "{" || text[offset] === "[") {
      const object = text[offset++] === "{";
      const result = object ? Object.create(null) : [];
      const end = object ? "}" : "]";
      whitespace();
      while (text[offset] !== end) {
        if (object) {
          const key = string();
          if (Object.hasOwn(result, key)) throw new Error("duplicate record key");
          whitespace();
          offset++;
          result[key] = value(depth + 1);
        } else {
          result.push(value(depth + 1));
        }
        whitespace();
        if (text[offset] !== ",") break;
        offset++;
        whitespace();
      }
      offset++;
      return result;
    }
    const start = offset;
    while (offset < text.length && !/[\t\n\r ,}\]]/.test(text[offset])) offset++;
    const token = text.slice(start, offset);
    if (token === "null") return null;
    if (token === "true") return true;
    if (token === "false") return false;
    return new JsonNumber(token);
  };
  return value(0);
}

function objectWithKeys(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && !(value instanceof JsonNumber) && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function validName(name) {
  return typeof name === "string" && NAME.test(name) && name !== "." && name !== "..";
}

function canonicalAbsolute(value) {
  return typeof value === "string" && !value.includes("\0") && path.isAbsolute(value)
    && path.normalize(value) === value && (value === "/" || !value.endsWith("/"));
}

export function directoryFd(directory) {
  if (!canonicalAbsolute(directory)) throw new Error("use a canonical absolute path");
  let fd = fs.openSync("/", DIRECTORY_FLAGS);
  try {
    for (const component of directory.split("/").slice(1).filter(Boolean)) {
      const next = fs.openSync(`/proc/self/fd/${fd}/${component}`, DIRECTORY_FLAGS);
      fs.closeSync(fd);
      fd = next;
    }
    return fd;
  } catch (error) {
    fs.closeSync(fd);
    throw error;
  }
}

export function fileFd(parent, name) {
  if (!validName(name)) throw new Error("invalid file name");
  const fd = fs.openSync(`/proc/self/fd/${parent}/${name}`, FILE_FLAGS);
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error("not a regular file");
    return fd;
  } catch (error) {
    fs.closeSync(fd);
    throw error;
  }
}

function readRecord(parent, name) {
  const fd = fileFd(parent, name);
  try {
    if (fs.fstatSync(fd).size > MAX_RECORD) throw new Error("record too large");
    const data = Buffer.alloc(MAX_RECORD + 1);
    let count = 0;
    while (count < data.length) {
      const size = fs.readSync(fd, data, count, data.length - count, null);
      if (size === 0) break;
      count += size;
    }
    if (count > MAX_RECORD) throw new Error("record too large");
    return data.subarray(0, count);
  } finally {
    fs.closeSync(fd);
  }
}

export function checkedRecord(data) {
  if (data.length > MAX_RECORD) throw new Error("record too large");
  const record = uniqueJson(data);
  if (!objectWithKeys(record, ["schema", "inputs"])) throw new Error("unexpected record shape");
  const entries = record.inputs;
  if (record.schema !== "f9-offline-bytes-v1" || entries === null || typeof entries !== "object"
    || Array.isArray(entries) || entries instanceof JsonNumber
    || Object.keys(entries).length < 1 || Object.keys(entries).length > 32) {
    throw new Error("unsupported record");
  }
  let total = 0;
  for (const [name, entry] of Object.entries(entries)) {
    if (!validName(name)) throw new Error("invalid input name");
    if (!objectWithKeys(entry, ["sha256", "bytes"])) throw new Error("invalid input entry");
    const size = entry.bytes;
    if (!(size instanceof JsonNumber) || !/^-?(?:0|[1-9][0-9]*)$/.test(size.token)
      || !Number.isSafeInteger(Number(size.token)) || Number(size.token) < 0 || Number(size.token) > MAX_FILE
      || typeof entry.sha256 !== "string" || !DIGEST.test(entry.sha256)) {
      throw new Error("invalid input pin");
    }
    entry.bytes = Number(size.token);
    total += entry.bytes;
  }
  if (total > MAX_TOTAL) throw new Error("input limit exceeded");
  return entries;
}

export function verify(inputs, recordPath, expected) {
  if (typeof expected !== "string" || !DIGEST.test(expected)) throw new Error("invalid expected record digest");
  if (!canonicalAbsolute(inputs) || !canonicalAbsolute(recordPath)) throw new Error("use canonical absolute paths");
  if (recordPath === inputs || recordPath.startsWith(inputs === "/" ? "/" : `${inputs}/`)) {
    throw new Error("trust record must be outside inputs");
  }
  const recordDir = directoryFd(path.dirname(recordPath));
  let data;
  try {
    data = readRecord(recordDir, path.basename(recordPath));
  } finally {
    fs.closeSync(recordDir);
  }
  if (createHash("sha256").update(data).digest("hex") !== expected) throw new Error("record digest mismatch");
  const entries = checkedRecord(data);
  const inputDir = directoryFd(inputs);
  try {
    const files = fs.readdirSync(`/proc/self/fd/${inputDir}`);
    if (files.length !== Object.keys(entries).length || files.some((name) => !Object.hasOwn(entries, name))) {
      throw new Error("input file set mismatch");
    }
    const buffer = Buffer.alloc(1024 * 1024);
    for (const [name, entry] of Object.entries(entries)) {
      const fd = fileFd(inputDir, name);
      try {
        if (fs.fstatSync(fd).size !== entry.bytes) throw new Error("input size mismatch");
        const digest = createHash("sha256");
        let count = 0;
        while (true) {
          const size = fs.readSync(fd, buffer, 0, Math.min(buffer.length, entry.bytes - count + 1), null);
          if (size === 0) break;
          count += size;
          if (count > entry.bytes) throw new Error("input size changed");
          digest.update(buffer.subarray(0, size));
        }
        if (count !== entry.bytes || digest.digest("hex") !== entry.sha256) throw new Error("input digest mismatch");
      } finally {
        fs.closeSync(fd);
      }
    }
  } finally {
    fs.closeSync(inputDir);
  }
}

function main() {
  try {
    const { values } = parseArgs({
      options: {
        inputs: { type: "string" },
        "trust-record": { type: "string" },
        "expected-record-sha256": { type: "string" },
        "offline-only": { type: "boolean" },
      },
      strict: true,
      allowPositionals: false,
    });
    if (!values["offline-only"] || !values.inputs || !values["trust-record"] || !values["expected-record-sha256"]) {
      throw new Error("required offline-only arguments missing");
    }
    verify(values.inputs, values["trust-record"], values["expected-record-sha256"]);
    console.log("OFFLINE_PINNED_BYTES_ONLY");
    return 0;
  } catch (error) {
    console.error(`STOP: ${error.message}`);
    return 2;
  }
}

if (import.meta.main) process.exitCode = main();

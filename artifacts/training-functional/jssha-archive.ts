// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import type { ArchiveSpec, Inspection, Selected } from "../../_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/package-acquisition-bun-source2/capture.ts";

const CAPS = Object.freeze({ archive: 2 ** 21, expanded: 2 ** 23, selected: 2 ** 23, headers: 256 });
const utf8 = new TextDecoder("utf-8", { fatal: true });
function requireThat(condition: unknown, code: string): asserts condition { if (!condition) throw new Error(code); }
function sri(data: Uint8Array): string { return `sha512-${createHash("sha512").update(data).digest("base64")}`; }
function object(value: unknown): Record<string, unknown> {
  requireThat(value !== null && typeof value === "object" && !Array.isArray(value), "object-required");
  return value as Record<string, unknown>;
}
function field(block: Buffer, start: number, length: number): string {
  const bytes = block.subarray(start, start + length), nul = bytes.indexOf(0);
  if (nul >= 0) requireThat(bytes.subarray(nul).every(b => b === 0), "tar-field-tail");
  return utf8.decode(nul < 0 ? bytes : bytes.subarray(0, nul));
}
function octal(block: Buffer, start: number, length: number): number {
  const bytes = block.subarray(start, start + length);
  if ((start === 108 || start === 116) && length === 8 && bytes.length === 8 && bytes.every(b => b === 0)) return 0;
  requireThat(bytes.every(b => b < 128), "tar-octal");
  const match = /^ *([0-7]+)[\0 ]*$/.exec(bytes.toString("ascii"));
  requireThat(match !== null, "tar-octal");
  const n = parseInt(match[1]!, 8);
  requireThat(Number.isSafeInteger(n) && n >= 0, "tar-number"); return n;
}
function safeMember(path: string): void {
  const parts = path.split("/");
  requireThat(path.length > 0 && !path.startsWith("/") && !path.includes("\\") && !path.includes("\0") && parts.every((p, i) => p !== "." && p !== ".." && (p !== "" || i === parts.length - 1)), "tar-path");
}
function pax(data: Buffer): Map<string, string> {
  const result = new Map<string, string>();
  let at = 0;
  while (at < data.length) {
    const space = data.indexOf(32, at);
    requireThat(space > at && space - at <= 10, "pax-length");
    const originalDigits = data.subarray(at, space);
    requireThat(originalDigits.every(b => b >= 48 && b <= 57), "pax-length-ascii");
    const digits = originalDigits.toString("ascii");
    requireThat(/^[1-9][0-9]*$/.test(digits), "pax-length");
    const length = Number(digits), end = at + length;
    requireThat(Number.isSafeInteger(length) && end <= data.length && end > space + 2 && data[end - 1] === 10, "pax-bounds");
    const entry = utf8.decode(data.subarray(space + 1, end - 1)), equals = entry.indexOf("=");
    requireThat(equals > 0, "pax-entry");
    const key = entry.slice(0, equals), value = entry.slice(equals + 1);
    requireThat(["path", "size", "mtime", "atime", "ctime", "uid", "gid", "uname", "gname"].includes(key) && !result.has(key) && !value.includes("\0") && value !== "", "pax-unsupported-or-duplicate");
    result.set(key, value); at = end;
  }
  return result;
}
export function inspectVerifiedArchive(bytes: Buffer, spec: ArchiveSpec): Inspection {
  requireThat(bytes.length <= CAPS.archive && sri(bytes) === spec.integrity, "sri-before-inflate");
  let tar: Buffer;
  try { tar = gunzipSync(bytes, { maxOutputLength: CAPS.expanded + 1 }); } catch { throw new Error("gzip-invalid-or-expanded-cap"); }
  requireThat(tar.length <= CAPS.expanded && tar.length % 512 === 0, "expanded-or-block-cap");
  const candidates = new Set([...spec.requiredMembers.map(m => m.member), ...spec.optionalLicenseMembersInPreferenceOrder]);
  const selected = new Map<string, Buffer>(), physicalSelected = new Set<string>();
  let offset = 0, headers = 0, ended = false, local: Map<string, string> | undefined, longname: string | undefined;
  while (offset < tar.length) {
    const h = tar.subarray(offset, offset + 512);
    if (h.every(b => b === 0)) {
      requireThat(offset + 1024 <= tar.length && tar.subarray(offset).every(b => b === 0) && !local && longname === undefined, "tar-terminator");
      ended = true; break;
    }
    requireThat(++headers <= CAPS.headers, "physical-header-cap");
    const checksum = octal(h, 148, 8);
    requireThat(checksum === h.reduce((sum, b, i) => sum + (i >= 148 && i < 156 ? 32 : b), 0), "tar-checksum");
    const magic = h.subarray(257, 265).toString("binary");
    requireThat(magic === "ustar\0" + "00" || magic === "ustar  \0", "tar-format");
    for (const [start, len] of [[100, 8], [108, 8], [116, 8], [136, 12]] as const) octal(h, start, len);
    const type = String.fromCharCode(h[156]!), size = octal(h, 124, 12);
    const prefix = magic.startsWith("ustar\0") ? field(h, 345, 155) : "";
    const physical = (prefix ? `${prefix}/` : "") + field(h, 0, 100);
    if (!(type === "L" && ["././@LongLink", "./LongLink"].includes(physical))) safeMember(physical);
    requireThat(["0", "\0", "5", "x", "g", "L"].includes(type) && field(h, 157, 100) === "", "tar-unsupported-type-or-link");
    const start = offset + 512, end = start + size, next = start + Math.ceil(size / 512) * 512;
    requireThat(Number.isSafeInteger(next) && next <= tar.length && tar.subarray(end, next).every(b => b === 0), "tar-payload-padding");
    const payload = tar.subarray(start, end);
    if (candidates.has(physical)) {
      requireThat(!physicalSelected.has(physical) && (type === "0" || type === "\0"), "physical-selected-duplicate-or-type");
      physicalSelected.add(physical);
    }
    if (type === "x" || type === "g") {
      requireThat(!local && longname === undefined, "metadata-stacking");
      const metadata = pax(payload);
      if (type === "g") requireThat(!metadata.has("path") && !metadata.has("size"), "global-path-or-size");
      else local = metadata;
    } else if (type === "L") {
      requireThat(!local && longname === undefined && payload.length > 1 && payload[payload.length - 1] === 0 && payload.subarray(0, -1).indexOf(0) === -1, "gnu-longname");
      longname = utf8.decode(payload.subarray(0, -1)); safeMember(longname);
    } else {
      const logical = local?.get("path") ?? longname ?? physical;
      safeMember(logical);
      const paxSize = local?.get("size");
      requireThat(paxSize === undefined || (/^(0|[1-9][0-9]*)$/.test(paxSize) && Number(paxSize) === size), "pax-size-origin-ambiguity");
      if (type === "5") requireThat(size === 0, "directory-size");
      if (candidates.has(physical) || candidates.has(logical)) {
        requireThat(physical === logical && (type === "0" || type === "\0") && !selected.has(logical), "selected-origin-type-or-duplicate");
        selected.set(logical, Buffer.from(payload));
      }
      local = undefined; longname = undefined;
    }
    offset = next;
  }
  requireThat(ended, "missing-terminator");
  const files: Selected[] = spec.requiredMembers.map(member => {
    const data = selected.get(member.member); requireThat(data !== undefined, "missing-required-member");
    return { ...member, data, license: false };
  });
  const packageData = selected.get("package/package.json"); requireThat(packageData !== undefined, "package-json-required");
  const pkg = object(JSON.parse(utf8.decode(packageData)));
  requireThat(pkg["name"] === spec.name && pkg["version"] === spec.version, "package-identity");
  const licenseMember = spec.optionalLicenseMembersInPreferenceOrder.find(name => selected.has(name)) ?? null;
  if (licenseMember !== null) files.push({ member: licenseMember, retainedFile: spec.licenseRetainedFilePrefix + licenseMember.split("/").at(-1)!, data: selected.get(licenseMember)!, license: true });
  requireThat(spec.maximumLicenseFiles === 1 && files.length <= 3 && files.reduce((n, f) => n + f.data.length, 0) <= CAPS.selected, "selected-cap");
  return { files, licenseMember, legalClearance: false, expandedBytesIncludingSkippedContent: tar.length, physicalTarHeaders: headers };
}

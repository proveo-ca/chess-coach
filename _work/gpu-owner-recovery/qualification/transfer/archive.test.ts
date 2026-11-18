// SPEC: _spec/gpu-input-transfer.puml
import { describe, expect, test } from "bun:test";
import { parseTarListing, selectLibdevice, type ArchiveMember } from "./archive";

const ROOT = "libnvvm-linux-x86_64-13.0.48-archive";
const BITCODE = `${ROOT}/nvvm/libdevice/libdevice.10.bc`;
const LICENSE = `${ROOT}/LICENSE`;

function line(name: string, size = 32, mode = "-rw-r--r--", time = "12:34"): string {
  return `${mode} 1000/1000 ${String(size).padStart(9)} 2026-10-15 ${time} ${name}`;
}

function member(name: string, size = 32, kind: ArchiveMember["kind"] = "file"): ArchiveMember {
  return { name, kind, size };
}

describe("parseTarListing with pure GNU tar listing fixtures", () => {
  test("records regular files, directories, symlinks, hardlinks, and other types", () => {
    const text = [
      line(`${ROOT}/`, 0, "drwxr-xr-x"),
      line(BITCODE, 512, "-rw-r--r--", "12:34:56"),
      line(LICENSE, 64),
      line(`${ROOT}/alias -> nvvm/libdevice/libdevice.10.bc`, 0, "lrwxrwxrwx"),
      line(`${ROOT}/hard-alias link to ${BITCODE}`, 0, "hrw-r--r--"),
      line(`${ROOT}/pipe`, 0, "prw-------"),
    ].join("\n") + "\n";
    expect(parseTarListing(text)).toEqual([
      member(`${ROOT}/`, 0, "directory"),
      member(BITCODE, 512),
      member(LICENSE, 64),
      member(`${ROOT}/alias`, 0, "symlink"),
      member(`${ROOT}/hard-alias`, 0, "hardlink"),
      member(`${ROOT}/pipe`, 0, "other"),
    ]);
  });

  test("preserves literal spaces, wildcard characters, and a standard ./ prefix", () => {
    const name = `./${ROOT}/literal [name]* ?.txt`;
    expect(parseTarListing(line(name))).toEqual([member(name)]);
    expect(parseTarListing(line("./", 0, "drwxr-xr-x"))).toEqual([member("./", 0, "directory")]);
  });

  test("allows an empty inventory but not blank inventory rows", () => {
    expect(parseTarListing("")).toEqual([]);
    expect(() => parseTarListing("\n")).toThrow();
    expect(() => parseTarListing(`${line(LICENSE)}\n\n`)).toThrow();
  });

  test("rejects duplicate literal and equivalent ./ names", () => {
    expect(() => parseTarListing(`${line(BITCODE)}\n${line(BITCODE)}`)).toThrow(/Duplicate/);
    expect(() => parseTarListing(`${line(BITCODE)}\n${line(`./${BITCODE}`)}`)).toThrow(/Duplicate/);
  });

  test.each([
    "/absolute/libdevice.10.bc",
    "../libdevice.10.bc",
    `${ROOT}/../libdevice.10.bc`,
    `${ROOT}//libdevice.10.bc`,
    `${ROOT}/./libdevice.10.bc`,
    `${ROOT}/libdevice.10.bc/`,
    `${ROOT}/bad\\name`,
    `${ROOT}/escaped\\040name`,
    `${ROOT}/escaped\\nname`,
    `${ROOT}/tab\tname`,
    `${ROOT}/nul\0name`,
  ])("rejects unsafe or escaped name %j", (name) => {
    expect(() => parseTarListing(line(name))).toThrow();
  });

  test.each([
    line(BITCODE).replace("       32", "       -1"),
    line(BITCODE).replace("       32", "      1.5"),
    line(BITCODE).replace("       32", "9007199254740992"),
    line(BITCODE).replace("1000/1000", "user/group"),
    line(BITCODE).replace("2026-10-15", "Oct 15 2026"),
    line(BITCODE).replace("12:34", "25:34"),
    line(BITCODE).replace("-rw-r--r--", "invalid"),
    line(BITCODE) + "\r",
    line(`${ROOT}/alias`, 0, "lrwxrwxrwx"),
    line(`${ROOT}/alias -> `, 0, "lrwxrwxrwx"),
    line(`${ROOT}/alias -> target -> another`, 0, "lrwxrwxrwx"),
    line(`${ROOT}/alias`, 0, "hrw-r--r--"),
  ])("rejects an unexpected listing row %j", (text) => {
    expect(() => parseTarListing(text)).toThrow();
  });
});

describe("selectLibdevice with pure member fixtures", () => {
  test("returns only the unique bitcode and case-insensitive vendor license basenames", () => {
    const bitcode = member(BITCODE, 2 * 1024 * 1024);
    const license = member(LICENSE, 512 * 1024);
    const eula = member(`${ROOT}/eUlA.txt`, 512 * 1024);
    const selected = selectLibdevice([
      member(`${ROOT}/`, 0, "directory"),
      bitcode,
      license,
      eula,
      member(`${ROOT}/lib/libnvvm.so`, 30_000_000),
      member(`${ROOT}/LICENSES-not-selected`, 1),
      member(`${ROOT}/not-libdevice.10.bc`, 1),
    ]);
    expect(selected).toEqual({ bitcode, licenses: [license, eula] });
    expect(selected.bitcode).toBe(bitcode);
    expect(selected.licenses[0]).toBe(license);
  });

  test("requires a bitcode member", () => {
    expect(() => selectLibdevice([member(LICENSE)])).toThrow(/exactly one/);
  });

  test("rejects multiple matching bitcode basenames even when a match is nonregular", () => {
    expect(() => selectLibdevice([member(BITCODE), member("elsewhere/libdevice.10.bc"), member(LICENSE)]))
      .toThrow(/exactly one/);
    expect(() => selectLibdevice([
      member(BITCODE), member("elsewhere/libdevice.10.bc/", 0, "directory"), member(LICENSE),
    ])).toThrow(/exactly one/);
  });

  test.each(["directory", "symlink", "hardlink", "other"] as const)("rejects %s bitcode", (kind) => {
    expect(() => selectLibdevice([member(BITCODE, 32, kind), member(LICENSE)])).toThrow(/regular file/);
  });

  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 * 1024 * 1024 + 1])(
    "rejects bitcode size %j", (size) => {
      expect(() => selectLibdevice([member(BITCODE, size), member(LICENSE)])).toThrow(/byte limit/);
    },
  );

  test("requires at least one vendor license", () => {
    expect(() => selectLibdevice([member(BITCODE), member(`${ROOT}/README`)])).toThrow(/no vendor/);
  });

  test.each(["directory", "symlink", "hardlink", "other"] as const)("rejects a %s license even alongside a regular license", (kind) => {
    expect(() => selectLibdevice([
      member(BITCODE), member(LICENSE), member(`${ROOT}/EULA`, 32, kind),
    ])).toThrow(/regular file/);
  });

  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1024 * 1024 + 1])(
    "rejects license size %j", (size) => {
      expect(() => selectLibdevice([member(BITCODE), member(LICENSE, size)])).toThrow(/byte limit/);
    },
  );

  test("enforces the combined license byte cap", () => {
    expect(() => selectLibdevice([
      member(BITCODE), member(LICENSE, 1024 * 1024), member(`${ROOT}/EULA`, 1),
    ])).toThrow(/total byte limit/);
  });

  test("keeps exact member names selected from a listing", () => {
    const names = [`./${BITCODE}`, `./${ROOT}/License.txt`];
    const selected = selectLibdevice(parseTarListing(names.map((name) => line(name)).join("\n")));
    expect(selected.bitcode.name).toBe(names[0]);
    expect(selected.licenses.map((license) => license.name)).toEqual([names[1]]);
  });
});
